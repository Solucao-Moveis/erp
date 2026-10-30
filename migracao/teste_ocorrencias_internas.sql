-- ============================================================
-- teste.ocorrencias_internas — aba "Ocorrências Internas" (app teste-solucao)
-- Baseada na planilha CONTROLE DE ACIDENTES 2026.xlsx.
-- Rodar DEPOIS de teste_schema.sql e teste_papeis_acesso.sql (is_member, is_master). Idempotente.
--
-- Já aplicado no banco em 30/10/2026 (colado direto no SQL Editor). Este arquivo foi
-- reconstruído a partir do catálogo do banco para ficar versionado; é o estado real.
-- A importação dos 27 registros de 2026 + 39 do histórico de 2025 NÃO fica no repo
-- (nomes de colaboradores e dados de saúde).
-- ============================================================

create or replace function teste.touch_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Quem lança: admin do app, Wisla e master@ ----------
-- Espelhado no front em src/lib/interno.ts (usePodeLancarInterno); mudar nos dois.
create or replace function teste.pode_lancar_interno(_user_id uuid)
returns boolean
language sql stable security definer
set search_path to 'teste', 'public'
as $$
  select
    exists (
      select 1 from teste.user_roles
      where user_id = _user_id and role = 'admin'::teste.app_role
    )
    or exists (
      select 1 from auth.users
      where id = _user_id and lower(email) in ('wislarodriguess@gmail.com','master@solucaomoveis.ind.br')
    )
$$;

-- ---------- Ocorrências individuais (2026 em diante) ----------
create table if not exists teste.ocorrencias_internas (
  id                uuid primary key default gen_random_uuid(),
  lider_nome        text,
  empregado_nome    text not null,
  cargo             text,              -- livre: rh.colaboradores não tem cargo
  setor             text,
  data              date not null,
  horario           time,
  evento            text[] not null check (
                      cardinality(evento) >= 1
                      and evento <@ array['CPT','SPT','INCIDENTE','ATENDIMENTO_AMBULATORIAL']),
  equipamento       text,
  lesao             boolean not null,
  lesao_obs         text,
  descricao         text not null,
  hospital          boolean not null,
  hospital_obs      text,
  origem_importacao boolean not null default false, -- veio da planilha (líder pode faltar)
  revisar           boolean not null default false, -- importado, conferir hospital/lesão
  created_at        timestamptz not null default now(),
  created_by        uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at        timestamptz not null default now(),
  constraint ck_seg_oi_lider check (origem_importacao or nullif(btrim(lider_nome), '') is not null)
);

create index if not exists idx_seg_oi_data   on teste.ocorrencias_internas (data);
create index if not exists idx_seg_oi_setor  on teste.ocorrencias_internas (setor);
create index if not exists idx_seg_oi_evento on teste.ocorrencias_internas using gin (evento);

drop trigger if exists trg_seg_oi_touch on teste.ocorrencias_internas;
create trigger trg_seg_oi_touch before update on teste.ocorrencias_internas
  for each row execute function teste.touch_updated();

-- ---------- Fotos (arquivo no bucket seguranca-evidencias) ----------
create table if not exists teste.ocorrencias_internas_fotos (
  id            uuid primary key default gen_random_uuid(),
  ocorrencia_id uuid not null references teste.ocorrencias_internas(id) on delete cascade,
  storage_path  text not null, -- <ocorrencia_id>/<uuid>-<nome> ou importacao/<arquivo>
  nome_original text,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users(id) on delete set null
);

create index if not exists idx_seg_oif_ocorrencia on teste.ocorrencias_internas_fotos (ocorrencia_id);

