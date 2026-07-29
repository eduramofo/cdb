# CDB — Challenge Data Bridge

> Teste Técnico Prático — Desenvolvedor Sênior de Automação e Integração

API de automação construída com **FastAPI + Playwright + SQLite** para resolver dois cenários:

| Parte | Status | Descrição |
|-------|--------|-----------|
| 1 — RPA Challenge | ✅ Concluída (100%) | Automação web no [rpachallenge.com](https://rpachallenge.com) |
| 2 — Carga Incremental HN | ✅ Concluída (100%) | Consumo da [Hacker News API](https://github.com/HackerNews/API) com persistência incremental |

> **Documentação completa:** [docs/PARTE_1/](docs/PARTE_1/) e [docs/PARTE_2/](docs/PARTE_2/) — checklists, testes automatizados, avaliações finais.

> **Projeto público:** [https://cdb-ff94.onrender.com/](https://cdb-ff94.onrender.com/) — ambiente online para visualização pelo recrutador.

---

## Stack Tecnológica

| Ferramenta | Justificativa |
|-----------|---------------|
| **uv** | Gerenciador de pacotes e ambientes Python, rápido e reprodutível |
| **FastAPI** | API REST moderna, async nativo, Swagger automático |
| **Playwright** | Automação web com seletores por label/texto, auto-waits, headless/headed toggle |
| **httpx** | Cliente HTTP async para download da planilha e consumo da HN API |
| **openpyxl** | Leitura de `.xlsx` sem depender do Excel instalado |
| **SQLite** | Persistência local zero-config, ideal para o escopo do teste |
| **Uvicorn** | Servidor ASGI para execução da API FastAPI |
| **Pydantic** | Modelagem e serialização dos dados da API e relatórios |
| **HTML/CSS/JS vanilla** | Mini-frontend de apresentação servido pela própria API |
| **Docker / Docker Compose** | Empacotamento para deploy e execução local reproduzível |

---

## Como Executar

### Pré-requisitos

- Python >= 3.14
- [uv](https://docs.astral.sh/uv/)

### Setup

```bash
git clone https://github.com/eduramofo/cdb.git
cd cdb
uv sync
uv run playwright install chromium
```

> Em Linux ou container, use `uv run playwright install --with-deps chromium` para instalar também as dependências do Chromium.

### Iniciar API

```bash
uv run cdb
```

Acesse:

- **Dashboard:** [http://localhost:8000](http://localhost:8000)
- **Swagger/OpenAPI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Healthcheck:** [http://localhost:8000/health](http://localhost:8000/health)

### Executar com Docker Compose

```bash
docker compose up --build
```

O `docker-compose.yml` sobe o mesmo app em `http://localhost:8000`, com volume persistente para `/app/artifacts`. Em deploys como Render/Koyeb, o artefato principal é o `Dockerfile`; o Compose é voltado para execução local ou VPS.

### Executar Testes

```bash
uv run pytest -v
```

---

## Estrutura do Projeto

```
src/cdb/
├── __init__.py          # entry point (uvicorn)
├── main.py              # FastAPI app + endpoints
├── rpa/
│   ├── __init__.py
│   ├── downloader.py    # download + parse da planilha (httpx/openpyxl)
│   ├── browser.py       # setup do Playwright (headless/headed)
│   └── filler.py        # preenchimento do formulário dinâmico
├── hn/
│   ├── __init__.py
│   ├── client.py        # cliente HTTP async para HN API (httpx, retry, backoff)
│   ├── loader.py        # lógica de carga incremental (watermark, batch, relatório)
│   └── models.py        # Pydantic: HNItem, LoadReport
└── db/
    ├── __init__.py
    ├── database.py      # SQLite: challenge_records + hn_items + watermark
    └── models.py        # Pydantic schemas

tests/
├── test_rpa.py          # 16 testes (pytest): parse, mapeamento, seletor, retry
└── test_hn.py           # 28 testes (pytest): idempotência, UPSERT, retry, watermark

static/
├── index.html           # mini-frontend SPA servido em /
├── css/dashboard.css    # estilos do dashboard
└── js/                  # telas: dashboard, RPA, HN, artifacts e docs

docs/
├── TESTE.md                   # especificação original com progresso
├── TESTE.pdf                  # PDF original do teste
├── PARTE_1/
│   ├── README.md              # checklist RPA Challenge (100% concluído)
│   ├── TESTES_AUTOMATIZADOS.md # comprovação 16/16 testes
│   └── AVALIACAO.md           # avaliação de conformidade final
└── PARTE_2/
    ├── README.md              # checklist HN API
    ├── TESTES_AUTOMATIZADOS.md # comprovação 28/28 testes
    └── AVALIACAO.md           # avaliação de conformidade final

artifacts/
├── proof_files/        # evidências versionadas para avaliação
├── rpa_result_*.png    # screenshots gerados em runtime
├── rpa_result_*.json   # resultados estruturados gerados em runtime
├── hn_report_*.json    # relatórios HN gerados em runtime
└── hn_report_*.txt     # sumário textual gerado em runtime

Dockerfile              # imagem de produção para Render/Koyeb/etc.
docker-compose.yml      # execução local/VPS com volume para artifacts
```

---

## Frontend de Apresentação

O teste técnico não exigia frontend. Ainda assim, foi criado um mini-dashboard em **HTML/CSS/JS vanilla** para deixar a entrega mais apresentável para o recrutador e facilitar a demonstração dos fluxos sem depender apenas de `curl` ou Swagger.

O dashboard inclui:

- Visão geral de health, registros RPA, itens HN e testes.
- Tela RPA para download da planilha, execução do desafio e reset da base.
- Tela Hacker News para carga incremental, status e listagem paginada.
- Tela Artifacts com preview de PNG, JSON e TXT, incluindo `artifacts/proof_files/`.
- Tela Documentação com renderização dos arquivos Markdown do projeto.

Essa camada é apenas uma interface de apresentação. A API continua sendo o núcleo da solução e todos os fluxos principais também estão disponíveis via endpoints REST.

---

## Endpoints da API

### Health

```bash
GET /health
```

### RPA Challenge

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/v1/rpa/download-sheet` | Download e parse da planilha oficial |
| `POST` | `/api/v1/rpa/run` | Executa automação no navegador |
| `POST` | `/api/v1/rpa/run?headed=true` | Igual acima, com janela visível |
| `GET` | `/api/v1/rpa/records` | Lista registros persistidos |
| `POST` | `/api/v1/rpa/reset` | Limpa a base para reexecução |

### Fluxo Completo

```bash
# 1. Baixar a planilha do RPA Challenge
curl -X POST http://localhost:8000/api/v1/rpa/download-sheet

# 2. Executar a automação (headless)
curl -X POST http://localhost:8000/api/v1/rpa/run

# 3. Ver registros persistidos
curl http://localhost:8000/api/v1/rpa/records
```

### Hacker News

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/v1/hn/load?limit=N` | Carga inicial/incremental da HN API |
| `GET` | `/api/v1/hn/items?limit=100&offset=0` | Lista itens persistidos |
| `GET` | `/api/v1/hn/status` | Watermark, total e distribuição por tipo |

### Endpoints Auxiliares do Dashboard

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/v1/artifacts` | Lista evidências geradas e arquivos de `artifacts/proof_files/` |
| `GET` | `/api/v1/docs` | Lista a árvore de documentação exibida no frontend |
| `GET` | `/artifacts/...` | Serve arquivos de evidência para preview |
| `GET` | `/docs-files/...` | Serve arquivos da documentação |

### Fluxo HN

```bash
# 1. Carga inicial com limite de 100 itens
curl -X POST "http://localhost:8000/api/v1/hn/load?limit=100"

# 2. Carga incremental (apenas itens novos desde a última execução)
curl -X POST "http://localhost:8000/api/v1/hn/load"

# 3. Ver status e estatísticas
curl http://localhost:8000/api/v1/hn/status

# 4. Listar itens persistidos
curl "http://localhost:8000/api/v1/hn/items?limit=10"
```

---

## Resultados Obtidos — Parte 1 (RPA)

```
Status:            success
Acurácia:          100% (70/70 campos)
Registros:         10 processados
Tempo:             ~6 segundos (headless, evidências entre 5.65s e 6.59s)
Testes:            16/16 passando (uv run pytest)
Evidências:        artifacts/proof_files/rpa_result_*.png + *.json
```

> Documentação completa: [docs/PARTE_1/](docs/PARTE_1/) — checklist, testes, avaliação.

---

## Resultados Obtidos — Parte 2 (Hacker News)

```
Carga inicial:     Configurável via ?limit=N
Evidências:        3 execuções versionadas (19 consultados, 18 inseridos, 1 ignorado, 0 falhas)
Idempotência:      ✅ Confirmada por UPSERT + watermark incremental
Persistência:      SQLite (hn_items + watermark)
Resiliência:       Retry 3x c/ backoff (1s→2s→4s), timeout 30s, rate limit 100ms
Testes:            28/28 passando (uv run pytest)
Total:             44/44 passando (16 RPA + 28 HN)
Evidências:        artifacts/proof_files/hn_report_*.json + *.txt
```

> Documentação completa: [docs/PARTE_2/](docs/PARTE_2/) — checklist, testes, avaliação.

---

## Decisões Técnicas e Trade-offs

### Por que Playwright e não Selenium?

- **Seletores por label/texto nativos** → `label:text-is("X") + input` é resistente a reordenação visual
- **Auto-waits** → Playwright espera automaticamente elementos ficarem visíveis/interativos antes de agir
- **Menos dependências** → Não precisa de chromedriver/geckodriver externos

### Por que `label:text-is("X") + input` (CSS adjacent sibling)?

O formulário do RPA Challenge é Angular e os `<label>` não têm atributo `for`. O `page.get_by_label()` do Playwright não consegue associar label→input nesse caso. A estratégia de seleção usa **dupla abordagem com fallback automático**:

1. **Primário**: `label:text-is("X") + input` — CSS adjacent sibling, rápido e direto
2. **Fallback**: `rpa1-field[ng-reflect-dictionary-value="X"] input` — atributo estrutural do componente Angular, caso o DOM mude a relação label-input

Se nenhum dos dois encontrar o campo, o erro é tratado com retry (3 tentativas) e screenshot do estado da página.

### Por que API e não script CLI?

FastAPI oferece Swagger auto-gerado, o que demonstra profissionalismo na apresentação ao recrutador. A API também expõe o pipeline de forma modular: download, run, reset — cada etapa acionável separadamente.

### Por que incluir um frontend se não foi solicitado?

O frontend foi adicionado como camada opcional de apresentação. Ele não substitui a API nem altera os requisitos técnicos, mas deixa o projeto mais fácil de avaliar em uma URL pública: o recrutador consegue acionar fluxos, visualizar artifacts, abrir documentação e conferir o estado da aplicação sem preparar comandos manualmente.

### Por que SQLite para ambas as partes?

Zero-config, single-file, transacional. Suficiente para o volume do teste. O banco da Parte 1 (`challenge.db`) e o da Parte 2 (`hn_data.db`) são independentes, mantendo isolamento claro entre as duas soluções. Para volume real da HN (~49M itens), migrar para PostgreSQL com índices compostos.

### Por que batch commit de 50 itens (Parte 2)?

Commit individual por item seria inviável (Nx mais transações). Commit único no final arrisca perda total em caso de crash. Batch de 50 equilibra performance e resiliência — em caso de interrupção, perde-se no máximo 49 itens.

### Por que watermark avança mesmo com IDs de falha?

Se o watermark só avançasse após processamento contíguo (sem gaps), um único ID permanentemente inacessível bloquearia toda a carga futura. IDs com falha são registrados no relatório para retry manual, mas não bloqueiam o progresso.

---

## Limitações Conhecidas

- **Parte 1**: Nenhuma limitação crítica. O seletor tem fallback automático (`ng-reflect-dictionary-value`), retry com backoff (3 tentativas, 1s/2s/3s), screenshot por erro e 16 testes automatizados.
- **Parte 2**: Nenhuma limitação crítica. O loader usa batch commits (50 itens), upsert por `ON CONFLICT`, watermark atualizado a cada batch. A execução em modo full (sem `limit`) pode levar horas dado o volume de ~49M de itens na HN, mas é funcional.
- **Deploy público gratuito**: o ambiente Render pode hibernar e o filesystem de runtime é efêmero. As evidências versionadas em `artifacts/proof_files/` são copiadas para a imagem Docker; novos artifacts gerados em runtime podem se perder em novo deploy/restart.

---

## Deploy

O projeto está publicado para visualização em: [https://cdb-ff94.onrender.com/](https://cdb-ff94.onrender.com/).

O deploy público usa o `Dockerfile`, que instala dependências com `uv`, baixa o Chromium do Playwright e inicia a aplicação com `uvicorn` sem `reload`:

```bash
uvicorn cdb.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

Para rodar localmente com container:

```bash
docker compose up --build
```

O `docker-compose.yml` mantém `artifacts/` em um volume Docker nomeado. No Render/Koyeb, configure a porta interna `8000` e healthcheck em `/health`.

---

## Uso de IA Generativa

Este projeto utilizou **OpenCode** com os modelos `deepseek-v4-pro` e `GPT-5.5 xhigh` como assistente de desenvolvimento. A ferramenta auxiliou em:

- Estruturação inicial do projeto com uv, FastAPI e dependências
- Geração de boilerplate (endpoints FastAPI, schema SQLite)
- Debug do seletor CSS para campos do formulário Angular
- Refatoração e limpeza de código

Todas as decisões de arquitetura (Playwright vs Selenium, seletor CSS adjacent sibling, estrutura de módulos) foram tomadas pelo candidato e validadas por testes de execução real. Nenhum código foi aceito sem verificação funcional completa.

**Sessão OpenCode — Parte 1 + Kickoff do projeto:** [opncd.ai/share/9Km5LSLy](https://opncd.ai/share/9Km5LSLy)

**Sessão OpenCode — Parte 2 (Carga Incremental HN):** [opncd.ai/share/tP58VfpQ](https://opncd.ai/share/tP58VfpQ)

**Sessão OpenCode — Mini-Frontend Dashboard:** [opncd.ai/share/ztv77gHu](https://opncd.ai/share/ztv77gHu)

**Sessão OpenCode — Deploy Docker/Render e documentação (GPT-5.5 xhigh):** [opncd.ai/share/1uiGSnkj](https://opncd.ai/share/1uiGSnkj)

> O Mini-Frontend (SPA vanilla HTML/CSS/JS) foi desenvolvido em sessão adicional com OpenCode (deepseek-v4-pro): dashboard com 5 seções, renderizador markdown, auto-load HN, modais, toasts e melhorias de UX.

---

## Timeline

| Marco | Data |
|-------|------|
| Início do projeto | 29/07/2026 11:52 |
| Especificação e checklist adicionados | 29/07/2026 12:13 |
| Base FastAPI + download/parse RPA + SQLite | 29/07/2026 12:22 |
| Automação RPA 100% com Playwright | 29/07/2026 12:51 |
| Testes e documentação da Parte 1 concluídos | 29/07/2026 13:28 |
| Implementação da Parte 2 — HN API incremental | 29/07/2026 14:29 |
| Mini-frontend dashboard | 29/07/2026 15:01 |
| Melhorias frontend, documentação e testes finais | 29/07/2026 15:32 |
| Artifacts de prova adicionados | 29/07/2026 15:40 |
| Setup Docker/deploy | 29/07/2026 15:55 |
| URL pública e uso de IA atualizados | 29/07/2026 16:01 |
| Revisão final de consistência | 29/07/2026 16:16 |

> **Nota:** os horários foram extraídos do histórico Git (`git log`) e representam os principais marcos versionados do projeto.

---

## Licença

MIT
