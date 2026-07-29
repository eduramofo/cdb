# Parte 2 — Testes Automatizados (Comprovação)

> **Status:** 21/21 ✅ | **Execução:** `uv run pytest tests/test_hn.py` — 7.23s

---

## Sumário Executivo

A Parte 2 (Carga Incremental Hacker News) está **100% finalizada** com cobertura de testes para todas as camadas críticas: parse de itens da API, UPSERT, idempotência, watermark, retry/backoff e persistência de relatórios.

```
21 passed in 7.23s
```

---

## Lista de Testes por Categoria

### 1. Parse de Itens da API (4 testes) — `TestHNItemModel`

| # | Teste | O que comprova |
|---|-------|----------------|
| 1 | `test_parse_story` | Um item do tipo `story` é parseado com todos os campos: `id`, `type`, `by`, `title`, `url`, `score`, `descendants`, `kids`. O campo `kids` é preservado como lista de inteiros. |
| 2 | `test_parse_comment` | Um item do tipo `comment` é parseado corretamente. Campos ausentes em comments (ex: `title`, `url`) são `None`. O campo `parent` referencia o item pai. |
| 3 | `test_parse_job` | Um item do tipo `job` é parseado corretamente. Jobs não têm `url` (diferente de stories) e isso é refletido como `None`. |
| 4 | `test_parse_poll` | Um item do tipo `poll` é parseado com `kids` (opções do poll) e `descendants`. |

**Risco coberto:** Se a API do HN mudar a estrutura dos itens ou adicionar/remover campos, os testes de parse sinalizam a necessidade de atualização do modelo Pydantic.

---

### 2. UPSERT e Persistência (5 testes) — `TestUpsert`

| # | Teste | O que comprova |
|---|-------|----------------|
| 5 | `test_insert_new_item` | Um item novo é inserido: `inserted=1, updated=0`. Total no banco = 1. |
| 6 | `test_update_existing_item` | Um item existente com dados modificados (`score=200, title="Updated Title"`) é atualizado via UPSERT: `inserted=0, updated=1`. Total no banco permanece 1. Os valores novos (`score=200`) substituem os antigos. |
| 7 | `test_insert_and_update_mixed` | Uma chamada com 2 itens — um novo e um existente modificado — retorna `inserted=1, updated=1`. Total no banco = 2. |
| 8 | `test_idempotency` | **Teste chave.** Um lote de 3 itens é inserido uma vez (`inserted=3`). O mesmo lote é processado novamente: `inserted=0, updated=3` (atualiza os mesmos, sem duplicar). Total no banco = 3. |
| 9 | `test_raw_json_preserved` | O campo `raw_json` contém o JSON bruto completo do item original, incluindo campos que não têm coluna dedicada. |

**Risco coberto:** Duplicidade de dados — o requisito central de idempotência é validado pelo teste #8. A integridade do JSON bruto (exigida pela especificação) é validada pelo teste #9.

---

### 3. Watermark — Estado Incremental (3 testes) — `TestWatermark`

| # | Teste | O que comprova |
|---|-------|----------------|
| 10 | `test_get_watermark_returns_none_when_not_set` | Antes da primeira execução, `get_watermark("last_processed_id")` retorna `None`. |
| 11 | `test_set_and_get_watermark` | Após `set_watermark("last_processed_id", "1000")`, a leitura retorna `"1000"`. |
| 12 | `test_overwrite_watermark` | Escrita repetida sobrescreve o valor anterior (`1000 → 2000`). |

**Risco coberto:** O mecanismo de estado entre execuções funciona corretamente. Se o watermark não persistisse ou corrompesse, a carga incremental perderia o ponto de retomada.

---

### 4. Agrupamento por Tipo (2 testes) — `TestHNItemsByType`

| # | Teste | O que comprova |
|---|-------|----------------|
| 13 | `test_empty_db` | Com banco vazio, `get_hn_items_by_type()` retorna `{}`. |
| 14 | `test_grouped_by_type` | Após inserir story, comment, job e poll, a consulta retorna `{"story": 1, "comment": 1, "job": 1, "poll": 1}`. |

**Risco coberto:** O endpoint `/api/v1/hn/status` depende dessa query. Se a contagem por tipo falhar, as estatísticas exibidas no status estarão incorretas.

---

### 5. Retry e Backoff — Resiliência HTTP (3 testes) — `TestHackerNewsClient`

