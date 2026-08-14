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
  v_meta      bigint;
  v_realizado bigint;
begin
  if not gestao.can_see('diretoria') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(sum(goal), 0) into v_meta
  from fabrill.production_goals
  where goal_date between p_from and p_to;

  select coalesce(sum(quantity), 0) into v_realizado
  from fabrill.production_entries
  where entry_date between p_from and p_to;

  return jsonb_build_object(
    'valor',      case when v_meta > 0 then round(100.0 * v_realizado / v_meta, 1) else null end,
    'meta_total', v_meta,
    'realizado',  v_realizado
  );
end $$;

grant execute on function gestao.kpi_aderencia_pcp(date, date) to authenticated;
revoke execute on function gestao.kpi_aderencia_pcp(date, date) from public, anon;

notify pgrst, 'reload schema';
