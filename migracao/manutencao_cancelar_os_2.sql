-- Manutenção: status "cancelada" pra OS aberta por engano.
-- PASSO 2 de 2 — só rode depois que o PASSO 1 (manutencao_cancelar_os.sql)
-- já tiver rodado com sucesso (em outra execução, já commitada).
--
-- Diferente de "fechada": fica salva pro histórico, mas NÃO entra em
-- nenhum indicador (MTTR/MTBF/disponibilidade) nem conta como chamado
-- aberto da máquina. Só admin pode cancelar (RLS + botão no front).

-- só admin pode setar status='cancelada' (manutencao continua podendo
-- editar/fechar normalmente, só não pode cancelar).
drop policy if exists "os_update" on manutencao.ordens_servico;
create policy "os_update" on manutencao.ordens_servico for update to authenticated
  using (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'))
  with check (
    manutencao.has_role(auth.uid(),'admin')
    or (manutencao.has_role(auth.uid(),'manutencao') and status <> 'cancelada')
  );

-- cancelada conta como "resolvida" pra status da máquina, igual fechada.
create or replace function manutencao.sync_maquina_status()
returns trigger language plpgsql security definer set search_path = manutencao, public
as $$
declare
  mid uuid;
  has_parada boolean;
  has_aberta boolean;
begin
  mid := coalesce(new.maquina_id, old.maquina_id);
  if mid is null then return new; end if;

  select exists(select 1 from manutencao.ordens_servico where maquina_id = mid and status not in ('fechada','cancelada') and maquina_parada = true) into has_parada;
  select exists(select 1 from manutencao.ordens_servico where maquina_id = mid and status not in ('fechada','cancelada')) into has_aberta;

  update manutencao.maquinas
  set status = case
    when has_parada then 'parada'::manutencao.maquina_status
    when has_aberta then 'chamado_aberto'::manutencao.maquina_status
    else 'ok'::manutencao.maquina_status
  end
  where id = mid;

  return new;
end;
$$;
