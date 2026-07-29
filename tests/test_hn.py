import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, Mock

import pytest

from cdb.db.database import (
    get_hn_connection,
    get_hn_item_count,
    get_hn_items,
    get_hn_items_by_type,
    get_watermark,
    init_db,
    set_watermark,
    upsert_hn_items,
)
from cdb.hn.client import HackerNewsClient
from cdb.hn.loader import HnLoader
from cdb.hn.models import HNItem, LoadReport

# ── Fixtures ────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def reset_hn_db():
    init_db()
    conn = get_hn_connection()
    conn.execute("DELETE FROM hn_items")
    conn.execute("DELETE FROM watermark")
    conn.commit()
    conn.close()
    yield


# ── Sample data ─────────────────────────────────────────────────────────

STORY = {
    "id": 37854000,
    "type": "story",
    "by": "testauthor",
    "time": 1753800000,
    "title": "Test Story",
    "url": "https://example.com",
    "text": "Story text",
    "score": 100,
    "descendants": 50,
    "kids": [37854001, 37854002],
}

COMMENT = {
    "id": 37854001,
    "type": "comment",
    "by": "commenter",
    "time": 1753800100,
    "parent": 37854000,
    "score": 5,
}

JOB = {
    "id": 37854002,
    "type": "job",
    "by": "hiring",
    "time": 1753800200,
    "title": "We are hiring",
    "text": "Join us!",
}

POLL = {
    "id": 37854003,
    "type": "poll",
    "by": "pollster",
    "time": 1753800300,
    "title": "A Poll",
    "score": 20,
    "descendants": 10,
    "kids": [37854004, 37854005],
    "parts": [37854004, 37854005],
}

POLLOPT = {
    "id": 37854004,
    "type": "pollopt",
    "by": "voter",
    "time": 1753800400,
    "text": "Option A",
    "score": 15,
    "poll": 37854003,
}

DELETED_ITEM = {
    "id": 99999999,
    "deleted": True,
}

DEAD_ITEM = {
    "id": 37854005,
    "type": "comment",
    "by": "spammer",
    "time": 1753800500,
    "text": "Buy cheap stuff",
    "dead": True,
    "parent": 37854003,
}


# ── Tests ───────────────────────────────────────────────────────────────


class TestHNItemModel:
    def test_parse_story(self):
        item = HNItem(**STORY)
        assert item.id == 37854000
        assert item.type == "story"
        assert item.by == "testauthor"
        assert item.title == "Test Story"
        assert item.url == "https://example.com"
        assert item.score == 100
        assert item.kids == [37854001, 37854002]

    def test_parse_comment(self):
        item = HNItem(**COMMENT)
        assert item.id == 37854001
        assert item.type == "comment"
        assert item.parent == 37854000
        assert item.title is None

    def test_parse_job(self):
        item = HNItem(**JOB)
        assert item.id == 37854002
        assert item.type == "job"
        assert item.url is None

    def test_parse_poll(self):
        item = HNItem(**POLL)
        assert item.id == 37854003
        assert item.type == "poll"
        assert item.kids == [37854004, 37854005]
        assert item.parts == [37854004, 37854005]

    def test_parse_pollopt(self):
        item = HNItem(**POLLOPT)
        assert item.id == 37854004
        assert item.type == "pollopt"
        assert item.poll == 37854003
        assert item.score == 15

    def test_parse_deleted_item(self):
        item = HNItem(**DELETED_ITEM)
        assert item.id == 99999999
        assert item.deleted is True
        assert item.type is None

    def test_parse_dead_item(self):
        item = HNItem(**DEAD_ITEM)
        assert item.id == 37854005
        assert item.dead is True
        assert item.type == "comment"


class TestUpsert:
    def test_insert_new_item(self):
        ins, upd = upsert_hn_items([STORY])
        assert ins == 1
        assert upd == 0
        assert get_hn_item_count() == 1

    def test_update_existing_item(self):
        upsert_hn_items([STORY])
        modified = dict(STORY, score=200, title="Updated Title")
        ins, upd = upsert_hn_items([modified])
        assert ins == 0
        assert upd == 1
        assert get_hn_item_count() == 1

        items = get_hn_items()
        assert items[0]["score"] == 200
        assert items[0]["title"] == "Updated Title"

    def test_insert_and_update_mixed(self):
        upsert_hn_items([STORY])
        items = [COMMENT, dict(STORY, score=999)]
        ins, upd = upsert_hn_items(items)
        assert ins == 1
        assert upd == 1
        assert get_hn_item_count() == 2

    def test_idempotency(self):
        """Running same data twice should not create duplicates."""
        items = [STORY, COMMENT, JOB]
        ins1, upd1 = upsert_hn_items(items)
        assert ins1 == 3

        ins2, upd2 = upsert_hn_items(items)
        assert ins2 == 0
        assert upd2 == 3
        assert get_hn_item_count() == 3

    def test_raw_json_preserved(self):
        upsert_hn_items([STORY])
        items = get_hn_items()
        raw = json.loads(items[0]["raw_json"])
        assert raw["id"] == STORY["id"]
        assert raw["title"] == STORY["title"]

    def test_deleted_item_stored_with_flag(self):
        upsert_hn_items([DELETED_ITEM])
        items = get_hn_items()
        assert len(items) == 1
        assert items[0]["id"] == 99999999
        assert items[0]["deleted"] == 1
        assert items[0]["type"] is None

    def test_dead_item_stored_with_flag(self):
        upsert_hn_items([DEAD_ITEM])
        items = get_hn_items()
        assert items[0]["dead"] == 1

    def test_poll_fields_stored(self):
        upsert_hn_items([POLL, POLLOPT])
        items = get_hn_items()
        assert len(items) == 2
        poll_item = next(i for i in items if i["id"] == 37854003)
        pollopt_item = next(i for i in items if i["id"] == 37854004)
        assert poll_item["parts"] is not None
        assert pollopt_item["poll"] == 37854003


