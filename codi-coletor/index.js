/**
 * Coletor CODI → Supabase (schema "codi")
 * ─────────────────────────────────────────────────────────────
 * Roda num PC dentro da rede da fábrica.
 *
 * Dois canais em paralelo:
 *   1. WebSocket  (/action/monitorRecurso/webSocket) — status ao vivo das máquinas
 *      Usa sessão Spring Security (JSESSIONID via login HTTP).
 *   2. REST API   (codi-glue / Kong + OAuth2)        — OFs, cadastros
 *      Usa refresh_token rotativo salvo em .token
 *
 * Uso:
 *   cp .env.example .env   # preencher credenciais reais
 *   npm install
 *   node index.js
 */

import 'dotenv/config';
import { createClient }       from '@supabase/supabase-js';
import WebSocket               from 'ws';
import http                    from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname }       from 'path';
import { fileURLToPath }       from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = join(__dir, '.token');

// ─── Config ───────────────────────────────────────────────────
const CODI_BASE           = (process.env.CODI_BASE_URL           || '').replace(/\/$/, '');
const CODI_AUTH_URL       = process.env.CODI_AUTH_URL            || '';
const CODI_CLIENT_ID      = process.env.CODI_CLIENT_ID           || '';
const CODI_SECRET         = process.env.CODI_CLIENT_SECRET       || '';
const CODI_ACTION_URL     = (process.env.CODI_ACTION_URL         || '').replace(/\/$/, '');
const CODI_WS_USER        = process.env.CODI_WS_USER             || '';
const CODI_WS_PASS        = process.env.CODI_WS_PASS             || '';
const CODI_WS_LABEL       = process.env.CODI_WS_LABEL            || '000';
const CODI_COMPANY        = process.env.CODI_COMPANY             || 'somvsomvpo';
const CODI_COMPANY_ID     = process.env.CODI_COMPANY_ID          || '1';
const CODI_JSESSIONID     = process.env.CODI_JSESSIONID          || ''; // fallback manual
const INDUSTRIAL_BASE     = (process.env.CODI_INDUSTRIAL_URL     || '').replace(/\/$/, '');
const INDUSTRIAL_TOKEN    = process.env.CODI_INDUSTRIAL_TOKEN    || '';
const SB_URL              = process.env.SUPABASE_URL             || '';
const SB_KEY              = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const INTERVALO           = parseInt(process.env.INTERVALO_MIN || '5', 10) * 60_000;

// IDs das máquinas monitoradas (em string, como o CODI espera)
const MAQUINAS_IDS = (
  process.env.CODI_MAQUINAS_IDS ||
  '11,12,13,14,10,15,16,19,4,6,5,20,3,1,2,17,7,8,9,18'
).split(',').map(s => s.trim());

const PARADAS_CENARIO = ['0','1','2','4','5','6','7','8','9','10','11',
  '12','13','14','15','16','18','19','20','21','22','23','24','25','26','27'];

if (!CODI_BASE || !CODI_AUTH_URL || !CODI_CLIENT_ID || !CODI_SECRET ||
    !CODI_ACTION_URL || !CODI_WS_USER || !CODI_WS_PASS || !SB_URL || !SB_KEY) {
  console.error('[CODI] Variáveis de ambiente faltando. Verifique o .env');
  process.exit(1);
}

const sb = createClient(SB_URL, SB_KEY, { db: { schema: 'codi' } });

// ─── OAuth2 (REST API) ────────────────────────────────────────

let accessToken = null;
let tokenExpiry = 0;

function lerRefreshToken() {
  if (existsSync(TOKEN_FILE)) return readFileSync(TOKEN_FILE, 'utf8').trim();
  const t = process.env.CODI_REFRESH_TOKEN || '';
  if (!t) { console.error('[auth] CODI_REFRESH_TOKEN não definido.'); process.exit(1); }
  return t;
}

function salvarRefreshToken(t) { writeFileSync(TOKEN_FILE, t, 'utf8'); }

