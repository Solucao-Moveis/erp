/**
 * Importa cronometragens da planilha PCP para codi.produto_tempos_maquina.
 *
 * Usa só as abas CORTE, DOBRA, SOLDA, MARCENARIA, INSPEÇÃO A EXPEDIÇÃO — as demais
 * (INSPEÇÃO antiga, TRATAMENTO, PINTURA, EMBALAGEM, MOVIMENTAÇÕES MONTAGEM, MONTAGEM 2)
 * estão obsoletas/paradas no tempo.
 *
 * A média é por código+operação, ignorando qual máquina física fez cada medição — a
 * mesma operação costuma ser cronometrada em várias máquinas equivalentes (ex: 10 robôs
 * de solda diferentes para o mesmo código), e manter isso separado por máquina fazia a
 * view somar tempo duplicado. `maquina_nome` guarda a lista das máquinas observadas,
 * só para exibição.
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
import pkg from 'xlsx';
const { readFile, utils } = pkg;
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

const ABAS = ['CORTE', 'DOBRA', 'SOLDA', 'MARCENARIA', 'INSPEÇÃO A EXPEDIÇÃO'];

// ─── Leitura da planilha ──────────────────────────────────────

function lerAba(wb, nomeAba) {
  const ws = wb.Sheets[nomeAba];
  if (!ws) { console.warn(`  ⚠ Aba "${nomeAba}" não encontrada — pulando`); return []; }
  // header: 1 = array de valores brutos por linha (sem converter para objeto)
  const rows = utils.sheet_to_json(ws, { header: 1, defval: null });
  return rows.slice(1); // pula linha 1 (título mesclado; o cabeçalho real é a linha 2)
}

function strCodigo(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(/\s+/g, '');
  return s || null;
}

function normalizaHeader(v) {
  return String(v ?? '').trim().toLowerCase();
}

// Acha as colunas pelo texto do cabeçalho em vez de posição fixa — o "Tempo" não fica
// na mesma coluna em todas as abas (J em CORTE/SOLDA/MARCENARIA, H em DOBRA/INSPEÇÃO A
// EXPEDIÇÃO, que têm duas colunas a menos).
function localizarColunas(headerRow) {
  const cols = { codigo: null, descricao: null, operacao: null, maquina: null, tempo: null, data: null };
  headerRow.forEach((v, i) => {
    const h = normalizaHeader(v);
    if (h === 'código' || h === 'codigo') cols.codigo = i;
    else if (h === 'descrição' || h === 'descricao') cols.descricao = i;
    else if (h === 'operação' || h === 'operacao') cols.operacao = i;
    else if (h === 'equipamento') cols.maquina = i;
    else if (h === 'tempo') cols.tempo = i; // exato — não pode casar com "forwood"
    else if (h === 'data') cols.data = i;
  });
  return cols;
}

// A coluna DATA vem como número serial do Excel (dias desde 1899-12-30) quando
// preenchida — em boa parte das linhas vem vazia.
function parseDataExcel(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  if (!isFinite(n) || n <= 0) return null;
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// "Tempo" vem como texto de relógio (ex: "0:00:51" = 51s). Retorna SEGUNDOS.
// Fallback numérico pro caso raro da célula vir como fração de dia do Excel.
function parseTempoRelogio(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;

  const partes = s.split(':').map(p => parseFloat(String(p).replace(',', '.')));
  if (partes.length >= 2 && partes.every(p => isFinite(p))) {
    // converte para minutos, depois × 60 para segundos
    const min = partes.length === 3
      ? partes[0] * 60 + partes[1] + partes[2] / 60
      : partes[0] + partes[1] / 60;
    return min > 0 ? min * 60 : null;
  }

  const n = parseFloat(s.replace(',', '.'));
  if (isFinite(n) && n > 0) return n * 24 * 60 * 60; // fração de dia → segundos
  return null;
}

// ─── Coleta de medições ───────────────────────────────────────

function coletarAba(wb, nomeAba, todas, brutas) {
  const rows = lerAba(wb, nomeAba);
  if (rows.length === 0) return;

  const cols = localizarColunas(rows[0]);
  if (cols.codigo == null || cols.operacao == null || cols.maquina == null || cols.tempo == null) {
    console.warn(`  ⚠ Aba "${nomeAba}": não achei todas as colunas (código/operação/equipamento/tempo) no cabeçalho — pulando`);
    return;
  }

  let lidas = 0;
  for (const row of rows.slice(1)) {
    const codigo = strCodigo(row[cols.codigo]);
    if (!codigo) continue;

    const operacao = String(row[cols.operacao] ?? '').trim();
    if (!operacao) continue;

    const maquina = String(row[cols.maquina] ?? '').trim();
    if (!maquina) continue;

    const tempo = parseTempoRelogio(row[cols.tempo]);
    if (tempo == null) continue;

    const key = `${codigo}|${operacao}`;
    if (!todas[key]) todas[key] = { codigo, operacao, tempos: [], maquinas: new Set() };
    todas[key].tempos.push(tempo);
    todas[key].maquinas.add(maquina);
    lidas++;

    brutas.push({
      codigo_item: codigo,
      descricao_planilha: cols.descricao != null ? String(row[cols.descricao] ?? '').trim() || null : null,
      aba_origem: nomeAba,
      operacao,
      maquina_nome: maquina,
      tempo_seg: parseFloat(tempo.toFixed(4)),
      data_medicao: cols.data != null ? parseDataExcel(row[cols.data]) : null,
    });
  }
  console.log(`    ${lidas} medições válidas`);
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

// ─── Medições brutas (cronoanalise_medicoes) ───────────────────

async function recriarBrutas(brutas, codigosValidos) {
  const validas = brutas.filter(r => codigosValidos.has(r.codigo_item));
  console.log(`  Medições brutas válidas (com FK): ${validas.length} de ${brutas.length}`);

  console.log('  Apagando cronoanalise_medicoes…');
  const { error: delErr } = await sb.from('cronoanalise_medicoes').delete().neq('codigo_item', '');
  if (delErr) throw delErr;

  const BATCH = 500;
  let ok = 0, err = 0;
  for (let i = 0; i < validas.length; i += BATCH) {
    const slice = validas.slice(i, i + BATCH);
    const { error } = await sb.from('cronoanalise_medicoes').insert(slice);
    if (error) { console.error('  ✗ batch erro:', error.message); err += slice.length; }
    else ok += slice.length;
  }
  return { ok, err };
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('Lendo planilha:', PLANILHA);
  const wb = readFile(PLANILHA, { cellDates: false, raw: false });

  // Coleta todas as medições (chave = código+operação, junta todas as máquinas) e,
  // em paralelo, a lista bruta (uma entrada por linha válida, com data)
  const todas = {};
  const brutas = [];
  for (const nome of ABAS) {
    console.log(`  → ${nome}`);
    coletarAba(wb, nome, todas, brutas);
  }

  console.log(`\nMedições únicas (código+operação): ${Object.keys(todas).length}`);

  // Verifica quais códigos existem no banco
  console.log('Verificando FK em codi.produtos…');
  const validos = await codigosExistentes();
  console.log(`  ${validos.size} produtos no banco`);

  const rows = [];
  let ignorados = 0;
  for (const { codigo, operacao, tempos, maquinas } of Object.values(todas)) {
    if (!validos.has(codigo)) { ignorados++; continue; }
    rows.push({
      codigo_item:  codigo,
      maquina_nome: [...maquinas].join(' + '),
      operacao:     operacao,
      tempo_seg:    parseFloat(media(tempos).toFixed(4)),
      fonte:        'planilha_pcp',
    });
  }

  console.log(`  Ignorados (código sem FK): ${ignorados}`);
  console.log(`  Para inserir: ${rows.length}`);

  if (rows.length === 0) { console.log('Nada a inserir.'); return; }

  console.log('Fazendo upsert…');
  const { ok, err } = await upsertBatch(rows);
  console.log(`\n✓ Agregado (produto_tempos_maquina): ${ok} inseridos/atualizados, ${err} erros`);

  console.log('\nGravando medições brutas (cronoanalise_medicoes)…');
  const { ok: okBrutas, err: errBrutas } = await recriarBrutas(brutas, validos);
  console.log(`✓ Bruto (cronoanalise_medicoes): ${okBrutas} inseridos, ${errBrutas} erros`);
}

main().catch(e => { console.error(e); process.exit(1); });
