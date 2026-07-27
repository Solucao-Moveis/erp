-- ============================================================
-- codi_disponibilidade_dia.sql — histórico diário de disponibilidade
-- ------------------------------------------------------------
-- Complementa codi_detalhe.sql (que deve ter rodado antes).
-- Idempotente — pode ser reaplicado a qualquer momento.
-- Rodar no SQL Editor do Supabase SMERP.
--
-- codi.maquinas_detalhe é upsert por maquina_id (sobrescreve, sem
-- histórico). Esta tabela guarda 1 linha por (máquina, dia): o
-- coletor faz upsert nela a cada ciclo REST com os mesmos dados que
-- já busca pra maquinas_detalhe (nenhuma chamada nova à API do CODI).
-- Como o upsert usa a data do turno como parte da chave, quando o
-- dia vira, a linha do dia anterior para de ser tocada e fica com o
-- último valor do turno — que é a disponibilidade final daquele dia.
-- ============================================================

create table if not exists codi.maquinas_disponibilidade_dia (
  maquina_id          integer not null references codi.maquinas(id) on delete cascade,
  dia                 date    not null,
  tempo_producao_min  numeric,
  tempo_parada_min    numeric,
  disponibilidade_pct numeric(5,2),
  oee_pct             numeric(5,2),
  performance_pct     numeric(5,2),
  qualidade_pct       numeric(5,2),
  atualizado_em       timestamptz not null default now(),
  primary key (maquina_id, dia)
);

create index if not exists idx_codi_disp_dia_dia
  on codi.maquinas_disponibilidade_dia (dia desc);

-- ---------- RLS ----------
alter table codi.maquinas_disponibilidade_dia enable row level security;

drop policy if exists codi_dispdia_select on codi.maquinas_disponibilidade_dia;

create policy codi_dispdia_select on codi.maquinas_disponibilidade_dia
  for select to authenticated using (codi.is_member());

grant select on codi.maquinas_disponibilidade_dia to authenticated;
