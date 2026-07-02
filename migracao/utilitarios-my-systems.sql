-- ============================================================
-- public.my_systems() — agora inclui 'utilitarios' (Caderno/BookStack).
-- ------------------------------------------------------------
-- O modulo Utilitarios e' PESSOAL: todo mundo tem o seu. Entao, ao
-- contrario dos outros apps (que dependem de profiles/user_roles no
-- schema do app), 'utilitarios' e' liberado para QUALQUER usuario
-- autenticado. O isolamento "cada um ve' so' o seu" e' feito DENTRO do
-- BookStack (permissoes "Proprio" do papel padrao), nao aqui.
--
-- Esta e' a definicao COMPLETA da funcao (copia da migracao/my_systems.sql
-- + a chave 'utilitarios'). Rodar no SQL Editor do Supabase SMERP.
-- Idempotente.
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
        ),
        'sobras', (
          select case when exists (select 1 from sobras.profiles where id = auth.uid())
            then coalesce(
              (select jsonb_agg(role) from sobras.user_roles where user_id = auth.uid()),
              '[]'::jsonb)
          end
        ),
        'manutencao', (
          select case when exists (select 1 from manutencao.profiles where id = auth.uid())
            then coalesce(
              (select jsonb_agg(role) from manutencao.user_roles where user_id = auth.uid()),
              '[]'::jsonb)
          end
        ),
        'planos_acao', (
          -- ATENÇÃO: aqui o vínculo é profiles.user_id (não .id, que é uuid próprio).
          select case when exists (select 1 from planos_acao.profiles where user_id = auth.uid())
            then coalesce(
              (select jsonb_agg(role) from planos_acao.user_roles where user_id = auth.uid()),
              '[]'::jsonb)
          end
        ),
        'expedicao', (
          select case when exists (select 1 from expedicao.profiles where id = auth.uid())
            then coalesce(
              (select jsonb_agg(role) from expedicao.user_roles where user_id = auth.uid()),
              '[]'::jsonb)
          end
        ),
        'frota', (
          select case when exists (select 1 from frota.profiles where id = auth.uid())
            then coalesce(
              (select jsonb_agg(role) from frota.user_roles where user_id = auth.uid()),
              '[]'::jsonb)
          end
        ),
        -- PESSOAL: todo usuario autenticado tem o seu Caderno (BookStack).
        'utilitarios', (
          select case when auth.uid() is not null
            then '["usuario"]'::jsonb
          end
        ),
        -- Modulo interno do Hub (aba "Engenharia" -> Assistencia / RNC).
        'engenharia', (
          select case when exists (select 1 from engenharia.profiles where id = auth.uid())
            then coalesce(
              (select jsonb_agg(role) from engenharia.user_roles where user_id = auth.uid()),
              '[]'::jsonb)
          end
        ),
        'planejamento', (
          -- Modulo Planejamento de Carga (PCP) -> schema proprio.
          select case when exists (select 1 from planejamento.profiles where id = auth.uid())
            then coalesce(
              (select jsonb_agg(role) from planejamento.user_roles where user_id = auth.uid()),
              '[]'::jsonb)
          end
        ),
        'seguranca', (
          -- Programa de Gestão e Desempenho em Segurança do Trabalho.
          select case when exists (select 1 from seguranca.profiles where id = auth.uid())
            then coalesce(
              (select jsonb_agg(role) from seguranca.user_roles where user_id = auth.uid()),
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

-- Teste rápido (logado como um usuário): deve trazer "utilitarios": ["usuario"].
--   select public.my_systems();
