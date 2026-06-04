-- ============================================================
-- SOLICITAÇÕES AO DESENVOLVEDOR (SMERP)
-- ------------------------------------------------------------
-- Uma aba "Solicitações" no Hub onde QUALQUER pessoa logada abre
-- um chamado pro dev — DESENVOLVIMENTO NOVO ou MANUTENÇÃO — com
-- nível de urgência. Só o MASTER (master@solucaomoveis.ind.br) vê
-- todas e muda o status (Aberta → Em andamento → Feito | Não feito).
-- Quem abriu recebe um "aviso" (badge) quando o pedido é resolvido.
--
-- Funções (RPC) que o Hub chama:
--   public.is_master()                 -> bool  (mostra a seção "todas")
--   public.create_solicitacao(...)     -> jsonb (abre um chamado)
--   public.list_my_solicitacoes()      -> table (os meus chamados)
--   public.mark_my_solicitacoes_seen() -> int   (limpa o aviso ao abrir)
--   public.list_all_solicitacoes()     -> table (master: todos os chamados)
--   public.set_solicitacao_status(...) -> jsonb (master: muda o status)
--   public.solicitacoes_badge()        -> int   (número do aviso na sidebar)
--
-- Tudo no schema public (sempre exposto no PostgREST). Idempotente.
-- Rodar no SQL Editor do Supabase SMERP.
-- ============================================================

-- ------------------------------------------------------------
-- 0) TABELA
-- ------------------------------------------------------------
create table if not exists public.solicitacoes (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo         text not null check (tipo in ('desenvolvimento_novo','manutencao')),
  urgencia     text not null check (urgencia in ('baixa','media','alta','urgente')),
  titulo       text not null check (length(btrim(titulo))    between 1 and 160),
  descricao    text not null check (length(btrim(descricao)) between 1 and 4000),
  status       text not null default 'aberta'
                 check (status in ('aberta','em_andamento','concluida','recusada')),
  resposta     text,                    -- nota do dev ao resolver (o solicitante vê)
  whatsapp     text,                     -- opt-in: número (só dígitos, DDI) p/ avisar quando resolver
  visto_em     timestamptz,             -- quando o solicitante viu a resolução
  resolved_at  timestamptz,             -- quando virou concluida/recusada
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- idempotente: garante a coluna em bancos que já tinham a tabela antiga.
alter table public.solicitacoes add column if not exists whatsapp text;

create index if not exists solicitacoes_requester_idx on public.solicitacoes (requester_id, created_at desc);
create index if not exists solicitacoes_status_idx     on public.solicitacoes (status);


-- ------------------------------------------------------------
-- 1) TRIGGER: mantém updated_at/resolved_at e dispara o aviso.
--    Ao ENTRAR num estado final (concluida/recusada) vindo de um
--    estado não-final, marca resolved_at e zera visto_em -> isso
--    é o que faz o badge aparecer pro solicitante.
-- ------------------------------------------------------------
create or replace function public.tg_solicitacoes_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status in ('concluida','recusada')
     and old.status not in ('concluida','recusada') then
    new.resolved_at := now();
    new.visto_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_solicitacoes_touch on public.solicitacoes;
create trigger trg_solicitacoes_touch
  before update on public.solicitacoes
  for each row execute function public.tg_solicitacoes_touch();


-- ------------------------------------------------------------
-- 2) GATE: quem é o master? (master-only — diretoria NÃO entra aqui)
-- ------------------------------------------------------------
create or replace function public.is_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid() and lower(email) = 'master@solucaomoveis.ind.br'
  );
$$;

revoke all on function public.is_master() from public, anon;
grant execute on function public.is_master() to authenticated;


-- ------------------------------------------------------------
-- 3) RLS — defesa em profundidade (as RPCs já validam tudo).
-- ------------------------------------------------------------
alter table public.solicitacoes enable row level security;

drop policy if exists sol_insert_own on public.solicitacoes;
create policy sol_insert_own on public.solicitacoes
  for insert to authenticated
  with check (requester_id = auth.uid());

drop policy if exists sol_select_own_or_master on public.solicitacoes;
create policy sol_select_own_or_master on public.solicitacoes
  for select to authenticated
  using (requester_id = auth.uid() or public.is_master());

