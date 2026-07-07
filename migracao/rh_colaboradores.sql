-- ═══════════════════════════════════════════════════════════════════════
-- RH — Tabela de colaboradores (efetivo)
-- Roda no SQL Editor do Supabase SMERP. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rh.colaboradores (
  id         bigint primary key generated always as identity,
  nome       text not null,
  setor      text not null,
  ativo      boolean not null default true,
  created_at timestamptz default now()
);

ALTER TABLE rh.colaboradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rh_colabs_all ON rh.colaboradores;
CREATE POLICY rh_colabs_all ON rh.colaboradores
  FOR ALL TO authenticated
  USING (rh.is_member(auth.uid()))
  WITH CHECK (rh.is_member(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON rh.colaboradores TO authenticated, service_role;
GRANT ALL ON SEQUENCE rh.colaboradores_id_seq TO authenticated, service_role;
