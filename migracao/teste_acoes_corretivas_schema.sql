-- ============================================================
-- teste.acoes_corretivas — ações estruturadas por acidente (1 acidente : N ações)
-- Rodar DEPOIS de teste_schema.sql. Idempotente.
-- ============================================================

create table if not exists teste.acoes_corretivas (
  id             uuid primary key default gen_random_uuid(),
  acidente_id    uuid not null references teste.acidentes(id) on delete cascade,
  acao           text not null,
  responsavel    text,
  prazo          date,
  status         text not null default 'Pendente', -- Pendente | Em andamento | Concluída
  data_conclusao date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_teste_acoes_acidente on teste.acoes_corretivas(acidente_id);

-- ---------- RLS ----------
alter table teste.acoes_corretivas enable row level security;

create policy "Acoes select (master)" on teste.acoes_corretivas
  for select to authenticated
  using (teste.is_master(auth.uid()));

create policy "Acoes insert (master)" on teste.acoes_corretivas
  for insert to authenticated
  with check (teste.is_master(auth.uid()));

create policy "Acoes update (master)" on teste.acoes_corretivas
  for update to authenticated
  using (teste.is_master(auth.uid()))
  with check (teste.is_master(auth.uid()));

create policy "Acoes delete (master)" on teste.acoes_corretivas
  for delete to authenticated
  using (teste.is_master(auth.uid()));

-- ---------- GRANTS ----------
grant select, insert, update, delete on teste.acoes_corretivas to authenticated;
grant all on teste.acoes_corretivas to service_role;

notify pgrst, 'reload schema';

-- Teste rápido (como master):
--   select * from teste.acoes_corretivas;
