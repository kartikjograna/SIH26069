"""Admin endpoints: manual review actions, source credibility management."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import math

from ..database import get_db
from ..models import WeatherEvent, VerificationResult, SourceCredibility
from ..schemas import ManualReviewAction, WeatherEventSchema, SourceCredibilitySchema, ReviewQueueResponse, ClusterResponse
from .events import invalidate_stats_cache

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points in kilometers."""
    R = 6371.0  # Earth radius in kilometers
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


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


@router.get("/clusters", response_model=List[ClusterResponse])
async def get_clusters(db: AsyncSession = Depends(get_db)):
    """Group manual review events into temporal-spatial clusters."""
    stmt = select(WeatherEvent).where(WeatherEvent.verification_status == "manual_review")
    result = await db.execute(stmt)
    events = result.scalars().all()

    if not events:
        return []

    # Step 1: Broad Grouping by City and Primary Category
    groups: Dict[tuple, List[WeatherEvent]] = {}
    for e in events:
        # Get the category with the highest score
        category = "unknown"
        if e.predicted_categories:
            category = max(e.predicted_categories, key=e.predicted_categories.get)

        group_key = (e.city, category)
        if group_key not in groups:
            groups[group_key] = []
        groups[group_key].append(e)

    clusters: List[ClusterResponse] = []

    # Step 2: Refined Clustering within each group
    for (city, category), group_events in groups.items():
        processed = set()

        # Sort events by time to make seed selection consistent
        sorted_events = sorted(group_events, key=lambda x: x.event_time)

        for i, seed in enumerate(sorted_events):
            if seed.id in processed:
                continue

            cluster_ids = [seed.id]
            member_events = [seed]
            processed.add(seed.id)

            for j in range(i + 1, len(sorted_events)):
                candidate = sorted_events[j]
                if candidate.id in processed:
                    continue

                # Temporal Threshold: +/- 6 hours
                time_diff = abs((candidate.event_time - seed.event_time).total_seconds())
                is_temporal = time_diff <= (6 * 3600)

                # Spatial Threshold: <= 10km
                dist = haversine_distance(seed.latitude, seed.longitude, candidate.latitude, candidate.longitude)
                is_spatial = dist <= 10.0

                if is_temporal and is_spatial:
                    cluster_ids.append(candidate.id)
                    member_events.append(candidate)
                    processed.add(candidate.id)

            # Calculate Cluster Metadata
            avg_lat = sum(e.latitude for e in member_events) / len(member_events)
            avg_lng = sum(e.longitude for e in member_events) / len(member_events)
            start_time = min(e.event_time for e in member_events)
            end_time = max(e.event_time for e in member_events)

            clusters.append(ClusterResponse(
                cluster_id=f"cluster_{city}_{category}_{seed.id}",
                centroid={"lat": avg_lat, "lng": avg_lng},
                category=category,
                event_count=len(cluster_ids),
                event_ids=cluster_ids,
                time_range={"start": start_time, "end": end_time},
                city=city
            ))

    return clusters


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
