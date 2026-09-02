"""Event API endpoints - listing, filtering, retrieval, citizen reports."""
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import WeatherEvent, VerificationResult
from ..schemas import (
    WeatherEventSchema, CitizenReport, StatsSchema, SourceCredibilitySchema
)
from ..ingestion.pipeline import get_pipeline
from ..ingestion.mock_sources import RawEvent

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=List[WeatherEventSchema])
async def list_events(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    status: Optional[str] = None,
    min_confidence: Optional[float] = None,
    source: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List weather events with optional filters."""
    stmt = select(WeatherEvent).options(selectinload(WeatherEvent.verification))

    conditions = []
    if start_date:
        conditions.append(WeatherEvent.event_time >= start_date)
    if end_date:
        conditions.append(WeatherEvent.event_time <= end_date)
    if city:
        conditions.append(WeatherEvent.city == city)
    if state:
        conditions.append(WeatherEvent.state == state)
    if status:
        conditions.append(WeatherEvent.verification_status == status)
    if source:
        conditions.append(WeatherEvent.source == source)
    if min_confidence is not None:
        conditions.append(WeatherEvent.confidence_score >= min_confidence)
    if category:
        # JSON filter via LIKE on predicted_categories
        conditions.append(WeatherEvent.predicted_categories.like(f'%"{category}"%'))

    if conditions:
        stmt = stmt.where(and_(*conditions))

    stmt = stmt.order_by(WeatherEvent.ingested_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    events = result.scalars().all()
    return events


@router.get("/{event_id}", response_model=WeatherEventSchema)
async def get_event(event_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(WeatherEvent)
        .options(selectinload(WeatherEvent.verification))
        .where(WeatherEvent.id == event_id)
    )
    result = await db.execute(stmt)
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.post("/citizen-report", response_model=WeatherEventSchema)
async def submit_citizen_report(
    report: CitizenReport, db: AsyncSession = Depends(get_db)
):
    """Submit a citizen weather report. Will go through full ML verification."""
    from datetime import datetime
    raw = RawEvent(
        external_id=f"citizen-{datetime.utcnow().timestamp()}",
        source="citizen_report",
        text=report.text,
        city=report.city,
        state=report.state,
        latitude=report.latitude,
        longitude=report.longitude,
        has_image=report.has_image,
        image_url=report.image_url,
        event_time=report.event_time or datetime.utcnow(),
    )
    pipeline = get_pipeline()
    event = await pipeline.ingest_one(raw)
    return event


@router.get("/stats/overview", response_model=StatsSchema)
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Aggregate statistics for the dashboard."""
    total = await db.scalar(select(func.count(WeatherEvent.id)))
    verified = await db.scalar(
        select(func.count(WeatherEvent.id)).where(WeatherEvent.verification_status == "verified")
    )
    manual_review = await db.scalar(
        select(func.count(WeatherEvent.id)).where(WeatherEvent.verification_status == "manual_review")
    )
    rejected = await db.scalar(
        select(func.count(WeatherEvent.id)).where(WeatherEvent.verification_status == "rejected")
    )
    duplicates = await db.scalar(
        select(func.count(WeatherEvent.id)).where(WeatherEvent.is_duplicate == True)
    )
    fake_news = await db.scalar(
        select(func.count(VerificationResult.id))
        .join(WeatherEvent, WeatherEvent.id == VerificationResult.event_id)
        .where(VerificationResult.fake_news_score > 0.5)
    )
    avg_conf = await db.scalar(select(func.avg(WeatherEvent.confidence_score))) or 0.0

    from datetime import timedelta
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    one_day_ago = datetime.utcnow() - timedelta(hours=24)
    last_hour = await db.scalar(
        select(func.count(WeatherEvent.id)).where(WeatherEvent.ingested_at >= one_hour_ago)
    )
    last_24h = await db.scalar(
        select(func.count(WeatherEvent.id)).where(WeatherEvent.ingested_at >= one_day_ago)
    )

    # Group by category from JSON
    all_events = await db.execute(
        select(WeatherEvent.predicted_categories).where(WeatherEvent.predicted_categories.isnot(None))
    )
    by_category: dict[str, int] = {}
    for (cats,) in all_events.all():
        if isinstance(cats, dict) and cats:  # Check if dict is not empty
            top_cat = max(cats, key=cats.get) if cats else "general"
            by_category[top_cat] = by_category.get(top_cat, 0) + 1

    # Group by source
    src_rows = await db.execute(
        select(WeatherEvent.source, func.count(WeatherEvent.id)).group_by(WeatherEvent.source)
    )
    by_source = {src: cnt for src, cnt in src_rows.all()}

    # Group by state
    st_rows = await db.execute(
        select(WeatherEvent.state, func.count(WeatherEvent.id)).group_by(WeatherEvent.state)
    )
    by_state = {st: cnt for st, cnt in st_rows.all()}

    return StatsSchema(
        total_events=total or 0,
        verified=verified or 0,
        manual_review=manual_review or 0,
        rejected=rejected or 0,
        duplicates_removed=duplicates or 0,
        fake_news_detected=fake_news or 0,
        events_last_hour=last_hour or 0,
        events_last_24h=last_24h or 0,
        avg_confidence=round(avg_conf, 4),
        by_category=by_category,
        by_source=by_source,
        by_state=by_state,
    )
