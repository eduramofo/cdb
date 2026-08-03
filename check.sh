#!/usr/bin/env bash
set -u

# check.sh — valida pré-requisitos antes de seguir o INSTALL.txt
# Uso: bash check.sh   (ou ./check.sh após chmod +x)

PASS=0
FAIL=0

ok()   { printf "  [OK] %s\n" "$1"; PASS=$((PASS + 1)); }
fail() { printf " [FALTA] %s\n" "$1"; FAIL=$((FAIL + 1)); }

header() { printf "\n== %s ==\n" "$1"; }

header "Ferramentas básicas"
for cmd in git curl python3; do
    if command -v "$cmd" >/dev/null 2>&1; then
        ok "$cmd encontrado"
    else
        fail "$cmd não instalado (ex.: sudo apt install $cmd)"
    fi
done

header "Python >= 3.10"
if command -v python3 >/dev/null 2>&1; then
    version=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    if python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'; then
        ok "Python $version (>= 3.10)"
    else
        fail "Python $version é antigo — INSTALL.txt exige >= 3.10"
    fi
else
    fail "python3 ausente"
fi

header "Módulo venv"
if python3 -c 'import venv' >/dev/null 2>&1; then
    ok "venv disponível"
else
    fail "módulo venv ausente (ex.: sudo apt install python3-venv)"
fi

header "pip"
if python3 -m pip --version >/dev/null 2>&1; then
    ok "pip disponível"
else
    fail "pip ausente (ex.: sudo apt install python3-pip)"
fi

header "Acesso ao PyPI"
if curl -fsS --max-time 10 -o /dev/null https://pypi.org/simple/ >/dev/null 2>&1; then
    ok "conexão com pypi.org funcionando"
else
    fail "sem acesso ao pypi.org (proxy/offline?)"
fi

header "Espaço em disco (mín. 1 GB — navegador do Playwright)"
space_kb=$(df -Pk . | awk 'NR==2 {print $4}')
if [ "${space_kb:-0}" -ge 1048576 ]; then
    ok "espaço livre: $((space_kb / 1024)) MB"
else
    fail "espaço livre insuficiente: ${space_kb:-?} KB"
fi

header "Arquivos do projeto (rode dentro do repositório clonado)"
for f in INSTALL.txt requirements.txt pyproject.toml; do
    if [ -f "$f" ]; then
        ok "$f presente"
    else
        fail "$f ausente — rode dentro do diretório 'cdb'"
    fi
done

header "Resumo"
printf "\n%d verificações passaram, %d faltando.\n" "$PASS" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
    printf "\nCorrija as pendências antes de seguir o INSTALL.txt.\n"
    exit 1
fi
printf "\nTudo pronto para seguir o INSTALL.txt.\n"
exit 0
