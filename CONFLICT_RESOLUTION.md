# Como resolver conflito desta PR (index.html)

Se o GitHub mostrou conflito em `index.html`, siga este passo a passo no terminal:

```bash
git fetch origin
git checkout codex/validate-clickup-data-integration-7tycie
# traga a base atual da main para sua branch

git merge origin/main
```

Se aparecer conflito em `index.html`:

1. Abra o arquivo e procure blocos com:
   - `<<<<<<< HEAD`
   - `=======`
   - `>>>>>>> origin/main`
2. Mantenha a versão final com estes pontos (as duas coisas precisam coexistir):
   - matching robusto de cliente ClickUp (`_ckAliases`, `_ckBuscarProjeto`, `_ckSalvarAliases`)
   - retry/timeout na planilha e no clickup (`tentar` em `loadAll` e `tentarCK` em `_ckBuscar`)
3. Remova os marcadores `<<<<<<<`, `=======`, `>>>>>>>`.

Depois finalize:

```bash
git add index.html
git commit -m "Resolve merge conflict with main in index.html"
git push origin codex/validate-clickup-data-integration-7tycie
```

## Dica rápida (VS Code)

No editor de conflito, use:
- **Accept Both Changes** apenas em blocos simples (ex.: constantes/variáveis) onde não cria duplicidade.
- Em blocos de função completa (`function ...`), prefira manter só uma versão para não quebrar o JS.

## Quando no GitHub só aparece **Atualizar ramificação**

Se você está vendo apenas o botão **Atualizar ramificação**:

1. Clique em **Atualizar ramificação** primeiro (isso aplica um merge/rebase automático da `main` na sua branch).
2. Aguarde terminar e recarregue a página da PR.
3. Se o conflito continuar:
   - clique em **Resolve conflicts** (se estiver habilitado), ou
   - faça a resolução pelo terminal (passos acima) e dê `push` na mesma branch da PR.
4. Se **Resolve conflicts** não aparecer para você, normalmente é permissão do repositório. Nesse caso, peça para um maintainer executar os passos do terminal.

### Qual opção clicar no conflito (Accept current/incoming/both)?

Para o caso da imagem (conflito iniciando na linha da função `tentarCK`):

- ✅ **Use `Accept current change`** (a versão da sua branch da PR).
- ❌ **Não use `Accept both changes`** nesse bloco, porque normalmente duplica a função e quebra o JavaScript.
- ⚠️ Use `Accept incoming change` somente se quiser descartar a lógica nova de retry/timeout da sua PR.

Depois de aceitar, confirme que existe **apenas uma** definição de `function tentarCK(attempt)` no arquivo.

## Checklist de validação

- Sem marcadores de conflito:
  ```bash
  rg -n "^<<<<<<<|^=======|^>>>>>>>" index.html
  ```
- JavaScript válido:
  ```bash
  python - <<'PY'
from pathlib import Path
text=Path('index.html').read_text()
start=text.find('<script>')+8
end=text.rfind('</script>')
Path('/tmp/pmo.js').write_text(text[start:end])
print('ok')
PY
  node --check /tmp/pmo.js
  ```

## Depois do merge: quando testar?

- **Teste imediatamente** (1 a 2 minutos após o merge) para validar se o branch já foi incorporado.
- Se houver pipeline/deploy automático, aguarde o tempo do ambiente:
  - Vercel/Netlify/GitHub Pages: normalmente **1 a 5 minutos**.
  - Deploy manual/interno: depende do processo (confirmar com quem publica).
- Faça um **hard refresh** no navegador (`Ctrl+F5`) para evitar cache local.
- Na tela, valide:
  1. botão **Atualizar** sem erro de timeout recorrente;
  2. aba ClickUp carregando dados;
  3. link **Abrir projeto no ClickUp** aparecendo quando houver `folderUrl`.

## Atualizar ramificação ou abrir nova PR?

Use esta regra simples:

- ✅ **Mesmo escopo / mesma branch da PR atual**: clique em **Atualizar ramificação**.
- ✅ **Mudança nova após conflito resolvido** (sem trocar objetivo): continue na **mesma PR**.
- 🔁 **Nova PR** só quando:
  - a branch original foi fechada/bloqueada;
  - você precisou recriar branch por permissão/política;
  - ou o escopo mudou bastante e merece revisão separada.

Na maioria dos casos desse projeto, o caminho mais rápido é **Atualizar ramificação** e manter a PR atual.

## Checklist de teste (3 minutos)

1. Abra o sistema e faça `Ctrl+F5`.
2. Clique em **Atualizar** e espere concluir.
3. Verifique no rodapé/alerta se não ficou em fallback local por timeout.
4. Abra a aba **ClickUp** e clique em **Buscar dados do ClickUp**.
5. No DevTools (F12):
   - **Console**: veja mensagens `[PMO]` para tentativa/timeout/erro.
   - **Network**: confirme requests para `script.google.com/macros/s/.../exec`.
6. Critérios de sucesso:
   - planilha atualiza sem toast de timeout final;
   - ClickUp retorna dados (sem “Nenhum dado retornado” ao final das tentativas);
   - links “Abrir projeto no ClickUp” aparecem em projetos com `folderUrl`.
