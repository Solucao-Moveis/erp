-- ============================================================
-- teste.colaboradores_rh — espelho de leitura de rh.colaboradores
-- Permite o módulo TESTE puxar nome/setor/admissão de quem já está
-- cadastrado no RH, em vez de digitar tudo de novo no Lançamento.
-- Rodar DEPOIS de teste_schema.sql. Idempotente.
--
-- Nota: é uma view "normal" (não security_invoker), então ignora a RLS
-- de rh.colaboradores (rh.is_member) — aceitável por enquanto porque o
-- módulo TESTE já é master-only na origem (teste.is_master). Se um dia
-- outros papéis entrarem no TESTE, revisar isso.
-- ============================================================

create or replace view teste.colaboradores_rh as
  select nome, setor, admissao
  from rh.colaboradores
  where ativo = true
  order by nome;

grant select on teste.colaboradores_rh to authenticated, service_role;

notify pgrst, 'reload schema';

-- Teste rápido (como master, via app teste):
--   select * from teste.colaboradores_rh where nome ilike '%silva%';
