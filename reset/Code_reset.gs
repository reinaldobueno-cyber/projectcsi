// ============================================================
// RESET BACKEND (MÍNIMO FUNCIONAL) - Apps Script
// Objetivo: sair do loop e colocar o painel no ar rapidamente.
// ============================================================

var RESET_VERSION = 'reset-v2';
var RESET_TASK_PAGES = 2; // páginas do endpoint team/task

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'sheets';
  var cb = (e && e.parameter && e.parameter.callback) || '';
  var out;
  try {
    if (action === 'ping') out = _ping();
    else if (action === 'clickup') out = _clickupRecent(e);
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
    function idxContains(tokens){
      for (var i=0;i<hdrs.length;i++){
        var h = String(hdrs[i] || '').toUpperCase();
        for (var t=0;t<tokens.length;t++){
          if (h.indexOf(tokens[t]) >= 0) return i;
        }
      }
      return -1;
    }
    var iCliente = idx(['CLIENTE','CLIENTE / FAZENDA','NOME CLIENTE']);
    var iCons    = idx(['CONSULTOR','CONSULTOR(A)','CONSULTOR RESPONSAVEL','CONSULTOR RESPONSÁVEL']);
    if (iCons < 0) iCons = idxContains(['CONSULTOR','IMPLANTADOR','RESPONSAVEL']);
    var iStatus  = idx(['STATUS']);
    var iVend    = idx(['VENDEDOR']);
    var iClick   = idx(['PROJETO CLICKUP','CLICKUP']);
    var iLink    = idx(['LINK PROJETO','LINK DO PROJETO','PROJETO LINK','URL PROJETO','LINK']);
    if (iLink < 0) iLink = hdrs.length ? (hdrs.length - 1) : -1; // última coluna (W)
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
        projeto_link: iLink>=0?String(row[iLink]||'').trim():'',
        data_inicio: iIni>=0?String(row[iIni]||'').trim():'',
        obs: iObs>=0?String(row[iObs]||'').trim():''
      });
    }
  });

  return { projetos: out, meta: { version: RESET_VERSION, total: out.length } };
}

function _clickupRecent(e) {
  var token = _cfg('CK_TOKEN');
  var team = _cfg('WORKSPACE_ID');
  if (!token) throw new Error('CK_TOKEN não configurado');
  if (!team) throw new Error('WORKSPACE_ID não configurado');

  var hdrs = { Authorization: token };
  var listIds = _parseListIds(e);

  // Modo 0 (prioridade): listas vindas da própria planilha (link/id)
  if (listIds.length) {
    var fromListIds = _clickupByListIds(listIds, team, hdrs);
    if (fromListIds.length) {
      return { clickup: fromListIds, meta: { version: RESET_VERSION, total: fromListIds.length, fonte: 'list-ids' } };
    }
  }

  // Modo 1 (preferencial): spaces/folders/listas de projetos -> cliente = nome da pasta/lista
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
    if (!byList[listId]) byList[listId] = { cliente:(t.folder&&t.folder.name)||(t.list&&t.list.name)||'Sem nome', listId:listId, folderUrl:(t.list&&t.list.url)||t.url||('https://app.clickup.com/'+team+'/v/li/'+listId), lastUpdate:0, consultor:null, fases:[], done:0, marcosTotal:0, marcosDone:0, aliases:[] };
    var upd = parseInt(t.date_updated || t.date_created || '0',10);
    if (upd > byList[listId].lastUpdate) { byList[listId].lastUpdate = upd; byList[listId].consultor = (t.assignees&&t.assignees.length)?(t.assignees[0].username||null):null; }
    var st = String((t.status && (t.status.status || t.status)) || '').toLowerCase();
    var isDone = st === 'done' || st === 'closed' || st === 'complete' || st.indexOf('conclu') >= 0;
    if (isDone) byList[listId].done++;
    var isMarco = _isMilestoneTask(t);
    if (isMarco) {
      byList[listId].marcosTotal++;
      if (isDone) byList[listId].marcosDone++;
    }
    byList[listId].fases.push({ nome:t.name||'', status:(t.status&&(t.status.status||t.status))||'', done:isDone, assignee:(t.assignees&&t.assignees.length)?(t.assignees[0].username||null):null });
    if (!byList[listId].folderUrl && t.url) byList[listId].folderUrl = t.url;
    _pushAlias(byList[listId].aliases, (t.folder&&t.folder.name)||'');
    _pushAlias(byList[listId].aliases, (t.list&&t.list.name)||'');
    _pushAlias(byList[listId].aliases, (t.space&&t.space.name)||'');
  });
  var fallback = Object.keys(byList).map(function(k){
    var x = byList[k], total = x.fases.length;
    return { cliente:x.cliente, listId:x.listId, folderUrl:x.folderUrl, lastUpdate:x.lastUpdate, diasSemUpdate:x.lastUpdate>0?Math.floor((Date.now()-x.lastUpdate)/86400000):999, consultor:x.consultor, fases:x.fases, progresso:total?Math.round(x.done/total*100):0, totalFases:total, fasesDone:x.done, fasesPend:total-x.done, marcosTotal:x.marcosTotal, marcosDone:x.marcosDone, marcosPend:Math.max(0, x.marcosTotal - x.marcosDone), aliases:x.aliases };
  });
  return { clickup: fallback, meta: { version: RESET_VERSION, total: fallback.length, tasksLidas: tasks.length, fonte: 'team-task-fallback' } };
}

