// Verificação dupla do Painel do Diretor (gestao.tv_painel).
// Recalcula cada indicador por um caminho independente (consulta direta nas tabelas + regra de cada sistema,
// refeita aqui em JavaScript) e compara com a função oficial, mês a mês. Só leitura.
//
// Uso:  node migracao/verificar-tv.mjs
// Saída: tabela ✅/❌ por indicador e mês; termina com código 1 se houver diferença.
import { readFileSync } from "fs";

const env = Object.fromEntries(readFileSync(new URL("../codi-coletor/.env", import.meta.url), "utf8")
  .split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]));
const SR = Object.entries(env).find(([k]) => /SERVICE/i.test(k))[1];
const BASE = Object.entries(env).find(([k]) => /SUPABASE_URL/i.test(k))[1].replace(/\/$/, "");

async function q(sql) {
  const r = await fetch(BASE + "/rest/v1/rpc/sila_consultar", {
    method: "POST",
    headers: { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" },
    body: JSON.stringify({ p_sql: sql.trim() }),
  });
  const d = await r.json();
  if (!Array.isArray(d)) throw new Error(sql.slice(0, 80) + " => " + JSON.stringify(d));
  return d;
}

// sila_consultar devolve no máximo 200 linhas: consultas de linhas cruas são paginadas (1ª coluna = chave única)
async function qTodas(sql) {
  const tudo = [];
  for (let off = 0; ; off += 200) {
    const pg = await q(`select * from (${sql}) _t order by 1 limit 200 offset ${off}`);
    tudo.push(...pg);
    if (pg.length < 200) return tudo;
  }
}

// --- função oficial, executada como um usuário da diretoria ---
const [{ user_id: uid }] = await q("select user_id from gestao.user_scopes where scope = 'diretoria' limit 1");
const [{ v: OF }] = await q(`with c as materialized (select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true) x)
  select (select x from c) is not null ok, gestao.tv_painel(12) v`);
const meses = [];
for (let d = new Date(OF.mes_inicio + "-01T12:00:00"); d.toISOString().slice(0, 7) <= OF.mes_atual; d.setMonth(d.getMonth() + 1)) meses.push(d.toISOString().slice(0, 7));
const hoje = OF.hoje;

let falhas = 0, ok = 0;
function compara(nome, oficial, independente, tol = 0) {
  for (const m of meses) {
    const a = oficial?.[m] ?? null, b = independente?.[m] ?? null;
    if (a == null && b == null) continue;
    const igual = a != null && b != null && Math.abs(Number(a) - Number(b)) <= tol;
    if (igual) ok++; else { falhas++; console.log(`❌ ${nome.padEnd(28)} ${m}  oficial=${a}  independente=${b}`); }
  }
}
const mapa = (rows, k = "m", v = "v") => Object.fromEntries(rows.map((r) => [r[k], Number(r[v])]));
const BR = (c) => `to_char(${c} at time zone 'America/Sao_Paulo', 'YYYY-MM')`;
const ini = OF.mes_inicio + "-01";

// ===== Entrega (regra do BIP) =====
{
  const ped = await qTodas(`select id, loading_number, loading_date::text d, quantity from bip.loading_orders where loading_date is not null`);
  const cam = new Map();
  for (const p of ped) { const k = (p.loading_number || "").trim() || "pedido:" + p.id; if (!cam.has(k) || p.d < cam.get(k)) cam.set(k, p.d); }
  const porMes = {}; for (const d of cam.values()) { const m = d.slice(0, 7); porMes[m] = (porMes[m] || 0) + 1; }
  compara("Caminhões", OF.entrega.caminhoes, porMes);
  const pac = {}; for (const p of ped) { const m = p.d.slice(0, 7); pac[m] = (pac[m] || 0) + Number(p.quantity); }
  compara("Pacotes", OF.entrega.pacotes, pac);
}

// ===== Produção (regra do Hora a Hora → PCP → Relatórios; mês corrente até ontem) =====
{
  compara("Produção meta", OF.producao.meta, mapa(await q(`select to_char(goal_date,'YYYY-MM') m, sum(goal) v from fabrill.production_goals where goal_date >= '${ini}' and goal_date < '${hoje}' group by 1`)));
  compara("Produção realizado", OF.producao.realizado, mapa(await q(`select to_char(entry_date,'YYYY-MM') m, sum(quantity) v from fabrill.production_entries where entry_date >= '${ini}' and entry_date < '${hoje}' group by 1`)));
}

// ===== Manutenção (regra do Pro-Care refeita em JS; sem OS inválidas) =====
{
  const [{ n: nmaq }] = await q(`select count(*) n from manutencao.maquinas where ativo and not manual`);
  const os = await qTodas(`select o.id, ${BR("o.aberto_em")} m, o.maquina_parada p, o.aberto_em::text a, o.fechado_em::text f
    from manutencao.ordens_servico o join manutencao.maquinas mq on mq.id = o.maquina_id
    where o.status::text <> 'cancelada' and mq.ativo and not mq.manual and (o.categoria_falha is null or o.categoria_falha <> 'invalido')`);
  const pausas = await qTodas(`select id, os_id, pausado_em::text p, retomado_em::text r from manutencao.os_pausas where retomado_em is not null`);
  const pz = new Map(); for (const p of pausas) pz.set(p.os_id, (pz.get(p.os_id) || 0) + Math.max(0, new Date(p.r) - new Date(p.p)));
  const uteis = (m) => { let n = 0; const d = new Date(m + "-01T12:00:00"), fim = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12), lim = new Date(hoje + "T12:00:00");
    for (; d <= fim && d <= lim; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0 && d.getDay() !== 6) n++; return n; };
  const b = {};
  for (const o of os) {
    const x = (b[o.m] ??= { os: 0, falhas: 0, t: [] }); x.os++;
    if (o.p) x.falhas++;
    if (o.f && o.p) x.t.push(Math.max(0, new Date(o.f) - new Date(o.a) - (pz.get(o.id) || 0)) / 3600000);
  }
  const disp = {}, mttr = {}, mtbf = {}, n = {};
  for (const [m, x] of Object.entries(b)) {
    const H = Number(nmaq) * 8 * uteis(m), hp = x.t.reduce((s, v) => s + v, 0);
    n[m] = x.os; disp[m] = +(Math.max(0, (H - hp) / H) * 100).toFixed(1);
    mttr[m] = x.t.length ? +(hp / x.t.length).toFixed(1) : 0; mtbf[m] = x.falhas ? +(H / x.falhas).toFixed(0) : 0;
  }
  compara("Disponibilidade", OF.manutencao.disponibilidade, disp, 0.05);
  compara("MTTR", OF.manutencao.mttr, mttr, 0.05);
  compara("MTBF", OF.manutencao.mtbf, mtbf, 0.5);
  compara("OS no mês", OF.manutencao.os, n);
}