async function renovarToken() {
  // 1ª tentativa: refresh_token grant (rotativo, sem credenciais)
  try {
    const res = await fetch(CODI_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: lerRefreshToken(),
        client_id:     CODI_CLIENT_ID,
        client_secret: CODI_SECRET,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      accessToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
      salvarRefreshToken(data.refresh_token);
      console.log('[auth] token renovado via refresh_token');
      return;
    }
    console.warn(`[auth] refresh_token falhou (${res.status}) — tentando password grant...`);
  } catch (e) {
    console.warn('[auth] refresh_token erro:', e.message, '— tentando password grant...');
  }

  // 2ª tentativa: password grant (auto-recuperação quando refresh expira)
  const res2 = await fetch(CODI_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'password',
      client_id:     CODI_CLIENT_ID,
      client_secret: CODI_SECRET,
      username:      CODI_WS_USER,
      password:      CODI_WS_PASS,
      company:       CODI_COMPANY,
      companyId:     CODI_COMPANY_ID,
    }),
  });
  if (!res2.ok) throw new Error(`Auth password grant ${res2.status}: ${await res2.text().catch(() => '')}`);
  const data2 = await res2.json();
  accessToken = data2.access_token;
  tokenExpiry = Date.now() + (data2.expires_in - 300) * 1000;
  salvarRefreshToken(data2.refresh_token);
  console.log('[auth] token renovado via password grant (refresh rotacionado)');
}

async function garantirToken() {
  if (!accessToken || Date.now() >= tokenExpiry) await renovarToken();
}

async function codiGet(endpoint, params = {}) {
  await garantirToken();
  const url = new URL(`${CODI_BASE}/${endpoint}`);
  url.searchParams.set('access_token', accessToken);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`CODI ${endpoint} → ${res.status}`);
  return res.json();
}

async function codiGetAll(endpoint, params = {}) {
  const first = await codiGet(endpoint, { ...params, pageSize: 100, page: 1 });
  const pages = first.totalPages ?? 1;
  let all = [...(first.data ?? (Array.isArray(first) ? first : []))];
  for (let p = 2; p <= pages; p++) {
    const page = await codiGet(endpoint, { ...params, pageSize: 100, page: p });
    all = all.concat(page.data ?? []);
    await new Promise(r => setTimeout(r, 100));
  }
  return all;
}

// ─── Login Spring Security (para o WebSocket) ─────────────────

let jsessionid = null;

function extrairJsessionid(headers) {
  // 'set-cookie' pode vir como string única ou array — getSetCookie() é mais confiável no Node 18+
  const cookies = headers.getSetCookie
    ? headers.getSetCookie()
    : [headers.get('set-cookie') ?? ''];
  for (const c of cookies) {
    const m = c.match(/JSESSIONID=([^;,\s]+)/i);
    if (m) return m[1];
  }
  return null;
}

