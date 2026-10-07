-- ============================================================
-- schema teste — Acidentes e Afastamentos sai de "TESTE"
-- Troca o acesso só-master por papéis liberados na aba Usuários do Hub:
--   admin | sesmt  → lançam, editam e excluem (acidentes + ações corretivas)
--   leitor         → só consulta (dashboard e registros)
--   master         → sempre editor, mesmo sem papel
-- O schema continua se chamando 'teste' (interno, ninguém vê).
-- Rodar DEPOIS de teste_schema.sql, teste_acoes_corretivas_schema.sql e
-- teste_colaboradores_rh_view.sql. Idempotente.
-- ============================================================

-- ---------- ENUM ----------
do $$ begin
  create type teste.app_role as enum ('admin', 'sesmt', 'leitor');
exception when duplicate_object then null; end $$;

-- ---------- PROFILES (espelho de auth.users) ----------
create table if not exists teste.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  email      text,
  updated_at timestamptz default now()
);

-- ---------- PAPÉIS ----------
create table if not exists teste.user_roles (
  id         bigint primary key generated always as identity,
  user_id    uuid not null references teste.profiles(id) on delete cascade,
  role       teste.app_role not null,
  unique (user_id, role)
);

-- ---------- FUNÇÕES AUXILIARES (security definer) ----------
-- membro = tem profile no schema teste (ou é master)
create or replace function teste.is_member(_user_id uuid)
returns boolean
language sql stable security definer set search_path = teste, public
as $$
  select exists (select 1 from teste.profiles where id = _user_id)
      or teste.is_master(_user_id)
$$;

-- editor = admin | sesmt | master
create or replace function teste.is_editor(_user_id uuid)
returns boolean
language sql stable security definer set search_path = teste, public
as $$
  select exists (
      select 1 from teste.user_roles
      where user_id = _user_id
        and role in ('admin'::teste.app_role, 'sesmt'::teste.app_role)
    )
    or teste.is_master(_user_id)
$$;

-- ---------- RLS ----------
alter table teste.profiles   enable row level security;
alter table teste.user_roles enable row level security;

drop policy if exists "Own profile" on teste.profiles;
create policy "Own profile" on teste.profiles
  for all to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Own roles" on teste.user_roles;
create policy "Own roles" on teste.user_roles
  for select to authenticated
  using (auth.uid() = user_id);

-- acidentes: troca as policies só-master
drop policy if exists "Acidentes select (master)" on teste.acidentes;
drop policy if exists "Acidentes insert (master)" on teste.acidentes;
drop policy if exists "Acidentes update (master)" on teste.acidentes;
drop policy if exists "Acidentes delete (master)" on teste.acidentes;
drop policy if exists "Acidentes read"   on teste.acidentes;
drop policy if exists "Acidentes insert" on teste.acidentes;
drop policy if exists "Acidentes update" on teste.acidentes;
drop policy if exists "Acidentes delete" on teste.acidentes;

create policy "Acidentes read" on teste.acidentes
  for select to authenticated
  using (teste.is_member(auth.uid()));

create policy "Acidentes insert" on teste.acidentes
  for insert to authenticated
  with check (teste.is_editor(auth.uid()));

create policy "Acidentes update" on teste.acidentes
  for update to authenticated
  using (teste.is_editor(auth.uid()))
  with check (teste.is_editor(auth.uid()));

create policy "Acidentes delete" on teste.acidentes
  for delete to authenticated
  using (teste.is_editor(auth.uid()));

-- ações corretivas: idem
drop policy if exists "Acoes select (master)" on teste.acoes_corretivas;
drop policy if exists "Acoes insert (master)" on teste.acoes_corretivas;
drop policy if exists "Acoes update (master)" on teste.acoes_corretivas;
drop policy if exists "Acoes delete (master)" on teste.acoes_corretivas;
drop policy if exists "Acoes read"   on teste.acoes_corretivas;
drop policy if exists "Acoes insert" on teste.acoes_corretivas;
drop policy if exists "Acoes update" on teste.acoes_corretivas;
drop policy if exists "Acoes delete" on teste.acoes_corretivas;

create policy "Acoes read" on teste.acoes_corretivas
  for select to authenticated
  using (teste.is_member(auth.uid()));

create policy "Acoes insert" on teste.acoes_corretivas
  for insert to authenticated
  with check (teste.is_editor(auth.uid()));

create policy "Acoes update" on teste.acoes_corretivas
  for update to authenticated
  using (teste.is_editor(auth.uid()))
  with check (teste.is_editor(auth.uid()));

create policy "Acoes delete" on teste.acoes_corretivas
  for delete to authenticated
  using (teste.is_editor(auth.uid()));

-- ---------- VIEW DO RH ----------
-- A view não é security_invoker (ignora a RLS de rh.colaboradores), então
-- filtra aqui: só quem lança (editor) enxerga a lista de colaboradores.
create or replace view teste.colaboradores_rh as
  select nome, setor, admissao
  from rh.colaboradores
  where ativo = true
    and teste.is_editor(auth.uid())
  order by nome;

grant select on teste.colaboradores_rh to authenticated, service_role;

-- ---------- GRANTS ----------
grant usage on schema teste to authenticated, service_role;
grant select, insert, update, delete on teste.profiles, teste.user_roles to authenticated;
grant all on teste.profiles, teste.user_roles to service_role;
grant all on all sequences in schema teste to authenticated, service_role;
grant execute on function teste.is_member(uuid) to authenticated;
grant execute on function teste.is_editor(uuid) to authenticated;

notify pgrst, 'reload schema';

-- Depois deste arquivo, rodar de novo (nesta ordem):
--   1) migracao/admin_users.sql          (aba Usuários passa a liberar 'teste')
--   2) migracao/my_systems.sql           (os DOIS arquivos de my_systems,
--   3) migracao/utilitarios-my-systems.sql  ver memória my-systems-dois-arquivos)
--
-- Teste rápido (como um usuário liberado):
--   select teste.is_member(auth.uid()), teste.is_editor(auth.uid());
--   select count(*) from teste.acidentes;
