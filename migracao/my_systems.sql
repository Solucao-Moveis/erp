-- ============================================================
-- public.my_systems() — devolve os sistemas (e papéis) do usuário logado.
-- Usado pelo ERP (SMERP) para mostrar só os cards que são da pessoa.
-- Rodar no SQL Editor do Supabase SMERP. Idempotente.
-- ============================================================
create or replace function public.my_systems()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_strip_nulls(
      jsonb_build_object(
        'compras', (
          select case when exists (select 1 from compras.profiles where id = auth.uid())
            then coalesce(
              (select jsonb_agg(role) from compras.user_roles where user_id = auth.uid()),
              '[]'::jsonb)
          end
        ),
        'fabrill', (
          select case when exists (select 1 from fabrill.profiles where id = auth.uid())
            then coalesce(
              (select jsonb_agg(role) from fabrill.user_roles where user_id = auth.uid()),
              '[]'::jsonb)
          end
        ),
        'bip', (
          select case when exists (select 1 from bip.profiles where id = auth.uid())
            then coalesce(
              (select jsonb_agg(role) from bip.user_roles where user_id = auth.uid()),
              '[]'::jsonb)
          end
        ),
        'gestao', (
          select case when exists (select 1 from gestao.profiles where id = auth.uid())
            then coalesce(
              (select jsonb_agg(scope) from gestao.user_scopes where user_id = auth.uid()),
              '[]'::jsonb)
          end
        )
      )
    ),
    '{}'::jsonb
  );
$$;

-- Só usuários autenticados podem chamar.
revoke all on function public.my_systems() from public, anon;
grant execute on function public.my_systems() to authenticated;

-- Teste rápido (rodar logado como um usuário, ou via PostgREST):
--   select public.my_systems();
