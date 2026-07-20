/**
 * Exporta todas as linhas de codi.produto_tempos_maquina (backup antes de zerar).
 *
 * Uso: node exportar-tempos-atuais.mjs
 * Saída: ../tempos-atuais-backup-<data>.xlsx
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

async function buscarTudo() {
  const { data, error } = await sb
    .from('produto_tempos_maquina')
    .select('codigo_item, maquina_nome, operacao, tempo_min, fonte, atualizado_em, produtos(nome, grupo_descricao)')
    .order('codigo_item');
  if (error) throw error;
  return data ?? [];
}

async function main() {
  console.log('Consultando codi.produto_tempos_maquina...');
  const linhas = await buscarTudo();
  console.log(`  ${linhas.length} linhas encontradas`);

  const dados = linhas.map(r => ({
    'Código':        r.codigo_item,
    'Descrição':     r.produtos?.nome ?? '',
    'Grupo':         r.produtos?.grupo_descricao ?? '',
    'Máquina':       r.maquina_nome,
    'Operação':      r.operacao,
    'Tempo (min)':   r.tempo_min,
    'Fonte':         r.fonte ?? '',
    'Atualizado em': r.atualizado_em ?? '',
  }));

  const wb = utils.book_new();
  const ws = utils.json_to_sheet(dados);
  ws['!cols'] = [
    { wch: 14 }, // Código
    { wch: 50 }, // Descrição
    { wch: 25 }, // Grupo
    { wch: 16 }, // Máquina
    { wch: 16 }, // Operação
    { wch: 12 }, // Tempo (min)
    { wch: 14 }, // Fonte
    { wch: 22 }, // Atualizado em
  ];
  utils.book_append_sheet(wb, ws, 'Tempos atuais');

  const dataStr = new Date().toISOString().slice(0, 10);
  const saida = path.join(__dirname, '..', `tempos-atuais-backup-${dataStr}.xlsx`);
  writeFile(wb, saida);
  console.log(`\nPlanilha gerada: ${saida}`);
  console.log(`  ${dados.length} linhas exportadas`);
}

main().catch(e => { console.error(e); process.exit(1); });
