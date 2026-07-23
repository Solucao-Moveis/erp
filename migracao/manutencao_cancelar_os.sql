-- Manutenção: status "cancelada" pra OS aberta por engano.
-- PASSO 1 de 2 — rode isso sozinho e clique em Run.
-- (o Postgres não deixa criar um valor de enum e já usar ele na mesma
-- transação; por isso o passo 2 está num arquivo separado)

do $$ begin
  alter type manutencao.os_status add value if not exists 'cancelada';
exception when duplicate_object then null; end $$;
