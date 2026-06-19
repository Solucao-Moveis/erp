-- ============================================================
-- SCHEMA: engenharia   (modulo "Engenharia" -> tela "Assistencia")
-- ------------------------------------------------------------
-- Digitaliza o "RELATORIO DE NAO CONFORMIDADE (RNC)" da Solucao Moveis:
-- um formulario por nao-conformidade, com numero sequencial automatico
-- (RNC-00001/2026), listagem com filtros e dashboard (o que MAIS saiu).
--
-- O modulo mora DENTRO do Hub (site estatico 'erp'), como aba interna —
-- nao e' um app satelite. O acesso e' controlado por engenharia.profiles
-- (igual aos outros apps): quem tem perfil ve a aba; o papel 'criador'
-- pode criar/editar; 'leitor' so' consulta e baixa o PDF.
--
-- Idempotente: roda do comeco ao fim varias vezes no SQL Editor do Supabase.
--
-- ATENCAO (PostgREST): o schema 'engenharia' precisa estar exposto na
--   variavel PGRST_DB_SCHEMAS (db-schemas) do PostgREST/Supabase no EasyPanel,
--   junto com os demais (public, compras, bip, caderno, ...). Isso NAO se roda
--   em SQL — e' config do servico. Sem isso o Hub nao enxerga as tabelas via REST.
-- ============================================================

create schema if not exists engenharia;
grant usage on schema engenharia to anon, authenticated, service_role;
alter default privileges in schema engenharia grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema engenharia grant all on functions to anon, authenticated, service_role;
alter default privileges in schema engenharia grant all on sequences to anon, authenticated, service_role;

-- ============================================================
-- ENUMS (idempotentes via duplicate_object)
-- ============================================================
do $$ begin
  create type engenharia.app_role as enum ('criador', 'leitor');
exception when duplicate_object then null; end $$;

-- ============================================================
-- TABELAS
-- ============================================================

-- Perfil do usuario no modulo (id = auth.users.id). Quem tem perfil ve a aba.
create table if not exists engenharia.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

-- Papeis (criador/leitor).
create table if not exists engenharia.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role engenharia.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- Contador de numeros por ano (RNC-00001/2026, RNC-00002/2026, ...).
create table if not exists engenharia.assistencia_sequences (
  ano         int primary key,
  last_number int not null default 0
);

-- RELATORIO DE NAO CONFORMIDADE / Assistencia (uma linha por RNC).
-- Os campos de "lista de marcar" (tipo/causa/acao) viram ARRAYS de chaves
-- canonicas (text[]) -> permitem filtrar e ranquear via unnest no dashboard.
-- As chaves (ex.: 'fabricacao') casam com os rotulos definidos no front (engenharia.js).
create table if not exists engenharia.assistencias (
  id uuid primary key default gen_random_uuid(),
  numero text unique,                              -- gerado: RNC-00001/2026
  data   date not null default current_date,

  -- 1) Emissor (quem identificou) — nome + matricula
  emissor text,

  -- 2) Origem: 'interno' | 'externo'
  origem text check (origem in ('interno','externo')),

  -- 3) Onde?  subconjunto de {produto,cliente,fornecedor,outros}
  onde         text[] not null default '{}',
  onde_outros  text,

  -- 4 e 5) Cliente / Fornecedor
  cliente    text,
  fornecedor text,

  -- 6) Produto/processo nao conforme (produto pai e/ou filho) + quantidade
  produto    text,
  quantidade text,

  -- 7) Tipo de Nao Conformidade (chaves) + "outros" + descricao
  tipo_nc        text[] not null default '{}',
  tipo_nc_outros text,
  tipo_desc      text,

  -- 8) Causa da Nao Conformidade (chaves) + "outros" + descricao
  causa        text[] not null default '{}',
  causa_outros text,
  causa_desc   text,

  -- 9) Acao Imediata (chaves) + "outros"
  acao_imediata        text[] not null default '{}',
  acao_imediata_outros text,

  -- 10) Funcionario responsavel pelo tratamento (nome + matricula) + data
  funcionario_resp text,
  funcionario_data date,

  -- 11) Numero da OS referente a acao (pode ficar vazio)
  numero_os text,

  -- Acao Corretiva (chaves) + "outros" + "descrever"
  acao_corretiva        text[] not null default '{}',
  acao_corretiva_outros text,
  acao_corretiva_desc   text,

  -- Observacao da assistencia (campos pedidos no rodape do RNC)
  rnc_ref        text,   -- N° RNC (referencia manual, se houver)
  nf_numero      text,   -- Numero da NF
  pedido_numero  text,   -- Numero do pedido
  local_entrega  text,

  -- Responsavel pela analise critica + previsao/realizado
  resp_analise text,
  previsao     date,
  realizado    date,

  -- Anexos (fotos/evidencias) -> [{ "path": "...", "name": "..." }]
  anexos jsonb not null default '[]',

  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_eng_assist_data   on engenharia.assistencias (data desc);
