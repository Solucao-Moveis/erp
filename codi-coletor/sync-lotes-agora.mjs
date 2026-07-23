/**
 * Roda o sync de lotes UMA VEZ agora, sem depender do ciclo do coletor.
 * Uso: node sync-lotes-agora.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import http from 'http';

const INDUSTRIAL_BASE  = (process.env.CODI_INDUSTRIAL_URL || '').replace(/\/$/, '');
const INDUSTRIAL_TOKEN = process.env.CODI_INDUSTRIAL_TOKEN || '';
const SB_URL           = process.env.SUPABASE_URL || '';
const SB_KEY           = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!INDUSTRIAL_BASE || !INDUSTRIAL_TOKEN || !SB_URL || !SB_KEY) {
  console.error('Variáveis faltando no .env (CODI_INDUSTRIAL_URL, CODI_INDUSTRIAL_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const sb = createClient(SB_URL, SB_KEY, { db: { schema: 'codi' } });

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

function industrialPost(endpoint, body) {
  const url    = new URL(`${INDUSTRIAL_BASE}/${endpoint}`);
  const payload = JSON.stringify({ ...body, ApiToken: INDUSTRIAL_TOKEN });
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: url.hostname,
      port:     url.port || 80,
      path:     url.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', reject);
    req.setTimeout(15 * 60_000, () => { req.destroy(); reject(new Error('timeout 15min')); });
    req.write(payload);
    req.end();
  });
}

async function setSyncState(ok, mensagem = null) {
  await sb.from('sync_state').upsert(
    { recurso: 'lotes', ultimo_sync: new Date().toISOString(), ok, mensagem },
    { onConflict: 'recurso' }
  );
}

async function main() {
  console.log(`[lotes] Buscando OFs no Industrial (DataAlteracao >= ${dataHA(30)})...`);
  const data = await industrialPost('API_OrdemFabricacao/ListarOrdemFabricacao', {
    DataAlteracao: dataHA(30), Ordem: 0, Produto: '', Tipo: 'OF',
    Deposito: 0, Lote: '', OrdemEncerrada: 'S', IndustrializacaoTerceiros: '', EstruturaProduto: 'N',
  });

  console.log('[lotes] API raw:', typeof data, Array.isArray(data)
    ? `array[${data.length}]`
    : JSON.stringify(data)?.substring(0, 300));

  const ofs    = Array.isArray(data) ? data : [];
  const comLote = ofs.filter(o => o.Lote?.trim());
  console.log(`[lotes] ${ofs.length} OFs recebidas, ${comLote.length} com lote`);

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

  console.log(`[lotes] Upserting ${lotes.length} lotes...`);
  for (let i = 0; i < lotes.length; i += BATCH) {
    const { error } = await sb.from('lotes').upsert(lotes.slice(i, i + BATCH), { onConflict: 'numero' });
    if (error) throw error;
  }

  const ofRows = comLote.map(o => ({
    ordem:                parseInt(o.Ordem),
    lote:                 o.Lote.trim(),
    produto:              o.Produto         || null,
    nome_produto:         o.NomeProduto     || null,
    quantidade:           parseFloat(o.Quantidade)          || 0,
    quantidade_produzida: parseFloat(o.QuantidadeProduzida) || 0,
    status:               o.Status          || null,
    data_previsao:        parseBRDate(o.DataPrevisao),
    data_alteracao:       parseBRDate(o.DataAlteracao),
    deposito:             parseInt(o.Deposito) || 1,
  }));

  console.log(`[lotes] Upserting ${ofRows.length} OFs...`);
  for (let i = 0; i < ofRows.length; i += BATCH) {
    const { error } = await sb.from('of_por_lote').upsert(ofRows.slice(i, i + BATCH), { onConflict: 'ordem' });
    if (error) throw error;
  }

  await setSyncState(true);
  console.log(`[lotes] ✓ ${lotes.length} lotes e ${ofRows.length} OFs sincronizados.`);
}

main().catch(async e => {
  console.error('[lotes] ERRO:', e.message);
  await setSyncState(false, e.message).catch(() => {});
  process.exit(1);
});
