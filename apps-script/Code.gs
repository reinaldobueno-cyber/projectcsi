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
var CLICKUP_TASK_PAGE_LIMIT = 1; // página 0 (mais rápido e estável)
var APP_VERSION = '2026-04-09-rapid-debug-v2';

// Modo rápido para teste (opcional):
// Preencha aqui se não quiser usar Script Properties agora.
// Depois remova valores sensíveis.
var QUICK_SHEET_ID = '';
var QUICK_CK_TOKEN = '';
var QUICK_WORKSPACE_ID = '';
var QUICK_CK_SPACES_JSON = '';

function _cfg(name, fallback) {
  var v = PropertiesService.getScriptProperties().getProperty(name);
  if (v !== null && v !== undefined && v !== '') return v;

  var quick = {
    SHEET_ID: QUICK_SHEET_ID,
    CK_TOKEN: QUICK_CK_TOKEN,
    WORKSPACE_ID: QUICK_WORKSPACE_ID,
    CK_SPACES_JSON: QUICK_CK_SPACES_JSON
  };
  var qv = quick[name];
  return (qv === null || qv === undefined || qv === '') ? fallback : qv;
}

function _isCronogramaNome(nome) {
  var n = String(nome || '').toLowerCase();
  return n.indexOf('cronograma') >= 0 || n.indexOf('implant') >= 0 || n.indexOf('onboard') >= 0;
}

