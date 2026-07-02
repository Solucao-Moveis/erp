-- ============================================================
-- seguranca_seed.sql — Dados de demonstração
-- 8 setores + 24 avaliações (Abr/Mai/Jun 2026)
-- Rodar DEPOIS de seguranca_schema.sql e de ter criado um usuário
-- com papel 'admin' ou 'sesmt' para que o created_by seja preenchido.
-- Idempotente (upsert por setor+ano+mes).
-- ============================================================

-- ---------- SETORES ----------
insert into seguranca.setores (nome, lider, ativo) values
  ('Marcenaria', 'Carlos Mendes',  true),
  ('Desempeno',  'Marcos Souza',   true),
  ('Metalurgia', 'Paulo Costa',    true),
  ('Tratamento', 'Juliana Neves',  true),
  ('Solda',      'Roberto Silva',  true),
  ('Pintura',    'Ana Paula',      true),
  ('Protótipo',  'Gustavo Alves',  true),
  ('Montagem',   'Fernanda Lima',  true)
on conflict (nome) do update set lider = excluded.lider;

-- ============================================================
-- AVALIAÇÕES — Critérios usados por nota alvo
--
-- c_dds=10  c_reun=10  c_cip=5  c_pa=15  c_mel=10  c_epi=10
-- c_uso=10  c_org=5    c_trein=10  c_pdds=5  c_com=10
-- Total = 100
--
-- Nota 95: todos marcados exceto c_cip  (skip 5)
-- Nota 90: todos marcados exceto c_dds  (skip 10)
-- Nota 85: todos marcados exceto c_pa   (skip 15)
-- Nota 80: todos marcados exceto c_pa, c_cip (skip 20)
-- Nota 75: todos marcados exceto c_pa, c_dds  (skip 25)
-- Nota 70: todos marcados exceto c_pa, c_dds, c_cip (skip 30)
-- Nota 65: todos marcados exceto c_pa, c_dds, c_mel (skip 35)
-- Nota 60: todos marcados exceto c_pa, c_dds, c_mel, c_cip (skip 40)
-- Nota 55: todos marcados exceto c_pa, c_dds, c_mel, c_trein (skip 45)
-- Nota 50: todos marcados exceto c_pa, c_dds, c_mel, c_trein, c_cip (skip 50)
-- Nota 40: todos marcados exceto c_pa, c_dds, c_mel, c_trein, c_epi, c_cip (skip 60)
-- Nota  0: ocorrencia = true (zera tudo)
-- ============================================================

-- ---------- MARCENARIA: Abr=85, Mai=90, Jun=95 ----------
insert into seguranca.avaliacoes
  (setor, ano, mes, lider, ocorrencia, c_dds, c_reun, c_cip, c_pa, c_mel, c_epi, c_uso, c_org, c_trein, c_pdds, c_com)
values
  ('Marcenaria', 2026, 4, 'Carlos Mendes', false,  true,  true,  true,  false, true,  true,  true,  true,  true,  true,  true),  -- 85
  ('Marcenaria', 2026, 5, 'Carlos Mendes', false,  false, true,  true,  true,  true,  true,  true,  true,  true,  true,  true),  -- 90
  ('Marcenaria', 2026, 6, 'Carlos Mendes', false,  true,  true,  false, true,  true,  true,  true,  true,  true,  true,  true)   -- 95
on conflict (setor, ano, mes) do update set
  c_dds=excluded.c_dds, c_reun=excluded.c_reun, c_cip=excluded.c_cip,
  c_pa=excluded.c_pa, c_mel=excluded.c_mel, c_epi=excluded.c_epi,
  c_uso=excluded.c_uso, c_org=excluded.c_org, c_trein=excluded.c_trein,
  c_pdds=excluded.c_pdds, c_com=excluded.c_com, ocorrencia=excluded.ocorrencia,
  lider=excluded.lider, updated_at=now();

-- ---------- PINTURA: Abr=80, Mai=80, Jun=85 ----------
insert into seguranca.avaliacoes
  (setor, ano, mes, lider, ocorrencia, c_dds, c_reun, c_cip, c_pa, c_mel, c_epi, c_uso, c_org, c_trein, c_pdds, c_com)
values
  ('Pintura', 2026, 4, 'Ana Paula', false,  true,  true,  false, false, true,  true,  true,  true,  true,  true,  true),  -- 80
  ('Pintura', 2026, 5, 'Ana Paula', false,  true,  true,  false, false, true,  true,  true,  true,  true,  true,  true),  -- 80
  ('Pintura', 2026, 6, 'Ana Paula', false,  true,  true,  true,  false, true,  true,  true,  true,  true,  true,  true)   -- 85
