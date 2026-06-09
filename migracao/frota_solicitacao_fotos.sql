-- ============================================================
-- frota.solicitacao_fotos — fotos anexadas à solicitação (foto do problema).
-- Roda DEPOIS do frota_schema.sql. Reaproveita o bucket privado 'frota-fotos'.
-- Idempotente.
-- ============================================================

create table if not exists frota.solicitacao_fotos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references frota.solicitacoes(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_frota_solfotos_solic on frota.solicitacao_fotos(solicitacao_id);

alter table frota.solicitacao_fotos enable row level security;

drop policy if exists frota_solfotos_sel on frota.solicitacao_fotos;
create policy frota_solfotos_sel on frota.solicitacao_fotos for select to authenticated
  using (frota.is_member(auth.uid()));
drop policy if exists frota_solfotos_ins on frota.solicitacao_fotos;
create policy frota_solfotos_ins on frota.solicitacao_fotos for insert to authenticated
  with check (frota.is_member(auth.uid()) and auth.uid() = uploaded_by);
drop policy if exists frota_solfotos_del on frota.solicitacao_fotos;
create policy frota_solfotos_del on frota.solicitacao_fotos for delete to authenticated
  using (auth.uid() = uploaded_by or frota.is_manager(auth.uid()));

grant select, insert, update, delete on frota.solicitacao_fotos to authenticated;
grant all on frota.solicitacao_fotos to service_role;

notify pgrst, 'reload schema';
