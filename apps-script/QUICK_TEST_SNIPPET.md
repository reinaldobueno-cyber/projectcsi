# Bloco rápido para colar no `Code.gs` (teste imediato)

Cole este trecho no topo do arquivo, substituindo os valores:

```javascript
var QUICK_SHEET_ID = '1fqvDJ6Xh_POzWGyap9UH2rHulF-2wSe_G80m3rYnBIU';
var QUICK_CK_TOKEN = 'COLE_SEU_TOKEN_AQUI';
var QUICK_WORKSPACE_ID = '9007083069';
var QUICK_CK_SPACES_JSON = '["90130063158","90130063112","90130063122","90130064659","90139026911","901310580274"]';
```

> Segurança: não commitar token real no repositório.
> Cole o token apenas no Apps Script (Script Properties ou modo QUICK local) e depois remova.

## Depois de colar

1. Deploy > Manage deployments > Edit > **New version**.
2. Testar no navegador:
   - `.../exec?action=ping&callback=cb`
   - `.../exec?mes=ALL&callback=cb`
   - `.../exec?action=clickup&nocache=1&debug=1&callback=cb`

## Se já estava configurado e ainda falha

Provável causa: deploy não atualizado ou URL antiga no frontend.
Compare a URL ativa do deploy com o `APPS_SCRIPT_URL` do `index.html`.
