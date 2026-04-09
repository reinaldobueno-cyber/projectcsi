// ============================================================
// RESET BACKEND (MÍNIMO FUNCIONAL) - Apps Script
// Objetivo: sair do loop e colocar o painel no ar rapidamente.
// ============================================================

var RESET_VERSION = 'reset-v1';
var RESET_TASK_PAGES = 2; // páginas do endpoint team/task

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'sheets';
  var cb = (e && e.parameter && e.parameter.callback) || '';
  var out;
  try {
    if (action === 'ping') out = _ping();
    else if (action === 'clickup') out = _clickupRecent();
    else out = _sheetsAll();
  } catch (err) {
    out = { erro: String(err && err.message ? err.message : err), version: RESET_VERSION, action: action };
  }

  var json = JSON.stringify(out);
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function _cfg(name) {
  return PropertiesService.getScriptProperties().getProperty(name) || '';
}

function _ping() {
  return {
    ok: true,
    version: RESET_VERSION,
    hasSheetId: !!_cfg('SHEET_ID'),
    hasToken: !!_cfg('CK_TOKEN'),
    hasWorkspaceId: !!_cfg('WORKSPACE_ID')
  };
}

function _sheetsAll() {
  var id = _cfg('SHEET_ID');
  if (!id) throw new Error('SHEET_ID não configurado');
  var ss = SpreadsheetApp.openById(id);
  var out = [];

  ss.getSheets().forEach(function(sh) {
    var vals = sh.getDataRange().getValues();
    if (vals.length < 2) return;

    var hdrRow = 0;
    for (var i=0; i<Math.min(5, vals.length); i++) {
      var rowTxt = vals[i].map(function(x){ return String(x||'').toUpperCase(); }).join('|');
      if (rowTxt.indexOf('CLIENTE') >= 0) { hdrRow = i; break; }
    }
    var hdrs = vals[hdrRow].map(function(h){ return String(h||'').trim().toUpperCase(); });
    function idx(names){
      for (var n=0;n<names.length;n++){ var k=hdrs.indexOf(names[n]); if(k>=0) return k; }
      return -1;
    }
    var iCliente = idx(['CLIENTE','CLIENTE / FAZENDA','NOME CLIENTE']);
    var iCons    = idx(['CONSULTOR','CONSULTOR(A)']);
    var iStatus  = idx(['STATUS']);
    var iVend    = idx(['VENDEDOR']);
    var iClick   = idx(['PROJETO CLICKUP','CLICKUP']);
    var iIni     = idx(['DATA IN/INICIO IMPLANT','DATA INICIO','DATA INICIO IMPLANT']);
    var iObs     = idx(['OBS','OBSERVA','OBSERVAÇÃO','OBSERVACAO']);
    if (iCliente < 0) return;

    for (var r=hdrRow+1; r<vals.length; r++) {
      var row = vals[r];
      var cliente = String(row[iCliente] || '').trim();
      if (!cliente) continue;
      out.push({
        mes: sh.getName(),
        cliente: cliente,
        consultor: iCons>=0?String(row[iCons]||'').trim():'',
        status: iStatus>=0?String(row[iStatus]||'').trim():'',
        vendedor: iVend>=0?String(row[iVend]||'').trim():'',
        clickup: iClick>=0?String(row[iClick]||'').trim():'',
        data_inicio: iIni>=0?String(row[iIni]||'').trim():'',
        obs: iObs>=0?String(row[iObs]||'').trim():''
      });
    }
  });

  return { projetos: out, meta: { version: RESET_VERSION, total: out.length } };
}

