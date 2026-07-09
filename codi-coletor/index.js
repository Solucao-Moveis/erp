/**
 * Coletor CODI → Supabase (schema "codi")
 * ─────────────────────────────────────────────────────────────
 * Roda num PC dentro da rede da fábrica.
 * Lê a API REST do CODI a cada INTERVALO_MIN minutos, normaliza
 * os dados e faz upsert no Supabase via service_role.
 *
 * Uso:
 *   cp .env.example .env       # preencher credenciais reais
 *   npm install
 *   node index.js              # loop contínuo
 *
 * Primeira execução: detecta tabelas vazias e faz backfill por
 * janelas mensais (sem estourar a resposta do CODI).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────
const CODI_BASE   = (process.env.CODI_BASE_URL   || '').replace(/\/$/, '');
const CODI_TOKEN  = process.env.CODI_TOKEN        || '';
const SB_URL      = process.env.SUPABASE_URL      || '';
const SB_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const INTERVALO   = parseInt(process.env.INTERVALO_MIN  || '5', 10) * 60_000;
const DELTA_DIAS  = parseInt(process.env.DELTA_DIAS     || '3', 10);
const BACKFILL_M  = parseInt(process.env.BACKFILL_MESES || '12', 10);

if (!CODI_BASE || !CODI_TOKEN || !SB_URL || !SB_KEY) {
  console.error('[CODI] Variáveis de ambiente faltando. Verifique o .env');
  process.exit(1);
}

const sb = createClient(SB_URL, SB_KEY, { db: { schema: 'codi' } });

// ─── Helpers ──────────────────────────────────────────────────

/** Converte "dd/mm/yyyy" do CODI para "yyyy-mm-dd" (ISO date string) */
function parseCodiDate(str) {
  if (!str || str === '  /  /    ') return null;
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Formata Date para "dd/mm/yyyy" (filtros da API CODI) */
function fmtCodi(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/** POST para a API CODI e retorna o array de resultados */
async function codiPost(endpoint, body) {
  const url = `${CODI_BASE}/${endpoint}`;
  const payload = { ApiToken: CODI_TOKEN, ...body };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`CODI ${endpoint} → ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  // A API CODI encapsula a lista em diferentes chaves dependendo do endpoint.
  // Tentamos as mais comuns; se não achar, retorna o objeto inteiro.
  return (
    json.ListaOrdemFabricacao    ||
    json.ListaReservaTempo       ||
    json.ListaMotivoParada       ||
    json.ListaMotivoPerda        ||
    json.ListaParada             ||
    json.ListaPerda              ||
    json.Maquina                 ||  // ConsultarMaquina retorna objeto único
    json
  );
}

/** Grava estado de sincronização de um recurso */
async function setSyncState(recurso, ok, mensagem = null) {
  await sb.from('sync_state').upsert(
    { recurso, ultimo_sync: new Date().toISOString(), ok, mensagem },
    { onConflict: 'recurso' }
  );
}

// ─── Sincronizações por recurso ───────────────────────────────

/** Sincroniza Ordens de Fabricação (ListarOrdemFabricacao) */
async function syncOfs(de, ate) {
  const endpoint = 'API_OrdemFabricacao/ListarOrdemFabricacao';
  const lista = await codiPost(endpoint, {
    DataAlteracao:    fmtCodi(de),
    DataAlteracaoFim: fmtCodi(ate),
    EstruturaProduto: 'N',
    OrdemEncerrada:   'S',  // incluir encerradas (para capturar transições de status)
  });

  if (!Array.isArray(lista) || lista.length === 0) return 0;

  const rows = lista.map(o => ({
    ordem:                     String(o.Ordem            || '').trim(),
    produto:                   o.Produto                 || null,
    nome_produto:              o.NomeProduto             || null,
    tipo:                      o.Tipo                    || null,
    deposito:                  o.Deposito                || null,
    lote:                      o.Lote                    || null,
    quantidade:                parseFloat(o.Quantidade          || '0') || 0,
    quantidade_produzida:      parseFloat(o.QuantidadeProduzida || '0') || 0,
    status:                    o.Status                  || null,
    data_previsao:             parseCodiDate(o.DataPrevisao),
    data_alteracao:            parseCodiDate(o.DataAlteracao),
    industrializacao_terceiro: o.IndustrializacaoTerceiro || null,
    atualizado_em:             new Date().toISOString(),
  })).filter(r => r.ordem);

  const { error } = await sb.from('ofs').upsert(rows, { onConflict: 'ordem' });
  if (error) throw error;
  return rows.length;
}

/** Sincroniza Reservas de Tempo (ListarReservaTempo) */
async function syncReservas(de, ate) {
  const endpoint = 'API_OrdemFabricacao/ListarReservaTempo';
  const lista = await codiPost(endpoint, {
    DataAlteracao:              fmtCodi(de),
    DataAlteracaoFim:           fmtCodi(ate),
    CarregarProcessosAlternativos: 'N',
    DataEncerramentoOrdemVazia:    'S',
  });

  if (!Array.isArray(lista) || lista.length === 0) return 0;

  const rows = lista.map(r => ({
    requisicao:           String(r.Requisicao            || '').trim(),
    ordem_fabricacao:     String(r.OrdemFabricacao       || '').trim() || null,
    produto:              r.Produto                      || null,
    produto_descricao:    r.ProdutoDescricao             || null,
    processo:             r.Processo                     || null,
    operacao:             r.Operacao                     || null,
    operacao_descricao:   r.OperacaoDescricao            || null,
    fase:                 r.Fase                         || null,
    fase_descricao:       r.FaseDescricao                || null,
    maquina:              r.Maquina                      || null,
    maquina_descricao:    r.MaquinaDescricao             || null,
    quantidade:           parseFloat(r.Quantidade              || '0') || 0,
    quantidade_produzida: parseFloat(r.QuantidadeProduzida     || '0') || 0,
    tempo_reservado:      parseFloat(r.TempoReservado          || '0') || 0,
    tempo_requisitado:    parseFloat(r.TempoRequisitado        || '0') || 0,
    tempo_setup:          parseFloat(r.TempoSetup              || '0') || 0,
    quantidade_operadores:parseInt(r.QuantidadeOperadores      || '1', 10) || 1,
    tipo_processo:        r.TipoProcesso                 || null,
    data_alteracao:       parseCodiDate(r.DataAlteracao),
    data_encerramento_ordem: parseCodiDate(r.DataEncerramentoOrdem),
    atualizado_em:        new Date().toISOString(),
  })).filter(r => r.requisicao);

  const { error } = await sb.from('reservas_tempo').upsert(rows, { onConflict: 'requisicao' });
  if (error) throw error;
  return rows.length;
}

/** Sincroniza cadastro de Máquinas (ConsultarMaquina — sem filtro) */
async function syncMaquinas() {
  // A API não documenta "listar todas" sem código — tentamos sem código e vemos.
  // Fallback: derivar lista de máquinas das reservas_tempo já salvas.
  let lista;
  try {
    const res = await codiPost('API_Cadastro/ConsultarMaquina', {});
    lista = Array.isArray(res) ? res : (res ? [res] : []);
  } catch {
    // Fallback: buscar códigos únicos das reservas e consultar um a um
    const { data: reservas } = await sb.from('reservas_tempo')
      .select('maquina, maquina_descricao')
      .not('maquina', 'is', null);

    const unicas = [...new Map((reservas || []).map(r => [r.maquina, r])).values()];
    lista = [];
    for (const { maquina: codigo } of unicas) {
      try {
        const m = await codiPost('API_Cadastro/ConsultarMaquina', { Codigo: codigo });
        if (m && m.Codigo) lista.push(m);
        else if (Array.isArray(m)) lista.push(...m);
      } catch { /* ignora máquina individual que falhar */ }
    }
  }

  if (lista.length === 0) return 0;

  const rows = lista.map(m => ({
    codigo:            String(m.Codigo            || '').trim(),
    descricao:         m.Descricao                || null,
    abreviatura:       m.Abreviatura              || null,
    grupo:             m.Grupo                    || null,
    ccusto:            m.CCusto                   || null,
    horas_disponiveis: parseFloat(m.HorasDisponiveis || '0') || null,
    valor_hora_padrao: parseFloat(m.ValorHoraPadrao  || '0') || null,
    status:            m.Status                   || null,
    atualizado_em:     new Date().toISOString(),
  })).filter(r => r.codigo);

  const { error } = await sb.from('maquinas').upsert(rows, { onConflict: 'codigo' });
  if (error) throw error;
  return rows.length;
}

/** Sincroniza Motivos de Parada e de Perda (uma vez por dia) */
async function syncMotivos() {
  // Parada
  try {
    const lista = await codiPost('API_OrdemFabricacao/ListarMotivoParada', {});
    if (Array.isArray(lista) && lista.length > 0) {
      const rows = lista.map(m => ({
        codigo: String(m.Codigo || m.CodigoMotivo || '').trim(),
        descricao: m.Descricao || m.DescricaoMotivo || null,
        atualizado_em: new Date().toISOString(),
      })).filter(r => r.codigo);
      if (rows.length) await sb.from('motivos_parada').upsert(rows, { onConflict: 'codigo' });
    }
  } catch (e) { console.warn('[motivos_parada]', e.message); }

  // Perda
  try {
    const lista = await codiPost('API_OrdemFabricacao/ListarMotivoPerda', {});
    if (Array.isArray(lista) && lista.length > 0) {
      const rows = lista.map(m => ({
        codigo: String(m.Codigo || m.CodigoMotivo || '').trim(),
        descricao: m.Descricao || m.DescricaoMotivo || null,
        atualizado_em: new Date().toISOString(),
      })).filter(r => r.codigo);
      if (rows.length) await sb.from('motivos_perda').upsert(rows, { onConflict: 'codigo' });
    }
  } catch (e) { console.warn('[motivos_perda]', e.message); }
}

// ─── Lógica de backfill vs delta ──────────────────────────────

/** Verifica se as tabelas principais estão vazias (primeira execução) */
async function precisaBackfill() {
  const { count } = await sb.from('ofs').select('*', { count: 'exact', head: true });
  return (count || 0) === 0;
}

/** Backfill completo: varre mês a mês para não sobrecarregar o CODI */
async function backfill() {
  console.log(`[CODI] Primeira execução — backfill de ${BACKFILL_M} meses`);
  const hoje = new Date();
  for (let i = BACKFILL_M; i >= 0; i--) {
    const ini = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 0);
    try {
      const nOfs = await syncOfs(ini, fim);
      const nRes = await syncReservas(ini, fim);
      console.log(`[CODI] backfill ${fmtCodi(ini)}–${fmtCodi(fim)}: ${nOfs} OFs, ${nRes} reservas`);
    } catch (e) {
      console.error(`[CODI] backfill ${fmtCodi(ini)}–${fmtCodi(fim)} falhou:`, e.message);
    }
    // Pausa entre janelas para não sobrecarregar
    await new Promise(r => setTimeout(r, 500));
  }
}

// ─── Ciclo principal ──────────────────────────────────────────

async function ciclo() {
  const agora = new Date();
  const ini   = new Date(agora); ini.setDate(ini.getDate() - DELTA_DIAS);

  console.log(`[CODI] Ciclo ${agora.toISOString()} — delta ${DELTA_DIAS} dias`);

  // OFs e Reservas (todo ciclo)
  try {
    const nOfs = await syncOfs(ini, agora);
    await setSyncState('ofs', true);
    const nRes = await syncReservas(ini, agora);
    await setSyncState('reservas_tempo', true);
    console.log(`[CODI] OFs: ${nOfs} | Reservas: ${nRes}`);
  } catch (e) {
    console.error('[CODI] Erro OFs/Reservas:', e.message);
    await setSyncState('ofs', false, e.message);
    await setSyncState('reservas_tempo', false, e.message);
  }

  // Máquinas e Motivos: 1x por dia (quando último sync > 23h)
  const { data: syncMaq } = await sb.from('sync_state')
    .select('ultimo_sync').eq('recurso', 'maquinas').single();
  const ultimoMaq = syncMaq?.ultimo_sync ? new Date(syncMaq.ultimo_sync) : null;
  const sincronizarCadastros = !ultimoMaq || (agora - ultimoMaq) > 23 * 3600_000;

  if (sincronizarCadastros) {
    try {
      const nMaq = await syncMaquinas();
      await setSyncState('maquinas', true);
      await syncMotivos();
      await setSyncState('motivos_parada', true);
      await setSyncState('motivos_perda', true);
      console.log(`[CODI] Máquinas: ${nMaq}`);
    } catch (e) {
      console.error('[CODI] Erro Máquinas/Motivos:', e.message);
      await setSyncState('maquinas', false, e.message);
    }
  }
}

// ─── Inicialização ────────────────────────────────────────────

async function main() {
  console.log(`[CODI] Coletor iniciado — CODI: ${CODI_BASE} | Intervalo: ${INTERVALO / 60_000}min`);

  if (await precisaBackfill()) {
    await backfill();
    await syncMaquinas().then(() => setSyncState('maquinas', true)).catch(console.error);
    await syncMotivos().then(() => { setSyncState('motivos_parada', true); setSyncState('motivos_perda', true); }).catch(console.error);
  }

  // Primeiro ciclo imediato
  await ciclo().catch(console.error);

  // Loop a cada INTERVALO ms
  setInterval(() => ciclo().catch(console.error), INTERVALO);
}

main().catch(e => { console.error('[CODI] Fatal:', e); process.exit(1); });
