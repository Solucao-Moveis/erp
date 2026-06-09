-- ============================================================
-- SCHEMA: frota   (app novo "Gestor de Frota" — manutenção e abastecimento de veículos)
-- App do zero (sem dados do Lovable). Setor "Frota / Veículos".
-- Acesso por papéis: admin | gestor | motorista | visualizador.
-- Nada bloqueia: tudo é LANÇADO direto; o gestor REVISA depois (pendente/revisado).
-- Solicitação de manutenção existe, mas é informativa (não trava a execução).
-- NÃO confundir com o schema `manutencao` (CMMS industrial) — domínio diferente.
-- Rodar no SQL Editor do Supabase SMERP. Roda do começo ao fim (idempotente no possível).
-- ============================================================

create schema if not exists frota;
grant usage on schema frota to anon, authenticated, service_role;
alter default privileges in schema frota grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema frota grant all on functions to anon, authenticated, service_role;
alter default privileges in schema frota grant all on sequences to anon, authenticated, service_role;

-- ---------- ENUMS (idempotentes) ----------
do $$ begin create type frota.app_role as enum ('admin','gestor','motorista','visualizador'); exception when duplicate_object then null; end $$;
do $$ begin create type frota.tipo_veiculo as enum ('carro','utilitario','onibus','caminhao','moto','outro'); exception when duplicate_object then null; end $$;
do $$ begin create type frota.status_veiculo as enum ('ativo','manutencao','inativo'); exception when duplicate_object then null; end $$;
do $$ begin create type frota.tipo_lancamento as enum ('abastecimento','troca_oleo','alinhamento','balanceamento','lavagem','lubrificacao','manutencao_corretiva','manutencao_preventiva','revisao','pneu','outro'); exception when duplicate_object then null; end $$;
do $$ begin create type frota.categoria_lancamento as enum ('abastecimento','manutencao','servico'); exception when duplicate_object then null; end $$;
do $$ begin create type frota.combustivel as enum ('gasolina','etanol','diesel','arla','gnv'); exception when duplicate_object then null; end $$;
do $$ begin create type frota.status_revisao as enum ('pendente','revisado'); exception when duplicate_object then null; end $$;
do $$ begin create type frota.status_solicitacao as enum ('aberta','em_andamento','concluida','cancelada'); exception when duplicate_object then null; end $$;
do $$ begin create type frota.prioridade as enum ('baixa','media','alta','urgente'); exception when duplicate_object then null; end $$;
do $$ begin create type frota.tipo_foto as enum ('nota','hodometro','servico','outro'); exception when duplicate_object then null; end $$;

-- ---------- TABELAS: identidade/acesso ----------
-- profiles segue o padrão (id, email, full_name) das outras apps (compras/sobras),
-- pra que o admin_create_user/admin_set_user_systems reaproveite o mesmo bloco.
create table if not exists frota.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  telefone text,
  created_at timestamptz not null default now()
);

create table if not exists frota.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role frota.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- ---------- HELPERS (security definer) ----------
create or replace function frota.set_updated_at()
returns trigger language plpgsql set search_path = frota, public
as $$ begin new.updated_at = now(); return new; end; $$;

-- gate de acesso: tem profile no schema frota?
create or replace function frota.is_member(_user_id uuid)
returns boolean language sql stable security definer set search_path = frota, public
as $$ select exists (select 1 from frota.profiles where id = _user_id) $$;

create or replace function frota.has_role(_user_id uuid, _role frota.app_role)
returns boolean language sql stable security definer set search_path = frota, public
as $$ select exists (select 1 from frota.user_roles where user_id = _user_id and role = _role) $$;

-- atalho: admin OU gestor (quem pode cadastrar/editar/revisar)
create or replace function frota.is_manager(_user_id uuid)
returns boolean language sql stable security definer set search_path = frota, public
as $$ select frota.has_role(_user_id,'admin') or frota.has_role(_user_id,'gestor') $$;

