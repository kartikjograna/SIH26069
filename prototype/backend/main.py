"""FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .ingestion.pipeline import get_pipeline
from .api.events import router as events_router
from .api.admin import router as admin_router
from .api.ws import router as ws_router, register_ws_broadcaster

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# DEBUG on the root logger makes these three libraries unusable: aiosqlite logs
# every cursor operation and watchfiles every filesystem event, so continuous
# ingestion buries our own lines. Pin them to WARNING regardless.
for _noisy in ("aiosqlite", "watchfiles", "watchfiles.main", "sqlalchemy.engine"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing database...")
    await init_db()

    logger.info("Registering WebSocket broadcaster...")
    register_ws_broadcaster()

    logger.info("Starting background ingestion (60 events/min)...")
    pipeline = get_pipeline()
    await pipeline.start_background(events_per_minute=60)

    yield

    # Shutdown
    logger.info("Stopping ingestion...")
    await pipeline.stop_background()


app = FastAPI(
    title="National Weather Big Data Analytics Platform",
    version="0.1.0",
    description="Real-time weather data ingestion, verification, and visualization",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Prototype only - lock down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events_router)
app.include_router(admin_router)
app.include_router(ws_router)


@app.get("/")
async def root():
    return {
        "service": "Weather Big Data Analytics Platform",
        "version": "0.1.0",
        "status": "running",
        "endpoints": {
            "docs": "/docs",
            "events": "/api/events",
            "stats": "/api/events/stats/overview",
            "review_queue": "/api/admin/review-queue",
            "websocket": "/ws/stream",
        },
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    # Only pass reload_dirs when reloading, or uvicorn warns that the reload
    # config is incomplete. Watching just backend/ keeps the reloader off data/,
    # whose SQLite file is rewritten several times a second by ingestion.
    extra = (
        {"reload_dirs": [str(settings.ROOT_DIR / "backend")]} if settings.RELOAD else {}
    )

    uvicorn.run(
        "backend.main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.RELOAD,
        **extra,
    )
