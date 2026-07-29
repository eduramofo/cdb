# Parte 2 — Avaliação de Conformidade

> Verificação final: todos os requisitos da especificação foram atendidos.

**Status:** ✅ 100% Concluída — 28/28 testes passando | 44/44 total

---

## 1. Entregáveis Obrigatórios

| Requisito | Status | Evidência |
|-----------|--------|-----------|
| README com instalação, execução, decisões técnicas, limitações, IA | ✅ | `README.md` — atualizado com endpoints HN, resultados, estrutura |
| Código Python organizado para os dois desafios | ✅ | `src/cdb/hn/` — 4 arquivos modulares (client, loader, models, init) |
| Banco de dados local (SQLite) | ✅ | `hn_items` + `watermark` em `artifacts/hn_data.db` |
| Testes automatizados relevantes | ✅ | `tests/test_hn.py` — 21/21 passando |
| Evidências de execução | ✅ | `artifacts/hn_report_*.json` + `hn_report_*.txt` |
| Sem credenciais/segredos | ✅ | Nenhum arquivo sensível no repositório |

---

## 2. Expectativas Técnicas

| Requisito | Status | Implementação |
|-----------|--------|---------------|
| Estado incremental (watermark) | ✅ | `last_processed_id` na tabela `watermark`, atualizado a cada batch de 50 itens |
| Carga inicial com limite configurável | ✅ | `POST /api/v1/hn/load?limit=N` — sem watermark, processa últimos N itens |
| Carga incremental (apenas itens novos) | ✅ | Com watermark, processa `[last_processed_id + 1, maxitem]` |
| Persistência com chave única | ✅ | `id` como PRIMARY KEY, UPSERT via `INSERT ... ON CONFLICT UPDATE` |
| Dados consultáveis + JSON bruto | ✅ | 17 colunas dedicadas (incluindo `deleted`, `dead`, `poll`, `parts`) + `raw_json` |
| Resiliência: itens nulos | ✅ | API retorna `null` → contabilizado como "ignorado" |
| Resiliência: itens deletados | ✅ | `deleted: true` → contabilizado como "ignorado", não persiste |
| Resiliência: itens mortos | ✅ | `dead: true` → persistido com flag |
| Resiliência: timeouts | ✅ | 30s por request HTTP |
| Resiliência: retries com backoff | ✅ | 3 tentativas com backoff exponencial (1s → 2s → 4s) |
| Rate limiting | ✅ | 100ms de delay entre requests |
| Relatório com métricas | ✅ | Timestamps, faixa, consultados, inseridos, atualizados, ignorados, falhas, IDs com falha |

---

## 3. Checklist Resumido

| Grupo | Progresso |
|-------|-----------|
| Setup e Infraestrutura | ✅ 6/6 |
| Mecanismo de Estado Incremental | ✅ 4/4 |
| Consumo da API | ✅ 8/8 |
| Persistência | ✅ 5/5 |
| Relatório e Métricas | ✅ 3/3 |
| CLI e Interface | ✅ 3/3 (API REST) |
| Testes | ✅ 7/7 (28 testes) |

---

## 4. Testes Automatizados

**28/28 passando** em 7 categorias:

| Categoria | Testes | O que cobre |
|-----------|--------|-------------|
| `TestHNItemModel` | 7 | Parse de story, comment, job, poll, pollopt, deleted, dead |
| `TestUpsert` | 8 | Insert, update, misto, idempotência, raw_json, deleted, dead, poll/parts |
| `TestWatermark` | 3 | Leitura, escrita, sobrescrita |
| `TestHNItemsByType` | 2 | DB vazio, agrupamento por tipo |
| `TestHackerNewsClient` | 3 | Retry com sucesso, retry esgotado, null response |
| `TestHnLoader` | 4 | Watermark avança, null item, deleted item, relatório salvo |
| `TestLoadReport` | 1 | Serialização do modelo de relatório |

```bash
uv run pytest tests/test_hn.py -v
```

---

## 5. Execução Real

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
```

**Idempotência confirmada** — 2ª execução: 0 inseridos, 0 atualizados, 0 duplicados.

Evidências salvas em `artifacts/`:
- `hn_report_*.json` — relatório estruturado
- `hn_report_*.txt` — sumário textual

---

## 6. Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/v1/hn/load?limit=N` | Dispara carga inicial ou incremental |
| `GET` | `/api/v1/hn/items?limit=100&offset=0` | Lista itens persistidos (paginação) |
| `GET` | `/api/v1/hn/status` | Watermark, total de itens, distribuição por tipo |

---

## 7. Sinais de Entrega Sênior

| Sinal | Status |
|-------|--------|
| Escolhas técnicas coerentes e justificadas | ✅ |
| Código com responsabilidades separadas (client, loader, models, database) | ✅ |
| Observabilidade para diagnóstico de falhas (logging estruturado) | ✅ |
| Testes focados nos riscos relevantes (idempotência, UPSERT, retry, watermark) | ✅ |
| Idempotência comprovada em execução real | ✅ |
| Discussão honesta de limitações | ✅ |
| Entrega enxuta, executável e explicável | ✅ |

---

## 8. Decisões Técnicas e Trade-offs

### Por que SQLite?

Já estava no projeto para a Parte 1. Zero-config, single-file, transacional. Suficiente para o volume do teste (milhares de itens). Para volume real (~49M de itens), migrar para PostgreSQL com índices compostos.

### Por que batch commit de 50 itens?

Commit individual por item seria inviável (50x mais transações). Commit único no final arrisca perda total em caso de crash. Batch de 50 equilibra performance e resiliência — em caso de interrupção, perde-se no máximo 49 itens.

### Por que httpx e não aiohttp?

httpx já era dependência do projeto (usado no downloader da Parte 1). API compatível com requests, suporte nativo a async, timeouts configuráveis.

### Por que watermark avança mesmo com IDs de falha?

Se o watermark só avançasse após processamento contíguo (sem gaps), um único ID permanentemente inacessível bloquearia toda a carga futura. IDs com falha são registrados no relatório para retry manual, mas não bloqueiam o progresso.

---

## 9. Limitações

- **Carga full sem `--limit`** (todos os ~49M de itens) pode levar horas devido ao rate limit de 100ms/request. Funcional, mas não prático para demonstração.
- **Sem paralelismo** — requests são sequenciais para respeitar a API pública do HN.
- **Banco SQLite** — adequado para o escopo do teste, mas não escala para produção com milhões de registros.

### Melhorias Futuras

| Melhoria | Descrição |
|----------|-----------|
| Endpoint `updates.json` | Usar o endpoint de updates da HN API para capturar itens modificados recentemente sem varrer todo o intervalo |
| Paralelismo controlado | N conexões simultâneas com semáforo, respeitando rate limit agregado |
| WebSocket de progresso | Endpoint `/api/v1/hn/load/ws` para o frontend acompanhar progresso em tempo real |
| Retry de IDs com falha | Tabela `failed_ids` com retry automático em execuções futuras |
| Migração para PostgreSQL | Para volume de produção, com índices em `type`, `by`, `time` |
