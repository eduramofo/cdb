# Parte 2 — Carga Incremental com API Hacker News (Peso: 40%)

> Implementar um processo incremental que consuma a API oficial do Hacker News, persista itens em base local e permita execuções repetidas sem duplicidade.

**Base URL:** `https://hacker-news.firebaseio.com/v0/`

**Status:** ✅ Concluída — 28/28 testes passando | 44/44 total

---

## Checklist Detalhado — Carga Incremental Hacker News

### Setup e Infraestrutura
- [x] Escolher e justificar banco de dados (SQLite recomendado)
- [x] Definir schema da tabela de itens:
  - [x] `id` (integer, primary key — ID do item no HN)
  - [x] `deleted` (integer — `true` se item foi deletado)
  - [x] `type` (text — job, story, comment, poll, pollopt)
  - [x] `by` (text — autor)
  - [x] `time` (integer — timestamp Unix)
  - [x] `title` (text, nullable)
  - [x] `url` (text, nullable)
  - [x] `text` (text, nullable)
  - [x] `dead` (integer — `true` se item está morto)
  - [x] `score` (integer, nullable)
  - [x] `descendants` (integer, nullable)
  - [x] `parent` (integer, nullable)
  - [x] `poll` (integer, nullable — ID do poll associado ao pollopt)
  - [x] `kids` (text, nullable — JSON array de IDs)
  - [x] `parts` (text, nullable — JSON array de pollopts)
  - [x] `raw_json` (text — JSON bruto completo)
  - [x] `fetched_at` (text — timestamp da coleta)
  - [x] `updated_at` (text — timestamp da última atualização)
- [x] Criar tabela auxiliar de estado (`watermark`):
  - [x] `key` (text, primary key — ex: `last_processed_id`)
  - [x] `value` (text)
- [x] Configurar logging estruturado (timestamp, nível, mensagem, ID do item em falha)
- [x] Criar diretório `artifacts/` para relatórios de execução

### Mecanismo de Estado Incremental
- [x] Implementar leitura do watermark (`last_processed_id`) do banco
- [x] Implementar escrita do watermark após processamento bem-sucedido
- [x] Definir estratégia de atualização do watermark:
  - [x] Atualizar após cada batch (50 itens), com registro de IDs com falha para relatório
- [x] Na primeira execução (sem watermark), permitir carga inicial com `--limit N`

### Consumo da API
- [x] Obter `maxitem.json` para descobrir o maior ID disponível
- [x] Calcular intervalo a processar: `[last_processed_id + 1, maxitem]` ou limitado por `--limit`
- [x] Para cada ID no intervalo, fazer `GET /item/{id}.json`
- [x] Implementar retry com backoff exponencial (3 tentativas, 1s/2s/4s)
- [x] Tratar timeouts (timeout por request: 30s)
- [x] Tratar itens nulos (API retorna `null` para IDs inexistentes)
- [x] Tratar itens deletados (`deleted: true` → ignorados, não persiste)
- [x] Tratar itens mortos (`dead: true` → persistidos com flag)
- [x] Implementar rate limiting respeitoso (delay entre requests: 100ms)
- [x] Registrar falhas por ID para relatório (não abortar toda a execução)

### Persistência
- [x] Implementar **UPSERT** (INSERT OR REPLACE / ON CONFLICT) usando `id` como chave única
- [x] Distinguir entre item novo (INSERT) e item atualizado (UPDATE) no relatório
- [x] Preservar o JSON bruto no campo `raw_json`
- [x] Extrair campos consultáveis para colunas dedicadas
- [x] Usar transações para consistência (batch de commits a cada 50 itens)

### Relatório e Métricas
- [x] Ao final de cada execução, gerar relatório com:
  - [x] Timestamp de início e fim
  - [x] Duração total
  - [x] Faixa processada (IDs de X a Y)
  - [x] Total consultados
  - [x] Inseridos (novos)
  - [x] Atualizados (já existentes, com dados novos)
  - [x] Ignorados (nulos/deletados)
  - [x] Falhas (com lista de IDs que falharam após retries)
