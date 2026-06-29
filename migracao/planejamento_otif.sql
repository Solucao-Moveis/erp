-- ============================================================================
-- Planejamento de Carga — OTIF (On Time In Full) de EMBARQUE
--   Acrescenta a view planejamento.vw_otif aos indicadores (aba Lead time).
--   Roda DEPOIS de planejamento_schema.sql (depende de vw_fatia_full).
--
--   Regras (acordadas com o usuário):
--     - "On Time" = a ÚLTIMA saída real do pedido <= previsão de entrega.
--       (medimos a SAÍDA da fábrica, não a entrega no cliente — OTIF de embarque.)
--     - "In Full" = quantidade que saiu >= quantidade do pedido.
--     - "OTIF"    = On Time E In Full.
--   Versão FIEL: o denominador são os pedidos com PREVISÃO no período. Pedido que
--   estourou a previsão e não saiu (ou saiu incompleto/atrasado) conta como falha.
--   Pedido SEM previsão fica fora do cálculo (o front mostra a contagem à parte).
-- ============================================================================

create or replace view planejamento.vw_otif
with (security_invoker = true) as
with ped as (
  select
    p.id                          as pedido_id,
    p.numero                      as pedido_numero,
    p.previsao_entrega,
    p.cliente_codigo,
    p.cliente_nome,
    p.cidade_entrega,
    p.uf_entrega,
    coalesce(sum(i.quantidade_total), 0) as qtd_pedido
  from planejamento.pedido p
  join planejamento.pedido_item i on i.pedido_id = p.id
  group by p.id
),
saiu as (
  select
    pedido_id,
    sum(quantidade) as qtd_saiu,
    max(saida_real) as ultima_saida
  from planejamento.vw_fatia_full
  where saiu
  group by pedido_id
)
select
  ped.pedido_id,
  ped.pedido_numero,
  ped.previsao_entrega,
  ped.cliente_codigo,
  ped.cliente_nome,
  ped.cidade_entrega,
  ped.uf_entrega,
  ped.qtd_pedido,
  coalesce(s.qtd_saiu, 0) as qtd_saiu,
  s.ultima_saida,
  (coalesce(s.qtd_saiu, 0) >= ped.qtd_pedido) as in_full,
  (s.ultima_saida is not null and s.ultima_saida <= ped.previsao_entrega) as on_time,
  (coalesce(s.qtd_saiu, 0) >= ped.qtd_pedido
     and s.ultima_saida is not null
     and s.ultima_saida <= ped.previsao_entrega) as otif
from ped
left join saiu s on s.pedido_id = ped.pedido_id
where ped.previsao_entrega is not null;

-- GRANTS explícitos (views novas não herdam o grant "all tables" já rodado)
grant select on planejamento.vw_otif to authenticated, anon, service_role;
