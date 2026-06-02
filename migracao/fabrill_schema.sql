-- ============================================================
-- SCHEMA: fabrill   (sistema hora-hora-fabrill)
-- Estrutura consolidada das migrations do Lovable.
-- SOMENTE ESTRUTURA — sem dados. Os dados reais entram na Fase 2.
-- Rodar no SQL Editor do Supabase Studio (ou psql) do banco SMERP.
-- ============================================================

create schema if not exists fabrill;
grant usage on schema fabrill to anon, authenticated, service_role;
alter default privileges in schema fabrill grant all on tables to anon, authenticated, service_role;
alter default privileges in schema fabrill grant all on functions to anon, authenticated, service_role;
alter default privileges in schema fabrill grant all on sequences to anon, authenticated, service_role;

-- ---------- ENUM ----------
create type fabrill.app_role as enum ('pcp', 'lider', 'qualidade', 'administrador');

-- ---------- TABELAS ----------
create table fabrill.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table fabrill.machines (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references fabrill.areas(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique(area_id, name)
);

create table fabrill.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create table fabrill.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role fabrill.app_role not null,
  unique(user_id, role)
);

create table fabrill.user_areas (
  user_id uuid not null references auth.users(id) on delete cascade,
  area_id uuid not null references fabrill.areas(id) on delete cascade,
  primary key (user_id, area_id)
);

create table fabrill.production_goals (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references fabrill.machines(id) on delete cascade,
  goal_date date not null,
  goal int not null check (goal >= 0),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique(machine_id, goal_date)
);

-- machine_operators: estado FINAL (constraint antiga removida, col collaborator_id adicionada)
create table fabrill.machine_operators (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references fabrill.machines(id) on delete cascade,
  log_date date not null,
  operator_name text not null,
  collaborator_id uuid,
  updated_at timestamptz not null default now()
);

create table fabrill.production_entries (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references fabrill.machines(id) on delete cascade,
  entry_date date not null,
  hour_slot smallint not null check (hour_slot between 0 and 9),
  quantity int not null default 0 check (quantity >= 0),
  observation text,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique(machine_id, entry_date, hour_slot)
);

