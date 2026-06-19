-- ============================================================
-- USUÁRIO "avesta" — acesso SOMENTE ao módulo Utilitários (Caderno).
-- ------------------------------------------------------------
-- Como o my_systems() (ver utilitarios-my-systems.sql) devolve
-- 'utilitarios' para QUALQUER usuário autenticado, basta criar o login
-- SEM nenhum perfil de app (compras/fabrill/...): ele vai enxergar
-- somente o card "Utilitários" na tela inicial do ERP.
--
-- Senha guardada em bcrypt (igual ao admin_users.sql / master_user.sql).
-- email: avesta@solucaomoveis.ind.br   senha: 12345678
-- Idempotente: se já existir, não duplica.
-- Rodar no SQL Editor do Supabase SMERP, DEPOIS do utilitarios-my-systems.sql.
-- ============================================================
do $$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := 'avesta@solucaomoveis.ind.br';
  v_name  text := 'Avesta';
  v_pass  text := '12345678';
begin
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise notice 'Usuário % já existe — nada a fazer.', v_email;
    return;
  end if;

  -- Login (auth.users) — senha bcrypt, e-mail já confirmado, tokens '' (não NULL,
  -- senão o GoTrue quebra o login — ver fix_auth_null_tokens.sql).
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(v_pass, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name),
    false, false,
    '', '', '', '', '', '', '', ''
  );

  -- Identidade de e-mail (necessária pro login por senha).
  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  -- NENHUM perfil de app é criado de propósito: assim o my_systems() só
  -- devolve 'utilitarios' e a pessoa vê apenas o Caderno.
  raise notice 'Usuário % criado (id %). Acesso: somente Utilitários.', v_email, v_id;
end $$;

-- Conferência (rode logado como master, ou ajuste): deve listar o avesta.
--   select id, email, created_at from auth.users where email = 'avesta@solucaomoveis.ind.br';
