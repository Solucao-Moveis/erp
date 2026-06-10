-- ============================================================
-- WEB PUSH NAS SOLICITAÇÕES (SMERP) — avisos no Windows com o app FECHADO
-- ------------------------------------------------------------
-- Espelha o padrão do WhatsApp (migracao/whatsapp_solicitacoes.sql):
-- trigger em public.solicitacoes -> pg_net (net.http_post) -> serviço
-- de push (push-service) que assina/criptografa e entrega o Web Push.
-- "Fire-and-forget": se o serviço cair, o chamado abre/atualiza normal.
--
--   VIA 1 (pro dev/master): solicitação NOVA -> push pro master.
--   VIA 2 (pra quem abriu):  chamado RESOLVIDO -> push pro solicitante.
--
-- O navegador/PWA de cada pessoa registra a "inscrição" pelo Hub
-- (notify.js -> save_push_subscription). O serviço de push lê essas
-- inscrições (service role) e envia. A chave VAPID pública vai no
-- config.js; a privada fica só no serviço (fora do banco e do git).
--
-- Pré-requisito: rodar ANTES o migracao/solicitacoes.sql.
-- Idempotente. Rodar no SQL Editor do Supabase SMERP.
-- ============================================================

create extension if not exists pg_net;
create schema if not exists notify;
revoke all on schema notify from anon, authenticated;


-- ------------------------------------------------------------
-- 1) INSCRIÇÕES de push (1+ por usuário — um por navegador/aparelho).
--    O 'endpoint' é único; reinscrever atualiza as chaves.
-- ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth_key   text not null,
  ua         text,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subs_select_own on public.push_subscriptions;
create policy push_subs_select_own on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists push_subs_insert_own on public.push_subscriptions;
create policy push_subs_insert_own on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists push_subs_update_own on public.push_subscriptions;
create policy push_subs_update_own on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists push_subs_delete_own on public.push_subscriptions;
create policy push_subs_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated;


-- ------------------------------------------------------------
-- 2) RPCs chamadas pelo Hub (notify.js).
-- ------------------------------------------------------------
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_ua text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Faça login para ativar avisos.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_endpoint),'') = '' or coalesce(btrim(p_p256dh),'') = ''
     or coalesce(btrim(p_auth),'') = '' then
    raise exception 'Inscrição de push incompleta.';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key, ua)
    values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_ua)
  on conflict (endpoint) do update
    set user_id  = excluded.user_id,
        p256dh   = excluded.p256dh,
        auth_key = excluded.auth_key,
        ua       = excluded.ua,
        created_at = now();
end;
$$;
revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions
   where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke all on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.delete_push_subscription(text) to authenticated;


-- ------------------------------------------------------------
-- 3) Config do serviço de push (schema privado, NÃO exposto).
--    base_url = URL pública do push-service no EasyPanel.
--    secret   = segredo compartilhado (header x-push-secret) p/ não ficar aberto.
-- ------------------------------------------------------------
create table if not exists notify.push_config (
  id       int primary key default 1 check (id = 1),
  base_url text not null,
  secret   text not null,
  enabled  boolean not null default true
);


-- ------------------------------------------------------------
-- 4) uid do master (pra VIA 1). Mesmo e-mail do public.is_master().
-- ------------------------------------------------------------
create or replace function notify.master_uid()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from auth.users where lower(email) = 'master@solucaomoveis.ind.br' limit 1;
$$;
revoke all on function notify.master_uid() from public, anon, authenticated;


-- ------------------------------------------------------------
-- 5) Disparar um push p/ um usuário (todas as inscrições dele).
--    O push-service recebe { user_id, title, body, url } e resolve as
--    inscrições/assinatura. Silencioso: nunca derruba o chamado.
-- ------------------------------------------------------------
create or replace function notify.send_push(p_uid uuid, p_title text, p_body text, p_url text)
returns void
language plpgsql
security definer
set search_path = notify, public, extensions, net
as $$
declare cfg notify.push_config;
begin
  if p_uid is null then return; end if;
  select * into cfg from notify.push_config where id = 1 and enabled;
  if not found then return; end if;

  perform net.http_post(
    url     := rtrim(cfg.base_url, '/') || '/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', cfg.secret),
    body    := jsonb_build_object('user_id', p_uid, 'title', p_title, 'body', p_body, 'url', p_url)
  );
exception when others then
  return;  -- silencioso de propósito
end;
$$;
revoke all on function notify.send_push(uuid, text, text, text) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 6) VIA 1 — AFTER INSERT: push pro master (trigger SEPARADO do WhatsApp).
-- ------------------------------------------------------------
create or replace function notify.tg_sol_novo_push()
returns trigger
language plpgsql
security definer
set search_path = notify, public
as $$
begin
  perform notify.send_push(
    notify.master_uid(),
    '🔔 Nova solicitação no SMERP',
    new.titulo || ' — ' || coalesce(notify.requester_label(new.requester_id), '?'),
    'https://solucaomoveis-erp.h5xdag.easypanel.host/'
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_sol_novo_push on public.solicitacoes;
create trigger trg_sol_novo_push
  after insert on public.solicitacoes
  for each row execute function notify.tg_sol_novo_push();


-- ------------------------------------------------------------
-- 7) VIA 2 — AFTER UPDATE: push pro solicitante quando resolve.
-- ------------------------------------------------------------
create or replace function notify.tg_sol_resolvido_push()
returns trigger
language plpgsql
security definer
set search_path = notify, public
as $$
begin
  if new.status in ('concluida','recusada')
     and old.status not in ('concluida','recusada') then
    perform notify.send_push(
      new.requester_id,
      case when new.status = 'concluida'
           then '✅ Sua solicitação foi concluída'
           else 'ℹ️ Sua solicitação foi respondida' end,
      new.titulo,
      'https://solucaomoveis-erp.h5xdag.easypanel.host/'
    );
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_sol_resolvido_push on public.solicitacoes;
create trigger trg_sol_resolvido_push
  after update on public.solicitacoes
  for each row execute function notify.tg_sol_resolvido_push();


-- ============================================================
-- CONFIGURAR (rodar UMA vez, com os valores reais — NÃO commitar):
--
--   insert into notify.push_config (base_url, secret)
--   values ('https://solucaomoveis-push.h5xdag.easypanel.host', 'UM-SEGREDO-FORTE')
--   on conflict (id) do update
--     set base_url = excluded.base_url, secret = excluded.secret, enabled = true;
--
-- Desligar:  update notify.push_config set enabled = false where id = 1;
--
-- TESTES (depois do push-service no ar e com sua inscrição salva pelo Hub):
--   select public.create_solicitacao('manutencao','alta','Teste push','passos...');
--   -- pegue o uuid e marque resolvido p/ testar a VIA 2:
--   select public.set_solicitacao_status('<uuid>'::uuid,'concluida','feito!');
--   -- diagnóstico do pg_net:
--   select id, status_code, error_msg, created from net._http_response order by created desc limit 5;
-- ============================================================
