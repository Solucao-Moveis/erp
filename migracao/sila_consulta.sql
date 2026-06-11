-- ============================================================
-- SILA — Poder de consulta geral (somente leitura, COMO o usuário).
-- ------------------------------------------------------------
-- Duas funções que o serviço ai-service expõe como "ferramentas":
--   1) public.sila_schema(p_schema)   -> tabelas+colunas de um schema
--      (pra a Sila saber o que existe antes de consultar)
--   2) public.sila_consultar(p_sql)   -> roda UMA consulta SELECT
--      somente leitura, COMO o usuário (SECURITY INVOKER => RLS aplica).
--
-- SEGURANÇA (camadas):
--   • SECURITY INVOKER: roda como o papel do chamador (authenticated) com o
--     auth.uid() dele => a RLS de cada tabela filtra as linhas. A Sila só vê
--     o que aquela pessoa já veria nos apps. NÃO usa service_role.
--   • transaction_read_only = on: qualquer tentativa de escrever falha.
--   • Só aceita 1 comando começando com SELECT/WITH (sem ';').
--   • statement_timeout curto + LIMIT 200 (não trava o banco).
--   • Schemas permitidos só os dos apps (sem pg_catalog/auth/etc.).
--
-- Rodar no SQL Editor do Supabase SMERP. Idempotente.
-- Depois: notify pgrst, 'reload schema';
-- ============================================================

-- Schemas que a Sila pode descrever/consultar.
create or replace function public._sila_schema_permitido(p text)
returns boolean language sql immutable
as $$ select p = any (array['public','compras','fabrill','bip','gestao','manutencao','planos_acao','sobras','frota','expedicao']) $$;

-- ------------------------------------------------------------
-- 1) Descrever um schema (tabelas + colunas) — ajuda a Sila a montar a consulta.
--    Só lê o catálogo (information_schema); não expõe dados.
-- ------------------------------------------------------------
create or replace function public.sila_schema(p_schema text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public._sila_schema_permitido(p_schema) then
      jsonb_build_object('erro', 'Schema não permitido.')
    else coalesce(
      (select jsonb_object_agg(table_name, cols)
       from (
         select c.table_name,
                jsonb_agg(c.column_name || ' ' || c.data_type order by c.ordinal_position) as cols
         from information_schema.columns c
         join information_schema.tables t
           on t.table_schema = c.table_schema and t.table_name = c.table_name
         where c.table_schema = p_schema
           and t.table_type = 'BASE TABLE'
         group by c.table_name
       ) s),
      '{}'::jsonb)
  end;
$$;

revoke all on function public.sila_schema(text) from public, anon;
grant execute on function public.sila_schema(text) to authenticated;

-- ------------------------------------------------------------
-- 2) Rodar uma consulta SELECT — somente leitura, COMO o usuário.
-- ------------------------------------------------------------
create or replace function public.sila_consultar(p_sql text)
returns jsonb
language plpgsql
security invoker            -- roda como o chamador => RLS do usuário aplica
set search_path = public, compras, fabrill, bip, gestao, manutencao, planos_acao, sobras, frota, expedicao
as $$
declare
  v_sql text := btrim(coalesce(p_sql, ''));
  v_head text;
  result jsonb;
begin
  if v_sql = '' then
    raise exception 'Consulta vazia.';
  end if;

  -- tira ';' final e proíbe múltiplos comandos
  v_sql := regexp_replace(v_sql, ';\s*$', '');
  if position(';' in v_sql) > 0 then
    raise exception 'Envie apenas UMA consulta (sem ";").';
  end if;

  -- precisa começar com SELECT ou WITH
  v_head := lower(left(v_sql, 6));
  if v_head <> 'select' and lower(left(v_sql, 5)) <> 'with ' and lower(left(v_sql, 5)) <> 'with(' then
    raise exception 'Apenas consultas SELECT são permitidas.';
  end if;

  -- trava de escrita: nada além de leitura roda nesta transação
  set local transaction_read_only = on;
  set local statement_timeout = '6s';

  -- executa de forma segura, agregando em JSON e limitando linhas
  execute format(
    'select coalesce(jsonb_agg(row_to_json(_q)), ''[]''::jsonb) from (select * from (%s) _inner limit 200) _q',
    v_sql
  ) into result;

  return result;
exception
  when others then
    -- devolve o erro como dado (pra Sila explicar em vez de estourar 500)
    return jsonb_build_object('erro', sqlerrm);
end;
$$;

revoke all on function public.sila_consultar(text) from public, anon;
grant execute on function public.sila_consultar(text) to authenticated;

-- ------------------------------------------------------------
-- Teste (logado como um usuário; deve respeitar a RLS dele):
--   select public.sila_schema('compras');
--   select public.sila_consultar('select count(*) as abertas from compras.purchase_requests where status = ''pendente''');
--   -- proibido (deve devolver erro):
--   select public.sila_consultar('update compras.purchase_requests set status=''aprovado''');
-- ============================================================
