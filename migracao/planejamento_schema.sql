-- ============================================================================
-- Módulo PLANEJAMENTO — schema `planejamento` (Fase 1)
-- Digitaliza a planilha "Planejamento de Carga" do PCP.
-- Unidade = CARGA (1 caminhão). Pedido (PDF) -> Itens -> Fatias -> Cargas -> Lotes.
--
-- DEPLOY (passos manuais, na ordem):
--   1) Rodar este arquivo no SQL Editor do Supabase SMERP.
--   2) Adicionar a chave 'planejamento' na função public.my_systems()
--      -> EM OS 2 ARQUIVOS: migracao/my_systems.sql E migracao/utilitarios-my-systems.sql
--         (rodar o errado/incompleto derruba apps — ver nota my-systems-dois-arquivos).
--   3) EasyPanel: PGRST_DB_SCHEMAS += ',planejamento'  e  notify pgrst, 'reload schema';
--   4) Liberar acesso pela tela "Usuários" do Hub (insere profile + user_roles).
-- ============================================================================

create schema if not exists planejamento;
grant usage on schema planejamento to anon, authenticated, service_role;
alter default privileges in schema planejamento grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema planejamento grant all on functions  to anon, authenticated, service_role;
alter default privileges in schema planejamento grant all on sequences  to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- ENUMs
-- ----------------------------------------------------------------------------
do $$ begin
  create type planejamento.app_role      as enum ('admin','pcp','consulta');
exception when duplicate_object then null; end $$;
do $$ begin
  create type planejamento.pedido_status as enum ('a_planejar','parcial','planejado');
exception when duplicate_object then null; end $$;
do $$ begin
  create type planejamento.carga_status  as enum ('planejada','saiu');
exception when duplicate_object then null; end $$;
do $$ begin
  create type planejamento.entidade_tipo as enum ('pedido','item','carga','lote','fatia');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- ACESSO: profiles + user_roles  (acesso liberado pela tela Usuários do Hub)
-- ----------------------------------------------------------------------------
create table if not exists planejamento.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now()
);

create table if not exists planejamento.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       planejamento.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- ----------------------------------------------------------------------------
-- FUNÇÕES (helpers de acesso + auditoria)
-- ----------------------------------------------------------------------------
-- Tem acesso ao módulo? (espelha sobras.has_access — NUNCA usar using(true) p/ dados)
create or replace function planejamento.is_member(_user_id uuid)
returns boolean language sql stable security definer set search_path = planejamento, public
as $$ select exists (select 1 from planejamento.profiles where id = _user_id) $$;

-- Tem um papel específico?
create or replace function planejamento.has_role(_user_id uuid, _role planejamento.app_role)
returns boolean language sql stable security definer set search_path = planejamento, public
as $$ select exists (select 1 from planejamento.user_roles where user_id = _user_id and role = _role) $$;

-- Pode editar? (PCP cria/edita; consulta só lê)
create or replace function planejamento.is_editor(_user_id uuid)
returns boolean language sql stable security definer set search_path = planejamento, public
as $$ select planejamento.has_role(_user_id,'admin') or planejamento.has_role(_user_id,'pcp') $$;

-- updated_at automático
create or replace function planejamento.set_updated_at()
returns trigger language plpgsql set search_path = planejamento, public
as $$ begin new.updated_at = now(); return new; end $$;

