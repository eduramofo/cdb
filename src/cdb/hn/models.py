from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class HNItem(BaseModel):
    id: int
    type: Optional[str] = None
    by: Optional[str] = None
    time: Optional[int] = None
    title: Optional[str] = None
    url: Optional[str] = None
    text: Optional[str] = None
    score: Optional[int] = None
    descendants: Optional[int] = None
    parent: Optional[int] = None
    kids: Optional[list[int]] = None
    raw_json: str = ""
    fetched_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class LoadReport(BaseModel):
    start_time: str
    end_time: str
    duration_seconds: float
    range_start: int
    range_end: int
    total_consulted: int
    inserted: int
    updated: int
    ignored: int
    failed: int
    failed_ids: list[int] = []


class HNStatus(BaseModel):
    last_processed_id: Optional[int] = None
    max_item_id: Optional[int] = None
    total_items: int = 0
    items_by_type: dict[str, int] = {}