drop policy if exists sol_update_master on public.solicitacoes;
create policy sol_update_master on public.solicitacoes
  for update to authenticated
  using (public.is_master() or requester_id = auth.uid())
  with check (public.is_master() or requester_id = auth.uid());

grant select, insert, update on public.solicitacoes to authenticated;


-- ------------------------------------------------------------
-- 4) ABRIR uma solicitação (qualquer pessoa logada).
-- ------------------------------------------------------------
-- assinatura antiga (4 args) é substituída pela de 5 args; dropa pra não virar overload.
drop function if exists public.create_solicitacao(text, text, text, text);

create or replace function public.create_solicitacao(
  p_tipo      text,
  p_urgencia  text,
  p_titulo    text,
  p_descricao text,
  p_whatsapp  text default null          -- opcional: avisar no WhatsApp quando resolver
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id   uuid;
  v_titulo text := nullif(btrim(coalesce(p_titulo, '')), '');
  v_desc   text := nullif(btrim(coalesce(p_descricao, '')), '');
  v_wpp    text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
begin
  if auth.uid() is null then
    raise exception 'Faça login para abrir uma solicitação.' using errcode = '42501';
  end if;
  if p_tipo not in ('desenvolvimento_novo','manutencao') then
    raise exception 'Tipo inválido.';
  end if;
  if p_urgencia not in ('baixa','media','alta','urgente') then
    raise exception 'Urgência inválida.';
  end if;
  if v_titulo is null then
    raise exception 'Informe um título.';
  end if;
  if v_desc is null then
    raise exception 'Descreva a solicitação.';
  end if;
  -- WhatsApp é opt-in: vazio = não avisar. Se informado, normaliza p/ DDI+DDD+número.
  if v_wpp is not null then
    if length(v_wpp) in (10, 11) then v_wpp := '55' || v_wpp; end if;   -- sem DDI -> assume Brasil
    if length(v_wpp) not in (12, 13) then
      raise exception 'WhatsApp inválido — use DDD + número, ex.: 54 9 9999-9999.';
    end if;
  end if;

  insert into public.solicitacoes (requester_id, tipo, urgencia, titulo, descricao, whatsapp)
    values (auth.uid(), p_tipo, p_urgencia, v_titulo, v_desc, v_wpp)
    returning id into new_id;

  return jsonb_build_object('id', new_id);
end;
$$;

revoke all on function public.create_solicitacao(text, text, text, text, text) from public, anon;
grant execute on function public.create_solicitacao(text, text, text, text, text) to authenticated;


-- ------------------------------------------------------------
-- 5) MINHAS solicitações (as do próprio usuário). Não marca visto.
-- ------------------------------------------------------------
-- a forma do retorno mudou (ganhou whatsapp) -> dropa antes de recriar.
drop function if exists public.list_my_solicitacoes();

create or replace function public.list_my_solicitacoes()
returns table (
  id uuid, tipo text, urgencia text, titulo text, descricao text,
  status text, resposta text, whatsapp text,
  created_at timestamptz, resolved_at timestamptz, visto_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, tipo, urgencia, titulo, descricao, status, resposta, whatsapp,
         created_at, resolved_at, visto_em
  from public.solicitacoes
  where requester_id = auth.uid()
  order by created_at desc;
$$;

revoke all on function public.list_my_solicitacoes() from public, anon;
grant execute on function public.list_my_solicitacoes() to authenticated;


-- ------------------------------------------------------------
-- 6) MARCAR como vistos os meus resolvidos (limpa o aviso ao abrir).
-- ------------------------------------------------------------
create or replace function public.mark_my_solicitacoes_seen()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.solicitacoes
     set visto_em = now()
   where requester_id = auth.uid()
     and status in ('concluida','recusada')
     and visto_em is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.mark_my_solicitacoes_seen() from public, anon;
grant execute on function public.mark_my_solicitacoes_seen() to authenticated;


