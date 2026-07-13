-- ============================================================
-- Tempos por máquina por componente — importado da planilha PCP.
-- Substitui a tabela produto_tempos (coluna única) pela nova
-- produto_tempos_maquina (uma linha por código+máquina+operação).
-- ============================================================

-- remove tabela antiga se ainda não foi aplicada em produção
drop table if exists codi.produto_tempos;

-- ---------- TABELA ----------
create table if not exists codi.produto_tempos_maquina (
  codigo_item    text    not null references codi.produtos(codigo) on delete cascade,
  maquina_nome   text    not null,
  operacao       text    not null default '',
  tempo_min      numeric(10,4) not null,
  fonte          text    default 'planilha_pcp',
  atualizado_em  timestamptz default now(),
  atualizado_por uuid    references auth.users(id),
  primary key (codigo_item, maquina_nome, operacao)
);

-- ---------- RLS ----------
alter table codi.produto_tempos_maquina enable row level security;

drop policy if exists ptm_select on codi.produto_tempos_maquina;
drop policy if exists ptm_write  on codi.produto_tempos_maquina;

create policy ptm_select on codi.produto_tempos_maquina
  for select to authenticated using (codi.is_member());

create policy ptm_write on codi.produto_tempos_maquina
  for all to authenticated
  using (codi.has_role('gestor'))
  with check (codi.has_role('gestor'));

grant select                 on codi.produto_tempos_maquina to authenticated;
grant insert, update, delete on codi.produto_tempos_maquina to authenticated;

-- ---------- RECRIA VIEW v_bom_com_nomes com tempo ----------
-- Adiciona tempo_total_min (soma de todos os processos do componente)
-- e maquinas_desc (lista de máquinas separadas por →).
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
  p_pai.nome               as nome_pai,
  t.tempo_total_min,
  t.maquinas_desc
from codi.bom_estrutura b
left join codi.produtos p_filho on p_filho.codigo = b.codigo_filho
left join codi.produtos p_pai   on p_pai.codigo   = b.codigo_pai
left join (
  select
    codigo_item,
    round(sum(tempo_min)::numeric, 2) as tempo_total_min,
    string_agg(maquina_nome, ' → ' order by operacao) as maquinas_desc
  from codi.produto_tempos_maquina
  group by codigo_item
) t on t.codigo_item = b.codigo_filho;

grant select on codi.v_bom_com_nomes to authenticated;
