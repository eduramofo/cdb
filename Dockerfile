FROM python:3.14-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PATH="/app/.venv/bin:$PATH"

COPY --from=ghcr.io/astral-sh/uv:0.9.3 /uv /uvx /usr/local/bin/

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock README.md ./

RUN uv sync --locked --no-dev --no-install-project \
    && uv run --no-sync playwright install --with-deps chromium

COPY src ./src
COPY static ./static
COPY docs ./docs
COPY artifacts/proof_files ./artifacts/proof_files

RUN uv sync --locked --no-dev \
    && groupadd --system app \
    && useradd --system --gid app --home /app --shell /usr/sbin/nologin app \
    && mkdir -p /app/artifacts /ms-playwright \
    && chown -R app:app /app/artifacts \
    && chmod -R a+rX /ms-playwright

USER app

EXPOSE 8000

CMD ["sh", "-c", "uvicorn cdb.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
