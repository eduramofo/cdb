import asyncio
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

_FILL_RETRIES = 3
_FILL_BACKOFF_BASE = 1.0


async def run_challenge(headed: bool = False) -> dict:
    records = get_all_records()
    if not records:
        return {
            "status": "error",
            "message": "Nenhum registro no banco. Execute /download-sheet primeiro.",
        }

    browser, context, page = await launch_browser(headed=headed)
    start_time = time.time()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

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
                error_screenshot = await _save_error_screenshot(page, idx, timestamp)
                entry = {
                    "index": idx,
                    "record": record.get("first_name", "?"),
                    "error": str(e),
                    "screenshot": error_screenshot,
                }
                errors.append(entry)
                logger.error(f"[{idx + 1}/{total}] FAIL: {record.get('first_name', '?')} — {e}")

        await page.wait_for_timeout(3000)

        page_text = await page.evaluate("() => document.body.innerText")
        challenge_result = _parse_challenge_result(page_text)

        duration = round(time.time() - start_time, 2)

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
            await _fill_field_with_retry(page, form_label, str(value))


async def _fill_field_with_retry(page: Page, label: str, value: str) -> None:
    last_error = None
    for attempt in range(1, _FILL_RETRIES + 1):
        try:
            locator = await _locator_for_field(page, label)
            await locator.fill(value)
            return
        except Exception as e:
            last_error = e
            logger.warning(f"Campo '{label}' tentativa {attempt}/{_FILL_RETRIES} falhou: {e}")
            if attempt < _FILL_RETRIES:
                await asyncio.sleep(_FILL_BACKOFF_BASE * attempt)
    raise last_error


async def _locator_for_field(page: Page, label: str):
    primary = page.locator(f'label:text-is("{label}") + input')
    if await primary.count() > 0:
        return primary

    fallback = page.locator(f'rpa1-field[ng-reflect-dictionary-value="{label}"] input')
    if await fallback.count() > 0:
        return fallback

    raise Exception(
        f"Campo '{label}' não encontrado (nem label adjacente, nem ng-reflect-dictionary-value)"
    )


def _parse_challenge_result(text: str) -> dict:
    match = re.search(r"success rate is (\d+)% \( (\d+) out of (\d+) fields\)", text)
    if match:
        return {
            "message": (
                f"Your success rate is {match.group(1)}% "
                f"({match.group(2)} out of {match.group(3)} fields)"
            ),
            "rate": int(match.group(1)),
            "correct": int(match.group(2)),
            "total": int(match.group(3)),
        }
    fallback = (
        text.split("Congratulations!")[-1].strip().split("\n")[0]
        if "Congratulations!" in text
        else "unknown"
    )
    return {"message": fallback, "rate": 0, "correct": 0, "total": 0}


async def _save_error_screenshot(page: Page, record_index: int, timestamp: str) -> str:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    path = ARTIFACTS_DIR / f"rpa_error_{record_index}_{timestamp}.png"
    await page.screenshot(path=str(path), full_page=True)
    return str(path.name)


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
