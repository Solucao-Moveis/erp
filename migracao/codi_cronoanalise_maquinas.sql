-- ============================================================
-- Cadastro próprio de "máquina" pro Cronotempo (codi.cronoanalise_medicoes),
-- desacoplado de codi.maquinas (que é sobrescrita a cada 5 min pelo coletor
-- do CODI — não dá pra renomear nada lá, se perde no próximo sync).
--
-- Resolve a duplicação de grafia no campo maquina_nome (texto livre até
-- hoje): "BLM" vs "DOBRADEIRA BLM", "OMP" vs "MÁQUINA OMP" etc.
--
-- Idempotente: pode rodar do zero ou reaplicado.
-- ============================================================

-- ---------- CATÁLOGO CANÔNICO ----------
create table if not exists codi.cronoanalise_maquinas (
  id         bigint generated always as identity primary key,
  nome       text not null unique,
  maquina_id integer references codi.maquinas(id),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  criado_por uuid references codi.profiles(id)
);

-- ---------- APELIDOS (grafia antiga → máquina canônica) ----------
create table if not exists codi.cronoanalise_maquinas_apelidos (
  id            bigint generated always as identity primary key,
  maquina_id    bigint not null references codi.cronoanalise_maquinas(id) on delete cascade,
  nome_variante text not null unique,
  criado_em     timestamptz not null default now()
);

-- Seed: uma linha canônica pra cada máquina real hoje sincronizada do CODI
insert into codi.cronoanalise_maquinas (nome, maquina_id)
select m.name, m.id
from codi.maquinas m
where m.name is not null
on conflict (nome) do nothing;

-- ============================================================
-- RECÁLCULO DE AGREGADO (mesma fórmula do registrarMedicaoCrono em
-- queries.ts: média de tempo_seg + lista de máquinas distintas envolvidas
-- separadas por " + "). Reimplementado aqui só pra rodar dentro das
-- functions de rename/merge abaixo, mantendo a operação atômica.
-- ============================================================
create or replace function codi.crono_recalcular_agregado(p_codigo_item text, p_operacao text)
returns void
language plpgsql
security definer set search_path = codi, public
as $$
declare
  v_media    numeric;
  v_maquinas text;
begin
  select round(avg(tempo_seg)::numeric, 4),
         string_agg(distinct maquina_nome, ' + ' order by maquina_nome)
    into v_media, v_maquinas
  from codi.cronoanalise_medicoes
  where codigo_item = p_codigo_item and operacao = p_operacao;

  delete from codi.produto_tempos_maquina
  where codigo_item = p_codigo_item and operacao = p_operacao;

  if v_media is not null then
    insert into codi.produto_tempos_maquina (codigo_item, maquina_nome, operacao, tempo_seg, fonte)
    values (p_codigo_item, v_maquinas, p_operacao, v_media, 'manual');
  end if;
end;
$$;

-- ============================================================
-- Versões INTERNAS (sem checar papel) — usadas pela seed no fim deste
-- arquivo, que roda direto no SQL Editor (sessão sem auth.uid(), então
-- codi.has_role() sempre daria falso ali). As functions públicas abaixo
-- é que checam gestor antes de chamar estas.
-- ============================================================
create or replace function codi._crono_renomear_maquina_interna(p_maquina_id bigint, p_novo_nome text)
returns void
language plpgsql
security definer set search_path = codi, public
as $$
declare
  v_nome_antigo text;
  v_novo_nome   text := trim(p_novo_nome);
  v_afetado     record;
begin
  if v_novo_nome = '' then
    raise exception 'Nome inválido';
  end if;

  select nome into v_nome_antigo from codi.cronoanalise_maquinas where id = p_maquina_id;
  if v_nome_antigo is null then
    raise exception 'Máquina não encontrada';
  end if;

  update codi.cronoanalise_maquinas set nome = v_novo_nome where id = p_maquina_id;

  if v_nome_antigo <> v_novo_nome then
    update codi.cronoanalise_medicoes
       set maquina_nome = v_novo_nome
     where maquina_nome = v_nome_antigo;

    for v_afetado in
      select distinct codigo_item, operacao
      from codi.cronoanalise_medicoes
      where maquina_nome = v_novo_nome
    loop
      perform codi.crono_recalcular_agregado(v_afetado.codigo_item, v_afetado.operacao);
    end loop;
  end if;
end;
$$;

create or replace function codi._crono_mesclar_maquina_interna(p_variante text, p_maquina_destino_id bigint)
returns void
language plpgsql
security definer set search_path = codi, public
as $$
declare
  v_variante      text := trim(p_variante);
  v_nome_destino  text;
  v_afetado       record;
