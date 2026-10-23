-- ============================================================
-- MANUTENÇÃO - Título e prioridade da OS (nova tela de abertura)
-- ------------------------------------------------------------
-- titulo: frase curta que vira o título da linha na lista.
--   OS antigas ficam com null e a tela mostra a descrição.
-- prioridade: P1 crítica, P2 alta, P3 média, P4 evolutiva.
--   OS antigas recebem P3 (padrão).
-- O responsável na abertura usa o tecnico_id que já existe.
--
-- Rodar no SQL Editor do Supabase SMERP ANTES do deploy do app.
-- Idempotente.
-- ============================================================

do $$ begin
  create type manutencao.os_prioridade as enum ('P1', 'P2', 'P3', 'P4');
exception when duplicate_object then null; end $$;

alter table manutencao.ordens_servico
  add column if not exists titulo text,
  add column if not exists prioridade manutencao.os_prioridade not null default 'P3';

notify pgrst, 'reload schema';
