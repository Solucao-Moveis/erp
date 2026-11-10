/**
 * Contagem de peças por hora (CODI → Supabase), processo dedicado
 * ─────────────────────────────────────────────────────────────
 * Separado do coletor principal (index.js): login, token e arquivos próprios.
 * Se um cair, o outro segue.
 *
 * A cada 1 min lê, das máquinas do setor (fabrill.machines.codi_maquina_id),
 * as peças por hora das últimas 24h e grava em codi.contagem_hora.
 * Na partida, depois de qualquer falha e a cada hora, relê 7 dias
 * (histórico do CODI) e completa o que faltou.
 *
 * Proteções:
 *   - chave do CODI lida do próprio site (environment.json): se o CODI trocar,
 *     segue sozinho; refresh_token → password grant → relê a chave.
 *   - Supabase fora: guarda em .contagem-pendente.json e envia na volta.
 *   - batimento em codi.contagem_saude (o Hora a Hora avisa se ficar velho).
 *   - vigia: ciclo travado por 3 min → sai e o PM2 sobe de novo.
 *
 * Uso:  pm2 start contagem-metalurgia.mjs --name codi-contagem
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE    = join(__dir, '.token-contagem');
const PENDENTE_FILE = join(__dir, '.contagem-pendente.json');
const MAQUINAS_FILE = join(__dir, '.contagem-maquinas.json');

// ─── Config ───────────────────────────────────────────────────

const SETOR    = process.env.CONTAGEM_SETOR || 'Metalurgia';
const PROCESSO = `contagem-${SETOR.toLowerCase()}`;
const CODI_ORIGIN = new URL(process.env.CODI_BASE_URL || 'http://192.168.2.210:8080').origin;
const CODI_GLUE   = `${CODI_ORIGIN}/apis/codi-glue`;
const CODI_TOKEN  = `${CODI_ORIGIN}/auth/token`;
const CODI_ENV    = `${CODI_ORIGIN}/coletor-web/pt/assets/environment/environment.json`;
const CODI_USER    = process.env.CODI_WS_USER || '';
const CODI_PASS    = process.env.CODI_WS_PASS || '';
const CODI_COMPANY    = process.env.CODI_COMPANY    || 'somvsomvpo';
const CODI_COMPANY_ID = process.env.CODI_COMPANY_ID || '1';
const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const CICLO_MS        = 60_000;
const RELEITURA_MS    = 60 * 60_000;  // relê 7 dias a cada hora
const VIGIA_MS        = 10 * 60_000;  // ciclo rodando há 10 min = travado
const FETCH_TIMEOUT   = 20_000;
const UTC_OFFSET_H    = -3;           // Brasília (sem horário de verão desde 2019)
// Horas do expediente: gravadas mesmo com 0 (para uma correção do CODI zerar a hora)
const HORA_INI = 6, HORA_FIM = 20;

if (!CODI_USER || !CODI_PASS || !SB_URL || !SB_KEY) {
  console.error('[contagem] Variáveis de ambiente faltando. Verifique o .env');
  process.exit(1);
}

const sbCodi    = createClient(SB_URL, SB_KEY, { db: { schema: 'codi' } });
const sbFabrill = createClient(SB_URL, SB_KEY, { db: { schema: 'fabrill' } });

const log  = (...a) => console.log(new Date().toISOString(), ...a);
const warn = (...a) => console.warn(new Date().toISOString(), ...a);

async function fetchT(url, opts = {}) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
}

// ─── Login no CODI ────────────────────────────────────────────

let clientId = process.env.CODI_CONTAGEM_CLIENT_ID || null;
let accessToken = null;
let tokenExpiry = 0;

async function lerClientId() {
  const res = await fetchT(CODI_ENV);
  if (!res.ok) throw new Error(`environment.json → ${res.status}`);
  const env = await res.json();
  if (!env.authorizeClientId) throw new Error('environment.json sem authorizeClientId');
  if (env.authorizeClientId !== clientId) log('[auth] chave do CODI lida do site');
  clientId = env.authorizeClientId;
}

function guardarToken(data) {
  accessToken = data.access_token;
  tokenExpiry = Date.now() + ((data.expires_in ?? 3600) - 300) * 1000;
  if (data.refresh_token) writeFileSync(TOKEN_FILE, data.refresh_token, 'utf8');
}

async function pedirToken(body) {
  const res = await fetchT(CODI_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, ...body }),
  });
  if (!res.ok) throw new Error(`token ${body.grant_type} ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return res.json();
}

async function login() {
  if (!clientId) await lerClientId();
  // 1) refresh_token
  if (existsSync(TOKEN_FILE)) {
    try {
      guardarToken(await pedirToken({ grant_type: 'refresh_token', refresh_token: readFileSync(TOKEN_FILE, 'utf8').trim() }));
      return;
    } catch (e) { warn('[auth] refresh falhou:', e.message); }
  }
  // 2) usuário e senha; 3) se a chave foi trocada no CODI, relê e tenta de novo
  const senha = { grant_type: 'password', username: CODI_USER, password: CODI_PASS, company: CODI_COMPANY, companyId: CODI_COMPANY_ID };
  try {
    guardarToken(await pedirToken(senha));
  } catch (e) {
    warn('[auth] senha falhou, relendo a chave do CODI:', e.message);
    await lerClientId();
    guardarToken(await pedirToken(senha));
  }
  log('[auth] login feito');
}

async function codiGet(endpoint, params) {
  if (!accessToken || Date.now() >= tokenExpiry) await login();
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const url = new URL(`${CODI_GLUE}/${endpoint}`);
    url.searchParams.set('access_token', accessToken);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const res = await fetchT(url);
    if (res.status === 401 && tentativa === 0) { accessToken = null; await login(); continue; }
    if (!res.ok) throw new Error(`CODI ${endpoint} → ${res.status}`);
    return res.json();
  }
}

// ─── Máquinas do setor ────────────────────────────────────────

let maquinas = [];        // [{ codi_id, nome }]
let maquinasLidasEm = 0;

async function carregarMaquinas() {
  if (maquinas.length && Date.now() - maquinasLidasEm < 10 * 60_000) return;
  try {
    const { data: area, error: ea } = await sbFabrill.from('areas').select('id').eq('name', SETOR).maybeSingle();
    if (ea || !area) throw new Error(ea?.message ?? `setor ${SETOR} não encontrado`);
    const { data, error } = await sbFabrill.from('machines')
      .select('name, codi_maquina_id').eq('area_id', area.id).not('codi_maquina_id', 'is', null);
    if (error) throw error;
    maquinas = data.map(m => ({ codi_id: m.codi_maquina_id, nome: m.name }));
    writeFileSync(MAQUINAS_FILE, JSON.stringify(maquinas), 'utf8');
  } catch (e) {
    // Supabase fora: segue com a última lista conhecida
    if (!maquinas.length && existsSync(MAQUINAS_FILE)) maquinas = JSON.parse(readFileSync(MAQUINAS_FILE, 'utf8'));
    if (!maquinas.length) throw new Error(`sem lista de máquinas: ${e.message}`);
    warn('[maquinas] usando lista guardada:', e.message);
  }
  maquinasLidasEm = Date.now();
}

// ─── Leitura do CODI → linhas por hora ────────────────────────

/** "2026-11-10T13:00..." (UTC) → { dia, hora } em Brasília */
function paraLocal(dataCodi) {
  const utc = new Date(dataCodi.slice(0, 19) + 'Z');
  const local = new Date(utc.getTime() + UTC_OFFSET_H * 3600e3);
  return { dia: local.toISOString().slice(0, 10), hora: local.getUTCHours() };
}

