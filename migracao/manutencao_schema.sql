-- ============================================================
-- SCHEMA: manutencao   (sistema pro-care / "Pro-Care" — Gestão de Manutenção/CMMS)
-- ------------------------------------------------------------
-- Consolidação das migrations do Lovable num schema próprio do banco
-- unificado SMERP. SOMENTE ESTRUTURA (sem dados/seeds) — os dados entram
-- na Fase 2 via import preservando ids/usuários.
--
-- Papéis REAIS (gating de escrita): admin, manutencao, producao.
--   - admin/manutencao: editam cadastros, fecham OS, mexem no estoque.
--   - producao: abre chamado (OS) e consulta.
--
-- Gotchas de schema COMPARTILHADO (auth.users e storage.objects são globais):
--   - trigger em auth.users com nome prefixado + travado por app='manutencao';
--   - policies de storage.objects com nome prefixado (nome é global);
--   - funções movidas pro schema 'manutencao'.
--
-- Rodar no SQL Editor do Supabase SMERP. Idempotente: pode reexecutar.
-- Ao final, lembrar de expor o schema no PostgREST:
--   PGRST_DB_SCHEMAS = ...,manutencao   (EasyPanel) + notify pgrst, 'reload schema';
-- ============================================================

create schema if not exists manutencao;
grant usage on schema manutencao to anon, authenticated, service_role;
alter default privileges in schema manutencao grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema manutencao grant all on functions to anon, authenticated, service_role;
alter default privileges in schema manutencao grant all on sequences to anon, authenticated, service_role;

-- ============================================================
-- ENUMS (idempotentes)
-- ============================================================
do $$ begin create type manutencao.app_role          as enum ('admin','manutencao','producao');                    exception when duplicate_object then null; end $$;
do $$ begin create type manutencao.maquina_status     as enum ('ok','chamado_aberto','parada');                      exception when duplicate_object then null; end $$;
do $$ begin create type manutencao.especialidade      as enum ('mecanico','eletricista','outros','pcm');             exception when duplicate_object then null; end $$;
do $$ begin create type manutencao.os_status          as enum ('aberta','em_andamento','fechada');                   exception when duplicate_object then null; end $$;
do $$ begin create type manutencao.preventiva_status  as enum ('agendada','concluida','antecipada','prorrogada','cancelada','atrasada'); exception when duplicate_object then null; end $$;
do $$ begin create type manutencao.estoque_mov_tipo   as enum ('entrada','saida','inventario');                      exception when duplicate_object then null; end $$;

-- ============================================================
-- FUNÇÃO HELPER (não referencia tabelas — pode vir antes delas)
-- ============================================================
create or replace function manutencao.update_updated_at()
returns trigger language plpgsql set search_path = manutencao, public
as $$ begin new.updated_at = now(); return new; end; $$;

-- ============================================================
-- TABELAS — ROLES / PERFIS
-- ============================================================
create table if not exists manutencao.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists manutencao.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role manutencao.app_role not null,
  unique (user_id, role)
);

-- has_role: definida AQUI (depois de user_roles) porque é `language sql` e o
-- Postgres valida o corpo na criação — a tabela precisa já existir.
create or replace function manutencao.has_role(_user_id uuid, _role manutencao.app_role)
returns boolean language sql stable security definer set search_path = manutencao, public
as $$ select exists (select 1 from manutencao.user_roles where user_id = _user_id and role = _role) $$;

-- profile + papel padrão (producao) no signup, COM trava por sistema (app='manutencao').
-- No SMERP o acesso é dado pela aba "Usuários" do hub (insere profile+papel direto),
-- então essa trava garante que cadastros de OUTROS apps não ganhem acesso à Manutenção.
create or replace function manutencao.handle_new_user()
returns trigger language plpgsql security definer set search_path = manutencao, public
as $$
begin
  if (new.raw_user_meta_data->>'app') is distinct from 'manutencao' then
    return new;
  end if;
  insert into manutencao.profiles (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), new.email)
  on conflict (id) do nothing;
  insert into manutencao.user_roles (user_id, role)
  values (new.id, 'producao')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

