-- ============================================================
-- SCHEMA: gestao   (Módulo Gerencial / BI integrado — SMERP)
-- Consolida KPIs de compras + fabrill + bip num só lugar, para
-- gerentes/diretoria. O app "SMERP Gerencial" usa db.schema='gestao'
-- e NUNCA lê os outros schemas direto: toda leitura cross-schema
-- passa pelas funções SECURITY DEFINER abaixo, que validam o escopo
-- de área (gestao.can_see) antes de devolver dados agregados.
--
-- Rodar no SQL Editor do Supabase Studio (ou psql) do banco SMERP.
-- Idempotente: pode ser reexecutado com segurança.
--
-- IMPORTANTE (deploy): o PostgREST self-hosted só expõe este schema se
-- 'gestao' estiver em PGRST_DB_SCHEMAS / db-schemas (ex.:
-- "public,compras,fabrill,bip,gestao") na config do serviço Supabase no
-- EasyPanel. Sem isso o app recebe 404/406. Depois rode (ou reinicie):
--   notify pgrst, 'reload schema';
-- ============================================================

create schema if not exists gestao;

-- Só usuários autenticados enxergam o schema (anon NUNCA).
grant usage on schema gestao to authenticated, service_role;
revoke usage on schema gestao from anon;
alter default privileges in schema gestao grant all on tables to authenticated, service_role;
alter default privileges in schema gestao grant all on functions to authenticated, service_role;

-- ============================================================
-- TABELAS PRÓPRIAS
-- ============================================================

-- Presença aqui = o card "Gerencial" aparece no Hub (igual aos outros schemas).
create table if not exists gestao.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

-- Escopo de área do gestor. 'diretoria' = vê tudo; os demais liberam só
-- aquele módulo. Um usuário pode ter vários escopos.
create table if not exists gestao.user_scopes (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('diretoria','compras','producao','expedicao')),
  created_at timestamptz not null default now(),
  primary key (user_id, scope)
);

-- Preferências do dashboard por usuário (personalização de widgets).
-- layout = [{ id, visible, order }] ; period = { preset, from, to }
create table if not exists gestao.dashboard_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  layout jsonb not null default '[]'::jsonb,
  period jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- FUNÇÕES GUARDIÃS
-- ============================================================