async function loginAction() {
  const BASE_HTTP = CODI_ACTION_URL.replace(/\/action$/, '');
  const COMPANY   = process.env.CODI_COMPANY    || 'somvsomvpo';
  const CO_ID     = process.env.CODI_COMPANY_ID || '1';

  // 1. Inicia fluxo OAuth implicit — o mesmo que o coletor-web faz no browser
  //    Isso faz o CODI criar um estado OAuth e redirecionar para o login com o redirect correto
  const redirectUri = encodeURIComponent(`${BASE_HTTP}/coletor-web/pt/`);
  const authUrl = `${BASE_HTTP}/auth/authorize?response_type=token&client_id=${CODI_CLIENT_ID}&client_secret=${CODI_SECRET}&redirect_uri=${redirectUri}&state=`;
  const r0 = await fetch(authUrl, {
    redirect: 'manual',
    headers: { 'User-Agent': 'Mozilla/5.0 codi-coletor/2.0' },
  });
  const loc0 = r0.headers.get('location') ?? '';
  const initSession = extrairJsessionid(r0.headers);

  // 2. Abre a página de login (pode vir direto ou via redirect)
  const loginUrl = loc0.startsWith('http') ? loc0
    : loc0.startsWith('/') ? `${BASE_HTTP}${loc0}`
    : `${CODI_ACTION_URL}/login/login`;

  const r1 = await fetch(loginUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 codi-coletor/2.0',
      ...(initSession ? { 'Cookie': `JSESSIONID=${initSession}` } : {}),
    },
  });
  const html = await r1.text().catch(() => '');
  const session1 = extrairJsessionid(r1.headers) ?? initSession;

  // Extrai form action e todos os hidden inputs (incluem state OAuth, company, etc.)
  const formMatch = html.match(/<form[^>]+action="([^"]+)"/i);
  const hiddens   = [...html.matchAll(/<input[^>]+type="hidden"[^>]*>/gi)]
    .reduce((acc, m) => {
      const name  = m[0].match(/name="([^"]+)"/i)?.[1];
      const value = m[0].match(/value="([^"]*)"/i)?.[1] ?? '';
      if (name) acc[name] = value;
      return acc;
    }, {});

  // Resolve URL absoluta do form action
  const formAction = formMatch?.[1] ?? null;
  const baseDir    = loginUrl.substring(0, loginUrl.lastIndexOf('/') + 1);
  const postUrl    = !formAction ? null
    : formAction.startsWith('http') ? formAction
    : formAction.startsWith('/') ? `${BASE_HTTP}${formAction}`
    : `${baseDir}${formAction}`;

  if (!postUrl) throw new Error('[ws-auth] Não foi possível determinar URL do formulário de login');

  // 3. POST com company + credenciais + todos os hidden fields (OAuth state incluso)
  const userField = html.includes('j_username') ? 'j_username' : 'username';
  const passField = html.includes('j_password') ? 'j_password' : 'password';
  const postBody  = new URLSearchParams({
    ...hiddens,
    company:    hiddens.company    ?? COMPANY,
    companyId:  hiddens.companyId  ?? CO_ID,
    [userField]: CODI_WS_USER,
    [passField]: CODI_WS_PASS,
  });

  const cookieLogin = session1
    ? `org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=pt-BR; JSESSIONID=${session1}`
    : 'org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=pt-BR';

  const r2 = await fetch(postUrl, {
    method: 'POST', redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent':   'Mozilla/5.0 codi-coletor/2.0',
      'Cookie':       cookieLogin,
      'Origin':       BASE_HTTP,
      'Referer':      loginUrl,
    },
    body: postBody,
  });

  const loc2     = r2.headers.get('location') ?? '';
  const session2 = extrairJsessionid(r2.headers) ?? session1;

  if (r2.status >= 400) {
    throw new Error(`[ws-auth] Login HTTP ${r2.status} em ${postUrl}`);
  }
  if (loc2.includes('error') || loc2.includes('login?error')) {
    throw new Error(`[ws-auth] Credenciais recusadas. Location: ${loc2}`);
  }

  // Se o redirect contém access_token (implicit flow completou), também salva o token
  const tokenMatch = loc2.match(/[#&]access_token=([^&]+)/);
  if (tokenMatch) {
    const rtMatch = loc2.match(/[#&?]refresh_token=([^&]+)/);
    if (rtMatch) { writeFileSync(TOKEN_FILE, decodeURIComponent(rtMatch[1]), 'utf8'); }
  }

  jsessionid = session2;
  console.log(`[ws-auth] Login ok. JSESSIONID=${jsessionid.substring(0, 8)}…`);
}

// ─── WebSocket (status ao vivo) ──────────────────────────────

let ws = null;
let wsConectando = false;
let ultimaAtualizacao = 0; // timestamp CODI em ms

async function upsertStatus(maq, tsAtualizacao) {
  const e  = maq.estadoAtual ?? {};
  const di = maq.DADOS_INDICADORES ?? {};
  await sb.from('maquinas_status').upsert({
    maquina_id:          maq.codigoRecursoConjunto,
    estado:              e.estado             ?? null,
    cod_parada:          e.codParada          ?? null,
    nome_parada:         e.nomeParada         ?? null,
    cod_tipo_parada:     e.codTipoParada      ?? null,
    nome_tipo_parada:    e.nomeTipoParada     ?? null,
    cor_tipo_parada:     e.corTipoParada      ?? null,
    cor_fonte:           e.corFonteTipoParada ?? null,
    is_in_retrabalho:    e.isInRetrabalho     ?? false,
    tempo_producao_turno: di.TEMPO_PRODUCAO_TURNO ?? null,
    tempo_parada_turno:   di.TEMPO_PARADA_TURNO   ?? null,
    tempo_boas_turno:     di.TEMPO_BOAS_TURNO     ?? null,
    atualizacao_codi:    tsAtualizacao ?? null,
    atualizado_em:       new Date().toISOString(),
  }, { onConflict: 'maquina_id' });
}

function processarMsgWS(raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }
  const { command, data } = msg;

  if ((command === 'CONNECT' || command === 'FILTER') && data) {
    let inner;
    try { inner = JSON.parse(data); } catch { return; }
    if (inner.atualizacao) ultimaAtualizacao = inner.atualizacao;
    for (const maq of inner.data ?? []) upsertStatus(maq, inner.atualizacao).catch(console.error);
  }

  if (command === 'UPDATE' && data) {
    let upd;
    try { upd = JSON.parse(data); } catch { return; }
    const id = String(upd.codigoRecursoConjunto);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        labelRecursoUsuario: CODI_WS_LABEL,
        panelType: 'moderno',
        command: 'FILTER',
        filter: {
          codigosRecursoConjunto: [id],
          paradasCenario: PARADAS_CENARIO,
          ultimaAtualizacao: String(ultimaAtualizacao),
        },
      }));
    }
  }
}

