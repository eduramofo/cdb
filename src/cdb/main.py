from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles

from cdb.db.database import (
    clear_records,
    get_all_records,
    get_hn_item_count,
    get_hn_items,
    get_hn_items_by_type,
    get_record_count,
    get_watermark,
    init_db,
    insert_records,
)
from cdb.hn.loader import run_load
from cdb.rpa.downloader import download_spreadsheet, parse_spreadsheet
from cdb.rpa.filler import run_challenge

STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static"
DOCS_DIR = Path(__file__).resolve().parent.parent.parent / "docs"
ARTIFACTS_DIR = Path(__file__).resolve().parent.parent.parent / "artifacts"
ROOT_DIR = Path(__file__).resolve().parent.parent.parent


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    init_db()
    yield


app = FastAPI(
    title="CDB — Challenge Data Bridge",
    description="""
API de automação para o teste técnico prático de **Desenvolvedor Sênior de Automação e Integração**.

## Funcionalidades

- **RPA Challenge**: Download, parse e armazenamento da planilha oficial do
  [RPA Challenge](https://rpachallenge.com)
- **Carga Incremental Hacker News**: Consumo da
  [Hacker News API](https://github.com/HackerNews/API) com persistência incremental

## Execução

```bash
uv run cdb
```
""",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

if DOCS_DIR.exists():
    app.mount("/docs-files", StaticFiles(directory=str(DOCS_DIR), html=True), name="docs-files")

if ROOT_DIR.exists():
    app.mount(
        "/docs-files-root",
        StaticFiles(directory=str(ROOT_DIR), html=True),
        name="docs-files-root",
    )

if ARTIFACTS_DIR.exists():
    app.mount("/artifacts", StaticFiles(directory=str(ARTIFACTS_DIR), html=True), name="artifacts")


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}


# ── RPA Challenge ──────────────────────────────────────────────────────


@app.post(
    "/api/v1/rpa/download-sheet",
    summary="📥 Download e Parse da Planilha",
    description="""
Faz o download da planilha oficial do [RPA Challenge](https://rpachallenge.com/assets/downloadFiles/challenge.xlsx),
extrai os registros e persiste no banco SQLite local.

**Fluxo:**
1. Download do arquivo `.xlsx` via HTTP
2. Parse com openpyxl (colunas mapeadas por nome, não por posição)
3. Inserção dos registros na tabela `challenge_records`

**Retorno:** Total de registros encontrados, quantidade inserida e preview dos 3 primeiros.
""",
    tags=["RPA Challenge"],
)
async def download_sheet():
    filepath = await download_spreadsheet()
    records = parse_spreadsheet(filepath)
    inserted = insert_records(records)
    return {
        "total_downloaded": len(records),
        "inserted": inserted,
        "preview": records[:3],
    }


@app.get(
    "/api/v1/rpa/records",
    summary="📋 Listar Registros",
    description="Retorna todos os registros persistidos no banco local, ordenados por ID.",
    tags=["RPA Challenge"],
)
async def list_records():
    records = get_all_records()
    return {
        "total": len(records),
        "records": records,
    }


@app.post(
    "/api/v1/rpa/reset",
    summary="🔄 Resetar Base",
    description=(
        "Remove todos os registros da tabela `challenge_records`. "
        "Útil para reexecutar o pipeline do zero."
    ),
    tags=["RPA Challenge"],
)
async def reset_records():
    count_before = get_record_count()
    clear_records()
    return {
        "deleted": count_before,
        "message": f"{count_before} registros removidos. Base limpa.",
    }


@app.post(
    "/api/v1/rpa/run",
    summary="🤖 Executar Automação RPA",
    description="""
Abre o navegador (Playwright + Chromium), acessa o [RPA Challenge](https://rpachallenge.com)
e preenche o formulário dinâmico com os registros persistidos no banco.

**Fluxo:**
1. Lê todos os registros da tabela `challenge_records`
2. Abre navegador Chromium via Playwright
3. Acessa https://rpachallenge.com e clica em **Start**
4. Para cada registro, identifica campos por `label` e preenche
5. Clica **Submit** e aguarda o próximo formulário
6. Captura screenshot do resultado final
7. Salva evidências em `artifacts/`

**Parâmetros:**
- `headed` (query param, default `false`): abre janela visível do navegador para debug
""",
    tags=["RPA Challenge"],
)
async def rpa_run(headed: bool = False):
    result = await run_challenge(headed=headed)
    return result