-- true se o usuário pode ver o módulo (escopo 'diretoria' OU o módulo exato).
create or replace function gestao.can_see(_modulo text, _uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = gestao
as $$
  select exists (
    select 1 from gestao.user_scopes
    where user_id = _uid and (scope = 'diretoria' or scope = _modulo)
  )
$$;

-- atalho: tem QUALQUER escopo (é gestor de algo).
create or replace function gestao.is_gestor(_uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = gestao
as $$
  select exists (select 1 from gestao.user_scopes where user_id = _uid)
$$;

-- ============================================================
-- RPCs DE KPI
-- Padrão: parâmetros p_from/p_to (date); preâmbulo can_see(...) que
-- levanta exceção; SECURITY DEFINER com search_path explícito; tabelas
-- sempre 100% qualificadas. Devolvem jsonb (mapeia direto p/ Recharts).
-- ============================================================

-- ---------- VISÃO GERAL EXECUTIVA ----------
-- Devolve só os blocos que o usuário pode ver. Período aplica-se a:
--   compras  -> purchased_at (valor comprado) e created_at (nº SCs)
--   producao -> entry_date / goal_date
--   expedicao-> loading_date
create or replace function gestao.kpi_overview(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
declare
  result jsonb := '{}'::jsonb;
begin
  if not gestao.is_gestor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- COMPRAS
  if gestao.can_see('compras') then
    result := result || jsonb_build_object('compras', (
      select jsonb_build_object(
        'valor_comprado', coalesce(sum(purchase_amount) filter (
            where purchased_at is not null
              and purchased_at::date between p_from and p_to), 0),
        'num_compras', count(*) filter (
            where purchased_at is not null
              and purchased_at::date between p_from and p_to),
        'num_scs', count(*) filter (where created_at::date between p_from and p_to),
        'pendentes', count(*) filter (where status = 'pendente')
      )
      from compras.purchase_requests
    ));
  end if;

  -- PRODUÇÃO
  if gestao.can_see('producao') then
    result := result || jsonb_build_object('producao', (
      select jsonb_build_object(
        'produzido', coalesce((select sum(quantity) from fabrill.production_entries
                                where entry_date between p_from and p_to), 0),
        'meta', coalesce((select sum(goal) from fabrill.production_goals
                          where goal_date between p_from and p_to), 0),
        'atingimento_pct', (
          select case when coalesce(sum(g.goal),0) = 0 then null
            else round(
              100.0 * coalesce((select sum(quantity) from fabrill.production_entries
                                where entry_date between p_from and p_to), 0)
              / sum(g.goal), 1)
          end
          from fabrill.production_goals g
          where g.goal_date between p_from and p_to
        )
      )
    ));
  end if;

  -- EXPEDIÇÃO
  if gestao.can_see('expedicao') then
    result := result || jsonb_build_object('expedicao', (
      select jsonb_build_object(
        'carregamentos', count(*),
        'concluidos', count(*) filter (where status = 'completed'),
        'pct_concluido', case when count(*) = 0 then null
          else round(100.0 * count(*) filter (where status = 'completed') / count(*), 1) end,
        'qtd_total', coalesce(sum(quantity), 0)
      )
      from bip.loading_orders
      where loading_date between p_from and p_to
    ));
  end if;

  return result;
end $$;

-- ---------- COMPRAS: valor comprado por mês ----------
-- Fidelidade ao dashboard do Compras: soma purchase_amount onde
-- purchased_at não é nulo, agrupado por mês.
create or replace function gestao.kpi_compras_valor_mensal(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('compras') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.mes)
    from (
      select to_char(date_trunc('month', purchased_at), 'YYYY-MM') as mes,
             sum(purchase_amount) as valor,
             count(*) as num_scs
      from compras.purchase_requests
      where purchased_at is not null
        and purchase_amount is not null
        and purchased_at::date between p_from and p_to
      group by 1
    ) t
  ), '[]'::jsonb);
end $$;

-- ---------- COMPRAS: valor por centro de custo ----------
create or replace function gestao.kpi_compras_por_centro(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('compras') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.valor desc)
    from (
      select coalesce(cc.name, 'Sem CC') as centro,
             sum(pr.purchase_amount) as valor,
             count(*) as compras
      from compras.purchase_requests pr
      left join compras.cost_centers cc on cc.id = pr.cost_center_id
      where pr.purchased_at is not null
        and pr.purchase_amount is not null
        and pr.purchased_at::date between p_from and p_to
      group by 1
    ) t
  ), '[]'::jsonb);
end $$;

-- ---------- PRODUÇÃO: produzido x meta por dia ----------
create or replace function gestao.kpi_producao_diaria(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('producao') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.dia)
    from (
      select d.dia,
             coalesce(p.produzido, 0) as produzido,
             coalesce(g.meta, 0) as meta
      from (
        select entry_date as dia from fabrill.production_entries where entry_date between p_from and p_to
        union
        select goal_date as dia from fabrill.production_goals where goal_date between p_from and p_to
      ) d
      left join (
        select entry_date, sum(quantity) as produzido
        from fabrill.production_entries
        where entry_date between p_from and p_to
        group by entry_date
      ) p on p.entry_date = d.dia
      left join (
        select goal_date, sum(goal) as meta
        from fabrill.production_goals
        where goal_date between p_from and p_to
        group by goal_date
      ) g on g.goal_date = d.dia
    ) t
  ), '[]'::jsonb);
end $$;

-- ---------- EXPEDIÇÃO: carregamentos por status ----------
create or replace function gestao.kpi_expedicao_status(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('expedicao') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.total desc)
    from (
      select status,
             count(*) as total,
             coalesce(sum(quantity), 0) as qtd
      from bip.loading_orders
      where loading_date between p_from and p_to
      group by status
    ) t
  ), '[]'::jsonb);
end $$;

-- ---------- COMPRAS: ranking de fornecedores (avaliação ISO) ----------
create or replace function gestao.kpi_fornecedores_ranking(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('compras') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.pontos_medios desc)
    from (
      select supplier as fornecedor,
             count(*) as avaliacoes,
             round(avg(total_points), 1) as pontos_medios,
             round(avg(days_late), 1) as atraso_medio,
             count(*) filter (where returned) as devolucoes,
             count(*) filter (where approved) as aprovadas,
             count(*) filter (where classification = 'otimo') as otimo,
             count(*) filter (where classification = 'bom') as bom,
             count(*) filter (where classification = 'regular') as regular,
             count(*) filter (where classification = 'insuficiente') as insuficiente
      from compras.supplier_evaluations
      where evaluation_date between p_from and p_to
      group by supplier
    ) t
  ), '[]'::jsonb);