function _clickupRecent() {
  var token = _cfg('CK_TOKEN');
  var team = _cfg('WORKSPACE_ID');
  if (!token) throw new Error('CK_TOKEN não configurado');
  if (!team) throw new Error('WORKSPACE_ID não configurado');

  var hdrs = { Authorization: token };

  // Modo 1 (preferencial): spaces/folders de projetos -> cliente = nome da pasta
  var projetos = _clickupByProjectFolders(team, hdrs);
  if (projetos.length) {
    return { clickup: projetos, meta: { version: RESET_VERSION, total: projetos.length, fonte: 'folders' } };
  }

  // Modo 2 (fallback): team/task agregado por lista
  var tasks = [];
  for (var p=0; p<RESET_TASK_PAGES; p++) {
    var resp = UrlFetchApp.fetch(
      'https://api.clickup.com/api/v2/team/' + team + '/task?include_closed=true&page=' + p + '&order_by=updated&reverse=true',
      { headers: hdrs, muteHttpExceptions: true }
    );
    var arr = JSON.parse(resp.getContentText() || '{}').tasks || [];
    if (!arr.length) break;
    tasks = tasks.concat(arr);
  }
  var byList = {};
  tasks.forEach(function(t){
    var listId = t.list && t.list.id ? String(t.list.id) : '';
    if (!listId) return;
    if (!byList[listId]) byList[listId] = { cliente:(t.folder&&t.folder.name)||(t.list&&t.list.name)||'Sem nome', listId:listId, folderUrl:'https://app.clickup.com/'+team+'/v/li/'+listId, lastUpdate:0, consultor:null, fases:[], done:0 };
    var upd = parseInt(t.date_updated || t.date_created || '0',10);
    if (upd > byList[listId].lastUpdate) { byList[listId].lastUpdate = upd; byList[listId].consultor = (t.assignees&&t.assignees.length)?(t.assignees[0].username||null):null; }
    var st = String((t.status && (t.status.status || t.status)) || '').toLowerCase();
    var isDone = st === 'done' || st === 'closed' || st === 'complete' || st.indexOf('conclu') >= 0;
    if (isDone) byList[listId].done++;
    byList[listId].fases.push({ nome:t.name||'', status:(t.status&&(t.status.status||t.status))||'', done:isDone, assignee:(t.assignees&&t.assignees.length)?(t.assignees[0].username||null):null });
  });
  var fallback = Object.keys(byList).map(function(k){
    var x = byList[k], total = x.fases.length;
    return { cliente:x.cliente, listId:x.listId, folderUrl:x.folderUrl, lastUpdate:x.lastUpdate, diasSemUpdate:x.lastUpdate>0?Math.floor((Date.now()-x.lastUpdate)/86400000):999, consultor:x.consultor, fases:x.fases, progresso:total?Math.round(x.done/total*100):0, totalFases:total, fasesDone:x.done, fasesPend:total-x.done };
  });
  return { clickup: fallback, meta: { version: RESET_VERSION, total: fallback.length, tasksLidas: tasks.length, fonte: 'team-task-fallback' } };
}

function _clickupByProjectFolders(team, hdrs) {
  try {
    var sresp = UrlFetchApp.fetch('https://api.clickup.com/api/v2/team/' + team + '/space?archived=false', { headers: hdrs, muteHttpExceptions: true });
    var spaces = JSON.parse(sresp.getContentText() || '{}').spaces || [];
    // prioriza spaces de projeto
    spaces = spaces.filter(function(s){
      var n = String(s.name || '').toLowerCase();
      return n.indexOf('projeto') >= 0 || n.indexOf('implant') >= 0 || n.indexOf('csi') >= 0;
    });
    if (!spaces.length) return [];

    var out = [];
    spaces.forEach(function(sp){
      var fresp = UrlFetchApp.fetch('https://api.clickup.com/api/v2/space/' + sp.id + '/folder?archived=false', { headers: hdrs, muteHttpExceptions: true });
      var folders = JSON.parse(fresp.getContentText() || '{}').folders || [];
      folders.forEach(function(fd){
        var lresp = UrlFetchApp.fetch('https://api.clickup.com/api/v2/folder/' + fd.id + '/list?archived=false', { headers: hdrs, muteHttpExceptions: true });
        var listas = JSON.parse(lresp.getContentText() || '{}').lists || [];
        var cron = null;
        for (var i=0;i<listas.length;i++) {
          var ln = String(listas[i].name||'').toLowerCase();
          if (ln.indexOf('cronograma') >= 0 || ln.indexOf('implant') >= 0) { cron = listas[i]; break; }
        }
        if (!cron) return;
        var tresp = UrlFetchApp.fetch('https://api.clickup.com/api/v2/list/' + cron.id + '/task?include_closed=true&page=0&order_by=updated&reverse=true', { headers: hdrs, muteHttpExceptions: true });
        var tasks = JSON.parse(tresp.getContentText() || '{}').tasks || [];
        if (!tasks.length) return;
        var last=0, done=0, consultor=null, fases=[];
        tasks.forEach(function(t){
          var upd=parseInt(t.date_updated||t.date_created||'0',10); if(upd>last){last=upd; consultor=(t.assignees&&t.assignees.length)?(t.assignees[0].username||null):consultor;}
          var st=String((t.status&&(t.status.status||t.status))||'').toLowerCase(); var isDone=st==='done'||st==='closed'||st==='complete'||st.indexOf('conclu')>=0; if(isDone) done++;
          fases.push({nome:t.name||'',status:(t.status&&(t.status.status||t.status))||'',done:isDone,assignee:(t.assignees&&t.assignees.length)?(t.assignees[0].username||null):null});
        });
        out.push({cliente:fd.name||'Sem nome',listId:cron.id,folderUrl:'https://app.clickup.com/'+team+'/v/li/'+cron.id,lastUpdate:last,diasSemUpdate:last>0?Math.floor((Date.now()-last)/86400000):999,consultor:consultor,fases:fases,progresso:fases.length?Math.round(done/fases.length*100):0,totalFases:fases.length,fasesDone:done,fasesPend:fases.length-done});
      });
    });
    return out;
  } catch (e) {
    return [];
  }
}