function doGet(e) {
  var callback = (e && e.parameter && e.parameter.callback) || '';
  var action   = (e && e.parameter && e.parameter.action)   || 'sheets';
  var nocache  = !!(e && e.parameter && String(e.parameter.nocache || '') === '1');
  var debug    = !!(e && e.parameter && String(e.parameter.debug || '') === '1');
  var result;

  try {
    if (action === 'ping') result = _ping();
    else result = action === 'clickup' ? _buscarClickUp({nocache:nocache, debug:debug}) : _buscarSheets(e, {nocache:nocache, debug:debug});
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

function _ping() {
  return {
    ok: true,
    version: APP_VERSION,
    hasSheetId: !!_cfg('SHEET_ID', ''),
    hasToken: !!_cfg('CK_TOKEN', ''),
    hasWorkspaceId: !!_cfg('WORKSPACE_ID', ''),
    hasSpacesJson: !!_cfg('CK_SPACES_JSON', '')
  };
}

function _buscarSheets(e, opts) {
  opts = opts || {};
  var SHEET_ID = _cfg('SHEET_ID', '');
  if (!SHEET_ID) throw new Error('SHEET_ID não configurado.');

  var mes   = (e && e.parameter && e.parameter.mes) || 'ALL';
  var cacheKey = 'sheets_payload_' + String(mes).toUpperCase();
  var cache = CacheService.getScriptCache();
  var cached = opts.nocache ? null : cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var abas = [];
  var result = [];
  var ss = SpreadsheetApp.openById(SHEET_ID);
  if (mes === 'ALL') {
    // Usa todas as abas com dados (evita depender de nomes fixos JAN..DEZ)
    abas = ss.getSheets().map(function(s){ return s.getName(); });
  } else {
    abas = [mes];
  }

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
  if (opts.debug) out.meta = { version: APP_VERSION, abasLidas: abas.length, totalProjetos: result.length, mes: mes };
  cache.put(cacheKey, JSON.stringify(out), SHEETS_CACHE_TTL_SECONDS);
  return out;
}

function _buscarClickUp(opts) {
  opts = opts || {};
  var token = _cfg('CK_TOKEN', '');
  var workspaceId = _cfg('WORKSPACE_ID', '');
  var spacesJson = _cfg('CK_SPACES_JSON', '[]');
  if (!token) throw new Error('CK_TOKEN não configurado.');
  if (!workspaceId) throw new Error('WORKSPACE_ID não configurado.');

  var cache = CacheService.getScriptCache();
  var cached = opts.nocache ? null : cache.get('clickup_payload_v1');
  if (cached) return JSON.parse(cached);

  var spaces = JSON.parse(spacesJson || '[]');
  var hdrs = { 'Authorization': token };
  var projetos = [];
  var started = Date.now();

  // Auto-descoberta de spaces se CK_SPACES_JSON não estiver preenchido corretamente
  if (!spaces.length) {
    try {
      var sresp = UrlFetchApp.fetch(
        'https://api.clickup.com/api/v2/team/' + workspaceId + '/space?archived=false',
        { headers: hdrs, muteHttpExceptions: true }
      );
      spaces = (JSON.parse(sresp.getContentText() || '{}').spaces || []).map(function(s){ return s.id; });
    } catch (e0) {}
  }
  if (!spaces.length) return { clickup: [], meta: { version: APP_VERSION, total: 0, generatedAt: new Date().toISOString(), erro: 'Sem spaces válidos (CK_SPACES_JSON)' } };

  // 1) Busca listas de todos os spaces (inclui listas sem pasta)
  var allLists = [];
  spaces.forEach(function(spaceId) {
    if ((Date.now() - started) > CLICKUP_MAX_MS) return;
    try {
      var lresp = UrlFetchApp.fetch(
        'https://api.clickup.com/api/v2/space/' + spaceId + '/list?archived=false',
        { headers: hdrs, muteHttpExceptions: true }
      );
      var listas = JSON.parse(lresp.getContentText() || '{}').lists || [];
      listas.forEach(function(li){ li._spaceId = spaceId; });
      allLists = allLists.concat(listas);
    } catch (e1) {}
  });

  if (allLists.length > CLICKUP_MAX_FOLDERS * 2) allLists = allLists.slice(0, CLICKUP_MAX_FOLDERS * 2);

  // 2) Filtra listas candidatas (cronograma/implantação/onboarding)
  var cronos = allLists.filter(function(li){ return _isCronogramaNome(li.name); });
  if (!cronos.length) {
    // fallback: usa todas as listas se não encontrou padrão de nome
    cronos = allLists;
  }

  // 4) Busca tasks das listas cronograma em paralelo (page 0 por estabilidade)
  var taskReqMap = [];
  cronos.forEach(function(li) {
    for (var page = 0; page < CLICKUP_TASK_PAGE_LIMIT; page++) {
      taskReqMap.push({
        list: li,
        req: {
          url: 'https://api.clickup.com/api/v2/list/' + li.id +
            '/task?archived=false&include_closed=true&subtasks=false&order_by=updated&reverse=true&page=' + page,
          method: 'get',
          headers: hdrs,
          muteHttpExceptions: true
        }
      });
    }
  });

  var taskPairs = [];
  for (var tr = 0; tr < taskReqMap.length; tr += 10) {
    if ((Date.now() - started) > CLICKUP_MAX_MS) break;
    var chunk = taskReqMap.slice(tr, tr + 10);
    var respChunk = UrlFetchApp.fetchAll(chunk.map(function(x){ return x.req; }));
    for (var ri = 0; ri < respChunk.length; ri++) taskPairs.push({ meta: chunk[ri], res: respChunk[ri] });
  }

  var byList = {};
  taskPairs.forEach(function(pair) {
    try {
      var id = String(pair.meta.list.id);
      if (!byList[id]) byList[id] = { list: pair.meta.list, tasks: [] };
      var pageTasks = JSON.parse(pair.res.getContentText() || '{}').tasks || [];
      byList[id].tasks = byList[id].tasks.concat(pageTasks);
    } catch (e3) {}
  });

  Object.keys(byList).forEach(function(listId) {
    var pack = byList[listId];
    var tasks = pack.tasks || [];
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
        assignee: (t.assignees && t.assignees.length) ? t.assignees[0].username : null,
        due: t.due_date || null,
        updated: upd
      });
    });

    var totalFases = fases.length;
    var clienteNome = (pack.list && pack.list.folder && pack.list.folder.name) || (pack.list && pack.list.name) || '';
    projetos.push({
      cliente: clienteNome,
      folderId: (pack.list && pack.list.folder && pack.list.folder.id) || '',
      listId: pack.list.id,
      folderUrl: 'https://app.clickup.com/' + workspaceId + '/v/li/' + pack.list.id,
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

  var out = { clickup: projetos, meta: {
    version: APP_VERSION,
    total: projetos.length,
    generatedAt: new Date().toISOString(),
    spacesLidos: spaces.length,
    listasLidas: allLists.length,
    listasCandidatas: cronos.length
  } };
  cache.put('clickup_payload_v1', JSON.stringify(out), CLICKUP_CACHE_TTL_SECONDS);
  return out;
}
