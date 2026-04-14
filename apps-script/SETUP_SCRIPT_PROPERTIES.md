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
   - Segurança: nunca compartilhe esse token em PR/chat público; se compartilhar, gere outro.
3. `WORKSPACE_ID`
   - Valor: `9007083069`
4. `CK_SPACES_JSON`
   - Valor (exemplo):
     `["90130063158","90130063112","90130063122","90130064659","90139026911","901310580274"]`

> Importante: em `CK_SPACES_JSON` use colchetes, aspas duplas e vírgulas exatamente como no exemplo.
> No código, essa propriedade aparece na linha: `_cfg('CK_SPACES_JSON', '[]')`.

### Onde fica isso na tela?

- No editor do Apps Script, menu esquerdo: **Project Settings** (ícone de engrenagem).
- Dentro dessa página, seção **Script properties**.
- Clique em **Add script property** para cada item.

### Esses IDs de exemplo servem para qualquer conta?

Não. O `CK_SPACES_JSON` precisa ter os **IDs reais dos seus Spaces** no ClickUp.
Se os IDs do exemplo não existirem na sua conta, o retorno do ClickUp ficará vazio.

Como obter os IDs rapidamente:
1. Abra um Space no ClickUp (navegador).
2. Copie a URL.
3. Procure o número grande que identifica o Space/lista (normalmente no caminho da URL).
4. Monte o JSON com seus IDs reais, por exemplo:
   `["9012...","9013..."]`

> Dica: se não tiver certeza dos IDs, use temporariamente 1 Space e teste `action=clickup`.
> Se funcionar, adicione os demais IDs aos poucos.

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
- Usar IDs de exemplo que não pertencem ao seu workspace.
- Deixar espaço extra no nome da chave (ex: `CK_TOKEN `).
- Editar e não criar **New version** no deploy.

### Se aparecer este erro no endpoint

- `{"erro":"SHEET_ID não configurado."}`
  - falta criar/preencher `SHEET_ID` em Script Properties (ou `QUICK_SHEET_ID` no modo rápido).
- `{"erro":"CK_TOKEN não configurado."}`
  - falta criar/preencher `CK_TOKEN` em Script Properties (ou `QUICK_CK_TOKEN` no modo rápido).

## 6) Passo final (GitHub PR)

Depois que o endpoint responder corretamente no navegador, aí sim abra/atualize a PR no GitHub.
Ordem recomendada:
1. Commit no código do painel (se houver mudanças no `index.html`).
2. Push da branch.
3. Abrir PR ou atualizar PR existente.

## Modo rápido (para testar agora)

Se estiver com pressa, no `Code.gs` você pode preencher temporariamente:
- `QUICK_SHEET_ID`
- `QUICK_CK_TOKEN`
- `QUICK_WORKSPACE_ID`
- `QUICK_CK_SPACES_JSON`

Esse modo evita depender de Script Properties no primeiro teste.
Depois que validar, migre para Script Properties e limpe os valores sensíveis do código.

### QUICK_CK_TOKEN ou CK_TOKEN?

- **Produção (certo):** use `CK_TOKEN` em **Script Properties**.
- **Teste rápido (temporário):** use `QUICK_CK_TOKEN` no `Code.gs`.

Prioridade no código:
1. Script Properties (`CK_TOKEN`)
2. Script Properties `QUICK_*` (compatibilidade)
3. Fallback QUICK no código (`QUICK_CK_TOKEN`)
