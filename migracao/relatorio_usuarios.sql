-- ============================================================
-- RELATÓRIO (1/2) — POR USUÁRIO: acesso (papéis) em cada sistema + quanto já lançou
-- Rodar no SQL Editor do SMERP (só leitura). Resultado único.
--   *_acesso = papéis no sistema; NULL = SEM acesso àquele sistema.
--   bip: pedidos são compartilhados (sem dono individual) -> conta ações no audit_log.
-- ============================================================
WITH
cmp_roles AS (SELECT user_id, string_agg(role::text, ', ' ORDER BY role::text) r FROM compras.user_roles GROUP BY user_id),
fab_roles AS (SELECT user_id, string_agg(role::text, ', ' ORDER BY role::text) r FROM fabrill.user_roles GROUP BY user_id),
bip_roles AS (SELECT user_id, string_agg(role::text, ', ' ORDER BY role::text) r FROM bip.user_roles  GROUP BY user_id),
cmp_req AS (SELECT requester_id uid, count(*) n FROM compras.purchase_requests   GROUP BY requester_id),
fab_ent AS (SELECT created_by  uid, count(*) n FROM fabrill.production_entries    GROUP BY created_by),
fab_dev AS (SELECT created_by  uid, count(*) n FROM fabrill.production_deviations GROUP BY created_by),
bip_aud AS (SELECT user_id     uid, count(*) n FROM bip.audit_log                 GROUP BY user_id)
SELECT
  u.email,
  CASE WHEN cp.id IS NOT NULL THEN coalesce(cr.r, '(sem papel)') END AS compras_acesso,
  CASE WHEN fp.id IS NOT NULL THEN coalesce(fr.r, '(sem papel)') END AS fabrill_acesso,
  CASE WHEN bp.id IS NOT NULL THEN coalesce(br.r, '(sem papel)') END AS bip_acesso,
  coalesce(cq.n, 0) AS compras_solicitacoes,
  coalesce(fe.n, 0) AS fabrill_apontamentos,
  coalesce(fd.n, 0) AS fabrill_desvios,
  coalesce(ba.n, 0) AS bip_acoes_no_log
FROM auth.users u
LEFT JOIN compras.profiles cp ON cp.id = u.id
LEFT JOIN fabrill.profiles fp ON fp.id = u.id
LEFT JOIN bip.profiles     bp ON bp.id = u.id
LEFT JOIN cmp_roles cr ON cr.user_id = u.id
LEFT JOIN fab_roles fr ON fr.user_id = u.id
LEFT JOIN bip_roles br ON br.user_id = u.id
LEFT JOIN cmp_req cq ON cq.uid = u.id
LEFT JOIN fab_ent fe ON fe.uid = u.id
LEFT JOIN fab_dev fd ON fd.uid = u.id
LEFT JOIN bip_aud ba ON ba.uid = u.id
ORDER BY u.email;
