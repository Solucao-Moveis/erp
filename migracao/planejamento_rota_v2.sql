-- ============================================================================
-- Planejamento de Carga — Rota v2: a unidade da rota passa a ser a FATIA
--   (o pedido JÁ FATIADO, com cubagem) em vez do pedido inteiro.
--   Roda DEPOIS de planejamento_rota.sql. Recria rota_parada (agora por fatia) e
--   a view vw_rota_parada (agora trazendo cubagem + cidade da fatia).
--   ATENÇÃO: descarta as paradas antigas (que eram por pedido) — ok em teste.
-- ============================================================================

drop view if exists planejamento.vw_rota_parada;
drop table if exists planejamento.rota_parada cascade;

-- ROTA_PARADA agora aponta pra FATIA (cada fatia = um pedaço com cubagem).
--   unique(fatia_id) => uma fatia fica em 1 rota só (mover = troca rota_id).
create table planejamento.rota_parada (
  id         uuid primary key default gen_random_uuid(),
  rota_id    uuid not null references planejamento.rota(id) on delete cascade,
  fatia_id   uuid not null references planejamento.fatia(id) on delete cascade,
  ordem      int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_parada_fatia unique (fatia_id)
);
create index if not exists idx_parada_rota on planejamento.rota_parada(rota_id);

-- updated_at
drop trigger if exists trg_rota_parada_updated on planejamento.rota_parada;
create trigger trg_rota_parada_updated before update on planejamento.rota_parada
  for each row execute function planejamento.set_updated_at();

-- RLS: membro lê, editor escreve
alter table planejamento.rota_parada enable row level security;
drop policy if exists rota_parada_select on planejamento.rota_parada;
create policy rota_parada_select on planejamento.rota_parada for select to authenticated
  using (planejamento.is_member(auth.uid()));
drop policy if exists rota_parada_write on planejamento.rota_parada;
create policy rota_parada_write on planejamento.rota_parada for all to authenticated
  using (planejamento.is_editor(auth.uid())) with check (planejamento.is_editor(auth.uid()));

grant select, insert, update, delete on planejamento.rota_parada to authenticated;
grant select on planejamento.rota_parada to anon;
grant all on planejamento.rota_parada to service_role;

-- View: parada (fatia) + cubagem + cidade + pedido + coordenadas (p/ o mapa).
--   Cidade da fatia = destino da carga dela (vw_fatia_full.destino_cidade/uf).
create or replace view planejamento.vw_rota_parada with (security_invoker = true) as
select
  rp.id,
  rp.rota_id,
  rp.fatia_id,
  rp.ordem,
  ff.pedido_id,
  ff.pedido_numero,
  ff.cliente_nome,
  ff.descricao,
  ff.produto_codigo,
  ff.quantidade,
  ff.cubagem,
  ff.destino_cidade as cidade_entrega,
  ff.destino_uf     as uf_entrega,
  loc.lat,
  loc.lng
from planejamento.rota_parada rp
join planejamento.vw_fatia_full ff on ff.fatia_id = rp.fatia_id
left join planejamento.localidade loc
  on loc.uf = upper(trim(ff.destino_uf))
 and loc.cidade_norm = upper(translate(trim(ff.destino_cidade),
       'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
       'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'));

grant select on planejamento.vw_rota_parada to authenticated, anon, service_role;
