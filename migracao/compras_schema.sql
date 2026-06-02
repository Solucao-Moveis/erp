-- ============================================================
-- SCHEMA: compras   (sistema comprasolucao)
-- Estrutura consolidada das migrations do Lovable.
-- SOMENTE ESTRUTURA — sem dados. Os dados reais entram na Fase 2.
-- Rodar no SQL Editor do Supabase Studio (ou psql) do banco SMERP.
-- ============================================================

create schema if not exists compras;
grant usage on schema compras to anon, authenticated, service_role;
alter default privileges in schema compras grant all on tables to anon, authenticated, service_role;
alter default privileges in schema compras grant all on functions to anon, authenticated, service_role;
alter default privileges in schema compras grant all on sequences to anon, authenticated, service_role;

-- ---------- ENUMS ----------
-- request_status: 'comprado' adicionado APÓS 'aprovado'; 'cancelado' anexado ao fim (merge dos alter type)
create type compras.app_role as enum ('admin', 'aprovador', 'solicitante', 'comprador', 'visualizador');
create type compras.request_status as enum ('pendente', 'aprovado', 'comprado', 'negado', 'finalizado', 'cancelado');
create type compras.request_priority as enum ('baixa', 'media', 'alta');

-- ---------- TABELAS ----------
create table compras.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table compras.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role compras.app_role not null,
  unique (user_id, role)
);

-- sectors: estado FINAL (coluna code adicionada)
create table compras.sectors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  approver_id uuid references auth.users(id) on delete set null,
  code text,
  created_at timestamptz not null default now()
);

create table compras.cost_centers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table compras.request_sequences (
  year int primary key,
  last_number int not null default 0
);

-- NOTA: A tabela compras.items NAO possui CREATE TABLE em nenhuma das 23 migrations
-- (a criacao original ficou fora do conjunto fornecido). Reconstruida a partir do
-- arquivo gerado src/integrations/supabase/types.ts para preservar as FKs e os
-- gatilhos que dependem dela (recalc_item_stats, request_items.item_id, etc.).
create table compras.items (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text not null,
  supplier text,
  avg_price numeric default 0,
  total_spent numeric not null default 0,
  total_quantity numeric not null default 0,
  purchase_count integer not null default 0,
  avg_interval_days numeric,
  last_purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- purchase_requests: estado FINAL
--   (sector_id agora NULLABLE; colunas purchased_at, arrived_at, purchase_amount, item_id adicionadas)
create table compras.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  number text unique,
  sector_id uuid references compras.sectors(id),
  requester_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  needed_by date not null,
  justification text not null,
  priority compras.request_priority not null default 'media',
  cost_center_id uuid references compras.cost_centers(id),
  status compras.request_status not null default 'pendente',
  approver_id uuid references auth.users(id),
  decided_at timestamptz,
  decision_note text,
  finalized_at timestamptz,
  purchased_at timestamptz,
  arrived_at timestamptz,
  purchase_amount numeric(14,2),
  item_id uuid references compras.items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table compras.request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references compras.purchase_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  content text not null,
  created_at timestamptz not null default now()
);

create table compras.request_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references compras.purchase_requests(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  from_status compras.request_status,
  to_status compras.request_status,
  created_at timestamptz not null default now()
);

create table compras.request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references compras.purchase_requests(id) on delete cascade,
  path text not null,
  filename text not null,
  size int,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table compras.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  request_id uuid,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- request_items: estado FINAL (FK item_id e colunas unit_price/expected_price adicionadas)
create table compras.request_items (
  id uuid not null default gen_random_uuid() primary key,
  request_id uuid not null references compras.purchase_requests(id) on delete cascade,
  item_id uuid references compras.items(id) on delete set null,
  description text not null,
  quantity numeric not null,
  unit text not null,
  position integer not null default 0,
  unit_price numeric,
  expected_price numeric,
  created_at timestamptz not null default now()
);

-- ---------- ÍNDICES ----------
create index notifications_user_idx on compras.notifications(user_id, created_at desc);
create index idx_request_items_request_id on compras.request_items(request_id);
create index idx_request_items_item_id on compras.request_items(item_id);

