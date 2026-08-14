-- ============================================================
-- VISÃO GERAL — RPCs dos 7 indicadores automáticos + leitura/escrita
-- dos 5 manuais.
-- ------------------------------------------------------------
-- Rodar DEPOIS de gestao_visao_geral_schema.sql. Idempotente.
-- Mesmo padrão de gestao_schema.sql: security definer, search_path
-- explícito, guarda de acesso no início, tabelas 100% qualificadas.
--
-- Guarda de acesso: gestao.can_see('diretoria') — NÃO gestao.is_gestor(),
-- que retornaria true pra qualquer escopo (compras/producao/expedicao).
-- Decisão do usuário: só diretoria vê a "Visão Geral".
-- ============================================================

-- ---------- OTIF (planejamento.vw_otif, por previsão de entrega) ----------
create or replace function gestao.kpi_otif(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
declare
  v_total integer;
  v_otif  integer;
begin
  if not gestao.can_see('diretoria') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*), count(*) filter (where otif)
  into v_total, v_otif
  from planejamento.vw_otif
  where previsao_entrega between p_from and p_to;

  return jsonb_build_object(
    'valor',   case when v_total > 0 then round(100.0 * v_otif / v_total, 1) else null end,
    'amostra', v_total
  );
end $$;

-- ---------- Caminhões (planejamento.carga, saída realizada no período) ----------
create or replace function gestao.kpi_caminhoes(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
declare
  v_total integer;
begin
  if not gestao.can_see('diretoria') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*) into v_total
  from planejamento.carga
  where status = 'saiu' and saida_real between p_from and p_to;

  return jsonb_build_object('valor', v_total);
end $$;

