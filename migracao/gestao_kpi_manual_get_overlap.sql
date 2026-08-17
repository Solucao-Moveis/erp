-- Fix: kpi_manual_get agora usa lógica SOBREPOSTA em vez de CONTIDA.
-- Antes: periodo_inicio >= p_from AND periodo_fim <= p_to
-- Depois: periodo_inicio <= p_to AND periodo_fim >= p_from
--
-- Motivo: o cron salva semanas CODI (seg-dom) mas o painel filtra
-- "Últimos 7 dias" ou "semana" (seg-sex). Com CONTIDO, a semana
-- CODI Aug 10-16 nunca aparecia no filtro "7d" de Aug 11-17 porque
-- Aug 10 < Aug 11. Com SOBREPOSTO, qualquer período que encosta no
-- filtro é incluído.
--
-- Idempotente. Rodar no SQL Editor do Supabase (schema gestao).
-- ============================================================

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
        and v.periodo_inicio <= p_to    -- SOBREPOSTO (era: >= p_from)
        and v.periodo_fim   >= p_from   -- SOBREPOSTO (era: <= p_to)
    ) agg on true
  ), '{}'::jsonb);
end $$;

notify pgrst, 'reload schema';
