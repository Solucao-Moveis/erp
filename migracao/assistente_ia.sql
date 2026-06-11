-- ============================================================
-- ASSISTENTE DE IA — controle de acesso (quem pode usar o chat).
-- ------------------------------------------------------------
-- O assistente fica no Hub, mas só aparece pra quem o MASTER liberar.
-- Espelha o padrão do can_manage_users(): master sempre pode; os demais
-- só se tiverem uma linha em public.assistant_users.
--
-- Rodar no SQL Editor do Supabase SMERP. Idempotente.
-- ============================================================

-- Lista de quem pode usar o assistente (além do master).
create table if not exists public.assistant_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.assistant_users enable row level security;

-- Só o master enxerga/mexe nesta lista (pela própria função de gate dos usuários).
drop policy if exists "assistant_users_master_all" on public.assistant_users;
create policy "assistant_users_master_all" on public.assistant_users
  for all to authenticated
  using (public.can_manage_users())
  with check (public.can_manage_users());

-- ------------------------------------------------------------
-- GATE: o usuário logado pode usar o assistente?
-- ------------------------------------------------------------
create or replace function public.can_use_assistant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- master sempre pode
    exists (
      select 1 from auth.users
      where id = auth.uid() and lower(email) = 'master@solucaomoveis.ind.br'
    )
    -- ou quem o master liberou
    or exists (
      select 1 from public.assistant_users where user_id = auth.uid()
    );
$$;

revoke all on function public.can_use_assistant() from public, anon;
grant execute on function public.can_use_assistant() to authenticated;

-- ------------------------------------------------------------
-- Liberar/remover alguém (só master). Praticidade pro SQL Editor.
-- ------------------------------------------------------------
create or replace function public.assistant_set_access(p_user_id uuid, p_allow boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_users() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_allow then
    insert into public.assistant_users (user_id, granted_by)
      values (p_user_id, auth.uid())
      on conflict (user_id) do nothing;
  else
    delete from public.assistant_users where user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.assistant_set_access(uuid, boolean) from public, anon;
grant execute on function public.assistant_set_access(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- Exemplos (rodar logado como master):
--   select public.can_use_assistant();
--   -- liberar alguém pelo e-mail:
--   select public.assistant_set_access(
--     (select id from auth.users where lower(email)='fulano@empresa.com'), true);
--   -- tirar o acesso:
--   select public.assistant_set_access(
--     (select id from auth.users where lower(email)='fulano@empresa.com'), false);
-- ============================================================
