-- ============================================================
-- SCHEMA: sobras   (sistema surplus-stock-flow / "Gestor de Sobras")
-- Estrutura consolidada das migrations do Lovable.
-- SOMENTE ESTRUTURA — app começa ZERADO (sem dados).
-- Acesso "todo mundo igual": quem tiver profile no schema `sobras` usa tudo.
--   (papel único 'usuario' por enquanto; dá pra criar admin/operador depois.)
-- Rodar no SQL Editor do Supabase SMERP. Roda do começo ao fim.
-- ============================================================

create schema if not exists sobras;
grant usage on schema sobras to anon, authenticated, service_role;
alter default privileges in schema sobras grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema sobras grant all on functions to anon, authenticated, service_role;
alter default privileges in schema sobras grant all on sequences to anon, authenticated, service_role;

-- ---------- ENUMS ----------
create type sobras.sector_type      as enum ('Metalurgia', 'Solda', 'Pintura', 'Montagem');
create type sobras.movement_type    as enum ('in', 'out');
create type sobras.location_type    as enum ('Manoel Maia', 'Fábrica');
create type sobras.montagem_category as enum ('Produção', 'Amostra de Certificação');
-- papel único por enquanto (decisão: "todo mundo igual")
create type sobras.app_role          as enum ('usuario');

-- ---------- TABELAS ----------
create table sobras.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create table sobras.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role sobras.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table sobras.items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  image_url text,
  created_at timestamptz not null default now()
);

create table sobras.employees (
  id uuid primary key default gen_random_uuid(),
  registration text unique,          -- o NOT NULL foi removido numa migration posterior
  name text not null,
  sector text,
  created_at timestamptz not null default now()
);

create table sobras.inventory (
  id uuid primary key default gen_random_uuid(),
  item_code text not null,           -- originalmente item_name; renomeado p/ item_code
  quantity integer not null default 0 check (quantity >= 0),
  sector sobras.sector_type not null,
  location sobras.location_type not null default 'Fábrica',
  last_updated timestamptz not null default now(),
  -- fiel ao Lovable: a unique NÃO inclui location (mesmo o trigger usando location).
  unique (item_code, sector)
);

