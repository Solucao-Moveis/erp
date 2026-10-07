-- ============================================================
-- Acidentes e Afastamentos: libera a Wisla (SST) como Administrador
-- Rodar DEPOIS de teste_papeis_acesso.sql. Idempotente.
-- Procura o login pelo nome ou e-mail; se achar 0 ou mais de 1, só avisa.
-- ============================================================

-- 1) Conferir quem é (deve aparecer só ela):
select id, email, raw_user_meta_data->>'full_name' as nome
from auth.users
where email ilike '%wisla%' or raw_user_meta_data->>'full_name' ilike '%wisla%';

-- 2) Liberar como admin do módulo:
do $$
declare
  v_ids uuid[];
  v_id  uuid;
  v_email text;
  v_nome  text;
begin
  select array_agg(id) into v_ids
  from auth.users
  where email ilike '%wisla%' or raw_user_meta_data->>'full_name' ilike '%wisla%';

  if v_ids is null then
    raise notice 'Nenhum login da Wisla encontrado. Crie o usuário dela na aba Usuários do Hub e marque Acidentes e Afastamentos > Administrador.';
    return;
  elsif array_length(v_ids, 1) > 1 then
    raise notice 'Mais de um login bate com "wisla": %. Libere pela aba Usuários escolhendo o certo.', v_ids;
    return;
  end if;

  v_id := v_ids[1];
  select email, raw_user_meta_data->>'full_name' into v_email, v_nome from auth.users where id = v_id;

  insert into teste.profiles (id, email, full_name)
    values (v_id, v_email, v_nome) on conflict (id) do nothing;
  insert into teste.user_roles (user_id, role)
    values (v_id, 'admin') on conflict (user_id, role) do nothing;

  raise notice 'Wisla (%) liberada como Administrador em Acidentes e Afastamentos.', v_email;
end $$;
