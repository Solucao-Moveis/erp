/**
 * Sincroniza lotes de producao e OFs do CODI para Supabase.
 * Uso: node sinc-lotes.mjs
 * Busca OFs dos ultimos 180 dias agrupadas por lote.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import http from 'http';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'codi' } }
);

const INDUSTRIAL_URL = process.env.CODI_INDUSTRIAL_URL;
const TOKEN = process.env.CODI_INDUSTRIAL_TOKEN;

function dataHA(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function parseBRDate(str) {
  if (!str) return null;
  const [d, m, y] = str.split('/');
  if (!d || !m || !y) return null;
  return `${y}-${m}-${d}`;
}

function httpPost(url, bodyObj) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(bodyObj);
    const u = new URL(url);
    const options = {
      hostname: u.hostname, port: u.port || 80, path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
      timeout: 5 * 60_000,  // 5 minutos
    };
    const req = http.request(options, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch (e) { reject(new Error('JSON parse error: ' + raw.slice(0, 200))); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout (5min)')); });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function fetchOFs(dataAlteracao) {
  const { status, data } = await httpPost(
    `${INDUSTRIAL_URL}/Core/API_OrdemFabricacao/ListarOrdemFabricacao`,
    { ApiToken: TOKEN, DataAlteracao: dataAlteracao, Ordem: 0, Produto: '', Tipo: 'OF',
      Deposito: 0, Lote: '', OrdemEncerrada: 'S', IndustrializacaoTerceiros: '', EstruturaProduto: 'N' }
  );
  if (status >= 400) throw new Error(`HTTP ${status}`);
  if (data?.error) throw new Error(JSON.stringify(data.error));
  return Array.isArray(data) ? data : [];
}

async function main() {
  console.log('Buscando OFs dos ultimos 30 dias...');
  const ofs = await fetchOFs(dataHA(30));
  console.log(`  ${ofs.length} OFs recebidas`);

  // Filtra so OFs com lote preenchido
  const comLote = ofs.filter(o => o.Lote && o.Lote.trim());
  console.log(`  ${comLote.length} OFs com lote`);

  // Agrupa por lote para montar a tabela lotes
  const lotesMap = new Map();
  for (const of_ of comLote) {
    const n = of_.Lote.trim();
    if (!lotesMap.has(n)) {
      lotesMap.set(n, { numero: n, data_previsao: null, total_ofs: 0 });
    }
    const l = lotesMap.get(n);
    l.total_ofs++;
    const dp = parseBRDate(of_.DataPrevisao);
    if (dp && (!l.data_previsao || dp > l.data_previsao)) {
      l.data_previsao = dp;
    }
  }

  const lotes = [...lotesMap.values()];
  console.log(`\nLotes unicos: ${lotes.length}`);

  // Upsert lotes em batches
  const BATCH = 100;
  let lotesOk = 0;
  for (let i = 0; i < lotes.length; i += BATCH) {
    const { error } = await sb.from('lotes').upsert(lotes.slice(i, i + BATCH), {
      onConflict: 'numero',
    });
    if (error) { console.error('  Erro lotes:', error.message); }
    else lotesOk += Math.min(BATCH, lotes.length - i);
  }
  console.log(`  Lotes upsertados: ${lotesOk}`);

  // Monta linhas de of_por_lote
  const ofRows = comLote.map(o => ({
    ordem:                parseInt(o.Ordem),
    lote:                 o.Lote.trim(),
    produto:              o.Produto || null,
    nome_produto:         o.NomeProduto || null,
    quantidade:           parseFloat(o.Quantidade) || 0,
    quantidade_produzida: parseFloat(o.QuantidadeProduzida) || 0,
    status:               o.Status || null,
    data_previsao:        parseBRDate(o.DataPrevisao),
    data_alteracao:       parseBRDate(o.DataAlteracao),
    deposito:             parseInt(o.Deposito) || 1,
  }));

  let ofOk = 0, ofErr = 0;
  for (let i = 0; i < ofRows.length; i += BATCH) {
    const { error } = await sb.from('of_por_lote').upsert(ofRows.slice(i, i + BATCH), {
      onConflict: 'ordem',
    });
    if (error) { console.error('  Erro of_por_lote:', error.message); ofErr += BATCH; }
    else ofOk += Math.min(BATCH, ofRows.length - i);
  }
  console.log(`  OFs upsertadas: ${ofOk}  erros: ${ofErr}`);
  console.log('\nSync concluido.');
}

main().catch(e => { console.error(e); process.exit(1); });
