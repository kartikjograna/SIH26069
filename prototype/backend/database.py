"""Database setup and session management."""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from .config import settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.SQL_ECHO,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Create all tables. Imports models to register them with Base."""
    from . import models  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_source_credibility()


def _classify_source(source_name: str) -> str:
    """Map a source key to its broad type for the admin credibility table."""
    if source_name in ("imd_official", "ndma"):
        return "official"
    if source_name.startswith("news_"):
        return "news"
    if source_name.startswith(("twitter_", "facebook_")):
        return "social"
    return "citizen"


async def seed_source_credibility():
    """Upsert the known-source credibility baseline.

    The ML pipeline scores sources from SOURCE_BASE_SCORES, but the admin panel
    reads the source_credibility table -- without this it renders empty.
    Existing rows keep their live counters and are only re-pointed at the
    current baseline score.
    """
    from sqlalchemy import select
    from .ml.pipeline import SOURCE_BASE_SCORES
    from .models import SourceCredibility

    async with AsyncSessionLocal() as session:
        existing = await session.execute(select(SourceCredibility.source_name))
        known = set(existing.scalars().all())

        for name, score in SOURCE_BASE_SCORES.items():
            if name in known:
                continue
            session.add(
                SourceCredibility(
                    source_name=name,
                    source_type=_classify_source(name),
                    credibility_score=score,
                    total_reports=0,
                    verified_reports=0,
                )
            )
        await session.commit()
