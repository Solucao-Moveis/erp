-- ============================================================================
-- Planejamento de Carga — o motorista da ROTA vira o motorista da CARGA.
--   "Quem leva a carga é o motorista da rota." Então sempre que a fatia entra/sai
--   de uma rota, ou o motorista da rota muda, o motorista da CARGA daquela fatia
--   passa a ser o motorista da rota (e some quando a fatia sai de qualquer rota).
--   Roda DEPOIS de planejamento_rota_v2.sql. Idempotente.
-- ============================================================================

create or replace function planejamento.sync_carga_motorista()
returns trigger
language plpgsql
security definer
set search_path = planejamento, public
as $$
declare
  _cargas uuid[];
begin
  -- cargas afetadas (das fatias envolvidas no evento)
  if tg_table_name = 'rota' then
    select array_agg(distinct f.carga_id) into _cargas
    from planejamento.rota_parada rp
    join planejamento.fatia f on f.id = rp.fatia_id
    where rp.rota_id = coalesce(new.id, old.id);
  else -- rota_parada
    select array_agg(distinct f.carga_id) into _cargas
    from planejamento.fatia f
    where f.id = coalesce(new.fatia_id, old.fatia_id);
  end if;

  if _cargas is null then
    return coalesce(new, old);
  end if;

  -- cada carga recebe o motorista da rota da sua fatia mais recente (ou NULL se
  -- nenhuma fatia dela está em rota).
  update planejamento.carga c
  set motorista = (
    select m.nome
    from planejamento.rota_parada rp
    join planejamento.fatia f on f.id = rp.fatia_id
    join planejamento.rota r on r.id = rp.rota_id
    left join planejamento.motorista m on m.id = r.motorista_id
    where f.carga_id = c.id
    order by rp.updated_at desc
    limit 1
  )
  where c.id = any(_cargas);

  return coalesce(new, old);
end;
$$;

-- dispara quando muda o motorista da rota
drop trigger if exists trg_rota_motorista on planejamento.rota;
create trigger trg_rota_motorista
  after update of motorista_id on planejamento.rota
  for each row execute function planejamento.sync_carga_motorista();

-- dispara quando a fatia entra/sai/muda de rota (não em mudança só de ordem)
drop trigger if exists trg_parada_motorista on planejamento.rota_parada;
create trigger trg_parada_motorista
  after insert or delete or update of rota_id on planejamento.rota_parada
  for each row execute function planejamento.sync_carga_motorista();

-- BACKFILL: sincroniza as cargas que já estão em alguma rota agora.
update planejamento.carga c
set motorista = (
  select m.nome
  from planejamento.rota_parada rp
  join planejamento.fatia f on f.id = rp.fatia_id
  join planejamento.rota r on r.id = rp.rota_id
  left join planejamento.motorista m on m.id = r.motorista_id
  where f.carga_id = c.id
  order by rp.updated_at desc
  limit 1
)
where exists (
  select 1 from planejamento.rota_parada rp
  join planejamento.fatia f on f.id = rp.fatia_id
  where f.carga_id = c.id
);
