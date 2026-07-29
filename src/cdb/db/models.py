from typing import Optional

from pydantic import BaseModel


class ChallengeRecord(BaseModel):
    first_name: str = ""
    last_name: str = ""
    company_name: str = ""
    role_in_company: str = ""
    address: str = ""
    email: str = ""
    phone_number: str = ""


class RecordSummary(BaseModel):
    total: int
    inserted: int
    message: str


class HNItemResponse(BaseModel):
    id: int
    deleted: Optional[int] = None
    type: Optional[str] = None
    by: Optional[str] = None
    time: Optional[int] = None
    title: Optional[str] = None
    url: Optional[str] = None
    text: Optional[str] = None
    dead: Optional[int] = None
    score: Optional[int] = None
    descendants: Optional[int] = None
    parent: Optional[int] = None
    poll: Optional[int] = None
    kids: Optional[str] = None
    parts: Optional[str] = None
    fetched_at: Optional[str] = None
    updated_at: Optional[str] = None
