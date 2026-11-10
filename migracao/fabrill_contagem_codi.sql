-- =============================================================================
-- Hora a Hora: lançamento automático pela contagem do CODI (Metalurgia)
-- -----------------------------------------------------------------------------
-- O processo codi-coletor/contagem-metalurgia.mjs (PM2 "codi-contagem") lança
-- as horas com origem 'codi' pela função fabrill.codi_lancar_horas (só
-- service_role). Regras:
--   - hora 'codi' é atualizada pelo processo a cada minuto;
--   - quando o líder salva um número diferente do CODI, a hora vira 'manual'
--     e o processo NUNCA mais muda a quantidade dela (só guarda qtd_codi
--     pra comparar). Se o líder salvar o mesmo número do CODI, volta a 'codi';
--   - hora negativa (estorno no CODI) só é aceita em hora 'codi'.
-- Rodar ANTES de reiniciar o processo. Idempotente.
-- =============================================================================

-- ---------- 1) colunas ----------
alter table fabrill.production_entries add column if not exists origem text not null default 'manual';
alter table fabrill.production_entries add column if not exists qtd_codi integer;

alter table fabrill.production_entries drop constraint if exists production_entries_origem_check;
alter table fabrill.production_entries add constraint production_entries_origem_check
  check (origem in ('codi', 'manual'));

-- Negativo só quando vem do CODI (estorno); lançamento do líder continua >= 0
alter table fabrill.production_entries drop constraint if exists production_entries_quantity_check;
alter table fabrill.production_entries drop constraint if exists production_entries_quantity_origem_check;
alter table fabrill.production_entries add constraint production_entries_quantity_origem_check
  check (quantity >= 0 or origem = 'codi');

-- ---------- 2) quem grava pela tela vira 'manual' ----------
create or replace function fabrill.tg_entries_origem()
returns trigger language plpgsql set search_path = fabrill, public
as $$
begin
  -- auth.uid() só existe quando é um usuário logado (líder/PCP pela tela).
  -- O processo do CODI grava como service_role (sem usuário) e passa direto.
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.qtd_codi := null;
    else
      new.qtd_codi := old.qtd_codi;  -- usuário não altera o número do CODI
    end if;
    new.origem := case
      when new.qtd_codi is not null and new.quantity = new.qtd_codi then 'codi'
      else 'manual'
    end;
  end if;
  return new;
end $$;

drop trigger if exists trg_entries_origem on fabrill.production_entries;
create trigger trg_entries_origem
  before insert or update on fabrill.production_entries
  for each row execute function fabrill.tg_entries_origem();

-- ---------- 3) lançamento do processo ----------
-- p_linhas: [{ machine_id, entry_date, hour_slot, quantity }, ...]
create or replace function fabrill.codi_lancar_horas(p_linhas jsonb)
returns integer language plpgsql security definer set search_path = fabrill, public
as $$
declare n integer;
begin
  with src as (
    select (x->>'machine_id')::uuid      as machine_id,
           (x->>'entry_date')::date      as entry_date,
           (x->>'hour_slot')::smallint   as hour_slot,
           (x->>'quantity')::integer     as quantity
      from jsonb_array_elements(p_linhas) x
  ), up as (
    insert into fabrill.production_entries as e
           (machine_id, entry_date, hour_slot, quantity, qtd_codi, origem, updated_at)
    select machine_id, entry_date, hour_slot, quantity, quantity, 'codi', now() from src
    on conflict (machine_id, entry_date, hour_slot) do update
       set qtd_codi   = excluded.qtd_codi,
           quantity   = case when e.origem = 'codi' then excluded.quantity else e.quantity end,
           updated_at = case when e.origem = 'codi' then now() else e.updated_at end
    returning 1
  )
  select count(*) into n from up;
  return n;
end $$;

revoke all on function fabrill.codi_lancar_horas(jsonb) from public, anon, authenticated;
grant execute on function fabrill.codi_lancar_horas(jsonb) to service_role;

-- ---------- 4) hoje da Metalurgia passa a seguir o CODI ----------
-- (pedido do usuário em 10/11/2026: ajustar o que já foi lançado hoje)
update fabrill.production_entries e
   set origem = 'codi'
  from fabrill.machines m
 where m.id = e.machine_id
   and m.codi_maquina_id is not null
   and m.area_id = (select id from fabrill.areas where name = 'Metalurgia')
   and e.entry_date = (now() at time zone 'America/Sao_Paulo')::date
   and e.origem <> 'codi';

notify pgrst, 'reload schema';

-- Conferência (1 a 2 min depois de reiniciar o processo):
-- select m.name, e.hour_slot, e.quantity, e.qtd_codi, e.origem
--   from fabrill.production_entries e join fabrill.machines m on m.id = e.machine_id
--  where m.area_id = (select id from fabrill.areas where name = 'Metalurgia')
--    and e.entry_date = (now() at time zone 'America/Sao_Paulo')::date
--  order by m.sort_order, e.hour_slot;

-- Reversão:
--   drop trigger if exists trg_entries_origem on fabrill.production_entries;
--   drop function if exists fabrill.tg_entries_origem();
--   drop function if exists fabrill.codi_lancar_horas(jsonb);
--   update fabrill.production_entries set quantity = 0 where quantity < 0;
--   alter table fabrill.production_entries drop constraint if exists production_entries_quantity_origem_check;
--   alter table fabrill.production_entries add constraint production_entries_quantity_check check (quantity >= 0);
--   alter table fabrill.production_entries drop constraint if exists production_entries_origem_check;
--   alter table fabrill.production_entries drop column if exists qtd_codi;
--   alter table fabrill.production_entries drop column if exists origem;
--   notify pgrst, 'reload schema';
