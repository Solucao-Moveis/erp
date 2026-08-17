/**
 * Watcher de disponibilidade CODI.
 * Faz polling em gestao.codi_maquinas_config a cada 30s.
 * Quando trigger_fetch = true, executa buscar-disponibilidade-codi.mjs
 * com os recursos_ids configurados e atualiza o status no banco.
 *
 * Deve rodar continuamente como processo PM2 (não cron, não one-shot).
 *
 * Requer no .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const POLL_MS = 30_000;
const __dir = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dir, 'buscar-disponibilidade-codi.mjs');

if (!SB_URL || !SB_KEY) {
  console.error('[watcher] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórios no .env');
  process.exit(1);
}

const sb = createClient(SB_URL, SB_KEY, { db: { schema: 'gestao' } });

let running = false; // evita execuções sobrepostas

async function check() {
  if (running) return;

  let cfg;
  try {
    const { data, error } = await sb
      .from('codi_maquinas_config')
      .select('recursos_ids, trigger_fetch, fetching')
      .eq('id', 1)
      .single();
    if (error) throw error;
    cfg = data;
  } catch (e) {
    console.error('[watcher] Erro ao ler config:', e.message);
    return;
  }

  if (!cfg.trigger_fetch) return;

  running = true;
  const recursos = cfg.recursos_ids ?? [1, 4, 5, 6, 17];
  console.log(`[watcher] Disparando fetch CODI — recursos: [${recursos}]`);

  // Marca "em andamento"
  await sb.from('codi_maquinas_config').update({
    trigger_fetch: false,
    fetching: true,
  }).eq('id', 1).catch(e => console.error('[watcher] Erro ao marcar fetching:', e.message));

  const exitCode = await new Promise((resolve) => {
    const proc = spawn(process.execPath, [SCRIPT, `--recursos=${recursos.join(',')}`], {
      cwd: __dir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.on('data', d => process.stdout.write(`[codi] ${d}`));
    proc.stderr.on('data', d => process.stderr.write(`[codi] ${d}`));
    proc.on('close', resolve);
  });

  const agora = new Date().toISOString();
  if (exitCode === 0) {
    console.log('[watcher] Fetch concluído com sucesso.');
    await sb.from('codi_maquinas_config').update({
      fetching: false,
      last_fetched_at: agora,
      last_error: null,
    }).eq('id', 1).catch(e => console.error('[watcher] Erro ao finalizar:', e.message));
  } else {
    console.error(`[watcher] Fetch falhou (exit ${exitCode}).`);
    await sb.from('codi_maquinas_config').update({
      fetching: false,
      last_error: `Script saiu com código ${exitCode}`,
    }).eq('id', 1).catch(e => console.error('[watcher] Erro ao registrar falha:', e.message));
  }

  running = false;
}

console.log(`[watcher] Iniciado — polling a cada ${POLL_MS / 1000}s`);
check();
setInterval(check, POLL_MS);
