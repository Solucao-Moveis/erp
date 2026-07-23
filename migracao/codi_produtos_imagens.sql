-- ============================================================
-- Imagem de cada item pai (produto raiz do BOM), usada na tela
-- Itens/BOM. Tabela separada de codi.produtos porque essa é
-- resincronizada da API do CODI (syncProdutos()) — uma coluna
-- extra ali poderia ser sobrescrita ou complicar o upsert do sync.
-- Só leitura pro app; escrita é feita unicamente pelo script de
-- import (service_role, fora do RLS).
-- ============================================================

create table if not exists codi.produtos_imagens (
  codigo_item text primary key references codi.produtos(codigo) on delete cascade,
  url         text not null,
  atualizado_em timestamptz default now()
);

alter table codi.produtos_imagens enable row level security;

drop policy if exists pi_select on codi.produtos_imagens;
create policy pi_select on codi.produtos_imagens
  for select to authenticated using (codi.is_member());

grant select on codi.produtos_imagens to authenticated;
-- sem policy de insert/update/delete pra "authenticated": só o import
-- (service_role) escreve nessa tabela.