function _parseListIds(e){
  var raw = (e && e.parameter && e.parameter.list_ids) ? String(e.parameter.list_ids) : '';
  if (!raw) return [];
  var out = [];
  raw.split(',').forEach(function(x){
    var id = String(x || '').replace(/[^\d]/g, '').trim();
    if (id && out.indexOf(id) === -1) out.push(id);
  });
  return out;
}
function _clickupByListIds(listIds, team, hdrs){
  var out = [];
  listIds.forEach(function(listId){
    try {
      var lresp = UrlFetchApp.fetch('https://api.clickup.com/api/v2/list/' + listId, { headers: hdrs, muteHttpExceptions: true });
      var lobj = JSON.parse(lresp.getContentText() || '{}');
      if (!lobj || !lobj.id) return;
      var clienteNome = (lobj.folder && lobj.folder.name) || lobj.name || ('Lista ' + listId);
      var metric = _summarizeList(listId, hdrs, clienteNome, lobj.url || '');
      if (!metric.totalFases) return;
      metric.listId = listId;
      metric.folderUrl = lobj.url || metric.folderUrl || ('https://app.clickup.com/' + team + '/v/li/' + listId);
      metric.aliases = _unique([clienteNome, lobj.name || '', (lobj.folder && lobj.folder.name) || '', (lobj.space && lobj.space.name) || '']);
      out.push(metric);
    } catch (err) {}
  });
  return out;
}

function _clickupByProjectFolders(team, hdrs) {
  try {
    var spaces = _listSpaces(team, hdrs);
    if (!spaces.length) return [];

    var byList = {};
    spaces.forEach(function(sp){
      var folders = _listFolders(sp.id, hdrs);
      folders.forEach(function(fd){
        var listas = _listFolderLists(fd.id, hdrs);
        var cronList = _pickBestList(listas);
        if (!cronList) return;
        var metric = _summarizeList(cronList.id, hdrs, fd.name || cronList.name || 'Sem nome', cronList.url || '');
        if (!metric.totalFases) return;
        metric.listId = cronList.id;
        metric.folderUrl = cronList.url || ('https://app.clickup.com/' + team + '/v/li/' + cronList.id);
        metric.aliases = _unique([(fd.name || ''), (cronList.name || ''), (sp.name || '')]);
        byList[String(metric.listId)] = metric;
      });

      // também captura listas sem pasta
      var listasSpace = _listSpaceLists(sp.id, hdrs);
      listasSpace.forEach(function(li){
        if (byList[String(li.id)]) return;
        if (!_isProjectListName(li.name)) return;
        var metric = _summarizeList(li.id, hdrs, li.name || 'Sem nome', li.url || '');
        if (!metric.totalFases) return;
        metric.listId = li.id;
        metric.folderUrl = li.url || ('https://app.clickup.com/' + team + '/v/li/' + li.id);
        metric.aliases = _unique([(li.name || ''), (sp.name || '')]);
        byList[String(metric.listId)] = metric;
      });
    });
    return Object.keys(byList).map(function(k){ return byList[k]; });
  } catch (e) {
    return [];
  }
}

