-- ============================================================
-- Permite QUALQUER membro (leitor ou gestor) lançar medições manuais
-- (tela Cronotempo > Lançamento) diretamente em codi.cronoanalise_medicoes
-- — antes só gestor podia, mas o lançamento é feito por quem faz a
-- cronoanálise no chão de fábrica, não só gestão.
-- ============================================================

drop policy if exists cm_insert on codi.cronoanalise_medicoes;
create policy cm_insert on codi.cronoanalise_medicoes
  for insert to authenticated
  with check (codi.is_member());

grant insert on codi.cronoanalise_medicoes to authenticated;
