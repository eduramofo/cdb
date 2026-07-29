import asyncio
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://hacker-news.firebaseio.com/v0"
RETRY_COUNT = 3
RETRY_BACKOFF_BASE = 1.0
REQUEST_TIMEOUT = 30.0
RATE_LIMIT_DELAY = 0.1


class HackerNewsClient:
    def __init__(self, timeout: float = REQUEST_TIMEOUT) -> None:
        self._client: Optional[httpx.AsyncClient] = None
        self.timeout = timeout

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=httpx.Timeout(self.timeout))
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def get_max_item_id(self) -> int:
        client = await self._ensure_client()
        response = await client.get(f"{BASE_URL}/maxitem.json")
        return int(response.text.strip())

    async def get_item(self, item_id: int) -> Optional[dict]:
        client = await self._ensure_client()
        await asyncio.sleep(RATE_LIMIT_DELAY)
        try:
            data = await self._get_with_retry(
                f"{BASE_URL}/item/{item_id}.json"
            )
            return data if data is not None else None
        except Exception as e:
            logger.warning(f"Item {item_id}: failed after retries — {e}")
            return None

    async def _get_with_retry(self, url: str) -> Optional[dict]:
        last_exception: Optional[Exception] = None
        for attempt in range(RETRY_COUNT):
            try:
                client = await self._ensure_client()
                response = await client.get(url)
                if response.status_code == 200:
                    return response.json()
                logger.warning(
                    f"GET {url} returned {response.status_code} (attempt {attempt + 1}/{RETRY_COUNT})"
                )
                last_exception = Exception(f"HTTP {response.status_code}")
            except (httpx.TimeoutException, httpx.ConnectError) as e:
                logger.warning(
                    f"GET {url} failed (attempt {attempt + 1}/{RETRY_COUNT}): {e}"
                )
                last_exception = e

            if attempt < RETRY_COUNT - 1:
                delay = RETRY_BACKOFF_BASE * (2**attempt)
                logger.info(f"Retrying {url} in {delay:.1f}s...")
                await asyncio.sleep(delay)

        raise last_exception or Exception(f"Failed to fetch {url}")
