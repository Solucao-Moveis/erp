-- ============================================================
-- Medições brutas de cronoanálise (uma linha por medição da planilha
-- PCP, com data), pra alimentar a tela Cronotempo. Não substitui
-- codi.produto_tempos_maquina (que continua guardando só o agregado
-- usado pela view v_bom_com_nomes / tela Itens) — é dado bruto,
-- só leitura pro app, escrito unicamente pelo script de import
-- (service_role, fora do RLS).
-- ============================================================

create table if not exists codi.cronoanalise_medicoes (
  id                  bigint generated always as identity primary key,
  codigo_item         text references codi.produtos(codigo) on delete cascade,
  descricao_planilha  text,
  aba_origem          text not null,
  operacao            text not null,
  maquina_nome        text not null,
  tempo_min           numeric(10,4) not null,
  data_medicao        date,
  criado_em           timestamptz default now()
);

create index if not exists cronoanalise_codigo_idx on codi.cronoanalise_medicoes (codigo_item);
create index if not exists cronoanalise_data_idx   on codi.cronoanalise_medicoes (data_medicao);

alter table codi.cronoanalise_medicoes enable row level security;

drop policy if exists cm_select on codi.cronoanalise_medicoes;
create policy cm_select on codi.cronoanalise_medicoes
  for select to authenticated using (codi.is_member());

grant select on codi.cronoanalise_medicoes to authenticated;
-- sem policy de insert/update/delete pra "authenticated": só o import
-- (service_role, que ignora RLS) escreve nessa tabela.
