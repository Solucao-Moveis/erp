-- ============================================================
-- Sequenciamento de Produção: calendário de dias por máquina, calculado
-- a partir de um item pai + quantidade, ANTES de virar lote.
--
-- maquina_nome aqui é texto livre, igual em codi.produto_tempos_maquina —
-- não é FK para codi.maquinas.id porque os nomes não batem 1:1 (a
-- cronoanálise tem nomes "combinados" tipo "LASER K6 152 + LASER VITERBO"
-- quando a mesma operação foi medida em mais de uma máquina equivalente;
-- codi.maquinas é só o registro das máquinas monitoradas ao vivo, um
-- universo menor e com nomenclatura própria).
-- ============================================================

create table if not exists codi.capacidade_maquina (
  maquina_nome  text primary key,
  horas_dia     numeric(5,2) not null default 8,
  atualizado_em timestamptz default now()
);

alter table codi.capacidade_maquina enable row level security;

drop policy if exists cap_select on codi.capacidade_maquina;
create policy cap_select on codi.capacidade_maquina
  for select to authenticated using (codi.is_member());

drop policy if exists cap_upsert on codi.capacidade_maquina;
create policy cap_upsert on codi.capacidade_maquina
  for insert to authenticated with check (codi.is_member());

drop policy if exists cap_update on codi.capacidade_maquina;
create policy cap_update on codi.capacidade_maquina
  for update to authenticated using (codi.is_member());

grant select, insert, update on codi.capacidade_maquina to authenticated;

-- ---------- Cabeçalho do sequenciamento ----------

create table if not exists codi.sequenciamentos (
  id                   bigint generated always as identity primary key,
  produto_raiz         text references codi.produtos(codigo),
  nome_produto         text,
  quantidade           numeric(12,2) not null,
  data_inicio_desejada date not null,
  criado_em            timestamptz default now(),
  criado_por           uuid
);

alter table codi.sequenciamentos enable row level security;

drop policy if exists seq_select on codi.sequenciamentos;
create policy seq_select on codi.sequenciamentos
  for select to authenticated using (codi.is_member());

drop policy if exists seq_insert on codi.sequenciamentos;
create policy seq_insert on codi.sequenciamentos
  for insert to authenticated with check (codi.is_member());

grant select, insert on codi.sequenciamentos to authenticated;

-- ---------- Alocações (a "agenda" reservada por máquina/dia) ----------

create table if not exists codi.sequenciamento_alocacoes (
  id                bigint generated always as identity primary key,
  sequenciamento_id bigint not null references codi.sequenciamentos(id) on delete cascade,
  maquina_nome      text not null,
  setor             text,
  dia               date not null,
  horas_alocadas    numeric(6,2) not null
);

create index if not exists seq_aloc_maquina_dia_idx
  on codi.sequenciamento_alocacoes (maquina_nome, dia);

alter table codi.sequenciamento_alocacoes enable row level security;

drop policy if exists seq_aloc_select on codi.sequenciamento_alocacoes;
create policy seq_aloc_select on codi.sequenciamento_alocacoes
  for select to authenticated using (codi.is_member());

drop policy if exists seq_aloc_insert on codi.sequenciamento_alocacoes;
create policy seq_aloc_insert on codi.sequenciamento_alocacoes
  for insert to authenticated with check (codi.is_member());

grant select, insert on codi.sequenciamento_alocacoes to authenticated;
