# Teste Técnico Prático — Desenvolvedor Sênior de Automação e Integração

> Versão enxuta para avaliar autonomia técnica em Python, automação web e integrações incrementais com APIs.
>
> **Prazo:** 48 horas corridas (salvo combinação diferente com o recrutador)
> **Entrega:** Link de repositório Git ou arquivo compactado + apresentação na entrevista técnica

---

## 1. Visão Geral do Teste

Este teste avalia a capacidade de construir, explicar e sustentar uma solução prática em Python para dois cenários comuns da vaga:

| # | Cenário | Peso |
|---|---------|------|
| 1 | Automação web no **RPA Challenge** | 40% |
| 2 | Carga incremental com **API pública do Hacker News** | 40% |
| 3 | Engenharia e comunicação (README, arquitetura, testes, logs) | 20% |

A especificação é propositalmente objetiva. Espera-se que um candidato sênior tome decisões de arquitetura, selecione ferramentas adequadas e justifique trade-offs no README e na apresentação.

---

## 2. Entregáveis Obrigatórios

- [x] **README** — Instalação, execução, decisões técnicas, limitações e uso de IA (se houver)
- [x] **Código Python** organizado para os dois desafios (Parte 1 ✅ e Parte 2 ✅)
- [x] **Arquivo de dependências** ou configuração de ambiente (`pyproject.toml` com uv)
- [x] **Testes automatizados** relevantes → 44 testes (pytest): 16 RPA + 28 HN
- [x] **Evidências de execução** do RPA (screenshots, JSON em `artifacts/`) — Parte 1 ✅
- [x] **Evidências de execução** do HN (relatórios JSON/TXT em `artifacts/`) — Parte 2 ✅
- [x] **Não enviar:** credenciais, tokens, cookies, arquivos grandes desnecessários ou informações sensíveis

> Extra de apresentação: foi adicionado um mini-frontend em HTML/CSS/JS vanilla, não solicitado na especificação, para facilitar a avaliação pública pelo recrutador.

---

## 3. Parte 1 — Automação RPA com Python (Peso: 40%) ✅ CONCLUÍDA

### Descrição