function wsSend(payload) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

async function conectarWS() {
  if (wsConectando) return;
  wsConectando = true;

  try {
    if (!jsessionid) {
      if (CODI_JSESSIONID) {
        jsessionid = CODI_JSESSIONID;
        console.log(`[ws-auth] Usando JSESSIONID do .env (${jsessionid.substring(0, 8)}…)`);
      } else {
        await loginAction();
      }
    }
  } catch (e) {
    console.error('[ws-auth] Login falhou:', e.message, '— tentando em 60s');
    jsessionid = null;
    wsConectando = false;
    setTimeout(conectarWS, 60_000);
    return;
  }

  const wsUrl = CODI_ACTION_URL
    .replace(/^http:/, 'ws:')
    .replace(/^https:/, 'wss:') + '/monitorRecurso/webSocket';

  ws = new WebSocket(wsUrl, {
    headers: {
      'Cookie':     `org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=pt-BR; JSESSIONID=${jsessionid}`,
      'User-Agent': 'codi-coletor/2.0',
    },
  });

  ws.on('open', () => {
    wsConectando = false;
    console.log('[ws] Conectado →', wsUrl);
    ultimaAtualizacao = 0;
    wsSend({
      labelRecursoUsuario: CODI_WS_LABEL,
      panelType: 'moderno',
      command: 'CONNECT',
      filter: {
        codigosRecursoConjunto: MAQUINAS_IDS,
        paradasCenario: PARADAS_CENARIO,
        ultimaAtualizacao: 0,
      },
    });
    setSyncState('ws_status', true, 'Conectado').catch(() => {});
  });

  ws.on('message', data => processarMsgWS(data.toString()));

  ws.on('close', (code, reason) => {
    wsConectando = false;
    jsessionid = null; // força novo login ou re-leitura do .env não acontece; próxima tentativa usa loginAction()
    console.warn(`[ws] Desconectado (${code}). Reconectando em 30s…`);
    setSyncState('ws_status', false, `Desconectado ${code}`).catch(() => {});
    setTimeout(conectarWS, 30_000);
  });

  ws.on('error', err => {
    console.error('[ws] Erro:', err.message);
    setSyncState('ws_status', false, err.message).catch(() => {});
  });
}

// ─── REST: OFs ────────────────────────────────────────────────

async function syncOfs() {
  const items = await codiGetAll('productionOrder', { status: 'STARTED' });
  const rows = items.map(o => ({
    id:                o.id,
    code:              o.code              ?? null,
    item_id:           o.item?.id          ?? null,
    item_code:         o.item?.code        ?? null,
    item_name:         o.item?.name        ?? null,
    item_context:      o.item?.context     ?? null,
    item_measure_unit: o.item?.measureUnit?.name ?? null,
    status:            o.status            ?? 'STARTED',
    quantity:          o.quantity          ?? null,
    note:              o.note              ?? null,
    codi_version:      o.version ? new Date(o.version).toISOString() : null,
    atualizado_em:     new Date().toISOString(),
  }));
  const { error } = await sb.from('ofs').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  console.log(`[ofs] ${rows.length} upserted`);
}

// ─── REST: Máquinas e grupos ──────────────────────────────────

async function syncMaquinas() {
  const items = await codiGetAll('productiveResource');
  const rows = items.map(m => ({
    id:                 m.id,
    name:               m.name                ?? null,
    establishment_name: m.establishment?.name ?? null,
    name_fixed_assets:  m.nameFixedAssets     ?? null,
    description:        m.description         ?? null,
    observation:        m.observation         ?? null,
    active_system:      m.activeSystem        ?? true,
    active_monitor:     m.activeMonitor       ?? false,
    manual_report:      m.manualReport        ?? false,
    codi_version:       m.version ? new Date(m.version).toISOString() : null,
    atualizado_em:      new Date().toISOString(),
  }));
  const { error } = await sb.from('maquinas').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  console.log(`[maquinas] ${rows.length} upserted`);
}