-- ------------------------------------------------------------
-- 7) TODAS as solicitações (só o master). Inclui o nome de quem abriu,
--    buscando em raw_user_meta_data e nos profiles dos 4 apps; cai no
--    e-mail se a pessoa não tiver nome (igual ao admin_list_users).
-- ------------------------------------------------------------
create or replace function public.list_all_solicitacoes()
returns table (
  id uuid, requester_id uuid, requester_name text, requester_email text,
  tipo text, urgencia text, titulo text, descricao text,
  status text, resposta text,
  created_at timestamptz, resolved_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id, s.requester_id,
    coalesce(u.raw_user_meta_data->>'full_name',
             cp.full_name, fp.full_name, bp.full_name, gp.full_name,
             u.email::text) as requester_name,
    u.email::text as requester_email,
    s.tipo, s.urgencia, s.titulo, s.descricao, s.status, s.resposta,
    s.created_at, s.resolved_at
  from public.solicitacoes s
  join auth.users u on u.id = s.requester_id
  left join compras.profiles cp on cp.id = s.requester_id
  left join fabrill.profiles fp on fp.id = s.requester_id
  left join bip.profiles     bp on bp.id = s.requester_id
  left join gestao.profiles  gp on gp.id = s.requester_id
  where public.is_master()
  order by
    (s.status = 'aberta') desc,
    case s.urgencia when 'urgente' then 0 when 'alta' then 1 when 'media' then 2 else 3 end,
    s.created_at desc;
$$;

revoke all on function public.list_all_solicitacoes() from public, anon;
grant execute on function public.list_all_solicitacoes() to authenticated;


-- ------------------------------------------------------------
-- 8) MUDAR o status (só o master). A resposta vazia preserva a anterior.
--    resolved_at/updated_at/visto_em ficam por conta do trigger.
-- ------------------------------------------------------------
create or replace function public.set_solicitacao_status(
  p_id       uuid,
  p_status   text,
  p_resposta text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_resp text := nullif(btrim(coalesce(p_resposta, '')), '');
begin
  if not public.is_master() then
    raise exception 'Sem permissão para alterar solicitações.' using errcode = '42501';
  end if;
  if p_status not in ('aberta','em_andamento','concluida','recusada') then
    raise exception 'Status inválido.';
  end if;

  update public.solicitacoes
     set status   = p_status,
         resposta = coalesce(v_resp, resposta)
   where id = p_id;
  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;

  return jsonb_build_object('id', p_id, 'status', p_status);
end;
$$;

revoke all on function public.set_solicitacao_status(uuid, text, text) from public, anon;
grant execute on function public.set_solicitacao_status(uuid, text, text) to authenticated;


-- ------------------------------------------------------------
-- 8.1) EXCLUIR uma solicitação (só o master). Ação definitiva.
-- ------------------------------------------------------------
create or replace function public.delete_solicitacao(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_master() then
    raise exception 'Sem permissão para excluir solicitações.' using errcode = '42501';
  end if;

  delete from public.solicitacoes where id = p_id;
  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;

  return jsonb_build_object('id', p_id, 'deleted', true);
end;
$$;

revoke all on function public.delete_solicitacao(uuid) from public, anon;
grant execute on function public.delete_solicitacao(uuid) to authenticated;


-- ------------------------------------------------------------
-- 9) BADGE (número do aviso na sidebar). Uma RPC serve aos dois papéis:
--    master  -> quantas estão ABERTAS (pendentes pra ele resolver)
--    comum   -> quantas das MINHAS foram resolvidas e ainda não vi
-- ------------------------------------------------------------
create or replace function public.solicitacoes_badge()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_master() then
      (select count(*)::int from public.solicitacoes where status = 'aberta')
    else
      (select count(*)::int from public.solicitacoes
        where requester_id = auth.uid()
          and status in ('concluida','recusada')
          and visto_em is null)
  end;
$$;

revoke all on function public.solicitacoes_badge() from public, anon;
grant execute on function public.solicitacoes_badge() to authenticated;


-- ------------------------------------------------------------
-- Testes:
--   -- como usuário comum:
--   select public.create_solicitacao('manutencao','alta','Bug na exportação','passos pra reproduzir...');
--   select * from public.list_my_solicitacoes();
--   select public.solicitacoes_badge();
--   -- como master:
--   select public.is_master();
--   select * from public.list_all_solicitacoes();
--   select public.set_solicitacao_status('<uuid-da-solicitacao>'::uuid,'concluida','feito! veja na próxima versão');
--   -- de volta como o solicitante (vê o aviso e limpa ao abrir):
--   select public.solicitacoes_badge();          -- > 0
--   select public.mark_my_solicitacoes_seen();   -- zera
