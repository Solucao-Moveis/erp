/**
 * Gera planilha Excel com todos os componentes do BOM que não têm
 * cronometragem cadastrada e são itens fabricados (não matéria-prima).
 *
 * Uso: node gerar-relatorio-sem-tempo.mjs
 * Saída: ../relatorio-itens-sem-tempo.xlsx
 */

import 'dotenv/config';
import pkg from 'xlsx';
const { utils, writeFile } = pkg;
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'codi' } }
);

function colsBase() {
  return [
    { wch: 14 },  // Código
    { wch: 50 },  // Descrição
    { wch: 25 },  // Grupo
    { wch: 6  },  // Un
  ];
}

async function buscarItens(semTempo) {
  let q = sb
    .from('v_bom_com_nomes')
    .select('codigo_filho, nome_filho, grupo_filho, unidade_filho, tempo_total_min, maquinas_desc')
    .order('grupo_filho', { nullsFirst: false })
    .order('nome_filho', { nullsFirst: false });

  q = semTempo
    ? q.is('tempo_total_min', null)
    : q.not('tempo_total_min', 'is', null);

  const { data, error } = await q;
  if (error) throw error;

  const mapa = new Map();
  for (const row of data ?? []) {
    if (!mapa.has(row.codigo_filho)) mapa.set(row.codigo_filho, row);
  }
  return [...mapa.values()].filter(r => r.codigo_filho.startsWith('2') && r.nome_filho);
}

async function main() {
  console.log('Consultando banco...');

  const [semTempo, comTempo] = await Promise.all([
    buscarItens(true),
    buscarItens(false),
  ]);

  console.log(`Sem tempo: ${semTempo.length}  |  Com tempo: ${comTempo.length}`);

  const wb = utils.book_new();

  // ── Aba 1: itens SEM tempo (para preencher) ──────────────────
  const linhasSem = semTempo.map(r => ({
    'Código':       r.codigo_filho,
    'Descrição':    r.nome_filho ?? '',
    'Grupo':        r.grupo_filho ?? '',
    'Un':           r.unidade_filho ?? '',
    'Tempo (min)':  '',
    'Observação':   '',
  }));
  const wsSem = utils.json_to_sheet(linhasSem);
  wsSem['!cols'] = [...colsBase(), { wch: 14 }, { wch: 30 }];
  utils.book_append_sheet(wb, wsSem, 'Faltam preencher');

  // ── Aba 2: itens COM tempo (para verificar) ───────────────────
  const linhasCom = comTempo.map(r => ({
    'Código':        r.codigo_filho,
    'Descrição':     r.nome_filho ?? '',
    'Grupo':         r.grupo_filho ?? '',
    'Un':            r.unidade_filho ?? '',
    'Tempo total (min)': r.tempo_total_min ?? '',
    'Máquinas':      r.maquinas_desc ?? '',
  }));
  const wsCom = utils.json_to_sheet(linhasCom);
  wsCom['!cols'] = [...colsBase(), { wch: 18 }, { wch: 50 }];
  utils.book_append_sheet(wb, wsCom, 'Já cadastrados');

  const saida = path.join(__dirname, '..', 'relatorio-itens-sem-tempo.xlsx');
  writeFile(wb, saida);
  console.log(`\nPlanilha gerada: ${saida}`);
  console.log(`  Aba "Faltam preencher": ${linhasSem.length} itens`);
  console.log(`  Aba "Já cadastrados":   ${linhasCom.length} itens`);
}

main().catch(e => { console.error(e); process.exit(1); });
