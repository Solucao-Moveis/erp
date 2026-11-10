-- =============================================================================
-- TV do Hora a Hora: liga as máquinas da Metalurgia ao CODI
-- -----------------------------------------------------------------------------
-- Mesmo vínculo feito pra Solda em fabrill_tv_status_codi.sql (rodar aquele
-- antes: ele cria a coluna codi_maquina_id e o cronômetro de parada).
-- "EMT furo" fica sem vínculo: no CODI só existe a DOBRADEIRA EMT (id 6).
-- Ids conferidos em codi.v_maquinas_grupos em 10/11/2026.
-- Idempotente: pode rodar de novo sem quebrar.
-- =============================================================================

update fabrill.machines m
   set codi_maquina_id = v.codi_id
  from (values
    ('Máquina a laser K6 151', 1),
    ('Máquina a laser K6 152', 2),
    ('Máquina a laser Viterbo', 3),
    ('OMP', 17),
    ('BLM', 4),
    ('Robótica', 5),
    ('EMT dobra', 6)
  ) as v(nome, codi_id)
 where m.name = v.nome
   and m.area_id = (select id from fabrill.areas where name = 'Metalurgia');

-- Conferência: 7 máquinas com id do CODI, EMT furo vazio
-- select m.name, m.codi_maquina_id, s.nome_parada, s.estado_desde
--   from fabrill.machines m
--   left join codi.maquinas_status s on s.maquina_id = m.codi_maquina_id
--  where m.area_id = (select id from fabrill.areas where name = 'Metalurgia')
--  order by m.sort_order;

-- Reversão:
--   update fabrill.machines set codi_maquina_id = null
--    where area_id = (select id from fabrill.areas where name = 'Metalurgia');
