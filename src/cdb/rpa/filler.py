import json
import logging
import re
import time
from datetime import datetime, timezone
from pathlib import Path

from playwright.async_api import Page

from cdb.db.database import get_all_records
from cdb.rpa.browser import launch_browser

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "artifacts"

RPA_URL = "https://rpachallenge.com"

FIELD_MAP = {
    "First Name": "First Name",
    "Last Name": "Last Name",
    "Company Name": "Company Name",
    "Role in Company": "Role in Company",
    "Address": "Address",
    "Email": "Email",
    "Phone Number": "Phone Number",
}


async def run_challenge(headed: bool = False) -> dict:
    records = get_all_records()
    if not records:
        return {"status": "error", "message": "Nenhum registro no banco. Execute /download-sheet primeiro."}

    browser, context, page = await launch_browser(headed=headed)
    start_time = time.time()

    try:
        await page.goto(RPA_URL, wait_until="domcontentloaded")
        await page.get_by_role("button", name="Start").click()
        await page.wait_for_timeout(500)

        errors = []
        total = len(records)

        for idx, record in enumerate(records):
            try:
                await _fill_form(page, record)
                await page.get_by_role("button", name="Submit").click()
                logger.info(f"[{idx + 1}/{total}] OK: {record['first_name']} {record['last_name']}")
            except Exception as e:
                errors.append({"index": idx, "record": record.get("first_name", "?"), "error": str(e)})
                logger.error(f"[{idx + 1}/{total}] FAIL: {record.get('first_name', '?')} — {e}")

        await page.wait_for_timeout(3000)

        page_text = await page.evaluate("() => document.body.innerText")
        challenge_result = _parse_challenge_result(page_text)

        duration = round(time.time() - start_time, 2)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        result = {
            "status": "success" if challenge_result.get("rate") == 100 else "partial",
            "challenge_message": challenge_result.get("message", ""),
            "fields_correct": challenge_result.get("correct", 0),
            "fields_total": challenge_result.get("total", 0),
            "accuracy_pct": challenge_result.get("rate", 0),
            "duration_seconds": duration,
            "records_processed": total,
            "errors": errors,
            "artifacts": {},
        }

        artifacts = await _save_artifacts(page, result, timestamp)
        result["artifacts"] = artifacts

        return result

    finally:
        await context.close()
        await browser.close()


async def _fill_form(page: Page, record: dict) -> None:
    for db_field, form_label in FIELD_MAP.items():
        value = record.get(db_field.lower().replace(" ", "_"), "")
        if value:
            locator = page.locator(f'label:text-is("{form_label}") + input')
            await locator.fill(str(value))


def _parse_challenge_result(text: str) -> dict:
    match = re.search(r"success rate is (\d+)% \( (\d+) out of (\d+) fields\)", text)
    if match:
        return {
            "message": f"Your success rate is {match.group(1)}% ({match.group(2)} out of {match.group(3)} fields)",
            "rate": int(match.group(1)),
            "correct": int(match.group(2)),
            "total": int(match.group(3)),
        }
    return {"message": text.split("Congratulations!")[-1].strip().split("\n")[0] if "Congratulations!" in text else "unknown", "rate": 0, "correct": 0, "total": 0}


async def _save_artifacts(page: Page, result: dict, timestamp: str) -> dict:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    screenshot_path = ARTIFACTS_DIR / f"rpa_result_{timestamp}.png"
    await page.screenshot(path=str(screenshot_path), full_page=True)

    json_path = ARTIFACTS_DIR / f"rpa_result_{timestamp}.json"
    json_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")

    return {
        "screenshot": str(screenshot_path.name),
        "json": str(json_path.name),
    }
