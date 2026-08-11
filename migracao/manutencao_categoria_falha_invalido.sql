-- ============================================================
-- MANUTENÇÃO — Categoria "Inválido" (exclui a OS de todos os relatórios)
-- ------------------------------------------------------------
-- Não é uma categoria de falha de verdade — é um marcador pra tirar
-- uma OS classificada errado (ou aberta por engano, duplicada etc.)
-- de TODOS os cálculos de indicador (MTTR, MTBF, disponibilidade, OS
-- no período, Top 5, Pareto), sem precisar cancelar a OS em si.
-- O filtro vive no front (dashboard.tsx/indicadores.tsx), aqui só
-- adiciona o valor no enum.
--
-- Rodar no SQL Editor do Supabase SMERP. Idempotente.
-- ============================================================

alter type manutencao.categoria_falha add value if not exists 'invalido';