Criar uma automação que acesse [https://rpachallenge.com/](https://rpachallenge.com/), obtenha a planilha do desafio e preencha todos os registros do formulário dinâmico com **100% de acurácia**, sem intervenção manual.

**Resultado:** 100% (70/70 campos), ~6 segundos, Playwright + Chromium headless.

> Checklist detalhado: [PARTE_1/README.md](./PARTE_1/README.md) | Testes: [PARTE_1/TESTES_AUTOMATIZADOS.md](./PARTE_1/TESTES_AUTOMATIZADOS.md) | Avaliação: [PARTE_1/AVALIACAO.md](./PARTE_1/AVALIACAO.md)

### Expectativas Técnicas

| Requisito | Descrição |
|-----------|-----------|
| Biblioteca | Interagir com a página como usuário, usando biblioteca Python apropriada (Selenium, Playwright, Robocorp, RPA Framework ou equivalente) |
| Seletores | Identificar campos por significado, label ou atributo estável; **não por posição visual ou coordenadas** |
| Sincronização | Usar mecanismo confiável de espera (explicit waits), logs e tratamento de falhas |
| Headless | Permitir execução headless e não headless, quando aplicável |
| Evidências | Capturar resultado final, tempo, acurácia e evidência visual ou JSON em `artifacts/` |
| Código | Legível, modular e simples de executar em máquina limpa |

### Checklist Resumido — RPA Challenge

Todos os itens estão detalhados e marcados em [PARTE_1/README.md](./PARTE_1/README.md). Resumo:

- [x] Setup e Infraestrutura (5/5)
- [x] Navegação e Extração (5/5)
- [x] Preenchimento do Formulário (12/12)
- [x] Sincronização e Resiliência (4/4)
- [x] Evidências e Resultado (3/3)
- [x] Validação e Testes (4/4)

Comprovação de testes: [PARTE_1/TESTES_AUTOMATIZADOS.md](./PARTE_1/TESTES_AUTOMATIZADOS.md) — 16/16 passando.

---

## 4. Parte 2 — Carga Incremental com API Hacker News (Peso: 40%) ✅ CONCLUÍDA

### Descrição

Implementar um processo incremental que consuma a API oficial do Hacker News, persista itens em base local e permita execuções repetidas sem duplicidade.

> Checklist detalhado: [PARTE_2/README.md](./PARTE_2/README.md) | Testes: [PARTE_2/TESTES_AUTOMATIZADOS.md](./PARTE_2/TESTES_AUTOMATIZADOS.md) | Avaliação: [PARTE_2/AVALIACAO.md](./PARTE_2/AVALIACAO.md)

**Base URL:** `https://hacker-news.firebaseio.com/v0/`

| Endpoint | Descrição |
|----------|-----------|
| `GET /maxitem.json` | Retorna o maior ID atual de item |
| `GET /item/{id}.json` | Retorna o item pelo ID |
| `GET /updates.json` | (Opcional) Retorna IDs de itens atualizados recentemente |

### Expectativas Técnicas

| Requisito | Descrição |
|-----------|-----------|
| Estado incremental | Manter `last_item_id` ou watermark equivalente entre execuções |
| Carga inicial | Permitir carga inicial com limite configurável (ex: últimos N itens) |
| Carga incremental | Execuções subsequentes consultam apenas intervalo novo |
| Persistência | SQLite ou banco local simples, com chave única por item |
| Dados | Salvar campos consultáveis + preservar JSON bruto |
| Resiliência | Tratar itens nulos, timeouts, retries limitados, backoff, falhas por ID |
| Relatório | Resumo com faixa processada, consultados, inseridos, atualizados, ignorados, falhas e duração |

### Checklist Detalhado — Carga Incremental Hacker News

#### Setup e Infraestrutura
- [x] Escolher e justificar banco de dados (SQLite recomendado)
- [x] Definir schema da tabela de itens:
  - [x] `id` (integer, primary key — ID do item no HN)
  - [x] `type` (text — job, story, comment, poll, pollopt)
  - [x] `by` (text — autor)
  - [x] `time` (integer — timestamp Unix)
  - [x] `title` (text, nullable)
  - [x] `url` (text, nullable)
  - [x] `text` (text, nullable)
  - [x] `score` (integer, nullable)
  - [x] `descendants` (integer, nullable)
  - [x] `parent` (integer, nullable)
  - [x] `kids` (text, nullable — JSON array de IDs)
  - [x] `raw_json` (text — JSON bruto completo)
  - [x] `fetched_at` (text — timestamp da coleta)
  - [x] `updated_at` (text — timestamp da última atualização)
- [x] Criar tabela auxiliar de estado (`watermark`):
  - [x] `key` (text, primary key — ex: `last_processed_id`)
  - [x] `value` (text)
- [x] Configurar logging estruturado (timestamp, nível, mensagem, ID do item em falha)
- [x] Criar diretório `artifacts/` para relatórios de execução

#### Mecanismo de Estado Incremental
- [x] Implementar leitura do watermark (`last_processed_id`) do banco
- [x] Implementar escrita do watermark após processamento bem-sucedido
- [x] Definir estratégia de atualização do watermark:
  - [x] Atualizar após cada batch (50 itens), com registro de IDs com falha para relatório
- [x] Na primeira execução (sem watermark), permitir carga inicial com query param `?limit=N`

#### Consumo da API
- [x] Obter `maxitem.json` para descobrir o maior ID disponível
- [x] Calcular intervalo a processar: `[last_processed_id + 1, maxitem]` ou limitado por `?limit=N`
- [x] Para cada ID no intervalo, fazer `GET /item/{id}.json`
- [x] Implementar retry com backoff exponencial (3 tentativas, 1s/2s/4s)
- [x] Tratar timeouts (timeout por request: 30s)
- [x] Tratar itens nulos (a API retorna `null` para IDs deletados ou inválidos)
- [x] Implementar rate limiting respeitoso (delay entre requests: 100ms)
- [x] Registrar falhas por ID para relatório (não abortar toda a execução)

#### Persistência
- [x] Implementar **UPSERT** (INSERT OR REPLACE / ON CONFLICT) usando `id` como chave única
- [x] Distinguir entre item novo (INSERT) e item atualizado (UPDATE) no relatório
- [x] Preservar o JSON bruto no campo `raw_json`
- [x] Extrair campos consultáveis para colunas dedicadas
- [x] Usar transações para consistência (batch de commits a cada 50 itens)

#### Relatório e Métricas
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

#### CLI e Interface
- [x] Implementar entrada via API REST:
  - [x] `POST /api/v1/hn/load?limit=N` — carga inicial/incremental
  - [x] `GET /api/v1/hn/items?limit=100&offset=0` — listar itens persistidos
  - [x] `GET /api/v1/hn/status` — status do watermark e estatísticas
- [x] README explica como executar via curl

#### Testes
- [x] Teste de idempotência: rodar 2x com mesmo intervalo, verificar 0 duplicados
- [x] Teste de UPSERT (insert + update)
- [x] Teste de parse de item da API (tipos: story, comment, job, poll)
- [x] Teste de tratamento de item nulo
- [x] Teste de retry e backoff (mock da API com falhas)
- [x] Teste de atualização do watermark
- [x] Teste de persistência do relatório

---

## 5. Critérios de Avaliação

### Matriz de Avaliação

| Dimensão | Peso | O que será observado |
|----------|------|----------------------|
| **Automação RPA** | 40% | Acurácia (100%), robustez de seletores, sincronização, evidências e manutenção |
| **Carga incremental/API** | 40% | Idempotência, estado, persistência, tratamento de falhas, métricas e testes |
| **Engenharia e comunicação** | 20% | Arquitetura, simplicidade, organização, README, logs, trade-offs e apresentação |

### Sinais Esperados em uma Entrega Sênior

- [x] Escolhas técnicas coerentes com o problema e bem justificadas no README
- [x] Código com responsabilidades separadas e fácil de evoluir (modular, baixo acoplamento)
- [x] Observabilidade suficiente para diagnosticar falhas (logs estruturados, relatórios)
- [x] Testes focados nos riscos relevantes, não apenas cobertura superficial
- [x] Discussão honesta de limitações, melhorias futuras e riscos assumidos
- [x] Entrega enxuta, executável, bem pensada e explicável

---

## 6. Checklist Final de Entrega (Geral)

### Antes de Enviar
- [x] `README.md` completo com instalação, execução, decisões técnicas, limitações
- [x] `pyproject.toml` funcional em máquina limpa (uv)
- [x] Código Python organizado (módulos separados para RPA ✅ e HN ✅)
- [x] Testes passando (pytest): `uv run pytest` → 44/44 passando (16 RPA + 28 HN)
- [x] Evidências em `artifacts/`:
  - [x] Screenshot/JSON do resultado do RPA Challenge
  - [x] Relatório JSON/TXT da carga incremental HN
  - [x] Evidências versionadas em `artifacts/proof_files/`
- [x] `.gitignore` configurado (excluir `__pycache__`, `.env`, `*.db`, `artifacts/*` exceto evidências)
- [x] Nenhum arquivo sensível (credenciais, tokens, cookies)
- [x] Código sem comentários de TODO soltos
- [x] Review final de cada arquivo (lint, formatação consistente)

### Durante a Apresentação
- [ ] Demonstrar execução do RPA (ao vivo ou evidência gravada)
- [ ] Demonstrar carga inicial + carga incremental (idempotência)
- [ ] Explicar decisões de arquitetura e trade-offs
- [ ] Apontar limitações conhecidas e possíveis melhorias
- [ ] Mencionar uso de IA/LLM (se aplicável): como foi usado, quais prompts, validação humana

---

## 7. Observações sobre Uso de LLMs / IA

> **Nota para o candidato:** Leia atentamente caso utilize ferramentas de IA (ChatGPT, Copilot, Claude, etc.) durante o teste.

- [x] **Declarar no README** → OpenCode (`deepseek-v4-pro` e `GPT-5.5 xhigh`) usado como assistente
- [x] Descrever quais partes foram auxiliadas por IA e quais foram feitas manualmente → boilerplate + debug de seletores
- [x] Validar criticamente todo código gerado por IA → testado com execução real
- [x] Decisões de arquitetura tomadas pelo candidato → Playwright vs Selenium, seletor CSS, estrutura modular
- [x] Código compreendido e explicável linha a linha

---

## 8. Registro de Execução (Preencher ao Finalizar)

> Preencher este bloco como parte da entrega e feedback do processo.

| Campo | Valor |
|-------|-------|
| **Data e hora de início** | 2026-07-29 11:52 |
| **Data e hora de entrega final** | 2026-07-29 16:16 |
| **Projeto público** | [https://cdb-ff94.onrender.com/](https://cdb-ff94.onrender.com/) |
| **Tempo total versionado (aproximado)** | ~4h24min |
| **Frontend de apresentação** | Incluído como extra não solicitado para facilitar a avaliação pública |
| **Parte 1 — RPA Challenge** | ✅ |
| — Biblioteca utilizada | Playwright 1.61.0 |
| — Acurácia obtida | 100% (70/70 campos) |
| — Tempo de execução | ~6 segundos (headless, evidências entre 5.65s e 6.59s) |
| — Executou headless? | Sim (padrão); headed via `?headed=true` |
| **Parte 2 — Carga Incremental HN** | ✅ |
| — Banco utilizado | SQLite (hn_items + watermark) |
| — Biblioteca HTTP | httpx (já existente no projeto) |
| — Evidências versionadas | 3 execuções em `artifacts/proof_files/` |
| — Total consultados / inseridos / ignorados / falhas | 19 / 18 / 1 / 0 |
| — Tempo de execução | 0.6s a 3.89s nas evidências versionadas |
| **Ferramentas de IA utilizadas** | |
| — Quais ferramentas | OpenCode (`deepseek-v4-pro` e `GPT-5.5 xhigh`) |
| — Sessão GPT-5.5 xhigh | [opncd.ai/share/1uiGSnkj](https://opncd.ai/share/1uiGSnkj) |
| — Quais partes do código | Boilerplate FastAPI, debug de seletores CSS, estruturação, módulo HN, frontend, Docker/deploy e documentação |
| **Limitações conhecidas** | Parte 1: nenhuma crítica. Parte 2: carga full sem `limit` leva horas (~49M itens) com rate limit de 100ms. Deploy gratuito pode hibernar e ter filesystem efêmero. |
| **Melhorias futuras** | Endpoint updates.json; paralelismo controlado; WebSocket para progresso; retry automático de IDs com falha |
