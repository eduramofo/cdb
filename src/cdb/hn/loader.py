import logging
from datetime import datetime, timezone
from pathlib import Path

from cdb.db.database import (
    get_watermark,
    set_watermark,
    upsert_hn_items,
)
from cdb.hn.client import HackerNewsClient
from cdb.hn.models import LoadReport

logger = logging.getLogger(__name__)
ARTIFACTS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "artifacts"
WATERMARK_KEY = "last_processed_id"


class HnLoader:
    def __init__(self, client: HackerNewsClient, report_dir: str = "artifacts") -> None:
        self.client = client
        self.report_dir = Path(report_dir) if Path(report_dir).is_absolute() else ARTIFACTS_DIR
        self.report_dir.mkdir(parents=True, exist_ok=True)

    async def load(self, limit: int | None = None) -> LoadReport:
        start_time = datetime.now(timezone.utc)
        start_iso = start_time.isoformat()

        max_item = await self.client.get_max_item_id()
        last_id_str = get_watermark(WATERMARK_KEY)
        last_processed_id = int(last_id_str) if last_id_str else None

        if last_processed_id is not None:
            range_start = last_processed_id + 1
            logger.info(
                "Watermark found: "
                f"last_processed_id={last_processed_id}. Starting from {range_start}."
            )
        elif limit is not None:
            range_start = max(1, max_item - limit + 1)
            logger.info(
                f"No watermark. First run with limit={limit}. Processing {range_start}..{max_item}"
            )
        else:
            range_start = 1
            logger.info(f"No watermark and no limit. Processing all items from 1 to {max_item}")

        if limit is not None and last_processed_id is not None:
            range_end = min(range_start + limit - 1, max_item)
        elif limit is not None:
            range_end = max_item
        else:
            range_end = max_item

        total_ids = range_end - range_start + 1
        if total_ids <= 0:
            logger.info("No new items to process.")
            return LoadReport(
                start_time=start_iso,
                end_time=start_iso,
                duration_seconds=0.0,
                range_start=range_start,
                range_end=range_end,
                total_consulted=0,
                inserted=0,
                updated=0,
                ignored=0,
                failed=0,
            )

        inserted = 0
        updated = 0
        ignored = 0
        failed = 0
        failed_ids: list[int] = []
        highest_processed = range_start - 1
        batch: list[dict] = []

        for item_id in range(range_start, range_end + 1):
            try:
                result = await self.client.get_item(item_id)
                if result is None:
                    ignored += 1
                    highest_processed = item_id
                    continue

                if result.get("deleted"):
                    ignored += 1
                    highest_processed = item_id
                    continue

                batch.append(result)
                highest_processed = item_id

                if len(batch) >= 50:
                    ins, upd = upsert_hn_items(batch)
                    inserted += ins
                    updated += upd
                    set_watermark(WATERMARK_KEY, str(highest_processed))
                    logger.info(
                        f"Batch committed: {len(batch)} items, "
                        f"inserted={ins}, updated={upd}, watermark={highest_processed}"
                    )
                    batch = []
            except Exception:
                failed += 1
                failed_ids.append(item_id)
                logger.exception(f"Item {item_id}: unexpected error")
                highest_processed = max(highest_processed, item_id)

        if batch:
            ins, upd = upsert_hn_items(batch)
            inserted += ins
            updated += upd
            set_watermark(WATERMARK_KEY, str(highest_processed))
            logger.info(
                f"Final batch committed: {len(batch)} items, "
                f"inserted={ins}, updated={upd}, watermark={highest_processed}"
            )

        end_time = datetime.now(timezone.utc)
        duration = (end_time - start_time).total_seconds()

        report = LoadReport(
            start_time=start_iso,
            end_time=end_time.isoformat(),
            duration_seconds=round(duration, 2),
            range_start=range_start,
            range_end=range_end,
            total_consulted=total_ids,
            inserted=inserted,
            updated=updated,
            ignored=ignored,
            failed=failed,
            failed_ids=failed_ids,
        )

        self._save_report(report)
        self._print_summary(report)

        return report

    def _save_report(self, report: LoadReport) -> None:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        json_path = self.report_dir / f"hn_report_{timestamp}.json"
        json_path.write_text(report.model_dump_json(indent=2), encoding="utf-8")

        txt_path = self.report_dir / f"hn_report_{timestamp}.txt"
        txt_path.write_text(self._format_summary(report), encoding="utf-8")

        logger.info(f"Report saved: {json_path}, {txt_path}")

    def _print_summary(self, report: LoadReport) -> None:
        print(self._format_summary(report))

    def _format_summary(self, report: LoadReport) -> str:
        return (
            f"\n{'=' * 60}\n"
            f"Hacker News Carga — Relatório\n"
            f"{'=' * 60}\n"
            f"Início:      {report.start_time}\n"
            f"Fim:          {report.end_time}\n"
            f"Duração:     {report.duration_seconds:.1f}s\n"
            f"Faixa:       {report.range_start} → {report.range_end}\n"
            f"{'─' * 60}\n"
            f"Consultados: {report.total_consulted}\n"
            f"Inseridos:   {report.inserted}\n"
            f"Atualizados: {report.updated}\n"
            f"Ignorados:   {report.ignored}\n"
            f"Falhas:      {report.failed}"
            + (f" (IDs: {', '.join(map(str, report.failed_ids))})" if report.failed_ids else "")
            + f"\n{'=' * 60}\n"
        )


async def run_load(
    limit: int | None = None,
    db_path: str | None = None,
    report_dir: str = "artifacts",
) -> LoadReport:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    client = HackerNewsClient()
    try:
        loader = HnLoader(client, report_dir=report_dir)
        return await loader.load(limit=limit)
    finally:
        await client.close()
