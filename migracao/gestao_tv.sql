-- ============================================================
-- Painel do Diretor (Gerencial reimaginado: PC + TV + celular)
--
-- Funções que alimentam as telas Abertura, Entrega, Produção, Setores, Manutenção, Compras, RH e Segurança.
-- REGRA GERAL: cada número usa a MESMA regra do sistema de origem (conferido no código de cada app em 09/10/2026),
-- para a pessoa ver o mesmo valor no sistema e no painel.
--   - Mês agrupado no horário de Brasília (America/Sao_Paulo), como os apps fazem no navegador.
--   - Produção do mês corrente vai até ONTEM (meta de hoje e de dias futuros fica de fora).
--   - Volumes do mês corrente (caminhões, pacotes, compras, OS) vêm com o "mesmo período do mês anterior".
--
-- Rodar no SQL Editor do Supabase. Idempotente. Depois: notify pgrst, 'reload schema' (já no fim).
-- Depende de: gestao.can_see e gestao.is_gestor (gestao_schema.sql).
-- Acesso: qualquer pessoa com acesso ao Gerencial vê o painel; só a diretoria edita as metas.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Metas com histórico (cada meta vale a partir de um mês; mudar a meta não reescreve o passado)
-- ------------------------------------------------------------
create table if not exists gestao.kpi_metas_vigencia (
  chave         text        not null,
  vigente_desde date        not null,
  meta          numeric     not null,
  tipo          text        not null check (tipo in ('maior_melhor', 'menor_melhor')),
  unidade       text,
  updated_by    uuid        default auth.uid(),
  updated_at    timestamptz not null default now(),
  primary key (chave, vigente_desde)
);
alter table gestao.kpi_metas_vigencia enable row level security;

drop policy if exists "metas_vigencia_select" on gestao.kpi_metas_vigencia;
create policy "metas_vigencia_select" on gestao.kpi_metas_vigencia
  for select to authenticated using (gestao.is_gestor());  -- ler: quem tem acesso ao Gerencial; editar: só diretoria
drop policy if exists "metas_vigencia_write" on gestao.kpi_metas_vigencia;
create policy "metas_vigencia_write" on gestao.kpi_metas_vigencia
  for all to authenticated using (gestao.can_see('diretoria')) with check (gestao.can_see('diretoria'));

grant select, insert, update, delete on gestao.kpi_metas_vigencia to authenticated;

-- Valores iniciais copiados de gestao.kpi_metas (vigentes desde jan/2026). Não sobrescreve se já existir.
insert into gestao.kpi_metas_vigencia (chave, vigente_desde, meta, tipo, unidade)
select v.chave, date '2026-01-01', coalesce(k.meta, v.padrao), v.tipo, v.unidade
from (values
  ('caminhoes',               'caminhoes',              7::numeric,   'maior_melhor', 'por semana'),
  ('producao_pct',            'aderencia_pcp',          85::numeric,  'maior_melhor', '%'),
  ('disponibilidade_maquina', 'disponibilidade_maquina', 90::numeric, 'maior_melhor', '%'),
  ('mttr',                    'mttr',                   4::numeric,   'menor_melhor', 'h'),
  ('mtbf',                    'mtbf',                   400::numeric, 'maior_melhor', 'h')
) as v(chave, chave_antiga, padrao, tipo, unidade)
left join gestao.kpi_metas k on k.chave = v.chave_antiga
on conflict (chave, vigente_desde) do nothing;

-- ------------------------------------------------------------
-- 2) Painel mensal (séries de 12 meses + top 5 + "agora")
-- ------------------------------------------------------------
create or replace function gestao.tv_painel(p_meses int default 12)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
declare
  v_agora      timestamptz := now();
  v_hoje       date := (now() at time zone 'America/Sao_Paulo')::date;
  v_mes_atual  date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  v_ini        date;
  v_dia        int  := extract(day from (now() at time zone 'America/Sao_Paulo'))::int;
  v_ant_ini    date;
  v_ant_fim    date;  -- mesmo período do mês anterior (dia 1 até o mesmo dia de hoje)
  v_ant_fim_p  date;  -- produção: mesmo período até "ontem"
  v_nmaq       int;
  r            jsonb := '{}'::jsonb;
