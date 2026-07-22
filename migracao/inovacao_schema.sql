-- ============================================================
-- SCHEMA: inovacao   (setor "Inovação" -> aba "Desenvolvimento")
-- ------------------------------------------------------------
-- Kanban de solicitações de desenvolvimento pro dev do ERP:
--   QUALQUER usuário autenticado pode abrir um pedido (não precisa
--   ter perfil neste schema — ver bloco 'inovacao' em my_systems.sql,
--   que libera o acesso pra todo mundo, igual ao 'utilitarios').
--   Todo autenticado vê o quadro completo (todos os cards), mas só quem
--   está em inovacao.gestores arrasta/move os cards, edita datas e resolve.
--
-- Colunas do quadro são um ENUM fixo (não texto livre) porque é UM
-- board só, não multi-projeto: evita a fragilidade de nome de coluna
-- livre (problema visto no Kanban de Projetos do Gerencial).
--
-- O front mora numa página separada (/desenvolvimento/, dentro do mesmo
-- deploy estático do Hub, igual /institucional/) — o Hub só linka pra lá
-- via SSO, não é mais um overlay nativo (isso é só o backend/schema).
--
-- Idempotente: roda do começo ao fim várias vezes no SQL Editor do Supabase.
--
-- ATENÇÃO (PostgREST): o schema 'inovacao' precisa estar exposto na
--   variável PGRST_DB_SCHEMAS (db-schemas) do PostgREST/Supabase no
--   EasyPanel, junto com os demais (public, compras, engenharia, ...).
--   Isso NÃO se roda em SQL — é config do serviço. Sem isso o Hub não
--   enxerga as tabelas via REST.
-- ============================================================

create schema if not exists inovacao;
grant usage on schema inovacao to anon, authenticated, service_role;
alter default privileges in schema inovacao grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema inovacao grant all on functions to anon, authenticated, service_role;
alter default privileges in schema inovacao grant all on sequences to anon, authenticated, service_role;

-- ============================================================
-- ENUM (idempotente via duplicate_object)
-- ============================================================
do $$ begin
  create type inovacao.status_coluna as enum
    ('solicitacao','analise','desenvolvimento','finalizado','recusado');
exception when duplicate_object then null; end $$;

-- ============================================================
-- TABELAS
-- ============================================================

