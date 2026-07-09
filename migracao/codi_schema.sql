-- ============================================================
-- schema codi — espelho do CODI (ERP legado, rede interna 10.7.10.x)
-- ------------------------------------------------------------
-- O coletor Node.js (erp/codi-coletor/) lê a API REST do CODI
-- a cada 5 min e faz upsert aqui via service_role.
-- O app painel-producao-solucao lê daqui (anon + sessão SSO).
-- Idempotente: pode rodar do zero ou reaplicado.
--
-- ATENÇÃO (PostgREST): adicionar 'codi' em PGRST_DB_SCHEMAS no
--   EasyPanel (variável do serviço Supabase), junto com os demais.
-- ATENÇÃO (my_systems): já atualizado nos 2 arquivos:
--   migracao/my_systems.sql e migracao/utilitarios-my-systems.sql
-- ============================================================

-- ---------- SCHEMA ----------
create schema if not exists codi;
grant usage on schema codi to anon, authenticated, service_role;
alter default privileges in schema codi grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema codi grant all on functions to anon, authenticated, service_role;
alter default privileges in schema codi grant all on sequences to anon, authenticated, service_role;

-- ---------- ENUMS ----------
do $$ begin
  create type codi.app_role as enum ('gestor', 'leitor');
exception when duplicate_object then null; end $$;

-- ---------- PROFILES (espelho de auth.users) ----------
create table if not exists codi.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  email      text,
  updated_at timestamptz default now()
);

-- ---------- PAPÉIS ----------
create table if not exists codi.user_roles (
  id         bigint primary key generated always as identity,
  user_id    uuid not null references codi.profiles(id) on delete cascade,
  role       codi.app_role not null,
  unique (user_id, role)
);

-- ---------- ORDENS DE FABRICAÇÃO (espelho de ListarOrdemFabricacao) ----------
-- Chave natural do CODI: coluna 'ordem' (ex: "000123456")
-- Status conhecido: "A" = Aberta, "E" = Encerrada (outros podem existir)
create table if not exists codi.ofs (
  ordem                    text primary key,
  produto                  text,
  nome_produto             text,
  tipo                     text,
  deposito                 text,
  lote                     text,
  quantidade               numeric,
  quantidade_produzida     numeric default 0,
  status                   text,
  data_previsao            date,
  data_alteracao           date,
  industrializacao_terceiro text,
  atualizado_em            timestamptz not null default now()
);

create index if not exists idx_codi_ofs_status      on codi.ofs (status);
create index if not exists idx_codi_ofs_previsao    on codi.ofs (data_previsao);
create index if not exists idx_codi_ofs_alteracao   on codi.ofs (data_alteracao desc);

-- ---------- RESERVAS DE TEMPO (espelho de ListarReservaTempo) ----------
-- Chave natural: 'requisicao' (identificador único do CODI)
-- tempo_* = minutos; quantidade_operadores = nro de operadores simultâneos
create table if not exists codi.reservas_tempo (
  requisicao              text primary key,
  ordem_fabricacao        text,   -- FK lógica → codi.ofs.ordem
  produto                 text,
  produto_descricao       text,
  processo                text,
  operacao                text,
  operacao_descricao      text,
  fase                    text,
  fase_descricao          text,
  maquina                 text,   -- código da máquina (→ codi.maquinas.codigo)
  maquina_descricao       text,
  quantidade              numeric,
  quantidade_produzida    numeric default 0,
  tempo_reservado         numeric,   -- minutos totais da operação
  tempo_requisitado       numeric,   -- minutos já apontados/consumidos
  tempo_setup             numeric default 0,
  quantidade_operadores   integer default 1,
  tipo_processo           text,
  data_alteracao          date,
  data_encerramento_ordem date,
  atualizado_em           timestamptz not null default now()
);

create index if not exists idx_codi_res_ordem    on codi.reservas_tempo (ordem_fabricacao);
create index if not exists idx_codi_res_maquina  on codi.reservas_tempo (maquina);
create index if not exists idx_codi_res_alteracao on codi.reservas_tempo (data_alteracao desc);

