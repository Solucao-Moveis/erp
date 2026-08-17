-- ============================================================
-- KPI Aderência ao PCP: % da meta semanal do Hora-a-Hora atingida.
--   Fonte: fabrill.production_goals (metas) e fabrill.production_entries (realizado)
--   Fórmula: SUM(quantity) / SUM(goal) * 100 para as datas no período.
-- Rodar no SQL Editor do Supabase (schema gestao). Idempotente.
-- ============================================================

create or replace function gestao.kpi_aderencia_pcp(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
declare
  v_valor numeric;
  v_dias  integer;
begin
  if not gestao.can_see('diretoria') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Fórmula: média das aderências diárias (não SUM/SUM).
  -- Para cada dia: aderencia_dia = 100 * realizado / meta.
  -- Resultado = AVG(aderencia_dia) sobre os dias com meta > 0 no período.
  select
    round(avg(100.0 * e.realizado / g.meta), 1),
    count(*)
  into v_valor, v_dias
  from (
    select goal_date  as dia, sum(goal)     as meta
    from fabrill.production_goals
    where goal_date between p_from and p_to
    group by goal_date
  ) g
  join (
    select entry_date as dia, sum(quantity) as realizado
    from fabrill.production_entries
    where entry_date between p_from and p_to
    group by entry_date
  ) e on e.dia = g.dia
  where g.meta > 0;

  return jsonb_build_object(
    'valor', v_valor,
    'dias',  v_dias
  );
end $$;

grant execute on function gestao.kpi_aderencia_pcp(date, date) to authenticated;
revoke execute on function gestao.kpi_aderencia_pcp(date, date) from public, anon;

notify pgrst, 'reload schema';