-- Quem gerencia o quadro (arrasta card, muda coluna, define data/motivo).
-- Tabela (não e-mail hardcoded) pra dar pra promover uma 2ª pessoa no
-- futuro só com um insert, sem redeploy de função.
create table if not exists inovacao.gestores (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- O pedido (card do Kanban). Não existe tabela de profiles aqui: qualquer
-- autenticado pode criar, então nome/e-mail do solicitante são um SNAPSHOT
-- tirado de auth.users no momento da criação (mesmo padrão de
-- public.solicitacoes / list_all_solicitacoes).
create table if not exists inovacao.solicitacoes (
  id               uuid primary key default gen_random_uuid(),

  titulo           text not null check (length(btrim(titulo))     between 1 and 160),
  o_que_quer       text not null check (length(btrim(o_que_quer)) between 1 and 4000),
  como_quer        text not null check (length(btrim(como_quer))  between 1 and 4000),
  finalidade       text not null check (length(btrim(finalidade)) between 1 and 4000),
  anexos           jsonb not null default '[]', -- [{path,name}] — opcional (print/tela)

  coluna           inovacao.status_coluna not null default 'solicitacao',
  data_inicio      date,      -- data de início do desenvolvimento, setada livremente pelo gestor
  data_prevista    date,      -- previsão de entrega, setada livremente pelo gestor
  motivo_recusa    text,      -- obrigatório ao mover p/ 'recusado'
  check (coluna <> 'recusado' or coalesce(btrim(motivo_recusa), '') <> ''),

  created_by       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_by_nome  text,
  created_by_email text,
  moved_by         uuid references auth.users(id), -- auditoria: quem moveu por último

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  resolved_at timestamptz -- setado quando entra em 'finalizado'/'recusado' (pro Dashboard)
);
-- (schema já existia em produção sem estas colunas — garante que apareçam)
alter table inovacao.solicitacoes add column if not exists resolved_at timestamptz;
alter table inovacao.solicitacoes add column if not exists data_inicio date;

create index if not exists idx_inov_sol_coluna     on inovacao.solicitacoes (coluna, created_at);
create index if not exists idx_inov_sol_created_by on inovacao.solicitacoes (created_by, created_at desc);

-- Notificações — uma linha por mudança de coluna, avisando quem pediu.
create table if not exists inovacao.notificacoes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  solicitacao_id uuid not null references inovacao.solicitacoes(id) on delete cascade,
  coluna_destino inovacao.status_coluna not null,
  mensagem       text not null,
  lida           boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists idx_inov_notif_user on inovacao.notificacoes (user_id, lida);

-- ============================================================
-- HELPERS de acesso
-- ============================================================
create or replace function inovacao.is_gestor()
returns boolean
language sql stable security definer set search_path = inovacao, public
as $$
  select exists (select 1 from inovacao.gestores where user_id = auth.uid());
$$;
revoke all on function inovacao.is_gestor() from public, anon;
grant execute on function inovacao.is_gestor() to authenticated;

-- ============================================================
-- updated_at automático
-- ============================================================
create or replace function inovacao.touch_updated()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_inov_touch on inovacao.solicitacoes;
create trigger trg_inov_touch
  before update on inovacao.solicitacoes
  for each row execute function inovacao.touch_updated();

-- ============================================================
-- NOTIFICAÇÃO por mudança de coluna (dispara em TODA mudança, com
-- mensagem específica por destino, incluindo motivo/data quando houver).
-- ============================================================
create or replace function inovacao.tg_notifica_mudanca_coluna()
returns trigger
language plpgsql security definer set search_path = inovacao, public
as $$
declare v_msg text;
begin
  v_msg := case new.coluna
    when 'analise'         then 'Sua solicitação "' || new.titulo || '" entrou em análise/priorização.'
    when 'desenvolvimento' then 'Sua solicitação "' || new.titulo || '" entrou em desenvolvimento.'
      || case when new.data_prevista is not null
              then ' Previsão de entrega: ' || to_char(new.data_prevista, 'DD/MM/YYYY') || '.'
              else '' end
    when 'finalizado'      then '✅ Sua solicitação "' || new.titulo || '" foi finalizada!'
    when 'recusado'        then '❌ Sua solicitação "' || new.titulo || '" foi recusada. Motivo: ' || coalesce(new.motivo_recusa, '')
    else 'Sua solicitação "' || new.titulo || '" voltou para a fila.'
  end;
  insert into inovacao.notificacoes (user_id, solicitacao_id, coluna_destino, mensagem)
    values (new.created_by, new.id, new.coluna, v_msg);
  return new;
exception when others then
  return new; -- nunca derruba o mover_solicitacao por causa de um erro aqui
end;
$$;

drop trigger if exists trg_inov_notifica on inovacao.solicitacoes;
create trigger trg_inov_notifica
  after update on inovacao.solicitacoes
  for each row when (old.coluna is distinct from new.coluna)
  execute function inovacao.tg_notifica_mudanca_coluna();

-- ============================================================
-- RPCs
-- ============================================================

-- Abrir solicitação (qualquer autenticado). Valida os 4 campos obrigatórios
-- e tira o snapshot de nome/e-mail de auth.users.
create or replace function inovacao.criar_solicitacao(
  p_titulo     text,
  p_o_que_quer text,
  p_como_quer  text,
  p_finalidade text
)
returns jsonb
language plpgsql security definer set search_path = inovacao, public
as $$
declare
  v_titulo     text := btrim(coalesce(p_titulo, ''));
  v_o_que_quer text := btrim(coalesce(p_o_que_quer, ''));
  v_como_quer  text := btrim(coalesce(p_como_quer, ''));
  v_finalidade text := btrim(coalesce(p_finalidade, ''));
  v_nome  text;
  v_email text;
  v_id    uuid;
begin
  if v_titulo = '' then raise exception 'Informe um título.'; end if;
  if v_o_que_quer = '' then raise exception 'Descreva o que você quer.'; end if;
  if v_como_quer = '' then raise exception 'Descreva como você gostaria que funcionasse.'; end if;
  if v_finalidade = '' then raise exception 'Informe a finalidade/objetivo do pedido.'; end if;

  select coalesce(u.raw_user_meta_data->>'full_name', u.email::text), u.email::text
    into v_nome, v_email
    from auth.users u where u.id = auth.uid();

  insert into inovacao.solicitacoes
    (titulo, o_que_quer, como_quer, finalidade, created_by, created_by_nome, created_by_email)
  values
    (v_titulo, v_o_que_quer, v_como_quer, v_finalidade, auth.uid(), v_nome, v_email)
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;
revoke all on function inovacao.criar_solicitacao(text, text, text, text) from public, anon;
grant execute on function inovacao.criar_solicitacao(text, text, text, text) to authenticated;

-- Anexar prints/arquivos DEPOIS do upload (o storage precisa do id real no path).
create or replace function inovacao.anexar_solicitacao(p_id uuid, p_anexos jsonb)
returns jsonb
language plpgsql security definer set search_path = inovacao, public
as $$
declare v_row inovacao.solicitacoes;
begin
  update inovacao.solicitacoes
     set anexos = anexos || coalesce(p_anexos, '[]'::jsonb)
   where id = p_id and created_by = auth.uid()
  returning * into v_row;
  if not found then raise exception 'Solicitação não encontrada.'; end if;
  return jsonb_build_object('id', v_row.id, 'anexos', v_row.anexos);
end;
$$;
revoke all on function inovacao.anexar_solicitacao(uuid, jsonb) from public, anon;
grant execute on function inovacao.anexar_solicitacao(uuid, jsonb) to authenticated;

-- Minhas solicitações (todo autenticado vê só as próprias).
create or replace function inovacao.minhas_solicitacoes()
returns setof inovacao.solicitacoes
language sql stable security definer set search_path = inovacao, public
as $$
  select * from inovacao.solicitacoes
   where created_by = auth.uid()
   order by created_at desc;
$$;
revoke all on function inovacao.minhas_solicitacoes() from public, anon;
grant execute on function inovacao.minhas_solicitacoes() to authenticated;

-- Quadro completo (todo autenticado vê todos os cards — só gestor arrasta/move/edita).
create or replace function inovacao.quadro()
returns setof inovacao.solicitacoes
language sql stable security definer set search_path = inovacao, public
as $$
  select * from inovacao.solicitacoes order by coluna, created_at;
$$;
revoke all on function inovacao.quadro() from public, anon;
grant execute on function inovacao.quadro() to authenticated;

-- Mover card (só gestor). Exige motivo ao recusar.
create or replace function inovacao.mover_solicitacao(
  p_id uuid,
  p_coluna inovacao.status_coluna,
  p_data_prevista date default null,
  p_motivo_recusa text default null
)
returns jsonb
language plpgsql security definer set search_path = inovacao, public
as $$
declare v_motivo text := nullif(btrim(coalesce(p_motivo_recusa, '')), '');
begin
  if not inovacao.is_gestor() then
    raise exception 'Sem permissão para mover solicitações.' using errcode = '42501';
  end if;
  if p_coluna = 'recusado' and v_motivo is null then
    raise exception 'Informe o motivo da recusa.';
  end if;

  update inovacao.solicitacoes
     set coluna        = p_coluna,
         moved_by       = auth.uid(),
         data_prevista  = case when p_coluna = 'desenvolvimento' then p_data_prevista else data_prevista end,
         motivo_recusa  = case when p_coluna = 'recusado' then v_motivo else motivo_recusa end,
         resolved_at    = case when p_coluna in ('finalizado','recusado') then now() else null end
   where id = p_id;
  if not found then raise exception 'Solicitação não encontrada.'; end if;

  return jsonb_build_object('id', p_id, 'coluna', p_coluna);
end;
$$;
revoke all on function inovacao.mover_solicitacao(uuid, inovacao.status_coluna, date, text) from public, anon;
grant execute on function inovacao.mover_solicitacao(uuid, inovacao.status_coluna, date, text) to authenticated;

-- Excluir chamado (só gestor). Apaga junto as notificações (FK on delete cascade).
create or replace function inovacao.deletar_solicitacao(p_id uuid)
returns void
language plpgsql security definer set search_path = inovacao, public
as $$
begin
  if not inovacao.is_gestor() then
    raise exception 'Sem permissão para excluir solicitações.' using errcode = '42501';
  end if;

  delete from inovacao.solicitacoes where id = p_id;
  if not found then raise exception 'Solicitação não encontrada.'; end if;
end;
$$;
revoke all on function inovacao.deletar_solicitacao(uuid) from public, anon;
grant execute on function inovacao.deletar_solicitacao(uuid) to authenticated;

-- Definir/editar início e previsão de entrega (só gestor), a qualquer momento,
-- independente da coluna atual do card (não precisa arrastar pra 'desenvolvimento').
create or replace function inovacao.definir_datas(
  p_id uuid,
  p_data_inicio date default null,
  p_data_prevista date default null
)
returns jsonb
language plpgsql security definer set search_path = inovacao, public
as $$
begin
  if not inovacao.is_gestor() then
    raise exception 'Sem permissão para definir datas.' using errcode = '42501';
  end if;

  update inovacao.solicitacoes
     set data_inicio   = p_data_inicio,
         data_prevista = p_data_prevista
   where id = p_id;
  if not found then raise exception 'Solicitação não encontrada.'; end if;

  return jsonb_build_object('id', p_id, 'data_inicio', p_data_inicio, 'data_prevista', p_data_prevista);
end;
$$;
revoke all on function inovacao.definir_datas(uuid, date, date) from public, anon;
grant execute on function inovacao.definir_datas(uuid, date, date) to authenticated;

-- Badge da sidebar: gestor -> pendentes em "Solicitação"; comum -> notificações não lidas.
create or replace function inovacao.badge()
returns integer
language sql stable security definer set search_path = inovacao, public
as $$
  select case
    when inovacao.is_gestor() then
      (select count(*)::int from inovacao.solicitacoes where coluna = 'solicitacao')
    else
      (select count(*)::int from inovacao.notificacoes where user_id = auth.uid() and lida = false)
  end;
$$;
revoke all on function inovacao.badge() from public, anon;
grant execute on function inovacao.badge() to authenticated;

-- Minhas notificações (últimas 50, com o título da solicitação).
create or replace function inovacao.minhas_notificacoes()
returns table (
  id uuid, solicitacao_id uuid, titulo text, coluna_destino inovacao.status_coluna,
  mensagem text, lida boolean, created_at timestamptz
)
language sql stable security definer set search_path = inovacao, public
as $$
  select n.id, n.solicitacao_id, s.titulo, n.coluna_destino, n.mensagem, n.lida, n.created_at
    from inovacao.notificacoes n
    join inovacao.solicitacoes s on s.id = n.solicitacao_id
   where n.user_id = auth.uid()
   order by n.created_at desc
   limit 50;
$$;
revoke all on function inovacao.minhas_notificacoes() from public, anon;
grant execute on function inovacao.minhas_notificacoes() to authenticated;

-- Marca todas as minhas notificações como vistas.
create or replace function inovacao.marcar_notificacoes_vistas()
returns void
language sql security definer set search_path = inovacao, public
as $$
  update inovacao.notificacoes set lida = true where user_id = auth.uid() and lida = false;
$$;
revoke all on function inovacao.marcar_notificacoes_vistas() from public, anon;
grant execute on function inovacao.marcar_notificacoes_vistas() to authenticated;

-- Dashboard (só gestor): funil por coluna, resolvidas no período, tempo
-- médio de resolução e ranking de quem mais pediu.
create or replace function inovacao.dashboard(_de date default null, _ate date default null)
returns jsonb
language plpgsql stable security definer set search_path = inovacao, public
as $$
begin
  if not inovacao.is_gestor() then
    raise exception 'Sem permissão para ver o dashboard.' using errcode = '42501';
  end if;

  return (
    with base as (
      select * from inovacao.solicitacoes s
       where (_de  is null or s.created_at::date >= _de)
         and (_ate is null or s.created_at::date <= _ate)
    ),
    por_coluna as (
      select coluna, count(*)::int as n from base group by coluna
    ),
    por_mes as (
      select to_char(date_trunc('month', resolved_at), 'YYYY-MM') as mes, count(*)::int as n
        from base where coluna = 'finalizado' and resolved_at is not null
       group by 1 order by 1
    ),
    ranking as (
      select coalesce(nullif(btrim(created_by_nome), ''), created_by_email, '(sem nome)') as nome, count(*)::int as n
        from base group by 1 order by n desc, nome limit 8
    )
    select jsonb_build_object(
      'total',           (select count(*)::int from base),
      'solicitacao',     coalesce((select n from por_coluna where coluna = 'solicitacao'), 0),
      'analise',         coalesce((select n from por_coluna where coluna = 'analise'), 0),
      'desenvolvimento', coalesce((select n from por_coluna where coluna = 'desenvolvimento'), 0),
      'finalizado',      coalesce((select n from por_coluna where coluna = 'finalizado'), 0),
      'recusado',        coalesce((select n from por_coluna where coluna = 'recusado'), 0),
      'tempo_medio_dias', (
        select round(extract(epoch from avg(resolved_at - created_at)) / 86400, 1)
          from base where coluna = 'finalizado' and resolved_at is not null
      ),
      'por_mes',  coalesce((select jsonb_agg(jsonb_build_object('mes', mes, 'n', n)) from por_mes), '[]'::jsonb),
      'ranking',  coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'n', n)) from ranking), '[]'::jsonb)
    )
  );