-- ---------- FUNÇÕES ----------
create or replace function compras.has_role(_user_id uuid, _role compras.app_role)
returns boolean language sql stable security definer set search_path = compras, public
as $$ select exists (select 1 from compras.user_roles where user_id = _user_id and role = _role) $$;

create or replace function compras.is_sector_approver(_user_id uuid, _sector_id uuid)
returns boolean language sql stable security definer set search_path = compras, public
as $$ select exists (select 1 from compras.sectors where id = _sector_id and approver_id = _user_id) $$;

-- gerador de número da solicitação
create or replace function compras.generate_request_number()
returns trigger language plpgsql security definer set search_path = compras, public
as $$
declare
  yr int := extract(year from now());
  next_num int;
begin
  insert into compras.request_sequences(year, last_number) values (yr, 1)
  on conflict (year) do update set last_number = request_sequences.last_number + 1
  returning last_number into next_num;
  new.number := 'SC-' || lpad(next_num::text, 4, '0') || '/' || yr;
  return new;
end $$;

-- updated_at (estado FINAL: search_path corrigido)
create or replace function compras.set_updated_at()
returns trigger language plpgsql set search_path = compras, public
as $$
begin new.updated_at = now(); return new; end $$;

-- histórico de status
create or replace function compras.log_request_history()
returns trigger language plpgsql security definer set search_path = compras, public
as $$
begin
  if tg_op = 'INSERT' then
    insert into compras.request_history(request_id, user_id, action, to_status)
    values (new.id, new.requester_id, 'created', new.status);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into compras.request_history(request_id, user_id, action, from_status, to_status)
    values (new.id, auth.uid(), 'status_change', old.status, new.status);
  end if;
  return new;
end $$;

-- recalc estatísticas do item (estado FINAL — versão 20260527104422)
create or replace function compras.recalc_item_stats()
returns trigger language plpgsql security definer set search_path = compras, public
as $$
declare
  v_total_spent numeric;
  v_total_qty numeric;
  v_count integer;
  v_last timestamptz;
  v_interval numeric;
  v_avg_unit numeric;
begin
  if new.item_id is null then return new; end if;

  if (tg_op = 'INSERT' and new.purchased_at is not null and new.purchase_amount is not null)
     or (tg_op = 'UPDATE' and new.purchased_at is not null and new.purchase_amount is not null
         and (old.purchased_at is distinct from new.purchased_at or old.purchase_amount is distinct from new.purchase_amount or old.item_id is distinct from new.item_id)) then
    select coalesce(sum(purchase_amount),0), coalesce(sum(quantity),0), count(*), max(purchased_at), avg(purchase_amount)
      into v_total_spent, v_total_qty, v_count, v_last, v_avg_unit
    from compras.purchase_requests
    where item_id = new.item_id and purchased_at is not null and purchase_amount is not null;

    select avg(diff) into v_interval from (
      select extract(epoch from (purchased_at - lag(purchased_at) over (order by purchased_at)))/86400 as diff
      from compras.purchase_requests
      where item_id = new.item_id and purchased_at is not null
    ) t where diff is not null;

    update compras.items set
      total_spent = v_total_spent,
      total_quantity = v_total_qty,
      purchase_count = v_count,
      avg_price = coalesce(v_avg_unit, 0),
      last_purchased_at = v_last,
      avg_interval_days = v_interval,
      updated_at = now()
    where id = new.item_id;
  end if;

  return new;
end $$;

-- notificação ao comentar
create or replace function compras.notify_on_comment()
returns trigger language plpgsql security definer set search_path = compras, public
as $$
declare v_requester uuid; v_number text;
begin
  select requester_id, number into v_requester, v_number from compras.purchase_requests where id = new.request_id;
  if v_requester is not null and v_requester <> new.user_id then
    insert into compras.notifications(user_id, request_id, title, body)
    values (v_requester, new.request_id, 'Novo comentário em ' || coalesce(v_number,'sua solicitação'), left(new.content, 200));
  end if;
  return new;
