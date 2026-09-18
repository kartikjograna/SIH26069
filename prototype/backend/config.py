"""Application configuration loaded from environment."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")


class Settings:
    def __init__(self):
        # Process DATABASE_URL for asyncpg compatibility (e.g. Neon, Render, Supabase)
        _db_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/weather.db")

        if _db_url.startswith(("postgresql://", "postgres://", "postgresql+asyncpg://", "postgresql+psycopg2://")):
            from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
            parsed = urlparse(_db_url)
            query_dict = parse_qs(parsed.query, keep_blank_values=True)

            # Determine SSL configuration
            sslmode = query_dict.get("sslmode", [None])[0]
            ssl_param = query_dict.get("ssl", [None])[0]
            is_localhost = parsed.hostname in ("localhost", "127.0.0.1", None)

            self.CONNECT_ARGS = {}
            if sslmode == "disable" or ssl_param in ("false", "0", "disable"):
                pass
            elif sslmode in ("require", "verify-ca", "verify-full", "prefer") or ssl_param in ("true", "1", "require") or not is_localhost:
                self.CONNECT_ARGS = {"ssl": True}

            # Filter query parameters: asyncpg does not accept libpq parameters like
            # channel_binding, sslmode, options, target_session_attrs, etc.
            valid_asyncpg_params = {
                "timeout",
                "command_timeout",
                "statement_cache_size",
                "max_cached_statement_lifetime",
                "max_cacheable_statement_size",
                "server_settings",
            }
            filtered_query = {k: v for k, v in query_dict.items() if k in valid_asyncpg_params}
            new_query = urlencode(filtered_query, doseq=True)

            # Convert to asyncpg driver scheme
            self.DATABASE_URL = urlunparse(parsed._replace(
                scheme="postgresql+asyncpg",
                query=new_query
            ))
        else:
            # SQLite or other databases
            self.DATABASE_URL = _db_url
            self.CONNECT_ARGS = {}

        # CORS
        _cors_env = os.getenv("CORS_ORIGINS", "*")
        self.CORS_ORIGINS: list[str] = [
            origin.strip() for origin in _cors_env.split(",") if origin.strip()
        ]
        self.CORS_ORIGIN_REGEX: str | None = os.getenv(
            "CORS_ORIGIN_REGEX",
            r"^https?://.*" if "*" in self.CORS_ORIGINS else None
        )

        # App
        self.APP_HOST: str = os.getenv("APP_HOST", "0.0.0.0")
        # Render uses PORT, but allow APP_PORT override for local dev
        self.APP_PORT: int = int(os.getenv("PORT", os.getenv("APP_PORT", "8000")))
        self.DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
        # Kept separate from DEBUG on purpose: echoing every statement is ~6k log
        # lines/minute under continuous ingestion, which buries real errors.
        self.SQL_ECHO: bool = os.getenv("SQL_ECHO", "false").lower() == "true"
        # Off by default, and deliberately NOT tied to DEBUG. This service owns a
        # stateful ingestion task and live WebSocket clients: an in-place reload
        # restarts ingestion and drops every connected dashboard. (On Windows the
        # reload also wedges — the child keeps serving and is never replaced.)
        self.RELOAD: bool = os.getenv("RELOAD", "false").lower() == "true"

        # ML
        self.USE_MOCK_MODELS: bool = os.getenv("USE_MOCK_MODELS", "true").lower() == "true"
        self.CONFIDENCE_THRESHOLD_HIGH: float = float(os.getenv("CONFIDENCE_THRESHOLD_HIGH", "0.85"))
        self.CONFIDENCE_THRESHOLD_MEDIUM: float = float(os.getenv("CONFIDENCE_THRESHOLD_MEDIUM", "0.60"))

        # Paths
        self.ROOT_DIR: Path = ROOT_DIR
        self.DATA_DIR: Path = ROOT_DIR / "data"
        self.MODELS_DIR: Path = ROOT_DIR / "models"

        # Event categories
        self.EVENT_CATEGORIES = [
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

        # Create directories
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.MODELS_DIR.mkdir(parents=True, exist_ok=True)


settings = Settings()