end $$;

-- ============================================================
-- RPCs DE KPI — v2 (aprofundamento Produção + Compras)
-- ============================================================

-- ---------- PRODUÇÃO: meta x realizado por máquina ----------
create or replace function gestao.kpi_producao_meta_maquina(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('producao') then raise exception 'forbidden' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.area, t.maquina)
    from (
      select m.name as maquina, a.name as area,
             coalesce(g.meta,0) as meta,
             coalesce(e.realizado,0) as realizado,
             case when coalesce(g.meta,0)=0 then null
                  else round(100.0*coalesce(e.realizado,0)/g.meta,1) end as pct
      from fabrill.machines m
      join fabrill.areas a on a.id = m.area_id
      left join (select machine_id, sum(goal) meta from fabrill.production_goals
                 where goal_date between p_from and p_to group by machine_id) g on g.machine_id = m.id
      left join (select machine_id, sum(quantity) realizado from fabrill.production_entries
                 where entry_date between p_from and p_to group by machine_id) e on e.machine_id = m.id
      where coalesce(g.meta,0) > 0 or coalesce(e.realizado,0) > 0
    ) t
  ), '[]'::jsonb);
end $$;

-- ---------- PRODUÇÃO: meta x realizado por setor ----------
create or replace function gestao.kpi_producao_meta_setor(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('producao') then raise exception 'forbidden' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.setor)
    from (
      select a.name as setor,
             coalesce(sum(g.meta),0) as meta,
             coalesce(sum(e.realizado),0) as realizado,
             case when coalesce(sum(g.meta),0)=0 then null
                  else round(100.0*coalesce(sum(e.realizado),0)/sum(g.meta),1) end as pct
      from fabrill.areas a
      join fabrill.machines m on m.area_id = a.id
      left join (select machine_id, sum(goal) meta from fabrill.production_goals
                 where goal_date between p_from and p_to group by machine_id) g on g.machine_id = m.id
      left join (select machine_id, sum(quantity) realizado from fabrill.production_entries
                 where entry_date between p_from and p_to group by machine_id) e on e.machine_id = m.id
      group by a.name
      having coalesce(sum(g.meta),0) > 0 or coalesce(sum(e.realizado),0) > 0
    ) t
  ), '[]'::jsonb);
end $$;

-- ---------- PRODUÇÃO: share do realizado por área (pizza) ----------
create or replace function gestao.kpi_producao_por_area(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('producao') then raise exception 'forbidden' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.realizado desc)
    from (
      select a.name as area, sum(e.quantity) as realizado
      from fabrill.production_entries e
      join fabrill.machines m on m.id = e.machine_id
      join fabrill.areas a on a.id = m.area_id
      where e.entry_date between p_from and p_to
      group by a.name
    ) t
  ), '[]'::jsonb);
end $$;

-- ---------- PRODUÇÃO: heatmap máquina x hora (de UM dia) ----------
-- meta_hora simplificada = goal / 10 (slots 0..9). Veja a regra completa
-- (slot das 8h) em hora-hora-fabrill Dashboard.tsx; aqui é aproximação.
create or replace function gestao.kpi_producao_heatmap(p_date date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('producao') then raise exception 'forbidden' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.area, t.maquina)
    from (
      select m.name as maquina, a.name as area,
             coalesce(g.goal,0) as meta,
             round(coalesce(g.goal,0)/10.0, 1) as meta_hora,
             coalesce(e.total,0) as total,
             coalesce(e.slots, '{}'::jsonb) as slots
      from fabrill.machines m
      join fabrill.areas a on a.id = m.area_id
      left join (select machine_id, goal from fabrill.production_goals where goal_date = p_date) g on g.machine_id = m.id
      left join (
        select machine_id, sum(quantity) total,
               jsonb_object_agg(hour_slot::text, quantity) slots
        from fabrill.production_entries where entry_date = p_date group by machine_id
      ) e on e.machine_id = m.id
      where coalesce(g.goal,0) > 0 or coalesce(e.total,0) > 0
    ) t
  ), '[]'::jsonb);
end $$;

