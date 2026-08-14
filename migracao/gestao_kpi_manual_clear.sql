-- ============================================================
-- Limpar override manual de um KPI automático.
-- Deleta a linha de kpi_manual_valores para aquele período, fazendo
-- o sistema voltar a exibir o valor calculado automaticamente.
-- Rodar no SQL Editor do Supabase (schema gestao). Idempotente.
-- ============================================================

create or replace function gestao.kpi_manual_clear(
  p_chave         text,
  p_periodo_inicio date,
  p_periodo_fim   date
)
returns void
language plpgsql security definer set search_path = gestao, public
as $$
begin
  if not gestao.pode_editar_kpi_manual(p_chave) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from gestao.kpi_manual_valores
  where chave = p_chave
    and periodo_inicio = p_periodo_inicio
    and periodo_fim    = p_periodo_fim;
end $$;

revoke execute on function gestao.kpi_manual_clear(text, date, date) from public, anon;
grant  execute on function gestao.kpi_manual_clear(text, date, date) to authenticated;

notify pgrst, 'reload schema';
