-- ============================================================
-- Lançamento manual de progresso em OFs de Lotes.
--
-- Problema: sinc-lotes.mjs faz upsert cego em codi.of_por_lote (sobrescreve
-- status/quantidade_produzida sempre, sem condição), então uma correção
-- manual seria apagada na próxima rodada de sincronização. `travado_sync`
-- marca a OF pra ser ignorada pelo script até alguém "reconectar".
-- ============================================================

alter table codi.of_por_lote
  add column if not exists travado_sync boolean not null default false;

-- Qualquer membro (não só gestor) pode marcar/desmarcar — mesmo padrão já
-- usado pro lançamento manual de cronoanálise (codi.cronoanalise_medicoes).
drop policy if exists of_lote_update on codi.of_por_lote;
create policy of_lote_update on codi.of_por_lote
  for update to authenticated using (codi.is_member()) with check (codi.is_member());

grant update on codi.of_por_lote to authenticated;

-- ---------- Auditoria (quem lançou manual / quem reconectou) ----------

create table if not exists codi.of_lote_auditoria (
  id           uuid primary key default gen_random_uuid(),
  ordem        int references codi.of_por_lote(ordem) on delete cascade,
  lote         text not null,
  acao         text not null check (acao in ('concluido_manual', 'reconectado')),
  usuario_id   uuid,
  usuario_email text,
  criado_em    timestamptz not null default now()
);

create index if not exists of_lote_auditoria_lote_idx on codi.of_lote_auditoria (lote, criado_em desc);

alter table codi.of_lote_auditoria enable row level security;

drop policy if exists of_lote_auditoria_select on codi.of_lote_auditoria;
create policy of_lote_auditoria_select on codi.of_lote_auditoria
  for select to authenticated using (codi.is_member());

drop policy if exists of_lote_auditoria_insert on codi.of_lote_auditoria;
create policy of_lote_auditoria_insert on codi.of_lote_auditoria
  for insert to authenticated with check (codi.is_member());

grant select, insert on codi.of_lote_auditoria to authenticated;