-- ---------- PRODUÇÃO: produção por operador (share 1/N) ----------
create or replace function gestao.kpi_producao_operador(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('producao') then raise exception 'forbidden' using errcode='42501'; end if;
  return coalesce((
    with real_md as (
      select machine_id, entry_date d, sum(quantity) realizado
      from fabrill.production_entries where entry_date between p_from and p_to group by machine_id, entry_date
    ),
    op_list as (
      select machine_id, log_date d, trim(operator_name) op
      from fabrill.machine_operators
      where log_date between p_from and p_to and coalesce(trim(operator_name),'') <> ''
      group by machine_id, log_date, trim(operator_name)
    ),
    op_count as (select machine_id, d, count(*) n from op_list group by machine_id, d)
    select jsonb_agg(row_to_json(t) order by t.producao desc)
    from (
      select ol.op as operador, round(sum(r.realizado::numeric / c.n)) as producao
      from op_list ol
      join real_md r on r.machine_id = ol.machine_id and r.d = ol.d
      join op_count c on c.machine_id = ol.machine_id and c.d = ol.d
      group by ol.op
      order by producao desc
      limit 15
    ) t
  ), '[]'::jsonb);
end $$;

-- ---------- PRODUÇÃO: funcionário do mês por setor (pct >= 95) ----------
create or replace function gestao.kpi_producao_funcionario_mes(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('producao') then raise exception 'forbidden' using errcode='42501'; end if;
  return coalesce((
    with goal_md as (select machine_id, goal_date d, goal from fabrill.production_goals where goal_date between p_from and p_to),
    real_md as (select machine_id, entry_date d, sum(quantity) realizado from fabrill.production_entries
                where entry_date between p_from and p_to group by machine_id, entry_date),
    op_list as (
      select machine_id, log_date d, trim(operator_name) op
      from fabrill.machine_operators
      where log_date between p_from and p_to and coalesce(trim(operator_name),'') <> ''
      group by machine_id, log_date, trim(operator_name)
    ),
    op_count as (select machine_id, d, count(*) n from op_list group by machine_id, d),
    attr as (
      select mm.area_id, ol.op,
             coalesce(g.goal,0)::numeric / c.n as meta_share,
             coalesce(r.realizado,0)::numeric / c.n as real_share
      from op_list ol
      join op_count c on c.machine_id = ol.machine_id and c.d = ol.d
      join fabrill.machines mm on mm.id = ol.machine_id
      left join goal_md g on g.machine_id = ol.machine_id and g.d = ol.d
      left join real_md r on r.machine_id = ol.machine_id and r.d = ol.d
    ),
    totals as (select area_id, op, sum(meta_share) meta, sum(real_share) realizado from attr group by area_id, op),
    ranked as (
      select a.name as setor, t.op as operador, t.meta, t.realizado,
             t.realizado/t.meta*100 as pct,
             row_number() over (partition by t.area_id order by t.realizado/t.meta*100 desc) rn
      from totals t join fabrill.areas a on a.id = t.area_id
      where t.meta > 0 and (t.realizado/t.meta*100) >= 95
    )
    select jsonb_agg(row_to_json(x) order by x.setor)
    from (
      select setor, operador, round(pct) as pct, round(meta) as meta, round(realizado) as realizado
      from ranked where rn = 1
    ) x
  ), '[]'::jsonb);
end $$;

-- ---------- PRODUÇÃO: desvios de qualidade ----------
create or replace function gestao.kpi_producao_desvios(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('producao') then raise exception 'forbidden' using errcode='42501'; end if;
  return jsonb_build_object(
    'total', (select count(*) from fabrill.production_deviations where deviation_date between p_from and p_to),
    'peso_total', coalesce((select sum(total_weight) from fabrill.production_deviations where deviation_date between p_from and p_to), 0),
    'por_dia', coalesce((
      select jsonb_agg(row_to_json(t) order by t.dia)
      from (select deviation_date::text as dia, count(*) total
            from fabrill.production_deviations where deviation_date between p_from and p_to
            group by deviation_date) t), '[]'::jsonb),
    'por_area', coalesce((
      select jsonb_agg(row_to_json(t) order by t.total desc)
      from (select a.name as area, count(*) total
            from fabrill.production_deviations d join fabrill.areas a on a.id = d.area_id
            where d.deviation_date between p_from and p_to group by a.name) t), '[]'::jsonb)
  );
end $$;

-- ---------- COMPRAS: top itens por gasto no período ----------
create or replace function gestao.kpi_compras_top_itens(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('compras') then raise exception 'forbidden' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.gasto desc)
    from (
      select i.code as codigo, i.description as descricao,
             sum(pr.purchase_amount) as gasto, count(*) as compras
      from compras.purchase_requests pr
      join compras.items i on i.id = pr.item_id
      where pr.purchased_at is not null and pr.purchase_amount is not null
        and pr.purchased_at::date between p_from and p_to
      group by i.code, i.description
      order by gasto desc
      limit 10
    ) t
  ), '[]'::jsonb);
end $$;

-- ---------- COMPRAS: itens vencidos (sugestão de recompra, estado atual) ----------
create or replace function gestao.kpi_compras_itens_vencidos()
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('compras') then raise exception 'forbidden' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.atraso desc)
    from (
      select code as codigo, description as descricao,
             round(extract(epoch from (now() - last_purchased_at))/86400) as dias_desde,
             round(avg_interval_days) as intervalo_medio,
             last_purchased_at::date as ultima_compra,
             round(extract(epoch from (now() - last_purchased_at))/86400 - avg_interval_days) as atraso
      from compras.items
      where last_purchased_at is not null and avg_interval_days is not null
        and extract(epoch from (now() - last_purchased_at))/86400 >= avg_interval_days
      order by atraso desc
      limit 50
    ) t
  ), '[]'::jsonb);