end;
$$;
revoke all on function inovacao.dashboard(date, date) from public, anon;
grant execute on function inovacao.dashboard(date, date) to authenticated;

-- ============================================================
-- RLS  (defesa em profundidade — as RPCs security definer já validam
-- tudo, mas nada aqui usa using(true))
-- ============================================================
alter table inovacao.gestores      enable row level security;
alter table inovacao.solicitacoes  enable row level security;
alter table inovacao.notificacoes  enable row level security;

drop policy if exists inov_gestores_select on inovacao.gestores;
create policy inov_gestores_select on inovacao.gestores
  for select to authenticated using (user_id = auth.uid());

drop policy if exists inov_sol_select on inovacao.solicitacoes;
create policy inov_sol_select on inovacao.solicitacoes
  for select to authenticated
  using (created_by = auth.uid() or inovacao.is_gestor());

drop policy if exists inov_sol_insert on inovacao.solicitacoes;
create policy inov_sol_insert on inovacao.solicitacoes
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists inov_sol_update on inovacao.solicitacoes;
create policy inov_sol_update on inovacao.solicitacoes
  for update to authenticated
  using (inovacao.is_gestor()) with check (inovacao.is_gestor());

drop policy if exists inov_sol_delete on inovacao.solicitacoes;
create policy inov_sol_delete on inovacao.solicitacoes
  for delete to authenticated
  using (inovacao.is_gestor());

