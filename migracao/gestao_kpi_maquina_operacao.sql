-- ============================================================
-- KPI Máquina em Operação: disponibilidade real das máquinas CODI,
-- excluindo a Viterbo.
--   Fórmula: sum(tempo_producao_min) / sum(producao + parada) * 100
--   Fonte: codi.maquinas_disponibilidade_dia × codi.maquinas
--   Exclui máquinas com "viterbo" no nome (case-insensitive).
-- Rodar no SQL Editor do Supabase (schema gestao). Idempotente.
-- ============================================================

create or replace function gestao.kpi_maquina_operacao(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
declare
  v_disponibilidade numeric;
begin
  if not gestao.can_see('diretoria') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select round(avg(d.disponibilidade_pct), 1)
  into v_disponibilidade
  from codi.maquinas_disponibilidade_dia d
  join codi.maquinas m on m.id = d.maquina_id
  where d.dia between p_from and p_to
    and m.name not ilike '%viterbo%';

  return jsonb_build_object('valor', v_disponibilidade);
end $$;

grant execute on function gestao.kpi_maquina_operacao(date, date) to authenticated;
revoke execute on function gestao.kpi_maquina_operacao(date, date) from public, anon;

notify pgrst, 'reload schema';
