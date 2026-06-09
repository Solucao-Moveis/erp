-- ============================================================
-- SEED de usuários + motoristas do frota.
-- Cria login (email nome@solucaomoveis.ind.br, senha '12345678'), papel
-- 'motorista' no frota e o cadastro em frota.motoristas (vinculado ao login).
-- Reaproveita logins já existentes (não recria; só garante acesso ao frota).
-- Roda DEPOIS do frota_schema.sql. Idempotente. SQL Editor do Supabase SMERP.
-- ============================================================

do $$
declare
  r record;
  v_id uuid;
begin
  for r in (values
    ('Evando',   'evando@solucaomoveis.ind.br'),
    ('Valdei',   'valdei@solucaomoveis.ind.br'),
    ('Expedito', 'expedito@solucaomoveis.ind.br'),
    ('Rosa',     'rosa@solucaomoveis.ind.br'),
    ('Vinicius', 'vinicius@solucaomoveis.ind.br'),
    ('Fabricio', 'fabricio@solucaomoveis.ind.br'),
    ('Rafael',   'rafael@solucaomoveis.ind.br')
  ) as t(nome, email)
  loop
    -- já existe login com esse e-mail?
    select id into v_id from auth.users where lower(email) = lower(r.email);

    if v_id is null then
      v_id := gen_random_uuid();
      -- tokens como '' (NÃO NULL) p/ não quebrar o GoTrue (igual ao admin_create_user)
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', lower(r.email),
        extensions.crypt('12345678', extensions.gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', r.nome),
        false, false,
        '', '', '', '', '', '', '', ''
      );
      insert into auth.identities (
        provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        v_id::text, v_id,
        jsonb_build_object('sub', v_id::text, 'email', lower(r.email), 'email_verified', true),
        'email', now(), now(), now()
      );
    end if;

    -- acesso ao frota: profile + papel motorista
    insert into frota.profiles (id, email, full_name)
      values (v_id, lower(r.email), r.nome) on conflict (id) do nothing;
    insert into frota.user_roles (user_id, role)
      values (v_id, 'motorista') on conflict (user_id, role) do nothing;

    -- cadastro de motorista vinculado ao login (só insere se ainda não houver)
    if not exists (select 1 from frota.motoristas where user_id = v_id) then
      insert into frota.motoristas (nome, user_id) values (r.nome, v_id);
    end if;
  end loop;
end $$;

-- conferência:
--   select u.email, p.full_name, array_agg(ur.role) roles, m.nome motorista
--   from auth.users u
--   join frota.profiles p on p.id = u.id
--   left join frota.user_roles ur on ur.user_id = u.id
--   left join frota.motoristas m on m.user_id = u.id
--   where u.email like '%@solucaomoveis.ind.br'
--   group by u.email, p.full_name, m.nome order by u.email;
