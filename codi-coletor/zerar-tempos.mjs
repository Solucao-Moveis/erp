/**
 * Apaga TODAS as linhas de codi.produto_tempos_maquina.
 *
 * ⚠ Destrutivo. Rode exportar-tempos-atuais.mjs ANTES para ter backup.
 *
 * Uso: node zerar-tempos.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'codi' } }
);

async function contar() {
  const { count, error } = await sb
    .from('produto_tempos_maquina')
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  const antes = await contar();
  console.log(`Linhas atuais em produto_tempos_maquina: ${antes}`);

  if (antes === 0) { console.log('Nada a apagar.'); return; }

  console.log('Apagando...');
  const { error } = await sb
    .from('produto_tempos_maquina')
    .delete()
    .neq('codigo_item', '');
  if (error) throw error;

  const depois = await contar();
  console.log(`\n✓ Concluído. Linhas restantes: ${depois}`);
}

main().catch(e => { console.error(e); process.exit(1); });
