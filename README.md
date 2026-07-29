# CDB — Challenge Data Bridge

> Teste Técnico Prático — Desenvolvedor Sênior de Automação e Integração

API de automação construída com **FastAPI + Playwright + SQLite** para resolver dois cenários:

| Parte | Status | Descrição |
|-------|--------|-----------|
| 1 — RPA Challenge | ✅ Concluída (100%) | Automação web no [rpachallenge.com](https://rpachallenge.com) |
| 2 — Carga Incremental HN | 🔜 Pendente | Consumo da [Hacker News API](https://github.com/HackerNews/API) com persistência incremental |

> **Documentação completa:** [docs/PARTE_1/](docs/PARTE_1/) — checklist, testes automatizados, avaliação final.

---

## Stack Tecnológica

| Ferramenta | Justificativa |
|-----------|---------------|
| **uv** | Gerenciador de pacotes e ambientes Python, rápido e reprodutível |
| **FastAPI** | API REST moderna, async nativo, Swagger automático |
| **Playwright** | Automação web com seletores por label/texto, auto-waits, headless/headed toggle |
| **httpx** | Cliente HTTP async para download da planilha |
| **openpyxl** | Leitura de `.xlsx` sem depender do Excel instalado |
| **SQLite** | Persistência local zero-config, ideal para o escopo do teste |

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

### Iniciar API

```bash
uv run cdb
```

Acesse **http://localhost:8000** — redireciona para o Swagger UI.

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
└── db/
    ├── __init__.py
    ├── database.py      # SQLite: init, CRUD, reset
    └── models.py        # Pydantic schemas

tests/
└── test_rpa.py          # 16 testes (pytest): parse, mapeamento, seletor, retry

docs/
├── TESTE.md                   # especificação original com progresso
├── TESTE.pdf                  # PDF original do teste
├── PARTE_1/
│   ├── README.md              # checklist RPA Challenge (100% concluído)
│   ├── TESTES_AUTOMATIZADOS.md # comprovação 16/16 testes
│   └── AVALIACAO.md           # avaliação de conformidade final
└── PARTE_2/
    ├── README.md              # checklist HN API (pendente)
    └── AVALIACAO.md           # status pendente

artifacts/
├── rpa_result_*.png    # screenshots das execuções
└── rpa_result_*.json   # resultados estruturados
```

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

---

## Resultados Obtidos — Parte 1 (RPA)

```
Status:            success
Acurácia:          100% (70/70 campos)
Registros:         10 processados
Tempo:             ~5 segundos (headless)
Testes:            16/16 passando (uv run pytest)
Evidências:        artifacts/rpa_result_*.png + artifacts/rpa_result_*.json
```

> Documentação completa: [docs/PARTE_1/](docs/PARTE_1/) — checklist, testes, avaliação.

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

---

## Limitações Conhecidas

- **Parte 1**: Nenhuma limitação crítica. O seletor tem fallback automático (`ng-reflect-dictionary-value`), retry com backoff (3 tentativas, 1s/2s/3s), screenshot por erro e 16 testes automatizados.
- **Parte 2**: Ainda não implementada.

---

## Uso de IA Generativa

Este projeto utilizou **OpenCode** (modelo `deepseek-v4-pro`) como assistente de desenvolvimento. A ferramenta auxiliou em:

- Estruturação inicial do projeto com uv, FastAPI e dependências
- Geração de boilerplate (endpoints FastAPI, schema SQLite)
- Debug do seletor CSS para campos do formulário Angular
- Refatoração e limpeza de código

Todas as decisões de arquitetura (Playwright vs Selenium, seletor CSS adjacent sibling, estrutura de módulos) foram tomadas pelo candidato e validadas por testes de execução real. Nenhum código foi aceito sem verificação funcional completa.

**Sessão OpenCode — Parte 1 + Kickoff do projeto:** [opncd.ai/share/9Km5LSLy](https://opncd.ai/share/9Km5LSLy)

> A Parte 2 (Carga Incremental Hacker News) será desenvolvida em uma sessão separada.

---

## Licença

MIT