-- ----------------------------------------------------------------------------
-- PARÂMETROS (singleton)
-- ----------------------------------------------------------------------------
create table if not exists planejamento.parametros (
  id                          int primary key default 1,
  capacidade_caminhao_padrao  numeric not null default 82,
  updated_at                  timestamptz not null default now(),
  constraint parametros_singleton check (id = 1)
);
insert into planejamento.parametros (id) values (1) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- PRODUTO — cadastro leve por código (o "motor" da cubagem)
--   cubagem_planejamento_unit = a CONFIÁVEL (semeada do PDF, corrigível 1x, reusada).
-- ----------------------------------------------------------------------------
create table if not exists planejamento.produto (
  codigo                      text primary key,
  descricao_padrao            text,
  cubagem_planejamento_unit   numeric,          -- o que enche o caminhão (NÃO a do PDF)
  tinta_default               text default 'cinza',
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- LOTE — 4 dígitos, criado depois, agrupa pedidos
-- ----------------------------------------------------------------------------
create table if not exists planejamento.lote (
  id         uuid primary key default gen_random_uuid(),
  numero     text not null,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- PEDIDO — cabeçalho do PDF
-- ----------------------------------------------------------------------------
create table if not exists planejamento.pedido (
  id                 uuid primary key default gen_random_uuid(),
  numero             text not null,
  data_entrada       date,                       -- "Data Ped." (início do lead time)
  previsao_entrega   date,
  oc                 text,
  cliente_codigo     text,
  cliente_nome       text,
  municipio_cobranca text,
  uf_cobranca        text,
  cidade_entrega     text,                       -- DESTINO (não a cobrança)
  uf_entrega         text,
  tipo_frete         text,
  arquivo_pdf        text,                        -- referência no storage
  status             planejamento.pedido_status not null default 'a_planejar',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id)
);

-- ----------------------------------------------------------------------------
-- PEDIDO_ITEM — cada produto do pedido
--   produto_codigo é referência SOFT (sem FK) p/ não travar import; cubagem via left join.
-- ----------------------------------------------------------------------------
create table if not exists planejamento.pedido_item (
  id                    uuid primary key default gen_random_uuid(),
  pedido_id             uuid not null references planejamento.pedido(id) on delete cascade,
  produto_codigo        text,
  descricao             text,
  cor                   text,                     -- separada da descrição (sugestão editável)
  quantidade_total      numeric not null default 0,
  unidade               text,
  preco_unitario_c_ipi  numeric,                  -- preço COM IPI (687,65 -> 710)
  cubagem_pdf           numeric,                  -- nominal do PDF (NÃO usar p/ fatiar)
  peso                  numeric,
  valor_total           numeric,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- CARGA — o caminhão
-- ----------------------------------------------------------------------------
create table if not exists planejamento.carga (
  id                  uuid primary key default gen_random_uuid(),
  numero_carregamento text,                       -- manual (010626)
  data_carregar       date,                       -- planejada (sobrescrevível)
  saida_real          date,                       -- carimbada quando sai -> lead time usa esta
  motorista           text,                       -- autocompletar que aprende
  placa               text,
  lote_id             uuid references planejamento.lote(id) on delete set null,
  destino_cidade      text,
  destino_uf          text,
  capacidade          numeric not null default 82,
  status              planejamento.carga_status not null default 'planejada',
  observacao          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id)
);

-- ----------------------------------------------------------------------------
-- FATIA (carga_item) — O CORAÇÃO: pedaço de um item dentro de uma carga
--   permite fatiar 1 item em N cargas e juntar N pedidos numa carga.
-- ----------------------------------------------------------------------------
create table if not exists planejamento.fatia (
  id              uuid primary key default gen_random_uuid(),
  carga_id        uuid not null references planejamento.carga(id) on delete cascade,
  pedido_item_id  uuid not null references planejamento.pedido_item(id) on delete cascade,
  quantidade      numeric not null default 0,
  cubagem_calc    numeric,                        -- qtd * produto.cubagem_planejamento_unit
  valor_calc      numeric,                        -- qtd * preco_unitario_c_ipi
  cubagem_manual  boolean not null default false, -- forçado na mão?
  valor_manual    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ANEXO — arquivo em qualquer ponto (cofre + clipe por CÉLULA)
--   campo = qual coluna/célula (null = linha inteira)
-- ----------------------------------------------------------------------------
create table if not exists planejamento.anexo (
  id            uuid primary key default gen_random_uuid(),
  entidade_tipo planejamento.entidade_tipo not null,
  entidade_id   uuid not null,
  campo         text,                              -- null = a linha toda
  arquivo       text not null,                     -- referência única no storage
  nome          text,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

-- ----------------------------------------------------------------------------
-- ÍNDICES
-- ----------------------------------------------------------------------------
create index if not exists idx_item_pedido     on planejamento.pedido_item(pedido_id);
create index if not exists idx_item_produto     on planejamento.pedido_item(produto_codigo);
create index if not exists idx_fatia_carga      on planejamento.fatia(carga_id);
create index if not exists idx_fatia_item       on planejamento.fatia(pedido_item_id);
create index if not exists idx_carga_lote       on planejamento.carga(lote_id);
create index if not exists idx_carga_carregar   on planejamento.carga(data_carregar);
create index if not exists idx_carga_saida      on planejamento.carga(saida_real);
create index if not exists idx_anexo_alvo       on planejamento.anexo(entidade_tipo, entidade_id);

-- ----------------------------------------------------------------------------
-- TRIGGERS updated_at
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['parametros','produto','lote','pedido','pedido_item','carga','fatia']
  loop
    execute format('drop trigger if exists trg_%1$s_updated on planejamento.%1$s;', t);
    execute format('create trigger trg_%1$s_updated before update on planejamento.%1$s
                    for each row execute function planejamento.set_updated_at();', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table planejamento.profiles     enable row level security;
alter table planejamento.user_roles   enable row level security;
alter table planejamento.parametros   enable row level security;
alter table planejamento.produto      enable row level security;
alter table planejamento.lote         enable row level security;
alter table planejamento.pedido       enable row level security;
alter table planejamento.pedido_item  enable row level security;
alter table planejamento.carga        enable row level security;
alter table planejamento.fatia        enable row level security;
alter table planejamento.anexo        enable row level security;

-- profiles: cada um vê o seu; admin vê todos
drop policy if exists profiles_select on planejamento.profiles;
create policy profiles_select on planejamento.profiles for select to authenticated
  using (id = auth.uid() or planejamento.has_role(auth.uid(),'admin'));
drop policy if exists profiles_admin on planejamento.profiles;
create policy profiles_admin on planejamento.profiles for all to authenticated
  using (planejamento.has_role(auth.uid(),'admin'))
  with check (planejamento.has_role(auth.uid(),'admin'));

-- user_roles: cada um vê o seu; admin gerencia
drop policy if exists roles_select on planejamento.user_roles;
create policy roles_select on planejamento.user_roles for select to authenticated
  using (user_id = auth.uid() or planejamento.has_role(auth.uid(),'admin'));
drop policy if exists roles_admin on planejamento.user_roles;
create policy roles_admin on planejamento.user_roles for all to authenticated
  using (planejamento.has_role(auth.uid(),'admin'))
  with check (planejamento.has_role(auth.uid(),'admin'));

-- DADOS: quem tem acesso LÊ; só editor (PCP/admin) ESCREVE.
do $$
declare t text;
begin
  foreach t in array array['parametros','produto','lote','pedido','pedido_item','carga','fatia','anexo']
  loop
    execute format('drop policy if exists %1$s_select on planejamento.%1$s;', t);
    execute format('create policy %1$s_select on planejamento.%1$s for select to authenticated
                    using (planejamento.is_member(auth.uid()));', t);
    execute format('drop policy if exists %1$s_write on planejamento.%1$s;', t);
    execute format('create policy %1$s_write on planejamento.%1$s for all to authenticated
                    using (planejamento.is_editor(auth.uid()))
                    with check (planejamento.is_editor(auth.uid()));', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- VIEWS dos INDICADORES (security_invoker = respeita o RLS de quem consulta)
-- ----------------------------------------------------------------------------

-- Base denormalizada: cada fatia com tudo que os indicadores precisam
create or replace view planejamento.vw_fatia_full
with (security_invoker = true) as
select
  f.id              as fatia_id,
  f.quantidade,
  coalesce(f.valor_calc,   f.quantidade * i.preco_unitario_c_ipi)              as valor,
  coalesce(f.cubagem_calc, f.quantidade * pr.cubagem_planejamento_unit)        as cubagem,
  c.id              as carga_id,
  c.numero_carregamento,
  c.data_carregar,
  c.saida_real,
  (c.saida_real is not null) as saiu,
  c.motorista,
  c.destino_cidade,
  c.destino_uf,
  c.lote_id,
  p.id              as pedido_id,
  p.numero          as pedido_numero,
  p.data_entrada,
  p.cliente_codigo,
  p.cliente_nome,
  i.produto_codigo,
  i.descricao,
  i.cor
from planejamento.fatia f
join planejamento.carga       c  on c.id = f.carga_id
join planejamento.pedido_item i  on i.id = f.pedido_item_id
join planejamento.pedido      p  on p.id = i.pedido_id
left join planejamento.produto pr on pr.codigo = i.produto_codigo;

-- Falta planejar por pedido (qtd do item - soma das fatias)
create or replace view planejamento.vw_pedido_progresso
with (security_invoker = true) as
select
  p.id as pedido_id, p.numero,
  sum(i.quantidade_total)                              as qtd_pedido,
  coalesce(sum(fat.qtd_planejada),0)                   as qtd_planejada,
  sum(i.quantidade_total) - coalesce(sum(fat.qtd_planejada),0) as falta_planejar
from planejamento.pedido p
join planejamento.pedido_item i on i.pedido_id = p.id
left join (
  select pedido_item_id, sum(quantidade) qtd_planejada
  from planejamento.fatia group by pedido_item_id
) fat on fat.pedido_item_id = i.id
group by p.id, p.numero;

-- LEAD TIME por pedido (usa a SAÍDA REAL; última saída = pedido completo)
create or replace view planejamento.vw_lead_time
with (security_invoker = true) as
select
  pedido_id, pedido_numero, data_entrada,
  max(saida_real)                              as ultima_saida,
  (max(saida_real) - data_entrada)             as lead_time_dias
from planejamento.vw_fatia_full
where saiu
group by pedido_id, pedido_numero, data_entrada;

-- VALOR DE SAÍDA (só o que saiu) — base p/ filtrar por período/destino/cliente/motorista
create or replace view planejamento.vw_valor_saida
with (security_invoker = true) as
select
  date_trunc('month', saida_real)::date as mes,
  saida_real, destino_cidade, destino_uf, cliente_codigo, cliente_nome, motorista,
  sum(valor)   as valor,
  sum(cubagem) as cubagem
from planejamento.vw_fatia_full
where saiu
group by 1,2,3,4,5,6,7;

-- MOTORISTA que mais carrega
create or replace view planejamento.vw_motorista_ranking
with (security_invoker = true) as
select
  motorista,
  count(distinct carga_id) as cargas,
  sum(valor)               as valor_total,
  sum(cubagem)             as cubagem_total
from planejamento.vw_fatia_full
where saiu and motorista is not null
group by motorista;

-- CURVA ABC / produtos mais carregados (por CÓDIGO, não descrição)
create or replace view planejamento.vw_curva_abc
with (security_invoker = true) as
select
  produto_codigo,
  max(descricao)           as descricao,
  sum(quantidade)          as qtd_total,
  sum(valor)               as valor_total
from planejamento.vw_fatia_full
where saiu
group by produto_codigo;

-- ----------------------------------------------------------------------------
-- GRANTS explícitos (garantia)
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema planejamento to authenticated;
grant select on all tables in schema planejamento to anon;
grant all on all tables in schema planejamento to service_role;

-- ----------------------------------------------------------------------------
-- SEED do 1º admin (descomente e troque o e-mail):
-- insert into planejamento.profiles (id, email, full_name)
--   select id, email, raw_user_meta_data->>'full_name' from auth.users where email = 'SEU_EMAIL';
-- insert into planejamento.user_roles (user_id, role)
--   select id, 'admin' from auth.users where email = 'SEU_EMAIL';
-- ============================================================================
