-- ============================================================
-- CRIAÇÃO DE USUÁRIOS PELO ERP (SMERP)
-- ------------------------------------------------------------
-- Duas funções (RPC) que o Hub chama:
--   1) public.can_manage_users()  -> bool   (mostra/oculta a aba "Usuários")
--   2) public.admin_create_user(...) -> jsonb (cria o login + libera sistemas)
--
-- Quem pode criar: o MASTER (master@solucaomoveis.ind.br) e quem tem
-- escopo 'diretoria' no Gerencial (gestao.user_scopes).
--
-- A senha vem digitada pelo admin (guardada em bcrypt, igual ao master_user.sql).
-- Rodar no SQL Editor do Supabase SMERP. Idempotente (create or replace).
-- ============================================================

-- ------------------------------------------------------------
-- 1) GATE: quem pode gerenciar usuários?
-- ------------------------------------------------------------
create or replace function public.can_manage_users()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- diretoria no Gerencial vê tudo e pode criar gente
    exists (
      select 1 from gestao.user_scopes
      where user_id = auth.uid() and scope = 'diretoria'
    )
    -- o usuário master, identificado pelo e-mail no auth
    or exists (
      select 1 from auth.users
      where id = auth.uid() and lower(email) = 'master@solucaomoveis.ind.br'
    );
$$;

revoke all on function public.can_manage_users() from public, anon;
grant execute on function public.can_manage_users() to authenticated;


-- ------------------------------------------------------------
-- 2) CRIAR USUÁRIO + liberar sistemas/papéis
-- ------------------------------------------------------------
-- p_systems: objeto { sistema: [papéis...] }. Exemplos de papéis válidos:
--   compras: admin | aprovador | solicitante | comprador | visualizador
--   fabrill: pcp | lider | qualidade | administrador
--   bip:     admin | user
--   gestao (escopos): diretoria | compras | producao | expedicao
-- Ex.: {"compras":["solicitante"], "bip":["user"], "gestao":["compras"]}
-- ------------------------------------------------------------
create or replace function public.admin_create_user(
  p_email     text,
  p_password  text,
  p_full_name text,
  p_systems   jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name  text := nullif(trim(coalesce(p_full_name, '')), '');
  sys     text;
  roles   jsonb;
  r       text;
begin
  -- 0) Segurança: só master/diretoria
  if not public.can_manage_users() then
    raise exception 'Sem permissão para criar usuários.' using errcode = '42501';
  end if;

  -- 1) Validações básicas
  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Informe um e-mail válido.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'A senha precisa ter ao menos 6 caracteres.';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Já existe um usuário com o e-mail %.', v_email;
  end if;

  -- 2) Login (auth.users) — senha em bcrypt, e-mail já confirmado.
  --    As colunas de token vão como '' (string vazia) e NÃO NULL: o GoTrue
  --    (Go) lê esses campos como string e quebra o login se vierem NULL.
  --    (mesmo motivo do migracao/fix_auth_null_tokens.sql)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_strip_nulls(jsonb_build_object('full_name', v_name)),
    false, false,
    '', '', '', '', '', '', '', ''
  );

  -- 3) Identidade de e-mail (necessária pro login por senha)
  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    new_id::text, new_id,
    jsonb_build_object('sub', new_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  -- 4) Libera cada sistema escolhido com seus papéis/escopos
  for sys, roles in
    select key, value from jsonb_each(coalesce(p_systems, '{}'::jsonb))
  loop
    if sys = 'compras' then
      insert into compras.profiles (id, email, full_name)
        values (new_id, v_email, v_name) on conflict (id) do nothing;
      for r in select jsonb_array_elements_text(roles) loop
        insert into compras.user_roles (user_id, role)
          values (new_id, r::compras.app_role) on conflict (user_id, role) do nothing;
      end loop;

    elsif sys = 'fabrill' then
      insert into fabrill.profiles (id, email, full_name)
        values (new_id, v_email, v_name) on conflict (id) do nothing;
      for r in select jsonb_array_elements_text(roles) loop
        insert into fabrill.user_roles (user_id, role)
          values (new_id, r::fabrill.app_role) on conflict (user_id, role) do nothing;
      end loop;

    elsif sys = 'bip' then
      insert into bip.profiles (id, email, full_name)
        values (new_id, v_email, v_name) on conflict (id) do nothing;
      for r in select jsonb_array_elements_text(roles) loop
        insert into bip.user_roles (user_id, role)
          values (new_id, r::bip.app_role) on conflict (user_id, role) do nothing;
      end loop;

    elsif sys = 'gestao' then
      insert into gestao.profiles (id, email, full_name)
        values (new_id, v_email, v_name) on conflict (id) do nothing;
      for r in select jsonb_array_elements_text(roles) loop
        -- a tabela tem CHECK (scope in ('diretoria','compras','producao','expedicao'))
        insert into gestao.user_scopes (user_id, scope)
          values (new_id, r) on conflict (user_id, scope) do nothing;
      end loop;
    end if;
  end loop;

  return jsonb_build_object('id', new_id, 'email', v_email);
end;
$$;

revoke all on function public.admin_create_user(text, text, text, jsonb) from public, anon;
grant execute on function public.admin_create_user(text, text, text, jsonb) to authenticated;


-- ------------------------------------------------------------
-- 3) LISTAR usuários já existentes (só leitura) — para a aba mostrar
--    quem já tem cadastro e evitar duplicar.
-- ------------------------------------------------------------
create or replace function public.admin_list_users()
returns table (id uuid, email text, full_name text, created_at timestamptz, systems jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.email::text,
    coalesce(u.raw_user_meta_data->>'full_name',
             cp.full_name, fp.full_name, bp.full_name, gp.full_name) as full_name,
    u.created_at,
    jsonb_strip_nulls(jsonb_build_object(
      'compras', (select jsonb_agg(role) from compras.user_roles where user_id = u.id),
      'fabrill', (select jsonb_agg(role) from fabrill.user_roles where user_id = u.id),
      'bip',     (select jsonb_agg(role) from bip.user_roles     where user_id = u.id),
      'gestao',  (select jsonb_agg(scope) from gestao.user_scopes where user_id = u.id)
    )) as systems
  from auth.users u
  left join compras.profiles cp on cp.id = u.id
  left join fabrill.profiles fp on fp.id = u.id
  left join bip.profiles     bp on bp.id = u.id
  left join gestao.profiles  gp on gp.id = u.id
  where public.can_manage_users()   -- só master/diretoria recebem a lista
  order by u.created_at desc;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- Teste (logado como master/diretoria):
--   select public.can_manage_users();
--   select * from public.admin_list_users();
--   select public.admin_create_user('fulano@empresa.com','12345678','Fulano de Tal',
--            '{"compras":["solicitante"],"bip":["user"]}'::jsonb);
