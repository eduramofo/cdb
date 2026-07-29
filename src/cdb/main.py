from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from cdb.db.database import (
    clear_records,
    get_all_records,
    get_record_count,
    init_db,
    insert_records,
)
from cdb.rpa.downloader import download_spreadsheet, parse_spreadsheet
from cdb.rpa.filler import run_challenge


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    init_db()
    yield


app = FastAPI(
    title="CDB — Challenge Data Bridge",
    description="""
API de automação para o teste técnico prático de **Desenvolvedor Sênior de Automação e Integração**.

## Funcionalidades

- **RPA Challenge**: Download, parse e armazenamento da planilha oficial do [RPA Challenge](https://rpachallenge.com)
- **Carga Incremental Hacker News**: (em breve) Consumo da [Hacker News API](https://github.com/HackerNews/API) com persistência incremental

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


@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs")


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
    description="Remove todos os registros da tabela `challenge_records`. Útil para reexecutar o pipeline do zero.",
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
