# SETUP — Ambiente de Desenvolvimento

Guia passo a passo para rodar o projeto localmente em ambiente de desenvolvimento.

---

## Pré-requisitos

- **Python >= 3.10** (testado em 3.10.12 e 3.14)
- **Git**
- Gerenciador de pacotes: **`uv`** (recomendado) **ou `pip`** (sem uv)

Verifique a versão do Python:

```bash
python --version
```

---

## Opção A — Com `uv` (recomendado)

```bash
git clone https://github.com/eduramofo/cdb.git
cd cdb

uv sync
uv run playwright install chromium
```

Em Linux ou container, instale também as dependências do Chromium:

```bash
uv run playwright install --with-deps chromium
```

---

## Opção B — Sem `uv` (pip)

```bash
git clone https://github.com/eduramofo/cdb.git
cd cdb

# 1. Criar e ativar o ambiente virtual
python -m venv .venv
source .venv/bin/activate        # Linux/macOS
# .venv\Scripts\activate        # Windows

# 2. Instalar dependências e o projeto
python -m pip install -r requirements.txt
python -m pip install -e .

# 3. Baixar o navegador do Playwright
playwright install chromium
```

> **Importante:** sempre ative o venv (`source .venv/bin/activate`) antes de rodar
> qualquer comando. Sem isso, o pip instala fora do ambiente e os módulos não são encontrados.

---

## Executar a API

```bash
cdb
# ou
uvicorn cdb.main:app --reload
```

Acesse:

- **Dashboard:** http://localhost:8000
- **Swagger/OpenAPI:** http://localhost:8000/docs
- **Healthcheck:** http://localhost:8000/health

---

## Executar os testes

```bash
pytest -v
```

Esperado: **44 passed** (16 testes RPA + 28 testes HN).

> Os testes de RPA abrem o Chromium do Playwright. Se falhar com
> `Executable doesn't exist`, rode `playwright install chromium` antes.

---

## Qualidade de código

```bash
# Lint e imports
ruff check .

# Formatação
ruff format .
```

---

## Problemas comuns

| Erro | Solução |
|------|---------|
| `No module named 'cdb'` | Ative o venv e rode `python -m pip install -e .` |
| `Executable doesn't exist ... playwright` | Rode `playwright install chromium` |
| `async def functions are not natively supported` | Instale `pytest-asyncio` no venv: `python -m pip install pytest pytest-asyncio` |
| `Package 'cdb' requires a different Python` | Use Python >= 3.10 e recrie o venv |
