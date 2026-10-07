-- ============================================================
-- MANUTENÇÃO — Metas por setor (aba "Por Setor" dos Indicadores)
-- ------------------------------------------------------------
-- Overrides por setor das mesmas metas de manutencao.dashboard_config.
-- Setor sem linha aqui cai no valor global (dashboard_config / default
-- hardcoded no front). Edição pela própria tela de Indicadores, aba
-- "Por Setor".
--
-- Rodar no SQL Editor do Supabase SMERP. Idempotente.
-- ============================================================

create table if not exists manutencao.dashboard_config_setor (
  setor_id uuid not null references manutencao.setores(id) on delete cascade,
  chave text not null,
  valor numeric not null,
  updated_at timestamptz not null default now(),
  primary key (setor_id, chave)
);

drop trigger if exists trg_dashboard_config_setor_updated on manutencao.dashboard_config_setor;
create trigger trg_dashboard_config_setor_updated before update on manutencao.dashboard_config_setor
  for each row execute function manutencao.update_updated_at();

alter table manutencao.dashboard_config_setor enable row level security;

drop policy if exists "dashboard_config_setor_read" on manutencao.dashboard_config_setor;
create policy "dashboard_config_setor_read" on manutencao.dashboard_config_setor for select to authenticated using (true);

drop policy if exists "dashboard_config_setor_write" on manutencao.dashboard_config_setor;
create policy "dashboard_config_setor_write" on manutencao.dashboard_config_setor for all to authenticated
  using (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'))
  with check (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'));

notify pgrst, 'reload schema';
