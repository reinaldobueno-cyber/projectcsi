# Runbook final (para sair do loop e entregar)

Objetivo: parar fallback `Local: xx proj.` e fazer ClickUp retornar dados reais.

## 1) Validar se o Web App está público

No Apps Script:
- Deploy → Manage deployments → Edit deployment
- **Who has access:** `Anyone`
- Publish com **New version**

Teste em janela anônima:
- `SEU_WEBAPP_URL?action=ping&callback=cb`

Se abrir login/erro, o deploy não está público.
Se retornar sem `ok:true` e `version`, você ainda está em versão antiga.
Se retornar erro, confira se vem `version` no JSON; sem `version` normalmente é código antigo.

> Importante: a tela “Nova implantação” só vale após clicar em **Implantar**.
> E use sempre a URL do **App da Web /exec**, não a URL de **Biblioteca**.

## 2) Confirmar URL certa em produção

No painel publicado, teste com override de endpoint:

`https://reinaldobueno-cyber.github.io/projectcsi/?apps_script_url=SEU_WEBAPP_URL`

Isso evita esperar merge/deploy do site para testar o backend novo.

Exemplo pronto:
`https://reinaldobueno-cyber.github.io/projectcsi/?apps_script_url=https://script.google.com/macros/s/AKfycbwC0UygsOMUVp-U6IaBE9Z4WSOG9B13XnWRXk4jeZ3a626qOkOLRoJmrJnjY4q-S5cj/exec`

Para forçar backend sem cache no painel:
`https://reinaldobueno-cyber.github.io/projectcsi/?apps_script_url=SEU_WEBAPP_URL&force_nocache=1`

### Publico primeiro a ramificação?

- Para testar o backend **não precisa** publicar a ramificação do site primeiro (use `apps_script_url`).
- Para deixar definitivo para todos os usuários, aí sim publique/merge a ramificação com o `APPS_SCRIPT_URL` correto.

## 3) Forçar atualização sem cache

Abrir no navegador:
- `SEU_WEBAPP_URL?mes=ALL&nocache=1&debug=1&callback=cb`
- `SEU_WEBAPP_URL?action=clickup&nocache=1&debug=1&callback=cb`

## 4) Se aparecer “Nenhum dado retornado” no ClickUp

Prováveis causas:
1. `CK_SPACES_JSON` com IDs errados.
2. Token sem permissão.
3. Listas sem padrão de nome esperado.

Ação:
- testar com 1 único space válido no `CK_SPACES_JSON`,
- confirmar token novo ativo,
- publicar New version novamente.

## 5) Se aparecer “Local: xx proj.”

Significa que o frontend entrou em fallback local (endpoint indisponível/timeout).
No console do navegador, execute:

```js
localStorage.removeItem('multsoft_pmo_data');
localStorage.removeItem('multsoft_pmo_ts');
location.reload();
```

Depois clique em **Atualizar**.
