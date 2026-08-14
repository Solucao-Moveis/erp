-- ============================================================
-- VISÃO GERAL — tabelas de suporte (metas + valores manuais)
-- ------------------------------------------------------------
-- Nova aba "Visão Geral" do Gerencial (schema gestao): scorecard de
-- 12 indicadores cross-módulo (Faturamento, OTIF, Caminhões, Leadtime
-- do Pedido, Aderência ao PCP, NC Injetado, Disponibilidade de máquina,
-- MTTR, MTBF, Máquina em operação, Assistência, Taxa de perda no corte).
--
-- 7 são automáticos (RPCs em gestao_visao_geral_rpcs.sql, rodar DEPOIS
-- deste arquivo). 5 não têm fonte de dado no ERP hoje (Faturamento, NC
-- Injetado, Taxa de perda no corte, Assistência, Aderência ao PCP) —
-- pessoa autorizada digita o valor por período (tabela kpi_manual_valores).
--
-- Só diretoria (gestao.can_see('diretoria')) vê a página cheia e edita
-- metas. Valores manuais: diretoria sempre pode; outros usuários só se
-- estiverem em kpi_manual_editores pra aquela chave específica (os
-- escopos hoje existentes — compras/producao/expedicao — não mapeiam
-- 1:1 pras 5 chaves manuais, por isso uma ACL própria em vez de reusar
-- gestao.user_scopes).
--
-- Rodar no SQL Editor do Supabase SMERP, DEPOIS de gestao_schema.sql.
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- HOUSEKEEPING: manutencao.maquinas.manual
-- A RPC gestao.kpi_manutencao (no arquivo de RPCs) depende dessa coluna,
-- que já é usada pelo app Pro-Care (dashboard.tsx, indicadores.tsx) mas
-- não está em NENHUMA migration versionada em erp/migracao — foi
-- aplicada direto no banco em algum momento. Este ALTER é defensivo e
-- idempotente: se a coluna já existir (com esse nome/tipo), não faz nada.
-- ------------------------------------------------------------
alter table manutencao.maquinas add column if not exists manual boolean not null default false;

-- ============================================================
-- TABELAS
-- ============================================================

-- Meta de cada indicador (as 12 chaves). tipo define se "maior é melhor"
-- (ex. OTIF, Disponibilidade) ou "menor é melhor" (ex. MTTR, NC Injetado).
create table if not exists gestao.kpi_metas (
  chave      text primary key,
  meta       numeric,
  tipo       text not null check (tipo in ('maior_melhor','menor_melhor')),
  updated_at timestamptz not null default now()
);

-- 1 linha por indicador manual × período EXATO em que foi digitado
-- (mesmo par de datas que o filtro de período estava mostrando).
create table if not exists gestao.kpi_manual_valores (
  id              uuid primary key default gen_random_uuid(),
  chave           text not null,
  periodo_inicio  date not null,
  periodo_fim     date not null,
  valor           numeric not null,
  updated_by      uuid references auth.users(id),
  updated_at      timestamptz not null default now(),
  unique (chave, periodo_inicio, periodo_fim)
);
create index if not exists idx_kpi_manual_valores_chave on gestao.kpi_manual_valores(chave, periodo_inicio, periodo_fim);

-- Quem, além da diretoria, pode preencher/editar cada chave manual.
create table if not exists gestao.kpi_manual_editores (
  chave      text not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (chave, user_id)
);

-- ============================================================
-- FUNÇÃO GUARDIÃ
-- ============================================================
create or replace function gestao.pode_editar_kpi_manual(_chave text, _uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = gestao
as $$
  select gestao.can_see('diretoria') or exists (
    select 1 from gestao.kpi_manual_editores where chave = _chave and user_id = _uid
  )
$$;

-- ============================================================
-- SEED DE METAS — placeholders lidos do print de referência do usuário.
-- A VALIDAR com o usuário antes de considerar definitivo (editável
-- depois pela própria tela de Metas, então não é bloqueante).
-- ============================================================
insert into gestao.kpi_metas (chave, meta, tipo) values
  ('faturamento',             3000000, 'maior_melhor'),
  ('otif',                    95,      'maior_melhor'),
  ('caminhoes',               7,       'maior_melhor'),
  ('leadtime_pedido',         30,      'menor_melhor'),
  ('aderencia_pcp',           85,      'maior_melhor'),
  ('nc_injetado',             1,       'menor_melhor'),
  ('disponibilidade_maquina', 90,      'maior_melhor'),
  ('mttr',                    4,       'menor_melhor'),
  ('mtbf',                    400,     'maior_melhor'),
  ('maquina_operacao',        77,      'maior_melhor'),
  ('assistencia',             0,       'menor_melhor'),
  ('taxa_perda_corte',        5,       'menor_melhor')
on conflict (chave) do nothing;

-- ============================================================
-- RLS
-- ============================================================
alter table gestao.kpi_metas           enable row level security;
alter table gestao.kpi_manual_valores  enable row level security;
alter table gestao.kpi_manual_editores enable row level security;

-- metas: todo gestor lê; só diretoria escreve.
drop policy if exists "gestao_kpi_metas_select" on gestao.kpi_metas;
create policy "gestao_kpi_metas_select" on gestao.kpi_metas for select to authenticated using (true);
drop policy if exists "gestao_kpi_metas_write" on gestao.kpi_metas;
create policy "gestao_kpi_metas_write" on gestao.kpi_metas for all to authenticated
  using (gestao.can_see('diretoria')) with check (gestao.can_see('diretoria'));

-- valores manuais: leitura livre (autenticado); escrita SÓ via RPC
-- (kpi_manual_set, no arquivo de RPCs) — sem policy de insert/update
-- direta aqui de propósito, pra centralizar a checagem de permissão.
drop policy if exists "gestao_kpi_manual_valores_select" on gestao.kpi_manual_valores;
create policy "gestao_kpi_manual_valores_select" on gestao.kpi_manual_valores for select to authenticated using (true);

-- editores: cada um vê as próprias atribuições; diretoria vê/gerencia tudo.
drop policy if exists "gestao_kpi_manual_editores_select" on gestao.kpi_manual_editores;
create policy "gestao_kpi_manual_editores_select" on gestao.kpi_manual_editores for select to authenticated
  using (user_id = auth.uid() or gestao.can_see('diretoria'));
drop policy if exists "gestao_kpi_manual_editores_write" on gestao.kpi_manual_editores;
create policy "gestao_kpi_manual_editores_write" on gestao.kpi_manual_editores for all to authenticated
  using (gestao.can_see('diretoria')) with check (gestao.can_see('diretoria'));

-- ============================================================
-- GRANTS (as tabelas novas já herdam "alter default privileges" de
-- gestao_schema.sql, mas deixamos explícito por clareza)
-- ============================================================
grant select, insert, update, delete on gestao.kpi_metas           to authenticated;
grant select, insert, update, delete on gestao.kpi_manual_valores  to authenticated;
grant select, insert, update, delete on gestao.kpi_manual_editores to authenticated;
grant all on gestao.kpi_metas, gestao.kpi_manual_valores, gestao.kpi_manual_editores to service_role;

revoke all on function gestao.pode_editar_kpi_manual(text, uuid) from public, anon;
grant execute on function gestao.pode_editar_kpi_manual(text, uuid) to authenticated;

-- ============================================================
-- Recarrega o cache do PostgREST
-- ============================================================
notify pgrst, 'reload schema';
