-- ============================================================
-- RH — papel "líder": acesso só-leitura, escopado ao(s) setor(es)
-- que ele lidera (vê Colaboradores/ocorrências do seu setor; não
-- edita/exclui nada; não vê outros setores).
-- ------------------------------------------------------------
-- Pedido do Waine Rodrigues (RH) no quadro de Desenvolvimento.
-- O vínculo líder<->setor é gerenciado dentro do próprio app (tela
-- "Ajustes"), não pelo cadastro de usuário do Hub — quem já tem
-- acesso completo ("usuario") ao RH atribui os setores de cada líder.
--
-- rh.diario guarda 1 linha por DIA com TODOS os setores misturados
-- num único JSON (payload->ausentes é um objeto {setor: [...]}) —
-- não dá pra filtrar por setor via RLS de linha. Por isso o líder
-- não tem policy de SELECT na tabela crua; em vez disso, usa a RPC
-- rh.diario_ausentes_periodo(), que já devolve só o que ele pode ver.
--
-- Rodar no SQL Editor do Supabase SMERP. Idempotente.
--
-- ATENÇÃO: rode a PARTE 1 sozinha primeiro (RUN), espere terminar, e só
-- depois rode a PARTE 2 (o resto do arquivo) numa segunda execução —
-- o Postgres não deixa usar um valor de enum novo na mesma transação
-- que o criou (erro 55P04).
-- ============================================================

-- ============================================================
-- PARTE 1 — roda sozinha, espera terminar
-- ============================================================
alter type rh.app_role add value if not exists 'lider';

-- ============================================================
-- PARTE 2 — roda depois, o resto do arquivo
-- ============================================================

-- ---------- 2) VÍNCULO líder <-> setor ----------
create table if not exists rh.lider_setores (
  user_id uuid not null references rh.profiles(id) on delete cascade,
  setor   text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, setor)
);
alter table rh.lider_setores enable row level security;

-- ---------- 3) HELPERS ----------
create or replace function rh.is_lider(_uid uuid)
returns boolean language sql stable security definer set search_path = rh, public as $$
  select exists (select 1 from rh.user_roles where user_id = _uid and role = 'lider');
$$;
revoke all on function rh.is_lider(uuid) from public, anon;
grant execute on function rh.is_lider(uuid) to authenticated, service_role;

create or replace function rh.setores_do_lider(_uid uuid)
returns text[] language sql stable security definer set search_path = rh, public as $$
  select coalesce(array_agg(setor), '{}'::text[]) from rh.lider_setores where user_id = _uid;
$$;
revoke all on function rh.setores_do_lider(uuid) from public, anon;
grant execute on function rh.setores_do_lider(uuid) to authenticated, service_role;

-- ---------- 4) RLS: lider_setores (só membro com acesso completo gerencia) ----------
drop policy if exists rh_lider_setores_select on rh.lider_setores;
create policy rh_lider_setores_select on rh.lider_setores
  for select to authenticated using (rh.is_member(auth.uid()));

drop policy if exists rh_lider_setores_write on rh.lider_setores;
create policy rh_lider_setores_write on rh.lider_setores
  for all to authenticated
  using (rh.is_member(auth.uid()) and not rh.is_lider(auth.uid()))
  with check (rh.is_member(auth.uid()) and not rh.is_lider(auth.uid()));

-- ---------- 5) RLS: restringe as policies "_all" existentes a quem NÃO é líder ----------
-- (líder ganha policies de SELECT escopadas, separadas, abaixo)
drop policy if exists rh_colabs_all on rh.colaboradores;
create policy rh_colabs_all on rh.colaboradores
  for all to authenticated
  using (rh.is_member(auth.uid()) and not rh.is_lider(auth.uid()))
  with check (rh.is_member(auth.uid()) and not rh.is_lider(auth.uid()));

drop policy if exists rh_advertencias_all on rh.advertencias;
create policy rh_advertencias_all on rh.advertencias
  for all to authenticated
  using (rh.is_member(auth.uid()) and not rh.is_lider(auth.uid()))
  with check (rh.is_member(auth.uid()) and not rh.is_lider(auth.uid()));