- [x] Salvar relatório em `artifacts/` como JSON e sumário em texto
- [x] Exibir sumário no stdout ao final da execução

### CLI e Interface
- [x] Implementar entrada via API:
  - [x] `POST /api/v1/hn/load?limit=N` — carga inicial/incremental
  - [x] `GET /api/v1/hn/items?limit=100&offset=0` — listar itens persistidos
  - [x] `GET /api/v1/hn/status` — status do watermark e estatísticas

### Testes
- [x] Teste de idempotência: rodar 2x com mesmo intervalo, verificar 0 duplicados
- [x] Teste de UPSERT (insert + update)
- [x] Teste de parse de item da API (tipos: story, comment, job, poll)
- [x] Teste de tratamento de item nulo
- [x] Teste de retry e backoff (mock da API com falhas)
- [x] Teste de atualização do watermark
- [x] Teste de persistência do relatório

---

## Arquitetura — Parte 2

```
src/cdb/hn/
├── __init__.py
├── client.py         Cliente HTTP async para HN API (httpx)
├── loader.py         Lógica de carga incremental
└── models.py         Pydantic: HNItem, LoadReport

src/cdb/db/
├── database.py       Extensão: hn_items, watermark (já existe challenge_records)
```

### Schema — Tabela `hn_items`

```sql
CREATE TABLE IF NOT EXISTS hn_items (
    id          INTEGER PRIMARY KEY,
    deleted     INTEGER DEFAULT 0,
    type        TEXT,
    by          TEXT,
    time        INTEGER,
    title       TEXT,
    url         TEXT,
    text        TEXT,
    dead        INTEGER DEFAULT 0,
    score       INTEGER,
    descendants INTEGER,
    parent      INTEGER,
    poll        INTEGER,
    kids        TEXT,
    parts       TEXT,
    raw_json    TEXT NOT NULL,
    fetched_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);
```

### Schema — Tabela `watermark`

```sql
CREATE TABLE IF NOT EXISTS watermark (
    key   TEXT PRIMARY KEY,
    value TEXT
);
```

### Estratégia de Watermark

1. Na primeira execução, `last_processed_id` é `NULL`
2. Obtém-se `maxitem.json` da API
3. Se sem watermark, processa-se `maxitem - limit` até `maxitem`
4. Se com watermark, processa-se `last_processed_id + 1` até `maxitem`
5. Após cada batch (50 itens), atualiza-se o watermark
6. IDs com falha são registrados para relatório, mas não bloqueiam o avanço

### Estratégia de Resiliência

- **Retry**: 3 tentativas com backoff exponencial (1s → 2s → 4s)
- **Timeout**: 30s por request HTTP
- **Itens nulos**: Registrados como "ignorados" no relatório
- **Rate limit**: 100ms entre requests para respeitar a API pública

### Testes Implementados

| # | Teste | Arquivo |
|---|-------|---------|
| 1 | Parse de item: story, comment, job, poll, pollopt, deleted, dead | `test_hn.py::TestHNItemModel` (7) |
| 2 | UPSERT: insert, update, mixed, idempotency, raw_json, deleted, dead, poll/parts | `test_hn.py::TestUpsert` (8) |
| 3 | Watermark: get/set/overwrite | `test_hn.py::TestWatermark` (3) |
| 4 | Agrupamento por tipo | `test_hn.py::TestHNItemsByType` (2) |
| 5 | Retry e backoff (mock) | `test_hn.py::TestHackerNewsClient` (3) |
| 6 | Loader: watermark avança, null item, deleted item, relatório | `test_hn.py::TestHnLoader` (4) |
| 7 | Relatório serialização | `test_hn.py::TestLoadReport` (1) |

---

## Execução

```bash
# Carga inicial com 100 itens
curl -X POST "http://localhost:8000/api/v1/hn/load?limit=100"

# Carga incremental (apenas itens novos)
curl -X POST "http://localhost:8000/api/v1/hn/load"

# Status do watermark
curl http://localhost:8000/api/v1/hn/status

# Listar itens persistidos
curl "http://localhost:8000/api/v1/hn/items?limit=10"
```
