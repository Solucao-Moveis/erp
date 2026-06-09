-- ============================================================
-- frota.diario_bordo — "Parte diária de Veículos" (diário de bordo / viagens).
-- Cada linha = uma saída/viagem: DE→PARA, hora saída/chegada, KM saída/chegada.
-- km_rodados é calculado (chegada - saída). A KM de chegada atualiza o
-- odômetro do veículo (fonte oficial do hodômetro). Roda DEPOIS do frota_schema.sql.
-- Idempotente.
-- ============================================================

create table if not exists frota.diario_bordo (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references frota.veiculos(id) on delete cascade,
  motorista_id uuid references frota.motoristas(id) on delete set null,
  data date not null default current_date,
  origem text,                              -- DE
  destino text,                             -- PARA
  hora_saida time,
  hora_chegada time,
  km_saida bigint,
  km_chegada bigint,
  km_rodados bigint generated always as (km_chegada - km_saida) stored,
  observacoes text,
  registrado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_frota_diario_veiculo on frota.diario_bordo(veiculo_id);
create index if not exists idx_frota_diario_data    on frota.diario_bordo(data desc);

-- atualiza o KM atual do veículo pela KM de chegada (se for maior)
create or replace function frota.atualiza_odometro_diario()
returns trigger language plpgsql security definer set search_path = frota, public
as $$
begin
  if new.km_chegada is not null then
    update frota.veiculos
      set odometro_atual = new.km_chegada, updated_at = now()
      where id = new.veiculo_id and new.km_chegada > odometro_atual;
  end if;
  return new;
end;
$$;
revoke execute on function frota.atualiza_odometro_diario() from public, anon, authenticated;

create trigger trg_frota_diario_upd before update on frota.diario_bordo
  for each row execute function frota.set_updated_at();
create trigger trg_frota_diario_odometro after insert or update of km_chegada on frota.diario_bordo
  for each row execute function frota.atualiza_odometro_diario();

-- RLS (mesmo padrão dos lançamentos: membro lê/cria; autor ou gestor edita/apaga)
alter table frota.diario_bordo enable row level security;

drop policy if exists frota_diario_sel on frota.diario_bordo;
create policy frota_diario_sel on frota.diario_bordo for select to authenticated
  using (frota.is_member(auth.uid()));
drop policy if exists frota_diario_ins on frota.diario_bordo;
create policy frota_diario_ins on frota.diario_bordo for insert to authenticated
  with check (frota.is_member(auth.uid()));
drop policy if exists frota_diario_upd on frota.diario_bordo;
create policy frota_diario_upd on frota.diario_bordo for update to authenticated
  using (frota.is_manager(auth.uid()) or registrado_por = auth.uid())
  with check (frota.is_manager(auth.uid()) or registrado_por = auth.uid());
drop policy if exists frota_diario_del on frota.diario_bordo;
create policy frota_diario_del on frota.diario_bordo for delete to authenticated
  using (frota.is_manager(auth.uid()) or registrado_por = auth.uid());

grant select, insert, update, delete on frota.diario_bordo to authenticated;
grant all on frota.diario_bordo to service_role;

notify pgrst, 'reload schema';
