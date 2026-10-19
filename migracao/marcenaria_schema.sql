-- ============================================================
-- SCHEMA: marcenaria   (app "Marcenaria", repo marcenaria-solucao)
-- Cronômetro por máquina: START / PAUSA (motivo) / RETOMAR / ENCERRAR
-- + lançamento de peças com o tempo correndo. O hora a hora, o tempo
-- produtivo e o tempo parado saem dos EVENTOS (não são digitados).
--
-- Papéis: admin | lider | visualizador
--   admin/lider -> operam o cronômetro, cadastram máquinas e metas, corrigem
--   visualizador -> só consulta (Controle e Dashboard)
--   master@solucaomoveis.ind.br -> tratado como admin
--
-- App começa ZERADO. Rodar no SQL Editor do Supabase SMERP, do começo ao fim.
-- Depois: expor 'marcenaria' no PostgREST (PGRST_DB_SCHEMAS) e reiniciar.
-- ============================================================

create schema if not exists marcenaria;
grant usage on schema marcenaria to anon, authenticated, service_role;
alter default privileges in schema marcenaria grant all on tables    to authenticated, service_role;
alter default privileges in schema marcenaria grant all on functions to authenticated, service_role;
alter default privileges in schema marcenaria grant all on sequences to authenticated, service_role;

-- ---------- ENUMS ----------
create type marcenaria.app_role      as enum ('admin', 'lider', 'visualizador');
create type marcenaria.sessao_status as enum ('rodando', 'pausada', 'encerrada');
create type marcenaria.evento_tipo   as enum ('start', 'pausa', 'retomar', 'end');

-- ---------- TABELAS ----------
create table marcenaria.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create table marcenaria.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role marcenaria.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table marcenaria.maquinas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem int not null default 0,
  meta_padrao int not null default 0 check (meta_padrao >= 0),  -- peças/dia quando não há meta específica
  ativo boolean not null default true,                            -- arquivar em vez de apagar
  created_at timestamptz not null default now()
);

-- meta específica de um dia (sobrepõe a meta_padrao da máquina)
create table marcenaria.metas (
  id uuid primary key default gen_random_uuid(),
  maquina_id uuid not null references marcenaria.maquinas(id) on delete cascade,
  data date not null,
  meta_pecas int not null check (meta_pecas >= 0),
  created_at timestamptz not null default now(),
  unique (maquina_id, data)
);