drop policy if exists rh_diario_all on rh.diario;
create policy rh_diario_all on rh.diario
  for all to authenticated
  using (rh.is_member(auth.uid()) and not rh.is_lider(auth.uid()))
  with check (rh.is_member(auth.uid()) and not rh.is_lider(auth.uid()));

drop policy if exists rh_meses_all on rh.meses;
create policy rh_meses_all on rh.meses
  for all to authenticated
  using (rh.is_member(auth.uid()) and not rh.is_lider(auth.uid()))
  with check (rh.is_member(auth.uid()) and not rh.is_lider(auth.uid()));

drop policy if exists rh_setores_all on rh.setores_dados;
create policy rh_setores_all on rh.setores_dados
  for all to authenticated
  using (rh.is_member(auth.uid()) and not rh.is_lider(auth.uid()))
  with check (rh.is_member(auth.uid()) and not rh.is_lider(auth.uid()));

drop policy if exists rh_config_all on rh.config;
create policy rh_config_all on rh.config
  for all to authenticated
  using (rh.is_member(auth.uid()) and not rh.is_lider(auth.uid()))
  with check (rh.is_member(auth.uid()) and not rh.is_lider(auth.uid()));

-- ---------- 6) RLS: líder só lê (SELECT), só do(s) setor(es) dele ----------
drop policy if exists rh_colabs_lider_select on rh.colaboradores;
create policy rh_colabs_lider_select on rh.colaboradores
  for select to authenticated
  using (rh.is_lider(auth.uid()) and setor = any(rh.setores_do_lider(auth.uid())));

drop policy if exists rh_advertencias_lider_select on rh.advertencias;
create policy rh_advertencias_lider_select on rh.advertencias
  for select to authenticated
  using (
    rh.is_lider(auth.uid())
    and exists (
      select 1 from rh.colaboradores c
       where c.id = colaborador_id
         and c.setor = any(rh.setores_do_lider(auth.uid()))
    )
  );

-- config/setores_dados/meses: líder também lê (não é dado sensível por pessoa,
-- e algumas telas gerais podem precisar) — mas nunca escreve (coberto pelo item 5).
drop policy if exists rh_config_lider_select on rh.config;
create policy rh_config_lider_select on rh.config
  for select to authenticated using (rh.is_lider(auth.uid()));

-- ---------- 7) RPC: ausências do período, já filtradas pro chamador ----------
-- Devolve uma linha por (dia, setor, pessoa, motivo). Membro com acesso
-- completo recebe tudo; líder recebe só os setores dele.
create or replace function rh.diario_ausentes_periodo(_from date, _to date)
returns table (data date, setor text, nome text, motivo text)
language plpgsql stable security definer set search_path = rh, public
as $$
declare
  v_setores text[];
begin
  if not rh.is_member(auth.uid()) then
    raise exception 'Sem acesso.' using errcode = '42501';
  end if;
  if rh.is_lider(auth.uid()) then
    v_setores := rh.setores_do_lider(auth.uid());
  end if;

  return query
  select d.data, kv.key::text, (item->>'nome')::text, (item->>'motivo')::text
  from rh.diario d,
       lateral jsonb_each(coalesce(d.payload->'ausentes', '{}'::jsonb)) as kv(key, value),
       lateral jsonb_array_elements(kv.value) as item
  where d.data between _from and _to
    and (v_setores is null or kv.key = any(v_setores));
end;
$$;
revoke all on function rh.diario_ausentes_periodo(date, date) from public, anon;
grant execute on function rh.diario_ausentes_periodo(date, date) to authenticated;

-- ============================================================
-- TESTE
-- ============================================================
--   -- como membro de acesso completo, promova um usuário a líder e defina o setor:
--   insert into rh.user_roles (user_id, role) values ('<uuid-do-usuario>', 'lider') on conflict do nothing;
--   insert into rh.lider_setores (user_id, setor) values ('<uuid-do-usuario>', 'Produção');
--   select rh.setores_do_lider('<uuid-do-usuario>');
--   select * from rh.diario_ausentes_periodo('2026-09-01','2026-09-30');