// ===== Compras (regra da tela Compras → Indicadores) =====
{
  const reqs = await qTodas(`select id, purchase_amount v, purchased_at::text pa, arrived_at::text ar, expected_delivery_date::text ex,
    ${BR("purchased_at")} mp, ${BR("arrived_at")} ma from compras.purchase_requests`);
  const gasto = {}, fc = {}, cc = {};
  for (const r of reqs) {
    if (r.pa && Number(r.v) > 0) gasto[r.mp] = (gasto[r.mp] || 0) + Number(r.v);
    if (r.ar && r.ex) { const x = (fc[r.ma] ??= [0, 0]); x[1]++; if (r.ar.slice(0, 10) <= r.ex) x[0]++; }
    if (r.ar && r.pa) { const x = (cc[r.ma] ??= []); x.push((new Date(r.ar) - new Date(r.pa)) / 86400000); }
  }
  for (const m in gasto) gasto[m] = +gasto[m].toFixed(2);
  compara("Comprado (R$)", OF.compras.comprado, gasto, 0.01);
  const ofFc = Object.fromEntries(Object.entries(OF.compras.fornecedor_cumpriu).map(([m, v]) => [m, v[0]]));
  compara("Fornecedor cumpriu (%)", ofFc, Object.fromEntries(Object.entries(fc).map(([m, [y, t]]) => [m, Math.round((y / t) * 100)])));
  compara("Compra → Chegada (dias)", OF.compras.compra_chegada_dias, Object.fromEntries(Object.entries(cc).map(([m, a]) => [m, +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(1)])), 0.05);
}

// ===== RH (calcAbs / calcTurn do painel do RH) =====
{
  const rows = await qTodas(`select ano*100+mes k, ano, mes, ini, fim, du, atest, falt, liber, adm, dem_v, dem_i from rh.meses where ini > 0 or fim > 0`);
  const abs = {}, turn = {};
  for (const r of rows) {
    const m = `${r.ano}-${String(r.mes).padStart(2, "0")}`, ef = r.fim > 0 ? (r.ini + r.fim) / 2 : r.ini, d = r.du * ef;
    abs[m] = d > 0 ? +(((r.atest + r.falt + r.liber) / d) * 100).toFixed(2) : 0;
    turn[m] = ef > 0 ? +((((r.adm + r.dem_v + r.dem_i) / 2) / ef) * 100).toFixed(2) : 0;
  }
  compara("Absenteísmo (%)", OF.rh.absenteismo, abs, 0.005);
  compara("Turnover (%)", OF.rh.turnover, turn, 0.005);
}

// ===== Segurança =====
{
  const av = await qTodas(`select id, ano, mes, nota from seguranca.avaliacoes`);
  const g = {}; for (const a of av) { const m = `${a.ano}-${String(a.mes).padStart(2, "0")}`; (g[m] ??= []).push(Number(a.nota)); }
  compara("Nota de segurança", OF.seguranca.nota, Object.fromEntries(Object.entries(g).map(([m, a]) => [m, Math.round(a.reduce((s, v) => s + v, 0) / a.length)])));
  const ac = await qTodas(`select id, data::text d from teste.acidentes`);
  const c = {}; for (const a of ac) { const m = a.d.slice(0, 7); c[m] = (c[m] || 0) + 1; }
  compara("Acidentes", OF.seguranca.acidentes, c);
}

console.log(`\n${falhas === 0 ? "✅ VERIFICAÇÃO OK" : "❌ HÁ DIFERENÇAS"}: ${ok} valores iguais, ${falhas} diferentes (meses ${meses[0]} a ${meses.at(-1)}, lido ${OF.gerado_em}).`);
process.exit(falhas ? 1 : 0);