begin
  if not gestao.is_gestor() then  -- qualquer pessoa com acesso ao Gerencial (decisão de 09/10)
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_ini       := (v_mes_atual - make_interval(months => greatest(p_meses, 1) - 1))::date;
  v_ant_ini   := (v_mes_atual - interval '1 month')::date;
  v_ant_fim   := least(v_ant_ini + (v_dia - 1), v_mes_atual - 1);
  v_ant_fim_p := least(v_ant_ini + (v_dia - 2), v_mes_atual - 1);

  r := r || jsonb_build_object(
    'gerado_em', v_agora,
    'hoje', v_hoje,
    'mes_atual', to_char(v_mes_atual, 'YYYY-MM'),
    'mes_inicio', to_char(v_ini, 'YYYY-MM'),
    'dia', v_dia
  );

  -- ===== ENTREGA (BIP) =====
  -- Caminhão = número de carregamento distinto (loading_number); pedido sem número conta como 1 caminhão;
  -- data do caminhão = menor loading_date dos pedidos. Pacotes = loading_orders.quantity (o BIP chama de "Pacotes").
  r := r || jsonb_build_object('entrega', (
    with ped as (
      select o.id, coalesce(nullif(trim(o.loading_number), ''), 'pedido:' || o.id::text) as k,
             o.loading_date, o.quantity, o.city
      from bip.loading_orders o where o.loading_date is not null
    ),
    cam as (select k, min(loading_date) as d from ped group by k),
    cid as (
      select to_char(c.d, 'YYYY-MM') as m,
             coalesce(nullif(trim(p.city), ''), 'Cidade não informada') as cidade,
             count(distinct p.k) as caminhoes, sum(p.quantity) as pacotes
      from ped p join cam c on c.k = p.k
      where c.d >= v_ini
      group by 1, 2
    ),
    cid_rk as (select *, row_number() over (partition by m order by caminhoes desc, pacotes desc, cidade) as rk from cid)
    select jsonb_build_object(
      'caminhoes', coalesce((select jsonb_object_agg(m, n) from (
          select to_char(d, 'YYYY-MM') m, count(*) n from cam where d >= v_ini group by 1) t), '{}'::jsonb),
      'caminhoes_mesmo_periodo', (select count(*) from cam where d between v_ant_ini and v_ant_fim),
      'pacotes', coalesce((select jsonb_object_agg(m, n) from (
          select to_char(loading_date, 'YYYY-MM') m, sum(quantity) n from ped where loading_date >= v_ini group by 1) t), '{}'::jsonb),
      'pacotes_mesmo_periodo', (select coalesce(sum(quantity), 0) from ped where loading_date between v_ant_ini and v_ant_fim),
      'top5_cidades', coalesce((select jsonb_object_agg(m, lst) from (
          select m, jsonb_agg(jsonb_build_array(cidade, caminhoes, pacotes) order by rk) lst
          from cid_rk where rk <= 5 group by m) t), '{}'::jsonb),
      'ultimo_registro', (select max(created_at) from bip.loading_orders)
    )
  ));

  -- ===== PRODUÇÃO (Hora a Hora, regra do PCP → Relatórios) =====
  -- Meta = Σ metas cadastradas; Realizado = Σ TODOS os lançamentos (inclusive em dia sem meta).
  -- Mês corrente só até ontem (meta de hoje e de dias futuros fica fora).
  r := r || jsonb_build_object('producao', (
    with g as (
      select to_char(goal_date, 'YYYY-MM') m, machine_id, sum(goal) meta
      from fabrill.production_goals where goal_date >= v_ini and goal_date < v_hoje group by 1, 2
    ),
    e as (
      select to_char(entry_date, 'YYYY-MM') m, machine_id, sum(quantity) prod
      from fabrill.production_entries where entry_date >= v_ini and entry_date < v_hoje group by 1, 2
    ),
    mes as (
      select coalesce(gm.m, em.m) m, coalesce(gm.meta, 0) meta, coalesce(em.prod, 0) prod
      from (select m, sum(meta) meta from g group by m) gm
      full join (select m, sum(prod) prod from e group by m) em on em.m = gm.m
    ),
    maq as (
      select g.m, mc.name nome, a.name area, g.meta, coalesce(e.prod, 0) prod,
             round(100.0 * coalesce(e.prod, 0) / g.meta, 1) pct
      from g join fabrill.machines mc on mc.id = g.machine_id join fabrill.areas a on a.id = mc.area_id
      left join e on e.m = g.m and e.machine_id = g.machine_id
      where g.meta > 0
    ),
    maq_rk as (select *, row_number() over (partition by m order by pct asc, nome) rk from maq)
    select jsonb_build_object(
      'meta', coalesce((select jsonb_object_agg(m, meta) from mes), '{}'::jsonb),
      'realizado', coalesce((select jsonb_object_agg(m, prod) from mes), '{}'::jsonb),
      'realizado_mesmo_periodo', (select coalesce(sum(quantity), 0) from fabrill.production_entries
                                  where entry_date between v_ant_ini and v_ant_fim_p),
      'desvios', coalesce((select jsonb_object_agg(m, n) from (
          select to_char(deviation_date, 'YYYY-MM') m, count(*) n from fabrill.production_deviations
          where deviation_date >= v_ini group by 1) t), '{}'::jsonb),
      'desvios_mesmo_periodo', (select count(*) from fabrill.production_deviations
                                where deviation_date between v_ant_ini and v_ant_fim),
      'top5_abaixo_meta', coalesce((select jsonb_object_agg(m, lst) from (
          select m, jsonb_agg(jsonb_build_array(nome, pct, area, prod, meta) order by rk) lst
          from maq_rk where rk <= 5 group by m) t), '{}'::jsonb),
      'ultimo_registro', (select max(updated_at) from fabrill.production_entries)
    )
  ));

  -- ===== MANUTENÇÃO (base do Pro-Care; OS de falha inválida NÃO entram — decisão de 09/10) =====
  -- Máquinas ativas e automáticas; OS ≠ cancelada; mês pelo aberto_em em Brasília.
  -- Horas disponíveis = máquinas × 8 h × dias úteis (seg-sex) até hoje. MTTR = horas paradas (descontando pausas
  -- fechadas) ÷ OS fechadas com máquina parada. MTBF = horas disponíveis ÷ OS com máquina parada.
  select count(*) into v_nmaq from manutencao.maquinas where ativo and not manual;

  r := r || jsonb_build_object('manutencao', (
    with pz as (
      select os_id, sum(greatest(0, extract(epoch from (retomado_em - pausado_em)))) seg
      from manutencao.os_pausas where retomado_em is not null group by 1
    ),
    os as (
      select o.id, o.maquina_id, mq.nome,
             date_trunc('month', o.aberto_em at time zone 'America/Sao_Paulo')::date mes_d,
             (o.aberto_em at time zone 'America/Sao_Paulo')::date dia,
             o.maquina_parada,
             case when o.fechado_em is not null and o.maquina_parada
                  then greatest(0, extract(epoch from (o.fechado_em - o.aberto_em)) - coalesce(pz.seg, 0)) / 3600.0 end horas
      from manutencao.ordens_servico o
      join manutencao.maquinas mq on mq.id = o.maquina_id
      left join pz on pz.os_id = o.id
      where o.status::text <> 'cancelada' and mq.ativo and not mq.manual
        and (o.categoria_falha is null or o.categoria_falha <> 'invalido')
        and (o.aberto_em at time zone 'America/Sao_Paulo')::date >= v_ini
    ),
    mes as (
      select mes_d, count(*) n_os, count(*) filter (where maquina_parada) falhas,
             count(horas) fechadas, coalesce(sum(horas), 0) horas_paradas,
             (select count(*) from generate_series(mes_d, least((mes_d + interval '1 month - 1 day')::date, v_hoje), interval '1 day') d
               where extract(isodow from d) < 6) dias_uteis
      from os group by mes_d
    ),
    calc as (
      select to_char(mes_d, 'YYYY-MM') m, n_os, falhas, fechadas, horas_paradas, v_nmaq * 8 * dias_uteis horas_disp
      from mes
    ),
    top as (
      select to_char(mes_d, 'YYYY-MM') m, nome, count(*) n, count(*) filter (where maquina_parada) paradas
      from os group by 1, 2
    ),
    top_rk as (select *, row_number() over (partition by m order by n desc, paradas desc, nome) rk from top),
    prev as (
      select to_char(p.data_agendada, 'YYYY-MM') m, count(*) tot,
             count(*) filter (where p.status::text in ('concluida', 'antecipada')) ok
      from manutencao.preventivas p join manutencao.maquinas mq on mq.id = p.maquina_id
      where mq.ativo and not mq.manual and p.data_agendada >= v_ini
      group by 1
    )
    select jsonb_build_object(
      'maquinas_base', v_nmaq,
      'disponibilidade', coalesce((select jsonb_object_agg(m, case when horas_disp > 0
          then round(greatest(0, (horas_disp - horas_paradas) / horas_disp) * 100, 1) end) from calc), '{}'::jsonb),
      'mttr', coalesce((select jsonb_object_agg(m, case when fechadas > 0 then round(horas_paradas / fechadas, 1) else 0 end) from calc), '{}'::jsonb),
      'mtbf', coalesce((select jsonb_object_agg(m, case when falhas > 0 then round(horas_disp::numeric / falhas) else 0 end) from calc), '{}'::jsonb),
      'os', coalesce((select jsonb_object_agg(m, n_os) from calc), '{}'::jsonb),
      'os_mesmo_periodo', (select count(*) from os where dia between v_ant_ini and v_ant_fim),
      'preventivas_pct', coalesce((select jsonb_object_agg(m, round(100.0 * ok / tot, 1)) from prev where tot > 0), '{}'::jsonb),
      'preventivas_base', coalesce((select jsonb_object_agg(m, jsonb_build_array(ok, tot)) from prev), '{}'::jsonb),
      'top5_maquinas', coalesce((select jsonb_object_agg(m, lst) from (
          select m, jsonb_agg(jsonb_build_array(nome, n, paradas) order by rk) lst from top_rk where rk <= 5 group by m) t), '{}'::jsonb),
      'paradas_agora', coalesce((select jsonb_agg(jsonb_build_array(mq.nome, o.aberto_em) order by o.aberto_em)
          from manutencao.ordens_servico o join manutencao.maquinas mq on mq.id = o.maquina_id
          where o.maquina_parada and o.fechado_em is null and o.status::text <> 'cancelada'
            and mq.ativo and not mq.manual), '[]'::jsonb),
      'os_em_aberto', (select jsonb_build_object(
          'aberta', count(*) filter (where o.status::text = 'aberta'),
          'em_andamento', count(*) filter (where o.status::text = 'em_andamento'))
          from manutencao.ordens_servico o join manutencao.maquinas mq on mq.id = o.maquina_id
          where mq.ativo and not mq.manual),
      'ultimo_registro', (select max(updated_at) from manutencao.ordens_servico)
    )
  ));

  -- ===== COMPRAS (regra da tela Compras → Indicadores) =====
  -- Comprado = Σ purchase_amount (> 0) pelo mês da data da compra. "Fornecedor cumpriu o prometido" = chegadas com
  -- data (UTC, como o app) ≤ data prometida ÷ chegadas com data prometida. "Compra → Chegada" = média em dias.
  r := r || jsonb_build_object('compras', (
    with req as (
      select r.*, (r.purchased_at at time zone 'America/Sao_Paulo')::date dc,
             (r.arrived_at at time zone 'America/Sao_Paulo')::date dch
      from compras.purchase_requests r
    ),
    cc as (
      select to_char(dc, 'YYYY-MM') m, coalesce(c.name, 'Sem CC') centro, sum(purchase_amount) v, count(*) n
      from req left join compras.cost_centers c on c.id = req.cost_center_id
      where purchased_at is not null and purchase_amount > 0 and dc >= v_ini
      group by 1, 2
    ),
    cc_rk as (select *, row_number() over (partition by m order by v desc, centro) rk from cc)
    select jsonb_build_object(
      'comprado', coalesce((select jsonb_object_agg(m, v) from (
          select to_char(dc, 'YYYY-MM') m, round(sum(purchase_amount), 2) v from req
          where purchased_at is not null and purchase_amount > 0 and dc >= v_ini group by 1) t), '{}'::jsonb),
      'comprado_mesmo_periodo', (select coalesce(round(sum(purchase_amount), 2), 0) from req
          where purchased_at is not null and purchase_amount > 0 and dc between v_ant_ini and v_ant_fim),
      'fornecedor_cumpriu', coalesce((select jsonb_object_agg(m, jsonb_build_array(pct, base)) from (
          select to_char(dch, 'YYYY-MM') m, count(*) base,
                 round(100.0 * count(*) filter (where (arrived_at at time zone 'UTC')::date <= expected_delivery_date) / count(*)) pct
          from req where arrived_at is not null and expected_delivery_date is not null and dch >= v_ini group by 1) t), '{}'::jsonb),
      'compra_chegada_dias', coalesce((select jsonb_object_agg(m, v) from (
          select to_char(dch, 'YYYY-MM') m, round(avg(extract(epoch from (arrived_at - purchased_at)) / 86400)::numeric, 1) v
          from req where arrived_at is not null and purchased_at is not null and dch >= v_ini group by 1) t), '{}'::jsonb),
      'top5_centros', coalesce((select jsonb_object_agg(m, lst) from (
          select m, jsonb_agg(jsonb_build_array(centro, v, n) order by rk) lst from cc_rk where rk <= 5 group by m) t), '{}'::jsonb),
      'ultimo_registro', (select max(updated_at) from compras.purchase_requests)
    )
  ));

  -- ===== RH (mesma fórmula do painel do RH: calcAbs / calcTurn; só totais da empresa) =====
  r := r || jsonb_build_object('rh', (
    with mm as (
      select ano, mes, du, atest, falt, liber, adm, dem_v, dem_i,
             case when fim > 0 then (ini + fim) / 2.0 else ini end ef
      from rh.meses where ini > 0 or fim > 0
    )
    select jsonb_build_object(
      'absenteismo', coalesce((select jsonb_object_agg(ano || '-' || lpad(mes::text, 2, '0'),
          case when du * ef > 0 then round((atest + falt + liber) / (du * ef) * 100, 2) else 0 end) from mm), '{}'::jsonb),
      'turnover', coalesce((select jsonb_object_agg(ano || '-' || lpad(mes::text, 2, '0'),
          case when ef > 0 then round(((adm + dem_v + dem_i) / 2.0) / ef * 100, 2) else 0 end) from mm), '{}'::jsonb),
      'metas', (select meta from rh.config limit 1)
    )
  ));

  -- ===== SEGURANÇA (Acidentes + Programa de Segurança) =====
  r := r || jsonb_build_object('seguranca', jsonb_build_object(
    'acidentes', coalesce((select jsonb_object_agg(m, n) from (
        select to_char(data, 'YYYY-MM') m, count(*) n from teste.acidentes where data >= v_ini group by 1) t), '{}'::jsonb),
    'acidentes_mesmo_periodo', (select count(*) from teste.acidentes where data between v_ant_ini and v_ant_fim),
    'ultimo_acidente', (select max(data) from teste.acidentes where data <= v_hoje),
    'ultimo_lancamento', (select max(created_at) from teste.acidentes),
    -- média do mês = round(média das notas dos setores), como o dashboard do app
    'nota', coalesce((select jsonb_object_agg(m, n) from (
        select ano || '-' || lpad(mes::text, 2, '0') m, round(avg(nota)) n from seguranca.avaliacoes
        where make_date(ano, mes, 1) >= v_ini group by ano, mes) t), '{}'::jsonb),
    'top5_menor_nota', coalesce((select jsonb_object_agg(m, lst) from (
        select m, jsonb_agg(jsonb_build_array(setor, nota) order by rk) lst from (
          select ano || '-' || lpad(mes::text, 2, '0') m, setor, nota,
                 row_number() over (partition by ano, mes order by nota asc, ocorrencia desc, setor) rk
          from seguranca.avaliacoes where make_date(ano, mes, 1) >= v_ini) x
        where rk <= 5 group by m) t), '{}'::jsonb),
    'ultimo_registro', (select max(updated_at) from seguranca.avaliacoes)
  ));

  -- ===== METAS (histórico) =====
  r := r || jsonb_build_object('metas', coalesce((select jsonb_object_agg(chave, lst) from (
      select chave, jsonb_agg(jsonb_build_object('desde', vigente_desde, 'meta', meta, 'tipo', tipo, 'unidade', unidade)
                              order by vigente_desde) lst
      from gestao.kpi_metas_vigencia group by chave) t), '{}'::jsonb));

  return r;
