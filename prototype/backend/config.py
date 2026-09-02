"""Application configuration loaded from environment."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")


class Settings:
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./data/weather.db"
    )

    # CORS
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS",
        "*"  # Allow all in dev; set specific domains in production
    ).split(",")

    # App
    APP_HOST: str = os.getenv("APP_HOST", "0.0.0.0")
    # Render uses PORT, but allow APP_PORT override for local dev
    APP_PORT: int = int(os.getenv("PORT", os.getenv("APP_PORT", "8000")))
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    # Kept separate from DEBUG on purpose: echoing every statement is ~6k log
    # lines/minute under continuous ingestion, which buries real errors.
    SQL_ECHO: bool = os.getenv("SQL_ECHO", "false").lower() == "true"
    # Off by default, and deliberately NOT tied to DEBUG. This service owns a
    # stateful ingestion task and live WebSocket clients: an in-place reload
    # restarts ingestion and drops every connected dashboard. (On Windows the
    # reload also wedges — the child keeps serving and is never replaced.)
    RELOAD: bool = os.getenv("RELOAD", "false").lower() == "true"

    # ML
    USE_MOCK_MODELS: bool = os.getenv("USE_MOCK_MODELS", "true").lower() == "true"
    CONFIDENCE_THRESHOLD_HIGH: float = float(os.getenv("CONFIDENCE_THRESHOLD_HIGH", "0.85"))
    CONFIDENCE_THRESHOLD_MEDIUM: float = float(os.getenv("CONFIDENCE_THRESHOLD_MEDIUM", "0.60"))

    # Paths
    ROOT_DIR: Path = ROOT_DIR
    DATA_DIR: Path = ROOT_DIR / "data"
    MODELS_DIR: Path = ROOT_DIR / "models"

    # Event categories
    EVENT_CATEGORIES = [
        "rainfall",
        "thunderstorm",
        "flooding",
        "heatwave",
        "fog",
        "dust_storm",
        "strong_wind",
        "snowfall",
        "hailstorm",
        "cyclone",
    ]


settings = Settings()
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.MODELS_DIR.mkdir(parents=True, exist_ok=True)
