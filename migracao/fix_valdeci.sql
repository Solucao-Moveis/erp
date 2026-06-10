-- ============================================================
-- Correção: o motorista cadastrado como "Valdei" é na verdade "Valdeci".
-- Renomeia em tudo (login/e-mail, identidade, perfil e cadastro), sem apagar
-- nada e mantendo a senha. Idempotente: se já estiver 'valdeci@', não faz nada.
-- ============================================================

do $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = 'valdei@solucaomoveis.ind.br';
  if v_id is not null then
    update auth.users
      set email = 'valdeci@solucaomoveis.ind.br',
          raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data,'{}'::jsonb), '{full_name}', '"Valdeci"'),
          updated_at = now()
      where id = v_id;
    update auth.identities
      set identity_data = identity_data || jsonb_build_object('email','valdeci@solucaomoveis.ind.br'),
          updated_at = now()
      where user_id = v_id and provider = 'email';
    update frota.profiles set email = 'valdeci@solucaomoveis.ind.br', full_name = 'Valdeci' where id = v_id;
    update frota.motoristas set nome = 'Valdeci' where user_id = v_id;
  end if;
end $$;