end $$;

-- notificação ao anexar
create or replace function compras.notify_on_attachment()
returns trigger language plpgsql security definer set search_path = compras, public
as $$
declare v_requester uuid; v_number text;
begin
  select requester_id, number into v_requester, v_number from compras.purchase_requests where id = new.request_id;
  if v_requester is not null and v_requester <> new.uploaded_by then
    insert into compras.notifications(user_id, request_id, title, body)
    values (v_requester, new.request_id, 'Novo anexo em ' || coalesce(v_number,'sua solicitação'), new.filename);
  end if;
  return new;
end $$;

-- notificação de mudanças na solicitação (estado FINAL — versão 20260514145500)
create or replace function compras.notify_request_changes()
returns trigger language plpgsql security definer set search_path = compras, public
as $$
declare v_actor uuid := auth.uid(); v_changed boolean := false;
begin
  if new.requester_id = v_actor then return new; end if;
  if new.status is distinct from old.status then
    insert into compras.notifications(user_id, request_id, title, body)
    values (new.requester_id, new.id, 'Status atualizado: ' || new.status, coalesce(new.number,'') || ' agora está ' || new.status);
  end if;
  if new.description is distinct from old.description or new.quantity is distinct from old.quantity
     or new.unit is distinct from old.unit or new.needed_by is distinct from old.needed_by
     or new.justification is distinct from old.justification or new.priority is distinct from old.priority
     or new.cost_center_id is distinct from old.cost_center_id or new.sector_id is distinct from old.sector_id
     or new.item_id is distinct from old.item_id or new.purchase_amount is distinct from old.purchase_amount
     or new.decision_note is distinct from old.decision_note or new.approver_id is distinct from old.approver_id
     or new.purchased_at is distinct from old.purchased_at or new.arrived_at is distinct from old.arrived_at then
    v_changed := true;
  end if;
  if v_changed then
    insert into compras.notifications(user_id, request_id, title, body)
    values (new.requester_id, new.id, 'Solicitação ' || coalesce(new.number,'') || ' foi editada', 'Campos da sua solicitação foram alterados.');
  end if;
  return new;
end $$;

-- novo usuário -> profile + role padrão (+ 1º usuário vira admin). TRAVA por sistema via metadado 'app'.
-- (estado FINAL — versão 20260514195913)
create or replace function compras.handle_new_user()
returns trigger language plpgsql security definer set search_path = compras, public
as $$
declare
  is_first_user boolean;
