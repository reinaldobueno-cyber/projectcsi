# Checklist do que enviar para corrigir 100% (planilha + ClickUp)

Para fechar o diagnóstico sem tentativa e erro, envie estes itens:

## A) Prova do endpoint em produção

Abra no navegador (logado na conta do Apps Script) e copie o retorno bruto:

1. `SEU_WEBAPP_URL?mes=ALL&callback=cb`
2. `SEU_WEBAPP_URL?action=clickup&callback=cb`
3. `SEU_WEBAPP_URL?action=ping&callback=cb`
4. `SEU_WEBAPP_URL?action=clickup&nocache=1&debug=1&callback=cb`

> Envie print + texto retornado.
> **Atenção:** `SEU_WEBAPP_URL` é um placeholder. Você precisa trocar pelo link real.

### Onde achar `SEU_WEBAPP_URL` sem ser desenvolvedor?

Opção mais simples (sem inspecionar):
1. Abra o arquivo `index.html` do projeto.
2. Procure por `APPS_SCRIPT_URL`.
3. Copie a URL completa entre aspas.

Exemplo atual do projeto:
`https://script.google.com/macros/s/AKfycbwC0UygsOMUVp-U6IaBE9Z4WSOG9B13XnWRXk4jeZ3a626qOkOLRoJmrJnjY4q-S5cj/exec`

Exemplos prontos para colar no navegador (já com o link real):
1. `https://script.google.com/macros/s/AKfycbwC0UygsOMUVp-U6IaBE9Z4WSOG9B13XnWRXk4jeZ3a626qOkOLRoJmrJnjY4q-S5cj/exec?mes=ALL&callback=cb`
2. `https://script.google.com/macros/s/AKfycbwC0UygsOMUVp-U6IaBE9Z4WSOG9B13XnWRXk4jeZ3a626qOkOLRoJmrJnjY4q-S5cj/exec?action=clickup&callback=cb`
3. `https://script.google.com/macros/s/AKfycbwC0UygsOMUVp-U6IaBE9Z4WSOG9B13XnWRXk4jeZ3a626qOkOLRoJmrJnjY4q-S5cj/exec?action=ping&callback=cb`
4. `https://script.google.com/macros/s/AKfycbwC0UygsOMUVp-U6IaBE9Z4WSOG9B13XnWRXk4jeZ3a626qOkOLRoJmrJnjY4q-S5cj/exec?action=clickup&nocache=1&debug=1&callback=cb`

## B) Configuração atual do Apps Script

1. Print de **Project Settings > Script properties** (pode ocultar token).
2. Nome e horário da **última versão implantada** (Deploy > Manage deployments).
3. Confirmação de acesso do deploy: **Anyone**.

## C) Frontend (navegador)

No painel em produção, após clicar:
- **Atualizar**
- **Buscar dados do ClickUp**

Envie:
1. Print do **Console** (F12) com logs `[PMO]`.
2. Print da aba **Network** filtrando `script.google.com`.

## D) Problemas específicos informados

1. **Cache parado (10:00)**  
   - Envie print do topo com hora do cache e do toast exibido.
2. **“Nenhum dado retornado” no ClickUp**  
   - Envie o retorno direto do endpoint `action=clickup`.
3. **Todos os links abrindo na mesma lista**  
   - Envie 2 exemplos de clientes + link gerado no card + link correto esperado.

## E) Planilha base

Confirme se o Apps Script usa exatamente o mesmo ID da planilha:
- `1fqvDJ6Xh_POzWGyap9UH2rHulF-2wSe_G80m3rYnBIU`

Se puder, envie também os nomes das abas existentes (JAN...DEZ) e um print do cabeçalho de uma aba.

---

Com esses itens, dá para fechar a causa raiz e entregar correção final sem suposição.

## Interpretação rápida dos retornos

- Se `action=ping` retornar `cb({"projetos":[]})`, você está em uma **versão antiga** do Web App (o `ping` não existe nela).
- Se `action=clickup&nocache=1&debug=1` retornar igual a `action=clickup`, sua versão atual **não reconhece** `nocache/debug` (também indica deploy antigo).
- Nesse caso:
  1. Apps Script → Deploy → Manage deployments → Edit deployment;
  2. selecionar **New version**;
  3. confirmar e copiar a URL do deploy ativo;
  4. garantir que o `APPS_SCRIPT_URL` do `index.html` aponta para essa mesma URL.