-- ============================================================
-- TABELAS — DOMÍNIO
-- ============================================================
create table if not exists manutencao.setores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  responsavel text,
  localizacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists manutencao.maquinas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text not null unique,
  setor_id uuid references manutencao.setores(id) on delete set null,
  data_aquisicao date,
  manual_url text,
  status manutencao.maquina_status not null default 'ok',
  miniatura_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists manutencao.tecnicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  especialidade manutencao.especialidade not null default 'mecanico',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists manutencao.ordens_servico (
  id uuid primary key default gen_random_uuid(),
  numero serial unique,
  solicitante_id uuid references auth.users(id) on delete set null,
  solicitante_nome text not null,
  setor_id uuid references manutencao.setores(id) on delete set null,
  maquina_id uuid references manutencao.maquinas(id) on delete set null,
  descricao_problema text not null,
  maquina_parada boolean not null default false,
  aberto_em timestamptz not null default now(),
  -- fechamento
  diagnostico text,
  possivel_causa text,
  servico_executado text,
  pecas_utilizadas text,
  numero_solicitacao_compra text,
  tecnico_id uuid references manutencao.tecnicos(id) on delete set null,
  midia_urls text[] default '{}',
  fechado_em timestamptz,
  status manutencao.os_status not null default 'aberta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists manutencao.estoque_itens (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  descricao text not null,
  quantidade integer not null default 0,
  localizacao text,
  foto_url text,
  maquina_id uuid references manutencao.maquinas(id) on delete set null,
  limite_inferior integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists manutencao.estoque_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references manutencao.estoque_itens(id) on delete cascade,
  tipo manutencao.estoque_mov_tipo not null,
  quantidade integer not null,
  quantidade_anterior integer not null,
  quantidade_nova integer not null,
  observacao text,
  user_id uuid,                                  -- referencia auth.users (sem FK, fiel ao Lovable)
  created_at timestamptz not null default now()
);

