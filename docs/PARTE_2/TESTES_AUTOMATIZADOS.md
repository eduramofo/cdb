# Parte 2 — Testes Automatizados (Comprovação)

> **Status:** 28/28 ✅ | **Execução:** `uv run pytest tests/test_hn.py` — 7.41s

---

## Sumário Executivo

A Parte 2 (Carga Incremental Hacker News) está **100% finalizada** com cobertura de testes para todas as camadas críticas: parse de itens da API (incluindo `deleted`, `dead`, `poll`, `parts`), UPSERT, idempotência, watermark, retry/backoff e persistência de relatórios.

```
28 passed in 7.41s
```

---

## Lista de Testes por Categoria

### 1. Parse de Itens da API (7 testes) — `TestHNItemModel`

| # | Teste | O que comprova |
|---|-------|----------------|
| 1 | `test_parse_story` | Um item do tipo `story` é parseado com todos os campos: `id`, `type`, `by`, `title`, `url`, `score`, `descendants`, `kids`. |
| 2 | `test_parse_comment` | Um item do tipo `comment` é parseado corretamente. Campos ausentes em comments (ex: `title`, `url`) são `None`. |
| 3 | `test_parse_job` | Um item do tipo `job` é parseado corretamente. |
| 4 | `test_parse_poll` | Um item do tipo `poll` é parseado com `kids` e `parts`. |
| 5 | `test_parse_pollopt` | Um item do tipo `pollopt` é parseado com o campo `poll` referenciando o poll pai. |
| 6 | `test_parse_deleted_item` | Um item deletado (`{"id": X, "deleted": true}`) é parseado com `deleted=True` e demais campos `None`. |
| 7 | `test_parse_dead_item` | Um item morto (`dead: true`) é parseado com `dead=True`, preservando os demais campos. |

**Risco coberto:** Se a API do HN mudar a estrutura dos itens ou adicionar/remover campos, os testes de parse sinalizam a necessidade de atualização do modelo Pydantic.

---

### 2. UPSERT e Persistência (8 testes) — `TestUpsert`

| # | Teste | O que comprova |
|---|-------|----------------|
| 8 | `test_insert_new_item` | Um item novo é inserido: `inserted=1, updated=0`. |
| 9 | `test_update_existing_item` | Item existente modificado é atualizado via UPSERT: `inserted=0, updated=1`. |
| 10 | `test_insert_and_update_mixed` | Chamada com 1 novo + 1 existente → `inserted=1, updated=1`. |
| 11 | `test_idempotency` | **Teste chave.** Mesmo lote 2x: 1ª `inserted=3`, 2ª `inserted=0, updated=3`. Sem duplicados. |
| 12 | `test_raw_json_preserved` | `raw_json` contém o JSON bruto completo do item original. |
| 13 | `test_deleted_item_stored_with_flag` | Item deletado é persistido com `deleted=1`, demais campos nulos. |
| 14 | `test_dead_item_stored_with_flag` | Item morto é persistido com `dead=1`. |
| 15 | `test_poll_fields_stored` | Poll tem `parts` populado; pollopt tem `poll` referenciando o poll pai. |

**Risco coberto:** Duplicidade de dados — o requisito central de idempotência é validado pelo teste #11. A integridade do JSON bruto (exigida pela especificação) é validada pelo teste #12.

---

### 3. Watermark — Estado Incremental (3 testes) — `TestWatermark`

| # | Teste | O que comprova |
|---|-------|----------------|
| 16 | `test_get_watermark_returns_none_when_not_set` | Antes da primeira execução, `get_watermark("last_processed_id")` retorna `None`. |
| 17 | `test_set_and_get_watermark` | Após `set_watermark("last_processed_id", "1000")`, a leitura retorna `"1000"`. |
| 18 | `test_overwrite_watermark` | Escrita repetida sobrescreve o valor anterior (`1000 → 2000`). |

**Risco coberto:** O mecanismo de estado entre execuções funciona corretamente. Se o watermark não persistisse ou corrompesse, a carga incremental perderia o ponto de retomada.

---

### 4. Agrupamento por Tipo (2 testes) — `TestHNItemsByType`

