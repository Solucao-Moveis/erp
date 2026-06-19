-- ============================================================
-- CADERNO — Equipes gerenciáveis pelo app (criar time + membros)
-- ------------------------------------------------------------
-- Regra: QUALQUER usuario autenticado pode CRIAR um time; quem cria vira
-- o DONO (created_by) e e' quem adiciona/remove membros. Membros enxergam
-- o time e o conteudo com visibilidade 'time'. (Sem isso, qualquer um se
-- auto-adicionaria a qualquer time e veria conteudo alheio.)
--
-- Idempotente. Rodar no SQL Editor do Supabase SMERP, DEPOIS de caderno_schema.sql.
-- ============================================================

-- 1) dono do time
alter table caderno.teams
  add column if not exists created_by uuid default auth.uid() references auth.users(id);

-- da' um dono ao time "Manutencao" do seed (avesta), se ainda estiver sem dono.
update caderno.teams t
   set created_by = (select id from auth.users where lower(email) = 'avesta@solucaomoveis.ind.br' limit 1)
 where t.nome = 'Manutencao' and t.created_by is null;

-- 2) trigger: ao criar um time, o criador entra como membro automaticamente
create or replace function caderno.team_add_creator()
returns trigger
language plpgsql security definer set search_path = caderno, public
as $$
begin
  if new.created_by is not null then
    insert into caderno.team_members (team_id, user_id)
      values (new.id, new.created_by)
      on conflict (team_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists caderno_team_add_creator on caderno.teams;
create trigger caderno_team_add_creator
  after insert on caderno.teams
  for each row execute function caderno.team_add_creator();

-- 3) RLS dos times: ver = todos (p/ o seletor); criar = autenticado; editar/excluir = dono
drop policy if exists "Teams insert" on caderno.teams;
create policy "Teams insert" on caderno.teams
  for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "Teams update" on caderno.teams;
create policy "Teams update" on caderno.teams
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "Teams delete" on caderno.teams;
create policy "Teams delete" on caderno.teams
  for delete to authenticated using (created_by = auth.uid());

-- 4) RLS dos membros (usa caderno.in_team SECURITY DEFINER p/ evitar recursao de RLS)
drop policy if exists "Team members view" on caderno.team_members;
create policy "Team members view" on caderno.team_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or caderno.in_team(auth.uid(), team_id)
    or exists (select 1 from caderno.teams t where t.id = team_id and t.created_by = auth.uid())
    or caderno.has_role(auth.uid(), 'admin')
  );

-- adicionar membros: so' o dono do time (ou admin)
drop policy if exists "Team members insert" on caderno.team_members;
create policy "Team members insert" on caderno.team_members
  for insert to authenticated
  with check (
    exists (select 1 from caderno.teams t where t.id = team_id and t.created_by = auth.uid())
    or caderno.has_role(auth.uid(), 'admin')
  );

-- remover: o dono remove qualquer um; o proprio membro pode sair
drop policy if exists "Team members delete" on caderno.team_members;
create policy "Team members delete" on caderno.team_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from caderno.teams t where t.id = team_id and t.created_by = auth.uid())
    or caderno.has_role(auth.uid(), 'admin')
  );

-- ============================================================
-- 5) RPCs (o app nao enxerga auth.users; estas funcoes resolvem e-mail->usuario)
-- ============================================================

-- adiciona um membro pelo e-mail (so' o dono do time pode)
create or replace function caderno.adicionar_membro(_team_id uuid, _email text)
returns jsonb
language plpgsql security definer set search_path = caderno, public
as $$
declare
  v_uid     uuid;
  v_creator uuid;
begin
  select created_by into v_creator from caderno.teams where id = _team_id;
  if v_creator is null then
    raise exception 'Time nao encontrado (ou sem dono definido).';
  end if;
  if v_creator <> auth.uid() and not caderno.has_role(auth.uid(), 'admin') then
    raise exception 'Apenas quem criou o time pode adicionar membros.';
  end if;

  select id into v_uid from auth.users where lower(email) = lower(trim(_email)) limit 1;
  if v_uid is null then
    raise exception 'Nenhum usuario com o e-mail %.', _email;
  end if;

  insert into caderno.team_members (team_id, user_id)
    values (_team_id, v_uid) on conflict (team_id, user_id) do nothing;

  -- garante o profile (p/ exibir nome/e-mail na lista)
  insert into caderno.profiles (id, email, full_name)
    select v_uid, u.email, coalesce(u.raw_user_meta_data->>'full_name', u.email)
      from auth.users u where u.id = v_uid
    on conflict (id) do nothing;

  return jsonb_build_object('user_id', v_uid, 'email', _email);
end;
$$;
grant execute on function caderno.adicionar_membro(uuid, text) to authenticated;

-- lista os membros de um time com e-mail/nome (so' quem pode ver o time)
create or replace function caderno.listar_membros(_team_id uuid)
returns table (user_id uuid, email text, full_name text)
language sql stable security definer set search_path = caderno, public
as $$
  select m.user_id,
         u.email::text,
         coalesce(p.full_name, u.raw_user_meta_data->>'full_name', u.email) as full_name
    from caderno.team_members m
    join auth.users u on u.id = m.user_id
    left join caderno.profiles p on p.id = m.user_id
   where m.team_id = _team_id
     and (
       caderno.in_team(auth.uid(), _team_id)
       or exists (select 1 from caderno.teams t where t.id = _team_id and t.created_by = auth.uid())
       or caderno.has_role(auth.uid(), 'admin')
     )
   order by full_name;
$$;
grant execute on function caderno.listar_membros(uuid) to authenticated;

-- ============================================================
-- TESTE
-- ============================================================
--   insert into caderno.teams (nome) values ('Producao');   -- vira seu (created_by=auth.uid())
--   select caderno.adicionar_membro('<team_id>', 'fulano@solucaomoveis.ind.br');
--   select * from caderno.listar_membros('<team_id>');