-- ---------- MÁQUINAS (espelho de ConsultarMaquina) ----------
create table if not exists codi.maquinas (
  codigo           text primary key,
  descricao        text,
  abreviatura      text,
  grupo            text,
  ccusto           text,
  horas_disponiveis numeric,   -- horas/dia disponíveis para produção
  valor_hora_padrao numeric,
  status           text,
  atualizado_em    timestamptz not null default now()
);

-- ---------- MOTIVOS DE PARADA / PERDA ----------
create table if not exists codi.motivos_parada (
  codigo    text primary key,
  descricao text,
  ativo     boolean default true,
  atualizado_em timestamptz not null default now()
);

create table if not exists codi.motivos_perda (
  codigo    text primary key,
  descricao text,
  ativo     boolean default true,
  atualizado_em timestamptz not null default now()
);

-- ---------- PARADAS / PERDAS (se disponível via API) ----------
-- Podem ficar vazias na Fase 1; preenchidas quando API de consulta confirmar
create table if not exists codi.paradas (
  id_integracao    text primary key,
  ordem_fabricacao text,
  maquina          text,
  motivo           text,
  data_inicio      timestamptz,
  data_fim         timestamptz,
  observacao       text,
  atualizado_em    timestamptz not null default now()
);

create table if not exists codi.perdas (
  id_integracao    text primary key,
  ordem_fabricacao text,
  maquina          text,
  motivo           text,
  quantidade       numeric,
  data_ocorrencia  timestamptz,
  observacao       text,
  atualizado_em    timestamptz not null default now()
);

-- ---------- ESTADO DA SINCRONIZAÇÃO ----------
-- O coletor grava aqui ao final de cada ciclo.
-- O app exibe o selo "dados de HH:MM (atualizado há X min)".
create table if not exists codi.sync_state (
  recurso      text primary key,   -- 'ofs', 'reservas_tempo', 'maquinas', etc.
  ultimo_sync  timestamptz,
  ok           boolean default true,
  mensagem     text                -- stack trace se ok=false
);

-- Inicializa os recursos conhecidos (idempotente)
insert into codi.sync_state (recurso) values
  ('ofs'), ('reservas_tempo'), ('maquinas'), ('motivos_parada'), ('motivos_perda'),
  ('paradas'), ('perdas')
on conflict (recurso) do nothing;

-- ============================================================
-- HELPERS de acesso
-- ============================================================

create or replace function codi.is_member()
returns boolean
language sql stable security definer set search_path = codi, public
as $$
  select exists (select 1 from codi.profiles where id = auth.uid());
$$;

create or replace function codi.has_role(_role codi.app_role)
returns boolean
language sql stable security definer set search_path = codi, public
as $$
  select exists (
    select 1 from codi.user_roles
     where user_id = auth.uid() and role = _role
  );
$$;

grant execute on function codi.is_member()                to authenticated;
grant execute on function codi.has_role(codi.app_role)   to authenticated;

-- ============================================================
-- VIEWS de apoio (security_invoker = respeita RLS do chamador)
-- ============================================================

-- OFs abertas com atraso calculado e % produzido
create or replace view codi.v_ofs_abertas
with (security_invoker = true) as
select
  o.ordem,
  o.produto,
  o.nome_produto,
  o.deposito,
  o.lote,
  o.quantidade,
  coalesce(o.quantidade_produzida, 0) as quantidade_produzida,
  o.status,
  o.data_previsao,
  o.data_alteracao,
  -- dias de atraso (positivo = atrasado, negativo = dentro do prazo)
  case
    when o.data_previsao is not null
    then (current_date - o.data_previsao)::integer
    else null
  end as atraso_dias,
  -- percentual produzido
  case
    when o.quantidade > 0
    then round((coalesce(o.quantidade_produzida, 0) / o.quantidade) * 100, 1)
    else 0
  end as percentual_produzido
from codi.ofs o
where o.status is distinct from 'E';  -- exclui Encerradas

