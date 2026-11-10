-- =============================================================================
-- Hora a Hora: contagem automática do CODI ligada POR MÁQUINA (+ Solda)
-- -----------------------------------------------------------------------------
-- fabrill.machines.codi_contagem_desde: a partir de que dia o processo
-- codi-contagem lança essa máquina sozinho. null = máquina manual.
-- Rodar depois de fabrill_contagem_codi.sql. Idempotente.
--
-- Solda (pedido em 10/11/2026): Box solda manual 1 a 7 e Solda Robô 3.
-- Robôs 1 e 2 continuam manuais.
-- =============================================================================

alter table fabrill.machines add column if not exists codi_contagem_desde date;

-- Metalurgia: já automática desde 10/11/2026 (EMT furo não está no CODI)
update fabrill.machines
   set codi_contagem_desde = '2026-11-10'
 where area_id = (select id from fabrill.areas where name = 'Metalurgia')
   and codi_maquina_id is not null
   and codi_contagem_desde is null;

-- Solda: começa hoje
update fabrill.machines
   set codi_contagem_desde = (now() at time zone 'America/Sao_Paulo')::date
 where area_id = (select id from fabrill.areas where name = 'Solda')
   and codi_maquina_id is not null
   and name in ('Box solda manual 1', 'Box solda manual 2', 'Box solda manual 3',
                'Box solda manual 4', 'Box solda manual 5', 'Box solda manual 6',
                'Box solda manual 7', 'Solda Robô 3')
   and codi_contagem_desde is null;

-- O que já foi lançado hoje nessas máquinas da Solda passa a seguir o CODI
update fabrill.production_entries e
   set origem = 'codi'
  from fabrill.machines m
 where m.id = e.machine_id
   and m.area_id = (select id from fabrill.areas where name = 'Solda')
   and m.codi_contagem_desde = (now() at time zone 'America/Sao_Paulo')::date
   and e.entry_date = (now() at time zone 'America/Sao_Paulo')::date
   and e.origem <> 'codi';

notify pgrst, 'reload schema';

-- Conferência: quais máquinas estão no automático
-- select a.name setor, m.name, m.codi_maquina_id, m.codi_contagem_desde
--   from fabrill.machines m join fabrill.areas a on a.id = m.area_id
--  where m.codi_contagem_desde is not null order by a.name, m.sort_order;

-- Desligar uma máquina (volta a ser manual dali pra frente):
--   update fabrill.machines set codi_contagem_desde = null where name = '...';

-- Reversão:
--   alter table fabrill.machines drop column if exists codi_contagem_desde;
--   notify pgrst, 'reload schema';
