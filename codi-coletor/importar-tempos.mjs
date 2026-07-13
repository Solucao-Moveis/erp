/**
 * Importa cronometragens da planilha PCP para codi.produto_tempos_maquina.
 *
 * Uso:
 *   npm install xlsx          (só na primeira vez)
 *   node importar-tempos.mjs  (roda na máquina local, não na fábrica)
 *
 * Variáveis de ambiente necessárias (em .env ou exportadas):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PLANILHA_PATH   (default: caminho relativo abaixo)
 */

import 'dotenv/config';
import { readFile, utils } from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PLANILHA = process.env.PLANILHA_PATH
  || path.join(__dirname, '..', 'TEMPOS COLETADOS planilha calculo (Guardado automaticamente).xlsx');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'codi' } }
);

// ─── Configuração das abas ────────────────────────────────────

// Abas com coluna "forwood" (decimal de hora por peça)
// codigoCol, maquinaCol, forWoodCol: índices 0-based no array de células da linha
// operacaoCol: índice da coluna operação (null = usar operacaoDefault)
const ABAS_FORWOOD = [
  { nome: 'CORTE',    codigoCol: 1, maquinaCol: 4, forWoodCol: 10, operacaoCol: 3, operacaoDefault: null },
  { nome: 'DOBRA',    codigoCol: 1, maquinaCol: 4, forWoodCol:  8, operacaoCol: 3, operacaoDefault: null },
  { nome: 'SOLDA',    codigoCol: 1, maquinaCol: 4, forWoodCol: 10, operacaoCol: 3, operacaoDefault: null },
  { nome: 'MARCENARIA', codigoCol: 1, maquinaCol: 4, forWoodCol: 10, operacaoCol: 3, operacaoDefault: null },
  // Montagem: código do COMPONENTE está em col D (3), não B (1)
  { nome: 'MOVIMENTAÇÕES MONTAGEM', codigoCol: 3, maquinaCol: null, maquinaFixed: 'MONTAGEM', forWoodCol: 11, operacaoCol: null, operacaoDefault: 'MONTAGEM' },
  { nome: 'MONTAGEM 2',             codigoCol: 3, maquinaCol: null, maquinaFixed: 'MONTAGEM', forWoodCol: 11, operacaoCol: null, operacaoDefault: 'MONTAGEM' },
];

// Abas com coluna "peças por hora" (taxa → tempo = 60 / taxa)
const ABAS_TAXA = [
  { nome: 'INSPEÇÃO',   codigoCol: 0, taxaCol: 3, maquinaFixed: 'INSPEÇÃO',   operacao: 'INSPEÇÃO' },
  { nome: 'TRATAMENTO', codigoCol: 1, taxaCol: 6, maquinaFixed: 'TRATAMENTO', operacao: 'TRATAMENTO' },
  { nome: 'PINTURA',    codigoCol: 1, taxaCol: 6, maquinaFixed: 'PINTURA',    operacao: 'PINTURA' },
  { nome: 'EMBALAGEM',  codigoCol: 1, taxaCol: 4, maquinaFixed: 'EMBALADEIRA',operacao: 'EMBALAGEM' },
];

// ─── Leitura da planilha ──────────────────────────────────────

function lerAba(wb, nomeAba) {
  const ws = wb.Sheets[nomeAba];
  if (!ws) { console.warn(`  ⚠ Aba "${nomeAba}" não encontrada — pulando`); return []; }
  // header: 1 = array de valores brutos por linha (sem converter para objeto)
  const rows = utils.sheet_to_json(ws, { header: 1, defval: null });
  return rows.slice(1); // pula linha 1 (cabeçalho está na linha 2 da planilha)
}

function strCodigo(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(/\s+/g, '');
  return s || null;
}

function parseForwood(v) {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  if (!isFinite(n) || n <= 0) return null;
  return n * 60; // horas → minutos
}

function parseTaxa(v) {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  if (!isFinite(n) || n <= 0) return null;
  return 60 / n; // peças/hora → minutos por peça
}

// ─── Coleta de medições ───────────────────────────────────────