-- profile automático no signup, COM trava por sistema (metadado app='frota').
-- No SMERP o acesso é dado pela aba "Usuários" (RPC do master), então essa trava
-- garante que cadastros normais do hub NÃO ganhem acesso ao frota.
create or replace function frota.handle_new_user()
returns trigger language plpgsql security definer set search_path = frota, public
as $$
begin
  if (new.raw_user_meta_data->>'app') is distinct from 'frota' then
    return new;
  end if;
  insert into frota.profiles (id, email, full_name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
    on conflict (id) do nothing;
  insert into frota.user_roles (user_id, role) values (new.id, 'visualizador')
    on conflict (user_id, role) do nothing;
  return new;
end;
$$;

-- ---------- TABELAS: domínio ----------
create table if not exists frota.veiculos (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique,
  modelo text not null,                         -- ex.: MOBI, SAVEIRO, STRADA, ÔNIBUS
  marca text,
  tipo frota.tipo_veiculo not null default 'carro',
  ano int,
  cor text,
  odometro_atual bigint not null default 0,     -- KM atual (atualizado pelo trigger de lançamento)
  status frota.status_veiculo not null default 'ativo',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- motoristas: cadastro próprio, com vínculo OPCIONAL a um login (modo "misto").
create table if not exists frota.motoristas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  cnh text,
  user_id uuid references auth.users(id) on delete set null,  -- null = só nome (não loga)
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_frota_motoristas_user on frota.motoristas(user_id) where user_id is not null;

-- solicitações (informativas; o gestor acompanha, não bloqueiam a execução).
-- criada ANTES de lancamentos por causa da FK lancamentos.solicitacao_id.
create table if not exists frota.solicitacoes (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references frota.veiculos(id) on delete cascade,
  motorista_id uuid references frota.motoristas(id) on delete set null,
  tipo frota.tipo_lancamento not null default 'manutencao_corretiva',
  descricao text not null,                      -- o problema relatado
  prioridade frota.prioridade not null default 'media',
  status frota.status_solicitacao not null default 'aberta',
  aberta_por uuid references auth.users(id) on delete set null,
  data_abertura date not null default current_date,
  observacoes_gestor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- lançamentos: tabela CENTRAL de eventos sobre o veículo.
create table if not exists frota.lancamentos (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references frota.veiculos(id) on delete cascade,
  motorista_id uuid references frota.motoristas(id) on delete set null,
  tipo frota.tipo_lancamento not null,
  categoria frota.categoria_lancamento not null,
  data_evento date not null default current_date,
  km bigint,                                    -- hodômetro no momento do evento
  custo numeric(12,2) not null default 0,
  fornecedor text,                              -- posto / oficina
  descricao text,                               -- detalhe do serviço
  -- específicos de abastecimento:
  litros numeric(10,3),
  preco_litro numeric(10,3),
  combustivel frota.combustivel,
  -- vínculo opcional com a solicitação que originou:
  solicitacao_id uuid references frota.solicitacoes(id) on delete set null,
  -- revisão pelo gestor (nada bloqueia; revisa depois):
  status_revisao frota.status_revisao not null default 'pendente',
  revisado_por uuid references auth.users(id) on delete set null,
  revisado_em timestamptz,
  registrado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- fotos do lançamento: nota / hodômetro / serviço.
create table if not exists frota.lancamento_fotos (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references frota.lancamentos(id) on delete cascade,
  tipo_foto frota.tipo_foto not null default 'outro',
  file_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid not null,
  created_at timestamptz not null default now()
);

-- periodicidade da preventiva (intervalo por km e/ou por dias).
-- veiculo_id null = regra que vale pra TODOS os veículos.
create table if not exists frota.planos_periodicidade (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid references frota.veiculos(id) on delete cascade,
  tipo_manutencao frota.tipo_lancamento not null,
  intervalo_km bigint,
  intervalo_dias int,
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (intervalo_km is not null or intervalo_dias is not null)
);

-- ---------- ÍNDICES ----------
create index if not exists idx_frota_lanc_veiculo   on frota.lancamentos(veiculo_id);
create index if not exists idx_frota_lanc_data      on frota.lancamentos(data_evento desc);
create index if not exists idx_frota_lanc_tipo      on frota.lancamentos(tipo);
create index if not exists idx_frota_lanc_revisao   on frota.lancamentos(status_revisao);
create index if not exists idx_frota_fotos_lanc     on frota.lancamento_fotos(lancamento_id);
create index if not exists idx_frota_solic_veiculo  on frota.solicitacoes(veiculo_id);
create index if not exists idx_frota_solic_status   on frota.solicitacoes(status);
create index if not exists idx_frota_period_veiculo on frota.planos_periodicidade(veiculo_id);

-- ---------- TRIGGER: mantém o KM atual do veículo ----------
create or replace function frota.atualiza_odometro()
returns trigger language plpgsql security definer set search_path = frota, public
as $$
begin
  if new.km is not null then
    update frota.veiculos
      set odometro_atual = new.km, updated_at = now()
      where id = new.veiculo_id and new.km > odometro_atual;
  end if;
  return new;
end;
$$;

-- ---------- TRIGGERS ----------
create trigger frota_on_auth_user_created
  after insert on auth.users
  for each row execute function frota.handle_new_user();

create trigger trg_frota_veiculos_upd before update on frota.veiculos
  for each row execute function frota.set_updated_at();
create trigger trg_frota_solic_upd before update on frota.solicitacoes
  for each row execute function frota.set_updated_at();
create trigger trg_frota_lanc_upd before update on frota.lancamentos
  for each row execute function frota.set_updated_at();
create trigger trg_frota_period_upd before update on frota.planos_periodicidade
  for each row execute function frota.set_updated_at();

create trigger trg_frota_lanc_odometro after insert or update of km on frota.lancamentos
  for each row execute function frota.atualiza_odometro();

-- ---------- VIEWS: consumo e próximas manutenções ----------
-- consumo por abastecimento: km rodados desde o abastecimento anterior, km/L e custo/km.
create or replace view frota.v_consumo as
select
  l.id,
  l.veiculo_id,
  l.data_evento,
  l.km,
  l.litros,
  l.custo,
  (l.km - lag(l.km) over w) as km_rodados,
  case when l.litros > 0 and (l.km - lag(l.km) over w) > 0
       then round((l.km - lag(l.km) over w)::numeric / l.litros, 2) end as km_por_litro,
  case when (l.km - lag(l.km) over w) > 0
       then round(l.custo / (l.km - lag(l.km) over w), 4) end as custo_por_km
from frota.lancamentos l
where l.tipo = 'abastecimento' and l.km is not null
window w as (partition by l.veiculo_id order by l.km asc, l.data_evento asc);

-- próximas preventivas: cruza a periodicidade com o último serviço daquele tipo no veículo.
create or replace view frota.v_proximas_manutencoes as
with ultimo as (
  select distinct on (veiculo_id, tipo) veiculo_id, tipo, km, data_evento
  from frota.lancamentos
  order by veiculo_id, tipo, data_evento desc, km desc nulls last
)
select
  p.id as plano_id,
  v.id as veiculo_id,
  v.placa,
  v.modelo,
  v.odometro_atual,
  p.tipo_manutencao,
  p.intervalo_km,
  p.intervalo_dias,
  u.km as ultimo_km,
  u.data_evento as ultima_data,
  case when p.intervalo_km is not null and u.km is not null then u.km + p.intervalo_km end as km_vencimento,
  case when p.intervalo_dias is not null and u.data_evento is not null
       then (u.data_evento + make_interval(days => p.intervalo_dias))::date end as data_vencimento,
  case when p.intervalo_km is not null and u.km is not null then (u.km + p.intervalo_km) - v.odometro_atual end as km_restante,
  case when p.intervalo_dias is not null and u.data_evento is not null
       then ((u.data_evento + make_interval(days => p.intervalo_dias))::date - current_date) end as dias_restante,
  case
    when u.km is null and u.data_evento is null then 'sem_historico'
    when (p.intervalo_km  is not null and u.km is not null and (u.km + p.intervalo_km) - v.odometro_atual <= 0)
      or (p.intervalo_dias is not null and u.data_evento is not null and (u.data_evento + make_interval(days => p.intervalo_dias))::date - current_date <= 0)
      then 'vencido'
    when (p.intervalo_km  is not null and u.km is not null and (u.km + p.intervalo_km) - v.odometro_atual <= 1000)
      or (p.intervalo_dias is not null and u.data_evento is not null and (u.data_evento + make_interval(days => p.intervalo_dias))::date - current_date <= 15)
      then 'proximo'
    else 'em_dia'
  end as situacao
from frota.planos_periodicidade p
join frota.veiculos v on (p.veiculo_id is null or p.veiculo_id = v.id)
left join ultimo u on u.veiculo_id = v.id and u.tipo = p.tipo_manutencao
where p.ativo and v.status <> 'inativo';

-- ---------- RLS ----------
alter table frota.profiles            enable row level security;
alter table frota.user_roles          enable row level security;
alter table frota.veiculos            enable row level security;
alter table frota.motoristas          enable row level security;
alter table frota.solicitacoes        enable row level security;
alter table frota.lancamentos         enable row level security;
alter table frota.lancamento_fotos    enable row level security;
alter table frota.planos_periodicidade enable row level security;

-- profiles: cada um vê/edita o próprio; gestor/admin enxergam todos.
drop policy if exists frota_profiles_sel on frota.profiles;
create policy frota_profiles_sel on frota.profiles for select to authenticated
  using (auth.uid() = id or frota.is_manager(auth.uid()));
drop policy if exists frota_profiles_upd on frota.profiles;
create policy frota_profiles_upd on frota.profiles for update to authenticated
  using (auth.uid() = id);
drop policy if exists frota_profiles_ins on frota.profiles;
create policy frota_profiles_ins on frota.profiles for insert to authenticated
  with check (auth.uid() = id);

-- user_roles: cada um vê os próprios; gestão é via RPC do master (security definer).
drop policy if exists frota_roles_sel on frota.user_roles;
create policy frota_roles_sel on frota.user_roles for select to authenticated
  using (auth.uid() = user_id or frota.is_manager(auth.uid()));

-- veículos: membros leem; admin/gestor escrevem.
drop policy if exists frota_veiculos_sel on frota.veiculos;
create policy frota_veiculos_sel on frota.veiculos for select to authenticated
  using (frota.is_member(auth.uid()));
drop policy if exists frota_veiculos_wr on frota.veiculos;
create policy frota_veiculos_wr on frota.veiculos for all to authenticated
  using (frota.is_manager(auth.uid())) with check (frota.is_manager(auth.uid()));

-- motoristas: membros leem; admin/gestor escrevem.
drop policy if exists frota_motoristas_sel on frota.motoristas;
create policy frota_motoristas_sel on frota.motoristas for select to authenticated
  using (frota.is_member(auth.uid()));
drop policy if exists frota_motoristas_wr on frota.motoristas;
create policy frota_motoristas_wr on frota.motoristas for all to authenticated
  using (frota.is_manager(auth.uid())) with check (frota.is_manager(auth.uid()));

-- periodicidade: membros leem; admin/gestor configuram.
drop policy if exists frota_period_sel on frota.planos_periodicidade;
create policy frota_period_sel on frota.planos_periodicidade for select to authenticated
  using (frota.is_member(auth.uid()));
drop policy if exists frota_period_wr on frota.planos_periodicidade;
create policy frota_period_wr on frota.planos_periodicidade for all to authenticated
  using (frota.is_manager(auth.uid())) with check (frota.is_manager(auth.uid()));

-- solicitações: membros leem; qualquer membro abre; o autor OU gestor edita; gestor/admin apaga.
drop policy if exists frota_solic_sel on frota.solicitacoes;
create policy frota_solic_sel on frota.solicitacoes for select to authenticated
  using (frota.is_member(auth.uid()));
drop policy if exists frota_solic_ins on frota.solicitacoes;
create policy frota_solic_ins on frota.solicitacoes for insert to authenticated
  with check (frota.is_member(auth.uid()));
drop policy if exists frota_solic_upd on frota.solicitacoes;
create policy frota_solic_upd on frota.solicitacoes for update to authenticated
  using (frota.is_manager(auth.uid()) or aberta_por = auth.uid())
  with check (frota.is_manager(auth.uid()) or aberta_por = auth.uid());
drop policy if exists frota_solic_del on frota.solicitacoes;
create policy frota_solic_del on frota.solicitacoes for delete to authenticated
  using (frota.is_manager(auth.uid()));

-- lançamentos: membros leem; qualquer membro lança; autor OU gestor edita; gestor/admin apaga.
drop policy if exists frota_lanc_sel on frota.lancamentos;
create policy frota_lanc_sel on frota.lancamentos for select to authenticated
  using (frota.is_member(auth.uid()));
drop policy if exists frota_lanc_ins on frota.lancamentos;
create policy frota_lanc_ins on frota.lancamentos for insert to authenticated
  with check (frota.is_member(auth.uid()));
drop policy if exists frota_lanc_upd on frota.lancamentos;
create policy frota_lanc_upd on frota.lancamentos for update to authenticated
  using (frota.is_manager(auth.uid()) or registrado_por = auth.uid())
  with check (frota.is_manager(auth.uid()) or registrado_por = auth.uid());
drop policy if exists frota_lanc_del on frota.lancamentos;
create policy frota_lanc_del on frota.lancamentos for delete to authenticated
  using (frota.is_manager(auth.uid()));

-- fotos: membros leem; quem envia é o próprio usuário; dono ou gestor apaga.
drop policy if exists frota_fotos_sel on frota.lancamento_fotos;
create policy frota_fotos_sel on frota.lancamento_fotos for select to authenticated
  using (frota.is_member(auth.uid()));
drop policy if exists frota_fotos_ins on frota.lancamento_fotos;
create policy frota_fotos_ins on frota.lancamento_fotos for insert to authenticated
  with check (frota.is_member(auth.uid()) and auth.uid() = uploaded_by);
drop policy if exists frota_fotos_del on frota.lancamento_fotos;
create policy frota_fotos_del on frota.lancamento_fotos for delete to authenticated
  using (auth.uid() = uploaded_by or frota.is_manager(auth.uid()));

-- ---------- GRANTS explícitos (garantia p/ o PostgREST) ----------
grant select, insert, update, delete on all tables in schema frota to authenticated;
grant all on all tables in schema frota to service_role;
grant select on frota.v_consumo, frota.v_proximas_manutencoes to authenticated, service_role;

revoke execute on function frota.is_member(uuid)               from public, anon;
revoke execute on function frota.has_role(uuid, frota.app_role) from public, anon;
revoke execute on function frota.is_manager(uuid)              from public, anon;
revoke execute on function frota.handle_new_user()             from public, anon, authenticated;
revoke execute on function frota.atualiza_odometro()           from public, anon, authenticated;

-- ---------- STORAGE: bucket privado de fotos (nome global → policies prefixadas) ----------
insert into storage.buckets (id, name, public)
values ('frota-fotos', 'frota-fotos', false)
on conflict (id) do nothing;

-- estrutura do path: <uid>/<lancamento_id>/<timestamp>-<arquivo>
drop policy if exists "frota_fotos_storage_sel" on storage.objects;
create policy "frota_fotos_storage_sel" on storage.objects for select to authenticated
  using (bucket_id = 'frota-fotos' and frota.is_member(auth.uid()));
drop policy if exists "frota_fotos_storage_ins" on storage.objects;
create policy "frota_fotos_storage_ins" on storage.objects for insert to authenticated
  with check (bucket_id = 'frota-fotos' and frota.is_member(auth.uid()) and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "frota_fotos_storage_del" on storage.objects;
create policy "frota_fotos_storage_del" on storage.objects for delete to authenticated
  using (bucket_id = 'frota-fotos' and (auth.uid()::text = (storage.foldername(name))[1] or frota.is_manager(auth.uid())));

-- ---------- recarrega o schema cache do PostgREST ----------
notify pgrst, 'reload schema';

-- Teste rápido (logado como um usuário com acesso ao frota):
--   select frota.is_member(auth.uid());
--   select * from frota.veiculos;            -- após o seed, mostra os veículos
--   select * from frota.v_proximas_manutencoes;