async function lerPeriodos(codiId, seteDias) {
  const resp = await codiGet('chart/mobileApp', {
    idProductiveResources: codiId,
    daysQty:          seteDias ? 7 : 0,
    consolidatedData: seteDias,
    downtimesQty:     0,
    currentShift:     false,
    previousShift:    false,
  });
  const item = resp?.data?.[0];
  if (!item || !Array.isArray(item.oeeByPeriod)) throw new Error('resposta sem oeeByPeriod');
  const horas = new Map(); // "dia|hora" → qtd
  for (const p of item.oeeByPeriod) {
    if (!p?.date) continue;
    const { dia, hora } = paraLocal(p.date);
    const qtd = Math.max(0, Math.round(Number(p.qty) || 0));
    horas.set(`${dia}|${hora}`, qtd);
  }
  return horas;
}

/** Hora muito acima do normal da máquina: grava, mas marca para conferir. */
const tipicoPorMaquina = new Map();
function atualizarTipico(codiId, horas) {
  const v = [...horas.values()].filter(q => q > 0).sort((a, b) => a - b);
  if (v.length >= 5) tipicoPorMaquina.set(codiId, v[Math.floor(v.length / 2)]);
}

async function lerMaquina(codiId, seteDias) {
  // Hora em andamento vem da leitura ao vivo (a consolidada atrasa um pouco)
  const vivo = await lerPeriodos(codiId, false);
  let horas = vivo;
  if (seteDias) {
    horas = await lerPeriodos(codiId, true);
    atualizarTipico(codiId, horas);
    for (const [k, q] of vivo) horas.set(k, q);
  }
  const tipico = tipicoPorMaquina.get(codiId);
  const linhas = [];
  for (const [k, quantidade] of horas) {
    const [dia, h] = k.split('|');
    const hora = Number(h);
    if (quantidade === 0 && (hora < HORA_INI || hora > HORA_FIM)) continue;
    linhas.push({
      maquina_id: codiId, dia, hora, quantidade,
      suspeito: !!tipico && quantidade > tipico * 3,
    });
  }
  return linhas;
}

// ─── Gravação (com fila local se o Supabase cair) ─────────────

