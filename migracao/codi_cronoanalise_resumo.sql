-- ============================================================
-- View de resumo por código+máquina+operação (mín/média/máx/contagem),
-- pra alimentar a visão "Resumo por máquina" da tela Cronotempo —
-- mesma agregação que a auditoria feita manualmente durante a
-- reimportação de tempos, agora consultável direto pelo app.
-- ============================================================

create or replace view codi.v_cronoanalise_resumo
with (security_invoker = true) as
select
  cm.codigo_item,
  p.nome              as nome_produto,
  p.grupo_descricao,
  cm.aba_origem,
  cm.operacao,
  cm.maquina_nome,
  count(*)                              as medicoes,
  round(min(cm.tempo_min)::numeric, 4)  as min_min,
  round(avg(cm.tempo_min)::numeric, 4)  as media_min,
  round(max(cm.tempo_min)::numeric, 4)  as max_min
from codi.cronoanalise_medicoes cm
left join codi.produtos p on p.codigo = cm.codigo_item
group by cm.codigo_item, p.nome, p.grupo_descricao, cm.aba_origem, cm.operacao, cm.maquina_nome;

grant select on codi.v_cronoanalise_resumo to authenticated;
