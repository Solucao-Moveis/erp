-- ============================================================
-- codi_detalhe.sql — detalhe por máquina (produção/hora, OEE)
-- ------------------------------------------------------------
-- Complementa codi_schema.sql (que deve ter rodado antes).
-- Idempotente — pode ser reaplicado a qualquer momento.
-- Rodar no SQL Editor do Supabase SMERP.
-- ============================================================

-- ---------- DETALHE DO TURNO (snapshot por máquina) ----------
-- Populado pelo coletor a cada ciclo REST via endpoint mobileApp.
create table if not exists codi.maquinas_detalhe (
  maquina_id        integer primary key,
  -- OF atual
  of_numero         text,
  of_operacao       text,
  item_code         text,
  item_name         text,
  -- Funcionário / Operador
  operador_nome     text,
  -- Tempo do item (ciclo padrão em minutos/peça)
  tempo_item_min    numeric,
  -- Contadores de peças do turno
  boas              numeric,
  ruins             numeric,
  producao_turno    numeric,          -- total produzido (soma dos graphValues.value)
  total_previsto    numeric,
  -- OEE e indicadores (nullable — calculados dos graphValues ou do endpoint /current)
  oee               numeric(5,2),
  disponibilidade   numeric(5,2),
  performance       numeric(5,2),     -- calculado: currentPerf / standardPerf × 100
  qualidade         numeric(5,2),
  -- Meta (standardPerformance do mobileApp em peças/min)
  meta_ppm          numeric,
  -- Referência do turno
  turno_data        date,
  turno_inicio      timestamptz,
  turno_fim         timestamptz,
  -- Controle
  atualizado_em     timestamptz not null default now()
);

-- ---------- PRODUÇÃO POR HORA (gráfico de barras) ----------
-- Uma linha por (máquina, dia, hora); coletor apaga + re-insere do turno corrente.
create table if not exists codi.producao_hora (
  maquina_id        integer  not null,
  turno_data        date     not null,
  hora              smallint not null,  -- 0-23, fuso horário local do PC da fábrica
  quantidade        numeric,
  performance_media numeric(5,2),       -- média currentPerf/standardPerf × 100 nessa hora
  meta_ppm          numeric,
  primary key (maquina_id, turno_data, hora)
);

create index if not exists idx_codi_prohora_maq
  on codi.producao_hora (maquina_id, turno_data);

-- ---------- LINHA DO TEMPO (paradas e produções) ----------
-- Populada pelo endpoint downtime (a confirmar estrutura após ver response).
create table if not exists codi.eventos_turno (
  id                bigint generated always as identity primary key,
  maquina_id        integer      not null,
  turno_data        date         not null,
  tipo              text         not null,  -- 'producao' | 'parada'
  inicio            timestamptz  not null,
  fim               timestamptz,
  duracao_min       numeric,
  cod_parada        integer,
  desc_parada       text,
  cod_tipo_parada   integer,
  desc_tipo_parada  text,
  cor               text                    -- hex sem # ex: 'eb0000'
);

create index if not exists idx_codi_eventos_maq
  on codi.eventos_turno (maquina_id, turno_data);

-- ---------- SYNC STATE ----------
insert into codi.sync_state (recurso) values ('detalhe')
  on conflict (recurso) do nothing;

-- ---------- RLS ----------
alter table codi.maquinas_detalhe enable row level security;
alter table codi.producao_hora    enable row level security;
alter table codi.eventos_turno    enable row level security;

drop policy if exists codi_det_select on codi.maquinas_detalhe;
drop policy if exists codi_phr_select on codi.producao_hora;
drop policy if exists codi_evt_select on codi.eventos_turno;

create policy codi_det_select on codi.maquinas_detalhe
  for select to authenticated using (codi.is_member());

create policy codi_phr_select on codi.producao_hora
  for select to authenticated using (codi.is_member());

create policy codi_evt_select on codi.eventos_turno
  for select to authenticated using (codi.is_member());

grant select on codi.maquinas_detalhe, codi.producao_hora, codi.eventos_turno
  to authenticated;