end $$;

revoke all on function gestao.tv_painel(int) from public, anon;
grant execute on function gestao.tv_painel(int) to authenticated;

-- ------------------------------------------------------------
-- 3) Setores ao vivo (Hora a Hora por máquina e por hora)
--    As contas de ritmo (meta efetiva, meia hora das 8h, hora extra) ficam no app, copiadas do
--    hora-hora-fabrill/src/lib/time-slots.ts, para o painel calcular exatamente como o Hora a Hora.
-- ------------------------------------------------------------
create or replace function gestao.tv_setores(p_dia date default null)
returns jsonb
language plpgsql stable security definer set search_path = gestao, public
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_dia  date := coalesce(p_dia, (now() at time zone 'America/Sao_Paulo')::date);
  v_ini  date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
begin
  if not gestao.is_gestor() then  -- qualquer pessoa com acesso ao Gerencial (decisão de 09/10)
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'lido_em', now(),
    'dia', v_dia,
    'hora_extra', coalesce((select enabled from fabrill.overtime_days where day = v_dia), false),
    'maquinas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'area', a.name, 'area_ordem', a.sort_order, 'maquina', m.name, 'ordem', m.sort_order,
               'meta', coalesce(g.goal, 0),
               'slots', coalesce((select jsonb_agg(jsonb_build_array(e.hour_slot, e.quantity) order by e.hour_slot)
                                  from fabrill.production_entries e where e.machine_id = m.id and e.entry_date = v_dia), '[]'::jsonb),
               'ultimo', (select max(e.updated_at) from fabrill.production_entries e where e.machine_id = m.id and e.entry_date = v_dia)
             ) order by a.sort_order, m.sort_order, m.name)
      from fabrill.machines m
      join fabrill.areas a on a.id = m.area_id
      left join fabrill.production_goals g on g.machine_id = m.id and g.goal_date = v_dia
    ), '[]'::jsonb),
    -- setores que já lançaram alguma vez (os que nunca lançam ficam escondidos no painel)
    'areas_ativas', coalesce((
      select jsonb_agg(distinct a.name)
      from fabrill.areas a join fabrill.machines m on m.area_id = a.id
      where exists (select 1 from fabrill.production_goals g where g.machine_id = m.id and g.goal_date >= v_hoje - 60)
         or exists (select 1 from fabrill.production_entries e where e.machine_id = m.id and e.entry_date >= v_hoje - 60)
    ), '[]'::jsonb),
    -- acumulado do mês até ONTEM por setor, regra do Hora a Hora (todos os lançamentos)
    'mes_ate_ontem', coalesce((
      select jsonb_object_agg(a.name, jsonb_build_array(
               (select coalesce(sum(e.quantity), 0) from fabrill.production_entries e join fabrill.machines m on m.id = e.machine_id
                 where m.area_id = a.id and e.entry_date >= v_ini and e.entry_date < v_hoje),
               (select coalesce(sum(g.goal), 0) from fabrill.production_goals g join fabrill.machines m on m.id = g.machine_id
                 where m.area_id = a.id and g.goal_date >= v_ini and g.goal_date < v_hoje)))
      from fabrill.areas a
    ), '{}'::jsonb)
  );
end $$;

revoke all on function gestao.tv_setores(date) from public, anon;
grant execute on function gestao.tv_setores(date) to authenticated;

notify pgrst, 'reload schema';

-- Teste rápido (logado como diretoria):
--   select gestao.tv_painel(12);
--   select gestao.tv_setores();