begin
  select nome into v_nome_destino from codi.cronoanalise_maquinas where id = p_maquina_destino_id;
  if v_nome_destino is null then
    raise exception 'Máquina destino não encontrada';
  end if;
  if v_variante = '' or v_variante = v_nome_destino then
    return;
  end if;

  insert into codi.cronoanalise_maquinas_apelidos (maquina_id, nome_variante)
  values (p_maquina_destino_id, v_variante)
  on conflict (nome_variante) do update set maquina_id = excluded.maquina_id;

  update codi.cronoanalise_medicoes
     set maquina_nome = v_nome_destino
   where maquina_nome = v_variante;

  for v_afetado in
    select distinct codigo_item, operacao
    from codi.cronoanalise_medicoes
    where maquina_nome = v_nome_destino
  loop
    perform codi.crono_recalcular_agregado(v_afetado.codigo_item, v_afetado.operacao);
  end loop;
end;
$$;

-- ============================================================
-- Versões PÚBLICAS (checam gestor) — chamadas pelo app via RPC
-- ============================================================
create or replace function codi.crono_renomear_maquina(p_maquina_id bigint, p_novo_nome text)
returns void
language plpgsql
security definer set search_path = codi, public
as $$
begin
  if not codi.has_role('gestor') then
    raise exception 'Apenas gestores podem renomear máquinas';
  end if;
  perform codi._crono_renomear_maquina_interna(p_maquina_id, p_novo_nome);
end;
$$;

create or replace function codi.crono_mesclar_maquina(p_variante text, p_maquina_destino_id bigint)
returns void
language plpgsql
security definer set search_path = codi, public
as $$
begin
  if not codi.has_role('gestor') then
    raise exception 'Apenas gestores podem mesclar máquinas';
  end if;
  perform codi._crono_mesclar_maquina_interna(p_variante, p_maquina_destino_id);
end;
$$;

grant execute on function codi.crono_recalcular_agregado(text, text)  to authenticated;
grant execute on function codi.crono_renomear_maquina(bigint, text)   to authenticated;
grant execute on function codi.crono_mesclar_maquina(text, bigint)    to authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table codi.cronoanalise_maquinas         enable row level security;
alter table codi.cronoanalise_maquinas_apelidos enable row level security;

drop policy if exists ccm_select on codi.cronoanalise_maquinas;
create policy ccm_select on codi.cronoanalise_maquinas
  for select to authenticated using (codi.is_member());

-- criar máquina nova fica tão livre quanto digitar era antes
drop policy if exists ccm_insert on codi.cronoanalise_maquinas;
create policy ccm_insert on codi.cronoanalise_maquinas
  for insert to authenticated with check (codi.is_member());

-- update/delete só via as functions acima (security definer) — sem policy
-- de UPDATE/DELETE pra authenticated aqui de propósito.

drop policy if exists ccma_select on codi.cronoanalise_maquinas_apelidos;
create policy ccma_select on codi.cronoanalise_maquinas_apelidos
  for select to authenticated using (codi.is_member());

grant select, insert on codi.cronoanalise_maquinas to authenticated;
grant select on codi.cronoanalise_maquinas_apelidos to authenticated;

-- ============================================================
-- MERGES DE ALTA CONFIANÇA (grafias que claramente são a mesma máquina
-- cadastrada — conferido ao vivo antes de escrever isso). Rode só depois
-- de já ter as tabelas acima criadas.
--   "BLM"          -> "DOBRADEIRA BLM"
--   "OMP"          -> "MÁQUINA OMP"
--   "LASER K6 151" -> "LX-K6 151"
--   "LASER K6 152" -> "LX-K6 152"
-- ============================================================
do $$
declare
  v_id bigint;
begin
  select id into v_id from codi.cronoanalise_maquinas where nome = 'DOBRADEIRA BLM';
  if v_id is not null then perform codi._crono_mesclar_maquina_interna('BLM', v_id); end if;

  select id into v_id from codi.cronoanalise_maquinas where nome = 'MÁQUINA OMP';
  if v_id is not null then perform codi._crono_mesclar_maquina_interna('OMP', v_id); end if;

  select id into v_id from codi.cronoanalise_maquinas where nome = 'LX-K6 151';
  if v_id is not null then perform codi._crono_mesclar_maquina_interna('LASER K6 151', v_id); end if;

  select id into v_id from codi.cronoanalise_maquinas where nome = 'LX-K6 152';
  if v_id is not null then perform codi._crono_mesclar_maquina_interna('LASER K6 152', v_id); end if;
end $$;

-- ============================================================
-- TESTE rápido (SQL Editor, logado como gestor):
--   select * from codi.cronoanalise_maquinas order by nome;
--   select * from codi.cronoanalise_maquinas_apelidos;
--   select maquina_nome, count(*) from codi.cronoanalise_medicoes
--     where maquina_nome in ('BLM','OMP','LASER K6 151','LASER K6 152') group by 1;
--   -- deve vir vazio (tudo já reescrito pro nome canônico)
-- ============================================================
