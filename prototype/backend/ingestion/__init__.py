"""Data ingestion package - mock sources for the prototype."""
from .mock_sources import MockDataGenerator, generate_batch
from .pipeline import IngestionPipeline

__all__ = ["MockDataGenerator", "generate_batch", "IngestionPipeline"]
