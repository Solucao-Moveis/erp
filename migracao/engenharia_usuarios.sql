-- ============================================================
-- ACESSOS — Modulo Engenharia (Assistencia/RNC)
-- ------------------------------------------------------------
-- 1) Cria o usuario vitor@solucaomoveis.ind.br (login + identidade).
-- 2) Poe o Vitor na MESMA equipe do Caderno que o Avesta (time "Manutencao")
--    -> ele ve "as mesmas coisas" no Utilitarios/Caderno.
-- 3) Da' acesso ao modulo Engenharia (papel 'criador' = pode criar assistencias)
--    para o VITOR e tambem para o AVESTA.
--
-- Senha inicial do Vitor: 12345678 (marcado must_change_password -> ele troca
-- no primeiro login, igual ao padrao do Hub). Idempotente.
-- Rodar no SQL Editor do Supabase SMERP, DEPOIS de:
--   - engenharia_schema.sql   (cria o schema/tabelas)
--   - caderno_schema.sql / caderno_equipes.sql (ja rodados; criam o time)
-- ============================================================
do $$
declare
  v_vitor  uuid;
  v_avesta uuid;
  v_team   uuid;
  v_email  text := 'vitor@solucaomoveis.ind.br';
  v_name   text := 'Vitor Renan S. da Conceicao';
  v_pass   text := '12345678';
begin
  -- ---------- 1) cria o login do Vitor (se ainda nao existir) ----------
  select id into v_vitor from auth.users where lower(email) = v_email;
  if v_vitor is null then
    v_vitor := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_vitor, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_pass, extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_name, 'must_change_password', true),
      false, false,
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_vitor::text, v_vitor,
      jsonb_build_object('sub', v_vitor::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
    raise notice 'Vitor criado (id %).', v_vitor;
  else
    raise notice 'Vitor ja existia (id %).', v_vitor;
  end if;

  -- ---------- 2) Caderno: Vitor na mesma equipe do Avesta ("Manutencao") ----------
  select id into v_avesta from auth.users where lower(email) = 'avesta@solucaomoveis.ind.br';
  select id into v_team   from caderno.teams where nome = 'Manutencao' limit 1;

  -- garante o perfil do Vitor no Caderno (exibe nome/e-mail na lista de membros)
  insert into caderno.profiles (id, email, full_name)
    values (v_vitor, v_email, v_name)
  on conflict (id) do nothing;

  if v_team is not null then
    insert into caderno.team_members (team_id, user_id)
      values (v_team, v_vitor)
    on conflict (team_id, user_id) do nothing;
    raise notice 'Vitor adicionado ao time "Manutencao" do Caderno.';
  else
    raise notice 'ATENCAO: time "Manutencao" nao encontrado no Caderno — pulei a equipe.';
  end if;

  -- ---------- 3) Engenharia: acesso 'criador' p/ Vitor e Avesta ----------
  -- Vitor
  insert into engenharia.profiles (id, email, full_name)
    values (v_vitor, v_email, v_name)
  on conflict (id) do nothing;
  insert into engenharia.user_roles (user_id, role)
    values (v_vitor, 'criador')
  on conflict (user_id, role) do nothing;

  -- Avesta (se existir)
  if v_avesta is not null then
    insert into engenharia.profiles (id, email, full_name)
      values (v_avesta, 'avesta@solucaomoveis.ind.br', 'Avesta')
    on conflict (id) do nothing;
    insert into engenharia.user_roles (user_id, role)
      values (v_avesta, 'criador')
    on conflict (user_id, role) do nothing;
    raise notice 'Avesta recebeu acesso de criador no modulo Engenharia.';
  else
    raise notice 'ATENCAO: avesta nao encontrado — rode avesta-user.sql antes, se necessario.';
  end if;

  raise notice 'OK. Vitor: Utilitarios(Caderno, time Manutencao) + Engenharia(criador). Avesta: + Engenharia(criador).';
end $$;

-- Conferencia:
--   select email, raw_user_meta_data->>'full_name' nome from auth.users
--    where email in ('vitor@solucaomoveis.ind.br','avesta@solucaomoveis.ind.br');
--   select p.email, array_agg(r.role) papeis
--     from engenharia.profiles p left join engenharia.user_roles r on r.user_id = p.id
--    group by p.email;