async function syncGrupos() {
  const resp  = await codiGet('productiveResourceGroup', { pageSize: 500, page: 1 });
  const grupos = resp.data ?? [];
  const grupoRows = grupos.map(g => ({ id: g.id, name: g.name ?? null, atualizado_em: new Date().toISOString() }));
  const { error: eg } = await sb.from('grupos_maquina').upsert(grupoRows, { onConflict: 'id' });
  if (eg) throw eg;

  const links = grupos.flatMap(g =>
    (g.productiveResources ?? []).map(r => ({ maquina_id: r.id, grupo_id: g.id }))
  );
  await sb.from('maquinas_grupos').delete().gte('grupo_id', 0);
  if (links.length) {
    const { error: el } = await sb.from('maquinas_grupos').insert(links);
    if (el) throw el;
  }
  console.log(`[grupos] ${grupoRows.length} grupos, ${links.length} vínculos`);
}

// ─── Sync state ───────────────────────────────────────────────

async function setSyncState(recurso, ok, mensagem = null) {
  await sb.from('sync_state').upsert(
    { recurso, ultimo_sync: new Date().toISOString(), ok, mensagem },
    { onConflict: 'recurso' }
  );
}

// Converte valor numérico do CODI para 1 casa decimal segura (null se Infinity/NaN)
function safeNum(v) { if (v == null) return null; const n = +parseFloat(v).toFixed(1); return isFinite(n) ? n : null; }

// ─── REST: Detalhe por máquina (OEE + produção/hora) ──────────
// Endpoint real: GET /apis/codi-glue/chart/mobileApp
// Response: { data: [{ oeeTotal, oeeByPeriod, shiftStart, shiftEnd, ordemMultiplaAtual }] }

async function pollDetalheMaquina(maqId) {
  const hoje = new Date().toISOString().slice(0, 10);

  let chartData = null;
  try {
    const resp = await codiGet('chart/mobileApp', {
      idProductiveResources: maqId,
      daysQty:           0,
      consolidatedData:  false,
      downtimesQty:      5,
      currentShift:      true,
      previousShift:     false,
    });
    chartData = resp?.data?.[0] ?? null;
  } catch (e) {
    console.warn(`[detalhe] chart/mobileApp ${maqId}:`, e.message);
  }

  if (!chartData) return;

  const oee      = chartData.oeeTotal;
  const periodos = chartData.oeeByPeriod ?? [];
  const ordem    = chartData.ordemMultiplaAtual ?? null;

  // producao_hora: CODI retorna datas em UTC; converte para Brasília (UTC-3)
  const horaRows = periodos
    .filter(p => p.qty > 0)
    .map(p => ({
      maquina_id:        parseInt(maqId),
      turno_data:        hoje,
      hora:              (parseInt(p.date.substring(11, 13), 10) - 3 + 24) % 24,
      quantidade:        p.qty,
      performance_media: safeNum(p.perf),
      meta_ppm:          null, // não vem neste endpoint
    }));

  await sb.from('producao_hora').delete()
    .eq('maquina_id', parseInt(maqId))
    .eq('turno_data', hoje);
  if (horaRows.length) {
    const { error } = await sb.from('producao_hora').insert(horaRows);
    if (error) console.error(`[detalhe] insert producao_hora ${maqId}:`, error.message);
  }

  // maquinas_detalhe: snapshot do turno
  const detalhe = {
    maquina_id:     parseInt(maqId),
    producao_turno: oee?.qty           ?? null,
    boas:           oee?.qty           ?? null,
    oee:            safeNum(oee?.oee),
    disponibilidade:safeNum(oee?.disp),
    performance:    safeNum(oee?.perf),
    qualidade:      safeNum(oee?.qual),
    turno_data:     hoje,
    turno_inicio:   chartData.shiftStart ?? null,
    turno_fim:      chartData.shiftEnd   ?? null,
    atualizado_em:  new Date().toISOString(),
  };

  // ordemMultiplaAtual — preenchido quando há OF ativa na máquina
  if (ordem) {
    detalhe.of_numero     = ordem.orderCode      ?? ordem.code        ?? null;
    detalhe.of_operacao   = ordem.operationCode  ?? ordem.operation   ?? null;
    detalhe.item_name     = ordem.itemName        ?? ordem.item?.name  ?? null;
    detalhe.item_code     = ordem.itemCode        ?? ordem.item?.code  ?? null;
    detalhe.operador_nome = ordem.employeeName    ?? ordem.employee?.name ?? null;
    detalhe.tempo_item_min= ordem.itemTime        ?? ordem.cycleTime   ?? null;
    detalhe.total_previsto= ordem.plannedQuantity ?? ordem.quantity    ?? null;
  }

  const { error } = await sb.from('maquinas_detalhe').upsert(detalhe, { onConflict: 'maquina_id' });
  if (error) console.error(`[detalhe] upsert ${maqId}:`, error.message);
}

