#!/usr/bin/env bash
set -euo pipefail

# INSTALL.sh — executa os passos do INSTALL.txt de ponta a ponta (inclui testes).
# Rode dentro do repositório clonado (cdb):
#   bash INSTALL.sh

log() { printf "\n[INSTALL] %s\n" "$*"; }

log "Rodando verificação de pré-requisitos (check.sh)..."
if ! bash check.sh; then
    printf "\n[INSTALL] check.sh falhou. Corrija as pendências antes de prosseguir.\n" >&2
    exit 1
fi

log "Criando ambiente virtual .venv..."
python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate

log "Instalando dependências (requirements.txt)..."
python -m pip install -r requirements.txt

log "Instalando o pacote em modo editable..."
python -m pip install -e .

log "Instalando ferramentas de desenvolvimento (pytest, pytest-asyncio, ruff)..."
python -m pip install pytest pytest-asyncio ruff

log "Baixando o navegador do Playwright..."
playwright install chromium

log "Rodando os testes (esperado: 44 passed)..."
python -m pytest -v

log "Rodando o linter (ruff)..."
ruff check .

printf "\n========================================\n"
printf "Instalação concluída com sucesso!\n"
printf "Para subir a API, rode:  cdb\n"
printf "Acesse http://localhost:8000 (ou /docs).\n"
printf "========================================\n"
