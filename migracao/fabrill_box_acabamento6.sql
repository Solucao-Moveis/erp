-- ============================================================
-- Hora a Hora (schema fabrill) — adiciona "Box acabamento 6"
-- ao setor INSPEÇÃO.
--
-- Por que só isto basta: todas as telas do app (grade hora-a-hora,
-- Metas, Relatórios e a visualização por link/token) leem a tabela
-- fabrill.machines dinamicamente. Não há lista fixa no código — então
-- esta única linha faz o box aparecer em TODOS os lugares.
--
-- Idempotente: pode rodar de novo sem duplicar (guarda not exists).
-- Rode no SQL Editor do Supabase (SMERP). Surte efeito na hora.
-- ============================================================

insert into fabrill.machines (area_id, name, sort_order)
select a.id, 'Box acabamento 6', 6
from fabrill.areas a
where a.slug = 'inspecao'
  and not exists (
    select 1
    from fabrill.machines m
    where m.area_id = a.id
      and m.name = 'Box acabamento 6'
  );

-- Conferência: deve listar os 6 boxes da Inspeção em ordem.
select m.name, m.sort_order
from fabrill.machines m
join fabrill.areas a on a.id = m.area_id
where a.slug = 'inspecao'
order by m.sort_order;
