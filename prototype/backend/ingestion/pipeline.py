"""Ingestion pipeline: receives raw events, runs ML verification, persists to DB,
and broadcasts via WebSocket to connected dashboards.

This is the orchestrator that ties ingestion + ML + storage together.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Callable, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import AsyncSessionLocal
from ..models import WeatherEvent, VerificationResult
from ..ml.pipeline import verify_event, VerificationOutcome
from .mock_sources import MockDataGenerator, RawEvent

logger = logging.getLogger(__name__)


# Callback type for WebSocket broadcaster
EventCallback = Callable[[dict], None]


class IngestionPipeline:
    """Coordinates: raw event -> ML verification -> DB persistence -> broadcast."""

    def __init__(self):
        self._generator = MockDataGenerator()
        self._callbacks: List[EventCallback] = []
        self._seen_hashes: dict[str, int] = {}  # duplicate_hash -> first event id
        self._running = False
        self._task: Optional[asyncio.Task] = None

    def subscribe(self, callback: EventCallback):
        """Register a callback to receive every newly-ingested event."""
        self._callbacks.append(callback)

    def unsubscribe(self, callback: EventCallback):
        if callback in self._callbacks:
            self._callbacks.remove(callback)

    def _broadcast(self, payload: dict):
        for cb in self._callbacks:
            try:
                cb(payload)
            except Exception as e:
                logger.exception(f"Broadcast callback failed: {e}")

    async def ingest_one(self, raw: RawEvent) -> WeatherEvent:
        """Run the full pipeline for a single raw event."""
        async with AsyncSessionLocal() as session:
            # 1. ML verification
            outcome = verify_event(
                text=raw.text,
                source=raw.source,
                has_image=raw.has_image,
                image_url=raw.image_url,
                language=raw.language,
            )

            # 2. Duplicate detection
            duplicate_of_id = None
            is_duplicate = False
            if outcome.duplicate_hash in self._seen_hashes:
                is_duplicate = True
                duplicate_of_id = self._seen_hashes[outcome.duplicate_hash]
            else:
                self._seen_hashes[outcome.duplicate_hash] = -1  # will update with real id

            # 3. Persist event
            event = WeatherEvent(
                external_id=raw.external_id,
                source=raw.source,
                source_credibility=outcome.source_credibility_score,
                text=raw.text,
                language=raw.language,
                city=raw.city,
                state=raw.state,
                latitude=raw.latitude,
                longitude=raw.longitude,
                has_image=raw.has_image,
                image_url=raw.image_url,
                has_video=raw.has_video,
                event_time=raw.event_time,
                ingested_at=datetime.utcnow(),
                verification_status=outcome.decision,
                confidence_score=outcome.final_confidence,
                predicted_categories=outcome.event_classification,
                is_duplicate=is_duplicate,
                duplicate_of_id=duplicate_of_id,
            )
            session.add(event)
            await session.flush()  # get id

            # 4. Update seen hashes with real id
            if not is_duplicate:
                self._seen_hashes[outcome.duplicate_hash] = event.id

            # 5. Persist detailed verification
            verification = VerificationResult(
                event_id=event.id,
                fake_news_score=outcome.fake_news_score,
                fake_news_model=outcome.fake_news_model,
                event_classification=outcome.event_classification,
                image_forensics_score=outcome.image_forensics_score,
                duplicate_hash=outcome.duplicate_hash,
                source_credibility_score=outcome.source_credibility_score,
                final_confidence=outcome.final_confidence,
                decision=outcome.decision,
                reasons=outcome.reasons,
                verified_at=datetime.utcnow(),
            )
            session.add(verification)
            await session.commit()
            await session.refresh(event)
            await self._bump_source_counters(session, raw.source, outcome.decision)
            event = await self._load_full_event(session, event.id)

            payload = self._to_payload(event, outcome)
            self._broadcast(payload)
            return event

    async def ingest_batch(self, raws: List[RawEvent]) -> List[WeatherEvent]:
        return [await self.ingest_one(r) for r in raws]

    async def start_background(self, events_per_minute: int = 60):
        """Start ingesting simulated events at a steady rate."""
        if self._running:
            return
        self._running = True
        interval = 60.0 / events_per_minute
        self._task = asyncio.create_task(self._run_loop(interval))
        logger.info(f"Ingestion started: {events_per_minute} events/min")

    async def stop_background(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("Ingestion stopped")

    async def _run_loop(self, interval: float):
        try:
            while self._running:
                raw = self._generator.generate()
                try:
                    await self.ingest_one(raw)
                except Exception:
                    logger.exception("Failed to ingest event")
                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            raise

    @staticmethod
    async def _bump_source_counters(session: AsyncSession, source: str, decision: str):
        """Keep the admin source-credibility table's counters live."""
        from sqlalchemy import update as sql_update
        from ..models import SourceCredibility

        values = {"total_reports": SourceCredibility.total_reports + 1}
        if decision == "verified":
            values["verified_reports"] = SourceCredibility.verified_reports + 1
        values["last_updated"] = datetime.utcnow()

        await session.execute(
            sql_update(SourceCredibility)
            .where(SourceCredibility.source_name == source)
            .values(**values)
        )
        await session.commit()

    @staticmethod
    async def _load_full_event(session: AsyncSession, event_id: int) -> WeatherEvent:
        from sqlalchemy.orm import selectinload
        stmt = (
            select(WeatherEvent)
            .options(selectinload(WeatherEvent.verification))
            .where(WeatherEvent.id == event_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one()

    @staticmethod
    def _to_payload(event: WeatherEvent, outcome: VerificationOutcome) -> dict:
        return {
            "id": event.id,
            "source": event.source,
            "text": event.text,
            "city": event.city,
            "state": event.state,
            "latitude": event.latitude,
            "longitude": event.longitude,
            "has_image": event.has_image,
            "image_url": event.image_url,
            "event_time": event.event_time.isoformat(),
            "ingested_at": event.ingested_at.isoformat(),
            "verification_status": event.verification_status,
            "confidence_score": event.confidence_score,
            "predicted_categories": event.predicted_categories,
            "is_duplicate": event.is_duplicate,
            "reasons": outcome.reasons,
        }


# Singleton
_pipeline_instance: IngestionPipeline | None = None


def get_pipeline() -> IngestionPipeline:
    global _pipeline_instance
    if _pipeline_instance is None:
        _pipeline_instance = IngestionPipeline()
    return _pipeline_instance