const gravado = new Map();  // chave → quantidade já gravada (evita regravar igual)
let pendente = new Map();   // chave → linha ainda não enviada
const chave = l => `${l.maquina_id}|${l.dia}|${l.hora}`;

if (existsSync(PENDENTE_FILE)) {
  try {
    for (const l of JSON.parse(readFileSync(PENDENTE_FILE, 'utf8'))) pendente.set(chave(l), l);
    if (pendente.size) log(`[fila] ${pendente.size} horas pendentes de envio`);
  } catch (e) { warn('[fila] arquivo pendente ilegível, ignorado:', e.message); }
}

function salvarPendente() {
  const tmp = PENDENTE_FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify([...pendente.values()]), 'utf8');
  renameSync(tmp, PENDENTE_FILE);
}

async function gravar(linhas) {
  for (const l of linhas) {
    const g = gravado.get(chave(l));
    if (!g || g.quantidade !== l.quantidade || g.suspeito !== l.suspeito) pendente.set(chave(l), l);
  }
  if (!pendente.size) return 0;
  const lote = [...pendente.values()].map(l => ({ ...l, lido_em: new Date().toISOString() }));
  try {
    for (let i = 0; i < lote.length; i += 500) {
      const { error } = await sbCodi.from('contagem_hora')
        .upsert(lote.slice(i, i + 500), { onConflict: 'maquina_id,dia,hora' });
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    salvarPendente();
    throw new Error(`Supabase: ${e.message} (${pendente.size} horas na fila)`);
  }
  for (const l of lote) gravado.set(chave(l), { quantidade: l.quantidade, suspeito: l.suspeito });
  pendente = new Map();
  if (existsSync(PENDENTE_FILE)) salvarPendente();
  return lote.length;
}

// ─── Batimento ────────────────────────────────────────────────

const estado = {}; // codi_id → { nome, ok, erro, ultimo_ok }
let ultimoOkGeral = null;

async function bater(mensagem, erro) {
  const agora = new Date().toISOString();
  const { error } = await sbCodi.from('contagem_saude').upsert({
    processo: PROCESSO,
    ultimo_ok: ultimoOkGeral,
    ...(erro ? { ultimo_erro: agora } : {}),
    mensagem,
    maquinas: estado,
    atualizado_em: agora,
  }, { onConflict: 'processo' });
  if (error) warn('[saude]', error.message);
}

// ─── Ciclo ────────────────────────────────────────────────────

let rodando = false;
let inicioCiclo = 0;
let ultimaReleitura = 0;
let precisaReler = true;  // partida sempre relê 7 dias

async function ciclo() {
  if (rodando) return;
  rodando = true;
  inicioCiclo = Date.now();
  const erros = [];
  try {
    await carregarMaquinas();
    const seteDias = precisaReler || Date.now() - ultimaReleitura >= RELEITURA_MS;
    const linhas = [];
    for (const m of maquinas) {
      try {
        linhas.push(...await lerMaquina(m.codi_id, seteDias));
        estado[m.codi_id] = { nome: m.nome, ok: true, erro: null, ultimo_ok: new Date().toISOString() };
      } catch (e) {
        erros.push(`${m.nome}: ${e.message}`);
        estado[m.codi_id] = { ...estado[m.codi_id], nome: m.nome, ok: false, erro: e.message };
      }
    }
    if (!erros.length) {
      ultimoOkGeral = new Date().toISOString();
      if (seteDias) { ultimaReleitura = Date.now(); precisaReler = false; }
    } else {
      precisaReler = true;  // na volta, completa o que faltou
    }
    // Falha no Supabase não pede releitura: o que foi lido já está na fila
    let n = 0;
    try { n = await gravar(linhas); } catch (e) { erros.push(e.message); }
    if (n || seteDias || erros.length) log(`[ciclo] ${seteDias ? '7 dias' : 'ao vivo'} · ${n} horas gravadas${erros.length ? ` · ${erros.length} erro(s)` : ''}`);
    if (erros.length) warn('[ciclo]', erros.join(' | '));
    await bater(erros.length ? erros.join(' | ').slice(0, 1000) : 'ok', erros.length > 0);
  } catch (e) {
    precisaReler = true;
    warn('[ciclo] falhou:', e.message);
    await bater(e.message.slice(0, 1000), true).catch(() => {});
  } finally {
    rodando = false;
  }
}

// Vigia: se um ciclo travar, sai para o PM2 subir de novo
setInterval(() => {
  if (rodando && Date.now() - inicioCiclo > VIGIA_MS) {
    console.error(new Date().toISOString(), '[vigia] ciclo travado há mais de 10 min, reiniciando');
    process.exit(1);
  }
}, 30_000);

process.on('unhandledRejection', e => { console.error('[contagem] erro não tratado:', e); process.exit(1); });

log(`[contagem] iniciando · setor ${SETOR} · ciclo ${CICLO_MS / 1000}s`);
ciclo();
setInterval(ciclo, CICLO_MS);
