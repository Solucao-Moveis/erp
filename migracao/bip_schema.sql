-- ============================================================
-- SCHEMA: bip   (sistema bip-solucao)
-- Estrutura consolidada das migrations do Lovable.
-- SOMENTE ESTRUTURA — sem dados. Os dados reais entram na Fase 2.
-- Rodar no SQL Editor do Supabase Studio (ou psql) do banco SMERP.
-- ============================================================

create schema if not exists bip;
grant usage on schema bip to anon, authenticated, service_role;
alter default privileges in schema bip grant all on tables to anon, authenticated, service_role;
alter default privileges in schema bip grant all on functions to anon, authenticated, service_role;
alter default privileges in schema bip grant all on sequences to anon, authenticated, service_role;

-- ---------- ENUM ----------
create type bip.app_role as enum ('admin', 'user');

-- ---------- TABELAS ----------
create table bip.products (
  id uuid not null default gen_random_uuid() primary key,
  name text not null,
  code text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table bip.loading_orders (
  id uuid not null default gen_random_uuid() primary key,
  order_number text not null,
  product_id uuid references bip.products(id) not null,
  quantity integer not null,
  driver text not null,
  vehicle_plate text not null,
  loading_date date not null,
  observations text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  city text,
  created_at timestamp with time zone not null default now()
);

-- scanned_codes: estado FINAL (unique(order_id, barcode) removido;
-- colunas product_id, package_label, item_id adicionadas)
create table bip.scanned_codes (
  id uuid not null default gen_random_uuid() primary key,
  order_id uuid references bip.loading_orders(id) on delete cascade not null,
  barcode text not null,
  product_id uuid,
  package_label text,
  item_id uuid,
  scanned_at timestamp with time zone not null default now()
);

-- loading_order_items: estado FINAL (colunas units_per_package, package_label, city adicionadas)
create table bip.loading_order_items (
  id uuid not null default gen_random_uuid() primary key,
  order_id uuid not null references bip.loading_orders(id) on delete cascade,
  product_id uuid not null references bip.products(id),
  quantity integer not null default 1,
  units_per_package integer not null default 1,
  package_label text,
  city text,
  created_at timestamp with time zone not null default now()
);

create table bip.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table bip.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role bip.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table bip.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  action text not null,
  entity text not null,
  entity_id text,
  description text,
  created_at timestamptz not null default now()
);

create table bip.loading_photos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

-- ---------- ÍNDICES ----------
create index idx_audit_log_created_at on bip.audit_log(created_at desc);
create index idx_loading_photos_order on bip.loading_photos(order_id);
create index idx_scanned_codes_item_id on bip.scanned_codes(item_id);

-- ---------- FUNÇÕES (security definer) ----------
create or replace function bip.has_role(_user_id uuid, _role bip.app_role)
returns boolean
language sql stable security definer set search_path = bip, public
as $$
  select exists (select 1 from bip.user_roles where user_id = _user_id and role = _role)
$$;

-- profile automático + role default 'user' (com TRAVA por sistema via metadado 'app')
create or replace function bip.handle_new_user()
returns trigger
language plpgsql security definer set search_path = bip, public
as $$
begin
  if (new.raw_user_meta_data->>'app') is distinct from 'bip' then
    return new;
  end if;

  insert into bip.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;

  -- Default user role
  insert into bip.user_roles (user_id, role) values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

-- ---------- TRIGGERS ----------
-- Trigger em auth.users (tabela compartilhada) — nome prefixado p/ não colidir
create trigger bip_on_auth_user_created
  after insert on auth.users
  for each row execute function bip.handle_new_user();

-- ---------- RLS ----------
alter table bip.products enable row level security;
alter table bip.loading_orders enable row level security;
alter table bip.scanned_codes enable row level security;
alter table bip.loading_order_items enable row level security;
alter table bip.profiles enable row level security;
alter table bip.user_roles enable row level security;
alter table bip.audit_log enable row level security;
alter table bip.loading_photos enable row level security;

-- products (estado FINAL: somente authenticated; políticas públicas anon removidas)
create policy "Auth read products" on bip.products for select to authenticated using (true);
create policy "Auth insert products" on bip.products for insert to authenticated with check (true);
create policy "Auth update products" on bip.products for update to authenticated using (true);
create policy "Auth delete products" on bip.products for delete to authenticated using (true);

-- loading_orders (estado FINAL: somente authenticated; políticas públicas anon removidas)
create policy "Auth read orders" on bip.loading_orders for select to authenticated using (true);
create policy "Auth insert orders" on bip.loading_orders for insert to authenticated with check (true);
create policy "Auth update orders" on bip.loading_orders for update to authenticated using (true);
create policy "Auth delete orders" on bip.loading_orders for delete to authenticated using (true);

-- loading_order_items (estado FINAL: somente authenticated; políticas públicas anon removidas)
create policy "Auth read items" on bip.loading_order_items for select to authenticated using (true);
create policy "Auth insert items" on bip.loading_order_items for insert to authenticated with check (true);
create policy "Auth update items" on bip.loading_order_items for update to authenticated using (true);
create policy "Auth delete items" on bip.loading_order_items for delete to authenticated using (true);

-- scanned_codes (estado FINAL: somente authenticated; políticas públicas anon removidas)
create policy "Auth read scans" on bip.scanned_codes for select to authenticated using (true);
create policy "Auth insert scans" on bip.scanned_codes for insert to authenticated with check (true);
create policy "Auth update scans" on bip.scanned_codes for update to authenticated using (true);
create policy "Auth delete scans" on bip.scanned_codes for delete to authenticated using (true);

-- profiles
create policy "Users view own profile" on bip.profiles
  for select to authenticated using (auth.uid() = id or bip.has_role(auth.uid(), 'admin'));
create policy "Admins update profiles" on bip.profiles
  for update to authenticated using (bip.has_role(auth.uid(), 'admin'));

-- user_roles
create policy "Users view own roles" on bip.user_roles
  for select to authenticated using (auth.uid() = user_id or bip.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles" on bip.user_roles
  for all to authenticated
  using (bip.has_role(auth.uid(), 'admin'))
  with check (bip.has_role(auth.uid(), 'admin'));

-- audit_log
create policy "Admins view all audit" on bip.audit_log
  for select to authenticated using (bip.has_role(auth.uid(), 'admin'));
create policy "Authenticated can insert audit" on bip.audit_log
  for insert to authenticated with check (auth.uid() = user_id);

-- loading_photos
create policy "Auth read photos" on bip.loading_photos for select to authenticated using (true);
create policy "Auth insert photos" on bip.loading_photos for insert to authenticated with check (true);
create policy "Auth update photos" on bip.loading_photos for update to authenticated using (true);
create policy "Auth delete photos" on bip.loading_photos for delete to authenticated using (true);

-- ---------- GRANTS explícitos (garantia) ----------
grant select, insert, update, delete on all tables in schema bip to authenticated;
grant all on all tables in schema bip to service_role;

-- ---------- STORAGE: bucket + policies (nomes prefixados p/ não colidir) ----------
insert into storage.buckets (id, name, public)
values ('loading-photos', 'loading-photos', true)
on conflict (id) do nothing;

create policy "bip Public read loading photos" on storage.objects for select
  using (bucket_id = 'loading-photos');
create policy "bip Auth upload loading photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'loading-photos');
create policy "bip Auth delete loading photos" on storage.objects for delete to authenticated
  using (bucket_id = 'loading-photos');
