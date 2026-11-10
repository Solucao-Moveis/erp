-- =============================================================================
-- TV do Hora a Hora: status ao vivo do CODI + cronômetro de parada
-- -----------------------------------------------------------------------------
-- 1) fabrill.machines.codi_maquina_id: liga a máquina do Hora a Hora à do CODI
--    (os nomes não batem: "Box solda manual 1" x "BOX SOLDA 1").
-- 2) codi.maquinas_status.estado_desde: desde quando a máquina está no estado
--    atual. O coletor só atualiza "atualizado_em" a cada mensagem, então um
--    gatilho marca o início quando muda o estado ou o motivo da parada.
-- Idempotente: pode rodar de novo sem quebrar.
-- =============================================================================

-- ---------- 1) vínculo Hora a Hora -> CODI ----------
alter table fabrill.machines add column if not exists codi_maquina_id integer;

-- Solda (ids conferidos em codi.v_maquinas_grupos em 06/11/2026)
update fabrill.machines m
   set codi_maquina_id = v.codi_id
  from (values
    ('Box solda manual 1', 11),
    ('Box solda manual 2', 12),
    ('Box solda manual 3', 13),
    ('Box solda manual 4', 14),
    ('Box solda manual 5', 10),
    ('Box solda manual 6', 15),
    ('Box solda manual 7', 16),
    ('Solda Robô 1', 7),
    ('Solda Robô 2', 8),
    ('Solda Robô 3', 9)
  ) as v(nome, codi_id)
 where m.name = v.nome
   and m.area_id = (select id from fabrill.areas where name = 'Solda');

-- ---------- 2) início do estado atual ----------
alter table codi.maquinas_status add column if not exists estado_desde timestamptz default now();
update codi.maquinas_status set estado_desde = now() where estado_desde is null;

create or replace function codi.tg_maquinas_status_estado_desde()
returns trigger language plpgsql set search_path = codi, public
as $$
begin
  if tg_op = 'INSERT' then
    new.estado_desde := coalesce(new.estado_desde, now());
  elsif new.estado is distinct from old.estado
     or new.cod_parada is distinct from old.cod_parada then
    new.estado_desde := now();
  else
    new.estado_desde := old.estado_desde;
  end if;
  return new;
end $$;

drop trigger if exists trg_maquinas_status_estado_desde on codi.maquinas_status;
create trigger trg_maquinas_status_estado_desde
  before insert or update on codi.maquinas_status
  for each row execute function codi.tg_maquinas_status_estado_desde();

notify pgrst, 'reload schema';

-- Conferência: deve listar as 10 máquinas da Solda com o id do CODI
-- select m.name, m.codi_maquina_id, s.nome_parada, s.estado_desde
--   from fabrill.machines m
--   left join codi.maquinas_status s on s.maquina_id = m.codi_maquina_id
--  where m.area_id = (select id from fabrill.areas where name = 'Solda')
--  order by m.sort_order;

-- -----------------------------------------------------------------------------
-- Reversão:
--   drop trigger if exists trg_maquinas_status_estado_desde on codi.maquinas_status;
--   drop function if exists codi.tg_maquinas_status_estado_desde();
--   alter table codi.maquinas_status drop column if exists estado_desde;
--   alter table fabrill.machines drop column if exists codi_maquina_id;
--   notify pgrst, 'reload schema';
-- -----------------------------------------------------------------------------