async function pollDetalhe() {
  for (const id of MAQUINAS_IDS) {
    await pollDetalheMaquina(id);
    await new Promise(r => setTimeout(r, 200));
  }
  await setSyncState('detalhe', true);
  console.log(`[detalhe] ${MAQUINAS_IDS.length} máquinas atualizadas`);
}

// ─── Helpers de data ─────────────────────────────────────────

function dataHA(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function parseBRDate(str) {
  if (!str) return null;
  const [d, m, y] = str.split('/');
  return (d && m && y) ? `${y}-${m}-${d}` : null;
}

// ─── API Industrial (Forwood via CODI) ────────────────────────
// Usa POST (GET com body é rejeitado por Node 18+); autenticação via ApiToken no body.

function industrialPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    if (!INDUSTRIAL_BASE || !INDUSTRIAL_TOKEN) {
      resolve(null);
      return;
    }
    const payload = JSON.stringify({ ApiToken: INDUSTRIAL_TOKEN, ...body });
    const url = new URL(`${INDUSTRIAL_BASE}/Core/${endpoint}`);
    const req = http.request({
      hostname: url.hostname,
      port:     parseInt(url.port || '80', 10),
      method:   'POST',
      path:     url.pathname,
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30_000, () => { req.destroy(); reject(new Error('industrial timeout')); });
    req.write(payload);
    req.end();
  });
}

async function syncProdutos() {
  const data = await industrialPost('API_Produto/ConsultarProduto', {
    Produto: [{ Codigo: '', DataAlteracao: '01/01/2020' }],
  });
  // Resposta: { CodigoRetorno, Produto: [...] } ou array direto
  const lista = Array.isArray(data) ? data : (data?.Produto ?? null);
  if (!Array.isArray(lista)) {
    console.warn('[industrial] syncProdutos: resposta inválida', JSON.stringify(data)?.slice(0, 200));
    return 0;
  }
  const rows = lista.map(p => ({
    codigo:             String(p.Codigo ?? ''),
    nome:               p.Nome            ?? null,
    grupo_codigo:       p.GrupoProduto    ?? null,
    grupo_descricao:    p.GrupoDescricao  ?? null,
    subgrupo_codigo:    p.SubgrupoProduto ?? null,
    subgrupo_descricao: p.SubgrupoDescricao ?? null,
    unidade_medida:     p.UnidadeMedida   ?? null,
    tipo_material:      p.TipoMaterial    ?? null,
    fantasma:           p.Fantasma        ?? null,
    status:             p.Status          ?? null,
    atualizado_em:      new Date().toISOString(),
  })).filter(r => r.codigo);

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('produtos').upsert(rows.slice(i, i + 500), { onConflict: 'codigo' });
    if (error) throw error;
  }
  console.log(`[industrial] syncProdutos: ${rows.length} produtos`);
  return rows.length;
}