-- ---------- Leadtime do Pedido (planejamento.vw_lead_time) ----------
create or replace function gestao.kpi_leadtime_pedido(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
declare
  v_media   numeric;
  v_amostra integer;
begin
  if not gestao.can_see('diretoria') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select round(avg(lead_time_dias), 1), count(*)
  into v_media, v_amostra
  from planejamento.vw_lead_time
  where data_entrada between p_from and p_to;

  return jsonb_build_object('valor', v_media, 'amostra', v_amostra);
end $$;

-- ---------- Disponibilidade / MTTR / MTBF (manutencao) ----------
-- Replica FIELMENTE calcKpis() de pro-care/src/routes/_authenticated/indicadores.tsx:
--   - máquinas ativas e não-manuais;
--   - OS não canceladas, abertas no período, categoria_falha <> 'invalido';
--   - MTTR: só OS fechadas com maquina_parada=true, tempo bruto MENOS pausa
--     de pedido de compra (manutencao.os_pausas, pausas já retomadas);
--   - MTBF: falhas = TODAS as OS com maquina_parada=true no período (fechadas
--     ou não), não só as fechadas;
--   - Disponibilidade: desconta do total de horas só o tempo parado LÍQUIDO
--     (pós-pausa) das OS fechadas — mesma convenção do Indicadores.
create or replace function gestao.kpi_manutencao(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
declare
  v_total_maq       integer;
  v_dias_uteis      integer;
  v_total_horas     numeric;
  v_horas_paradas   numeric;
  v_qtd_fechadas    integer;
  v_falhas          integer;
  v_disponibilidade numeric;
  v_mttr            numeric;
  v_mtbf            numeric;
begin
  if not gestao.can_see('diretoria') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*) into v_total_maq
  from manutencao.maquinas
  where ativo = true and manual = false;
  if v_total_maq = 0 then v_total_maq := 1; end if;

  -- dias úteis (seg-sex) entre p_from e min(p_to, hoje) — mesma regra do front.
  select count(*) into v_dias_uteis
  from generate_series(p_from, least(p_to, current_date), interval '1 day') d
  where extract(dow from d) not in (0, 6);

  v_total_horas := v_total_maq * 8 * v_dias_uteis;

  with os_periodo as (
    select o.id, o.aberto_em, o.fechado_em, o.maquina_parada
    from manutencao.ordens_servico o
    join manutencao.maquinas m on m.id = o.maquina_id
    where o.status <> 'cancelada'
      and m.ativo = true and m.manual = false
      and o.aberto_em::date between p_from and p_to
      and coalesce(o.categoria_falha, '') <> 'invalido'
  ),
  pausas as (
    select os_id, sum(greatest(0, extract(epoch from (retomado_em - pausado_em)))) as pausado_seg
    from manutencao.os_pausas
    where retomado_em is not null
    group by os_id
  ),
  fechadas as (
    select
      greatest(0, extract(epoch from (op.fechado_em - op.aberto_em)) - coalesce(p.pausado_seg, 0)) / 3600.0 as horas
    from os_periodo op
    left join pausas p on p.os_id = op.id
    where op.fechado_em is not null and op.maquina_parada
  )
  select
    (select count(*) from os_periodo where maquina_parada),
    (select count(*) from fechadas),
    (select coalesce(sum(horas), 0) from fechadas)
  into v_falhas, v_qtd_fechadas, v_horas_paradas;

  v_mttr := case when v_qtd_fechadas > 0 then v_horas_paradas / v_qtd_fechadas else 0 end;
  v_mtbf := case when v_falhas > 0 then v_total_horas / v_falhas else 0 end;
  v_disponibilidade := case when v_total_horas > 0
    then greatest(0, (v_total_horas - v_horas_paradas) / v_total_horas) * 100
    else 100 end;

  return jsonb_build_object(
    'disponibilidade', round(v_disponibilidade, 1),
    'mttr',             round(v_mttr, 1),
    'mtbf',             round(v_mtbf, 0)
  );
end $$;

-- ---------- Máquina em operação / Produtividade (codi) ----------
-- "valor" = oee_pct médio (produtividade real) — distinto do card de
-- Disponibilidade da Manutenção pra não duplicar o mesmo conceito.
-- NÃO segmenta por "Metalurgia": não existe de-para confiável máquina↔
-- setor entre codi.maquinas e pcp.recursos (é resolvido em aplicação,
-- sem FK garantida) — considera todas as máquinas monitoradas pelo CODI.
create or replace function gestao.kpi_maquina_operacao(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
declare
  v_oee            numeric;
  v_disponibilidade numeric;
begin
  if not gestao.can_see('diretoria') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select round(avg(oee_pct), 1), round(avg(disponibilidade_pct), 1)
  into v_oee, v_disponibilidade
  from codi.maquinas_disponibilidade_dia
  where dia between p_from and p_to;

  return jsonb_build_object('valor', v_oee, 'disponibilidade_codi', v_disponibilidade);
end $$;

-- ---------- Indicadores manuais: leitura em lote + escrita ----------
-- Cada valor manual é lançado por semana (1 linha em kpi_manual_valores).
-- kpi_manual_get soma (ou faz média, ver agregacao em kpiDefs.ts do front)
-- todas as semanas CONTIDAS no período pedido — olhar exatamente 1 semana
-- devolve amostra=1 (a própria linha); olhar o mês inteiro soma/tira média
-- das semanas lançadas dentro dele. Ver gestao_visao_geral_semana.sql pro
-- histórico dessa decisão.
create or replace function gestao.kpi_manual_get(p_chaves text[], p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  return coalesce((
    select jsonb_object_agg(k, jsonb_build_object(
      'soma',        agg.soma,
      'amostra',     agg.n,
      'pode_editar', gestao.pode_editar_kpi_manual(k)
    ))
    from unnest(p_chaves) as k
    left join lateral (
      select coalesce(sum(v.valor), 0) as soma, count(*) as n
      from gestao.kpi_manual_valores v
      where v.chave = k
        and v.periodo_inicio >= p_from
        and v.periodo_fim   <= p_to
    ) agg on true
  ), '{}'::jsonb);
end $$;

create or replace function gestao.kpi_manual_set(p_chave text, p_periodo_inicio date, p_periodo_fim date, p_valor numeric)
returns void
language plpgsql security definer set search_path = gestao, public
as $$
begin
  if not gestao.pode_editar_kpi_manual(p_chave) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into gestao.kpi_manual_valores (chave, periodo_inicio, periodo_fim, valor, updated_by, updated_at)
  values (p_chave, p_periodo_inicio, p_periodo_fim, p_valor, auth.uid(), now())
  on conflict (chave, periodo_inicio, periodo_fim)
  do update set valor = excluded.valor, updated_by = excluded.updated_by, updated_at = now();
end $$;

-- ============================================================
-- GRANTS
-- ============================================================
revoke all on function gestao.kpi_otif(date,date)                       from public, anon;
revoke all on function gestao.kpi_caminhoes(date,date)                  from public, anon;
revoke all on function gestao.kpi_leadtime_pedido(date,date)            from public, anon;
revoke all on function gestao.kpi_manutencao(date,date)                 from public, anon;
revoke all on function gestao.kpi_maquina_operacao(date,date)           from public, anon;
revoke all on function gestao.kpi_manual_get(text[],date,date)          from public, anon;
revoke all on function gestao.kpi_manual_set(text,date,date,numeric)    from public, anon;

grant execute on function gestao.kpi_otif(date,date)                    to authenticated;
grant execute on function gestao.kpi_caminhoes(date,date)               to authenticated;
grant execute on function gestao.kpi_leadtime_pedido(date,date)         to authenticated;
grant execute on function gestao.kpi_manutencao(date,date)              to authenticated;
grant execute on function gestao.kpi_maquina_operacao(date,date)        to authenticated;
grant execute on function gestao.kpi_manual_get(text[],date,date)       to authenticated;
grant execute on function gestao.kpi_manual_set(text,date,date,numeric) to authenticated;

-- ============================================================
-- Recarrega o cache do PostgREST
-- ============================================================
notify pgrst, 'reload schema';

-- Teste rápido (logado como diretoria, via SQL Editor "Run as"):
--   select gestao.kpi_otif(date '2026-08-01', date '2026-08-14');
--   select gestao.kpi_manutencao(date '2026-08-01', date '2026-08-14');
