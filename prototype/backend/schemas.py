"""Pydantic schemas for API request/response."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# ---------- Requests ----------

class CitizenReport(BaseModel):
    """A report submitted by a citizen via the dashboard."""
    text: str = Field(..., min_length=1, max_length=2000)
    city: str
    state: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    has_image: bool = False
    image_url: Optional[str] = None
    event_time: Optional[datetime] = None


class EventFilter(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    category: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    status: Optional[str] = None  # verified, manual_review, rejected
    min_confidence: Optional[float] = None
    limit: int = 100
    offset: int = 0


# ---------- Responses ----------

class VerificationResultSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    fake_news_score: float
    fake_news_model: str
    event_classification: Dict[str, float]
    image_forensics_score: float
    source_credibility_score: float
    final_confidence: float
    decision: str
    reasons: List[str]
    verified_at: datetime


class WeatherEventSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    external_id: str
    source: str
    source_credibility: float
    text: str
    language: str
    city: str
    state: str
    latitude: float
    longitude: float
    has_image: bool
    image_url: Optional[str]
    has_video: bool
    event_time: datetime
    ingested_at: datetime
    verification_status: str
    confidence_score: float
    predicted_categories: Dict[str, float]
    is_duplicate: bool
    verification: Optional[VerificationResultSchema] = None


class StatsSchema(BaseModel):
    total_events: int
    verified: int
    manual_review: int
    rejected: int
    duplicates_removed: int
    fake_news_detected: int
    events_last_hour: int
    events_last_24h: int
    avg_confidence: float
    by_category: Dict[str, int]
    by_source: Dict[str, int]
    by_state: Dict[str, int]


class SourceCredibilitySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    source_name: str
    source_type: str
    credibility_score: float
    total_reports: int
    verified_reports: int


class ManualReviewAction(BaseModel):
    event_id: int
    action: str  # approve, reject
    notes: Optional[str] = None
