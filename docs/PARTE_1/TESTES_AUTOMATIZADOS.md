# Parte 1 — Testes Automatizados (Comprovação)

> **Status:** 16/16 ✅ | **Execução:** `uv run pytest` — 7.71s

---

## Sumário Executivo

A Parte 1 (RPA Challenge) está **100% finalizada** com cobertura de testes para todas as camadas críticas: mapeamento de colunas, parse de planilha, resiliência de seletores e lógica de retry.

```
16 passed in 7.71s
```

---

## Lista de Testes por Categoria

### 1. Mapeamento de Colunas (3 testes) — `TestFieldMapping`

| # | Teste | O que comprova |
|---|-------|----------------|
| 1 | `test_all_expected_columns_mapped` | O `FIELD_MAP` contém exatamente as 7 colunas esperadas da planilha do RPA Challenge (`First Name`, `Last Name`, `Company Name`, `Role in Company`, `Address`, `Email`, `Phone Number`). Nem mais, nem menos. |
| 2 | `test_label_matches_database_column` | Cada chave do `FIELD_MAP` (ex: `"First Name"`) corresponde corretamente a uma coluna do banco SQLite (ex: `first_name`). Garante que a tradução planilha → DB → formulário é consistente. |
| 3 | `test_map_is_order_independent` | O `FIELD_MAP` é um dicionário e a ordem das chaves não afeta a correspondência. O seletor busca por texto do label, não por índice. |

**Risco coberto:** Se a planilha do RPA Challenge mudar de colunas, os testes quebram e sinalizam a necessidade de atualização do `FIELD_MAP`.

---

### 2. Parse da Planilha (5 testes) — `TestParseSpreadsheet`

| # | Teste | O que comprova |
|---|-------|----------------|
| 4 | `test_parse_valid_spreadsheet` | Uma planilha `.xlsx` com 2 registros é parseada corretamente: 2 registros retornados, valores de `First Name`, `Email` e `Last Name` conferem. Testa o caminho feliz completo. |
| 5 | `test_parse_filters_empty_rows` | Linhas totalmente vazias (`None` em todas as células) e linhas com strings vazias são filtradas. Dos 3 registros na planilha de teste, apenas 1 é retornado. |
| 6 | `test_parse_skips_none_header_column` | Colunas com header `None` (colunas fantasmas do Excel) são ignoradas. A chave `"None"` não aparece em nenhum registro retornado. |
| 7 | `test_parse_empty_spreadsheet` | Planilha com apenas cabeçalho (sem dados) retorna lista vazia `[]`, sem erros. |
| 8 | `test_numbers_preserved_as_strings` | Números inteiros (ex: telefone `40716543298`) são convertidos para string. O openpyxl retorna `int` para células numéricas; o parser normaliza para `str`. |

**Risco coberto:** O bug original (989 linhas vazias da planilha oficial sendo parseadas como registros) é prevenido pelo teste #5. Colunas fantasmas com header `None` são prevenidas pelo teste #6.

---

### 3. Resiliência de Seletores (5 testes) — `TestSelectorResilience`

| # | Teste | O que comprova |
|---|-------|----------------|
| 9 | `test_selector_finds_correct_input` | A string CSS `label:text-is("First Name") + input` contém os componentes esperados: `label:text-is` (busca por texto) e `+ input` (irmão adjacente). |
| 10 | `test_all_fields_have_selectors` | Todos os 7 campos do `FIELD_MAP` geram um seletor CSS válido no formato `label:text-is("{label}") + input`. |
| 11 | `test_selector_works_regardless_of_dom_order` | **Integração com Playwright real.** Monta um DOM onde os campos estão em ordem arbitrária (`Address`, `First Name`, `Email`, `Last Name`, `Phone Number`, `Company Name`, `Role in Company`) — diferente da ordem natural da planilha. Preenche via `_fill_form` e verifica que todos os 7 campos receberam o valor correto, independentemente da posição no DOM. |
| 12 | `test_fallback_selector_ng_reflect` | **Integração com Playwright real.** Simula o DOM Angular com `<rpa1-field ng-reflect-dictionary-value="...">` onde o `<label>` NÃO é irmão adjacente direto do `<input>` (há um `<span>` entre eles). O fallback via `ng-reflect-dictionary-value` encontra o input corretamente. |
| 13 | `test_locator_raises_when_no_match` | **Integração com Playwright real.** Quando nenhum dos dois seletores (primário nem fallback) encontra o campo, `_locator_for_field` levanta exceção com a mensagem `"não encontrado"`. Garante que o sistema não silencia falhas de localização. |

**Risco coberto:** O principal requisito do teste — "o seletor deve funcionar mesmo com mudança na ordem visual dos campos" — é validado pelo teste #11 com Playwright real. O fallback estrutural Angular é validado pelo teste #12.

---

### 4. Lógica de Retry (3 testes) — `TestFillFieldWithRetry`

| # | Teste | O que comprova |
|---|-------|----------------|
| 14 | `test_fill_succeeds_first_attempt` | Com um mock de página que nunca falha, `_fill_field_with_retry` preenche o campo em exatamente 1 tentativa (`fill_count == 1`). |
| 15 | `test_fill_retries_on_failure` | Com um mock que falha nas 2 primeiras tentativas e sucede na 3ª, a função executa 3 tentativas no total e retorna com sucesso, sem lançar exceção. |
| 16 | `test_fill_raises_after_all_retries` | Com um mock que falha em TODAS as tentativas (`failures = _FILL_RETRIES + 1 = 4`), a função esgota as 3 tentativas configuradas e levanta a exceção original (`"Mock failure"`). |

**Risco coberto:** Timeouts ou falhas intermitentes de rede/Playwright não abortam o fluxo. Apenas após 3 falhas consecutivas (com backoff de 1s/2s/3s) o campo é marcado como erro.

---

## Como Executar

```bash
# Instalar dependências de desenvolvimento
uv sync

# Executar todos os testes
uv run pytest -v

# Executar apenas testes de uma categoria
uv run pytest tests/test_rpa.py::TestSelectorResilience -v
```

---

## Cobertura de Riscos

| Risco | Testes que cobrem |
|-------|-------------------|
| Planilha com linhas vazias (bug original) | #5, #6 |
| Colunas com header fantasma | #6 |
| Campos em ordem arbitrária no DOM | #11 |
| DOM Angular sem label adjacente | #12 |
| Falha silenciosa na localização de campo | #13 |
| Timeout/erro intermitente no preenchimento | #14, #15, #16 |
| Mapeamento incorreto planilha → DB → formulário | #1, #2, #3 |
| Números inteiros perdendo formatação | #8 |

---

## Evidência de Execução Real

Além dos testes automatizados, o RPA Challenge foi executado contra o site real com resultado **100% (70/70 campos)**:

```
Status:            success
Acurácia:          100% (70/70 campos)
Registros:         10 processados
Tempo:             ~5 segundos (headless)
Mensagem:          "Your success rate is 100% (70 out of 70 fields)"
Evidências:        artifacts/rpa_result_*.png + artifacts/rpa_result_*.json
```
