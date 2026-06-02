-- ============================================================
-- FIX: GoTrue "Database error finding users / querying schema" (500)
-- Causa: usuários inseridos manualmente (migração + master) ficaram com
-- colunas de token em NULL. O GoTrue (Go) lê esses campos como string e
-- NÃO aceita NULL — espera string vazia ''. Isso quebra login e listagem.
-- Solução: trocar todo NULL dessas colunas por ''.
-- Rodar no SQL Editor do Supabase SMERP. Idempotente e seguro.
-- ============================================================
UPDATE auth.users SET
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '');

-- Conferência: deve retornar 0 em todas as colunas.
SELECT
  count(*) FILTER (WHERE confirmation_token IS NULL)         AS confirmation_null,
  count(*) FILTER (WHERE recovery_token IS NULL)             AS recovery_null,
  count(*) FILTER (WHERE email_change_token_new IS NULL)     AS echange_new_null,
  count(*) FILTER (WHERE email_change IS NULL)               AS echange_null,
  count(*) FILTER (WHERE email_change_token_current IS NULL) AS echange_cur_null,
  count(*) FILTER (WHERE phone_change IS NULL)               AS pchange_null,
  count(*) FILTER (WHERE phone_change_token IS NULL)         AS pchange_tok_null,
  count(*) FILTER (WHERE reauthentication_token IS NULL)     AS reauth_null
FROM auth.users;
