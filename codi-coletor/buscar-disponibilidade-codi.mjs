/**
 * Busca Disponibilidade Gerencial do CODI (metalurgia, exceto Viterbo)
 * e salva em gestao.kpi_manual_valores para aparecer no Painel Gerencial.
 *
 * Uso:
 *   node buscar-disponibilidade-codi.mjs                       → semana atual (seg–dom)
 *   node buscar-disponibilidade-codi.mjs 2026-08-04 2026-08-10 → semana específica
 *   node buscar-disponibilidade-codi.mjs --dry-run             → mostra valor sem salvar
 *
 * Requer no .env: CODI_WS_USER, CODI_WS_PASS, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const BASE    = (process.env.CODI_ACTION_URL || 'http://192.168.2.210:8080/action').replace(/\/action$/, '');
const ACTION  = `${BASE}/action`;
const AUTH    = process.env.CODI_AUTH_URL   || `${BASE}/auth/token`;
const SB_URL  = process.env.SUPABASE_URL   || '';
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const CLIENT_ID = process.env.CODI_CLIENT_ID        || '';
const SECRET    = process.env.CODI_CLIENT_SECRET    || '';
const COMPANY   = process.env.CODI_COMPANY          || 'somvsomvpo';
const CO_ID     = process.env.CODI_COMPANY_ID       || '1';
const USER      = process.env.CODI_WS_USER          || '';
const PASS      = process.env.CODI_WS_PASS          || '';

// Máquinas de metalurgia — excluir Viterbo (id=3)
// 1=LX-K6 151, 2=LX-K6 152, 4=BLM, 5=Robótica, 6=EMT, 17=OMP
const RECURSOS = [1, 2, 4, 5, 6, 17];

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validarEnv() {
  const faltando = [];
  if (!USER) faltando.push('CODI_WS_USER');
  if (!PASS) faltando.push('CODI_WS_PASS');
  if (!SB_URL) faltando.push('SUPABASE_URL');
  if (!SB_KEY) faltando.push('SUPABASE_SERVICE_ROLE_KEY');
  if (faltando.length) {
    console.error('Variáveis faltando no .env:', faltando.join(', '));
    process.exit(1);
  }
}

// Retorna a semana ANTERIOR (seg–dom) — padrão mais útil porque a semana
// atual ainda não tem dados completos no CODI quando o script roda.
// Passe datas explícitas nos args para usar outra semana.
function semanaAnterior() {
  const hoje = new Date();
  const dia  = hoje.getDay(); // 0=dom, 1=seg, ..., 6=sab
  // Último domingo
  const dom = new Date(hoje);
  dom.setDate(hoje.getDate() - (dia === 0 ? 0 : dia));
  dom.setHours(0, 0, 0, 0);
  // Segunda-feira = dom - 6
  const seg = new Date(dom);
  seg.setDate(dom.getDate() - 6);
  const fmt = (d) => d.toISOString().split('T')[0];
  return { from: fmt(seg), to: fmt(dom) };
}

// YYYY-MM-DD → DD/MM/YYYY
function fmtCodi(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Autenticação: password grant ─────────────────────────────────────────────

async function getToken() {
  const r = await fetch(AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password', client_id: CLIENT_ID, client_secret: SECRET,
      username: USER, password: PASS, company: COMPANY, companyId: CO_ID,
    }),
  });
  if (!r.ok) throw new Error(`Auth falhou: HTTP ${r.status}`);
  const data = await r.json();
  const token = data.access_token ?? data.accessToken;
  if (!token) throw new Error(`Sem access_token na resposta`);
  console.log(`✓ Token obtido (${token.substring(0, 12)}...)`);
  return token;
}

// ─── Relatório CODI (formato CSV, header X-Requested-With) ───────────────────

async function buscarDisponibilidade(token, from, to) {
  const inicio = fmtCodi(from);
  const fim    = fmtCodi(to);

  const body = new URLSearchParams({
    inicio, fim,
    codigoCenario:    '2',   // Fabril
    tipoAnalise:      '2',   // Discriminado por recurso
    'tipoAgrupamentosRecurso_369777135': '',
    'agrupamentosRecurso_369777135':     '',
    recursos:         RECURSOS.join(','),
    codigosTurno:     '1',
    quantidadeParadas:'5',
    recursosPorPagina:String(Math.min(RECURSOS.length, 10)),
    ordenacao:        'R',
    codigoAgrupamento:'',
    formato:          'CSV',  // CSV é parseable; PDF/HTML são binários/iframes
    codFavorito:      '',
  });
  for (const id of RECURSOS) body.append('recursosSelecionados_369777135', String(id));
  body.append('codigosTurno', '2');  // turnos 1 e 2

  const url = `${ACTION}/relatorio/disponibilidade/disponibilidadeGerencial/execute?access_token=${encodeURIComponent(token)}`;
  console.log(`Buscando relatório CODI: ${inicio} → ${fim}`);
  console.log(`  Recursos: ${RECURSOS.join(', ')} | Turnos: 1, 2`);

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/x-www-form-urlencoded',
      'User-Agent':      'Mozilla/5.0 codi-coletor/3.0',
      'X-Requested-With':'XMLHttpRequest',   // obrigatório — sem isso o BF2 retorna HTTP 500
      'Referer':         `${ACTION}/relatorio/disponibilidade/disponibilidadeGerencial/load`,
    },
    body,
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Relatório HTTP ${resp.status}: ${errText.replace(/<[^>]+>/g,' ').trim().substring(0, 200)}`);
  }

  const csv = await resp.text();

  // Verifica "Nenhum registro" (sem dados no período)
  if (csv.includes('Nenhum') || csv.length < 100) {
    throw new Error(`Sem dados no CODI para o período ${inicio}→${fim}. O relatório pode ainda não ter sido processado.`);
  }

  // Parseia CSV — última linha começa com "Total do período"
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  const totalLine = lines.find(l => l.startsWith('Total do período'));
  if (!totalLine) {
    console.error('CSV recebido:', csv.substring(0, 600));
    throw new Error('Linha "Total do período" não encontrada no CSV.');
  }

  // Colunas: Recurso, Tempo análise, Produção, Setup, Parada não prog., Desconexão, Parada prog., Outros, Disponibilidade, Principal parada
  const cols = totalLine.split(',');
  const dispCol = cols[8]; // índice 8 = Disponibilidade
  if (!dispCol) throw new Error(`Coluna de disponibilidade não encontrada. Linha: ${totalLine}`);

  const match = dispCol.match(/(\d{1,3}[,\.]\d{1,2})/);
  if (!match) throw new Error(`Valor de disponibilidade inválido: "${dispCol}"`);

  const valor = parseFloat(match[1].replace(',', '.'));
  console.log(`✓ Disponibilidade Total do período: ${valor}%`);

  // Loga por máquina para conferência
  const header = lines[0]?.split(',') ?? [];
  console.log('  Por máquina:');
  for (const line of lines.slice(1, -1)) {
    const c = line.split(',');
    const nome = c[0]?.trim() ?? '';
    const disp = c[8]?.trim() ?? '';
    if (nome && disp) console.log(`    ${nome.padEnd(24)} ${disp}`);
  }

  return valor;
}

// ─── Salvar no Supabase ───────────────────────────────────────────────────────

async function salvar(from, to, valor) {
  if (DRY_RUN) {
    console.log(`[dry-run] Não salvando. Valor: maquina_operacao = ${valor}% (${from} → ${to})`);
    return;
  }
  const sb = createClient(SB_URL, SB_KEY, { db: { schema: 'gestao' } });
  const { error } = await sb.from('kpi_manual_valores').upsert(
    {
      chave:          'maquina_operacao',
      periodo_inicio: from,
      periodo_fim:    to,
      valor,
      updated_at:     new Date().toISOString(),
    },
    { onConflict: 'chave,periodo_inicio,periodo_fim' },
  );
  if (error) throw error;
  console.log(`✓ Salvo: maquina_operacao = ${valor}%  (${from} → ${to})`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  validarEnv();

  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const { from, to } = (args.length >= 2)
    ? { from: args[0], to: args[1] }
    : semanaAnterior();

  console.log(`Período: ${from} → ${to}`);

  const token = await getToken();
  const disp  = await buscarDisponibilidade(token, from, to);
  await salvar(from, to, disp);
}

main().catch(e => { console.error('\nErro:', e.message); process.exit(1); });