function _listSpaces(team, hdrs){
  var forced = _cfg('CK_SPACES_JSON');
  if (forced) {
    try {
      var ids = JSON.parse(forced);
      if (Array.isArray(ids) && ids.length) {
        return ids.map(function(id){ return { id: String(id), name: 'forced-space-'+id }; });
      }
    } catch (eForced) {}
  }
  var sresp = UrlFetchApp.fetch('https://api.clickup.com/api/v2/team/' + team + '/space?archived=false', { headers: hdrs, muteHttpExceptions: true });
  var spaces = JSON.parse(sresp.getContentText() || '{}').spaces || [];
  return spaces.filter(function(s){
    var n = String(s.name || '').toLowerCase();
    return n.indexOf('projeto') >= 0 || n.indexOf('implant') >= 0 || n.indexOf('csi') >= 0 || n.indexOf('cliente') >= 0;
  });
}
function _listFolders(spaceId, hdrs){
  var fresp = UrlFetchApp.fetch('https://api.clickup.com/api/v2/space/' + spaceId + '/folder?archived=false', { headers: hdrs, muteHttpExceptions: true });
  return JSON.parse(fresp.getContentText() || '{}').folders || [];
}
function _listFolderLists(folderId, hdrs){
  var lresp = UrlFetchApp.fetch('https://api.clickup.com/api/v2/folder/' + folderId + '/list?archived=false', { headers: hdrs, muteHttpExceptions: true });
  return JSON.parse(lresp.getContentText() || '{}').lists || [];
}
function _listSpaceLists(spaceId, hdrs){
  var lresp = UrlFetchApp.fetch('https://api.clickup.com/api/v2/space/' + spaceId + '/list?archived=false', { headers: hdrs, muteHttpExceptions: true });
  return JSON.parse(lresp.getContentText() || '{}').lists || [];
}
function _isProjectListName(name){
  var n = String(name || '').toLowerCase();
  if (!n) return false;
  if (n.indexOf('template') >= 0 || n.indexOf('modelo') >= 0) return false;
  return n.indexOf('cronograma') >= 0 || n.indexOf('implant') >= 0 || n.indexOf('projeto') >= 0 || n.indexOf('execu') >= 0 || n.indexOf('entrega') >= 0;
}
function _pickBestList(listas){
  if (!listas || !listas.length) return null;
  var picked = null;
  for (var i=0;i<listas.length;i++){
    var n = String(listas[i].name || '').toLowerCase();
    if (n.indexOf('cronograma') >= 0 || n.indexOf('implant') >= 0) return listas[i];
    if (!picked && _isProjectListName(n)) picked = listas[i];
  }
  return picked || listas[0];
}
function _summarizeList(listId, hdrs, clienteNome, listUrl){
  var tresp = UrlFetchApp.fetch('https://api.clickup.com/api/v2/list/' + listId + '/task?include_closed=true&page=0&order_by=updated&reverse=true', { headers: hdrs, muteHttpExceptions: true });
  var tasks = JSON.parse(tresp.getContentText() || '{}').tasks || [];
  var last=0, done=0, consultor=null, fases=[], marcosTotal=0, marcosDone=0;
  tasks.forEach(function(t){
    if (t.parent) return;
    var upd=parseInt(t.date_updated||t.date_created||'0',10);
    if(upd>last){last=upd; consultor=(t.assignees&&t.assignees.length)?(t.assignees[0].username||null):consultor;}
    var st=String((t.status&&(t.status.status||t.status))||'').toLowerCase();
    var isDone=st==='done'||st==='closed'||st==='complete'||st.indexOf('conclu')>=0;
    if(isDone) done++;
    var isMarco = _isMilestoneTask(t);
    if (isMarco) {
      marcosTotal++;
      if (isDone) marcosDone++;
    }
    fases.push({nome:t.name||'',status:(t.status&&(t.status.status||t.status))||'',done:isDone,assignee:(t.assignees&&t.assignees.length)?(t.assignees[0].username||null):null});
  });
  var total = fases.length;
  return {
    cliente: clienteNome || 'Sem nome',
    lastUpdate:last,
    diasSemUpdate:last>0?Math.floor((Date.now()-last)/86400000):999,
    consultor:consultor,
    fases:fases,
    progresso:total?Math.round(done/total*100):0,
    totalFases:total,
    fasesDone:done,
    fasesPend:total-done,
    marcosTotal:marcosTotal,
    marcosDone:marcosDone,
    marcosPend:Math.max(0, marcosTotal-marcosDone),
    folderUrl: listUrl || ''
  };
}
function _isMilestoneTask(t){
  var n = String((t && t.name) || '').toLowerCase();
  if (n.indexOf('marco') >= 0 || n.indexOf('milestone') >= 0) return true;
  var tags = (t && t.tags) || [];
  for (var i=0;i<tags.length;i++){
    var tg = String(tags[i] && tags[i].name || '').toLowerCase();
    if (tg.indexOf('marco') >= 0 || tg.indexOf('milestone') >= 0) return true;
  }
  return false;
}
function _pushAlias(arr, v){
  var s = String(v || '').trim();
  if (!s) return;
  if (arr.indexOf(s) === -1) arr.push(s);
}
function _unique(items){
  var out = [];
  (items || []).forEach(function(v){ _pushAlias(out, v); });
  return out;
}
