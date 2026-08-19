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

// O query builder do supabase-js é "thenable" (só implementa .then), não uma
// Promise de verdade — encadear .catch() direto nele quebra com
// "TypeError: .catch is not a function". Sempre await + checar {error}.
async function safeUpdate(payload, contexto) {
  const { error } = await sb.from('codi_maquinas_config').update(payload).eq('id', 1);
  if (error) console.error(`[watcher] Erro ao ${contexto}:`, error.message);
}

const STALE_FETCHING_MS = 3 * 60_000; // ciclo normal leva ~15-20s

async function check() {
  if (running) return;

  let cfg;
  try {
    const { data, error } = await sb
      .from('codi_maquinas_config')
      .select('recursos_ids, trigger_fetch, fetching, updated_at')
      .eq('id', 1)
      .single();
    if (error) throw error;
    cfg = data;
  } catch (e) {
    console.error('[watcher] Erro ao ler config:', e.message);
    return;
  }

  // Auto-recuperação: se "fetching" ficou travado (ex.: o watcher foi
  // reiniciado com uma busca em andamento, matando o processo filho no meio
  // sem nunca marcar como concluído), destrava sozinho depois de um tempo —
  // sem isso o front fica girando "Consultando..." pra sempre, sem ninguém
  // pra processar de novo.
  if (cfg.fetching && cfg.updated_at) {
    const idadeMs = Date.now() - new Date(cfg.updated_at).getTime();
    if (idadeMs > STALE_FETCHING_MS) {
      console.warn(`[watcher] "fetching" travado há ${Math.round(idadeMs / 1000)}s — destravando.`);
      await safeUpdate({
        fetching: false,
        last_error: 'Processo interrompido antes de concluir (watcher reiniciado?) — destravado automaticamente.',
      }, 'destravar fetching travado');
      cfg.fetching = false;
    }
  }

  if (!cfg.trigger_fetch) return;

  running = true;
  const recursos = cfg.recursos_ids ?? [1, 4, 5, 6, 17];
  console.log(`[watcher] Disparando fetch CODI — recursos: [${recursos}]`);

  // Marca "em andamento"
  await safeUpdate({ trigger_fetch: false, fetching: true }, 'marcar fetching');

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
    await safeUpdate({ fetching: false, last_fetched_at: agora, last_error: null }, 'finalizar');
  } else {
    console.error(`[watcher] Fetch falhou (exit ${exitCode}).`);
    await safeUpdate({ fetching: false, last_error: `Script saiu com código ${exitCode}` }, 'registrar falha');
  }

  running = false;
}

console.log(`[watcher] Iniciado — polling a cada ${POLL_MS / 1000}s`);
check();
setInterval(check, POLL_MS);
