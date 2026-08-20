-- ============================================================
-- schema teste — Acidentes e Afastamentos (módulo "TESTE", nome provisório)
-- App: teste-solucao | Acesso: só master (por enquanto)
-- Rodar no SQL Editor do Supabase SMERP. Idempotente.
-- Fonte dos dados/campos: docs/planilha-acidentes-afastamentos-manual.md (repo erp)
-- ============================================================

-- ---------- SCHEMA ----------
create schema if not exists teste;

-- ---------- ACIDENTES ----------
-- Espelha a aba "Base_de_Dados" da planilha. Ano/Mês NÃO são colunas (eram
-- fórmulas em cima de "data" no Excel) — derivar com extract()/to_char() nas
-- consultas em vez de guardar duplicado.
create table if not exists teste.acidentes (
  id                 uuid primary key default gen_random_uuid(),
  numero             integer generated always as identity,
  data               date not null,
  turno              text,                    -- 1º / 2º / 3º
  colaborador        text not null,
  sexo               text check (sexo in ('M','F')),
  idade              integer,
  tipo_colaborador   text default 'PRÓPRIO',  -- PRÓPRIO / TERCEIRO
  diretoria          text default 'Solução',
  setor              text,                    -- "Gerência" no Excel (Metalurgia, Montagem, Solda...)
  coordenacao        text,
  admissao           date,
  tempo_empresa      text,
  horas_trabalho     text,
  tempo_funcao       text,
  dias_afastamento   integer,
  tipo_acidente      text,                    -- TÍPICO / TRAJETO / TERCEIRO
  sub_tipo           text,                    -- Com afastamento / Sem afastamento / Incidente / Doença Ocupacional...
  detalhe_lesao      text,
  causa              text,
  parte_corpo        text,
  status_analise     text default 'Concluído',
  descricao_acao     text,
  responsavel_sst    text,
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_teste_acidentes_data  on teste.acidentes(data);
create index if not exists idx_teste_acidentes_setor on teste.acidentes(setor);

-- ---------- FUNÇÃO AUXILIAR (security definer) ----------
-- Acesso restrito a master, por enquanto (módulo em teste). Trocar para um
-- esquema de papéis (admin/sesmt/leitor, como em `seguranca`) quando o
-- módulo sair de TESTE e mais gente precisar acessar.
create or replace function teste.is_master(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where id = _user_id and lower(email) = 'master@solucaomoveis.ind.br'
  )
$$;

-- ---------- RLS ----------
alter table teste.acidentes enable row level security;

create policy "Acidentes select (master)" on teste.acidentes
  for select to authenticated
  using (teste.is_master(auth.uid()));

create policy "Acidentes insert (master)" on teste.acidentes
  for insert to authenticated
  with check (teste.is_master(auth.uid()));

create policy "Acidentes update (master)" on teste.acidentes
  for update to authenticated
  using (teste.is_master(auth.uid()))
  with check (teste.is_master(auth.uid()));

create policy "Acidentes delete (master)" on teste.acidentes
  for delete to authenticated
  using (teste.is_master(auth.uid()));

-- ---------- GRANTS ----------
grant usage on schema teste to authenticated, service_role;
grant select, insert, update, delete on all tables in schema teste to authenticated;
grant all on all tables in schema teste to service_role;
grant all on all sequences in schema teste to authenticated, service_role;
grant execute on function teste.is_master(uuid) to authenticated;

-- ---------- RECARREGA PostgREST ----------
-- Lembrete: adicionar 'teste' em PGRST_DB_SCHEMAS no EasyPanel do Supabase antes de rodar.
notify pgrst, 'reload schema';

-- Teste rápido (rodar como master):
--   select teste.is_master(auth.uid());
--   select * from teste.acidentes order by data;
