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
    deleted: int | None = None
    type: str | None = None
    by: str | None = None
    time: int | None = None
    title: str | None = None
    url: str | None = None
    text: str | None = None
    dead: int | None = None
    score: int | None = None
    descendants: int | None = None
    parent: int | None = None
    poll: int | None = None
    kids: str | None = None
    parts: str | None = None
    fetched_at: str | None = None
    updated_at: str | None = None