async function syncBomProdutos() {
  // Sincroniza BOMs de PRODUTO ACABADO e CONJUNTO (grupos com estrutura navegável)
  const { data: pais, error } = await sb.from('produtos')
    .select('codigo')
    .in('grupo_descricao', ['PRODUTO ACABADO', 'CONJUNTO'])
    .eq('status', 'A');
  if (error || !pais?.length) {
    console.warn('[industrial] syncBomProdutos: sem produtos acabados para sincronizar');
    return;
  }

  let ok = 0, falha = 0;
  for (const pai of pais) {
    try {
      const data = await industrialPost('API_Produto/ConsultaEstruturaProduto', {
        DataEstrutura: '01/01/2020',
        CodigoPai:     pai.codigo,
      });
      // Resposta: { CodigoRetorno, Estrutura: [...] } ou array direto
      const lista = Array.isArray(data) ? data : (data?.Estrutura ?? null);
      if (!Array.isArray(lista) || !lista.length) {
        await new Promise(r => setTimeout(r, 100));
        continue;
      }

      const rows = lista.map((e, i) => ({
        produto_raiz:  pai.codigo,
        codigo_pai:    String(e.CodigoPai   ?? ''),
        codigo_filho:  String(e.CodigoFilho ?? ''),
        nivel:         e.Nivel      ?? null,
        quantidade:    e.Quantidade ?? null,
        contador:      e.Contador   ?? i,   // fallback: índice da posição
        fantasma:      e.Fantasma   ?? null,
        atualizado_em: new Date().toISOString(),
      })).filter(r => r.codigo_pai && r.codigo_filho);

      // Substitui a BOM do produto por completo
      await sb.from('bom_estrutura').delete().eq('produto_raiz', pai.codigo);
      if (rows.length) {
        const { error: ie } = await sb.from('bom_estrutura').insert(rows);
        if (ie) console.error(`[industrial] bom insert ${pai.codigo}:`, ie.message);
      }
      ok++;
    } catch (e) {
      console.warn(`[industrial] bom ${pai.codigo}:`, e.message);
      falha++;
    }
    await new Promise(r => setTimeout(r, 200)); // ~5 req/s — gentil com o Tomcat
  }
  console.log(`[industrial] syncBomProdutos: ${ok} ok, ${falha} falha (de ${pais.length})`);
}

// ─── Lotes de producao (API Industrial) ───────────────────────

function industrialPostLongo(endpoint, body) {
  return new Promise((resolve, reject) => {
    if (!INDUSTRIAL_BASE || !INDUSTRIAL_TOKEN) { resolve(null); return; }
    const payload = JSON.stringify({ ApiToken: INDUSTRIAL_TOKEN, ...body });
    const url = new URL(`${INDUSTRIAL_BASE}/Core/${endpoint}`);
    const req = http.request({
      hostname: url.hostname,
      port:     parseInt(url.port || '80', 10),
      method:   'POST',
      path:     url.pathname,
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10 * 60_000, () => { req.destroy(); reject(new Error('lotes timeout 10min')); });
    req.write(payload);
    req.end();
  });
}

async function syncLotes() {
  if (!INDUSTRIAL_BASE || !INDUSTRIAL_TOKEN) return;
  const data = await industrialPostLongo('API_OrdemFabricacao/ListarOrdemFabricacao', {
    DataAlteracao: dataHA(30), Ordem: 0, Produto: '', Tipo: 'OF',
    Deposito: 0, Lote: '', OrdemEncerrada: 'S', IndustrializacaoTerceiros: '', EstruturaProduto: 'N',
  });
  const ofs = Array.isArray(data) ? data : [];
  const comLote = ofs.filter(o => o.Lote?.trim());

  const lotesMap = new Map();
  for (const o of comLote) {
    const n = o.Lote.trim();
    if (!lotesMap.has(n)) lotesMap.set(n, { numero: n, data_previsao: null, total_ofs: 0 });
    const l = lotesMap.get(n);
    l.total_ofs++;
    const dp = parseBRDate(o.DataPrevisao);
    if (dp && (!l.data_previsao || dp > l.data_previsao)) l.data_previsao = dp;
  }
  const lotes = [...lotesMap.values()];
  const BATCH = 100;
  for (let i = 0; i < lotes.length; i += BATCH) {
    const { error } = await sb.from('lotes').upsert(lotes.slice(i, i + BATCH), { onConflict: 'numero' });
    if (error) throw error;
  }
  const ofRows = comLote.map(o => ({
    ordem:                parseInt(o.Ordem),
    lote:                 o.Lote.trim(),
    produto:              o.Produto         || null,
    nome_produto:         o.NomeProduto     || null,
    quantidade:           parseFloat(o.Quantidade)         || 0,
    quantidade_produzida: parseFloat(o.QuantidadeProduzida) || 0,
    status:               o.Status          || null,
    data_previsao:        parseBRDate(o.DataPrevisao),
    data_alteracao:       parseBRDate(o.DataAlteracao),
    deposito:             parseInt(o.Deposito) || 1,
  }));
  for (let i = 0; i < ofRows.length; i += BATCH) {
    const { error } = await sb.from('of_por_lote').upsert(ofRows.slice(i, i + BATCH), { onConflict: 'ordem' });
    if (error) throw error;
  }
  console.log(`[lotes] ${lotes.length} lotes, ${ofRows.length} OFs`);
}

async function cicloIndustrial() {
  if (!INDUSTRIAL_BASE || !INDUSTRIAL_TOKEN) return;
  try {
    await syncProdutos();
    await setSyncState('produtos', true);
  } catch (e) {
    console.error('[produtos]', e.message);
    await setSyncState('produtos', false, e.message);
    return; // BOM depende de produtos — aborta
  }
  try {
    await syncBomProdutos();
    await setSyncState('bom', true);
  } catch (e) {
    console.error('[bom]', e.message);
    await setSyncState('bom', false, e.message);
  }
}

// ─── Ciclo rápido (1 min): só qty + KPIs, sem producao_hora ───
// Mantém o número de peças quase em tempo real sem custo do delete+insert de horas

let rapidoRodando = false;

async function cicloRapido() {
  if (rapidoRodando) return; // evita sobreposição se demorar
  rapidoRodando = true;
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    for (const maqId of MAQUINAS_IDS) {
      try {
        const resp = await codiGet('chart/mobileApp', {
          idProductiveResources: maqId,
          daysQty:          0,
          consolidatedData: false,
          downtimesQty:     0,
          currentShift:     true,
          previousShift:    false,
        });
        const oee = resp?.data?.[0]?.oeeTotal;
        if (!oee) continue;
        await sb.from('maquinas_detalhe').upsert({
          maquina_id:      parseInt(maqId),
          producao_turno:  oee.qty  ?? null,
          boas:            oee.qty  ?? null,
          oee:             safeNum(oee.oee),
          disponibilidade: safeNum(oee.disp),
          performance:     safeNum(oee.perf),
          qualidade:       safeNum(oee.qual),
          turno_data:      hoje,
          atualizado_em:   new Date().toISOString(),
        }, { onConflict: 'maquina_id' });
      } catch (e) {
        // silencioso — o ciclo completo (5 min) resgata
      }
      await new Promise(r => setTimeout(r, 150));
    }
  } finally {
    rapidoRodando = false;
  }
}