on conflict (setor, ano, mes) do update set
  c_dds=excluded.c_dds, c_reun=excluded.c_reun, c_cip=excluded.c_cip,
  c_pa=excluded.c_pa, c_mel=excluded.c_mel, c_epi=excluded.c_epi,
  c_uso=excluded.c_uso, c_org=excluded.c_org, c_trein=excluded.c_trein,
  c_pdds=excluded.c_pdds, c_com=excluded.c_com, ocorrencia=excluded.ocorrencia,
  lider=excluded.lider, updated_at=now();

-- ---------- SOLDA: Abr=70, Mai=75, Jun=80 ----------
insert into seguranca.avaliacoes
  (setor, ano, mes, lider, ocorrencia, c_dds, c_reun, c_cip, c_pa, c_mel, c_epi, c_uso, c_org, c_trein, c_pdds, c_com)
values
  ('Solda', 2026, 4, 'Roberto Silva', false,  false, true,  false, false, true,  true,  true,  true,  true,  true,  true),  -- 70
  ('Solda', 2026, 5, 'Roberto Silva', false,  false, true,  true,  false, true,  true,  true,  true,  true,  true,  true),  -- 75
  ('Solda', 2026, 6, 'Roberto Silva', false,  true,  true,  false, false, true,  true,  true,  true,  true,  true,  true)   -- 80
on conflict (setor, ano, mes) do update set
  c_dds=excluded.c_dds, c_reun=excluded.c_reun, c_cip=excluded.c_cip,
  c_pa=excluded.c_pa, c_mel=excluded.c_mel, c_epi=excluded.c_epi,
  c_uso=excluded.c_uso, c_org=excluded.c_org, c_trein=excluded.c_trein,
  c_pdds=excluded.c_pdds, c_com=excluded.c_com, ocorrencia=excluded.ocorrencia,
  lider=excluded.lider, updated_at=now();

-- ---------- MONTAGEM: Abr=60, Mai=70, Jun=75 ----------
insert into seguranca.avaliacoes
  (setor, ano, mes, lider, ocorrencia, c_dds, c_reun, c_cip, c_pa, c_mel, c_epi, c_uso, c_org, c_trein, c_pdds, c_com)
values
  ('Montagem', 2026, 4, 'Fernanda Lima', false,  false, true,  false, false, false, true,  true,  true,  true,  true,  true),  -- 60
  ('Montagem', 2026, 5, 'Fernanda Lima', false,  false, true,  false, false, true,  true,  true,  true,  true,  true,  true),  -- 70
  ('Montagem', 2026, 6, 'Fernanda Lima', false,  false, true,  true,  false, true,  true,  true,  true,  true,  true,  true)   -- 75
on conflict (setor, ano, mes) do update set
  c_dds=excluded.c_dds, c_reun=excluded.c_reun, c_cip=excluded.c_cip,
  c_pa=excluded.c_pa, c_mel=excluded.c_mel, c_epi=excluded.c_epi,
  c_uso=excluded.c_uso, c_org=excluded.c_org, c_trein=excluded.c_trein,
  c_pdds=excluded.c_pdds, c_com=excluded.c_com, ocorrencia=excluded.ocorrencia,
  lider=excluded.lider, updated_at=now();

-- ---------- METALURGIA: Abr=75, Mai=70, Jun=70 ----------
insert into seguranca.avaliacoes
  (setor, ano, mes, lider, ocorrencia, c_dds, c_reun, c_cip, c_pa, c_mel, c_epi, c_uso, c_org, c_trein, c_pdds, c_com)
values
  ('Metalurgia', 2026, 4, 'Paulo Costa', false,  false, true,  true,  false, true,  true,  true,  true,  true,  true,  true),  -- 75
  ('Metalurgia', 2026, 5, 'Paulo Costa', false,  false, true,  false, false, true,  true,  true,  true,  true,  true,  true),  -- 70
  ('Metalurgia', 2026, 6, 'Paulo Costa', false,  false, true,  false, false, true,  true,  true,  true,  true,  true,  true)   -- 70
on conflict (setor, ano, mes) do update set
  c_dds=excluded.c_dds, c_reun=excluded.c_reun, c_cip=excluded.c_cip,
  c_pa=excluded.c_pa, c_mel=excluded.c_mel, c_epi=excluded.c_epi,
  c_uso=excluded.c_uso, c_org=excluded.c_org, c_trein=excluded.c_trein,
  c_pdds=excluded.c_pdds, c_com=excluded.c_com, ocorrencia=excluded.ocorrencia,
  lider=excluded.lider, updated_at=now();