drop policy if exists inov_notif_select on inovacao.notificacoes;
create policy inov_notif_select on inovacao.notificacoes
  for select to authenticated using (user_id = auth.uid());

grant select on inovacao.gestores to authenticated;
grant select, insert, update, delete on inovacao.solicitacoes to authenticated;
grant select on inovacao.notificacoes to authenticated;

-- ============================================================
-- STORAGE: bucket privado p/ anexos (prints/telas) — opcional por pedido
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('inovacao-anexos', 'inovacao-anexos', false)
on conflict (id) do nothing;

-- path convencionado como '<solicitacao_id>/<timestamp>-<idx>-<nome>'
drop policy if exists inov_anexos_read on storage.objects;
create policy inov_anexos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'inovacao-anexos' and (
    inovacao.is_gestor() or exists (
      select 1 from inovacao.solicitacoes s
       where s.id::text = split_part(storage.objects.name, '/', 1)
         and s.created_by = auth.uid()
    )
  ));

drop policy if exists inov_anexos_write on storage.objects;
create policy inov_anexos_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inovacao-anexos' and exists (
    select 1 from inovacao.solicitacoes s
     where s.id::text = split_part(name, '/', 1)
       and s.created_by = auth.uid()
  ));

-- ============================================================
-- BOOTSTRAP — promova você mesmo a gestor (troque o e-mail se precisar)
-- ============================================================
insert into inovacao.gestores (user_id)
select id from auth.users
 where lower(email) in ('fszcdi@gmail.com', 'master@solucaomoveis.ind.br')
on conflict (user_id) do nothing;

-- ============================================================
-- TESTE
-- ============================================================
--   select inovacao.is_gestor();
--   select inovacao.criar_solicitacao('Título', 'O que eu quero', 'Como eu quero', 'Finalidade');
--   select inovacao.minhas_solicitacoes();
--   select inovacao.quadro();                     -- todo autenticado
--   select inovacao.definir_datas('<id>', '2026-08-01', '2026-08-15'); -- só gestor
--   select inovacao.mover_solicitacao('<id>', 'analise');
--   select inovacao.badge();
--   select inovacao.dashboard();                  -- só gestor
