# Parte 1 — Automação RPA com Python (Peso: 40%)

> Criar uma automação que acesse [rpachallenge.com](https://rpachallenge.com/), obtenha a planilha do desafio e preencha todos os registros do formulário dinâmico com **100% de acurácia**, sem intervenção manual.

**Status:** ✅ Concluída — 100% de acurácia (70/70 campos)

---

## Checklist Detalhado — RPA Challenge

### Setup e Infraestrutura
- [x] Escolher e justificar a biblioteca de automação → **Playwright** (seletores por label, auto-wait, headless/headed toggle)
- [x] Configurar dependências → `pyproject.toml` com `uv`
- [x] Implementar toggle headless/headful → query param `?headed=true` no endpoint `/api/v1/rpa/run`
- [x] Criar diretório `artifacts/` para evidências de execução
- [x] Configurar logging estruturado (timestamp, nível, mensagem) para diagnóstico

### Navegação e Extração
- [x] Acessar `https://rpachallenge.com/` com timeout e retry → `page.goto()` com timeout padrão de 30s
- [x] Localizar e clicar no botão de **Start** → `page.get_by_role("button", name="Start")`
- [x] Download da planilha → `httpx` direto da URL `assets/downloadFiles/challenge.xlsx`
- [x] Ler e parsear os dados da planilha → `openpyxl` com filtro de linhas vazias (10 registros válidos)
- [x] Mapear colunas da planilha para campos do formulário por significado/label → `FIELD_MAP` com correspondência explícita

### Preenchimento do Formulário
- [x] Para cada registro, identificar dinamicamente os campos visíveis no formulário
- [x] Preencher cada campo com o valor correspondente:
  - [x] First Name
  - [x] Last Name
  - [x] Company Name
  - [x] Role in Company
  - [x] Address
  - [x] Email
  - [x] Phone Number
- [x] Garantir que o seletor funcione mesmo se a ordem visual dos campos mudar → `label:text-is("X") + input` (CSS adjacent sibling)
- [x] Submeter cada registro (clicar em Submit)
- [x] Aguardar confirmação ou próximo formulário antes de prosseguir

### Sincronização e Resiliência
- [x] Usar explicit waits → Playwright `fill()` aguarda elemento visível e interativo automaticamente
- [ ] Tratar timeouts com retry limitado → trata timeout com try/except mas sem retry por campo
- [x] Logar cada registro processado (número, status)
- [ ] Capturar e logar erros de preenchimento com screenshot do estado da tela → captura apenas screenshot final

### Evidências e Resultado
- [x] Capturar screenshot final com o resultado (tempo total, acurácia, mensagem de sucesso)
- [x] Salvar resultado em JSON com: `{ status, challenge_message, fields_correct, fields_total, accuracy_pct, duration_seconds, records_processed }`
- [x] Salvar evidências em `artifacts/` com nomes que incluam timestamp

### Validação e Testes
- [ ] Teste de mapeamento de colunas (planilha → campos do formulário)
- [ ] Teste de parse da planilha Excel
- [ ] Teste de resiliência dos seletores (mock ou stub do DOM)
- [x] Verificar que não há preenchimento manual, edição do DOM nem gravação frágil de passos → automação usa `fill()` nativo do Playwright

### Resultado da Execução Real

```
Status:            success
Acurácia:          100% (70/70 campos)
Registros:         10 processados
Tempo:             ~5 segundos (headless)
Mensagem:          "Your success rate is 100% (70 out of 70 fields)"
Evidências:        artifacts/rpa_result_*.png + artifacts/rpa_result_*.json
```

---

## Arquitetura — Parte 1

```
src/cdb/rpa/
├── downloader.py     Download via httpx + parse via openpyxl
├── browser.py        Setup Playwright Chromium (headless/headed)
└── filler.py         Preenchimento, resultado, evidências

src/cdb/db/
├── database.py       SQLite: challenge_records (init, insert, get_all, clear)
└── models.py         Pydantic: ChallengeRecord, RecordSummary
```

### Seletor Utilizado

```python
page.locator('label:text-is("First Name") + input')
```

O CSS adjacent sibling `+ input` seleciona o `<input>` imediatamente após o `<label>` com texto exato. Isso garante que o campo seja encontrado por **significado** (texto do label), não por posição visual ou ID dinâmico.

### Por que não `page.get_by_label()`?

O formulário Angular do RPA Challenge não usa atributo `for` nos `<label>`, e o `<input>` não está aninhado dentro do `<label>`. O `get_by_label()` do Playwright não consegue fazer a associação nesse caso específico.

---

## Limitações Conhecidas — Parte 1

| Limitação | Impacto | Possível Melhoria |
|-----------|---------|-------------------|
| Sem retry por campo individual | Se um campo falhar, o registro é marcado como erro | Adicionar retry com backoff no `_fill_form` |
| Screenshot apenas no final | Erros intermediários sem evidência visual | Capturar screenshot por registro com falha |
| Seletor depende de `<label>` irmão adjacente | Se o DOM mudar estrutura, o seletor quebra | Fallback via `ng-reflect-dictionary-value` |
| Sem testes automatizados | Sem cobertura formal do pipeline | Adicionar `pytest` com fixtures de DB e mocks do Playwright |
