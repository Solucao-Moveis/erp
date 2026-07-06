-- ============================================================
-- schema rh — Indicadores de RH (Absenteísmo & Turnover)
-- App: rh-solucao | Papel único: usuario (acesso total)
-- v2: adiciona auth (profiles/user_roles/RLS) ao schema já existente.
--     Não apaga dados de rh.meses, rh.setores_dados, rh.config, rh.diario.
-- Rodar no SQL Editor do Supabase SMERP. Idempotente.
-- ============================================================

-- ---------- SCHEMA (já existe, mas idempotente) ----------
create schema if not exists rh;

-- ---------- ENUM DE PAPÉIS ----------
do $$ begin
  create type rh.app_role as enum ('usuario');
exception when duplicate_object then null; end $$;

-- ---------- PROFILES (espelho de auth.users — quem tem acesso ao módulo) ----------
create table if not exists rh.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  email      text,
  updated_at timestamptz default now()
);

-- ---------- PAPÉIS (papel único: usuario) ----------
create table if not exists rh.user_roles (
  id         bigint primary key generated always as identity,
  user_id    uuid not null references rh.profiles(id) on delete cascade,
  role       rh.app_role not null,
  unique (user_id, role)
);

-- ---------- HELPER: is_member (security definer) ----------
-- Evita "permission denied for table users" quando a policy executa.
create or replace function rh.is_member(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = rh
as $$
  select exists (select 1 from rh.profiles where id = _uid);
$$;

-- ---------- REMOVER POLICIES ANTIGAS (anon_all) ----------
-- As policies abertas do standalone original são substituídas por RLS autenticada.
drop policy if exists anon_all on rh.meses;
drop policy if exists anon_all on rh.setores_dados;
drop policy if exists anon_all on rh.config;
drop policy if exists anon_all on rh.diario;

-- Revogar grants antigos de anon (o schema era aberto sem login)
revoke all on schema rh from anon;
revoke all on all tables in schema rh from anon;

-- ---------- RLS: ATIVAR EM TODAS AS TABELAS ----------
alter table rh.meses          enable row level security;
alter table rh.setores_dados  enable row level security;
alter table rh.config         enable row level security;
alter table rh.diario         enable row level security;
alter table rh.profiles       enable row level security;
alter table rh.user_roles     enable row level security;

-- ---------- POLICIES: membro vê e edita tudo ----------

-- profiles: membro lê todos os profiles do módulo; edita só o próprio
drop policy if exists rh_profiles_select on rh.profiles;
create policy rh_profiles_select on rh.profiles
  for select to authenticated
  using (rh.is_member(auth.uid()));

drop policy if exists rh_profiles_update on rh.profiles;
create policy rh_profiles_update on rh.profiles
  for update to authenticated
  using (id = auth.uid());

-- user_roles: membro lê seus papéis
drop policy if exists rh_roles_select on rh.user_roles;
create policy rh_roles_select on rh.user_roles
  for select to authenticated
  using (rh.is_member(auth.uid()));

-- meses: membro lê e escreve
drop policy if exists rh_meses_all on rh.meses;
create policy rh_meses_all on rh.meses
  for all to authenticated
  using (rh.is_member(auth.uid()))
  with check (rh.is_member(auth.uid()));

-- setores_dados: membro lê e escreve
drop policy if exists rh_setores_all on rh.setores_dados;
create policy rh_setores_all on rh.setores_dados
  for all to authenticated
  using (rh.is_member(auth.uid()))
  with check (rh.is_member(auth.uid()));

-- config: membro lê e escreve (metas/benchmark)
drop policy if exists rh_config_all on rh.config;
create policy rh_config_all on rh.config
  for all to authenticated
  using (rh.is_member(auth.uid()))
  with check (rh.is_member(auth.uid()));

-- diario: membro lê e escreve
drop policy if exists rh_diario_all on rh.diario;
create policy rh_diario_all on rh.diario
  for all to authenticated
  using (rh.is_member(auth.uid()))
  with check (rh.is_member(auth.uid()));

-- ---------- GRANTS ----------
grant usage on schema rh to authenticated, service_role;
grant select, insert, update, delete on all tables in schema rh to authenticated, service_role;
grant all on all sequences in schema rh to authenticated, service_role;
grant execute on function rh.is_member(uuid) to authenticated, service_role;

-- Para tabelas criadas no futuro no schema rh:
alter default privileges in schema rh
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema rh
  grant all on sequences to authenticated, service_role;

-- ---------- EXPOSIÇÃO NO POSTGREST ----------
-- ATENÇÃO (manual): Adicionar 'rh' em db-schemas nas configurações do
-- Supabase/EasyPanel (variável PGRST_DB_SCHEMAS) para o schema aparecer na
-- API REST com Accept-Profile: rh. Sem isso, o app não consegue consultar.

-- ---------- TESTE ----------
-- (logado como membro de rh): deve retornar true
--   select rh.is_member(auth.uid());
-- (membro): deve retornar dados de 2025
--   select * from rh.meses where ano = 2025 order by mes;
-- (master): verificar profiles
--   select * from rh.profiles;
