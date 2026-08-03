# SETUP — Rodar o Projeto (sem `uv`)

## 1. Pré-requisitos

- **Python >= 3.10**
- **Git**

## 2. Instalação

```bash
git clone https://github.com/eduramofo/cdb.git
cd cdb
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m pip install -e .
playwright install chromium
```

## 3. Rodar a API

```bash
cdb
```

Acesse http://localhost:8000 (ou `/docs` para o Swagger).

## 4. Testes e lint

```bash
pytest -v        # esperado: 44 passed
ruff check .
```

## Problemas comuns

| Erro | Solução |
|------|---------|
| `No module named 'cdb'` | `source .venv/bin/activate` e `python -m pip install -e .` |
| `Executable doesn't exist ... playwright` | `playwright install chromium` |
| `Package 'cdb' requires a different Python` | Use Python >= 3.10 e recrie o venv |
