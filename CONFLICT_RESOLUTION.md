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
- **Accept Both Changes** no bloco de constantes/timeout e funções de busca ClickUp.
- Depois revise manualmente para não duplicar função com mesmo nome.

## Quando no GitHub só aparece **Atualizar ramificação**

Se você está vendo apenas o botão **Atualizar ramificação**:

1. Clique em **Atualizar ramificação** primeiro (isso aplica um merge/rebase automático da `main` na sua branch).
2. Aguarde terminar e recarregue a página da PR.
3. Se o conflito continuar:
   - clique em **Resolve conflicts** (se estiver habilitado), ou
   - faça a resolução pelo terminal (passos acima) e dê `push` na mesma branch da PR.
4. Se **Resolve conflicts** não aparecer para você, normalmente é permissão do repositório. Nesse caso, peça para um maintainer executar os passos do terminal.

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