create table fabrill.viewer_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  name text not null,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table fabrill.overtime_days (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table fabrill.meta_justifications (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null,
  justification_date date not null,
  justification text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (machine_id, justification_date)
);

create table fabrill.production_deviations (
  id uuid primary key default gen_random_uuid(),
  deviation_date date not null,
  deviation_time time not null,
  area_id uuid not null references fabrill.areas(id) on delete restrict,
  machine_id uuid references fabrill.machines(id) on delete set null,
  item_code text not null,
  quantity numeric not null default 0,
  piece_weight numeric not null default 0,
  total_weight numeric generated always as (quantity * piece_weight) stored,
  deviation text not null,
  operator_name text,
  action_plan text,
  action_responsible text,
  photos text[] not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table fabrill.collaborators (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- ÍNDICES ----------
create index viewer_tokens_token_idx on fabrill.viewer_tokens (token) where active;
create index idx_deviations_date on fabrill.production_deviations(deviation_date desc);
create index idx_deviations_area on fabrill.production_deviations(area_id);
create unique index collaborators_area_name_uq on fabrill.collaborators (area_id, lower(name));
create unique index machine_operators_machine_day_name_uq
  on fabrill.machine_operators (machine_id, log_date, lower(operator_name));

-- ---------- FUNÇÕES (security definer) ----------
create or replace function fabrill.has_role(_user_id uuid, _role fabrill.app_role)
returns boolean language sql stable security definer set search_path = fabrill, public
as $$ select exists (select 1 from fabrill.user_roles where user_id = _user_id and role = _role) $$;

create or replace function fabrill.is_pcp(_user_id uuid)
returns boolean language sql stable security definer set search_path = fabrill, public
as $$ select fabrill.has_role(_user_id, 'pcp') $$;

create or replace function fabrill.is_qualidade(_user_id uuid)
returns boolean language sql stable security definer set search_path = fabrill, public
as $$ select fabrill.has_role(_user_id, 'qualidade') $$;

create or replace function fabrill.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = fabrill, public
as $$ select fabrill.has_role(_user_id, 'administrador') $$;

create or replace function fabrill.user_can_access_area(_user_id uuid, _area_id uuid)
returns boolean language sql stable security definer set search_path = fabrill, public
as $$
  select fabrill.is_pcp(_user_id)
      or exists (select 1 from fabrill.user_areas where user_id = _user_id and area_id = _area_id)
$$;

create or replace function fabrill.user_can_access_machine(_user_id uuid, _machine_id uuid)
returns boolean language sql stable security definer set search_path = fabrill, public
as $$
  select exists (
    select 1 from fabrill.machines m
    where m.id = _machine_id and fabrill.user_can_access_area(_user_id, m.area_id)
  )
$$;

-- profile automático + promoção do 1º usuário (com TRAVA por sistema via metadado 'app')
create or replace function fabrill.handle_new_user()
returns trigger language plpgsql security definer set search_path = fabrill, public
as $$
begin
  if (new.raw_user_meta_data->>'app') is distinct from 'fabrill' then
    return new;
  end if;
  insert into fabrill.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function fabrill.handle_first_user_pcp()
returns trigger language plpgsql security definer set search_path = fabrill, public
as $$
begin
  if (new.raw_user_meta_data->>'app') is distinct from 'fabrill' then
    return new;
  end if;
  if (select count(*) from fabrill.user_roles) = 0 then
    insert into fabrill.user_roles (user_id, role) values (new.id, 'pcp');
  end if;
  return new;
end;
$$;

create trigger fabrill_on_auth_user_created
  after insert on auth.users
  for each row execute function fabrill.handle_new_user();

create trigger fabrill_on_auth_user_created_promote_pcp
  after insert on auth.users
  for each row execute function fabrill.handle_first_user_pcp();

-- ---------- RLS ----------
alter table fabrill.areas enable row level security;
alter table fabrill.machines enable row level security;
alter table fabrill.profiles enable row level security;
alter table fabrill.user_roles enable row level security;
alter table fabrill.user_areas enable row level security;
alter table fabrill.production_goals enable row level security;
alter table fabrill.machine_operators enable row level security;
alter table fabrill.production_entries enable row level security;
alter table fabrill.viewer_tokens enable row level security;
alter table fabrill.overtime_days enable row level security;
alter table fabrill.meta_justifications enable row level security;
alter table fabrill.production_deviations enable row level security;
alter table fabrill.collaborators enable row level security;

-- areas
create policy "areas read auth" on fabrill.areas for select to authenticated using (true);
create policy "areas write pcp" on fabrill.areas for all to authenticated
  using (fabrill.is_pcp(auth.uid())) with check (fabrill.is_pcp(auth.uid()));
-- machines
create policy "machines read auth" on fabrill.machines for select to authenticated using (true);
create policy "machines write pcp" on fabrill.machines for all to authenticated
  using (fabrill.is_pcp(auth.uid())) with check (fabrill.is_pcp(auth.uid()));
-- profiles
create policy "profile self read" on fabrill.profiles for select to authenticated
  using (id = auth.uid() or fabrill.is_pcp(auth.uid()));
create policy "profile self update" on fabrill.profiles for update to authenticated
  using (id = auth.uid() or fabrill.is_pcp(auth.uid()));
create policy "profile pcp insert" on fabrill.profiles for insert to authenticated
  with check (fabrill.is_pcp(auth.uid()) or id = auth.uid());
-- user_roles
create policy "roles read self or pcp" on fabrill.user_roles for select to authenticated
  using (user_id = auth.uid() or fabrill.is_pcp(auth.uid()));
create policy "roles write pcp" on fabrill.user_roles for all to authenticated
  using (fabrill.is_pcp(auth.uid())) with check (fabrill.is_pcp(auth.uid()));
-- user_areas
create policy "user_areas read self or pcp" on fabrill.user_areas for select to authenticated
  using (user_id = auth.uid() or fabrill.is_pcp(auth.uid()));
create policy "user_areas write pcp" on fabrill.user_areas for all to authenticated
  using (fabrill.is_pcp(auth.uid())) with check (fabrill.is_pcp(auth.uid()));
-- production_goals (estado FINAL: read auth + insert pcp/admin + update/delete admin)
create policy "goals read auth" on fabrill.production_goals for select to authenticated using (true);
create policy "goals insert pcp or admin" on fabrill.production_goals for insert to authenticated
  with check (fabrill.is_pcp(auth.uid()) or fabrill.is_admin(auth.uid()));
create policy "goals update admin only" on fabrill.production_goals for update to authenticated
  using (fabrill.is_admin(auth.uid())) with check (fabrill.is_admin(auth.uid()));
create policy "goals delete admin only" on fabrill.production_goals for delete to authenticated
  using (fabrill.is_admin(auth.uid()));
-- machine_operators
create policy "operators read scoped" on fabrill.machine_operators for select to authenticated
  using (fabrill.user_can_access_machine(auth.uid(), machine_id));
create policy "operators write scoped" on fabrill.machine_operators for all to authenticated
  using (fabrill.user_can_access_machine(auth.uid(), machine_id))
  with check (fabrill.user_can_access_machine(auth.uid(), machine_id));
-- production_entries
create policy "entries read scoped" on fabrill.production_entries for select to authenticated
  using (fabrill.user_can_access_machine(auth.uid(), machine_id));
create policy "entries write scoped" on fabrill.production_entries for all to authenticated
  using (fabrill.user_can_access_machine(auth.uid(), machine_id))
  with check (fabrill.user_can_access_machine(auth.uid(), machine_id));
-- viewer_tokens
create policy "viewer_tokens pcp all" on fabrill.viewer_tokens for all to authenticated
  using (fabrill.is_pcp(auth.uid())) with check (fabrill.is_pcp(auth.uid()));
-- overtime_days
create policy "overtime read auth" on fabrill.overtime_days for select to authenticated using (true);
create policy "overtime write pcp" on fabrill.overtime_days for all to authenticated
  using (fabrill.is_pcp(auth.uid())) with check (fabrill.is_pcp(auth.uid()));
-- meta_justifications
create policy "justif read scoped" on fabrill.meta_justifications for select to authenticated
  using (fabrill.user_can_access_machine(auth.uid(), machine_id));
create policy "justif write scoped" on fabrill.meta_justifications for all to authenticated
  using (fabrill.user_can_access_machine(auth.uid(), machine_id))
  with check (fabrill.user_can_access_machine(auth.uid(), machine_id));
-- production_deviations
create policy "deviations read pcp or qualidade" on fabrill.production_deviations for select to authenticated
  using (fabrill.is_pcp(auth.uid()) or fabrill.is_qualidade(auth.uid()));
create policy "deviations insert qualidade" on fabrill.production_deviations for insert to authenticated
  with check (fabrill.is_qualidade(auth.uid()));
create policy "deviations update qualidade" on fabrill.production_deviations for update to authenticated
  using (fabrill.is_qualidade(auth.uid())) with check (fabrill.is_qualidade(auth.uid()));
create policy "deviations delete qualidade" on fabrill.production_deviations for delete to authenticated
  using (fabrill.is_qualidade(auth.uid()));
-- collaborators
create policy "collaborators read scoped" on fabrill.collaborators for select to authenticated
  using (fabrill.user_can_access_area(auth.uid(), area_id));
create policy "collaborators write scoped" on fabrill.collaborators for all to authenticated
  using (fabrill.user_can_access_area(auth.uid(), area_id))
  with check (fabrill.user_can_access_area(auth.uid(), area_id));

-- ---------- GRANTS explícitos (garantia) ----------
grant select, insert, update, delete on all tables in schema fabrill to authenticated;
grant all on all tables in schema fabrill to service_role;

-- ---------- STORAGE: bucket + policies (nomes prefixados p/ não colidir) ----------
insert into storage.buckets (id, name, public)
values ('deviation-photos', 'deviation-photos', true)
on conflict (id) do nothing;

create policy "fabrill deviation-photos public read" on storage.objects for select
  using (bucket_id = 'deviation-photos');
create policy "fabrill deviation-photos qualidade insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'deviation-photos' and fabrill.is_qualidade(auth.uid()));
create policy "fabrill deviation-photos qualidade update" on storage.objects for update to authenticated
  using (bucket_id = 'deviation-photos' and fabrill.is_qualidade(auth.uid()));
create policy "fabrill deviation-photos qualidade delete" on storage.objects for delete to authenticated
  using (bucket_id = 'deviation-photos' and fabrill.is_qualidade(auth.uid()));
