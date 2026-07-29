# Parte 2 — Carga Incremental com API Hacker News (Peso: 40%)

> Implementar um processo incremental que consuma a API oficial do Hacker News, persista itens em base local e permita execuções repetidas sem duplicidade.

**Base URL:** `https://hacker-news.firebaseio.com/v0/`

**Status:** 🔜 Pendente

---

## Checklist Detalhado — Carga Incremental Hacker News

### Setup e Infraestrutura
- [ ] Escolher e justificar banco de dados (SQLite recomendado)
- [ ] Definir schema da tabela de itens:
  - [ ] `id` (integer, primary key — ID do item no HN)
  - [ ] `type` (text — job, story, comment, poll, pollopt)
  - [ ] `by` (text — autor)
  - [ ] `time` (integer — timestamp Unix)
  - [ ] `title` (text, nullable)
  - [ ] `url` (text, nullable)
  - [ ] `text` (text, nullable)
  - [ ] `score` (integer, nullable)
  - [ ] `descendants` (integer, nullable)
  - [ ] `parent` (integer, nullable)
  - [ ] `kids` (text, nullable — JSON array de IDs)
  - [ ] `raw_json` (text — JSON bruto completo)
  - [ ] `fetched_at` (text — timestamp da coleta)
  - [ ] `updated_at` (text — timestamp da última atualização)
- [ ] Criar tabela auxiliar de estado (`watermark`):
  - [ ] `key` (text, primary key — ex: `last_processed_id`)
  - [ ] `value` (text)
- [ ] Configurar logging estruturado (timestamp, nível, mensagem, ID do item em falha)
- [ ] Criar diretório `artifacts/` para relatórios de execução

### Mecanismo de Estado Incremental
- [ ] Implementar leitura do watermark (`last_processed_id`) do banco
- [ ] Implementar escrita do watermark após processamento bem-sucedido
- [ ] Definir estratégia de atualização do watermark:
  - [ ] Atualizar somente após processar com sucesso o maior ID contíguo (sem gaps)
  - [ ] Ou: atualizar após cada batch, com registro de IDs com falha para retry futuro
- [ ] Na primeira execução (sem watermark), permitir carga inicial com `--limit N`

### Consumo da API
- [ ] Obter `maxitem.json` para descobrir o maior ID disponível
- [ ] Calcular intervalo a processar: `[last_processed_id + 1, maxitem]` ou limitado por `--limit`
- [ ] Para cada ID no intervalo, fazer `GET /item/{id}.json`
- [ ] Implementar retry com backoff exponencial (ex: 3 tentativas, 1s/2s/4s)
- [ ] Tratar timeouts (definir timeout por request, ex: 30s)
- [ ] Tratar itens nulos (a API retorna `null` para IDs deletados ou inválidos)
- [ ] Implementar rate limiting respeitoso (delay entre requests, ex: 100ms)
- [ ] Registrar falhas por ID para relatório (não abortar toda a execução)

### Persistência
- [ ] Implementar **UPSERT** (INSERT OR REPLACE / ON CONFLICT) usando `id` como chave única
- [ ] Distinguir entre item novo (INSERT) e item atualizado (UPDATE) no relatório
- [ ] Preservar o JSON bruto no campo `raw_json`
- [ ] Extrair campos consultáveis para colunas dedicadas
- [ ] Usar transações para consistência (batch de commits, não um por item)

### Relatório e Métricas
- [ ] Ao final de cada execução, gerar relatório com:
  - [ ] Timestamp de início e fim
  - [ ] Duração total
  - [ ] Faixa processada (IDs de X a Y)
  - [ ] Total consultados
  - [ ] Inseridos (novos)
  - [ ] Atualizados (já existentes, com dados novos)
  - [ ] Ignorados (nulos/deletados)
  - [ ] Falhas (com lista de IDs que falharam após retries)
- [ ] Salvar relatório em `artifacts/` como JSON e sumário em texto
- [ ] Exibir sumário no stdout ao final da execução

### CLI e Interface
- [ ] Implementar entrada via CLI:
  - [ ] `--limit N` — carregar no máximo N itens (padrão: sem limite, buscar tudo)
  - [ ] `--db-path` — caminho para o SQLite (padrão: `hn_data.db`)
  - [ ] `--report-dir` — diretório de relatórios (padrão: `artifacts/`)
- [ ] Endpoint da API:
  - [ ] `POST /api/v1/hn/load?limit=N` — carga inicial/incremental
  - [ ] `GET /api/v1/hn/items` — listar itens persistidos
  - [ ] `GET /api/v1/hn/status` — status do watermark e estatísticas

### Testes
- [ ] Teste de idempotência: rodar 2x com mesmo intervalo, verificar 0 duplicados
- [ ] Teste de UPSERT (insert + update)
- [ ] Teste de parse de item da API (tipos: story, comment, job, poll)
- [ ] Teste de tratamento de item nulo
- [ ] Teste de retry e backoff (mock da API com falhas)
- [ ] Teste de atualização do watermark
- [ ] Teste de persistência do relatório

---

## Arquitetura Proposta — Parte 2

```
src/cdb/hn/
├── __init__.py
├── client.py         Cliente HTTP async para HN API (httpx)
├── loader.py         Lógica de carga incremental
└── models.py         Pydantic: HNItem, LoadReport

src/cdb/db/
├── database.py       Extensão: hn_items, watermark (já existe challenge_records)
```

### Schema Proposto — Tabela `hn_items`

```sql
CREATE TABLE IF NOT EXISTS hn_items (
    id          INTEGER PRIMARY KEY,
    type        TEXT,
    by          TEXT,
    time        INTEGER,
    title       TEXT,
    url         TEXT,
    text        TEXT,
    score       INTEGER,
    descendants INTEGER,
    parent      INTEGER,
    kids        TEXT,
    raw_json    TEXT NOT NULL,
    fetched_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);
```

### Schema Proposto — Tabela `watermark`

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
5. Após cada item processado com sucesso, atualiza-se o watermark
6. IDs com falha são registrados para relatório, mas não bloqueiam o avanço

### Estratégia de Resiliência

- **Retry**: 3 tentativas com backoff exponencial (1s → 2s → 4s)
- **Timeout**: 30s por request HTTP
- **Itens nulos**: Registrados como "ignorados" no relatório
- **Rate limit**: 100ms entre requests para respeitar a API pública
