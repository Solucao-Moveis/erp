-- ============================================================
-- ONDA 3 — fechar leituras que escaparam da onda1
-- Auditoria de 2026-06-11 (antes de liberar a Sila ler dados).
--
-- A onda1 corrigiu os using(true) das tabelas que existiam em 2026-06-09.
-- Estas DUAS tabelas do Compras são mais novas (migrations do comprasolucao)
-- e nasceram com leitura ABERTA (for select using(true)) — qualquer usuário
-- SSO de qualquer app lia. Aqui trocamos por compras.has_access (igual onda1:
-- "só vê se tem perfil no Compras").
--
-- Rodar no SQL Editor do Supabase SMERP. Idempotente.
-- ============================================================

-- compras.supplier_evaluations — leitura só pra membros do Compras
drop policy if exists "se_select" on compras.supplier_evaluations;
create policy "se_select" on compras.supplier_evaluations
  for select to authenticated using (compras.has_access(auth.uid()));

-- compras.purchase_entries — leitura só pra membros do Compras
drop policy if exists "pe_select" on compras.purchase_entries;
create policy "pe_select" on compras.purchase_entries
  for select to authenticated using (compras.has_access(auth.uid()));

-- ------------------------------------------------------------
-- FABRILL — fecha a escalada: um PCP NÃO pode mais se promover a
-- administrador. PCP continua gerenciando papéis comuns (pcp/lider/
-- qualidade); só ADMIN concede/edita/remove o papel 'administrador'.
-- (antes: "roles write pcp" deixava qualquer PCP escrever qualquer papel)
-- ------------------------------------------------------------
drop policy if exists "roles write pcp" on fabrill.user_roles;
create policy "roles write admin or pcp (nao-admin)" on fabrill.user_roles for all to authenticated
  using      (fabrill.is_admin(auth.uid()) or (fabrill.is_pcp(auth.uid()) and role <> 'administrador'))
  with check (fabrill.is_admin(auth.uid()) or (fabrill.is_pcp(auth.uid()) and role <> 'administrador'));

-- ------------------------------------------------------------
-- Verificação (esperado: 0 linhas) — nenhuma policy de leitura
-- aberta "true" deve sobrar nos schemas dos apps:
-- ------------------------------------------------------------
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname in ('compras','bip','fabrill','manutencao','gestao','planos_acao','sobras','frota','expedicao')
  and (qual = 'true' or with_check = 'true')
order by schemaname, tablename, policyname;
