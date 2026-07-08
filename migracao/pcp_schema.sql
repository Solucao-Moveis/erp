-- ============================================================
-- SCHEMA: pcp   (sistema data-weave-vault — PCP / Cronoanálise / Sequenciamento)
-- ------------------------------------------------------------
-- Consolidação das 19 migrations do Lovable num schema próprio do banco
-- unificado SMERP. SOMENTE ESTRUTURA (sem dados/seeds) — os dados entram
-- na Fase 2 via import preservando ids/usuários (migracao/dados-pcp/).
--
-- Papéis (enum app_role): admin, analista_pcp, supervisor, operador.
--   - admin/analista_pcp (is_pcp): escrevem nos cadastros e no planejamento.
--   - qualquer usuário do app: lê tudo, registra produção/paradas/CODI próprios.
--
-- Adaptações vs. Lovable (documentadas):
--   1. Leitura era USING(true) pra qualquer authenticated — no banco
--      compartilhado isso vazaria pra todo usuário SSO do ERP (mesmo furo
--      mapeado em compras/bip/manutencao). Trocado por pcp.has_access()
--      (tem profile no schema pcp), espelhando sobras.has_access.
--   2. Funções que no Lovable acabaram em app_private.* ficam em pcp.*
--      (o front não chama nenhuma via RPC — só as policies usam).
--   3. Buckets prefixados: estudos→pcp-estudos, codi→pcp-codi,
--      manutencao→pcp-manutencao (id de bucket é global; 'manutencao'
--      confundiria com o módulo Manutenção). Front ajusta na Fase 3.
--      Obs: os 3 buckets estão VAZIOS no Lovable (export storage = []).
--   4. Trigger em auth.users prefixado e travado por app='pcp'.
--
-- Gotchas de schema COMPARTILHADO (auth.users e storage.objects são globais):
--   - trigger em auth.users: pcp_on_auth_user_created (guard por app);
--   - policies de storage.objects com nome prefixado pcp_*.
--
-- Rodar no SQL Editor do Supabase SMERP. Idempotente: pode reexecutar.
-- Ao final, lembrar de expor o schema no PostgREST:
--   PGRST_DB_SCHEMAS = ...,pcp   (EasyPanel) + notify pgrst, 'reload schema';
-- E incluir 'pcp' no my_systems() — NOS DOIS ARQUIVOS
--   (migracao/my_systems.sql e migracao/utilitarios-my-systems.sql)!
-- ============================================================

create schema if not exists pcp;
grant usage on schema pcp to anon, authenticated, service_role;
alter default privileges in schema pcp grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema pcp grant all on functions to anon, authenticated, service_role;
alter default privileges in schema pcp grant all on sequences to anon, authenticated, service_role;

-- ============================================================
-- ENUMS (idempotentes) — op_status já na ordem final do Lovable
-- (original + inspecao/tratamento/marcenaria adicionados por ALTER TYPE)
-- ============================================================
do $$ begin create type pcp.app_role        as enum ('admin','analista_pcp','supervisor','operador'); exception when duplicate_object then null; end $$;
do $$ begin create type pcp.lote_prioridade as enum ('baixa','normal','alta','critica');               exception when duplicate_object then null; end $$;
do $$ begin create type pcp.op_status       as enum ('planejado','metalurgia','solda','inspecao','tratamento','pintura','marcenaria','montagem','concluido'); exception when duplicate_object then null; end $$;

-- ============================================================
-- TABELAS — ROLES / PERFIS
-- ============================================================
create table if not exists pcp.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists pcp.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role pcp.app_role not null,
  unique (user_id, role)
);

-- ============================================================
-- FUNÇÕES DE ACESSO (security definer; dependem de user_roles/profiles)
-- ============================================================
-- gate de acesso ao sistema: tem profile no schema pcp?
create or replace function pcp.has_access(_user_id uuid)
returns boolean language sql stable security definer set search_path = pcp, public
as $$ select exists (select 1 from pcp.profiles where id = _user_id) $$;