-- Carga por máquina: tempo restante (minutos) ÷ horas_disponiveis → dias de fila
create or replace view codi.v_carga_maquina
with (security_invoker = true) as
select
  r.maquina,
  r.maquina_descricao,
  m.descricao as maquina_nome_cadastro,
  m.horas_disponiveis,
  count(distinct r.ordem_fabricacao)                        as qtd_ofs,
  count(*)                                                  as qtd_operacoes,
  round(sum(greatest(coalesce(r.tempo_reservado, 0) - coalesce(r.tempo_requisitado, 0), 0)) / 60.0, 1)
                                                            as horas_restantes,
  case
    when m.horas_disponiveis > 0
    then round(
           sum(greatest(coalesce(r.tempo_reservado, 0) - coalesce(r.tempo_requisitado, 0), 0))
           / 60.0
           / m.horas_disponiveis,
           1)
    else null
  end                                                       as dias_fila
from codi.reservas_tempo r
left join codi.maquinas m on m.codigo = r.maquina
-- só reservas de OFs abertas (inner join lógico via exists)
where exists (
  select 1 from codi.ofs o
  where o.ordem = r.ordem_fabricacao and o.status is distinct from 'E'
)
  and coalesce(r.tempo_reservado, 0) > coalesce(r.tempo_requisitado, 0)
group by r.maquina, r.maquina_descricao, m.descricao, m.horas_disponiveis
order by dias_fila desc nulls last;

-- ============================================================
-- RLS — leitura p/ membros; escrita exclusiva do service_role (coletor)
-- ============================================================

alter table codi.profiles      enable row level security;
alter table codi.user_roles    enable row level security;
alter table codi.ofs           enable row level security;
alter table codi.reservas_tempo enable row level security;
alter table codi.maquinas      enable row level security;
alter table codi.motivos_parada enable row level security;
alter table codi.motivos_perda  enable row level security;
alter table codi.paradas       enable row level security;
alter table codi.perdas        enable row level security;
alter table codi.sync_state    enable row level security;

-- profiles: cada um vê o próprio
drop policy if exists codi_profiles_self on codi.profiles;
create policy codi_profiles_self on codi.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists codi_roles_self on codi.user_roles;
create policy codi_roles_self on codi.user_roles
  for select to authenticated using (user_id = auth.uid());

-- dados: select aberto p/ membros; sem write p/ authenticated (só service_role)
drop policy if exists codi_ofs_select on codi.ofs;
create policy codi_ofs_select on codi.ofs
  for select to authenticated using (codi.is_member());

drop policy if exists codi_res_select on codi.reservas_tempo;
create policy codi_res_select on codi.reservas_tempo
  for select to authenticated using (codi.is_member());

drop policy if exists codi_maq_select on codi.maquinas;
create policy codi_maq_select on codi.maquinas
  for select to authenticated using (codi.is_member());

drop policy if exists codi_mp_select on codi.motivos_parada;
create policy codi_mp_select on codi.motivos_parada
  for select to authenticated using (codi.is_member());

drop policy if exists codi_ml_select on codi.motivos_perda;
create policy codi_ml_select on codi.motivos_perda
  for select to authenticated using (codi.is_member());

drop policy if exists codi_par_select on codi.paradas;
create policy codi_par_select on codi.paradas
  for select to authenticated using (codi.is_member());

drop policy if exists codi_per_select on codi.perdas;
create policy codi_per_select on codi.perdas
  for select to authenticated using (codi.is_member());

drop policy if exists codi_sync_select on codi.sync_state;
create policy codi_sync_select on codi.sync_state
  for select to authenticated using (codi.is_member());

-- grants de leitura para authenticated
grant select on
  codi.ofs, codi.reservas_tempo, codi.maquinas,
  codi.motivos_parada, codi.motivos_perda,
  codi.paradas, codi.perdas, codi.sync_state
  to authenticated;
grant select on codi.profiles, codi.user_roles to authenticated;

-- ============================================================
-- TESTE rápido (SQL Editor do Supabase, logado como usuário):
--   select codi.is_member();
--   select * from codi.v_carga_maquina limit 5;
--   select * from codi.sync_state;
-- ============================================================
