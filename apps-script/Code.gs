// ============================================================
// APPS SCRIPT - MULTSOFT PMO (versão otimizada)
// Observação: não duplique este arquivo no editor do Apps Script.
// ============================================================

/**
 * Configure no Apps Script (Project Settings > Script properties):
 * - SHEET_ID
 * - CK_TOKEN
 * - WORKSPACE_ID
 * - CK_SPACES_JSON   (ex: ["90130063158","90130063112"])
 */

var DEFAULT_MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
var CLICKUP_CACHE_TTL_SECONDS = 180; // 3 min
var SHEETS_CACHE_TTL_SECONDS = 120; // 2 min
var CLICKUP_MAX_MS = 240000; // evita estourar limite de execução
var CLICKUP_MAX_FOLDERS = 80; // proteção

function _cfg(name, fallback) {
  var v = PropertiesService.getScriptProperties().getProperty(name);
  return (v === null || v === undefined || v === '') ? fallback : v;
}

function doGet(e) {
  var callback = (e && e.parameter && e.parameter.callback) || '';
  var action   = (e && e.parameter && e.parameter.action)   || 'sheets';
  var result;

  try {
    result = action === 'clickup' ? _buscarClickUp() : _buscarSheets(e);
  } catch (err) {
    result = { erro: String(err && err.message ? err.message : err) };
  }

  var json = JSON.stringify(result);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function _buscarSheets(e) {
  var SHEET_ID = _cfg('SHEET_ID', '');
  if (!SHEET_ID) throw new Error('SHEET_ID não configurado.');

  var mes   = (e && e.parameter && e.parameter.mes) || 'ALL';
  var cacheKey = 'sheets_payload_' + String(mes).toUpperCase();
  var cache = CacheService.getScriptCache();
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var abas  = mes === 'ALL' ? DEFAULT_MESES : [mes];
  var result = [];
  var ss = SpreadsheetApp.openById(SHEET_ID);

  abas.forEach(function(m) {
    var sheet = ss.getSheetByName(m);
    if (!sheet) return;
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return;
    var hdrs = data[0].map(function(h){ return String(h).trim().toUpperCase(); });

    function col(n) { return hdrs.indexOf(String(n).toUpperCase()); }
    function colAny(names) {
      for (var k=0;k<names.length;k++) {
        var idx = col(names[k]);
        if (idx >= 0) return idx;
      }
      return -1;
    }
    function v(row, n) { var i=col(n); return i>=0?String(row[i]||'').trim():''; }
    function vAny(row, names) { var i=colAny(names); return i>=0?String(row[i]||'').trim():''; }
    function num(row, n) { var i=col(n); if(i<0)return null; var x=parseFloat(row[i]); return isNaN(x)?null:x; }
    function numAny(row, names) { var i=colAny(names); if(i<0)return null; var x=parseFloat(row[i]); return isNaN(x)?null:x; }
    function dt(row, n) {
      var i=col(n); if(i<0)return '';
      var val=row[i]; if(!val)return '';
      if (val instanceof Date) {
        return val.getFullYear()+'-'+String(val.getMonth()+1).padStart(2,'0')+'-'+String(val.getDate()).padStart(2,'0');
      }
      return String(val).trim();
    }
    function dtAny(row, names) {
      var i=colAny(names); if(i<0)return '';
      var val=row[i]; if(!val)return '';
      if (val instanceof Date) {
        return val.getFullYear()+'-'+String(val.getMonth()+1).padStart(2,'0')+'-'+String(val.getDate()).padStart(2,'0');
      }
      return String(val).trim();
    }

    for (var r=1; r<data.length; r++) {
      var row=data[r];
      var cliente=vAny(row,['CLIENTE','CLIENTE / FAZENDA','NOME CLIENTE']);
      if (!cliente) continue;
      var dc=numAny(row,['QNT DI','QNTD DI','DIARIAS CONTRATADAS']);
      var dr=numAny(row,['REALIZADAS','DIARIAS REALIZADAS']);
      result.push({
        mes:m, cliente:cliente, consultor:vAny(row,['CONSULTOR','CONSULTOR(A)']), pacote:v(row,'PACOTE'),
        adicionais:v(row,'ADICIONAIS'), tipo:v(row,'TIPO'), vendedor:v(row,'VENDEDOR'),
        formato:v(row,'FORMATO'), cidade:v(row,'CIDADE'), data_venda:dtAny(row,['DATA DA VENDA','DATA VENDA']),
        kickoff:vAny(row,['KICK OFF REALIZADO','KICKOFF']), data_kick:dtAny(row,['DATA KICK OFF','DATA KICKOFF']),
        clickup:vAny(row,['PROJETO CLICKUP','CLICKUP']), data_inicio:dtAny(row,['DATA IN/INICIO IMPLANT','DATA INICIO IMPLANT','DATA INICIO']),
        data_estimada:dtAny(row,['DATA ESTIMADA IMPLANT','DATA ESTIMADA']), diarias_cont:dc, diarias_real:dr,
        diarias_rest:(dc!==null&&dr!==null)?dc-dr:null, acompanhamento:v(row,'ACOMPANHAMENTO'),
        status:v(row,'STATUS'), obs:vAny(row,['OBSERVA','OBS','OBSERVACAO','OBSERVAÇÃO']), data_enc:dtAny(row,['DATA ENC','DATA ENCERRAMENTO'])
      });
    }
  });
  var out = { projetos: result };
  cache.put(cacheKey, JSON.stringify(out), SHEETS_CACHE_TTL_SECONDS);
  return out;
}

function _buscarClickUp() {
  var token = _cfg('CK_TOKEN', '');
  var workspaceId = _cfg('WORKSPACE_ID', '');
  var spacesJson = _cfg('CK_SPACES_JSON', '[]');
  if (!token) throw new Error('CK_TOKEN não configurado.');
  if (!workspaceId) throw new Error('WORKSPACE_ID não configurado.');

  var cache = CacheService.getScriptCache();
  var cached = cache.get('clickup_payload_v1');
  if (cached) return JSON.parse(cached);

  var spaces = JSON.parse(spacesJson || '[]');
  if (!spaces.length) throw new Error('CK_SPACES_JSON vazio.');
  var hdrs = { 'Authorization': token };
  var projetos = [];
  var started = Date.now();
  var foldersLidos = 0;

  spaces.forEach(function(spaceId) {
    if ((Date.now() - started) > CLICKUP_MAX_MS) return;
    var resp = UrlFetchApp.fetch(
      'https://api.clickup.com/api/v2/space/' + spaceId + '/folder?archived=false',
      { headers: hdrs, muteHttpExceptions: true }
    );
    var folders = JSON.parse(resp.getContentText() || '{}').folders || [];

    folders.forEach(function(folder) {
      if ((Date.now() - started) > CLICKUP_MAX_MS) return;
      if (foldersLidos >= CLICKUP_MAX_FOLDERS) return;
      foldersLidos++;

      var lresp = UrlFetchApp.fetch(
        'https://api.clickup.com/api/v2/folder/' + folder.id + '/list?archived=false',
        { headers: hdrs, muteHttpExceptions: true }
      );
      var listas = JSON.parse(lresp.getContentText() || '{}').lists || [];
      var cronograma = null;
      for (var i=0; i<listas.length; i++) {
        var nm = String(listas[i].name || '').toLowerCase();
        if (nm.indexOf('cronograma') >= 0) { cronograma = listas[i]; break; }
      }
      if (!cronograma) return;

      var tasks = [];
      var page = 0;
      while (page < 3 && (Date.now() - started) <= CLICKUP_MAX_MS) { // até 300 tarefas aprox
        var tresp = UrlFetchApp.fetch(
          'https://api.clickup.com/api/v2/list/' + cronograma.id +
          '/task?archived=false&include_closed=true&subtasks=false&order_by=updated&reverse=true&page=' + page,
          { headers: hdrs, muteHttpExceptions: true }
        );
        var pageTasks = JSON.parse(tresp.getContentText() || '{}').tasks || [];
        if (!pageTasks.length) break;
        tasks = tasks.concat(pageTasks);
        if (pageTasks.length < 100) break;
        page++;
      }
      if (!tasks.length) return;

      var lastUpdate = 0;
      var consultorCK = null;
      var fases = [];
      var fasesDone = 0;

      tasks.forEach(function(t) {
        if (t.parent) return;
        var upd = parseInt(t.date_updated || t.date_created || '0', 10);
        if (upd > lastUpdate) {
          lastUpdate = upd;
          if (t.assignees && t.assignees.length) consultorCK = t.assignees[0].username || null;
        }
        var st = String((t.status && (t.status.status || t.status)) || '').toLowerCase();
        var done = st==='concluido'||st==='closed'||st==='done'||st==='complete';
        if (done) fasesDone++;
        fases.push({
          nome: t.name || '',
          status: (t.status && (t.status.status || t.status)) || '',
          done: done,
          assignee: (t.assignees&&t.assignees.length) ? t.assignees[0].username : null,
          due: t.due_date || null,
          updated: upd
        });
      });

      var totalFases = fases.length;
      projetos.push({
        cliente: folder.name || '',
        folderId: folder.id,
        listId: cronograma.id,
        folderUrl: 'https://app.clickup.com/' + workspaceId + '/v/li/' + cronograma.id,
        lastUpdate: lastUpdate,
        diasSemUpdate: lastUpdate > 0 ? Math.floor((Date.now() - lastUpdate) / 86400000) : 999,
        consultor: consultorCK,
        fases: fases,
        progresso: totalFases > 0 ? Math.round(fasesDone / totalFases * 100) : 0,
        totalFases: totalFases,
        fasesDone: fasesDone,
        fasesPend: totalFases - fasesDone
      });
    });
  });

  var out = { clickup: projetos, meta: { total: projetos.length, generatedAt: new Date().toISOString() } };
  cache.put('clickup_payload_v1', JSON.stringify(out), CLICKUP_CACHE_TTL_SECONDS);
  return out;
}
