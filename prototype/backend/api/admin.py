"""Admin endpoints: manual review actions, source credibility management."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import WeatherEvent, VerificationResult, SourceCredibility
from ..schemas import ManualReviewAction, WeatherEventSchema, SourceCredibilitySchema

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/review-queue", response_model=list[WeatherEventSchema])
async def review_queue(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Events in the manual review queue (60-85% confidence)."""
    stmt = (
        select(WeatherEvent)
        .options(selectinload(WeatherEvent.verification))
        .where(WeatherEvent.verification_status == "manual_review")
        .order_by(WeatherEvent.confidence_score.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


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
