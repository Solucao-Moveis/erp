-- ============================================================
-- VÍNCULO  Assistência (RNC)  <->  Desvio de Produção (Hora a Hora)
-- ------------------------------------------------------------
-- Liga uma assistência do módulo Engenharia a um desvio de produção
-- registrado no app Hora a Hora (fabrill.production_deviations), de forma
-- MÚTUA: na assistência aparece o desvio ligado; no desvio aparecem as
-- assistências ligadas.
--
-- Como os dois lados podem ser usados por pessoas que não têm acesso ao
-- outro app, as duas leituras cross-schema são via SECURITY DEFINER.
--
-- Idempotente. Rodar no SQL Editor do Supabase SMERP, DEPOIS de
-- engenharia_schema.sql (e com o app fabrill já existente).
-- ============================================================

-- 1) coluna de vínculo na assistência (+ rótulo denormalizado p/ exibir rápido)
alter table engenharia.assistencias
  add column if not exists desvio_id  uuid,
  add column if not exists desvio_ref text;   -- ex.: "12/06/2026 · AB-1234 · Montagem"

create index if not exists idx_eng_assist_desvio on engenharia.assistencias (desvio_id);

-- 2) LISTAR desvios p/ o seletor da Engenharia (busca por data/item/setor).
--    Definer: lê fabrill mesmo se a pessoa só tem acesso à Engenharia.
create or replace function engenharia.listar_desvios(
  _de date default null, _ate date default null, _busca text default null
)
returns table (
  id uuid, data date, hora text, item_code text, area text, machine text, desvio text
)
language sql stable security definer set search_path = engenharia, fabrill, public
as $$
  select d.id, d.deviation_date,
         to_char(d.deviation_time, 'HH24:MI'),
         d.item_code,
         coalesce(a.name, '—'),
         coalesce(m.name, '—'),
         d.deviation
    from fabrill.production_deviations d
    left join fabrill.areas    a on a.id = d.area_id
    left join fabrill.machines m on m.id = d.machine_id
   where engenharia.is_member()
     and (_de  is null or d.deviation_date >= _de)
     and (_ate is null or d.deviation_date <= _ate)
     and (
       _busca is null or btrim(_busca) = ''
       or d.item_code   ilike '%' || _busca || '%'
       or d.deviation   ilike '%' || _busca || '%'
       or coalesce(a.name, '') ilike '%' || _busca || '%'
     )
   order by d.deviation_date desc, d.deviation_time desc
   limit 100;
$$;
revoke all on function engenharia.listar_desvios(date, date, text) from public, anon;
grant execute on function engenharia.listar_desvios(date, date, text) to authenticated;

-- 3) ASSISTÊNCIAS de um desvio — usado pelo Hora a Hora p/ mostrar o vínculo.
--    Fica no schema 'fabrill' p/ o app chamar direto supabase.rpc('assistencias_do_desvio').
--    Definer: lê engenharia mesmo se a pessoa só tem acesso ao Hora a Hora.
create or replace function fabrill.assistencias_do_desvio(_desvio_id uuid)
returns table (id uuid, numero text, data date, cliente text, fornecedor text)
language sql stable security definer set search_path = fabrill, engenharia, public
as $$
  select a.id, a.numero, a.data, a.cliente, a.fornecedor
    from engenharia.assistencias a
   where a.desvio_id = _desvio_id
   order by a.data desc, a.created_at desc;
$$;
revoke all on function fabrill.assistencias_do_desvio(uuid) from public, anon;
grant execute on function fabrill.assistencias_do_desvio(uuid) to authenticated;

-- ============================================================
-- TESTE
-- ============================================================
--   select * from engenharia.listar_desvios(null, null, 'AB');
--   update engenharia.assistencias set desvio_id = '<id>', desvio_ref = '12/06/2026 · AB · Montagem'
--     where numero = 'RNC-00001/2026';
--   select * from fabrill.assistencias_do_desvio('<id>');
