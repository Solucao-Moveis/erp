-- ============================================================
-- MANUTENÇÃO — Metas dos KPIs do Dashboard, editáveis pela UI
-- ------------------------------------------------------------
-- Tabela chave/valor simples. Seed com os mesmos placeholders que
-- já estavam hardcoded no front (pendentes de validação com o time,
-- ver mensagem de WhatsApp) — agora dá pra ajustar direto na tela,
-- sem precisar de deploy.
--
-- Rodar no SQL Editor do Supabase SMERP. Idempotente.
-- ============================================================

create table if not exists manutencao.dashboard_config (
  chave text primary key,
  valor numeric not null,
  updated_at timestamptz not null default now()
);

insert into manutencao.dashboard_config (chave, valor) values
  ('meta_disponibilidade_pct', 98),
  ('meta_mttr_tecnico_h', 2.5),
  ('meta_mttr_total_h', 48),
  ('meta_mtbf_h', 300),
  ('meta_backlog_max', 20)
on conflict (chave) do nothing;

drop trigger if exists trg_dashboard_config_updated on manutencao.dashboard_config;
create trigger trg_dashboard_config_updated before update on manutencao.dashboard_config
  for each row execute function manutencao.update_updated_at();

alter table manutencao.dashboard_config enable row level security;

drop policy if exists "dashboard_config_read" on manutencao.dashboard_config;
create policy "dashboard_config_read" on manutencao.dashboard_config for select to authenticated using (true);

drop policy if exists "dashboard_config_write" on manutencao.dashboard_config;
create policy "dashboard_config_write" on manutencao.dashboard_config for all to authenticated
  using (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'))
  with check (manutencao.has_role(auth.uid(),'admin') or manutencao.has_role(auth.uid(),'manutencao'));

notify pgrst, 'reload schema';
