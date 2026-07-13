-- ============================================================
-- Catálogo de produtos + BOM (Estrutura de Produto)
-- Fonte: CODI API Industrial (POST http://…/api_industrial/Core/)
-- Coletor: codi-coletor/index.js → syncProdutos() + syncBomProdutos()
-- Idempotente — pode reexecutar.
-- ============================================================

-- ---------- PRODUTOS ----------
create table if not exists codi.produtos (
  codigo             text primary key,
  nome               text,
  grupo_codigo       integer,
  grupo_descricao    text,
  subgrupo_codigo    integer,
  subgrupo_descricao text,
  unidade_medida     text,
  tipo_material      text,
  fantasma           text,
  status             text,          -- 'A' = ativo
  atualizado_em      timestamptz default now()
);

create index if not exists idx_codi_produtos_grupo   on codi.produtos (grupo_codigo);
create index if not exists idx_codi_produtos_status  on codi.produtos (status);

-- ---------- BOM (ESTRUTURA DE PRODUTO) ----------
-- produto_raiz = código do produto pai de nível zero (o que foi consultado)
-- codigo_pai   = pai direto deste nó na árvore (pode ser diferente do produto_raiz)
-- codigo_filho = filho neste relacionamento
-- nivel        = profundidade (1 = filho direto do produto_raiz)
-- contador     = sequencial dentro do mesmo pai (determina ordem)
create table if not exists codi.bom_estrutura (
  produto_raiz   text    not null,
  codigo_pai     text    not null,
  codigo_filho   text    not null,
  nivel          integer,
  quantidade     numeric,
  contador       integer not null,
  fantasma       text,
  atualizado_em  timestamptz default now(),
  primary key (produto_raiz, codigo_pai, codigo_filho, contador)
);

create index if not exists idx_codi_bom_raiz   on codi.bom_estrutura (produto_raiz);
create index if not exists idx_codi_bom_filho  on codi.bom_estrutura (codigo_filho);

-- ---------- VIEW: BOM com nomes ----------
create or replace view codi.v_bom_com_nomes
with (security_invoker = true) as
select
  b.produto_raiz,
  b.codigo_pai,
  b.codigo_filho,
  b.nivel,
  b.quantidade,
  b.contador,
  b.fantasma,
  p_filho.nome             as nome_filho,
  p_filho.unidade_medida   as unidade_filho,
  p_filho.grupo_descricao  as grupo_filho,
  p_filho.tipo_material    as tipo_material_filho,
  p_pai.nome               as nome_pai
from codi.bom_estrutura b
left join codi.produtos p_filho on p_filho.codigo = b.codigo_filho
left join codi.produtos p_pai   on p_pai.codigo   = b.codigo_pai;

-- ---------- SYNC STATE ----------
insert into codi.sync_state (recurso) values ('produtos'), ('bom')
on conflict (recurso) do nothing;

-- ---------- RLS ----------
alter table codi.produtos      enable row level security;
alter table codi.bom_estrutura enable row level security;

drop policy if exists codi_produtos_select on codi.produtos;
drop policy if exists codi_bom_select      on codi.bom_estrutura;

create policy codi_produtos_select on codi.produtos
  for select to authenticated using (codi.is_member());

create policy codi_bom_select on codi.bom_estrutura
  for select to authenticated using (codi.is_member());

grant select on codi.produtos, codi.bom_estrutura to authenticated;
grant select on codi.v_bom_com_nomes to authenticated;
