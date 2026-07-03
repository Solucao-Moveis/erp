-- ============================================================
-- schema seguranca — Programa de Gestão e Desempenho em Segurança do Trabalho
-- App: seguranca-solucao | Papéis: admin · sesmt · lider · leitor
-- Rodar no SQL Editor do Supabase SMERP. Idempotente.
-- ============================================================

-- ---------- SCHEMA ----------
create schema if not exists seguranca;

-- ---------- ENUMS ----------
do $$ begin
  create type seguranca.app_role as enum ('admin', 'sesmt', 'lider', 'leitor');
exception when duplicate_object then null; end $$;

-- ---------- PROFILES (espelho de auth.users) ----------
create table if not exists seguranca.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  email      text,
  updated_at timestamptz default now()
);

-- ---------- PAPÉIS ----------
create table if not exists seguranca.user_roles (
  id         bigint primary key generated always as identity,
  user_id    uuid not null references seguranca.profiles(id) on delete cascade,
  role       seguranca.app_role not null,
  unique (user_id, role)
);

-- ---------- SETORES ----------
create table if not exists seguranca.setores (
  id     bigint primary key generated always as identity,
  nome   text not null unique,
  lider  text,
  ativo  boolean not null default true
);

-- ---------- AVALIACOES ----------
-- Liderança (60 pts): c_dds(10) c_reun(10) c_cip(5) c_pa(15) c_mel(10) c_epi(10)
-- Equipe    (40 pts): c_uso(10) c_org(5) c_trein(10) c_pdds(5) c_com(10)
-- nota é GERADA pelo banco; o app só precisa mandar os booleanos.
create table if not exists seguranca.avaliacoes (
  id              uuid primary key default gen_random_uuid(),
  setor           text        not null,
  ano             smallint    not null,
  mes             smallint    not null check (mes between 1 and 12),
  lider           text,
  ocorrencia      boolean     not null default false,
  ocorrencia_desc text,
  -- Liderança
  c_dds           boolean     not null default false,
  c_reun          boolean     not null default false,
  c_cip           boolean     not null default false,
  c_pa            boolean     not null default false,
  c_mel           boolean     not null default false,
  c_epi           boolean     not null default false,
  -- Equipe
  c_uso           boolean     not null default false,
  c_org           boolean     not null default false,
  c_trein         boolean     not null default false,
  c_pdds          boolean     not null default false,
  c_com           boolean     not null default false,
  -- Nota calculada pelo banco (ocorrência zera tudo)
  nota            integer generated always as (
    case when ocorrencia then 0 else
      (case when c_dds   then 10 else 0 end) +
      (case when c_reun  then 10 else 0 end) +
      (case when c_cip   then  5 else 0 end) +
      (case when c_pa    then 15 else 0 end) +
      (case when c_mel   then 10 else 0 end) +
      (case when c_epi   then 10 else 0 end) +
      (case when c_uso   then 10 else 0 end) +
      (case when c_org   then  5 else 0 end) +
      (case when c_trein then 10 else 0 end) +
      (case when c_pdds  then  5 else 0 end) +
      (case when c_com   then 10 else 0 end)
    end
  ) stored,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Um registro por setor/mês/ano
  unique (setor, ano, mes)
);

-- ---------- ÍNDICES ----------
create index if not exists idx_seg_avals_setor on seguranca.avaliacoes(setor);
create index if not exists idx_seg_avals_ano   on seguranca.avaliacoes(ano, mes);

-- ---------- FUNÇÕES AUXILIARES (security definer) ----------
-- gate de acesso: tem profile no schema seguranca?
create or replace function seguranca.is_member(_user_id uuid)
returns boolean
language sql stable security definer set search_path = seguranca, public
as $$
  select exists (select 1 from seguranca.profiles where id = _user_id)
$$;

-- verifica papel específico
create or replace function seguranca.has_role(_user_id uuid, _role seguranca.app_role)
returns boolean
language sql stable security definer set search_path = seguranca, public
as $$
  select exists (
    select 1 from seguranca.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- editor = admin | sesmt | master (usa security definer p/ acessar auth.users)
create or replace function seguranca.is_editor(_user_id uuid)
returns boolean
language sql stable security definer set search_path = seguranca, public
as $$
  select
    exists (
      select 1 from seguranca.user_roles
      where user_id = _user_id
        and role in ('admin'::seguranca.app_role, 'sesmt'::seguranca.app_role)
    )
    or exists (
      select 1 from auth.users
      where id = _user_id and lower(email) = 'master@solucaomoveis.ind.br'
    )
$$;

-- ---------- RLS ----------
alter table seguranca.profiles    enable row level security;
alter table seguranca.user_roles  enable row level security;
alter table seguranca.setores     enable row level security;
alter table seguranca.avaliacoes  enable row level security;

-- profiles: cada um vê e edita o próprio; admins/sesmt veem todos
create policy "Own profile" on seguranca.profiles
  for all to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- user_roles: cada um lê os próprios
create policy "Own roles" on seguranca.user_roles
  for select to authenticated
  using (auth.uid() = user_id);

-- setores: qualquer membro pode ler
create policy "Setores read" on seguranca.setores
  for select to authenticated
  using (seguranca.is_member(auth.uid()));

-- setores: só admin ou sesmt podem escrever
create policy "Setores write" on seguranca.setores
  for all to authenticated
  using (seguranca.is_editor(auth.uid()))
  with check (seguranca.is_editor(auth.uid()));

-- avaliações: qualquer membro pode ler
create policy "Avals read" on seguranca.avaliacoes
  for select to authenticated
  using (seguranca.is_member(auth.uid()));

-- avaliações: só admin ou sesmt (ou master) podem escrever
create policy "Avals write" on seguranca.avaliacoes
  for insert to authenticated
  with check (seguranca.is_editor(auth.uid()));

create policy "Avals update" on seguranca.avaliacoes
  for update to authenticated
  using (seguranca.is_editor(auth.uid()))
  with check (seguranca.is_editor(auth.uid()));

create policy "Avals delete" on seguranca.avaliacoes
  for delete to authenticated
  using (seguranca.is_editor(auth.uid()));

-- ---------- GRANTS ----------
grant usage on schema seguranca to authenticated, service_role;
grant select, insert, update, delete on all tables in schema seguranca to authenticated;
grant all on all tables in schema seguranca to service_role;
grant all on all sequences in schema seguranca to authenticated, service_role;
grant execute on function seguranca.is_member(uuid) to authenticated;
grant execute on function seguranca.has_role(uuid, seguranca.app_role) to authenticated;
grant execute on function seguranca.is_editor(uuid) to authenticated;

-- ---------- RECARREGA PostgREST ----------
-- Lembrete: adicionar 'seguranca' em PGRST_DB_SCHEMAS no EasyPanel do Supabase antes de rodar.
notify pgrst, 'reload schema';

-- Teste rápido (rodar como master ou sesmt):
--   select * from seguranca.setores;
--   select * from seguranca.avaliacoes;
--   select seguranca.is_member(auth.uid());
