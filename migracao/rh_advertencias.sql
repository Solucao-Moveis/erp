-- ═══════════════════════════════════════════════════════════════════════
-- RH — Advertências por colaborador
-- Roda no SQL Editor do Supabase SMERP. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rh.advertencias (
  id             bigint primary key generated always as identity,
  colaborador_id bigint not null references rh.colaboradores(id) on delete cascade,
  data           date not null default current_date,
  motivo         text not null,
  observacao     text,
  created_at     timestamptz default now()
);

CREATE INDEX IF NOT EXISTS advertencias_colaborador_idx ON rh.advertencias(colaborador_id);
CREATE INDEX IF NOT EXISTS advertencias_data_idx ON rh.advertencias(data);

ALTER TABLE rh.advertencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rh_advertencias_all ON rh.advertencias;
CREATE POLICY rh_advertencias_all ON rh.advertencias
  FOR ALL TO authenticated
  USING (rh.is_member(auth.uid()))
  WITH CHECK (rh.is_member(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON rh.advertencias TO authenticated, service_role;
GRANT ALL ON SEQUENCE rh.advertencias_id_seq TO authenticated, service_role;