end $$;

-- ---------- COMPRAS: tempos médios de ciclo (horas) ----------
create or replace function gestao.kpi_compras_ciclo(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('compras') then raise exception 'forbidden' using errcode='42501'; end if;
  return (
    select jsonb_build_object(
      'abertura_aprovacao_h', round(avg(extract(epoch from (decided_at - created_at))/3600)
          filter (where decided_at is not null)::numeric, 1),
      'aprovacao_compra_h', round(avg(extract(epoch from (purchased_at - decided_at))/3600)
          filter (where decided_at is not null and purchased_at is not null)::numeric, 1),
      'compra_chegada_h', round(avg(extract(epoch from (arrived_at - purchased_at))/3600)
          filter (where purchased_at is not null and arrived_at is not null)::numeric, 1)
    )
    from compras.purchase_requests
    where created_at::date between p_from and p_to
  );
end $$;

-- ---------- COMPRAS: economia SAVE por mês ----------
-- Fiel ao dashboard do Compras: diff = preço_unit_anterior - preço_unit_atual
-- (por item, ordenado por purchased_at); soma diff*qtd quando >0; exclui code 3091000.
create or replace function gestao.kpi_compras_save_mensal(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('compras') then raise exception 'forbidden' using errcode='42501'; end if;
  return coalesce((
    with seq as (
      select pr.item_id, pr.purchased_at, pr.quantity, pr.purchase_amount,
             lag(pr.purchase_amount / nullif(pr.quantity,0))
               over (partition by pr.item_id order by pr.purchased_at) as prev_unit
      from compras.purchase_requests pr
      join compras.items i on i.id = pr.item_id
      where pr.purchased_at is not null and pr.purchase_amount is not null
        and pr.quantity > 0 and i.code <> '3091000'
    ),
    calc as (
      select to_char(date_trunc('month', purchased_at), 'YYYY-MM') as mes,
             (prev_unit - purchase_amount / quantity) * quantity as econ
      from seq
      where prev_unit is not null and purchased_at::date between p_from and p_to
    )
    select jsonb_agg(row_to_json(t) order by t.mes)
    from (select mes, round(sum(econ), 2) as economia from calc where econ > 0 group by mes) t
  ), '[]'::jsonb);
end $$;

-- ---------- COMPRAS: status + setor + taxa de rejeição ----------
create or replace function gestao.kpi_compras_status_setor(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('compras') then raise exception 'forbidden' using errcode='42501'; end if;
  return jsonb_build_object(
    'por_status', coalesce((
      select jsonb_agg(row_to_json(t) order by t.total desc)
      from (select status, count(*) total from compras.purchase_requests
            where created_at::date between p_from and p_to group by status) t), '[]'::jsonb),
    'por_setor', coalesce((
      select jsonb_agg(row_to_json(t) order by t.total desc)
      from (select coalesce(s.code || ' — ' || s.name, '—') as setor, count(*) total
            from compras.purchase_requests pr
            left join compras.sectors s on s.id = pr.sector_id
            where pr.created_at::date between p_from and p_to group by 1) t), '[]'::jsonb),
    'taxa_rejeicao', (
      select case when count(*)=0 then null
             else round(100.0 * count(*) filter (where status='negado') / count(*), 1) end
      from compras.purchase_requests where created_at::date between p_from and p_to)
  );
end $$;

-- ---------- COMPRAS: conformidade de fornecedores (Q1–Q4) ----------
create or replace function gestao.kpi_compras_conformidade(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
begin
  if not gestao.can_see('compras') then raise exception 'forbidden' using errcode='42501'; end if;
  return (
    select jsonb_build_object(
      'avaliacoes', count(*),
      'q1_pct', round(100.0*avg(case when q1_conforme then 1 else 0 end), 1),
      'q2_pct', round(100.0*avg(case when q2_prazo then 1 else 0 end), 1),
      'q3_pct', round(100.0*avg(case when q3_quantidade then 1 else 0 end), 1),
      'q4_pct', round(100.0*avg(case when q4_conservacao then 1 else 0 end), 1),
      'aprovacao_pct', round(100.0*avg(case when approved then 1 else 0 end), 1),
      'devolucao_pct', round(100.0*avg(case when returned then 1 else 0 end), 1)
    )
    from compras.supplier_evaluations
    where evaluation_date between p_from and p_to
  );
end $$;

-- ============================================================
-- RLS (tabelas próprias)
-- ============================================================
alter table gestao.profiles        enable row level security;
alter table gestao.user_scopes     enable row level security;
alter table gestao.dashboard_prefs enable row level security;

-- profiles: gestor lê (necessário p/ telas de admin futuras); update próprio.
drop policy if exists "gestao_profiles_select" on gestao.profiles;
create policy "gestao_profiles_select" on gestao.profiles for select to authenticated
  using (id = auth.uid() or gestao.can_see('diretoria'));
drop policy if exists "gestao_profiles_update_self" on gestao.profiles;
create policy "gestao_profiles_update_self" on gestao.profiles for update to authenticated
  using (id = auth.uid());

-- user_scopes: usuário lê os próprios escopos; diretoria gerencia todos.
drop policy if exists "gestao_scopes_select" on gestao.user_scopes;
create policy "gestao_scopes_select" on gestao.user_scopes for select to authenticated
  using (user_id = auth.uid() or gestao.can_see('diretoria'));
drop policy if exists "gestao_scopes_admin" on gestao.user_scopes;
create policy "gestao_scopes_admin" on gestao.user_scopes for all to authenticated
  using (gestao.can_see('diretoria')) with check (gestao.can_see('diretoria'));

-- dashboard_prefs: cada um mexe só na própria config.
drop policy if exists "gestao_prefs_own" on gestao.dashboard_prefs;
create policy "gestao_prefs_own" on gestao.dashboard_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- GRANTS
-- ============================================================
grant select, insert, update, delete on all tables in schema gestao to authenticated;
grant all on all tables in schema gestao to service_role;

-- RPCs: nunca anon/public; filtro fino é o can_see() interno.
revoke all on function gestao.kpi_overview(date,date)              from public, anon;
revoke all on function gestao.kpi_compras_valor_mensal(date,date)  from public, anon;
revoke all on function gestao.kpi_compras_por_centro(date,date)    from public, anon;
revoke all on function gestao.kpi_producao_diaria(date,date)       from public, anon;
revoke all on function gestao.kpi_expedicao_status(date,date)      from public, anon;
revoke all on function gestao.kpi_fornecedores_ranking(date,date)  from public, anon;
grant execute on function gestao.kpi_overview(date,date)             to authenticated;
grant execute on function gestao.kpi_compras_valor_mensal(date,date) to authenticated;
grant execute on function gestao.kpi_compras_por_centro(date,date)   to authenticated;
grant execute on function gestao.kpi_producao_diaria(date,date)      to authenticated;
grant execute on function gestao.kpi_expedicao_status(date,date)     to authenticated;
grant execute on function gestao.kpi_fornecedores_ranking(date,date) to authenticated;

-- v2
revoke all on function gestao.kpi_producao_meta_maquina(date,date)    from public, anon;
revoke all on function gestao.kpi_producao_meta_setor(date,date)      from public, anon;
revoke all on function gestao.kpi_producao_por_area(date,date)        from public, anon;
revoke all on function gestao.kpi_producao_heatmap(date)              from public, anon;
revoke all on function gestao.kpi_producao_operador(date,date)        from public, anon;
revoke all on function gestao.kpi_producao_funcionario_mes(date,date) from public, anon;
revoke all on function gestao.kpi_producao_desvios(date,date)         from public, anon;
revoke all on function gestao.kpi_compras_top_itens(date,date)        from public, anon;
revoke all on function gestao.kpi_compras_itens_vencidos()            from public, anon;
revoke all on function gestao.kpi_compras_ciclo(date,date)            from public, anon;
revoke all on function gestao.kpi_compras_save_mensal(date,date)      from public, anon;
revoke all on function gestao.kpi_compras_status_setor(date,date)     from public, anon;
revoke all on function gestao.kpi_compras_conformidade(date,date)     from public, anon;
grant execute on function gestao.kpi_producao_meta_maquina(date,date)    to authenticated;
grant execute on function gestao.kpi_producao_meta_setor(date,date)      to authenticated;
grant execute on function gestao.kpi_producao_por_area(date,date)        to authenticated;
grant execute on function gestao.kpi_producao_heatmap(date)              to authenticated;
grant execute on function gestao.kpi_producao_operador(date,date)        to authenticated;
grant execute on function gestao.kpi_producao_funcionario_mes(date,date) to authenticated;
grant execute on function gestao.kpi_producao_desvios(date,date)         to authenticated;
grant execute on function gestao.kpi_compras_top_itens(date,date)        to authenticated;
grant execute on function gestao.kpi_compras_itens_vencidos()            to authenticated;
grant execute on function gestao.kpi_compras_ciclo(date,date)            to authenticated;
grant execute on function gestao.kpi_compras_save_mensal(date,date)      to authenticated;
grant execute on function gestao.kpi_compras_status_setor(date,date)     to authenticated;
grant execute on function gestao.kpi_compras_conformidade(date,date)     to authenticated;

-- ============================================================
-- PROVISIONAMENTO (exemplos — descomente e ajuste os e-mails)
-- Tornar alguém gestor = inserir em gestao.profiles + gestao.user_scopes.
-- ============================================================
-- -- Diretoria (vê tudo):
-- insert into gestao.profiles (id, email, full_name)
--   select id, email, raw_user_meta_data->>'full_name' from auth.users where email = 'diretor@solucaomoveis.com'
--   on conflict (id) do nothing;
-- insert into gestao.user_scopes (user_id, scope)
--   select id, 'diretoria' from auth.users where email = 'diretor@solucaomoveis.com'
--   on conflict do nothing;
--
-- -- Gerente de produção (só produção):
-- insert into gestao.profiles (id, email, full_name)
--   select id, email, raw_user_meta_data->>'full_name' from auth.users where email = 'gerente.fabrica@solucaomoveis.com'
--   on conflict (id) do nothing;
-- insert into gestao.user_scopes (user_id, scope)
--   select id, 'producao' from auth.users where email = 'gerente.fabrica@solucaomoveis.com'
--   on conflict do nothing;

-- ============================================================
-- LIBERAÇÃO ATUAL (apenas o usuário master, escopo 'diretoria' = vê tudo).
-- Por enquanto SÓ o master tem o Gerencial liberado. O card só aparece no
-- Hub para quem está em gestao.profiles, então não provisionar mais ninguém
-- mantém o módulo restrito a este usuário.
-- ============================================================
insert into gestao.profiles (id, email, full_name)
  select id, email, raw_user_meta_data->>'full_name'
  from auth.users where email = 'master@solucaomoveis.ind.br'
  on conflict (id) do nothing;
insert into gestao.user_scopes (user_id, scope)
  select id, 'diretoria'
  from auth.users where email = 'master@solucaomoveis.ind.br'
  on conflict do nothing;

-- ============================================================
-- Recarrega o cache de schema do PostgREST (após expor 'gestao').
-- ============================================================
notify pgrst, 'reload schema';

-- Teste rápido (logado como um gestor, via SQL Editor "Run as" ou PostgREST):
--   select gestao.kpi_overview(date '2026-05-01', date '2026-05-31');