| # | Teste | O que comprova |
|---|-------|----------------|
| 19 | `test_empty_db` | Com banco vazio, `get_hn_items_by_type()` retorna `{}`. |
| 20 | `test_grouped_by_type` | Após inserir story, comment, job e poll, a consulta retorna `{"story": 1, "comment": 1, "job": 1, "poll": 1}`. |

**Risco coberto:** O endpoint `/api/v1/hn/status` depende dessa query. Se a contagem por tipo falhar, as estatísticas exibidas no status estarão incorretas.

---

### 5. Retry e Backoff — Resiliência HTTP (3 testes) — `TestHackerNewsClient`

| # | Teste | O que comprova |
|---|-------|----------------|
| 21 | `test_retry_on_timeout_then_succeed` | **Mock da API com falhas.** O cliente recebe 2 `TimeoutException` seguidas e sucede na 3ª tentativa. `get_item()` retorna o item corretamente. Total de 3 chamadas HTTP. |
| 22 | `test_retry_exhausted_returns_none` | Após 3 `TimeoutException` consecutivas (esgotamento dos retries), `get_item()` retorna `None` sem lançar exceção. A execução não aborta. |
| 23 | `test_null_response_returns_none` | A API retorna `null` (item deletado/inválido). `get_item()` retorna `None`. O item é contabilizado como "ignorado" no relatório. |

**Risco coberto:** Falhas intermitentes de rede não abortam a carga. O backoff exponencial (1s → 2s → 4s) é testado implicitamente pela sequência de 3 tentativas. O tratamento de itens nulos (IDs deletados do HN) é coberto pelo teste #23.

---

### 6. Loader — Integração Completa (4 testes) — `TestHnLoader`

| # | Teste | O que comprova |
|---|-------|----------------|
| 24 | `test_loader_watermark_advances` | Simula watermark em 1000, maxitem 1002. Após `load(limit=2)`, watermark → 1002. |
| 25 | `test_loader_handles_null_item` | API retorna `null` → `ignored=1, inserted=0`. |
| 26 | `test_loader_handles_deleted_item` | API retorna `{"id": X, "deleted": true}` → `ignored=1, inserted=0`. |
| 27 | `test_loader_saves_report` | Relatório JSON salvo em disco após `load()`. |

**Risco coberto:** O fluxo completo (watermark → maxitem → fetch → upsert → watermark → relatório) é validado com mocks. O tratamento de itens nulos no contexto do loader (não apenas no client) é coberto pelo teste #25. A persistência do relatório em disco é coberta pelo teste #27.

---

### 7. Relatório — Serialização (1 teste) — `TestLoadReport`

| # | Teste | O que comprova |
|---|-------|----------------|
| 28 | `test_report_model_serialization` | O modelo `LoadReport` serializa corretamente via `.model_dump()`. |

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
| Item duplicado em execuções repetidas | #11 |
| UPSERT não distingue insert de update | #8, #9, #10 |
| JSON bruto não preservado | #12 |
| Watermark não persiste entre execuções | #16, #17, #18 |
| Timeout de rede aborta a carga | #21, #22 |
| Item nulo quebra o fluxo | #23, #25 |
| Item deletado (`deleted: true`) não é tratado corretamente | #6, #13, #26 |
| Item morto (`dead: true`) não é sinalizado | #7, #14 |
| Campos `poll`/`parts` não são persistidos | #15 |
| Watermark não avança após processamento | #24 |
| Relatório não é salvo em disco | #27 |
| Serialização do relatório quebra o endpoint | #28 |
| Parse de tipos diferentes de item falha | #1, #2, #3, #4, #5 |
| Agrupamento por tipo retorna dados errados | #20 |

---

## Evidência de Execução Real

Além dos testes automatizados, a carga incremental foi executada contra a API real do Hacker News:

```
Execuções reais versionadas em artifacts/proof_files/
============================================================
Faixas:      49101298 → 49101316
────────────────────────────────────────────────────────────
Consultados: 19
Inseridos:   18
Atualizados: 0
Ignorados:   1
Falhas:      0
Duração:     0.6s a 3.89s por execução
============================================================

Idempotência: validada por testes automatizados de UPSERT e pelo watermark incremental.
Evidências:   artifacts/proof_files/hn_report_*.json + artifacts/proof_files/hn_report_*.txt
```
