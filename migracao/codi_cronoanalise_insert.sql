-- ============================================================
-- Permite gestor lançar novas medições manualmente (tela Cronotempo
-- > Lançamento) diretamente em codi.cronoanalise_medicoes — até aqui
-- só o script de import (service_role) escrevia nessa tabela.
-- ============================================================

drop policy if exists cm_insert on codi.cronoanalise_medicoes;
create policy cm_insert on codi.cronoanalise_medicoes
  for insert to authenticated
  with check (codi.has_role('gestor'));

grant insert on codi.cronoanalise_medicoes to authenticated;
