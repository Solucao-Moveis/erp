-- ============================================================
-- MANUTENÇÃO — Arquivar ferramentas/equipamentos (soft delete)
-- ------------------------------------------------------------
-- Pedido do gestor: tirar do sistema de Manutenção todas as
-- parafusadeiras, rebitadeiras, esmerilhadeiras e máquinas de solda.
--
-- Abordagem: ARQUIVAR (não apagar). Adiciona a coluna `ativo` em
-- manutencao.maquinas e marca esses 49 equipamentos como ativo=false.
-- Nada é deletado: OS, preventivas, documentos e indicadores ficam intactos.
-- Reversível (basta voltar ativo=true).
--
-- Rodar no SQL Editor do Supabase SMERP. Idempotente.
-- A trava aborta a transação se o total casado for diferente de 49.
-- ============================================================

-- 1) Coluna de arquivamento (default true = todas as demais seguem ativas)
alter table manutencao.maquinas
  add column if not exists ativo boolean not null default true;

-- 2) Arquiva exatamente os 49 equipamentos pedidos, por código (chave única).
--    16 parafusadeiras + 18 rebitadeiras + 5 esmerilhadeiras + 10 máquinas de solda.
do $$
declare n int;
begin
  update manutencao.maquinas set ativo = false
  where codigo in (
    -- Máquinas de solda 1–10 (setores Solda e Protótipo)
    '19','20','21','22','23','24','25','38','39','40',
    -- Parafusadeiras (Montagem)
    '41','74','75','76','77','78','79','80','81','82','83','84','85','86','87','88',
    -- Esmerilhadeiras (Inspeção e Protótipo)
    '42','70','71','73','106',
    -- Rebitadeiras (Montagem)
    '89','90','91','92','93','94','95','96','97','98','99','100','101','102','103','104','105','108'
  );
  get diagnostics n = row_count;
  if n <> 49 then
    raise exception 'Esperado arquivar 49 maquinas, mas casou % — nada foi alterado. Confira a lista de codigos.', n;
  end if;
  raise notice 'OK: % maquinas arquivadas (ativo=false).', n;
end $$;

-- 3) PostgREST precisa reconhecer a nova coluna para aceitar filtro ativo=eq.true
notify pgrst, 'reload schema';

-- 4) Conferência — deve listar as 49 arquivadas
select codigo, nome, status, ativo
from manutencao.maquinas
where ativo = false
order by (codigo)::int;
