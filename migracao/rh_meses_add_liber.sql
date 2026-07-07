-- ═══════════════════════════════════════════════════════════════════════
-- RH — Adiciona coluna liber (dias de Liberação) em rh.meses
-- Roda no SQL Editor do Supabase SMERP. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE rh.meses
  ADD COLUMN IF NOT EXISTS liber numeric NOT NULL DEFAULT 0;