create table sobras.movements (
  id uuid primary key default gen_random_uuid(),
  item_code text not null,           -- originalmente item_name; renomeado p/ item_code
  type sobras.movement_type not null,
  quantity integer not null check (quantity > 0),
  sector sobras.sector_type not null,
  location sobras.location_type not null default 'Fábrica',
  motivo text,
  op_number text,                    -- obrigatória nas SAÍDAS (validado no trigger)
  operator_name text,
  montagem_category sobras.montagem_category,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- ÍNDICES ----------
create index idx_sobras_movements_created on sobras.movements(created_at desc);
create index idx_sobras_movements_item    on sobras.movements(item_code);
create index idx_sobras_inventory_item    on sobras.inventory(item_code);

-- ---------- FUNÇÕES (security definer) ----------
-- gate de acesso ao sistema: tem profile no schema sobras?
create or replace function sobras.has_access(_user_id uuid)
returns boolean
language sql stable security definer set search_path = sobras, public
as $$
  select exists (select 1 from sobras.profiles where id = _user_id)
$$;

create or replace function sobras.has_role(_user_id uuid, _role sobras.app_role)
returns boolean
language sql stable security definer set search_path = sobras, public
as $$
  select exists (select 1 from sobras.user_roles where user_id = _user_id and role = _role)
$$;

-- profile automático no signup, COM trava por sistema (metadado app='sobras').
-- No SMERP o acesso é dado pela aba "Usuários" (insere o profile direto), então
-- essa trava garante que cadastros normais do hub NÃO ganhem acesso ao sobras.
create or replace function sobras.handle_new_user()
returns trigger
language plpgsql security definer set search_path = sobras, public
as $$
begin
  if (new.raw_user_meta_data->>'app') is distinct from 'sobras' then
    return new;
  end if;

  insert into sobras.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;

  insert into sobras.user_roles (user_id, role) values (new.id, 'usuario')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

-- aplica a movimentação no estoque (entrada/saída) e valida OP na saída.
create or replace function sobras.apply_movement()
returns trigger
language plpgsql security definer set search_path = sobras, public
as $$
declare
  current_qty integer;
begin
  if new.type = 'out' and (new.op_number is null or btrim(new.op_number) = '') then
    raise exception 'OP é obrigatória para registrar uma saída';
  end if;

  select quantity into current_qty from sobras.inventory
    where item_code = new.item_code and sector = new.sector and location = new.location;

  if new.type = 'in' then
    if current_qty is null then
      insert into sobras.inventory (item_code, quantity, sector, location, last_updated)
        values (new.item_code, new.quantity, new.sector, new.location, now());
    else
      update sobras.inventory
        set quantity = quantity + new.quantity, last_updated = now()
        where item_code = new.item_code and sector = new.sector and location = new.location;
    end if;
  else
    if current_qty is null or current_qty < new.quantity then
      raise exception 'Estoque insuficiente para o item % em %', new.item_code, new.location;
    end if;
    update sobras.inventory
      set quantity = quantity - new.quantity, last_updated = now()
      where item_code = new.item_code and sector = new.sector and location = new.location;
  end if;

  return new;
end;
$$;

-- ---------- TRIGGERS ----------
-- em auth.users (tabela COMPARTILHADA entre os sistemas) — nome prefixado p/ não colidir
create trigger sobras_on_auth_user_created
  after insert on auth.users
  for each row execute function sobras.handle_new_user();

create trigger sobras_movements_apply
  after insert on sobras.movements
  for each row execute function sobras.apply_movement();

-- ---------- RLS ----------
alter table sobras.profiles   enable row level security;
alter table sobras.user_roles enable row level security;
alter table sobras.items      enable row level security;
alter table sobras.employees  enable row level security;
alter table sobras.inventory  enable row level security;
alter table sobras.movements  enable row level security;

-- profiles: cada um vê/edita o próprio
create policy "Profiles viewable by owner" on sobras.profiles
  for select to authenticated using (auth.uid() = id);
create policy "Profiles updatable by owner" on sobras.profiles
  for update to authenticated using (auth.uid() = id);
create policy "Profiles insertable by owner" on sobras.profiles
  for insert to authenticated with check (auth.uid() = id);

-- user_roles: cada um vê os próprios papéis (a gestão é via RPC do master, security definer)
create policy "Users view own roles" on sobras.user_roles
  for select to authenticated using (auth.uid() = user_id);

-- itens / funcionários / estoque: quem tem acesso ao sobras faz tudo
create policy "Items access" on sobras.items
  for all to authenticated using (sobras.has_access(auth.uid())) with check (sobras.has_access(auth.uid()));
create policy "Employees access" on sobras.employees
  for all to authenticated using (sobras.has_access(auth.uid())) with check (sobras.has_access(auth.uid()));
create policy "Inventory access" on sobras.inventory
  for all to authenticated using (sobras.has_access(auth.uid())) with check (sobras.has_access(auth.uid()));

-- movimentos: leitura p/ quem tem acesso; inserção exige ser o autor (fiel ao Lovable)
create policy "Movements read" on sobras.movements
  for select to authenticated using (sobras.has_access(auth.uid()));
create policy "Movements insert" on sobras.movements
  for insert to authenticated with check (sobras.has_access(auth.uid()) and auth.uid() = user_id);

-- ---------- GRANTS explícitos (garantia p/ o PostgREST) ----------
grant select, insert, update, delete on all tables in schema sobras to authenticated;
grant all on all tables in schema sobras to service_role;

-- ---------- REALTIME ----------
alter publication supabase_realtime add table sobras.inventory;
alter publication supabase_realtime add table sobras.movements;
alter table sobras.inventory replica identity full;
alter table sobras.movements replica identity full;

-- ---------- STORAGE: bucket de fotos dos itens (nome global → policies prefixadas) ----------
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true)
on conflict (id) do nothing;

create policy "sobras item photos read"   on storage.objects for select
  using (bucket_id = 'item-photos');
create policy "sobras item photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'item-photos');
create policy "sobras item photos update" on storage.objects for update to authenticated
  using (bucket_id = 'item-photos');
create policy "sobras item photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'item-photos');

-- Teste rápido (logado como um usuário com acesso):
--   select sobras.has_access(auth.uid());
--   select * from sobras.items;   -- vazio, mas não deve dar erro de permissão
