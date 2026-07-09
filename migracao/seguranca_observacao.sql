-- Adiciona coluna observacao a seguranca.avaliacoes
-- Campo de anotação geral da avaliação (separado de ocorrencia_desc, que é específico de acidentes)
-- Idempotente — pode rodar múltiplas vezes.

alter table seguranca.avaliacoes
  add column if not exists observacao text;

notify pgrst, 'reload schema';
