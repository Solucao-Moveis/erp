-- ============================================================
-- CRIAÇÃO DE USUÁRIOS PELO ERP (SMERP)
-- ------------------------------------------------------------
-- Duas funções (RPC) que o Hub chama:
--   1) public.can_manage_users()  -> bool   (mostra/oculta a aba "Usuários")
--   2) public.admin_create_user(...) -> jsonb (cria o login + libera sistemas)
--
-- Quem pode criar/editar: SOMENTE o MASTER (master@solucaomoveis.ind.br).
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
  -- SOMENTE o master pode gerenciar usuários (criar/editar/listar).
  select exists (
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
--   gestao (escopos): diretoria | compras | producao | expedicao | projetos
--   manutencao: admin | manutencao | producao
--   planos_acao: admin | user
--   frota: admin | gestor | motorista | visualizador
-- Ex.: {"compras":["solicitante"], "bip":["user"], "planos_acao":["user"]}
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

    elsif sys = 'sobras' then
      insert into sobras.profiles (id, email, full_name)
        values (new_id, v_email, v_name) on conflict (id) do nothing;
      for r in select jsonb_array_elements_text(roles) loop
        insert into sobras.user_roles (user_id, role)
          values (new_id, r::sobras.app_role) on conflict (user_id, role) do nothing;
      end loop;

    elsif sys = 'manutencao' then
      -- ATENÇÃO: manutencao.profiles tem colunas (id, nome, email) — diferente
      -- das outras (id, email, full_name). 'nome' é NOT NULL → coalesce p/ e-mail.
      insert into manutencao.profiles (id, nome, email)
        values (new_id, coalesce(v_name, v_email), v_email) on conflict (id) do nothing;
      for r in select jsonb_array_elements_text(roles) loop
        insert into manutencao.user_roles (user_id, role)
          values (new_id, r::manutencao.app_role) on conflict (user_id, role) do nothing;
      end loop;

    elsif sys = 'planos_acao' then
      -- ATENÇÃO: planos_acao.profiles tem (id uuid PRÓPRIO, user_id UNIQUE, nome NOT NULL,
      -- email) — o vínculo com o usuário é user_id (≠ das outras, que usam id). 'nome' é
      -- NOT NULL default '' → setamos com o nome (ou e-mail).
      insert into planos_acao.profiles (user_id, nome, email)
        values (new_id, coalesce(v_name, v_email), v_email) on conflict (user_id) do nothing;
      for r in select jsonb_array_elements_text(roles) loop
        insert into planos_acao.user_roles (user_id, role)
          values (new_id, r::planos_acao.app_role) on conflict (user_id, role) do nothing;
      end loop;

    elsif sys = 'frota' then
      -- frota.profiles segue (id, email, full_name) como compras/sobras.
      insert into frota.profiles (id, email, full_name)
        values (new_id, v_email, v_name) on conflict (id) do nothing;
      for r in select jsonb_array_elements_text(roles) loop
        insert into frota.user_roles (user_id, role)
          values (new_id, r::frota.app_role) on conflict (user_id, role) do nothing;
      end loop;

    elsif sys = 'engenharia' then
      -- Modulo interno do Hub (Assistencias/RNC). profiles (id, email, full_name).
      insert into engenharia.profiles (id, email, full_name)
        values (new_id, v_email, v_name) on conflict (id) do nothing;
      for r in select jsonb_array_elements_text(roles) loop
        insert into engenharia.user_roles (user_id, role)
          values (new_id, r::engenharia.app_role) on conflict (user_id, role) do nothing;
      end loop;

    elsif sys = 'seguranca' then
      -- SST — Programa de Gestão e Desempenho em Segurança do Trabalho.
      -- profiles segue (id, email, full_name) como compras/frota.
      insert into seguranca.profiles (id, email, full_name)
        values (new_id, v_email, v_name) on conflict (id) do nothing;
      for r in select jsonb_array_elements_text(roles) loop
        insert into seguranca.user_roles (user_id, role)
          values (new_id, r::seguranca.app_role) on conflict (user_id, role) do nothing;
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
             cp.full_name, fp.full_name, bp.full_name, gp.full_name, sp.full_name, mp.nome, pap.nome, frp.full_name, ep.full_name, sgp.full_name) as full_name,
    u.created_at,
    jsonb_strip_nulls(jsonb_build_object(
      'compras', (select jsonb_agg(role) from compras.user_roles where user_id = u.id),
      'fabrill', (select jsonb_agg(role) from fabrill.user_roles where user_id = u.id),
      'bip',     (select jsonb_agg(role) from bip.user_roles     where user_id = u.id),
      'gestao',  (select jsonb_agg(scope) from gestao.user_scopes where user_id = u.id),
      'sobras',  (select jsonb_agg(role) from sobras.user_roles  where user_id = u.id),
      'manutencao', (select jsonb_agg(role) from manutencao.user_roles where user_id = u.id),
      'planos_acao', (select jsonb_agg(role) from planos_acao.user_roles where user_id = u.id),
      'frota',   (select jsonb_agg(role) from frota.user_roles   where user_id = u.id),
      'engenharia', (select jsonb_agg(role) from engenharia.user_roles where user_id = u.id),
      'seguranca', (select jsonb_agg(role) from seguranca.user_roles where user_id = u.id)
    )) as systems
  from auth.users u
  left join compras.profiles cp on cp.id = u.id
  left join fabrill.profiles fp on fp.id = u.id
  left join bip.profiles     bp on bp.id = u.id
  left join gestao.profiles  gp on gp.id = u.id
  left join sobras.profiles  sp on sp.id = u.id
  left join manutencao.profiles mp on mp.id = u.id
  left join planos_acao.profiles pap on pap.user_id = u.id   -- vínculo por user_id (≠ das outras)
  left join frota.profiles   frp on frp.id = u.id
  left join engenharia.profiles ep on ep.id = u.id
  left join seguranca.profiles sgp on sgp.id = u.id
  where public.can_manage_users()   -- só o master recebe a lista
  order by u.created_at desc;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- ------------------------------------------------------------
