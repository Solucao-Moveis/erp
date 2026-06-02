-- ============================================================
-- RELATÓRIO (2/2) — INTEGRIDADE dos lançamentos ("tá registrado certinho?")
-- Rodar no SQL Editor do SMERP (só leitura). Resultado único.
--   total    = nº de registros
--   sem_dono = dono NULL (no fabrill alguns NULL são legítimos)
--   orfaos   = dono que NÃO existe em auth.users  -> DEVE SER 0
-- ============================================================
SELECT 'compras.purchase_requests' AS tabela, count(*) AS total,
       count(*) FILTER (WHERE requester_id IS NULL) AS sem_dono,
       count(*) FILTER (WHERE requester_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = requester_id)) AS orfaos
FROM compras.purchase_requests
UNION ALL
SELECT 'fabrill.production_entries', count(*),
       count(*) FILTER (WHERE created_by IS NULL),
       count(*) FILTER (WHERE created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = created_by))
FROM fabrill.production_entries
UNION ALL
SELECT 'fabrill.production_deviations', count(*),
       count(*) FILTER (WHERE created_by IS NULL),
       count(*) FILTER (WHERE created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = created_by))
FROM fabrill.production_deviations
UNION ALL
SELECT 'bip.loading_orders (compartilhado, sem dono)', count(*), NULL, NULL FROM bip.loading_orders
UNION ALL
SELECT 'bip.scanned_codes (compartilhado, sem dono)',  count(*), NULL, NULL FROM bip.scanned_codes
ORDER BY tabela;
