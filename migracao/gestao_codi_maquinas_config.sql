-- ============================================================
-- Config singleton das máquinas do KPI "Máquina em operação"
-- e canal de acionamento on-demand do coletor CODI.
--
-- Fluxo:
--   1. Frontend (diretoria) chama codi_maquinas_config_set([1,4,5,6,17])
--   2. trigger_fetch vira true
--   3. Watcher na fábrica (watcher-disponibilidade.mjs) detecta no polling
--   4. Watcher seta fetching=true, roda buscar-disponibilidade-codi.mjs
--   5. Watcher seta fetching=false, last_fetched_at=now()
--   6. Frontend vê o novo valor em kpi_manual_valores
--
-- Rodar no SQL Editor do Supabase (schema gestao). Idempotente.
-- ============================================================

create table if not exists gestao.codi_maquinas_config (
  id             int primary key default 1 check (id = 1),
  recursos_ids   int[]     not null default '{1,4,5,6,17}',
  trigger_fetch  boolean   not null default false,
  fetching       boolean   not null default false,
  last_fetched_at timestamptz,
  last_error     text,
  updated_by     uuid references auth.users(id),
  updated_at     timestamptz not null default now()
);

-- Linha default
insert into gestao.codi_maquinas_config (id) values (1) on conflict do nothing;

-- RLS
alter table gestao.codi_maquinas_config enable row level security;

drop policy if exists "diretoria_rw" on gestao.codi_maquinas_config;
create policy "diretoria_rw" on gestao.codi_maquinas_config
  for all
  using (gestao.can_see('diretoria'))
  with check (gestao.can_see('diretoria'));

-- PostgREST precisa de grant explícito
grant select, update on gestao.codi_maquinas_config to authenticated;

-- RPC: atualiza config e dispara fetch imediato
create or replace function gestao.codi_maquinas_config_set(p_recursos_ids int[])
returns void
language plpgsql security definer set search_path = gestao
as $$
begin
  if not gestao.can_see('diretoria') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if cardinality(p_recursos_ids) = 0 then
    raise exception 'Selecione ao menos uma máquina' using errcode = '22023';
  end if;
  update gestao.codi_maquinas_config
  set recursos_ids  = p_recursos_ids,
      trigger_fetch = true,
      updated_by    = auth.uid(),
      updated_at    = now()
  where id = 1;
end $$;

grant execute on function gestao.codi_maquinas_config_set(int[]) to authenticated;
revoke execute on function gestao.codi_maquinas_config_set(int[]) from public, anon;

notify pgrst, 'reload schema';