-- 4) AUTOCADASTRO (tela de login) — cria SÓ o login, sem acesso a nada.
--    Liberado para anon (qualquer e-mail). A conta nasce sem nenhum
--    sistema; o master libera depois pela aba Usuários. Por isso é
--    seguro deixar anon chamar: no pior caso cria um login que não vê nada.
-- ------------------------------------------------------------
create or replace function public.self_register(
  p_email     text,
  p_password  text,
  p_full_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id  uuid := gen_random_uuid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name  text := nullif(trim(coalesce(p_full_name, '')), '');
begin
  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Informe um e-mail válido.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'A senha precisa ter ao menos 6 caracteres.';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Já existe uma conta com o e-mail %. Tente entrar ou recuperar a senha.', v_email;
  end if;

  -- mesmo INSERT do admin_create_user (tokens '' p/ não quebrar o GoTrue)
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

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    new_id::text, new_id,
    jsonb_build_object('sub', new_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  return jsonb_build_object('id', new_id, 'email', v_email);
end;
$$;

revoke all on function public.self_register(text, text, text) from public;
grant execute on function public.self_register(text, text, text) to anon, authenticated;


-- ------------------------------------------------------------
-- 5) DEFINIR os sistemas+papéis de um usuário JÁ existente.
--    A aba Usuários chama isto quando o master clica numa pessoa e
--    ajusta o acesso. O resultado fica EXATAMENTE igual a p_systems:
--    o que não vier marcado é REMOVIDO; o que vier é garantido.
--    (mesmo formato de p_systems do admin_create_user)
-- ------------------------------------------------------------
create or replace function public.admin_set_user_systems(
  p_user_id uuid,
  p_systems jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_name  text;
  desired jsonb;
begin
  if not public.can_manage_users() then
    raise exception 'Sem permissão para alterar usuários.' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'Usuário inválido.';
  end if;

  select email, nullif(coalesce(raw_user_meta_data->>'full_name', ''), '')
    into v_email, v_name
    from auth.users where id = p_user_id;
  if v_email is null then
    raise exception 'Usuário não encontrado.';
  end if;

  -- COMPRAS
  desired := coalesce(p_systems->'compras', '[]'::jsonb);
  if jsonb_array_length(desired) > 0 then
    insert into compras.profiles (id, email, full_name)
      values (p_user_id, v_email, v_name) on conflict (id) do nothing;
    delete from compras.user_roles
      where user_id = p_user_id and role::text not in (select jsonb_array_elements_text(desired));
    insert into compras.user_roles (user_id, role)
      select p_user_id, x::compras.app_role from jsonb_array_elements_text(desired) as x
      on conflict (user_id, role) do nothing;
  else
    delete from compras.user_roles where user_id = p_user_id;
    begin delete from compras.profiles where id = p_user_id;
    exception when foreign_key_violation then null; end;
  end if;

  -- FABRILL
  desired := coalesce(p_systems->'fabrill', '[]'::jsonb);
  if jsonb_array_length(desired) > 0 then
    insert into fabrill.profiles (id, email, full_name)
      values (p_user_id, v_email, v_name) on conflict (id) do nothing;
    delete from fabrill.user_roles
      where user_id = p_user_id and role::text not in (select jsonb_array_elements_text(desired));
    insert into fabrill.user_roles (user_id, role)
      select p_user_id, x::fabrill.app_role from jsonb_array_elements_text(desired) as x
      on conflict (user_id, role) do nothing;
  else
    delete from fabrill.user_roles where user_id = p_user_id;
    begin delete from fabrill.profiles where id = p_user_id;
    exception when foreign_key_violation then null; end;
  end if;

  -- BIP
  desired := coalesce(p_systems->'bip', '[]'::jsonb);
  if jsonb_array_length(desired) > 0 then
    insert into bip.profiles (id, email, full_name)
      values (p_user_id, v_email, v_name) on conflict (id) do nothing;
    delete from bip.user_roles
      where user_id = p_user_id and role::text not in (select jsonb_array_elements_text(desired));
    insert into bip.user_roles (user_id, role)
      select p_user_id, x::bip.app_role from jsonb_array_elements_text(desired) as x
      on conflict (user_id, role) do nothing;
  else
    delete from bip.user_roles where user_id = p_user_id;
    begin delete from bip.profiles where id = p_user_id;
    exception when foreign_key_violation then null; end;
  end if;

  -- GESTAO (escopos de área; a tabela tem CHECK nos valores válidos)
  desired := coalesce(p_systems->'gestao', '[]'::jsonb);
  if jsonb_array_length(desired) > 0 then
    insert into gestao.profiles (id, email, full_name)
      values (p_user_id, v_email, v_name) on conflict (id) do nothing;
    delete from gestao.user_scopes
      where user_id = p_user_id and scope not in (select jsonb_array_elements_text(desired));
    insert into gestao.user_scopes (user_id, scope)
      select p_user_id, x from jsonb_array_elements_text(desired) as x
      on conflict (user_id, scope) do nothing;
  else
    delete from gestao.user_scopes where user_id = p_user_id;
    begin delete from gestao.profiles where id = p_user_id;
    exception when foreign_key_violation then null; end;
  end if;

  -- SOBRAS (papel único 'usuario'; "todo mundo igual")
  desired := coalesce(p_systems->'sobras', '[]'::jsonb);
  if jsonb_array_length(desired) > 0 then
    insert into sobras.profiles (id, email, full_name)
      values (p_user_id, v_email, v_name) on conflict (id) do nothing;
    delete from sobras.user_roles
      where user_id = p_user_id and role::text not in (select jsonb_array_elements_text(desired));
    insert into sobras.user_roles (user_id, role)
      select p_user_id, x::sobras.app_role from jsonb_array_elements_text(desired) as x
      on conflict (user_id, role) do nothing;
  else
    delete from sobras.user_roles where user_id = p_user_id;
    begin delete from sobras.profiles where id = p_user_id;
    exception when foreign_key_violation then null; end;
  end if;

  -- MANUTENCAO (papéis reais: admin | manutencao | producao)
  -- profiles tem (id, nome, email) — 'nome' NOT NULL → coalesce p/ e-mail.
  desired := coalesce(p_systems->'manutencao', '[]'::jsonb);
  if jsonb_array_length(desired) > 0 then
    insert into manutencao.profiles (id, nome, email)
      values (p_user_id, coalesce(v_name, v_email), v_email) on conflict (id) do nothing;
    delete from manutencao.user_roles
      where user_id = p_user_id and role::text not in (select jsonb_array_elements_text(desired));
    insert into manutencao.user_roles (user_id, role)
      select p_user_id, x::manutencao.app_role from jsonb_array_elements_text(desired) as x
      on conflict (user_id, role) do nothing;
  else
    delete from manutencao.user_roles where user_id = p_user_id;
    begin delete from manutencao.profiles where id = p_user_id;
    exception when foreign_key_violation then null; end;
  end if;

  -- PLANOS_ACAO (papéis reais: admin | user)
  -- profiles tem (id uuid próprio, user_id UNIQUE, nome NOT NULL, email) → vínculo por user_id.
  desired := coalesce(p_systems->'planos_acao', '[]'::jsonb);
  if jsonb_array_length(desired) > 0 then
    insert into planos_acao.profiles (user_id, nome, email)
      values (p_user_id, coalesce(v_name, v_email), v_email) on conflict (user_id) do nothing;
    delete from planos_acao.user_roles
      where user_id = p_user_id and role::text not in (select jsonb_array_elements_text(desired));
    insert into planos_acao.user_roles (user_id, role)
      select p_user_id, x::planos_acao.app_role from jsonb_array_elements_text(desired) as x
      on conflict (user_id, role) do nothing;
  else
    delete from planos_acao.user_roles where user_id = p_user_id;
    begin delete from planos_acao.profiles where user_id = p_user_id;
    exception when foreign_key_violation then null; end;
  end if;

  -- FROTA (papéis reais: admin | gestor | motorista | visualizador)
  -- profiles tem (id, email, full_name) → vínculo por id, como compras/sobras.
  desired := coalesce(p_systems->'frota', '[]'::jsonb);
  if jsonb_array_length(desired) > 0 then
    insert into frota.profiles (id, email, full_name)
      values (p_user_id, v_email, v_name) on conflict (id) do nothing;
    delete from frota.user_roles
      where user_id = p_user_id and role::text not in (select jsonb_array_elements_text(desired));
    insert into frota.user_roles (user_id, role)
      select p_user_id, x::frota.app_role from jsonb_array_elements_text(desired) as x
      on conflict (user_id, role) do nothing;
  else
    delete from frota.user_roles where user_id = p_user_id;
    begin delete from frota.profiles where id = p_user_id;
    exception when foreign_key_violation then null; end;
  end if;

  -- ENGENHARIA (papéis: criador | leitor) — módulo interno do Hub.
  desired := coalesce(p_systems->'engenharia', '[]'::jsonb);
  if jsonb_array_length(desired) > 0 then
    insert into engenharia.profiles (id, email, full_name)
      values (p_user_id, v_email, v_name) on conflict (id) do nothing;
    delete from engenharia.user_roles
      where user_id = p_user_id and role::text not in (select jsonb_array_elements_text(desired));
    insert into engenharia.user_roles (user_id, role)
      select p_user_id, x::engenharia.app_role from jsonb_array_elements_text(desired) as x
      on conflict (user_id, role) do nothing;
  else
    delete from engenharia.user_roles where user_id = p_user_id;
    begin delete from engenharia.profiles where id = p_user_id;
    exception when foreign_key_violation then null; end;
  end if;

  -- SEGURANCA (papéis: admin | sesmt | lider | leitor)
  desired := coalesce(p_systems->'seguranca', '[]'::jsonb);
  if jsonb_array_length(desired) > 0 then
    insert into seguranca.profiles (id, email, full_name)
      values (p_user_id, v_email, v_name) on conflict (id) do nothing;
    delete from seguranca.user_roles
      where user_id = p_user_id and role::text not in (select jsonb_array_elements_text(desired));
    insert into seguranca.user_roles (user_id, role)
      select p_user_id, x::seguranca.app_role from jsonb_array_elements_text(desired) as x
      on conflict (user_id, role) do nothing;
  else
    delete from seguranca.user_roles where user_id = p_user_id;
    begin delete from seguranca.profiles where id = p_user_id;
    exception when foreign_key_violation then null; end;
  end if;

  return jsonb_build_object('id', p_user_id, 'email', v_email);
end;
$$;

revoke all on function public.admin_set_user_systems(uuid, jsonb) from public, anon;
grant execute on function public.admin_set_user_systems(uuid, jsonb) to authenticated;


-- Teste (logado como master):
--   select public.can_manage_users();
--   select * from public.admin_list_users();
--   select public.admin_create_user('fulano@empresa.com','12345678','Fulano de Tal',
--            '{"compras":["solicitante"],"bip":["user"]}'::jsonb);
--   -- autocadastro (como anon, pela tela de login):
--   select public.self_register('novo@empresa.com','12345678','Pessoa Nova');
--   -- master libera depois:
--   select public.admin_set_user_systems('<uuid-da-pessoa>'::uuid,
--            '{"compras":["solicitante"],"gestao":["compras"]}'::jsonb);
