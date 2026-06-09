-- ============================================================
-- SEED: frota.veiculos — frota inicial da empresa.
-- Idempotente: on conflict (placa) do nothing. Rodar DEPOIS do frota_schema.sql.
-- ============================================================

insert into frota.veiculos (placa, modelo, tipo, cor) values
  ('SHD-4C07', 'MOBI',    'carro',      'Cinza'),
  ('SHD-4C08', 'MOBI',    'carro',      'Prata'),
  ('SYA-3A89', 'SAVEIRO', 'utilitario', null),
  ('TZF-1D57', 'STRADA',  'utilitario', null),
  ('GSV-2H01', 'ÔNIBUS',  'onibus',     null),
  ('GZV-7E31', 'ÔNIBUS',  'onibus',     null),
  ('ESU-3H69', 'ÔNIBUS',  'onibus',     null)
on conflict (placa) do nothing;

-- conferência:
--   select placa, modelo, tipo, cor, odometro_atual from frota.veiculos order by tipo, placa;
