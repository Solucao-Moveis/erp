-- ============================================================
-- SCHEMA: planos_acao   (sistema industrial25-30 / "Gestor de Projeto")
-- ------------------------------------------------------------
-- Gerenciador de projetos com plano de ação 5W2H:
--   projetos -> acoes (entregável, prazo, quem/com quem, equipe, 5W2H) -> subtarefas
--   + registros_5w2h, comentarios, historico_status, evidencias (anexos).
--
-- Consolidação das migrations do Lovable num schema próprio do banco
-- unificado SMERP. SOMENTE ESTRUTURA (sem dados/seeds) — os dados entram
-- na Fase 2 via import preservando ids/usuários.
--
-- Papéis REAIS (gating): admin, user.
--   - admin: gerencia usuários/papéis e edita qualquer perfil (aba "Usuários").
--   - user : usa o app (cria/edita projetos, ações, subtarefas, comentários...).
--
-- ⚠ SEGURANÇA: no Lovable as policies vinham com `using (true)` p/ authenticated
--   (vazaria pra QUALQUER usuário SSO de QUALQUER app). Aqui foram trocadas por
--   planos_acao.is_member(auth.uid()) — isolamento por app, espelhando sobras.has_access.
--
-- Gotchas de schema COMPARTILHADO (auth.users e storage.objects são globais):
--   - trigger em auth.users com nome prefixado + travado por app='planos_acao';
--   - policies de storage.objects com nome prefixado (nome é global);
--   - bucket 'avatars' (genérico) renomeado p/ 'planos-acao-avatars' (evita colisão).
--     'evidencias' é específico → mantido. O front usa esses mesmos nomes.
--   - funções movidas pro schema 'planos_acao'.
--
-- Rodar no SQL Editor do Supabase SMERP. Idempotente: pode reexecutar.
-- O PGRST_DB_SCHEMAS já inclui 'planos_acao' (EasyPanel); o notify no fim recarrega.
-- ============================================================

create schema if not exists planos_acao;
grant usage on schema planos_acao to anon, authenticated, service_role;
alter default privileges in schema planos_acao grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema planos_acao grant all on functions to anon, authenticated, service_role;
alter default privileges in schema planos_acao grant all on sequences to anon, authenticated, service_role;

-- ============================================================
-- ENUMS (idempotente)
-- ============================================================
do $$ begin create type planos_acao.app_role as enum ('admin','user'); exception when duplicate_object then null; end $$;

-- ============================================================
-- FUNÇÃO HELPER (não referencia tabelas — pode vir antes delas)
-- ============================================================
create or replace function planos_acao.set_updated_at()
returns trigger language plpgsql set search_path = planos_acao, public
as $$ begin new.updated_at = now(); return new; end; $$;

-- ============================================================
-- TABELAS — PERFIS / PAPÉIS
-- ============================================================
-- ATENÇÃO: aqui profiles.id é um uuid PRÓPRIO (não é o auth.users.id);
-- o vínculo com o usuário é profiles.user_id (UNIQUE). Fiel ao Lovable.
create table if not exists planos_acao.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nome text not null default '',
  cargo text default '',
  area text default '',
  avatar_url text,
  telefone text default '',
  email text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists planos_acao.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role planos_acao.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- has_role / is_member: definidas AQUI (depois das tabelas) porque são
-- `language sql` e o Postgres valida o corpo na criação.
create or replace function planos_acao.has_role(_user_id uuid, _role planos_acao.app_role)
returns boolean language sql stable security definer set search_path = planos_acao, public
as $$ select exists (select 1 from planos_acao.user_roles where user_id = _user_id and role = _role) $$;

-- gate de acesso ao sistema: tem profile no schema planos_acao?
create or replace function planos_acao.is_member(_user_id uuid)
returns boolean language sql stable security definer set search_path = planos_acao, public
as $$ select exists (select 1 from planos_acao.profiles where user_id = _user_id) $$;

