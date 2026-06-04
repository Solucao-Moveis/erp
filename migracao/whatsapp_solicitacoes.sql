-- ============================================================
-- WHATSAPP NAS SOLICITAÇÕES (SMERP) — via Evolution API
-- ------------------------------------------------------------
-- Liga a tabela public.solicitacoes ao Evolution API (gateway de
-- WhatsApp self-hosted) em DUAS vias, via triggers + pg_net (HTTP
-- assíncrono, "fire-and-forget" — se o Evolution cair, o chamado
-- abre/atualiza normalmente; a notificação é só descartada):
--
--   VIA 1 (pro dev/master): toda solicitação NOVA -> mensagem no
--          número do master (notify.evolution_config.to_number).
--   VIA 2 (pra quem abriu):  quando o master marca FEITO/NÃO FEITO,
--          avisa o WhatsApp que a pessoa informou no chamado (opt-in,
--          coluna public.solicitacoes.whatsapp). Texto montado por
--          lógica (template), diferente por status.
--
-- Pré-requisito: rodar ANTES o migracao/solicitacoes.sql (cria a
-- coluna whatsapp e o create_solicitacao com 5º parâmetro).
--
-- Config (URL/chave/instância/número) fica no schema privado 'notify'
-- (NÃO exposto no PostgREST) — inserir a linha real DEPOIS (ver fim).
-- Idempotente. Rodar no SQL Editor do Supabase SMERP.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Extensão pg_net (chamadas HTTP assíncronas de dentro do banco).
--    No Supabase normalmente já vem habilitada.
-- ------------------------------------------------------------
create extension if not exists pg_net;

-- garante a coluna mesmo se este arquivo rodar sem o solicitacoes.sql atualizado.
alter table public.solicitacoes add column if not exists whatsapp text;


-- ------------------------------------------------------------
-- 1) Schema privado + config do Evolution (1 linha).
--    Revogado de anon/authenticated; só funções definer leem.
-- ------------------------------------------------------------
create schema if not exists notify;
revoke all on schema notify from anon, authenticated;

create table if not exists notify.evolution_config (
  id        int primary key default 1 check (id = 1),
  base_url  text not null,            -- URL do Evolution. Se o Supabase for um stack à parte (rede Docker
                                      -- separada — caso do self-hosted no EasyPanel), use a URL PÚBLICA
                                      -- https://...; o hostname interno (projeto_servico:8080) só resolve
                                      -- quando os dois estão na MESMA rede Docker.
  instance  text not null,            -- nome da instância conectada (QR)
  api_key   text not null,            -- AUTHENTICATION_API_KEY do Evolution
  to_number text not null,            -- número do MASTER p/ a VIA 1 (só dígitos, DDI+DDD: 5554999999999)
  enabled   boolean not null default true
);


-- ------------------------------------------------------------
-- 2) Nome de quem abriu (mesmo coalesce cross-schema do
--    list_all_solicitacoes; cai no e-mail se não tiver nome).
-- ------------------------------------------------------------
create or replace function notify.requester_label(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(u.raw_user_meta_data->>'full_name',
                  cp.full_name, fp.full_name, bp.full_name, gp.full_name,
                  u.email::text)
  from auth.users u
  left join compras.profiles cp on cp.id = u.id
  left join fabrill.profiles fp on fp.id = u.id
  left join bip.profiles     bp on bp.id = u.id
  left join gestao.profiles  gp on gp.id = u.id
  where u.id = p_uid;
$$;
revoke all on function notify.requester_label(uuid) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 3) Enviar uma mensagem de texto pelo Evolution (usada pelas 2 vias).
--    Não envia se: número vazio, config ausente, ou enabled = false.
--    Qualquer erro é engolido — notificação NUNCA derruba o chamado.
-- ------------------------------------------------------------
create or replace function notify.send_whatsapp(p_number text, p_text text)
returns void
language plpgsql
security definer
set search_path = notify, public, extensions, net
as $$
declare cfg notify.evolution_config;
begin
  if coalesce(btrim(p_number), '') = '' then return; end if;
  select * into cfg from notify.evolution_config where id = 1 and enabled;
  if not found then return; end if;

  perform net.http_post(
    url     := rtrim(cfg.base_url, '/') || '/message/sendText/' || cfg.instance,
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', cfg.api_key),
    body    := jsonb_build_object('number', p_number, 'text', p_text)
  );
exception when others then
  return;  -- silencioso de propósito
end;
$$;
revoke all on function notify.send_whatsapp(text, text) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 4) Rótulo de urgência (com acento, igual ao config.js do front).
-- ------------------------------------------------------------
create or replace function notify.urg_label(p_urg text)
returns text language sql immutable as $$
  select case p_urg
    when 'urgente' then 'Urgente' when 'alta' then 'Alta'
    when 'media'   then 'Média'   else 'Baixa' end;