begin
  if (new.raw_user_meta_data->>'app') is distinct from 'compras' then
    return new;
  end if;

  select not exists (select 1 from compras.profiles limit 1) into is_first_user;

  insert into compras.profiles(id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, compras.profiles.full_name);

  insert into compras.user_roles(user_id, role)
  values (new.id, 'solicitante')
  on conflict (user_id, role) do nothing;

  if is_first_user then
    insert into compras.user_roles(user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end $$;

-- ---------- TRIGGERS ----------
create trigger trg_pr_number
  before insert on compras.purchase_requests
  for each row when (new.number is null)
  execute function compras.generate_request_number();

create trigger trg_pr_updated_at
  before update on compras.purchase_requests
  for each row execute function compras.set_updated_at();

create trigger trg_pr_history
  after insert or update on compras.purchase_requests
  for each row execute function compras.log_request_history();

create trigger trg_pr_notify_changes
  after update on compras.purchase_requests
  for each row execute function compras.notify_request_changes();

create trigger trg_pr_recalc_item
  after insert or update on compras.purchase_requests
  for each row execute function compras.recalc_item_stats();

create trigger trg_comments_notify
  after insert on compras.request_comments
  for each row execute function compras.notify_on_comment();

create trigger trg_attachments_notify
  after insert on compras.request_attachments
  for each row execute function compras.notify_on_attachment();

-- trigger em auth.users (tabela compartilhada): nome prefixado por sistema
create trigger compras_on_auth_user_created
  after insert on auth.users
  for each row execute function compras.handle_new_user();

-- ---------- RLS ----------
alter table compras.profiles enable row level security;
alter table compras.user_roles enable row level security;
alter table compras.sectors enable row level security;
alter table compras.cost_centers enable row level security;
alter table compras.request_sequences enable row level security;
alter table compras.items enable row level security;
alter table compras.purchase_requests enable row level security;
alter table compras.request_comments enable row level security;
alter table compras.request_history enable row level security;
alter table compras.request_attachments enable row level security;
alter table compras.notifications enable row level security;
alter table compras.request_items enable row level security;

-- profiles
create policy "profiles_select_authenticated" on compras.profiles for select to authenticated using (true);
create policy "profiles_update_self" on compras.profiles for update to authenticated using (id = auth.uid());

-- user_roles
create policy "roles_select_self_or_admin" on compras.user_roles for select to authenticated
  using (user_id = auth.uid() or compras.has_role(auth.uid(), 'admin'));
create policy "roles_admin_all" on compras.user_roles for all to authenticated
  using (compras.has_role(auth.uid(), 'admin')) with check (compras.has_role(auth.uid(), 'admin'));

-- sectors
create policy "sectors_select" on compras.sectors for select to authenticated using (true);
create policy "sectors_admin" on compras.sectors for all to authenticated
  using (compras.has_role(auth.uid(), 'admin')) with check (compras.has_role(auth.uid(), 'admin'));

-- cost_centers
create policy "cc_select" on compras.cost_centers for select to authenticated using (true);
create policy "cc_admin" on compras.cost_centers for all to authenticated
  using (compras.has_role(auth.uid(), 'admin')) with check (compras.has_role(auth.uid(), 'admin'));

-- request_sequences
create policy "seq_admin" on compras.request_sequences for all to authenticated
  using (compras.has_role(auth.uid(), 'admin')) with check (compras.has_role(auth.uid(), 'admin'));

-- items (estado FINAL: select auth + insert auth + update admin/comprador + delete admin)
-- NOTA: a policy items_select nao consta nas migrations fornecidas (junto com o CREATE TABLE ausente);
-- reconstruida como leitura para authenticated, consistente com o uso no app.
create policy "items_select" on compras.items for select to authenticated using (true);
create policy "items_insert" on compras.items for insert to authenticated
  with check (auth.uid() is not null);
create policy "items_update" on compras.items for update to authenticated
  using (compras.has_role(auth.uid(), 'admin') or compras.has_role(auth.uid(), 'comprador'))
  with check (compras.has_role(auth.uid(), 'admin') or compras.has_role(auth.uid(), 'comprador'));
create policy "items_delete" on compras.items for delete to authenticated
  using (compras.has_role(auth.uid(), 'admin'));

-- purchase_requests (estado FINAL: delete admin + delete owner/pending)
create policy "pr_select_all_auth" on compras.purchase_requests for select to authenticated using (true);
create policy "pr_insert_self" on compras.purchase_requests for insert to authenticated
  with check (requester_id = auth.uid());
create policy "pr_update_owner_or_approver_or_admin" on compras.purchase_requests for update to authenticated
  using (
    (requester_id = auth.uid() and status = 'pendente')
    or compras.is_sector_approver(auth.uid(), sector_id)
    or compras.has_role(auth.uid(), 'admin')
    or compras.has_role(auth.uid(), 'comprador')
  );
create policy "pr_delete_admin" on compras.purchase_requests for delete to authenticated
  using (compras.has_role(auth.uid(), 'admin'));
create policy "pr_delete_owner_pending" on compras.purchase_requests for delete to authenticated
  using (requester_id = auth.uid() and status = 'pendente');

-- request_comments
create policy "cm_select" on compras.request_comments for select to authenticated using (true);
create policy "cm_insert" on compras.request_comments for insert to authenticated
  with check (user_id = auth.uid());
create policy "cm_delete_own_or_admin" on compras.request_comments for delete to authenticated
  using (user_id = auth.uid() or compras.has_role(auth.uid(), 'admin'));

-- request_history
create policy "hist_select" on compras.request_history for select to authenticated using (true);

-- request_attachments
create policy "att_select" on compras.request_attachments for select to authenticated using (true);
create policy "att_insert" on compras.request_attachments for insert to authenticated
  with check (uploaded_by = auth.uid());
create policy "att_delete_own_or_admin" on compras.request_attachments for delete to authenticated
  using (uploaded_by = auth.uid() or compras.has_role(auth.uid(), 'admin'));

-- notifications (estado FINAL: insert self or admin)
create policy "notif_select_own" on compras.notifications for select to authenticated using (user_id = auth.uid());
create policy "notif_update_own" on compras.notifications for update to authenticated using (user_id = auth.uid());
create policy "notif_insert_auth" on compras.notifications for insert to authenticated
  with check (user_id = auth.uid() or compras.has_role(auth.uid(), 'admin'));
create policy "notif_delete_own_or_admin" on compras.notifications for delete to authenticated
  using (user_id = auth.uid() or compras.has_role(auth.uid(), 'admin'));

-- request_items
create policy "ri_select" on compras.request_items for select to authenticated using (true);
create policy "ri_insert" on compras.request_items for insert to authenticated with check (
  exists (
    select 1 from compras.purchase_requests pr
    where pr.id = request_id
      and (
        (pr.requester_id = auth.uid() and pr.status = 'pendente')
        or compras.is_sector_approver(auth.uid(), pr.sector_id)
        or compras.has_role(auth.uid(), 'admin')
        or compras.has_role(auth.uid(), 'comprador')
      )
  )
);
create policy "ri_update" on compras.request_items for update to authenticated using (
  exists (
    select 1 from compras.purchase_requests pr
    where pr.id = request_id
      and (
        (pr.requester_id = auth.uid() and pr.status = 'pendente')
        or compras.is_sector_approver(auth.uid(), pr.sector_id)
        or compras.has_role(auth.uid(), 'admin')
        or compras.has_role(auth.uid(), 'comprador')
      )
  )
);
create policy "ri_delete" on compras.request_items for delete to authenticated using (
  exists (
    select 1 from compras.purchase_requests pr
    where pr.id = request_id
      and (
        (pr.requester_id = auth.uid() and pr.status = 'pendente')
        or compras.has_role(auth.uid(), 'admin')
      )
  )
);

-- ---------- REALTIME (estrutural) ----------
alter table compras.notifications replica identity full;
alter publication supabase_realtime add table compras.notifications;

-- realtime.messages: escopo de assinatura por destinatário (schema compartilhado realtime; sem refs a public)
alter table if exists realtime.messages enable row level security;
create policy compras_notif_realtime_read on realtime.messages for select to authenticated
  using (realtime.topic() like ('notif-' || auth.uid()::text || '-%'));

-- ---------- GRANTS explícitos (garantia) ----------
grant select, insert, update, delete on all tables in schema compras to authenticated;
grant all on all tables in schema compras to service_role;

-- ---------- STORAGE: bucket + policies (nomes prefixados p/ não colidir) ----------
insert into storage.buckets (id, name, public)
values ('request-attachments', 'request-attachments', false)
on conflict (id) do nothing;

-- att_storage_select (estado FINAL — versão 20260523233121)
create policy "compras att_storage_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'request-attachments' and (
      (auth.uid())::text = (storage.foldername(name))[1]
      or compras.has_role(auth.uid(), 'admin')
      or compras.has_role(auth.uid(), 'comprador')
      or exists (
        select 1 from compras.request_attachments ra
        join compras.purchase_requests pr on pr.id = ra.request_id
        where ra.path = storage.objects.name
          and (pr.requester_id = auth.uid() or compras.is_sector_approver(auth.uid(), pr.sector_id))
      )
    )
  );
create policy "compras att_storage_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'request-attachments' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "compras att_storage_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'request-attachments' and (auth.uid()::text = (storage.foldername(name))[1] or compras.has_role(auth.uid(), 'admin')));
