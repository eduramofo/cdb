from datetime import datetime

from pydantic import BaseModel, Field


class HNItem(BaseModel):
    id: int
    deleted: bool | None = None
    type: str | None = None
    by: str | None = None
    time: int | None = None
    title: str | None = None
    url: str | None = None
    text: str | None = None
    dead: bool | None = None
    score: int | None = None
    descendants: int | None = None
    parent: int | None = None
    poll: int | None = None
    kids: list[int] | None = None
    parts: list[int] | None = None
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
    last_processed_id: int | None = None
    max_item_id: int | None = None
    total_items: int = 0
    items_by_type: dict[str, int] = {}