create or replace function pcp.has_role(_user_id uuid, _role pcp.app_role)
returns boolean language sql stable security definer set search_path = pcp, public
as $$ select exists (select 1 from pcp.user_roles where user_id = _user_id and role = _role) $$;

create or replace function pcp.is_pcp(_user_id uuid)
returns boolean language sql stable security definer set search_path = pcp, public
as $$ select exists (select 1 from pcp.user_roles where user_id = _user_id and role in ('admin','analista_pcp')) $$;

-- profile + papel padrão (operador) no signup, COM trava por sistema (app='pcp').
-- No SMERP o acesso é dado pela aba "Usuários" do hub (insere profile+papel direto),
-- então essa trava garante que cadastros de OUTROS apps não ganhem acesso ao PCP.
create or replace function pcp.handle_new_user()
returns trigger language plpgsql security definer set search_path = pcp, public
as $$
begin
  if (new.raw_user_meta_data->>'app') is distinct from 'pcp' then
    return new;
  end if;
  insert into pcp.profiles (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), new.email)
  on conflict (id) do nothing;
  insert into pcp.user_roles (user_id, role)
  values (new.id, 'operador')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

drop trigger if exists pcp_on_auth_user_created on auth.users;
create trigger pcp_on_auth_user_created
after insert on auth.users for each row execute function pcp.handle_new_user();

-- ============================================================
-- TABELAS — DOMÍNIO (estado final das migrations, colunas de ALTER já embutidas)
-- ============================================================
create table if not exists pcp.setores (
  codigo text primary key,
  nome text not null,
  descricao text,
  ordem_fluxo int not null default 0,
  cor_hex text default '#94a3b8'
);

create table if not exists pcp.recursos (
  id uuid primary key default gen_random_uuid(),
  setor_codigo text not null references pcp.setores(codigo),
  nome_maquina text not null,
  ip_coletor text,
  turnos_horas_dia numeric not null default 16,
  eficiencia_padrao numeric(4,3) not null default 0.90 check (eficiencia_padrao > 0 and eficiencia_padrao <= 1),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  tag_id text unique,
  codigo_equipamento text,
  codi_ativo boolean not null default false
);

create table if not exists pcp.itens (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  descricao text not null,
  materia_prima text,
  cor text,
  modelo_gabarito text,
  created_at timestamptz not null default now()
);

create table if not exists pcp.roteiro_tempos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references pcp.itens(id) on delete cascade,
  recurso_id uuid not null references pcp.recursos(id) on delete cascade,
  ciclo_segundos_por_peca numeric not null check (ciclo_segundos_por_peca > 0),
  setup_segundos_por_lote int not null default 0,
  lote_ideal int not null default 1 check (lote_ideal > 0),
  unique (item_id, recurso_id)
);