-- profile + papel padrão ('user') no signup, COM trava por sistema (app='planos_acao').
-- No SMERP o acesso é dado pela aba "Usuários" do hub (insere profile+papel direto),
-- então essa trava garante que cadastros de OUTROS apps não ganhem acesso aqui.
create or replace function planos_acao.handle_new_user()
returns trigger language plpgsql security definer set search_path = planos_acao, public
as $$
begin
  if (new.raw_user_meta_data->>'app') is distinct from 'planos_acao' then
    return new;
  end if;
  insert into planos_acao.profiles (user_id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)), new.email)
  on conflict (user_id) do nothing;
  insert into planos_acao.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

-- ============================================================
-- TABELAS — DOMÍNIO
-- ============================================================
create table if not exists planos_acao.projetos (
  id uuid primary key default gen_random_uuid(),
  numero integer,
  nome text not null,
  objetivo text default '',
  observacoes text default '',
  status text not null default 'Stand-by',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists planos_acao.acoes (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references planos_acao.projetos(id) on delete cascade,
  ordem integer,
  entregavel text not null default '',
  evidencia text default '',
  prazo_estimado text default '',
  quem text default '',
  com_quem text default '',
  inicio date,
  fim date,
  justificativa text default '',
  status text not null default 'Stand-by',
  observacoes text default '',
  responsavel_id uuid references auth.users(id) on delete set null,
  equipe text[] default '{}'::text[],
  prazo_data date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists planos_acao.subtarefas (
  id uuid primary key default gen_random_uuid(),
  acao_id uuid not null references planos_acao.acoes(id) on delete cascade,
  titulo text not null,
  descricao text default '',
  status text not null default 'Stand-by',
  prazo date,
  responsavel_id uuid references auth.users(id) on delete set null,
  responsavel_nome text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists planos_acao.registros_5w2h (
  id uuid primary key default gen_random_uuid(),
  acao_id uuid not null unique references planos_acao.acoes(id) on delete cascade,
  what text default '',
  why text default '',
  where_loc text default '',
  when_date text default '',
  who text default '',
  how text default '',
  how_much text default '',
  updated_at timestamptz not null default now()
);

create table if not exists planos_acao.comentarios (
  id uuid primary key default gen_random_uuid(),
  acao_id uuid references planos_acao.acoes(id) on delete cascade,
  subtarefa_id uuid references planos_acao.subtarefas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  texto text not null,
  created_at timestamptz not null default now()
);

create table if not exists planos_acao.historico_status (
  id uuid primary key default gen_random_uuid(),
  entidade_tipo text not null,
  entidade_id uuid not null,
  status_anterior text,
  status_novo text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists planos_acao.evidencias (
  id uuid primary key default gen_random_uuid(),
  acao_id uuid not null references planos_acao.acoes(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid not null,            -- referencia auth.users (sem FK, fiel ao Lovable)
  created_at timestamptz not null default now()
);

-- ---------- ÍNDICES ----------
create index if not exists idx_planos_acao_acoes_projeto on planos_acao.acoes(projeto_id);
create index if not exists idx_planos_acao_subtarefas_acao on planos_acao.subtarefas(acao_id);
create index if not exists idx_planos_acao_evidencias_acao on planos_acao.evidencias(acao_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- em auth.users (COMPARTILHADA) — nome prefixado p/ não colidir com os outros apps
drop trigger if exists planos_acao_on_auth_user_created on auth.users;
create trigger planos_acao_on_auth_user_created
  after insert on auth.users
  for each row execute function planos_acao.handle_new_user();

drop trigger if exists trg_planos_acao_profiles_updated on planos_acao.profiles;
create trigger trg_planos_acao_profiles_updated before update on planos_acao.profiles
  for each row execute function planos_acao.set_updated_at();

drop trigger if exists trg_planos_acao_projetos_updated on planos_acao.projetos;
create trigger trg_planos_acao_projetos_updated before update on planos_acao.projetos
  for each row execute function planos_acao.set_updated_at();

drop trigger if exists trg_planos_acao_acoes_updated on planos_acao.acoes;
create trigger trg_planos_acao_acoes_updated before update on planos_acao.acoes
  for each row execute function planos_acao.set_updated_at();

drop trigger if exists trg_planos_acao_subtarefas_updated on planos_acao.subtarefas;
create trigger trg_planos_acao_subtarefas_updated before update on planos_acao.subtarefas
  for each row execute function planos_acao.set_updated_at();

drop trigger if exists trg_planos_acao_5w2h_updated on planos_acao.registros_5w2h;
create trigger trg_planos_acao_5w2h_updated before update on planos_acao.registros_5w2h
  for each row execute function planos_acao.set_updated_at();

-- ============================================================
-- RLS  (using(true) do Lovable trocado por is_member — isolamento por app)
-- ============================================================
alter table planos_acao.profiles         enable row level security;
alter table planos_acao.user_roles        enable row level security;
alter table planos_acao.projetos          enable row level security;
alter table planos_acao.acoes             enable row level security;
alter table planos_acao.subtarefas        enable row level security;
alter table planos_acao.registros_5w2h    enable row level security;
alter table planos_acao.comentarios       enable row level security;
alter table planos_acao.historico_status  enable row level security;
alter table planos_acao.evidencias        enable row level security;

-- profiles: membros leem; cada um edita o próprio; admin edita qualquer um
drop policy if exists "profiles_select_member" on planos_acao.profiles;
create policy "profiles_select_member" on planos_acao.profiles for select to authenticated
  using (planos_acao.is_member(auth.uid()));
drop policy if exists "profiles_insert_own" on planos_acao.profiles;
create policy "profiles_insert_own" on planos_acao.profiles for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "profiles_update_own" on planos_acao.profiles;
create policy "profiles_update_own" on planos_acao.profiles for update to authenticated
  using (auth.uid() = user_id);
drop policy if exists "profiles_admin_update_any" on planos_acao.profiles;
create policy "profiles_admin_update_any" on planos_acao.profiles for update to authenticated
  using (planos_acao.has_role(auth.uid(), 'admin'));

-- user_roles: cada um vê os próprios (ou admin vê tudo); admin gerencia
drop policy if exists "roles_select_own" on planos_acao.user_roles;
create policy "roles_select_own" on planos_acao.user_roles for select to authenticated
  using (user_id = auth.uid() or planos_acao.has_role(auth.uid(), 'admin'));
drop policy if exists "roles_admin_manage" on planos_acao.user_roles;
create policy "roles_admin_manage" on planos_acao.user_roles for all to authenticated
  using (planos_acao.has_role(auth.uid(), 'admin')) with check (planos_acao.has_role(auth.uid(), 'admin'));

-- projetos / acoes / subtarefas / 5w2h: membros fazem tudo
drop policy if exists "projetos_member_all" on planos_acao.projetos;
create policy "projetos_member_all" on planos_acao.projetos for all to authenticated
  using (planos_acao.is_member(auth.uid())) with check (planos_acao.is_member(auth.uid()));
drop policy if exists "acoes_member_all" on planos_acao.acoes;
create policy "acoes_member_all" on planos_acao.acoes for all to authenticated
  using (planos_acao.is_member(auth.uid())) with check (planos_acao.is_member(auth.uid()));
drop policy if exists "subtarefas_member_all" on planos_acao.subtarefas;
create policy "subtarefas_member_all" on planos_acao.subtarefas for all to authenticated
  using (planos_acao.is_member(auth.uid())) with check (planos_acao.is_member(auth.uid()));
drop policy if exists "w5h2_member_all" on planos_acao.registros_5w2h;
create policy "w5h2_member_all" on planos_acao.registros_5w2h for all to authenticated
  using (planos_acao.is_member(auth.uid())) with check (planos_acao.is_member(auth.uid()));

-- comentarios: membros leem; insere como autor; edita/apaga o próprio
drop policy if exists "coment_select_member" on planos_acao.comentarios;
create policy "coment_select_member" on planos_acao.comentarios for select to authenticated
  using (planos_acao.is_member(auth.uid()));
drop policy if exists "coment_insert_own" on planos_acao.comentarios;
create policy "coment_insert_own" on planos_acao.comentarios for insert to authenticated
  with check (planos_acao.is_member(auth.uid()) and auth.uid() = user_id);
drop policy if exists "coment_update_own" on planos_acao.comentarios;
create policy "coment_update_own" on planos_acao.comentarios for update to authenticated
  using (auth.uid() = user_id);
drop policy if exists "coment_delete_own" on planos_acao.comentarios;
create policy "coment_delete_own" on planos_acao.comentarios for delete to authenticated
  using (auth.uid() = user_id);

-- historico_status: membros leem e inserem
drop policy if exists "hist_select_member" on planos_acao.historico_status;
create policy "hist_select_member" on planos_acao.historico_status for select to authenticated
  using (planos_acao.is_member(auth.uid()));
drop policy if exists "hist_insert_member" on planos_acao.historico_status;
create policy "hist_insert_member" on planos_acao.historico_status for insert to authenticated
  with check (planos_acao.is_member(auth.uid()));

-- evidencias: membros leem; insere como autor; apaga o próprio
drop policy if exists "evidencias_select_member" on planos_acao.evidencias;
create policy "evidencias_select_member" on planos_acao.evidencias for select to authenticated
  using (planos_acao.is_member(auth.uid()));
drop policy if exists "evidencias_insert_own" on planos_acao.evidencias;
create policy "evidencias_insert_own" on planos_acao.evidencias for insert to authenticated
  with check (planos_acao.is_member(auth.uid()) and auth.uid() = uploaded_by);
drop policy if exists "evidencias_delete_own" on planos_acao.evidencias;
create policy "evidencias_delete_own" on planos_acao.evidencias for delete to authenticated
  using (auth.uid() = uploaded_by);

-- ============================================================
-- GRANTS / REVOKES (garantia p/ o PostgREST)
-- ============================================================
grant select, insert, update, delete on all tables in schema planos_acao to authenticated;
grant all on all tables in schema planos_acao to service_role;

revoke execute on function planos_acao.has_role(uuid, planos_acao.app_role) from public, anon;
revoke execute on function planos_acao.is_member(uuid)                      from public, anon;
revoke execute on function planos_acao.handle_new_user()                    from public, anon, authenticated;

-- ============================================================
-- STORAGE: buckets + policies (nomes prefixados; nome é global)
--   evidencias            = PRIVADO (signed URL) — insert/delete por dono (pasta = uid)
--   planos-acao-avatars   = PÚBLICO (getPublicUrl) — renomeado de 'avatars'
-- ============================================================
insert into storage.buckets (id, name, public) values
  ('evidencias',          'evidencias',          false),
  ('planos-acao-avatars', 'planos-acao-avatars', true)
on conflict (id) do nothing;

-- evidencias (privado): leitura p/ membro; upload/delete só na pasta do próprio usuário
drop policy if exists "planos_acao_evidencias_select" on storage.objects;
create policy "planos_acao_evidencias_select" on storage.objects for select to authenticated
  using (bucket_id = 'evidencias' and planos_acao.is_member(auth.uid()));
drop policy if exists "planos_acao_evidencias_insert" on storage.objects;
create policy "planos_acao_evidencias_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "planos_acao_evidencias_delete" on storage.objects;
create policy "planos_acao_evidencias_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and auth.uid()::text = (storage.foldername(name))[1]);

-- planos-acao-avatars (público): leitura livre; escrita p/ autenticado
drop policy if exists "planos_acao_avatars_read" on storage.objects;
create policy "planos_acao_avatars_read" on storage.objects for select
  using (bucket_id = 'planos-acao-avatars');
drop policy if exists "planos_acao_avatars_insert" on storage.objects;
create policy "planos_acao_avatars_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'planos-acao-avatars');
drop policy if exists "planos_acao_avatars_update" on storage.objects;
create policy "planos_acao_avatars_update" on storage.objects for update to authenticated
  using (bucket_id = 'planos-acao-avatars');
drop policy if exists "planos_acao_avatars_delete" on storage.objects;
create policy "planos_acao_avatars_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'planos-acao-avatars');

-- ============================================================
-- Recarrega o cache do PostgREST (planos_acao já está em PGRST_DB_SCHEMAS)
-- ============================================================
notify pgrst, 'reload schema';

-- Teste rápido (logado como um membro):
--   select planos_acao.is_member(auth.uid());
--   select * from planos_acao.projetos;   -- vazio antes da Fase 2, sem erro de permissão
