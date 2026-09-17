"""Event API endpoints - listing, filtering, retrieval, citizen reports."""
import time
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_, case
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

# Fast in-memory TTL cache for dashboard aggregate statistics
_STATS_CACHE: Optional[StatsSchema] = None
_STATS_CACHE_TIME: float = 0.0
_STATS_CACHE_TTL: float = 3.0  # 3-second cache window


def invalidate_stats_cache():
    """Invalidate the in-memory stats cache when data changes."""
    global _STATS_CACHE_TIME
    _STATS_CACHE_TIME = 0.0


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
    invalidate_stats_cache()
    return event


@router.get("/stats/overview", response_model=StatsSchema)
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Aggregate statistics for the dashboard with in-memory TTL caching and consolidated queries."""
    global _STATS_CACHE, _STATS_CACHE_TIME

    now = time.time()
    if _STATS_CACHE is not None and (now - _STATS_CACHE_TIME) < _STATS_CACHE_TTL:
        return _STATS_CACHE

    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    one_day_ago = datetime.utcnow() - timedelta(hours=24)

    # 1. Consolidated single-pass aggregation query for WeatherEvent counts and averages
    agg_stmt = select(
        func.count(WeatherEvent.id).label("total"),
        func.coalesce(func.sum(case((WeatherEvent.verification_status == "verified", 1), else_=0)), 0).label("verified"),
        func.coalesce(func.sum(case((WeatherEvent.verification_status == "manual_review", 1), else_=0)), 0).label("manual_review"),
        func.coalesce(func.sum(case((WeatherEvent.verification_status == "rejected", 1), else_=0)), 0).label("rejected"),
        func.coalesce(func.sum(case((WeatherEvent.is_duplicate == True, 1), else_=0)), 0).label("duplicates"),
        func.coalesce(func.sum(case((WeatherEvent.ingested_at >= one_hour_ago, 1), else_=0)), 0).label("last_hour"),
        func.coalesce(func.sum(case((WeatherEvent.ingested_at >= one_day_ago, 1), else_=0)), 0).label("last_24h"),
        func.coalesce(func.avg(WeatherEvent.confidence_score), 0.0).label("avg_conf"),
    )
    agg_res = await db.execute(agg_stmt)
    agg_row = agg_res.one()

    # 2. Fake news detected count
    fake_news_stmt = select(func.count(VerificationResult.id)).where(VerificationResult.fake_news_score > 0.5)
    fake_news = (await db.scalar(fake_news_stmt)) or 0

    # 3. Group by source
    src_rows = await db.execute(
        select(WeatherEvent.source, func.count(WeatherEvent.id)).group_by(WeatherEvent.source)
    )
    by_source = {src: int(cnt) for src, cnt in src_rows.all() if src}

    # 4. Group by state
    st_rows = await db.execute(
        select(WeatherEvent.state, func.count(WeatherEvent.id)).group_by(WeatherEvent.state)
    )
    by_state = {st: int(cnt) for st, cnt in st_rows.all() if st}

    # 5. Group by category from JSON (latest sample up to 1000 events for ultra-fast aggregation)
    all_events = await db.execute(
        select(WeatherEvent.predicted_categories)
        .where(WeatherEvent.predicted_categories.isnot(None))
        .order_by(WeatherEvent.id.desc())
        .limit(1000)
    )
    by_category: dict[str, int] = {}
    for (cats,) in all_events.all():
        if isinstance(cats, dict) and cats:
            top_cat = max(cats, key=cats.get) if cats else "general"
            by_category[top_cat] = by_category.get(top_cat, 0) + 1

    stats = StatsSchema(
        total_events=int(agg_row.total or 0),
        verified=int(agg_row.verified or 0),
        manual_review=int(agg_row.manual_review or 0),
        rejected=int(agg_row.rejected or 0),
        duplicates_removed=int(agg_row.duplicates or 0),
        fake_news_detected=int(fake_news or 0),
        events_last_hour=int(agg_row.last_hour or 0),
        events_last_24h=int(agg_row.last_24h or 0),
        avg_confidence=round(float(agg_row.avg_conf or 0.0), 4),
        by_category=by_category,
        by_source=by_source,
        by_state=by_state,
    )

    _STATS_CACHE = stats
    _STATS_CACHE_TIME = time.time()
    return stats
