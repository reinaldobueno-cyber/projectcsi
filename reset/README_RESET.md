# Plano B (Reset total) — colocar para funcionar hoje

Se a integração atual travou, use este fluxo mínimo:

1. Criar novo projeto no Apps Script.
2. Colar `reset/Code_reset.gs` como único arquivo.
3. Definir Script Properties:
   - `SHEET_ID`
   - `CK_TOKEN`
   - `WORKSPACE_ID`
4. Deploy App da Web:
   - Executar como você
   - Quem pode acessar: **Qualquer pessoa**
5. Testar:
   - `.../exec?action=ping&callback=cb`
   - `.../exec?mes=ALL&callback=cb`
   - `.../exec?action=clickup&callback=cb`
6. Se os 3 funcionarem, usar no painel:
   - `https://reinaldobueno-cyber.github.io/projectcsi/?apps_script_url=SEU_WEBAPP_URL&force_nocache=1`

Esse plano ignora complexidades de spaces/listas por pasta e usa endpoint de tasks por team para reduzir risco de retorno vazio.
