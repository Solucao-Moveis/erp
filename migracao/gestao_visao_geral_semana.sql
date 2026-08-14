-- ============================================================
-- VISÃO GERAL — indicadores manuais passam a agregar por SEMANA
-- ------------------------------------------------------------
-- Ajuste depois do primeiro round: o valor manual é lançado toda
-- sexta-feira (uma linha por semana em gestao.kpi_manual_valores). O
-- kpi_manual_get original só achava o valor se o período selecionado
-- batesse EXATAMENTE com o que foi salvo — então olhar "Mês atual" ou
-- qualquer período que não fosse a semana exata mostrava "—", mesmo
-- com dado lançado.
--
-- Agora: soma (ou tira a média, conforme o indicador — ver agregacao
-- em src/lib/kpiDefs.ts do front) de TODAS as semanas cujo intervalo
-- esteja CONTIDO no período pedido. Olhar exatamente 1 semana continua
-- funcionando igual (soma de 1 linha = a própria linha). Olhar o mês
-- inteiro agora soma/tira média das semanas lançadas dentro dele.
--
-- Rodar no SQL Editor do Supabase SMERP, DEPOIS de
-- gestao_visao_geral_schema.sql e gestao_visao_geral_rpcs.sql.
-- Idempotente (create or replace).
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
        and v.periodo_inicio >= p_from
        and v.periodo_fim   <= p_to
    ) agg on true
  ), '{}'::jsonb);
end $$;

-- grants já cobertos por gestao_visao_geral_rpcs.sql (mesma assinatura,
-- create or replace não perde os grants existentes na função).

notify pgrst, 'reload schema';

-- Teste rápido: uma semana isolada deve devolver amostra=1 (ou 0 se
-- ninguém lançou ainda); um mês inteiro deve somar as semanas dentro dele.
--   select gestao.kpi_manual_get(array['faturamento'], date '2026-08-03', date '2026-08-07');
--   select gestao.kpi_manual_get(array['faturamento'], date '2026-08-01', date '2026-08-31');
