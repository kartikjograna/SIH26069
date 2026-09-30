"""Admin endpoints: manual review actions, source credibility management."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional

from ..database import get_db
from ..models import WeatherEvent, VerificationResult, SourceCredibility
from ..schemas import ManualReviewAction, WeatherEventSchema, SourceCredibilitySchema, ReviewQueueResponse
from .events import invalidate_stats_cache

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/review-queue", response_model=ReviewQueueResponse)
async def review_queue(
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("ingested_at", regex="^(ingested_at|confidence_score)$"),
    sort_dir: str = Query("desc", regex="^(asc|desc)$"),
    min_conf: Optional[float] = Query(None, ge=0, le=1),
    max_conf: Optional[float] = Query(None, ge=0, le=1),
    db: AsyncSession = Depends(get_db),
):
    """Events in the manual review queue with pagination, sorting, and confidence filtering."""
    # 1. Base query for manual review
    base_stmt = select(WeatherEvent).where(WeatherEvent.verification_status == "manual_review")

    # 2. Apply confidence filters
    if min_conf is not None:
        base_stmt = base_stmt.where(WeatherEvent.confidence_score >= min_conf)
    if max_conf is not None:
        base_stmt = base_stmt.where(WeatherEvent.confidence_score <= max_conf)

    # 3. Get total count for pagination
    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total_res = await db.execute(count_stmt)
    total = total_res.scalar() or 0

    # 4. Apply sorting and pagination to the final results query
    # Map sort_by string to actual model attribute
    sort_attr = WeatherEvent.ingested_at if sort_by == "ingested_at" else WeatherEvent.confidence_score
    order_expr = sort_attr.desc() if sort_dir == "desc" else sort_attr.asc()

    stmt = (
        base_stmt
        .options(selectinload(WeatherEvent.verification))
        .order_by(order_expr)
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(stmt)
    items = result.scalars().all()

    return ReviewQueueResponse(items=items, total=total)


@router.post("/review-action")
async def review_action(action: ManualReviewAction, db: AsyncSession = Depends(get_db)):
    """Approve or reject a manually reviewed event."""
    if action.action not in ("approve", "reject"):
        raise HTTPException(400, "action must be 'approve' or 'reject'")

    new_status = "verified" if action.action == "approve" else "rejected"
    stmt = (
        update(WeatherEvent)
        .where(WeatherEvent.id == action.event_id)
        .values(verification_status=new_status)
    )
    result = await db.execute(stmt)
    if result.rowcount == 0:
        raise HTTPException(404, "Event not found")
    await db.commit()
    invalidate_stats_cache()
    return {"event_id": action.event_id, "new_status": new_status, "notes": action.notes}


@router.get("/sources", response_model=list[SourceCredibilitySchema])
async def list_sources(db: AsyncSession = Depends(get_db)):
    """List all source credibility entries."""
    stmt = select(SourceCredibility).order_by(SourceCredibility.credibility_score.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/events/recent", response_model=list[WeatherEventSchema])
async def recent_events(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Most recent events across all statuses (for monitoring)."""
    stmt = (
        select(WeatherEvent)
        .options(selectinload(WeatherEvent.verification))
        .order_by(WeatherEvent.ingested_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()