create table marcenaria.sessoes (
  id uuid primary key default gen_random_uuid(),
  maquina_id uuid not null references marcenaria.maquinas(id) on delete cascade,
  data date not null,                       -- dia (America/Sao_Paulo) em que começou
  iniciado_em timestamptz not null,
  encerrado_em timestamptz,
  status marcenaria.sessao_status not null default 'rodando',
  fechado_auto boolean not null default false,
  iniciado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
-- no máximo UMA sessão aberta por máquina
create unique index uq_marcenaria_sessao_aberta
  on marcenaria.sessoes(maquina_id) where status <> 'encerrada';
create index idx_marcenaria_sessoes_data on marcenaria.sessoes(data);

create table marcenaria.eventos (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references marcenaria.sessoes(id) on delete cascade,
  tipo marcenaria.evento_tipo not null,
  em timestamptz not null,
  observacao text,                          -- motivo da parada (texto livre)
  planejada boolean not null default false, -- pausa planejada (almoço/café): não conta como parada
  lancado_por uuid references auth.users(id) on delete set null
);
create index idx_marcenaria_eventos_sessao on marcenaria.eventos(sessao_id, em);

create table marcenaria.producoes (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references marcenaria.sessoes(id) on delete cascade,
  maquina_id uuid not null references marcenaria.maquinas(id) on delete cascade,
  quantidade int not null check (quantidade > 0),
  lancado_em timestamptz not null default now(),
  lancado_por uuid references auth.users(id) on delete set null
);
create index idx_marcenaria_producoes_sessao on marcenaria.producoes(sessao_id);
create index idx_marcenaria_producoes_em on marcenaria.producoes(lancado_em);

-- trilha de correções feitas no Histórico
create table marcenaria.ajustes (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid references marcenaria.sessoes(id) on delete cascade,
  tabela text not null,
  registro_id uuid not null,
  acao text not null,                       -- 'alterar' | 'excluir'
  antes jsonb,
  depois jsonb,
  feito_por uuid references auth.users(id) on delete set null,
  feito_em timestamptz not null default now()
);

-- ---------- ACESSO (security definer) ----------
create or replace function marcenaria.is_master()
returns boolean language sql stable security definer set search_path = marcenaria, public
as $$
  select exists (select 1 from auth.users where id = auth.uid() and lower(email) = 'master@solucaomoveis.ind.br')
$$;

create or replace function marcenaria.has_access(_user_id uuid)
returns boolean language sql stable security definer set search_path = marcenaria, public
as $$
  select exists (select 1 from marcenaria.profiles where id = _user_id)
      or (_user_id = auth.uid() and marcenaria.is_master())
$$;

create or replace function marcenaria.has_role(_user_id uuid, _role marcenaria.app_role)
returns boolean language sql stable security definer set search_path = marcenaria, public
as $$
  select exists (select 1 from marcenaria.user_roles where user_id = _user_id and role = _role)
$$;

-- pode operar o cronômetro / cadastrar / corrigir
create or replace function marcenaria.can_edit(_user_id uuid)
returns boolean language sql stable security definer set search_path = marcenaria, public
as $$
  select marcenaria.has_role(_user_id, 'admin')
      or marcenaria.has_role(_user_id, 'lider')
      or (_user_id = auth.uid() and marcenaria.is_master())
$$;

-- papel efetivo do usuário logado (o app usa pra montar as telas)
create or replace function marcenaria.meu_acesso()
returns jsonb language sql stable security definer set search_path = marcenaria, public
as $$
  select jsonb_build_object(
    'acesso', marcenaria.has_access(auth.uid()),
    'papel', case
      when marcenaria.is_master() or marcenaria.has_role(auth.uid(), 'admin') then 'admin'
      when marcenaria.has_role(auth.uid(), 'lider') then 'lider'
      when marcenaria.has_access(auth.uid()) then 'visualizador'
    end
  )
$$;

-- ---------- RLS ----------
alter table marcenaria.profiles   enable row level security;
alter table marcenaria.user_roles enable row level security;
alter table marcenaria.maquinas   enable row level security;
alter table marcenaria.metas      enable row level security;
alter table marcenaria.sessoes    enable row level security;
alter table marcenaria.eventos    enable row level security;
alter table marcenaria.producoes  enable row level security;
alter table marcenaria.ajustes    enable row level security;

create policy "profiles leitura"   on marcenaria.profiles   for select to authenticated using (marcenaria.has_access(auth.uid()));
create policy "user_roles leitura" on marcenaria.user_roles for select to authenticated using (marcenaria.has_access(auth.uid()));
-- (profiles/user_roles são escritos pelo Hub: admin_create_user / admin_set_user_systems)

create policy "maquinas leitura" on marcenaria.maquinas for select to authenticated using (marcenaria.has_access(auth.uid()));
create policy "maquinas escrita" on marcenaria.maquinas for all to authenticated
  using (marcenaria.can_edit(auth.uid())) with check (marcenaria.can_edit(auth.uid()));

create policy "metas leitura" on marcenaria.metas for select to authenticated using (marcenaria.has_access(auth.uid()));
create policy "metas escrita" on marcenaria.metas for all to authenticated
  using (marcenaria.can_edit(auth.uid())) with check (marcenaria.can_edit(auth.uid()));

-- sessões, eventos e produções: só LEITURA direta. Toda escrita passa pelas
-- RPCs abaixo (que validam a transição e o papel), pra nunca ficar estado inválido.
create policy "sessoes leitura"   on marcenaria.sessoes   for select to authenticated using (marcenaria.has_access(auth.uid()));
create policy "eventos leitura"   on marcenaria.eventos   for select to authenticated using (marcenaria.has_access(auth.uid()));
create policy "producoes leitura" on marcenaria.producoes for select to authenticated using (marcenaria.has_access(auth.uid()));
create policy "ajustes leitura"   on marcenaria.ajustes   for select to authenticated using (marcenaria.has_access(auth.uid()));

grant select on all tables in schema marcenaria to authenticated;
grant insert, update, delete on marcenaria.maquinas, marcenaria.metas to authenticated;
grant all on all tables in schema marcenaria to service_role;

-- ---------- TURNO ----------
create or replace function marcenaria.hoje()
returns date language sql stable
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- fim do expediente normal do dia: seg-qui 17h, sex/sáb/dom 16h (igual ao Hora a Hora)
create or replace function marcenaria.fim_turno(_d date)
returns timestamptz language sql stable
as $$
  select ((_d + case when extract(isodow from _d) >= 5 then time '16:00' else time '17:00' end)
          at time zone 'America/Sao_Paulo')
$$;

-- Fecha sessões esquecidas abertas: de dias anteriores, ou de hoje depois das 19h30
-- (fim da hora extra). Fecha no maior entre o fim do turno e a última atividade
-- (evento ou peça), marcando fechado_auto pro líder revisar no Histórico.
create or replace function marcenaria.fechar_sessoes_vencidas()
returns int language plpgsql security definer set search_path = marcenaria, public
as $$
declare
  s record;
  v_fim timestamptz;
  n int := 0;
begin
  for s in
    select * from marcenaria.sessoes
    where status <> 'encerrada'
      and (data < marcenaria.hoje()
           or now() > ((data + time '19:30') at time zone 'America/Sao_Paulo'))
    for update skip locked
  loop
    select greatest(
      marcenaria.fim_turno(s.data),
      coalesce((select max(em) from marcenaria.eventos where sessao_id = s.id), s.iniciado_em),
      coalesce((select max(lancado_em) from marcenaria.producoes where sessao_id = s.id), s.iniciado_em)
    ) into v_fim;
    insert into marcenaria.eventos (sessao_id, tipo, em, observacao)
      values (s.id, 'end', v_fim, 'Fechado automático (esquecido aberto)');
    update marcenaria.sessoes
      set status = 'encerrada', encerrado_em = v_fim, fechado_auto = true
      where id = s.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------- RPCs DO CRONÔMETRO ----------
create or replace function marcenaria._exige_editor()
returns void language plpgsql stable security definer set search_path = marcenaria, public
as $$
begin
  if not marcenaria.can_edit(auth.uid()) then
    raise exception 'Sem permissão: só líder ou administrador opera o cronômetro.' using errcode = '42501';
  end if;
end;
$$;

create or replace function marcenaria._sessao_para(_sessao uuid)
returns marcenaria.sessoes language plpgsql security definer set search_path = marcenaria, public
as $$
declare s marcenaria.sessoes;
begin
  select * into s from marcenaria.sessoes where id = _sessao for update;
  if not found then raise exception 'Sessão não encontrada.'; end if;
  return s;
end;
$$;

create or replace function marcenaria.iniciar(_maquina uuid)
returns uuid language plpgsql security definer set search_path = marcenaria, public
as $$
declare v_id uuid;
begin
  perform marcenaria._exige_editor();
  perform marcenaria.fechar_sessoes_vencidas();
  if not exists (select 1 from marcenaria.maquinas where id = _maquina and ativo) then
    raise exception 'Máquina não encontrada ou arquivada.';
  end if;
  if exists (select 1 from marcenaria.sessoes where maquina_id = _maquina and status <> 'encerrada') then
    raise exception 'Esta máquina já está com o cronômetro aberto.';
  end if;
  insert into marcenaria.sessoes (maquina_id, data, iniciado_em, status, iniciado_por)
    values (_maquina, marcenaria.hoje(), now(), 'rodando', auth.uid())
    returning id into v_id;
  insert into marcenaria.eventos (sessao_id, tipo, em, lancado_por)
    values (v_id, 'start', now(), auth.uid());
  return v_id;
end;
$$;

create or replace function marcenaria.pausar(_sessao uuid, _motivo text, _planejada boolean default false)
returns void language plpgsql security definer set search_path = marcenaria, public
as $$
declare s marcenaria.sessoes;
begin
  perform marcenaria._exige_editor();
  s := marcenaria._sessao_para(_sessao);
  if s.status <> 'rodando' then raise exception 'Só dá pra pausar uma máquina rodando.'; end if;
  insert into marcenaria.eventos (sessao_id, tipo, em, observacao, planejada, lancado_por)
    values (_sessao, 'pausa', now(), nullif(trim(coalesce(_motivo, '')), ''), coalesce(_planejada, false), auth.uid());
  update marcenaria.sessoes set status = 'pausada' where id = _sessao;
end;
$$;

create or replace function marcenaria.retomar(_sessao uuid)
returns void language plpgsql security definer set search_path = marcenaria, public
as $$
declare s marcenaria.sessoes;
begin
  perform marcenaria._exige_editor();
  s := marcenaria._sessao_para(_sessao);
  if s.status <> 'pausada' then raise exception 'Só dá pra retomar uma máquina pausada.'; end if;
  insert into marcenaria.eventos (sessao_id, tipo, em, lancado_por)
    values (_sessao, 'retomar', now(), auth.uid());
  update marcenaria.sessoes set status = 'rodando' where id = _sessao;
end;
$$;

create or replace function marcenaria.encerrar(_sessao uuid)
returns void language plpgsql security definer set search_path = marcenaria, public
as $$
declare s marcenaria.sessoes;
begin
  perform marcenaria._exige_editor();
  s := marcenaria._sessao_para(_sessao);
  if s.status = 'encerrada' then raise exception 'Esta sessão já foi encerrada.'; end if;
  insert into marcenaria.eventos (sessao_id, tipo, em, lancado_por)
    values (_sessao, 'end', now(), auth.uid());
  update marcenaria.sessoes set status = 'encerrada', encerrado_em = now() where id = _sessao;
end;
$$;

-- encerra todas as máquinas abertas (botão "Encerrar tudo" do fim do turno)
create or replace function marcenaria.encerrar_todas()
returns int language plpgsql security definer set search_path = marcenaria, public
as $$
declare s record; n int := 0;
begin
  perform marcenaria._exige_editor();
  for s in select id from marcenaria.sessoes where status <> 'encerrada' for update loop
    insert into marcenaria.eventos (sessao_id, tipo, em, lancado_por)
      values (s.id, 'end', now(), auth.uid());
    update marcenaria.sessoes set status = 'encerrada', encerrado_em = now() where id = s.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function marcenaria.lancar_pecas(_sessao uuid, _qtd int)
returns void language plpgsql security definer set search_path = marcenaria, public
as $$
declare s marcenaria.sessoes;
begin
  perform marcenaria._exige_editor();
  if _qtd is null or _qtd <= 0 or _qtd > 100000 then raise exception 'Quantidade inválida.'; end if;
  s := marcenaria._sessao_para(_sessao);
  if s.status <> 'rodando' then raise exception 'Peças só podem ser lançadas com a máquina rodando.'; end if;
  insert into marcenaria.producoes (sessao_id, maquina_id, quantidade, lancado_em, lancado_por)
    values (_sessao, s.maquina_id, _qtd, now(), auth.uid());
end;
$$;

-- desfaz o último lançamento de peças da sessão (botão "desfazer")
create or replace function marcenaria.desfazer_ultimo_lancamento(_sessao uuid)
returns int language plpgsql security definer set search_path = marcenaria, public
as $$
declare p marcenaria.producoes;
begin
  perform marcenaria._exige_editor();
  select * into p from marcenaria.producoes where sessao_id = _sessao
    order by lancado_em desc limit 1 for update;
  if not found then raise exception 'Nenhum lançamento para desfazer.'; end if;
  insert into marcenaria.ajustes (sessao_id, tabela, registro_id, acao, antes, feito_por)
    values (_sessao, 'producoes', p.id, 'excluir', to_jsonb(p), auth.uid());
  delete from marcenaria.producoes where id = p.id;
  return p.quantidade;
end;
$$;

-- ---------- CORREÇÕES (Histórico) ----------
-- muda o horário de um evento, mantendo a ordem dos eventos da sessão
create or replace function marcenaria.ajustar_evento(_evento uuid, _em timestamptz, _observacao text default null)
returns void language plpgsql security definer set search_path = marcenaria, public
as $$
declare e marcenaria.eventos; v_ant timestamptz; v_prox timestamptz;
begin
  perform marcenaria._exige_editor();
  select * into e from marcenaria.eventos where id = _evento for update;
  if not found then raise exception 'Evento não encontrado.'; end if;
  select max(em) into v_ant from marcenaria.eventos where sessao_id = e.sessao_id and em < e.em and id <> e.id;
  select min(em) into v_prox from marcenaria.eventos where sessao_id = e.sessao_id and em > e.em and id <> e.id;
  if (v_ant is not null and _em <= v_ant) or (v_prox is not null and _em >= v_prox) then
    raise exception 'O novo horário precisa ficar entre o evento anterior e o próximo.';
  end if;
  if _em > now() then raise exception 'Horário no futuro.'; end if;
  update marcenaria.eventos
    set em = _em,
        observacao = case when e.tipo = 'pausa' then coalesce(nullif(trim(_observacao), ''), e.observacao) else e.observacao end
    where id = _evento;
  if e.tipo = 'start' then update marcenaria.sessoes set iniciado_em = _em where id = e.sessao_id; end if;
  if e.tipo = 'end'   then update marcenaria.sessoes set encerrado_em = _em where id = e.sessao_id; end if;
  insert into marcenaria.ajustes (sessao_id, tabela, registro_id, acao, antes, depois, feito_por)
    values (e.sessao_id, 'eventos', e.id, 'alterar', to_jsonb(e),
            (select to_jsonb(x) from marcenaria.eventos x where x.id = _evento), auth.uid());
end;
$$;

-- muda a quantidade de um lançamento (0 = excluir)
create or replace function marcenaria.ajustar_producao(_producao uuid, _qtd int)
returns void language plpgsql security definer set search_path = marcenaria, public
as $$
declare p marcenaria.producoes;
begin
  perform marcenaria._exige_editor();
  select * into p from marcenaria.producoes where id = _producao for update;
  if not found then raise exception 'Lançamento não encontrado.'; end if;
  if _qtd is null or _qtd < 0 or _qtd > 100000 then raise exception 'Quantidade inválida.'; end if;
  if _qtd = 0 then
    insert into marcenaria.ajustes (sessao_id, tabela, registro_id, acao, antes, feito_por)
      values (p.sessao_id, 'producoes', p.id, 'excluir', to_jsonb(p), auth.uid());
    delete from marcenaria.producoes where id = _producao;
  else
    update marcenaria.producoes set quantidade = _qtd where id = _producao;
    insert into marcenaria.ajustes (sessao_id, tabela, registro_id, acao, antes, depois, feito_por)
      values (p.sessao_id, 'producoes', p.id, 'alterar', to_jsonb(p),
              jsonb_build_object('quantidade', _qtd), auth.uid());
  end if;
end;
$$;

-- ---------- LEITURA / INDICADORES ----------
-- Intervalos do dia: cada evento start/retomar abre um trecho RODANDO,
-- cada pausa abre um trecho PARADO, até o próximo evento (ou agora, se aberto).
create or replace function marcenaria.intervalos(_data date)
returns table (
  maquina_id uuid, sessao_id uuid, estado text, inicio timestamptz, fim timestamptz,
  segundos numeric, motivo text, planejada boolean
)
language sql stable security definer set search_path = marcenaria, public
as $$
  with ev as (
    select s.maquina_id, e.sessao_id, e.tipo, e.em, e.observacao, e.planejada,
           lead(e.em) over (partition by e.sessao_id order by e.em) as prox
    from marcenaria.eventos e
    join marcenaria.sessoes s on s.id = e.sessao_id
    where s.data = _data and marcenaria.has_access(auth.uid())
  )
  select maquina_id, sessao_id,
         case when tipo = 'pausa' then 'parada' else 'rodando' end,
         em, coalesce(prox, now()),
         extract(epoch from coalesce(prox, now()) - em),
         case when tipo = 'pausa' then observacao end,
         case when tipo = 'pausa' then planejada else false end
  from ev
  where tipo <> 'end'
  order by maquina_id, em
$$;

-- Resumo do dia por máquina (fórmula oficial, usada pra conferir a conta do app)
create or replace function marcenaria.resumo_dia(_data date)
returns table (
  maquina_id uuid, maquina text, meta int, pecas bigint,
  produtivo_seg numeric, parado_seg numeric, planejado_seg numeric
)
language sql stable security definer set search_path = marcenaria, public
as $$
  select m.id, m.nome,
         coalesce(mt.meta_pecas, m.meta_padrao),
         coalesce((select sum(p.quantidade) from marcenaria.producoes p
                   join marcenaria.sessoes s on s.id = p.sessao_id
                   where s.data = _data and p.maquina_id = m.id), 0),
         coalesce((select sum(i.segundos) from marcenaria.intervalos(_data) i
                   where i.maquina_id = m.id and i.estado = 'rodando'), 0),
         coalesce((select sum(i.segundos) from marcenaria.intervalos(_data) i
                   where i.maquina_id = m.id and i.estado = 'parada' and not i.planejada), 0),
         coalesce((select sum(i.segundos) from marcenaria.intervalos(_data) i
                   where i.maquina_id = m.id and i.estado = 'parada' and i.planejada), 0)
  from marcenaria.maquinas m
  left join marcenaria.metas mt on mt.maquina_id = m.id and mt.data = _data
  where marcenaria.has_access(auth.uid())
    and (m.ativo or exists (select 1 from marcenaria.sessoes s where s.maquina_id = m.id and s.data = _data))
  order by m.ordem, m.nome
$$;

-- Tela de Controle numa chamada só: fecha vencidas, devolve a hora do servidor
-- (o app corrige o relógio do aparelho) e o estado de cada máquina hoje.
create or replace function marcenaria.painel_controle()
returns jsonb language plpgsql security definer set search_path = marcenaria, public
as $$
declare v_hoje date;
begin
  if not marcenaria.has_access(auth.uid()) then
    raise exception 'Sem acesso à Marcenaria.' using errcode = '42501';
  end if;
  perform marcenaria.fechar_sessoes_vencidas();
  v_hoje := marcenaria.hoje();
  return jsonb_build_object(
    'agora', now(),
    'data', v_hoje,
    'maquinas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.maquina_id, 'nome', r.maquina, 'meta', r.meta, 'pecas', r.pecas,
        'produtivo_seg', r.produtivo_seg, 'parado_seg', r.parado_seg, 'planejado_seg', r.planejado_seg,
        'sessao', (
          select jsonb_build_object('id', s.id, 'status', s.status, 'iniciado_em', s.iniciado_em,
            'ultimo_evento_em', (select max(em) from marcenaria.eventos where sessao_id = s.id),
            'motivo', (select observacao from marcenaria.eventos where sessao_id = s.id and tipo = 'pausa' order by em desc limit 1),
            'planejada', (select planejada from marcenaria.eventos where sessao_id = s.id and tipo = 'pausa' order by em desc limit 1),
            'ultimo_lancamento', (select quantidade from marcenaria.producoes where sessao_id = s.id order by lancado_em desc limit 1))
          from marcenaria.sessoes s where s.maquina_id = r.maquina_id and s.status <> 'encerrada'
        ),
        'sessoes_dia', (select count(*) from marcenaria.sessoes s where s.maquina_id = r.maquina_id and s.data = v_hoje)
      ))
      from marcenaria.resumo_dia(v_hoje) r
      join marcenaria.maquinas m on m.id = r.maquina_id
      where m.ativo
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on all functions in schema marcenaria from public, anon;
grant execute on all functions in schema marcenaria to authenticated, service_role;

-- ---------- REALTIME ----------
alter publication supabase_realtime add table marcenaria.sessoes;
alter publication supabase_realtime add table marcenaria.eventos;
alter publication supabase_realtime add table marcenaria.producoes;
alter table marcenaria.sessoes   replica identity full;
alter table marcenaria.eventos   replica identity full;
alter table marcenaria.producoes replica identity full;

-- ---------- (OPCIONAL) fechamento automático pelo pg_cron ----------
-- Sem isso, as sessões esquecidas fecham na próxima vez que alguém abrir o app.
-- Se a extensão pg_cron existir no SMERP, roda todo dia às 19h40 (22h40 UTC):
--   select cron.schedule('marcenaria-fecha-vencidas', '40 22 * * *',
--     $$select marcenaria.fechar_sessoes_vencidas()$$);

-- ---------- TESTE RÁPIDO (logado como líder/admin no app, ou trocando o auth.uid) ----------
--   select marcenaria.meu_acesso();
--   select * from marcenaria.resumo_dia(marcenaria.hoje());
