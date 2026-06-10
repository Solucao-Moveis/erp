-- ============================================================
-- frota — ROTA: checkout/check-in + rastreio ao vivo + paradas + abastecimento.
-- Estende frota.diario_bordo e cria rota_pontos (trilha) e rota_paradas (pinos).
-- Roda DEPOIS do frota_diario_bordo.sql. Idempotente.
-- ============================================================

-- ---------- ENUMS ----------
do $$ begin create type frota.status_rota as enum ('em_andamento','concluida','cancelada'); exception when duplicate_object then null; end $$;
do $$ begin create type frota.tipo_parada as enum ('parada','destino','abastecimento'); exception when duplicate_object then null; end $$;

-- ---------- diario_bordo: novas colunas ----------
alter table frota.diario_bordo
  add column if not exists status frota.status_rota not null default 'concluida',
  add column if not exists saida_lat double precision,
  add column if not exists saida_lng double precision,
  add column if not exists chegada_lat double precision,
  add column if not exists chegada_lng double precision,
  add column if not exists saida_em timestamptz,
  add column if not exists chegada_em timestamptz,
  add column if not exists saida_km_foto_path text,
  add column if not exists chegada_km_foto_path text,
  add column if not exists rota_geojson jsonb;

create index if not exists idx_frota_diario_status on frota.diario_bordo(status);

-- ---------- lancamentos: vínculo com a viagem (abastecimento na rota) ----------
alter table frota.lancamentos
  add column if not exists diario_id uuid references frota.diario_bordo(id) on delete set null;
create index if not exists idx_frota_lanc_diario on frota.lancamentos(diario_id);

-- ---------- rota_pontos (trilha ao vivo) ----------
create table if not exists frota.rota_pontos (
  id uuid primary key default gen_random_uuid(),
  diario_id uuid not null references frota.diario_bordo(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  captured_at timestamptz not null default now()
);
create index if not exists idx_frota_rota_pontos on frota.rota_pontos(diario_id, captured_at);

-- ---------- rota_paradas (pinos rotulados: parada/destino/abastecimento) ----------
create table if not exists frota.rota_paradas (
  id uuid primary key default gen_random_uuid(),
  diario_id uuid not null references frota.diario_bordo(id) on delete cascade,
  tipo frota.tipo_parada not null default 'parada',
  lat double precision,
  lng double precision,
  titulo text,
  observacao text,
  lancamento_id uuid references frota.lancamentos(id) on delete set null,
  captured_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists idx_frota_rota_paradas on frota.rota_paradas(diario_id, captured_at);

-- ---------- RLS ----------
alter table frota.rota_pontos  enable row level security;
alter table frota.rota_paradas enable row level security;

drop policy if exists frota_rpontos_sel on frota.rota_pontos;
create policy frota_rpontos_sel on frota.rota_pontos for select to authenticated
  using (frota.is_member(auth.uid()));
drop policy if exists frota_rpontos_ins on frota.rota_pontos;
create policy frota_rpontos_ins on frota.rota_pontos for insert to authenticated
  with check (frota.is_member(auth.uid()));
drop policy if exists frota_rpontos_del on frota.rota_pontos;
create policy frota_rpontos_del on frota.rota_pontos for delete to authenticated
  using (frota.is_manager(auth.uid()));

drop policy if exists frota_rparadas_sel on frota.rota_paradas;
create policy frota_rparadas_sel on frota.rota_paradas for select to authenticated
  using (frota.is_member(auth.uid()));
drop policy if exists frota_rparadas_ins on frota.rota_paradas;
create policy frota_rparadas_ins on frota.rota_paradas for insert to authenticated
  with check (frota.is_member(auth.uid()));
drop policy if exists frota_rparadas_upd on frota.rota_paradas;
create policy frota_rparadas_upd on frota.rota_paradas for update to authenticated
  using (frota.is_manager(auth.uid()) or created_by = auth.uid())
  with check (frota.is_manager(auth.uid()) or created_by = auth.uid());
drop policy if exists frota_rparadas_del on frota.rota_paradas;
create policy frota_rparadas_del on frota.rota_paradas for delete to authenticated
  using (frota.is_manager(auth.uid()) or created_by = auth.uid());

grant select, insert, update, delete on frota.rota_pontos, frota.rota_paradas to authenticated;
grant all on frota.rota_pontos, frota.rota_paradas to service_role;

-- ---------- REALTIME (gestor vê ao vivo) ----------
alter table frota.rota_pontos  replica identity full;
alter table frota.rota_paradas replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='frota' and tablename='rota_pontos') then
    alter publication supabase_realtime add table frota.rota_pontos;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='frota' and tablename='rota_paradas') then
    alter publication supabase_realtime add table frota.rota_paradas;
  end if;
end $$;

notify pgrst, 'reload schema';

-- conferência:
--   select status, count(*) from frota.diario_bordo group by status;
--   select * from frota.rota_pontos limit 1;