// ─── Ciclo REST (5 min): completo (OFs + hora graph + detalhe completo) ──

let cicloNum = 0;

async function cicloREST() {
  cicloNum++;
  console.log(`\n[ciclo ${cicloNum}] ${new Date().toISOString()}`);

  try { await syncOfs(); await setSyncState('ofs', true); }
  catch (e) { console.error('[ofs]', e.message); await setSyncState('ofs', false, e.message); }

  try { await pollDetalhe(); }
  catch (e) { console.error('[detalhe]', e.message); await setSyncState('detalhe', false, e.message); }

  // Lotes: a cada hora (12 ciclos de 5 min)
  if (cicloNum === 1 || cicloNum % 12 === 0) {
    syncLotes()
      .then(() => setSyncState('lotes', true))
      .catch(e => { console.error('[lotes]', e.message); setSyncState('lotes', false, e.message); });
  }

  if (cicloNum === 1 || cicloNum % 288 === 0) {
    try { await syncMaquinas(); await setSyncState('maquinas', true); }
    catch (e) { console.error('[maquinas]', e.message); await setSyncState('maquinas', false, e.message); }
    try { await syncGrupos(); await setSyncState('grupos', true); }
    catch (e) { console.error('[grupos]', e.message); await setSyncState('grupos', false, e.message); }
    // Produtos + BOM (API Industrial) — só roda se CODI_INDUSTRIAL_URL estiver configurado
    cicloIndustrial().catch(e => console.error('[industrial]', e.message));
  }
}

// ─── Start ────────────────────────────────────────────────────

console.log(`[CODI] Coletor v2 iniciado — REST: ${CODI_BASE} | WS: ${CODI_ACTION_URL}`);
conectarWS();
cicloREST().catch(console.error);
setInterval(() => cicloREST().catch(console.error), INTERVALO);

// Ciclo rápido: atualiza produção a cada 1 minuto (começa após 60s para não colidir com o ciclo inicial)
setTimeout(() => {
  cicloRapido().catch(console.error);
  setInterval(() => cicloRapido().catch(console.error), 60_000);
}, 60_000);
