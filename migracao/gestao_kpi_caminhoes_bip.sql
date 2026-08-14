-- ============================================================
-- KPI Caminhões: trocar fonte de planejamento.carga → bip.loading_orders
-- Um "caminhão despachado" = loading_order com status 'completed' na
-- data de carregamento (loading_date) dentro do período.
-- Rodar no SQL Editor do Supabase (schema gestao). Idempotente.
-- ============================================================

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
  from bip.loading_orders
  where status = 'completed'
    and loading_date between p_from and p_to;

  return jsonb_build_object('valor', v_total);
end $$;

notify pgrst, 'reload schema';
