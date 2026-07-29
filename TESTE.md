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
- [ ] **Código Python** organizado para os dois desafios (Parte 1 ✅ e Parte 2 🔜)
- [x] **Arquivo de dependências** ou configuração de ambiente (`pyproject.toml` com uv)
- [ ] **Testes automatizados** relevantes (principalmente para API, idempotência e mapeamentos críticos)
- [x] **Evidências de execução** do RPA (screenshots, JSON em `artifacts/`) — Parte 1 ✅
- [x] **Não enviar:** credenciais, tokens, cookies, arquivos grandes desnecessários ou informações sensíveis

---

## 3. Parte 1 — Automação RPA com Python (Peso: 40%) ✅ CONCLUÍDA

### Descrição

Criar uma automação que acesse [https://rpachallenge.com/](https://rpachallenge.com/), obtenha a planilha do desafio e preencha todos os registros do formulário dinâmico com **100% de acurácia**, sem intervenção manual.

**Resultado:** 100% (70/70 campos), ~5 segundos, Playwright + Chromium headless.

> Checklist detalhado: [TESTE_PARTE_1.md](./TESTE_PARTE_1.md)

### Expectativas Técnicas

| Requisito | Descrição |
|-----------|-----------|
| Biblioteca | Interagir com a página como usuário, usando biblioteca Python apropriada (Selenium, Playwright, Robocorp, RPA Framework ou equivalente) |
| Seletores | Identificar campos por significado, label ou atributo estável; **não por posição visual ou coordenadas** |
| Sincronização | Usar mecanismo confiável de espera (explicit waits), logs e tratamento de falhas |
| Headless | Permitir execução headless e não headless, quando aplicável |
| Evidências | Capturar resultado final, tempo, acurácia e evidência visual ou JSON em `artifacts/` |
| Código | Legível, modular e simples de executar em máquina limpa |

### Checklist Detalhado — RPA Challenge

#### Setup e Infraestrutura
- [ ] Escolher e justificar a biblioteca de automação (Playwright / Selenium / outra)
- [ ] Configurar `requirements.txt` ou equivalente com a dependência escolhida
- [ ] Implementar toggle headless/headful via variável de ambiente ou argumento CLI
- [ ] Criar diretório `artifacts/` para evidências de execução
- [ ] Configurar logging estruturado (timestamp, nível, mensagem) para diagnóstico

#### Navegação e Extração
- [ ] Acessar `https://rpachallenge.com/` com timeout e retry
- [ ] Localizar e clicar no botão de **Start** (ou equivalente) para iniciar o desafio
- [ ] Localizar e clicar no botão para **download da planilha** (Excel/.xlsx)
- [ ] Ler e parsear os dados da planilha (todas as linhas, todas as colunas esperadas)
- [ ] Mapear colunas da planilha para campos do formulário por significado/label (não por ordem)

#### Preenchimento do Formulário
- [ ] Para cada registro da planilha, identificar dinamicamente os campos visíveis no formulário
- [ ] Preencher cada campo com o valor correspondente:
  - [ ] First Name
  - [ ] Last Name
  - [ ] Company Name
  - [ ] Role in Company
  - [ ] Address
  - [ ] Email
  - [ ] Phone Number
- [ ] Garantir que o seletor funcione mesmo se a ordem visual dos campos mudar
- [ ] Submeter cada registro (clicar em Submit)
- [ ] Aguardar confirmação ou próximo formulário antes de prosseguir

#### Sincronização e Resiliência
- [ ] Usar explicit waits (nunca `time.sleep()` fixo como estratégia principal)
- [ ] Tratar timeouts com retry limitado
- [ ] Logar cada registro processado (número, status, tempo parcial)
- [ ] Capturar e logar erros de preenchimento com screenshot do estado da tela

#### Evidências e Resultado
- [ ] Capturar screenshot final com o resultado (tempo total, acurácia, mensagem de sucesso)
- [ ] Salvar resultado em JSON com: `{ status, accuracy, duration_seconds, records_processed, timestamp }`
- [ ] Salvar evidências em `artifacts/` com nomes que incluam timestamp

#### Validação e Testes
- [ ] Teste de mapeamento de colunas (planilha → campos do formulário)
- [ ] Teste de parse da planilha Excel
- [ ] Teste de resiliência dos seletores (mock ou stub do DOM)
- [ ] Verificar que não há preenchimento manual, edição do DOM nem gravação frágil de passos

---

## 4. Parte 2 — Carga Incremental com API Hacker News (Peso: 40%) 🔜 PENDENTE

### Descrição

Implementar um processo incremental que consuma a API oficial do Hacker News, persista itens em base local e permita execuções repetidas sem duplicidade.

> Checklist detalhado: [TESTE_PARTE_2.md](./TESTE_PARTE_2.md)

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

#### Mecanismo de Estado Incremental
- [ ] Implementar leitura do watermark (`last_processed_id`) do banco
- [ ] Implementar escrita do watermark após processamento bem-sucedido
- [ ] Definir estratégia de atualização do watermark:
  - [ ] Atualizar somente após processar com sucesso o maior ID contíguo (sem gaps)
  - [ ] Ou: atualizar após cada batch, com registro de IDs com falha para retry futuro
- [ ] Na primeira execução (sem watermark), permitir carga inicial com `--limit N`

#### Consumo da API
- [ ] Obter `maxitem.json` para descobrir o maior ID disponível
- [ ] Calcular intervalo a processar: `[last_processed_id + 1, maxitem]` ou limitado por `--limit`
- [ ] Para cada ID no intervalo, fazer `GET /item/{id}.json`
- [ ] Implementar retry com backoff exponencial (ex: 3 tentativas, 1s/2s/4s)
- [ ] Tratar timeouts (definir timeout por request, ex: 30s)
- [ ] Tratar itens nulos (a API retorna `null` para IDs deletados ou inválidos)
- [ ] Implementar rate limiting respeitoso (delay entre requests, ex: 100ms)
- [ ] Registrar falhas por ID para relatório (não abortar toda a execução)

#### Persistência
- [ ] Implementar **UPSERT** (INSERT OR REPLACE / ON CONFLICT) usando `id` como chave única
- [ ] Distinguir entre item novo (INSERT) e item atualizado (UPDATE) no relatório
- [ ] Preservar o JSON bruto no campo `raw_json`
- [ ] Extrair campos consultáveis para colunas dedicadas
- [ ] Usar transações para consistência (batch de commits, não um por item)

#### Relatório e Métricas
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

#### CLI e Interface
- [ ] Implementar entrada via CLI:
  - [ ] `--limit N` — carregar no máximo N itens (padrão: sem limite, buscar tudo)
  - [ ] `--db-path` — caminho para o SQLite (padrão: `hn_data.db`)
  - [ ] `--report-dir` — diretório de relatórios (padrão: `artifacts/`)
- [ ] README explica como executar:
  - [ ] Carga inicial: `python main.py --limit 100`
  - [ ] Carga incremental: `python main.py`
  - [ ] Visualizar relatório

#### Testes
- [ ] Teste de idempotência: rodar 2x com mesmo intervalo, verificar 0 duplicados
- [ ] Teste de UPSERT (insert + update)
- [ ] Teste de parse de item da API (tipos: story, comment, job, poll)
- [ ] Teste de tratamento de item nulo
- [ ] Teste de retry e backoff (mock da API com falhas)
- [ ] Teste de atualização do watermark
- [ ] Teste de persistência do relatório

---

## 5. Critérios de Avaliação

### Matriz de Avaliação

| Dimensão | Peso | O que será observado |
|----------|------|----------------------|
| **Automação RPA** | 40% | Acurácia (100%), robustez de seletores, sincronização, evidências e manutenção |
| **Carga incremental/API** | 40% | Idempotência, estado, persistência, tratamento de falhas, métricas e testes |
| **Engenharia e comunicação** | 20% | Arquitetura, simplicidade, organização, README, logs, trade-offs e apresentação |

### Sinais Esperados em uma Entrega Sênior

- [ ] Escolhas técnicas coerentes com o problema e bem justificadas no README
- [ ] Código com responsabilidades separadas e fácil de evoluir (modular, baixo acoplamento)
- [ ] Observabilidade suficiente para diagnosticar falhas (logs estruturados, relatórios)
- [ ] Testes focados nos riscos relevantes, não apenas cobertura superficial
- [ ] Discussão honesta de limitações, melhorias futuras e riscos assumidos
- [ ] Entrega enxuta, executável, bem pensada e explicável

---

## 6. Checklist Final de Entrega (Geral)

### Antes de Enviar
- [x] `README.md` completo com instalação, execução, decisões técnicas, limitações
- [x] `pyproject.toml` funcional em máquina limpa (uv)
- [x] Código Python organizado (módulos separados para RPA ✅ e HN 🔜)
- [ ] Testes passando (pytest ou unittest): `pytest` ou comando documentado
- [x] Evidências em `artifacts/`:
  - [x] Screenshot/JSON do resultado do RPA Challenge
  - [ ] Relatório JSON da carga incremental
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

- [x] **Declarar no README** → OpenCode (deepseek-v4-pro) usado como assistente
- [x] Descrever quais partes foram auxiliadas por IA e quais foram feitas manualmente → boilerplate + debug de seletores
- [x] Validar criticamente todo código gerado por IA → testado com execução real
- [x] Decisões de arquitetura tomadas pelo candidato → Playwright vs Selenium, seletor CSS, estrutura modular
- [x] Código compreendido e explicável linha a linha

---

## 8. Registro de Execução (Preencher ao Finalizar)

> Preencher este bloco como parte da entrega e feedback do processo.

| Campo | Valor |
|-------|-------|
| **Data e hora de início** | 2026-07-29 12:00 |
| **Data e hora de entrega** | Em andamento |
| **Tempo total gasto (aproximado)** | ~3h |
| **Parte 1 — RPA Challenge** | ✅ |
| — Biblioteca utilizada | Playwright 1.61.0 |
| — Acurácia obtida | 100% (70/70 campos) |
| — Tempo de execução | ~5 segundos (headless) |
| — Executou headless? | Sim (padrão); headed via `?headed=true` |
| **Parte 2 — Carga Incremental HN** | 🔜 |
| — Banco utilizado | SQLite (proposto) |
| — Itens processados (carga inicial) | — |
| — Itens processados (incremento) | — |
| — Total inseridos / atualizados / falhas | — |
| **Ferramentas de IA utilizadas** | |
| — Quais ferramentas | OpenCode (deepseek-v4-pro) |
| — Quais partes do código | Boilerplate FastAPI, debug de seletores CSS, estruturação de arquivos |
| **Limitações conhecidas** | Sem retry por campo individual, sem testes automatizados, sem Parte 2 |
| **Melhorias futuras** | Adicionar pytest, retry com backoff, fallback de seletores, implementar Parte 2 |
