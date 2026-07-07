-- Adiciona coluna ocorrencia_grupo a seguranca.avaliacoes
-- Indica se a ocorrência excepcional foi da Liderança ou da Equipe
-- Idempotente — pode rodar múltiplas vezes.

alter table seguranca.avaliacoes
  add column if not exists ocorrencia_grupo text
  check (ocorrencia_grupo in ('lideranca', 'equipe'));
