-- ============================================================
-- FIX: gestao.kpi_manutencao quebrava em TODA chamada
-- ------------------------------------------------------------
-- manutencao.ordens_servico.categoria_falha é um ENUM
-- (manutencao.categoria_falha), não texto. A função original fazia
-- coalesce(o.categoria_falha, '') <> 'invalido' — '' não é um valor
-- válido desse enum, então o Postgres rejeita a query já no
-- planejamento (erro de tipo), pra QUALQUER período, sempre. Por isso
-- Disponibilidade/MTTR/MTBF vinham vazios ("—") na Visão Geral.
--
-- Rodar no SQL Editor do Supabase SMERP. Idempotente.
-- ============================================================

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
      and (o.categoria_falha is null or o.categoria_falha <> 'invalido')
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

notify pgrst, 'reload schema';

-- Teste rápido (logado como diretoria):
--   select gestao.kpi_manutencao(date '2026-08-10', date '2026-08-14');