-- ---------- DESEMPENO: Abr=55, Mai=60, Jun=65 (curva de melhoria) ----------
insert into seguranca.avaliacoes
  (setor, ano, mes, lider, ocorrencia, c_dds, c_reun, c_cip, c_pa, c_mel, c_epi, c_uso, c_org, c_trein, c_pdds, c_com)
values
  ('Desempeno', 2026, 4, 'Marcos Souza', false,  false, true,  true,  false, false, true,  true,  false, true,  true,  true),  -- 55
  ('Desempeno', 2026, 5, 'Marcos Souza', false,  false, true,  false, false, false, true,  true,  true,  true,  true,  true),  -- 60
  ('Desempeno', 2026, 6, 'Marcos Souza', false,  false, true,  true,  false, false, true,  true,  true,  true,  true,  true)   -- 65
on conflict (setor, ano, mes) do update set
  c_dds=excluded.c_dds, c_reun=excluded.c_reun, c_cip=excluded.c_cip,
  c_pa=excluded.c_pa, c_mel=excluded.c_mel, c_epi=excluded.c_epi,
  c_uso=excluded.c_uso, c_org=excluded.c_org, c_trein=excluded.c_trein,
  c_pdds=excluded.c_pdds, c_com=excluded.c_com, ocorrencia=excluded.ocorrencia,
  lider=excluded.lider, updated_at=now();

-- ---------- TRATAMENTO: Abr=60, Mai=55, Jun=50 (curva de piora) ----------
insert into seguranca.avaliacoes
  (setor, ano, mes, lider, ocorrencia, c_dds, c_reun, c_cip, c_pa, c_mel, c_epi, c_uso, c_org, c_trein, c_pdds, c_com)
values
  ('Tratamento', 2026, 4, 'Juliana Neves', false,  false, true,  false, false, false, true,  true,  true,  true,  true,  true),  -- 60
  ('Tratamento', 2026, 5, 'Juliana Neves', false,  false, true,  true,  false, false, true,  true,  false, true,  true,  true),  -- 55
  ('Tratamento', 2026, 6, 'Juliana Neves', false,  false, true,  false, false, false, true,  true,  false, true,  true,  true)   -- 50
on conflict (setor, ano, mes) do update set
  c_dds=excluded.c_dds, c_reun=excluded.c_reun, c_cip=excluded.c_cip,
  c_pa=excluded.c_pa, c_mel=excluded.c_mel, c_epi=excluded.c_epi,
  c_uso=excluded.c_uso, c_org=excluded.c_org, c_trein=excluded.c_trein,
  c_pdds=excluded.c_pdds, c_com=excluded.c_com, ocorrencia=excluded.ocorrencia,
  lider=excluded.lider, updated_at=now();

-- ---------- PRÓTOTIPO: Abr=70, Mai=40, Jun=ocorrência (nota 0) ----------
insert into seguranca.avaliacoes
  (setor, ano, mes, lider, ocorrencia, ocorrencia_desc, c_dds, c_reun, c_cip, c_pa, c_mel, c_epi, c_uso, c_org, c_trein, c_pdds, c_com)
values
  ('Protótipo', 2026, 4, 'Gustavo Alves', false, null,
    false, true,  false, false, true,  true,  true,  true,  true,  true,  true),  -- 70
  ('Protótipo', 2026, 5, 'Gustavo Alves', false, null,
    false, true,  false, false, false, false, true,  true,  false, true,  true),  -- 40
  ('Protótipo', 2026, 6, 'Gustavo Alves', true,
    'Acidente com afastamento — colaborador sofreu corte profundo por falta de uso de luva EPI ao manusear peça metálica.',
    false, false, false, false, false, false, false, false, false, false, false)   -- 0 (ocorrência)
on conflict (setor, ano, mes) do update set
  c_dds=excluded.c_dds, c_reun=excluded.c_reun, c_cip=excluded.c_cip,
  c_pa=excluded.c_pa, c_mel=excluded.c_mel, c_epi=excluded.c_epi,
  c_uso=excluded.c_uso, c_org=excluded.c_org, c_trein=excluded.c_trein,
  c_pdds=excluded.c_pdds, c_com=excluded.c_com,
  ocorrencia=excluded.ocorrencia, ocorrencia_desc=excluded.ocorrencia_desc,
  lider=excluded.lider, updated_at=now();

-- Verificação
select setor, mes, nota,
  case when nota >= 90 then 'Excelente'
       when nota >= 80 then 'Bom'
       when nota >= 60 then 'Atenção'
       else 'Crítico' end as classificacao
from seguranca.avaliacoes
order by mes, nota desc;
