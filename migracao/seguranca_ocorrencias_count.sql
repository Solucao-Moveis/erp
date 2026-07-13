-- Mudança na regra de ocorrências excepcionais:
-- Antes: ocorrência ZERA a nota (boolean)
-- Agora: cada ocorrência desconta 40 pts (máx 3 = 120 pts), nota mínima 0
-- Idempotente — pode rodar múltiplas vezes.

-- 1. Adiciona coluna de contagem
ALTER TABLE seguranca.avaliacoes
  ADD COLUMN IF NOT EXISTS ocorrencias_count smallint NOT NULL DEFAULT 0;

-- 2. Migra dados existentes (onde ocorrencia=true → count=1)
UPDATE seguranca.avaliacoes
  SET ocorrencias_count = 1
  WHERE ocorrencia = true AND ocorrencias_count = 0;

-- 3. Recria a coluna `nota` com nova fórmula
--    (gerada não pode ser alterada in-place — precisa dropar e recriar)
ALTER TABLE seguranca.avaliacoes DROP COLUMN IF EXISTS nota;

ALTER TABLE seguranca.avaliacoes ADD COLUMN nota integer GENERATED ALWAYS AS (
  GREATEST(0,
    (CASE WHEN c_dds   THEN 10 ELSE 0 END) +
    (CASE WHEN c_reun  THEN 10 ELSE 0 END) +
    (CASE WHEN c_cip   THEN  5 ELSE 0 END) +
    (CASE WHEN c_pa    THEN 15 ELSE 0 END) +
    (CASE WHEN c_mel   THEN 10 ELSE 0 END) +
    (CASE WHEN c_epi   THEN 10 ELSE 0 END) +
    (CASE WHEN c_uso   THEN 10 ELSE 0 END) +
    (CASE WHEN c_org   THEN  5 ELSE 0 END) +
    (CASE WHEN c_trein THEN 10 ELSE 0 END) +
    (CASE WHEN c_pdds  THEN  5 ELSE 0 END) +
    (CASE WHEN c_com   THEN 10 ELSE 0 END) -
    LEAST(ocorrencias_count, 3) * 40
  )
) STORED;

notify pgrst, 'reload schema';
