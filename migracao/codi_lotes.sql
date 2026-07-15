-- ============================================================
-- Lotes de producao + OFs por lote (sincronizado do CODI API).
-- ============================================================

create table if not exists codi.lotes (
  numero        text primary key,
  data_previsao date,
  total_ofs     int default 0,
  atualizado_em timestamptz default now()
);
alter table codi.lotes enable row level security;
create policy lotes_select on codi.lotes
  for select to authenticated using (codi.is_member());
grant select on codi.lotes to authenticated;

create table if not exists codi.of_por_lote (
  ordem                int  primary key,
  lote                 text not null references codi.lotes(numero) on delete cascade,
  produto              text,
  nome_produto         text,
  quantidade           numeric(14,4),
  quantidade_produzida numeric(14,4),
  status               text,
  data_previsao        date,
  data_alteracao       date,
  deposito             int,
  atualizado_em        timestamptz default now()
);
alter table codi.of_por_lote enable row level security;
create policy of_lote_select on codi.of_por_lote
  for select to authenticated using (codi.is_member());
grant select on codi.of_por_lote to authenticated;