create table if not exists manutencao.preventivas (
  id uuid primary key default gen_random_uuid(),
  maquina_id uuid not null references manutencao.maquinas(id) on delete cascade,
  data_agendada date not null,
  data_executada date,
  pecas_necessarias text,
  checklist jsonb not null default '[]'::jsonb,
  status manutencao.preventiva_status not null default 'agendada',
  justificativa text,
  tecnico_id uuid references manutencao.tecnicos(id) on delete set null,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists manutencao.maquina_documentos (
  id uuid primary key default gen_random_uuid(),
  maquina_id uuid not null references manutencao.maquinas(id) on delete cascade,
  nome text not null,
  arquivo_path text not null,
  created_at timestamptz not null default now()
);

-- ---------- ÍNDICES ----------
create index if not exists idx_estoque_mov_item on manutencao.estoque_movimentacoes(item_id, created_at desc);

-- ============================================================
-- FUNÇÃO: sincroniza status da máquina conforme as OS abertas
-- ============================================================
create or replace function manutencao.sync_maquina_status()
returns trigger language plpgsql security definer set search_path = manutencao, public
as $$
declare
  mid uuid;
  has_parada boolean;
  has_aberta boolean;
begin
  mid := coalesce(new.maquina_id, old.maquina_id);
  if mid is null then return new; end if;

  select exists(select 1 from manutencao.ordens_servico where maquina_id = mid and status <> 'fechada' and maquina_parada = true) into has_parada;
  select exists(select 1 from manutencao.ordens_servico where maquina_id = mid and status <> 'fechada') into has_aberta;

  update manutencao.maquinas
  set status = case
    when has_parada then 'parada'::manutencao.maquina_status
    when has_aberta then 'chamado_aberto'::manutencao.maquina_status
    else 'ok'::manutencao.maquina_status
  end
  where id = mid;

  return new;
end;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================
-- em auth.users (COMPARTILHADA) — nome prefixado p/ não colidir com os outros apps
drop trigger if exists manutencao_on_auth_user_created on auth.users;
create trigger manutencao_on_auth_user_created
  after insert on auth.users
  for each row execute function manutencao.handle_new_user();

drop trigger if exists trg_setores_updated on manutencao.setores;
create trigger trg_setores_updated before update on manutencao.setores
  for each row execute function manutencao.update_updated_at();

drop trigger if exists trg_maquinas_updated on manutencao.maquinas;
create trigger trg_maquinas_updated before update on manutencao.maquinas
  for each row execute function manutencao.update_updated_at();

drop trigger if exists trg_tecnicos_updated on manutencao.tecnicos;
create trigger trg_tecnicos_updated before update on manutencao.tecnicos
  for each row execute function manutencao.update_updated_at();

drop trigger if exists trg_os_updated on manutencao.ordens_servico;
create trigger trg_os_updated before update on manutencao.ordens_servico
  for each row execute function manutencao.update_updated_at();

drop trigger if exists trg_os_sync_maquina on manutencao.ordens_servico;
create trigger trg_os_sync_maquina after insert or update or delete on manutencao.ordens_servico
  for each row execute function manutencao.sync_maquina_status();

drop trigger if exists trg_estoque_updated on manutencao.estoque_itens;
create trigger trg_estoque_updated before update on manutencao.estoque_itens
  for each row execute function manutencao.update_updated_at();

drop trigger if exists trg_prev_updated on manutencao.preventivas;
create trigger trg_prev_updated before update on manutencao.preventivas
  for each row execute function manutencao.update_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table manutencao.profiles               enable row level security;
alter table manutencao.user_roles             enable row level security;
alter table manutencao.setores                enable row level security;
alter table manutencao.maquinas               enable row level security;
alter table manutencao.tecnicos               enable row level security;
alter table manutencao.ordens_servico         enable row level security;
alter table manutencao.estoque_itens          enable row level security;
alter table manutencao.estoque_movimentacoes  enable row level security;
alter table manutencao.preventivas            enable row level security;
alter table manutencao.maquina_documentos     enable row level security;

-- profiles: todo autenticado lê; cada um edita o próprio (fiel ao Lovable)
drop policy if exists "profiles_select_all" on manutencao.profiles;
create policy "profiles_select_all" on manutencao.profiles for select to authenticated using (true);
drop policy if exists "profiles_update_own" on manutencao.profiles;
create policy "profiles_update_own" on manutencao.profiles for update to authenticated using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on manutencao.profiles;
create policy "profiles_insert_own" on manutencao.profiles for insert to authenticated with check (auth.uid() = id);

-- user_roles: cada um vê os próprios; admin gerencia
drop policy if exists "user_roles_select_own" on manutencao.user_roles;
create policy "user_roles_select_own" on manutencao.user_roles for select to authenticated
  using (user_id = auth.uid() or manutencao.has_role(auth.uid(), 'admin'));
drop policy if exists "user_roles_admin_manage" on manutencao.user_roles;
create policy "user_roles_admin_manage" on manutencao.user_roles for all to authenticated
  using (manutencao.has_role(auth.uid(), 'admin')) with check (manutencao.has_role(auth.uid(), 'admin'));

-- setores / maquinas / tecnicos / estoque: leitura p/ autenticado; escrita admin|manutencao
drop policy if exists "setores_read"  on manutencao.setores;
create policy "setores_read"  on manutencao.setores  for select to authenticated using (true);
drop policy if exists "setores_write" on manutencao.setores;
create policy "setores_write" on manutencao.setores  for all to authenticated
  using (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'))
  with check (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'));

drop policy if exists "maquinas_read"  on manutencao.maquinas;
create policy "maquinas_read"  on manutencao.maquinas for select to authenticated using (true);
drop policy if exists "maquinas_write" on manutencao.maquinas;
create policy "maquinas_write" on manutencao.maquinas for all to authenticated
  using (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'))
  with check (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'));

drop policy if exists "tecnicos_read"  on manutencao.tecnicos;
create policy "tecnicos_read"  on manutencao.tecnicos for select to authenticated using (true);
drop policy if exists "tecnicos_write" on manutencao.tecnicos;
create policy "tecnicos_write" on manutencao.tecnicos for all to authenticated
  using (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'))
  with check (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'));

-- ordens de serviço: todos leem; qualquer autenticado abre; admin|manutencao fecham/editam; admin apaga
drop policy if exists "os_read"   on manutencao.ordens_servico;
create policy "os_read"   on manutencao.ordens_servico for select to authenticated using (true);
drop policy if exists "os_insert" on manutencao.ordens_servico;
create policy "os_insert" on manutencao.ordens_servico for insert to authenticated with check (auth.uid() is not null);
drop policy if exists "os_update" on manutencao.ordens_servico;
create policy "os_update" on manutencao.ordens_servico for update to authenticated
  using (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'));
drop policy if exists "os_delete" on manutencao.ordens_servico;
create policy "os_delete" on manutencao.ordens_servico for delete to authenticated
  using (manutencao.has_role(auth.uid(),'admin'));

-- estoque de peças: leitura p/ autenticado; escrita admin|manutencao
drop policy if exists "estoque_read"  on manutencao.estoque_itens;
create policy "estoque_read"  on manutencao.estoque_itens for select to authenticated using (true);
drop policy if exists "estoque_write" on manutencao.estoque_itens;
create policy "estoque_write" on manutencao.estoque_itens for all to authenticated
  using (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'))
  with check (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'));

-- movimentações de estoque: todos leem; admin|manutencao inserem
drop policy if exists "mov_read"   on manutencao.estoque_movimentacoes;
create policy "mov_read"   on manutencao.estoque_movimentacoes for select to authenticated using (true);
drop policy if exists "mov_insert" on manutencao.estoque_movimentacoes;
create policy "mov_insert" on manutencao.estoque_movimentacoes for insert to authenticated
  with check (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'));

-- preventivas: leitura p/ autenticado; escrita admin|manutencao
drop policy if exists "prev_read"  on manutencao.preventivas;
create policy "prev_read"  on manutencao.preventivas for select to authenticated using (true);
drop policy if exists "prev_write" on manutencao.preventivas;
create policy "prev_write" on manutencao.preventivas for all to authenticated
  using (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'))
  with check (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'));

-- documentos de máquina: autenticado lê e gerencia (fiel ao Lovable)
drop policy if exists "maqdoc_read"   on manutencao.maquina_documentos;
create policy "maqdoc_read"   on manutencao.maquina_documentos for select to authenticated using (true);
drop policy if exists "maqdoc_manage" on manutencao.maquina_documentos;
create policy "maqdoc_manage" on manutencao.maquina_documentos for all to authenticated using (true) with check (true);

-- ============================================================
-- GRANTS / REVOKES (fiel ao Lovable + garantia p/ o PostgREST)
-- ============================================================
grant select, insert, update, delete on all tables in schema manutencao to authenticated;
grant all on all tables in schema manutencao to service_role;

revoke execute on function manutencao.has_role(uuid, manutencao.app_role)   from public, anon;
revoke execute on function manutencao.handle_new_user()                     from public, anon, authenticated;
revoke execute on function manutencao.sync_maquina_status()                 from public, anon, authenticated;

-- ============================================================
-- STORAGE: buckets + policies (nomes prefixados p/ não colidir; nome é global)
--   os-midias = PÚBLICO (app usa getPublicUrl)
--   manuais / maquina-miniaturas / estoque-fotos = PRIVADOS (signed URL)
-- ============================================================
insert into storage.buckets (id, name, public) values
  ('manuais',            'manuais',            false),
  ('os-midias',          'os-midias',          true),
  ('estoque-fotos',      'estoque-fotos',      false),
  ('maquina-miniaturas', 'maquina-miniaturas', false)
on conflict (id) do nothing;

drop policy if exists "manutencao_storage_read"   on storage.objects;
create policy "manutencao_storage_read"   on storage.objects for select to authenticated
  using (bucket_id in ('manuais','os-midias','estoque-fotos','maquina-miniaturas'));
drop policy if exists "manutencao_storage_insert" on storage.objects;
create policy "manutencao_storage_insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('manuais','os-midias','estoque-fotos','maquina-miniaturas'));
drop policy if exists "manutencao_storage_update" on storage.objects;
create policy "manutencao_storage_update" on storage.objects for update to authenticated
  using (bucket_id in ('manuais','os-midias','estoque-fotos','maquina-miniaturas'));
drop policy if exists "manutencao_storage_delete" on storage.objects;
create policy "manutencao_storage_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('manuais','os-midias','estoque-fotos','maquina-miniaturas'));

-- ============================================================
-- Recarrega o cache do PostgREST (depois de expor 'manutencao' em PGRST_DB_SCHEMAS)
-- ============================================================
notify pgrst, 'reload schema';