-- ---------- Histórico agregado (2025: só total por mês e setor) ----------
create table if not exists teste.ocorrencias_internas_historico (
  id         uuid primary key default gen_random_uuid(),
  ano        smallint not null,
  mes        smallint not null check (mes between 1 and 12),
  setor      text not null,
  quantidade integer not null check (quantidade >= 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  unique (ano, mes, setor)
);

-- ---------- RLS: leitura para membros, escrita para quem lança ----------
alter table teste.ocorrencias_internas           enable row level security;
alter table teste.ocorrencias_internas_fotos     enable row level security;
alter table teste.ocorrencias_internas_historico enable row level security;

drop policy if exists "OI read"   on teste.ocorrencias_internas;
drop policy if exists "OI insert" on teste.ocorrencias_internas;
drop policy if exists "OI update" on teste.ocorrencias_internas;
drop policy if exists "OI delete" on teste.ocorrencias_internas;
create policy "OI read"   on teste.ocorrencias_internas for select to authenticated using (teste.is_member(auth.uid()));
create policy "OI insert" on teste.ocorrencias_internas for insert to authenticated with check (teste.pode_lancar_interno(auth.uid()));
create policy "OI update" on teste.ocorrencias_internas for update to authenticated
  using (teste.pode_lancar_interno(auth.uid())) with check (teste.pode_lancar_interno(auth.uid()));
create policy "OI delete" on teste.ocorrencias_internas for delete to authenticated using (teste.pode_lancar_interno(auth.uid()));

drop policy if exists "OIF read"   on teste.ocorrencias_internas_fotos;
drop policy if exists "OIF insert" on teste.ocorrencias_internas_fotos;
drop policy if exists "OIF delete" on teste.ocorrencias_internas_fotos;
create policy "OIF read"   on teste.ocorrencias_internas_fotos for select to authenticated using (teste.is_member(auth.uid()));
create policy "OIF insert" on teste.ocorrencias_internas_fotos for insert to authenticated with check (teste.pode_lancar_interno(auth.uid()));
create policy "OIF delete" on teste.ocorrencias_internas_fotos for delete to authenticated using (teste.pode_lancar_interno(auth.uid()));

drop policy if exists "OIH read"   on teste.ocorrencias_internas_historico;
drop policy if exists "OIH insert" on teste.ocorrencias_internas_historico;
drop policy if exists "OIH update" on teste.ocorrencias_internas_historico;
drop policy if exists "OIH delete" on teste.ocorrencias_internas_historico;
create policy "OIH read"   on teste.ocorrencias_internas_historico for select to authenticated using (teste.is_member(auth.uid()));
create policy "OIH insert" on teste.ocorrencias_internas_historico for insert to authenticated with check (teste.pode_lancar_interno(auth.uid()));
create policy "OIH update" on teste.ocorrencias_internas_historico for update to authenticated
  using (teste.pode_lancar_interno(auth.uid())) with check (teste.pode_lancar_interno(auth.uid()));
create policy "OIH delete" on teste.ocorrencias_internas_historico for delete to authenticated using (teste.pode_lancar_interno(auth.uid()));

-- ---------- GRANTS ----------
grant select, insert, update, delete on teste.ocorrencias_internas           to authenticated;
grant select, insert, update, delete on teste.ocorrencias_internas_fotos     to authenticated;
grant select, insert, update, delete on teste.ocorrencias_internas_historico to authenticated;
grant all on teste.ocorrencias_internas           to service_role;
grant all on teste.ocorrencias_internas_fotos     to service_role;
grant all on teste.ocorrencias_internas_historico to service_role;

-- ---------- Storage: bucket privado de evidências ----------
insert into storage.buckets (id, name, public)
values ('seguranca-evidencias', 'seguranca-evidencias', false)
on conflict (id) do nothing;

drop policy if exists seg_evid_read   on storage.objects;
drop policy if exists seg_evid_write  on storage.objects;
drop policy if exists seg_evid_delete on storage.objects;
create policy seg_evid_read on storage.objects for select to authenticated
  using (bucket_id = 'seguranca-evidencias' and teste.is_member(auth.uid()));
create policy seg_evid_write on storage.objects for insert to authenticated
  with check (bucket_id = 'seguranca-evidencias' and teste.pode_lancar_interno(auth.uid()));
create policy seg_evid_delete on storage.objects for delete to authenticated
  using (bucket_id = 'seguranca-evidencias' and teste.pode_lancar_interno(auth.uid()));