create index if not exists idx_eng_assist_origem on engenharia.assistencias (origem);
create index if not exists idx_eng_assist_tipo   on engenharia.assistencias using gin (tipo_nc);
create index if not exists idx_eng_assist_causa  on engenharia.assistencias using gin (causa);
create index if not exists idx_eng_assist_acao   on engenharia.assistencias using gin (acao_imediata);

-- ============================================================
-- HELPERS de acesso
-- ============================================================

-- Esta' autenticado e tem perfil no modulo?
create or replace function engenharia.is_member()
returns boolean
language sql stable security definer set search_path = engenharia, public
as $$
  select exists (select 1 from engenharia.profiles where id = auth.uid());
$$;

-- Tem o papel informado? (criador/leitor)
create or replace function engenharia.has_role(_role engenharia.app_role)
returns boolean
language sql stable security definer set search_path = engenharia, public
as $$
  select exists (
    select 1 from engenharia.user_roles
     where user_id = auth.uid() and role = _role
  );
$$;

-- Pode criar/editar? (papel 'criador')
create or replace function engenharia.pode_criar()
returns boolean
language sql stable security definer set search_path = engenharia, public
as $$
  select engenharia.has_role('criador');
$$;

grant execute on function engenharia.is_member()  to authenticated;
grant execute on function engenharia.has_role(engenharia.app_role) to authenticated;
grant execute on function engenharia.pode_criar() to authenticated;

-- ============================================================
-- NUMERACAO automatica: RNC-00001/2026 (reinicia a cada ano)
-- ============================================================
create or replace function engenharia.gerar_numero()
returns trigger
language plpgsql security definer set search_path = engenharia, public
as $$
declare
  yr  int := extract(year from coalesce(new.data, current_date));
  nxt int;
begin
  if new.numero is not null and new.numero <> '' then
    return new; -- ja veio com numero (ex.: import); respeita.
  end if;
  insert into engenharia.assistencia_sequences (ano, last_number)
    values (yr, 1)
  on conflict (ano)
    do update set last_number = engenharia.assistencia_sequences.last_number + 1
  returning last_number into nxt;
  new.numero := 'RNC-' || lpad(nxt::text, 5, '0') || '/' || yr;
  return new;
end;
$$;

drop trigger if exists trg_eng_numero on engenharia.assistencias;
create trigger trg_eng_numero
  before insert on engenharia.assistencias
  for each row execute function engenharia.gerar_numero();

-- updated_at automatico
create or replace function engenharia.touch_updated()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_eng_touch on engenharia.assistencias;
create trigger trg_eng_touch
  before update on engenharia.assistencias
  for each row execute function engenharia.touch_updated();

-- ============================================================
-- RLS  (sem using(true): respeita o acesso do modulo)
-- ============================================================
alter table engenharia.profiles      enable row level security;
alter table engenharia.user_roles    enable row level security;
alter table engenharia.assistencias  enable row level security;

-- profiles: cada um ve/gerencia o proprio registro (criado por SQL/admin).
drop policy if exists eng_profiles_self on engenharia.profiles;
create policy eng_profiles_self on engenharia.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists eng_roles_self on engenharia.user_roles;
create policy eng_roles_self on engenharia.user_roles
  for select to authenticated using (user_id = auth.uid());

-- assistencias: registro COMPARTILHADO entre quem tem acesso ao modulo.
--   - ver: qualquer membro (criador ou leitor)
--   - criar/editar/excluir: somente 'criador'
drop policy if exists eng_assist_select on engenharia.assistencias;
create policy eng_assist_select on engenharia.assistencias
  for select to authenticated
  using (engenharia.is_member());

drop policy if exists eng_assist_insert on engenharia.assistencias;
create policy eng_assist_insert on engenharia.assistencias
  for insert to authenticated
  with check (engenharia.pode_criar());

drop policy if exists eng_assist_update on engenharia.assistencias;
create policy eng_assist_update on engenharia.assistencias
  for update to authenticated
  using (engenharia.pode_criar())
  with check (engenharia.pode_criar());

