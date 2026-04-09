# Como configurar o item 2 (Script Properties) no Google Apps Script

Se você já colou o `Code.gs`, falta só configurar as variáveis no projeto.

## 1) Abrir as propriedades do script

1. No editor do Apps Script, clique na engrenagem **Project Settings** (lado esquerdo).
2. Role até a seção **Script properties**.
3. Clique em **Add script property**.

## 2) Criar as 4 chaves obrigatórias

Crie exatamente estas chaves (name/value):

1. `SHEET_ID`
   - Valor: `1fqvDJ6Xh_POzWGyap9UH2rHulF-2wSe_G80m3rYnBIU`
2. `CK_TOKEN`
   - Valor: seu token do ClickUp (recomendado: gerar um token novo)
3. `WORKSPACE_ID`
   - Valor: `9007083069`
4. `CK_SPACES_JSON`
   - Valor (exemplo):
     `["90130063158","90130063112","90130063122","90130064659","90139026911","901310580274"]`

> Importante: em `CK_SPACES_JSON` use colchetes, aspas duplas e vírgulas exatamente como no exemplo.
> No código, essa propriedade aparece na linha: `_cfg('CK_SPACES_JSON', '[]')`.

## 3) Salvar

- Clique em **Save script properties**.

## 4) Testar se as propriedades foram lidas

Depois do deploy (nova versão), abra:

- `.../exec?mes=ALL&callback=cb`
- `.../exec?action=clickup&callback=cb`

> **Não é PR do GitHub.**  
> Esse item 4 é só abrir a URL do Web App no navegador para validar retorno.

Se faltar alguma propriedade, o retorno virá com erro tipo:
- `CK_TOKEN não configurado.`
- `WORKSPACE_ID não configurado.`
- `CK_SPACES_JSON vazio.`

## 5) Erros comuns

- Colar `CK_SPACES_JSON` sem aspas duplas.
- Colar `CK_SPACES_JSON` sem vírgulas entre os IDs (JSON inválido).
- Deixar espaço extra no nome da chave (ex: `CK_TOKEN `).
- Editar e não criar **New version** no deploy.

## 6) Passo final (GitHub PR)

Depois que o endpoint responder corretamente no navegador, aí sim abra/atualize a PR no GitHub.
Ordem recomendada:
1. Commit no código do painel (se houver mudanças no `index.html`).
2. Push da branch.
3. Abrir PR ou atualizar PR existente.
