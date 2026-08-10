-- ============================================================
-- MANUTENÇÃO — Categoria da falha (Pareto de Falhas no Dashboard)
-- ------------------------------------------------------------
-- 5 categorias iniciais, só um ponto de partida — pendente de
-- validação com o time. Se mudarem, é só um ALTER TYPE (novo
-- valor) ou uma migration de rename; a lista fica só em
-- src/lib/categoriaFalha.ts no front, não hardcodeada em vários
-- componentes.
--
-- NÃO retroativo: OS antigas ficam com categoria_falha = null e
-- somem do Pareto (não contam nem como "erro").
--
-- Rodar no SQL Editor do Supabase SMERP. Idempotente.
-- ============================================================

do $$ begin
  create type manutencao.categoria_falha as enum (
    'desgaste_componente',
    'falha_eletrica',
    'ajuste_regulagem',
    'falha_mecanica',
    'falha_programa'
  );
exception when duplicate_object then null; end $$;

alter table manutencao.ordens_servico
  add column if not exists categoria_falha manutencao.categoria_falha;

notify pgrst, 'reload schema';