drop policy if exists eng_assist_delete on engenharia.assistencias;
create policy eng_assist_delete on engenharia.assistencias
  for delete to authenticated
  using (engenharia.pode_criar());

grant select, insert, update, delete on engenharia.assistencias to authenticated;
grant select on engenharia.profiles, engenharia.user_roles to authenticated;

-- ============================================================
-- DASHBOARD: rankings "o que MAIS saiu" + totais, no periodo.
--   Recebe periodo opcional [_de, _ate]; devolve um jsonb pronto pro front.
-- ============================================================
create or replace function engenharia.dashboard(_de date default null, _ate date default null)
returns jsonb
language sql stable security definer set search_path = engenharia, public
as $$
  with base as (
    select * from engenharia.assistencias a
     where engenharia.is_member()
       and (_de  is null or a.data >= _de)
       and (_ate is null or a.data <= _ate)
  ),
  rank_tipo as (
    select t as chave, count(*)::int as n
      from base, unnest(base.tipo_nc) as t group by t order by n desc, chave
  ),
  rank_causa as (
    select c as chave, count(*)::int as n
      from base, unnest(base.causa) as c group by c order by n desc, chave
  ),
  rank_acao as (
    select ai as chave, count(*)::int as n
      from base, unnest(base.acao_imediata) as ai group by ai order by n desc, chave
  ),
  rank_corr as (
    select ac as chave, count(*)::int as n
      from base, unnest(base.acao_corretiva) as ac group by ac order by n desc, chave
  ),
  por_mes as (
    select to_char(date_trunc('month', data), 'YYYY-MM') as mes, count(*)::int as n
      from base group by 1 order by 1
  ),
  por_cliente as (
    select coalesce(nullif(btrim(cliente), ''), '(sem cliente)') as nome, count(*)::int as n
      from base group by 1 order by n desc, nome limit 8
  )
  select jsonb_build_object(
    'total',           (select count(*)::int from base),
    'interno',         (select count(*)::int from base where origem = 'interno'),
    'externo',         (select count(*)::int from base where origem = 'externo'),
    'concluidas',      (select count(*)::int from base where realizado is not null),
    'abertas',         (select count(*)::int from base where realizado is null),
    'tipo_nc',         coalesce((select jsonb_agg(jsonb_build_object('chave',chave,'n',n)) from rank_tipo), '[]'::jsonb),
    'causa',           coalesce((select jsonb_agg(jsonb_build_object('chave',chave,'n',n)) from rank_causa), '[]'::jsonb),
    'acao_imediata',   coalesce((select jsonb_agg(jsonb_build_object('chave',chave,'n',n)) from rank_acao), '[]'::jsonb),
    'acao_corretiva',  coalesce((select jsonb_agg(jsonb_build_object('chave',chave,'n',n)) from rank_corr), '[]'::jsonb),
    'por_mes',         coalesce((select jsonb_agg(jsonb_build_object('mes',mes,'n',n)) from por_mes), '[]'::jsonb),
    'por_cliente',     coalesce((select jsonb_agg(jsonb_build_object('nome',nome,'n',n)) from por_cliente), '[]'::jsonb)
  );
$$;
revoke all on function engenharia.dashboard(date, date) from public, anon;
grant execute on function engenharia.dashboard(date, date) to authenticated;

-- ============================================================
-- STORAGE: bucket privado p/ anexos (fotos/evidencias)
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('engenharia-anexos', 'engenharia-anexos', false)
on conflict (id) do nothing;

-- so' membros do modulo leem/gravam neste bucket.
drop policy if exists eng_anexos_read   on storage.objects;
create policy eng_anexos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'engenharia-anexos' and engenharia.is_member());

drop policy if exists eng_anexos_write  on storage.objects;
create policy eng_anexos_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'engenharia-anexos' and engenharia.pode_criar());

drop policy if exists eng_anexos_delete on storage.objects;
create policy eng_anexos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'engenharia-anexos' and engenharia.pode_criar());

-- ============================================================
-- TESTE
-- ============================================================
--   select engenharia.is_member(), engenharia.pode_criar();
--   insert into engenharia.assistencias (origem, onde, tipo_nc, causa, acao_imediata, cliente)
--     values ('externo', '{cliente}', '{fabricacao}', '{maquina}', '{retrabalho}', 'ACME');
--   select numero, data, origem from engenharia.assistencias order by created_at desc;
--   select engenharia.dashboard();