$$;


-- ------------------------------------------------------------
-- 5) VIA 1 — AFTER INSERT: avisa o master sobre o chamado novo.
-- ------------------------------------------------------------
create or replace function notify.tg_sol_novo_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = notify, public
as $$
declare
  cfg   notify.evolution_config;
  v_msg text;
begin
  select * into cfg from notify.evolution_config where id = 1 and enabled;
  if not found then return new; end if;

  v_msg :=
    '🔔 *Nova solicitação no SMERP*'                                       || E'\n' ||
    '*' || new.titulo || '*'                                              || E'\n' ||
    'Tipo: ' || (case new.tipo when 'desenvolvimento_novo'
                   then 'Desenvolvimento novo' else 'Manutenção' end) ||
    '  •  Urgência: ' || notify.urg_label(new.urgencia)                   || E'\n' ||
    'De: ' || coalesce(notify.requester_label(new.requester_id), '?')     || E'\n\n' ||
    new.descricao;

  perform notify.send_whatsapp(cfg.to_number, v_msg);
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_sol_novo_whatsapp on public.solicitacoes;
create trigger trg_sol_novo_whatsapp
  after insert on public.solicitacoes
  for each row execute function notify.tg_sol_novo_whatsapp();


-- ------------------------------------------------------------
-- 6) VIA 2 — AFTER UPDATE: avisa quem abriu quando o chamado é
--    resolvido (entra em concluida/recusada vindo de não-final),
--    e só se a pessoa tiver deixado um WhatsApp no chamado.
-- ------------------------------------------------------------
create or replace function notify.tg_sol_resolvido_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = notify, public
as $$
declare
  v_primeiro text;
  v_msg      text;
begin
  if new.status in ('concluida','recusada')
     and old.status not in ('concluida','recusada')
     and coalesce(btrim(new.whatsapp), '') <> '' then

    v_primeiro := split_part(coalesce(notify.requester_label(new.requester_id), ''), ' ', 1);

    if new.status = 'concluida' then
      v_msg := 'Olá' || (case when v_primeiro <> '' then ' ' || v_primeiro else '' end) || '! ✅' || E'\n' ||
               'Sua solicitação "' || new.titulo || '" foi concluída, testada e já está no sistema.';
      if coalesce(btrim(new.resposta), '') <> '' then
        v_msg := v_msg || E'\n\n' || 'Observação do dev: ' || new.resposta;
      end if;
    else
      v_msg := 'Olá' || (case when v_primeiro <> '' then ' ' || v_primeiro else '' end) || '.' || E'\n' ||
               'Sobre sua solicitação "' || new.titulo || '": não vamos seguir com ela por agora.';
      if coalesce(btrim(new.resposta), '') <> '' then
        v_msg := v_msg || E'\n\n' || 'Motivo: ' || new.resposta;
      end if;
    end if;
    v_msg := v_msg || E'\n\n' || '— Assistente SMERP';

    perform notify.send_whatsapp(new.whatsapp, v_msg);
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_sol_resolvido_whatsapp on public.solicitacoes;
create trigger trg_sol_resolvido_whatsapp
  after update on public.solicitacoes
  for each row execute function notify.tg_sol_resolvido_whatsapp();


-- ============================================================
-- CONFIGURAR (rodar UMA vez, com os valores reais — NÃO commitar):
--
--   (base_url: prefira a URL PÚBLICA https://... — o hostname interno só funciona
--    se Evolution e Supabase estiverem na mesma rede Docker.)
--   insert into notify.evolution_config (base_url, instance, api_key, to_number)
--   values ('https://seu-evolution.easypanel.host', 'minha-instancia',
--           'SUA_API_KEY', '5554999999999')
--   on conflict (id) do update
--     set base_url = excluded.base_url, instance = excluded.instance,
--         api_key  = excluded.api_key,  to_number = excluded.to_number,
--         enabled  = true;
--
-- Desligar temporariamente:  update notify.evolution_config set enabled = false where id = 1;
--
-- TESTES:
--   -- VIA 1 (master recebe o chamado novo) + grava o WhatsApp do solicitante:
--   select public.create_solicitacao('manutencao','alta','Teste WhatsApp','passos...', '5554911112222');
--   -- VIA 2 (o número acima recebe o aviso de resolução):
--   select public.set_solicitacao_status('<uuid>'::uuid,'concluida','feito! veja na próxima versão');
--   select public.set_solicitacao_status('<uuid>'::uuid,'recusada','fora do escopo por enquanto');
--   -- diagnóstico de entrega do pg_net (status/erro das chamadas):
--   select id, status_code, error_msg, created from net._http_response order by created desc limit 5;
-- ============================================================
