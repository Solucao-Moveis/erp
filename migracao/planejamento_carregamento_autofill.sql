-- ============================================================================
-- Planejamento de Carga — "saiu = carregou": Carregamento preenchido pela saída
--   Regra de negócio: sempre que a carga tem SAÍDA REAL e a data de CARREGAR
--   está vazia, preenche a data de carregar com a data da saída.
--   (Respeita uma data de carregar JÁ existente — só preenche quando está vazia.)
--
--   Por que no banco (e não só no front): garante a regra independente da tela
--   ou do caminho (Grade, cartão, import, edição em massa) e corrige de uma vez
--   as cargas que já saíram sem carregamento preenchido.
--   Idempotente — pode rodar de novo sem problema.
-- ============================================================================

-- 1) BACKFILL — conserta as cargas que JÁ saíram e estão sem data de carregar
update planejamento.carga
set    data_carregar = saida_real
where  saida_real is not null
  and  data_carregar is null;

-- 2) GATILHO — daqui pra frente, preenche sozinho em qualquer insert/update
create or replace function planejamento.carga_fill_carregar()
returns trigger
language plpgsql
set search_path = planejamento, public
as $$
begin
  if new.saida_real is not null and new.data_carregar is null then
    new.data_carregar := new.saida_real;
  end if;
  return new;
end
$$;

drop trigger if exists trg_carga_fill_carregar on planejamento.carga;
create trigger trg_carga_fill_carregar
  before insert or update on planejamento.carga
  for each row execute function planejamento.carga_fill_carregar();