| # | Teste | O que comprova |
|---|-------|----------------|
| 15 | `test_retry_on_timeout_then_succeed` | **Mock da API com falhas.** O cliente recebe 2 `TimeoutException` seguidas e sucede na 3ª tentativa. `get_item()` retorna o item corretamente. Total de 3 chamadas HTTP. |
| 16 | `test_retry_exhausted_returns_none` | Após 3 `TimeoutException` consecutivas (esgotamento dos retries), `get_item()` retorna `None` sem lançar exceção. A execução não aborta. |
| 17 | `test_null_response_returns_none` | A API retorna `null` (item deletado/inválido). `get_item()` retorna `None`. O item é contabilizado como "ignorado" no relatório. |

**Risco coberto:** Falhas intermitentes de rede não abortam a carga. O backoff exponencial (1s → 2s → 4s) é testado implicitamente pela sequência de 3 tentativas. O tratamento de itens nulos (IDs deletados do HN) é coberto pelo teste #17.

---

### 6. Loader — Integração Completa (3 testes) — `TestHnLoader`

| # | Teste | O que comprova |
|---|-------|----------------|
| 18 | `test_loader_watermark_advances` | Simula watermark em `1000`, maxitem em `1002`, e 2 itens (STORY, COMMENT) disponíveis. Após `load(limit=2)`, o watermark avança para `1002`, o intervalo processado é `[1001, 1002]` e itens foram inseridos. |
| 19 | `test_loader_handles_null_item` | Simula watermark em `1000`, maxitem em `1001`, mas o item `1001` retorna `null`. O relatório mostra `ignored=1, inserted=0`. O watermark ainda avança (o ID foi processado). |
| 20 | `test_loader_saves_report` | Após `load(limit=1)` em diretório temporário, verifica que um arquivo `hn_report_*.json` foi criado e contém o campo `inserted`. |

**Risco coberto:** O fluxo completo (watermark → maxitem → fetch → upsert → watermark → relatório) é validado com mocks. O tratamento de itens nulos no contexto do loader (não apenas no client) é coberto pelo teste #19. A persistência do relatório em disco é coberta pelo teste #20.

---

### 7. Relatório — Serialização (1 teste) — `TestLoadReport`

| # | Teste | O que comprova |
|---|-------|----------------|
| 21 | `test_report_model_serialization` | O modelo `LoadReport` serializa corretamente via `.model_dump()`: `inserted=80`, `updated=5`, `ignored=10`, `failed=5`, `failed_ids=[7,13,42,77,99]`. |

**Risco coberto:** Se o schema do relatório mudar, a serialização JSON e o endpoint `/api/v1/hn/load` precisam ser atualizados. Este teste garante compatibilidade.

---

## Como Executar

```bash
# Executar todos os testes HN
uv run pytest tests/test_hn.py -v

# Executar apenas uma categoria
uv run pytest tests/test_hn.py::TestUpsert -v

# Executar a suite completa (RPA + HN)
uv run pytest -v
```

---

## Cobertura de Riscos

| Risco | Testes que cobrem |
|-------|-------------------|
| Item duplicado em execuções repetidas | #8 |
| UPSERT não distingue insert de update | #5, #6, #7 |
| JSON bruto não preservado | #9 |
| Watermark não persiste entre execuções | #10, #11, #12 |
| Timeout de rede aborta a carga | #15, #16 |
| Item nulo/deletado quebra o fluxo | #17, #19 |
| Watermark não avança após processamento | #18 |
| Relatório não é salvo em disco | #20 |
| Serialização do relatório quebra o endpoint | #21 |
| Parse de tipos diferentes de item falha | #1, #2, #3, #4 |
| Agrupamento por tipo retorna dados errados | #14 |

---

## Evidência de Execução Real

Além dos testes automatizados, a carga incremental foi executada contra a API real do Hacker News:

```
POST /api/v1/hn/load?limit=5
============================================================
Início:      2026-07-29T17:06:24
Fim:          2026-07-29T17:06:26
Duração:     1.7s
Faixa:       49100139 → 49100143
────────────────────────────────────────────────────────────
Consultados: 5
Inseridos:   5
Atualizados: 0
Ignorados:   0
Falhas:      0
============================================================

2ª execução (idempotência):
Inseridos:   0   (sem duplicados)
Atualizados: 0   (sem alterações)

Status final: 5 itens — {comment: 4, story: 1}
Evidências:   artifacts/hn_report_*.json + artifacts/hn_report_*.txt
```
