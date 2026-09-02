"""Seed the database with a batch of mock events for the demo.

Usage:
    python -m scripts.seed --count 200
    python -m scripts.seed --count 500 --fast
"""
import argparse
import asyncio
import sys
from pathlib import Path

# Allow running from prototype/ as `python scripts/seed.py`
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.ingestion.mock_sources import MockDataGenerator
from backend.ingestion.pipeline import get_pipeline
from backend.database import init_db


async def main(count: int, fast: bool, seed: int | None):
    await init_db()
    pipeline = get_pipeline()
    generator = MockDataGenerator(seed=seed)

    print(f"Seeding {count} events (fast={fast})...")
    for i in range(count):
        raw = generator.generate()
        try:
            await pipeline.ingest_one(raw)
        except Exception as e:
            print(f"  [{i}] failed: {e}")
        if (i + 1) % 50 == 0:
            print(f"  {i+1}/{count} ingested")
        if not fast:
            await asyncio.sleep(0.05)

    print(f"Done. {count} events ingested.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=200)
    parser.add_argument("--fast", action="store_true", help="Skip inter-event delay")
    parser.add_argument("--seed", type=int, default=None)
    args = parser.parse_args()
    asyncio.run(main(args.count, args.fast, args.seed))
