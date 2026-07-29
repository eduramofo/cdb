from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from cdb.db.database import get_all_records, init_db, insert_records
from cdb.rpa.downloader import download_spreadsheet, parse_spreadsheet


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    init_db()
    yield


app = FastAPI(title="CDB - Challenge Data Bridge", version="0.1.0", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/rpa/download")
async def rpa_download():
    filepath = await download_spreadsheet()
    records = parse_spreadsheet(filepath)
    inserted = insert_records(records)
    return {
        "total_records": len(records),
        "inserted": inserted,
        "preview": records[:3],
    }


@app.get("/rpa/records")
async def rpa_records():
    records = get_all_records()
    return {"total": len(records), "records": records}
