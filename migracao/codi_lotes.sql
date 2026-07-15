-- ============================================================
-- Lotes de producao + OFs por lote (sincronizado do CODI API).
-- ============================================================

create table if not exists codi.lotes (
  numero        text primary key,
  data_previsao date,
  total_ofs     int default 0,
  atualizado_em timestamptz default now()
);
alter table codi.lotes enable row level security;
create policy lotes_select on codi.lotes
  for select to authenticated using (codi.is_member());
grant select on codi.lotes to authenticated;

create table if not exists codi.of_por_lote (
  ordem                int  primary key,
  lote                 text not null references codi.lotes(numero) on delete cascade,
  produto              text,
  nome_produto         text,
  quantidade           numeric(14,4),
  quantidade_produzida numeric(14,4),
  status               text,
  data_previsao        date,
  data_alteracao       date,
  deposito             int,
  atualizado_em        timestamptz default now()
);
alter table codi.of_por_lote enable row level security;
create policy of_lote_select on codi.of_por_lote
  for select to authenticated using (codi.is_member());
grant select on codi.of_por_lote to authenticated;

-- ============================================================
-- View: v_lotes_resumo
-- Agrega status, progresso e setores por lote em uma unica query
-- (elimina o N+1 de queries do frontend).
-- ============================================================
create or replace view codi.v_lotes_resumo with (security_invoker = true) as
with ofs_setor as (
  select
    o.lote, o.ordem, o.status,
    coalesce(o.quantidade, 0)           as quantidade,
    coalesce(o.quantidade_produzida, 0) as quantidade_produzida,
    case
      when o.produto like '216%'                                              then 'Marcenaria'
      when upper(coalesce(o.nome_produto,'')) like 'DOBRA%'                   then 'Dobra'
      when upper(coalesce(o.nome_produto,'')) like 'CORTE%'
        or upper(coalesce(o.nome_produto,'')) like '%LASER%'
        or upper(coalesce(o.nome_produto,'')) like 'FURO%'                    then 'Corte'
      when upper(coalesce(o.nome_produto,'')) like 'SOLDA%'
        or upper(coalesce(o.nome_produto,'')) like 'FECH%'                    then 'Solda'
      when upper(coalesce(o.nome_produto,'')) like 'TRAT%'                    then 'Tratamento'
      when upper(coalesce(o.nome_produto,'')) like 'PINT%'                    then 'Pintura'
      when upper(coalesce(o.nome_produto,'')) like 'INSP%'                    then 'Inspeção'
      when upper(coalesce(o.nome_produto,'')) like 'MONT%'                    then 'Montagem'
      when upper(coalesce(o.nome_produto,'')) like 'EMBAL%'                   then 'Embalagem'
      else 'Outros'
    end as setor
  from codi.of_por_lote o
),
lote_stats as (
  select
    lote,
    count(*)::int                                              as total_ofs,
    sum(case when status='FA' then 1 else 0 end)::int          as ofs_andamento,
    sum(case when status='EC' then 1 else 0 end)::int          as ofs_encerradas,
    sum(case when status='ES' then 1 else 0 end)::int          as ofs_planejadas,
    sum(quantidade)::numeric                                   as qtd_total,
    sum(quantidade_produzida)::numeric                         as qtd_pronta
  from ofs_setor group by lote
),
lote_setores as (
  select lote,
    jsonb_agg(
      jsonb_build_object(
        'setor', setor, 'ofs', cnt, 'fa', fa,
        'qtd', qtd, 'pronto', pronto,
        'pct', round(case when qtd > 0 then pronto * 100.0 / qtd else 0 end, 0)
      ) order by setor
    ) as setores
  from (
    select lote, setor,
      count(*)::int as cnt,
      sum(case when status='FA' then 1 else 0 end)::int as fa,
      sum(quantidade)::numeric as qtd,
      sum(quantidade_produzida)::numeric as pronto
    from ofs_setor group by lote, setor
  ) s group by lote
)
select
  l.numero, l.data_previsao, l.atualizado_em,
  coalesce(s.total_ofs,      0)::int      as total_ofs,
  coalesce(s.ofs_andamento,  0)::int      as ofs_andamento,
  coalesce(s.ofs_encerradas, 0)::int      as ofs_encerradas,
  coalesce(s.ofs_planejadas, 0)::int      as ofs_planejadas,
  coalesce(s.qtd_total,      0)::numeric  as qtd_total,
  coalesce(s.qtd_pronta,     0)::numeric  as qtd_pronta,
  round(case when coalesce(s.qtd_total, 0) > 0
    then s.qtd_pronta * 100.0 / s.qtd_total else 0 end, 1)::numeric as pct_completo,
  case
    when coalesce(s.ofs_andamento,  0) > 0 then 'EM_ANDAMENTO'
    when coalesce(s.ofs_encerradas, 0) = coalesce(s.total_ofs, 0)
     and coalesce(s.total_ofs, 0) > 0      then 'CONCLUIDO'
    else 'PLANEJADO'
  end as status_lote,
  coalesce(ls.setores, '[]'::jsonb)       as setores
from codi.lotes l
left join lote_stats   s  on s.lote  = l.numero
left join lote_setores ls on ls.lote = l.numero;

grant select on codi.v_lotes_resumo to authenticated;