class TestWatermark:
    def test_get_watermark_returns_none_when_not_set(self):
        assert get_watermark("last_processed_id") is None

    def test_set_and_get_watermark(self):
        set_watermark("last_processed_id", "1000")
        assert get_watermark("last_processed_id") == "1000"

    def test_overwrite_watermark(self):
        set_watermark("last_processed_id", "1000")
        set_watermark("last_processed_id", "2000")
        assert get_watermark("last_processed_id") == "2000"


class TestHNItemsByType:
    def test_empty_db(self):
        assert get_hn_items_by_type() == {}

    def test_grouped_by_type(self):
        upsert_hn_items([STORY, COMMENT, JOB, POLL])
        by_type = get_hn_items_by_type()
        assert by_type == {"story": 1, "comment": 1, "job": 1, "poll": 1}


class TestHackerNewsClient:
    @pytest.mark.asyncio
    async def test_retry_on_timeout_then_succeed(self):
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = STORY

        mock_httpx = AsyncMock()
        mock_httpx.get.side_effect = [
            __import__("httpx").TimeoutException("timeout"),
            __import__("httpx").TimeoutException("timeout"),
            mock_response,
        ]

        client = HackerNewsClient(timeout=30)
        client._client = mock_httpx

        item = await client.get_item(37854000)
        assert item == STORY
        assert mock_httpx.get.call_count == 3

    @pytest.mark.asyncio
    async def test_retry_exhausted_returns_none(self):
        mock_httpx = AsyncMock()
        mock_httpx.get.side_effect = __import__("httpx").TimeoutException("timeout")

        client = HackerNewsClient(timeout=30)
        client._client = mock_httpx

        item = await client.get_item(99999)
        assert item is None
        assert mock_httpx.get.call_count == 3

    @pytest.mark.asyncio
    async def test_null_response_returns_none(self):
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = None

        mock_httpx = AsyncMock()
        mock_httpx.get.return_value = mock_response

        client = HackerNewsClient(timeout=30)
        client._client = mock_httpx

        item = await client.get_item(99999)
        assert item is None


class TestHnLoader:
    @pytest.mark.asyncio
    async def test_loader_watermark_advances(self):
        set_watermark("last_processed_id", "1000")

        maxitem_response = Mock()
        maxitem_response.text = "1002"

        item_responses = [STORY, COMMENT]
        item_mocks = []
        for data in item_responses:
            m = Mock()
            m.status_code = 200
            m.json.return_value = data
            item_mocks.append(m)

        mock_httpx = AsyncMock()
        mock_httpx.get.side_effect = [maxitem_response] + item_mocks

        client = HackerNewsClient(timeout=30)
        client._client = mock_httpx

        loader = HnLoader(client)
        report = await loader.load(limit=2)

        assert report.range_start == 1001
        assert report.range_end == 1002
        assert report.inserted + report.updated > 0
        assert get_watermark("last_processed_id") == "1002"

    @pytest.mark.asyncio
    async def test_loader_handles_null_item(self):
        set_watermark("last_processed_id", "1000")

        maxitem_response = Mock()
        maxitem_response.text = "1001"

        null_response = Mock()
        null_response.status_code = 200
        null_response.json.return_value = None

        mock_httpx = AsyncMock()
        mock_httpx.get.side_effect = [maxitem_response, null_response]

        client = HackerNewsClient(timeout=30)
        client._client = mock_httpx

        loader = HnLoader(client)
        report = await loader.load(limit=1)

        assert report.ignored == 1
        assert report.inserted == 0

    @pytest.mark.asyncio
    async def test_loader_handles_deleted_item(self):
        set_watermark("last_processed_id", "1000")

        maxitem_response = Mock()
        maxitem_response.text = "1001"

        deleted_response = Mock()
        deleted_response.status_code = 200
        deleted_response.json.return_value = {"id": 1001, "deleted": True}

        mock_httpx = AsyncMock()
        mock_httpx.get.side_effect = [maxitem_response, deleted_response]

        client = HackerNewsClient(timeout=30)
        client._client = mock_httpx

        loader = HnLoader(client)
        report = await loader.load(limit=1)

        assert report.ignored == 1
        assert report.inserted == 0

    @pytest.mark.asyncio
    async def test_loader_saves_report(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            set_watermark("last_processed_id", "1000")

            maxitem_response = Mock()
            maxitem_response.text = "1001"

            story_response = Mock()
            story_response.status_code = 200
            story_response.json.return_value = STORY

            mock_httpx = AsyncMock()
            mock_httpx.get.side_effect = [maxitem_response, story_response]

            client = HackerNewsClient(timeout=30)
            client._client = mock_httpx

            loader = HnLoader(client, report_dir=tmpdir)
            await loader.load(limit=1)

            json_files = list(Path(tmpdir).glob("hn_report_*.json"))
            assert len(json_files) == 1
            data = json.loads(json_files[0].read_text())
            assert data["inserted"] >= 0


class TestLoadReport:
    def test_report_model_serialization(self):
        report = LoadReport(
            start_time="2026-07-29T12:00:00",
            end_time="2026-07-29T12:00:05",
            duration_seconds=5.0,
            range_start=1,
            range_end=100,
            total_consulted=100,
            inserted=80,
            updated=5,
            ignored=10,
            failed=5,
            failed_ids=[7, 13, 42, 77, 99],
        )

        data = report.model_dump()
        assert data["inserted"] == 80
        assert data["failed_ids"] == [7, 13, 42, 77, 99]