# ── Hacker News ─────────────────────────────────────────────────────────


@app.post(
    "/api/v1/hn/load",
    summary="📰 Carga Incremental Hacker News",
    description="""
Dispara o processo de carga incremental da [Hacker News API](https://github.com/HackerNews/API).

Na primeira execução, carrega os últimos N itens (definido por `limit`).
Nas execuções seguintes, carrega apenas os itens novos desde a última execução (watermark).

**Parâmetros:**
- `limit` (query param, opcional): número máximo de itens a carregar.
""",
    tags=["Hacker News"],
)
async def hn_load(limit: int | None = Query(None, ge=1)):
    report = await run_load(limit=limit)
    return report.model_dump()


@app.get(
    "/api/v1/hn/items",
    summary="📋 Listar Itens HN",
    description="Retorna os itens persistidos do Hacker News, ordenados por ID decrescente.",
    tags=["Hacker News"],
)
async def hn_items(limit: int = Query(100, ge=1, le=1000), offset: int = Query(0, ge=0)):
    items = get_hn_items(limit=limit, offset=offset)
    return {
        "total": get_hn_item_count(),
        "limit": limit,
        "offset": offset,
        "items": items,
    }


@app.get(
    "/api/v1/hn/status",
    summary="📊 Status da Carga HN",
    description=(
        "Retorna o status atual da carga: watermark, total de itens e distribuição por tipo."
    ),
    tags=["Hacker News"],
)
async def hn_status():
    last_processed = get_watermark("last_processed_id")
    return {
        "last_processed_id": int(last_processed) if last_processed else None,
        "total_items": get_hn_item_count(),
        "items_by_type": get_hn_items_by_type(),
    }


# ── Artifacts ───────────────────────────────────────────────────────────


@app.get(
    "/api/v1/artifacts",
    summary="📁 Listar Artifacts",
    description=(
        "Lista recursivamente os arquivos de artifacts (JSON, PNG, TXT), "
        "incluindo proof_files, com metadados."
    ),
    tags=["Artifacts"],
)
async def list_artifacts():
    entries = []
    if ARTIFACTS_DIR.exists():
        files = [f for f in ARTIFACTS_DIR.rglob("*") if f.is_file()]
        for f in sorted(files, key=lambda x: x.stat().st_mtime, reverse=True):
            if f.is_file() and f.suffix.lower() in (".json", ".png", ".txt"):
                stat = f.stat()
                relative_path = f.relative_to(ARTIFACTS_DIR).as_posix()
                entries.append(
                    {
                        "name": f.name,
                        "relative_path": relative_path,
                        "path": f"artifacts/{relative_path}",
                        "size": stat.st_size,
                        "size_human": _human_size(stat.st_size),
                        "modified": stat.st_mtime,
                        "extension": f.suffix.lower(),
                    }
                )
    return {"total": len(entries), "files": entries}


def _human_size(size: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


# ── Docs ────────────────────────────────────────────────────────────────


@app.get(
    "/api/v1/docs",
    summary="📚 Listar Documentação",
    description="Retorna a árvore de arquivos de documentação disponíveis.",
    tags=["Documentação"],
)
async def list_docs():
    tree = _build_docs_tree(DOCS_DIR, "")
    readme_path = ROOT_DIR / "README.md"
    if readme_path.exists():
        with suppress(Exception):
            tree.insert(
                0,
                {
                    "name": "README.md",
                    "type": "file",
                    "path": "README.md",
                    "url": "/docs-files-root/README.md",
                },
            )
    return {"tree": tree}


def _build_docs_tree(base: Path, prefix: str) -> list[dict]:
    entries = []
    if not base.exists():
        return entries
    for p in sorted(base.iterdir(), key=lambda x: (not x.is_dir(), x.name)):
        rel = f"{prefix}/{p.name}" if prefix else p.name
        if p.name.startswith(".") or p.name.startswith("__"):
            continue
        if p.is_dir():
            children = _build_docs_tree(p, rel)
            if children:
                entries.append({"name": p.name, "type": "folder", "children": children})
        elif p.suffix in (".md", ".txt", ".pdf"):
            entries.append(
                {"name": p.name, "type": "file", "path": rel, "url": f"/docs-files/{rel}"}
            )
    return entries


if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
