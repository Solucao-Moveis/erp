-- ============================================================
-- Migração: converte cronoanálise de minutos para SEGUNDOS
--
-- Histórico: a unidade interna era minutos (importada da planilha
-- via parseTempoRelogio que convertia HH:MM:SS → minutos).
-- A partir de agora todo o sistema usa SEGUNDOS: banco, UI e import.
--
-- Regra de conversão:
--   • Medições com data_medicao < '2026-07-28' → estavam em minutos → × 60
--   • Medições de 2026-07-28 em diante → foram digitadas em segundos no app → ficam como estão
--   • produto_tempos_maquina → todos × 60, depois recomputado da média das medições corrigidas
-- ============================================================

-- 1. Renomear colunas
ALTER TABLE codi.cronoanalise_medicoes  RENAME COLUMN tempo_min TO tempo_seg;
ALTER TABLE codi.produto_tempos_maquina RENAME COLUMN tempo_min TO tempo_seg;

-- 2. Converter medições históricas (antes de hoje) de minutos → segundos
UPDATE codi.cronoanalise_medicoes
SET tempo_seg = ROUND(tempo_seg * 60, 4)
WHERE data_medicao < '2026-07-28';
-- Medições de 2026-07-28 já estavam em segundos — não tocar.

-- 3. Converter produto_tempos_maquina (todos estavam em minutos)
UPDATE codi.produto_tempos_maquina
SET tempo_seg = ROUND(tempo_seg * 60, 4);

-- 4. Recomputar as médias em produto_tempos_maquina a partir das medições
--    corrigidas — garante consistência entre as duas tabelas.
UPDATE codi.produto_tempos_maquina ptm
SET tempo_seg = ROUND(sub.avg_seg, 4)
FROM (
  SELECT codigo_item, operacao, AVG(tempo_seg) AS avg_seg
  FROM codi.cronoanalise_medicoes
  GROUP BY codigo_item, operacao
) sub
WHERE ptm.codigo_item = sub.codigo_item
  AND ptm.operacao    = sub.operacao;

-- 5. Recriar view v_cronoanalise_resumo com novo nome de coluna
CREATE OR REPLACE VIEW codi.v_cronoanalise_resumo
WITH (security_invoker = true) AS
SELECT
  cm.codigo_item,
  p.nome              AS nome_produto,
  p.grupo_descricao,
  cm.aba_origem,
  cm.operacao,
  cm.maquina_nome,
  COUNT(*)                               AS medicoes,
  ROUND(MIN(cm.tempo_seg)::numeric, 4)   AS min_seg,
  ROUND(AVG(cm.tempo_seg)::numeric, 4)   AS media_seg,
  ROUND(MAX(cm.tempo_seg)::numeric, 4)   AS max_seg
FROM codi.cronoanalise_medicoes cm
LEFT JOIN codi.produtos p ON p.codigo = cm.codigo_item
GROUP BY cm.codigo_item, p.nome, p.grupo_descricao, cm.aba_origem, cm.operacao, cm.maquina_nome;

GRANT SELECT ON codi.v_cronoanalise_resumo TO authenticated;

-- 6. Recriar view v_bom_com_nomes com novo nome de coluna
CREATE OR REPLACE VIEW codi.v_bom_com_nomes
WITH (security_invoker = true) AS
SELECT
  b.produto_raiz,
  b.codigo_pai,
  b.codigo_filho,
  b.nivel,
  b.quantidade,
  b.contador,
  b.fantasma,
  p_filho.nome             AS nome_filho,
  p_filho.unidade_medida   AS unidade_filho,
  p_filho.grupo_descricao  AS grupo_filho,
  p_filho.tipo_material    AS tipo_material_filho,
  p_pai.nome               AS nome_pai,
  t.tempo_total_seg,
  t.maquinas_desc
FROM codi.bom_estrutura b
LEFT JOIN codi.produtos p_filho ON p_filho.codigo = b.codigo_filho
LEFT JOIN codi.produtos p_pai   ON p_pai.codigo   = b.codigo_pai
LEFT JOIN (
  SELECT
    codigo_item,
    ROUND(SUM(tempo_seg)::numeric, 2)             AS tempo_total_seg,
    STRING_AGG(maquina_nome, ' → ' ORDER BY operacao) AS maquinas_desc
  FROM codi.produto_tempos_maquina
  GROUP BY codigo_item
) t ON t.codigo_item = b.codigo_filho;

GRANT SELECT ON codi.v_bom_com_nomes TO authenticated;
