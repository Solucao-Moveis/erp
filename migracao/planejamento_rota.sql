-- ============================================================================
-- Planejamento de Carga — Aba ROTA (planejamento de rota com mapa)
--   Roda DEPOIS de planejamento_schema.sql (mesmo padrão de planejamento_otif.sql).
--   Cria: cadastro de MOTORISTA, ROTA (cabeçalho), ROTA_PARADA (pedido↔rota + ordem),
--   LOCALIDADE (cache de coordenadas por cidade) e a cidade-base da fábrica nos parâmetros.
--   Acesso: is_member lê, is_editor escreve (igual ao resto do schema). Idempotente.
-- ============================================================================

-- Status da rota
do $$ begin
  create type planejamento.rota_status as enum ('rascunho','planejada','em_rota','concluida');
exception when duplicate_object then null; end $$;

-- 1) MOTORISTA — cadastro próprio (substitui o texto livre da carga)
create table if not exists planejamento.motorista (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  telefone    text,
  placa       text,
  cnh         text,
  ativo       boolean not null default true,
  observacao  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);
create unique index if not exists uq_motorista_nome on planejamento.motorista (lower(nome));

-- 2) ROTA — cabeçalho (um motorista pode ter VÁRIAS rotas)
create table if not exists planejamento.rota (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  motorista_id uuid references planejamento.motorista(id) on delete set null,
  data         date,
  status       planejamento.rota_status not null default 'rascunho',
  observacao   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id)
);
create index if not exists idx_rota_motorista on planejamento.rota(motorista_id);
create index if not exists idx_rota_data on planejamento.rota(data);

-- 3) ROTA_PARADA — cada pedido é uma parada; ordem = posição sugerida.
--    unique(pedido_id) => 1 pedido em 1 rota só (mover = update rota_id).
create table if not exists planejamento.rota_parada (
  id         uuid primary key default gen_random_uuid(),
  rota_id    uuid not null references planejamento.rota(id) on delete cascade,
  pedido_id  uuid not null references planejamento.pedido(id) on delete cascade,
  ordem      int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_parada_pedido unique (pedido_id)
);
create index if not exists idx_parada_rota on planejamento.rota_parada(rota_id);

-- 4) LOCALIDADE — cache de coordenadas por cidade (geocodada 1x)
create table if not exists planejamento.localidade (
  id          uuid primary key default gen_random_uuid(),
  cidade_norm text not null,   -- UPPER sem acento (chave estável)
  uf          text not null,
  cidade      text not null,   -- grafia "bonita" p/ exibir
  lat         double precision,
  lng         double precision,
  fonte       text,            -- 'nominatim' | 'ibge' | 'manual'
  geocoded_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint uq_localidade unique (cidade_norm, uf)
);

-- 5) Cidade-base da fábrica nos PARÂMETROS (singleton já existente)
alter table planejamento.parametros add column if not exists cidade_base text;
alter table planejamento.parametros add column if not exists uf_base     text;
alter table planejamento.parametros add column if not exists lat_base    double precision;
alter table planejamento.parametros add column if not exists lng_base    double precision;

-- Semeia a fábrica (Santana do Paraíso/MG). Coordenadas aproximadas do centro —
-- corrigíveis depois na tela de parâmetros. Garante a linha singleton id=1.
insert into planejamento.parametros (id, cidade_base, uf_base, lat_base, lng_base)
values (1, 'Santana do Paraíso', 'MG', -19.365, -42.545)
on conflict (id) do update set
  cidade_base = coalesce(parametros.cidade_base, excluded.cidade_base),
  uf_base     = coalesce(parametros.uf_base,     excluded.uf_base),
  lat_base    = coalesce(parametros.lat_base,    excluded.lat_base),
  lng_base    = coalesce(parametros.lng_base,    excluded.lng_base);

-- ----------------------------------------------------------------------------
-- updated_at automático
-- ----------------------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['motorista','rota','rota_parada','localidade'] loop
    execute format('drop trigger if exists trg_%1$s_updated on planejamento.%1$s;', t);
    execute format('create trigger trg_%1$s_updated before update on planejamento.%1$s
                    for each row execute function planejamento.set_updated_at();', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- RLS: membro lê; editor (admin/pcp) escreve. (localidade: membro também escreve,
-- pois é só um cache de coordenadas alimentado pelo navegador ao montar a rota.)
-- ----------------------------------------------------------------------------
alter table planejamento.motorista    enable row level security;
alter table planejamento.rota          enable row level security;
alter table planejamento.rota_parada   enable row level security;
alter table planejamento.localidade    enable row level security;

do $$ declare t text; begin
  foreach t in array array['motorista','rota','rota_parada'] loop
    execute format('drop policy if exists %1$s_select on planejamento.%1$s;', t);
    execute format('create policy %1$s_select on planejamento.%1$s for select to authenticated
                    using (planejamento.is_member(auth.uid()));', t);
    execute format('drop policy if exists %1$s_write on planejamento.%1$s;', t);
    execute format('create policy %1$s_write on planejamento.%1$s for all to authenticated
                    using (planejamento.is_editor(auth.uid())) with check (planejamento.is_editor(auth.uid()));', t);
  end loop;
end $$;

drop policy if exists localidade_select on planejamento.localidade;
create policy localidade_select on planejamento.localidade for select to authenticated
  using (planejamento.is_member(auth.uid()));
drop policy if exists localidade_write on planejamento.localidade;
create policy localidade_write on planejamento.localidade for all to authenticated
  using (planejamento.is_member(auth.uid())) with check (planejamento.is_member(auth.uid()));

-- ----------------------------------------------------------------------------
-- View de conveniência: parada + pedido + coordenadas (para o mapa numa query só)
-- ----------------------------------------------------------------------------
create or replace view planejamento.vw_rota_parada with (security_invoker = true) as
select
  rp.id, rp.rota_id, rp.pedido_id, rp.ordem,
  p.numero        as pedido_numero,
  p.cliente_nome,
  p.cidade_entrega,
  p.uf_entrega,
  loc.lat,
  loc.lng
from planejamento.rota_parada rp
join planejamento.pedido p on p.id = rp.pedido_id
left join planejamento.localidade loc
  on loc.uf = upper(trim(p.uf_entrega))
 and loc.cidade_norm = upper(translate(trim(p.cidade_entrega),
       'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
       'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'));

-- ----------------------------------------------------------------------------
-- GRANTS (views/tabelas novas não herdam o grant "all tables" já rodado)
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on
  planejamento.motorista, planejamento.rota, planejamento.rota_parada, planejamento.localidade
  to authenticated;
grant select on planejamento.motorista, planejamento.rota, planejamento.rota_parada,
  planejamento.localidade, planejamento.vw_rota_parada to anon;
grant all on planejamento.motorista, planejamento.rota, planejamento.rota_parada,
  planejamento.localidade to service_role;
grant select on planejamento.vw_rota_parada to authenticated, service_role;