function coletarForwood(wb, cfg) {
  const rows = lerAba(wb, cfg.nome);
  const medições = {}; // key: "codigo|maquina|operacao" → [tempo_min, ...]

  for (const row of rows) {
    const codigo = strCodigo(row[cfg.codigoCol]);
    if (!codigo) continue;

    const maquina = cfg.maquinaFixed
      || (cfg.maquinaCol != null ? String(row[cfg.maquinaCol] ?? '').trim() : null);
    if (!maquina) continue;

    const operacao = cfg.operacaoDefault
      || (cfg.operacaoCol != null ? String(row[cfg.operacaoCol] ?? '').trim() : '');

    const tempo = parseForwood(row[cfg.forWoodCol]);
    if (tempo == null) continue;

    const key = `${codigo}|${maquina}|${operacao}`;
    if (!medições[key]) medições[key] = { codigo, maquina, operacao, tempos: [] };
    medições[key].tempos.push(tempo);
  }

  return medições;
}

function coletarTaxa(wb, cfg) {
  const rows = lerAba(wb, cfg.nome);
  const medições = {};

  for (const row of rows) {
    const codigo = strCodigo(row[cfg.codigoCol]);
    if (!codigo) continue;

    const tempo = parseTaxa(row[cfg.taxaCol]);
    if (tempo == null) continue;

    const key = `${codigo}|${cfg.maquinaFixed}|${cfg.operacao}`;
    if (!medições[key]) medições[key] = { codigo, maquina: cfg.maquinaFixed, operacao: cfg.operacao, tempos: [] };
    medições[key].tempos.push(tempo);
  }

  return medições;
}

function media(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ─── Verificação de FK ────────────────────────────────────────

async function codigosExistentes() {
  const { data, error } = await sb.from('produtos').select('codigo');
  if (error) throw error;
  return new Set((data ?? []).map(r => r.codigo));
}

// ─── Upsert em batches ────────────────────────────────────────

async function upsertBatch(rows) {
  const BATCH = 100;
  let ok = 0, err = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await sb.from('produto_tempos_maquina').upsert(slice, {
      onConflict: 'codigo_item,maquina_nome,operacao',
    });
    if (error) { console.error('  ✗ batch erro:', error.message); err += slice.length; }
    else ok += slice.length;
  }
  return { ok, err };
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('Lendo planilha:', PLANILHA);
  const wb = readFile(PLANILHA, { cellDates: false, raw: false });

  // Coleta todas as medições
  const todas = {};

  for (const cfg of ABAS_FORWOOD) {
    console.log(`  → ${cfg.nome} (forwood)`);
    const m = coletarForwood(wb, cfg);
    for (const [k, v] of Object.entries(m)) {
      if (!todas[k]) todas[k] = v;
      else todas[k].tempos.push(...v.tempos);
    }
  }

  for (const cfg of ABAS_TAXA) {
    console.log(`  → ${cfg.nome} (taxa)`);
    const m = coletarTaxa(wb, cfg);
    for (const [k, v] of Object.entries(m)) {
      if (!todas[k]) todas[k] = v;
      else todas[k].tempos.push(...v.tempos);
    }
  }

  console.log(`\nMedições únicas (código+máquina+operação): ${Object.keys(todas).length}`);

  // Verifica quais códigos existem no banco
  console.log('Verificando FK em codi.produtos…');
  const validos = await codigosExistentes();
  console.log(`  ${validos.size} produtos no banco`);

  const rows = [];
  let ignorados = 0;
  for (const { codigo, maquina, operacao, tempos } of Object.values(todas)) {
    if (!validos.has(codigo)) { ignorados++; continue; }
    rows.push({
      codigo_item:  codigo,
      maquina_nome: maquina,
      operacao:     operacao || '',
      tempo_min:    parseFloat(media(tempos).toFixed(4)),
      fonte:        'planilha_pcp',
    });
  }

  console.log(`  Ignorados (código sem FK): ${ignorados}`);
  console.log(`  Para inserir: ${rows.length}`);

  if (rows.length === 0) { console.log('Nada a inserir.'); return; }

  console.log('Fazendo upsert…');
  const { ok, err } = await upsertBatch(rows);
  console.log(`\n✓ Concluído: ${ok} inseridos/atualizados, ${err} erros`);
}

main().catch(e => { console.error(e); process.exit(1); });