create table if not exists pcp.lotes (
  id uuid primary key default gen_random_uuid(),
  numero text unique not null,
  descricao text,
  prioridade pcp.lote_prioridade not null default 'normal',
  prazo date,
  dias_uteis int not null default 5,
  status text not null default 'aberto',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists pcp.ordens_producao (
  id uuid primary key default gen_random_uuid(),
  numero_op text not null,
  lote_id uuid not null references pcp.lotes(id) on delete cascade,
  item_id uuid not null references pcp.itens(id),
  quantidade int not null check (quantidade > 0),
  status pcp.op_status not null default 'planejado',
  observacao text,
  created_at timestamptz not null default now(),
  unique (numero_op, lote_id)
);

create table if not exists pcp.producao_diaria (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  recurso_id uuid not null references pcp.recursos(id),
  leitura_inicial numeric not null,
  leitura_final numeric not null,
  producao numeric generated always as (leitura_final - leitura_inicial) stored,
  observacao text,
  registrado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists pcp.estudos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  tipo text not null default 'planilha', -- planilha | artigo | nota | link
  url text,
  storage_path text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists pcp.manutencoes (
  id uuid primary key default gen_random_uuid(),
  recurso_id uuid not null references pcp.recursos(id) on delete cascade,
  atividade text,
  periodicidade text not null default 'Mensal',
  ultima_manutencao date,
  proxima_manutencao date,
  responsavel text,
  status text not null default 'A Planejar',
  tempo_estimado_h numeric not null default 0,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  anexo_path text,
  anexo_nome text,
  contexto_ia text
);

create table if not exists pcp.paradas (
  id uuid primary key default gen_random_uuid(),
  recurso_id uuid not null references pcp.recursos(id) on delete cascade,
  tipo text not null default 'nao_programada', -- 'programada' | 'nao_programada'
  motivo text not null,
  inicio timestamptz not null default now(),
  fim timestamptz,
  status text not null default 'aberta', -- 'aberta' | 'encerrada'
  responsavel text,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  contexto_ia text
);

-- obs: no Lovable recurso_id NÃO tem FK (mantido igual)
create table if not exists pcp.codi_analises (
  id uuid primary key default gen_random_uuid(),
  recurso_id uuid not null,
  data date not null default current_date,
  turno text not null default '1',
  disponibilidade numeric not null default 0,
  paradas_min integer not null default 0,
  producao_real integer not null default 0,
  producao_teorica integer not null default 0,
  pecas_boas integer not null default 0,
  oee numeric not null default 0,
  classificacao text not null default 'regular',
  observacao text,
  anexo_path text,
  anexo_nome text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  contexto_ia text
);

create table if not exists pcp.prioridades_maquina (
  id uuid not null default gen_random_uuid() primary key,
  recurso_id uuid not null references pcp.recursos(id) on delete cascade,
  ordem integer not null default 1,
  tipo text not null,
  item text,
  tempo_min numeric not null default 0,
  observacao text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index if not exists idx_prioridades_recurso on pcp.prioridades_maquina(recurso_id, ordem);

create table if not exists pcp.op_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  op_id uuid not null references pcp.ordens_producao(id) on delete cascade,
  de_status text,
  para_status text not null,
  movido_por uuid default auth.uid(),
  em timestamptz not null default now()
);
create index if not exists idx_op_mov_op on pcp.op_movimentacoes(op_id, em);

create table if not exists pcp.lote_setores (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references pcp.lotes(id) on delete cascade,
  setor_codigo text not null,
  ordem integer not null default 1,
  unique (lote_id, setor_codigo)
);
create index if not exists idx_lote_setores on pcp.lote_setores(lote_id, ordem);

create table if not exists pcp.cronoanalises (
  id uuid primary key default gen_random_uuid(),
  data date,
  codigo text not null,
  descricao text,
  operacao text,
  setor text,
  equipamento text,
  pecas_hora numeric not null default 0,
  tempo_seg numeric not null default 0,
  tempo_texto text,
  qtd_dia numeric,
  observacao text,
  origem text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  gabarito_seg numeric default 0,
  pecas_barra numeric,
  operador text,
  codigo_item2 text,
  descricao_item2 text,
  tamanho_barra_mm numeric,
  tamanho_peca_mm numeric,
  aproveitamento_pct numeric,
  hora_medicao text
);
create index if not exists idx_crono_codigo      on pcp.cronoanalises(codigo);
create index if not exists idx_crono_equipamento on pcp.cronoanalises(equipamento);
create index if not exists idx_crono_setor       on pcp.cronoanalises(setor);

-- ============================================================
-- FUNÇÕES DE NEGÓCIO / VIEW
-- ============================================================
create or replace function pcp.calcular_carga_op(
  _quantidade int, _ciclo_seg numeric, _setup_seg int, _lote_ideal int
) returns numeric language sql immutable set search_path = pcp, public as $$
  select (_ciclo_seg * _quantidade) / 3600.0
       + (_setup_seg * ceil(_quantidade::numeric / _lote_ideal)) / 3600.0;
$$;

drop view if exists pcp.vw_carga_maquina;
create view pcp.vw_carga_maquina with (security_invoker = true) as
select
  r.id as recurso_id,
  r.nome_maquina,
  r.setor_codigo,
  l.id as lote_id,
  l.numero as lote_numero,
  l.dias_uteis,
  sum(pcp.calcular_carga_op(op.quantidade, rt.ciclo_segundos_por_peca, rt.setup_segundos_por_lote, rt.lote_ideal)) as horas_necessarias,
  (l.dias_uteis * r.turnos_horas_dia * r.eficiencia_padrao) as capacidade_horas,
  round(
    100.0 * sum(pcp.calcular_carga_op(op.quantidade, rt.ciclo_segundos_por_peca, rt.setup_segundos_por_lote, rt.lote_ideal))
    / nullif(l.dias_uteis * r.turnos_horas_dia * r.eficiencia_padrao, 0)
  , 2) as ic_percentual
from pcp.ordens_producao op
join pcp.lotes l on l.id = op.lote_id
join pcp.roteiro_tempos rt on rt.item_id = op.item_id
join pcp.recursos r on r.id = rt.recurso_id
where op.status <> 'concluido'
group by r.id, r.nome_maquina, r.setor_codigo, l.id, l.numero, l.dias_uteis, r.turnos_horas_dia, r.eficiencia_padrao;

-- limite de 10 prioridades por máquina
create or replace function pcp.check_prioridade_limit()
returns trigger language plpgsql set search_path = pcp, public as $$
begin
  if (select count(*) from pcp.prioridades_maquina where recurso_id = new.recurso_id) >= 10 then
    raise exception 'Limite de 10 prioridades por máquina atingido';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prioridade_limit on pcp.prioridades_maquina;
create trigger trg_prioridade_limit before insert on pcp.prioridades_maquina
for each row execute function pcp.check_prioridade_limit();

-- ============================================================
-- RLS — estado final do Lovable, com has_access() no lugar de USING(true)
-- ============================================================
alter table pcp.profiles            enable row level security;
alter table pcp.user_roles          enable row level security;
alter table pcp.setores             enable row level security;
alter table pcp.recursos            enable row level security;
alter table pcp.itens               enable row level security;
alter table pcp.roteiro_tempos      enable row level security;
alter table pcp.lotes               enable row level security;
alter table pcp.ordens_producao     enable row level security;
alter table pcp.producao_diaria     enable row level security;
alter table pcp.estudos             enable row level security;
alter table pcp.manutencoes         enable row level security;
alter table pcp.paradas             enable row level security;
alter table pcp.codi_analises       enable row level security;
alter table pcp.prioridades_maquina enable row level security;
alter table pcp.op_movimentacoes    enable row level security;
alter table pcp.lote_setores        enable row level security;
alter table pcp.cronoanalises       enable row level security;

-- profiles / user_roles
drop policy if exists "view own profile"   on pcp.profiles;
create policy "view own profile"   on pcp.profiles   for select to authenticated using (auth.uid() = id);
drop policy if exists "update own profile" on pcp.profiles;
create policy "update own profile" on pcp.profiles   for update to authenticated using (auth.uid() = id);
drop policy if exists "view own roles"     on pcp.user_roles;
create policy "view own roles"     on pcp.user_roles for select to authenticated
  using (auth.uid() = user_id or pcp.has_role(auth.uid(),'admin'));
drop policy if exists "admin manage roles" on pcp.user_roles;
create policy "admin manage roles" on pcp.user_roles for all to authenticated
  using (pcp.has_role(auth.uid(),'admin')) with check (pcp.has_role(auth.uid(),'admin'));

-- leitura: usuários do app (has_access) — adaptação vs USING(true) do Lovable
drop policy if exists "auth read" on pcp.setores;
create policy "auth read" on pcp.setores             for select to authenticated using (pcp.has_access(auth.uid()));
drop policy if exists "auth read" on pcp.recursos;
create policy "auth read" on pcp.recursos            for select to authenticated using (pcp.has_access(auth.uid()));
drop policy if exists "auth read" on pcp.itens;
create policy "auth read" on pcp.itens               for select to authenticated using (pcp.has_access(auth.uid()));
drop policy if exists "auth read" on pcp.roteiro_tempos;
create policy "auth read" on pcp.roteiro_tempos      for select to authenticated using (pcp.has_access(auth.uid()));
drop policy if exists "auth read" on pcp.lotes;
create policy "auth read" on pcp.lotes               for select to authenticated using (pcp.has_access(auth.uid()));
drop policy if exists "auth read" on pcp.ordens_producao;
create policy "auth read" on pcp.ordens_producao     for select to authenticated using (pcp.has_access(auth.uid()));
drop policy if exists "auth read" on pcp.producao_diaria;
create policy "auth read" on pcp.producao_diaria     for select to authenticated using (pcp.has_access(auth.uid()));
drop policy if exists "auth read estudos" on pcp.estudos;
create policy "auth read estudos" on pcp.estudos     for select to authenticated using (pcp.has_access(auth.uid()));
drop policy if exists "auth read manut" on pcp.manutencoes;
create policy "auth read manut" on pcp.manutencoes   for select to authenticated using (pcp.has_access(auth.uid()));
drop policy if exists "auth read paradas" on pcp.paradas;
create policy "auth read paradas" on pcp.paradas     for select to authenticated using (pcp.has_access(auth.uid()));
drop policy if exists "auth read codi" on pcp.codi_analises;
create policy "auth read codi" on pcp.codi_analises  for select to authenticated using (pcp.has_access(auth.uid()));
drop policy if exists "auth read prioridades" on pcp.prioridades_maquina;
create policy "auth read prioridades" on pcp.prioridades_maquina for select to authenticated using (pcp.has_access(auth.uid()));
drop policy if exists "auth read op_mov" on pcp.op_movimentacoes;
create policy "auth read op_mov" on pcp.op_movimentacoes for select to authenticated using (pcp.has_access(auth.uid()));
drop policy if exists "auth read lote_setores" on pcp.lote_setores;
create policy "auth read lote_setores" on pcp.lote_setores for select to authenticated using (pcp.has_access(auth.uid()));
drop policy if exists "auth read crono" on pcp.cronoanalises;
create policy "auth read crono" on pcp.cronoanalises for select to authenticated using (pcp.has_access(auth.uid()));

-- escrita PCP (admin/analista_pcp)
drop policy if exists "pcp write" on pcp.setores;
create policy "pcp write" on pcp.setores         for all to authenticated using (pcp.is_pcp(auth.uid())) with check (pcp.is_pcp(auth.uid()));
drop policy if exists "pcp write" on pcp.recursos;
create policy "pcp write" on pcp.recursos        for all to authenticated using (pcp.is_pcp(auth.uid())) with check (pcp.is_pcp(auth.uid()));
drop policy if exists "pcp write" on pcp.itens;
create policy "pcp write" on pcp.itens           for all to authenticated using (pcp.is_pcp(auth.uid())) with check (pcp.is_pcp(auth.uid()));
drop policy if exists "pcp write" on pcp.roteiro_tempos;
create policy "pcp write" on pcp.roteiro_tempos  for all to authenticated using (pcp.is_pcp(auth.uid())) with check (pcp.is_pcp(auth.uid()));
drop policy if exists "pcp write" on pcp.lotes;
create policy "pcp write" on pcp.lotes           for all to authenticated using (pcp.is_pcp(auth.uid())) with check (pcp.is_pcp(auth.uid()));
drop policy if exists "pcp write" on pcp.ordens_producao;
create policy "pcp write" on pcp.ordens_producao for all to authenticated using (pcp.is_pcp(auth.uid())) with check (pcp.is_pcp(auth.uid()));
drop policy if exists "pcp write manut" on pcp.manutencoes;
create policy "pcp write manut" on pcp.manutencoes for all to authenticated using (pcp.is_pcp(auth.uid())) with check (pcp.is_pcp(auth.uid()));
drop policy if exists "pcp write prioridades" on pcp.prioridades_maquina;
create policy "pcp write prioridades" on pcp.prioridades_maquina for all to authenticated using (pcp.is_pcp(auth.uid())) with check (pcp.is_pcp(auth.uid()));
drop policy if exists "pcp write lote_setores" on pcp.lote_setores;
create policy "pcp write lote_setores" on pcp.lote_setores for all to authenticated using (pcp.is_pcp(auth.uid())) with check (pcp.is_pcp(auth.uid()));
drop policy if exists "pcp write crono" on pcp.cronoanalises;
create policy "pcp write crono" on pcp.cronoanalises for all to authenticated using (pcp.is_pcp(auth.uid())) with check (pcp.is_pcp(auth.uid()));

-- produção diária: qualquer usuário do app registra a própria; PCP edita/apaga
drop policy if exists "auth insert producao" on pcp.producao_diaria;
create policy "auth insert producao" on pcp.producao_diaria for insert to authenticated
  with check (auth.uid() = registrado_por and pcp.has_access(auth.uid()));
drop policy if exists "pcp update producao" on pcp.producao_diaria;
create policy "pcp update producao" on pcp.producao_diaria for update to authenticated using (pcp.is_pcp(auth.uid()));
drop policy if exists "pcp delete producao" on pcp.producao_diaria;
create policy "pcp delete producao" on pcp.producao_diaria for delete to authenticated using (pcp.is_pcp(auth.uid()));

-- estudos: dono insere; dono ou PCP edita/apaga
drop policy if exists "auth insert estudos" on pcp.estudos;
create policy "auth insert estudos" on pcp.estudos for insert to authenticated
  with check (auth.uid() = created_by and pcp.has_access(auth.uid()));
drop policy if exists "owner or pcp update estudos" on pcp.estudos;
create policy "owner or pcp update estudos" on pcp.estudos for update to authenticated
  using (auth.uid() = created_by or pcp.is_pcp(auth.uid()));
drop policy if exists "owner or pcp delete estudos" on pcp.estudos;
create policy "owner or pcp delete estudos" on pcp.estudos for delete to authenticated
  using (auth.uid() = created_by or pcp.is_pcp(auth.uid()));

-- paradas: qualquer usuário do app abre; PCP edita/apaga
drop policy if exists "auth insert paradas" on pcp.paradas;
create policy "auth insert paradas" on pcp.paradas for insert to authenticated
  with check (auth.uid() = created_by and pcp.has_access(auth.uid()));
drop policy if exists "pcp update paradas" on pcp.paradas;
create policy "pcp update paradas" on pcp.paradas for update to authenticated using (pcp.is_pcp(auth.uid()));
drop policy if exists "pcp delete paradas" on pcp.paradas;
create policy "pcp delete paradas" on pcp.paradas for delete to authenticated using (pcp.is_pcp(auth.uid()));

-- CODI: qualquer usuário do app registra a própria análise; PCP edita/apaga
drop policy if exists "auth insert codi" on pcp.codi_analises;
create policy "auth insert codi" on pcp.codi_analises for insert to authenticated
  with check (auth.uid() = created_by and pcp.has_access(auth.uid()));
drop policy if exists "pcp update codi" on pcp.codi_analises;
create policy "pcp update codi" on pcp.codi_analises for update to authenticated using (pcp.is_pcp(auth.uid()));
drop policy if exists "pcp delete codi" on pcp.codi_analises;
create policy "pcp delete codi" on pcp.codi_analises for delete to authenticated using (pcp.is_pcp(auth.uid()));

-- movimentações do kanban: só PCP insere
drop policy if exists "pcp insert op_mov" on pcp.op_movimentacoes;
create policy "pcp insert op_mov" on pcp.op_movimentacoes for insert to authenticated
  with check (pcp.is_pcp(auth.uid()));

-- ============================================================
-- STORAGE — buckets prefixados (vazios no Lovable; criados p/ uso futuro)
-- ============================================================
insert into storage.buckets (id, name, public) values
  ('pcp-estudos',    'pcp-estudos',    false),
  ('pcp-codi',       'pcp-codi',       false),
  ('pcp-manutencao', 'pcp-manutencao', false)
on conflict (id) do nothing;

-- estudos: leitura geral do app; upload/update/delete só na pasta do próprio uid
drop policy if exists "pcp_read_estudos_files" on storage.objects;
create policy "pcp_read_estudos_files" on storage.objects for select to authenticated
  using (bucket_id = 'pcp-estudos' and pcp.has_access(auth.uid()));
drop policy if exists "pcp_upload_estudos_files" on storage.objects;
create policy "pcp_upload_estudos_files" on storage.objects for insert to authenticated
  with check (bucket_id = 'pcp-estudos' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "pcp_update_estudos_files" on storage.objects;
create policy "pcp_update_estudos_files" on storage.objects for update to authenticated
  using (bucket_id = 'pcp-estudos' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'pcp-estudos' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "pcp_delete_estudos_files" on storage.objects;
create policy "pcp_delete_estudos_files" on storage.objects for delete to authenticated
  using (bucket_id = 'pcp-estudos' and auth.uid()::text = (storage.foldername(name))[1]);

-- codi: leitura geral do app; upload na pasta do uid; update/delete do dono
drop policy if exists "pcp_read_codi_files" on storage.objects;
create policy "pcp_read_codi_files" on storage.objects for select to authenticated
  using (bucket_id = 'pcp-codi' and pcp.has_access(auth.uid()));
drop policy if exists "pcp_upload_codi_files" on storage.objects;
create policy "pcp_upload_codi_files" on storage.objects for insert to authenticated
  with check (bucket_id = 'pcp-codi' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "pcp_update_codi_files" on storage.objects;
create policy "pcp_update_codi_files" on storage.objects for update to authenticated
  using (bucket_id = 'pcp-codi' and owner = auth.uid())
  with check (bucket_id = 'pcp-codi' and owner = auth.uid());
drop policy if exists "pcp_delete_codi_files" on storage.objects;
create policy "pcp_delete_codi_files" on storage.objects for delete to authenticated
  using (bucket_id = 'pcp-codi' and owner = auth.uid());

-- manutencao (do PCP): leitura geral do app; escrita só is_pcp
drop policy if exists "pcp_read_manutencao_files" on storage.objects;
create policy "pcp_read_manutencao_files" on storage.objects for select to authenticated
  using (bucket_id = 'pcp-manutencao' and pcp.has_access(auth.uid()));
drop policy if exists "pcp_upload_manutencao_files" on storage.objects;
create policy "pcp_upload_manutencao_files" on storage.objects for insert to authenticated
  with check (bucket_id = 'pcp-manutencao' and pcp.is_pcp(auth.uid())
              and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "pcp_update_manutencao_files" on storage.objects;
create policy "pcp_update_manutencao_files" on storage.objects for update to authenticated
  using (bucket_id = 'pcp-manutencao' and pcp.is_pcp(auth.uid()))
  with check (bucket_id = 'pcp-manutencao' and pcp.is_pcp(auth.uid()));
drop policy if exists "pcp_delete_manutencao_files" on storage.objects;
create policy "pcp_delete_manutencao_files" on storage.objects for delete to authenticated
  using (bucket_id = 'pcp-manutencao' and pcp.is_pcp(auth.uid()));

-- ============================================================
-- FIM. Próximos passos:
--   1. node gen-import.js (config pcp) → rodar import_pcp.sql
--   2. PGRST_DB_SCHEMAS += ,pcp  +  notify pgrst, 'reload schema'
--   3. my_systems() NOS DOIS ARQUIVOS + tile no hub
-- ============================================================
