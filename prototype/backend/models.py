"""SQLAlchemy ORM models for weather events and verification results."""
from datetime import datetime
from sqlalchemy import String, Float, DateTime, JSON, Integer, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class WeatherEvent(Base):
    """A raw weather event ingested from any source."""
    __tablename__ = "weather_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    external_id: Mapped[str] = mapped_column(String(128), index=True)
    source: Mapped[str] = mapped_column(String(64), index=True)  # twitter, facebook, news, citizen
    source_credibility: Mapped[float] = mapped_column(Float, default=0.5)
    text: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(8), default="en")
    city: Mapped[str] = mapped_column(String(128), index=True)
    state: Mapped[str] = mapped_column(String(128), index=True)
    latitude: Mapped[float] = mapped_column(Float, index=True)
    longitude: Mapped[float] = mapped_column(Float, index=True)
    has_image: Mapped[bool] = mapped_column(default=False)
    image_url: Mapped[str] = mapped_column(String(512), nullable=True)
    has_video: Mapped[bool] = mapped_column(default=False)
    media_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    event_time: Mapped[datetime] = mapped_column(DateTime, index=True)
    ingested_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    # Verification result
    verification_status: Mapped[str] = mapped_column(String(32), default="pending", index=True)  # verified, manual_review, rejected
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0, index=True)
    predicted_categories: Mapped[dict] = mapped_column(JSON, default=dict)
    is_duplicate: Mapped[bool] = mapped_column(default=False, index=True)
    duplicate_of_id: Mapped[int] = mapped_column(Integer, nullable=True)

    verification: Mapped["VerificationResult"] = relationship(
        back_populates="event",
        uselist=False,
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_event_time_status", "event_time", "verification_status"),
        Index("idx_event_category_status", "verification_status"),
    )


class VerificationResult(Base):
    """Detailed verification scores from each ML model."""
    __tablename__ = "verification_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("weather_events.id"), index=True)

    # Individual model scores
    fake_news_score: Mapped[float] = mapped_column(Float, default=0.0)
    fake_news_model: Mapped[str] = mapped_column(String(64), default="")
    event_classification: Mapped[dict] = mapped_column(JSON, default=dict)
    image_forensics_score: Mapped[float] = mapped_column(Float, default=0.0)
    duplicate_hash: Mapped[str] = mapped_column(String(64), default="")
    source_credibility_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Aggregate
    final_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    decision: Mapped[str] = mapped_column(String(32), default="pending")  # verified, manual_review, rejected
    reasons: Mapped[list] = mapped_column(JSON, default=list)

    verified_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    event: Mapped["WeatherEvent"] = relationship(back_populates="verification")


class SourceCredibility(Base):
    """Track credibility scores for known sources."""
    __tablename__ = "source_credibility"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    source_type: Mapped[str] = mapped_column(String(32))  # official, news, social, citizen
    credibility_score: Mapped[float] = mapped_column(Float, default=0.5)
    total_reports: Mapped[int] = mapped_column(Integer, default=0)
    verified_reports: Mapped[int] = mapped_column(Integer, default=0)
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
