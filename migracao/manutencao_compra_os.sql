-- ============================================================
-- PEDIDO DE COMPRA INTEGRADO NA ABA "ATENDER OS" (Pro-Care ↔ Compras)
-- ------------------------------------------------------------
-- O técnico abre uma Solicitação de Compra (SC) de verdade, direto
-- do modal "Atender OS", sem sair da tela. O MTTR da OS pausa
-- automaticamente enquanto a SC está em aberto e retoma sozinho
-- quando ela chega a um desfecho final no Compras (comprado, negado
-- ou cancelado).
--
-- Cross-schema: manutencao e compras vivem no MESMO banco Postgres
-- do SMERP, então FK/trigger/RPC entre os dois schemas são DDL
-- padrão, sem HTTP nem chave de serviço envolvida.
--
-- PRÉ-REQUISITO: rodar antes o arquivo
--   comprasolucao/supabase/migrations/20260810120000_origem_manutencao.sql
-- (adiciona origem_sistema/origem_referencia em compras.purchase_requests,
-- referenciadas pela RPC abaixo).
--
-- Rodar no SQL Editor do Supabase Studio do SMERP. Idempotente.
-- ============================================================

-- ============================================================
-- TABELA: histórico de pausas de MTTR por SC vinculada
-- (permite mais de uma SC ao longo da vida de uma OS, sequencialmente)
-- ============================================================
create table if not exists manutencao.os_pausas (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null references manutencao.ordens_servico(id) on delete cascade,
  compra_request_id uuid references compras.purchase_requests(id) on delete set null,
  pausado_em timestamptz not null default now(),
  retomado_em timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- FIX (2026-08-10): admin apagando a SC no Compras batia em "on delete
-- restrict" e travava a exclusão. Troca pra SET NULL — a pausa fecha
-- sozinha (trigger BEFORE DELETE abaixo) e o histórico de tempo fica,
-- só perde o vínculo com a SC que não existe mais. Idempotente: roda
-- em instalação nova (não muda nada, já nasce assim) e na já existente.
alter table manutencao.os_pausas alter column compra_request_id drop not null;
alter table manutencao.os_pausas drop constraint if exists os_pausas_compra_request_id_fkey;
alter table manutencao.os_pausas add constraint os_pausas_compra_request_id_fkey
  foreign key (compra_request_id) references compras.purchase_requests(id) on delete set null;

-- só pode haver 1 pausa aberta por vez por OS
create unique index if not exists ux_os_pausas_aberta
  on manutencao.os_pausas(os_id) where retomado_em is null;

create index if not exists idx_os_pausas_os     on manutencao.os_pausas(os_id, pausado_em desc);
create index if not exists idx_os_pausas_compra on manutencao.os_pausas(compra_request_id);

alter table manutencao.os_pausas enable row level security;

-- leitura liberada (pra exibir na UI); SEM policy de insert/update/delete
-- pra authenticated — só a RPC (security definer) e o trigger de
-- retomada escrevem aqui.
drop policy if exists "os_pausas_read" on manutencao.os_pausas;
create policy "os_pausas_read" on manutencao.os_pausas for select to authenticated using (true);

-- ============================================================
-- RPC: cria a SC no Compras + vincula a pausa, tudo numa chamada só
-- ============================================================
-- p_item_id: item do catálogo compras.items (mesmo picker "Código" que
-- requests.new.tsx usa) — opcional, null quando a descrição é digitada livre.
drop function if exists manutencao.criar_pedido_compra_os(uuid,text,numeric,text,date,text,text,boolean,text);

create or replace function manutencao.criar_pedido_compra_os(
  p_os_id                   uuid,
  p_descricao                text,
  p_quantidade                numeric,
  p_unidade                   text,
  p_data_necessaria           date,
  p_justificativa              text,
  p_prioridade                 text default 'media',
  p_urgente                    boolean default false,
  p_urgencia_justificativa     text default null,
  p_item_id                    uuid default null
)
returns table(request_id uuid, request_number text)
language plpgsql
security definer
set search_path = manutencao, compras, public
as $$
declare
  v_requester   uuid := auth.uid();
  v_sector_id   uuid;
  v_os          manutencao.ordens_servico%rowtype;
  v_request_id  uuid;
  v_number      text;
begin
  if v_requester is null then
    raise exception 'Usuário não autenticado';
  end if;

  select * into v_os from manutencao.ordens_servico where id = p_os_id for update;
  if not found then
    raise exception 'OS não encontrada';
  end if;
  if v_os.status in ('fechada','cancelada') then
    raise exception 'Não é possível abrir pedido de compra para uma OS %', v_os.status;
  end if;

  if exists (select 1 from manutencao.os_pausas where os_id = p_os_id and retomado_em is null) then
    raise exception 'Já existe um pedido de compra em aberto para esta OS';
  end if;

  if p_descricao is null or length(trim(p_descricao)) = 0 then
    raise exception 'Descrição é obrigatória';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Quantidade deve ser maior que zero';
  end if;
  if coalesce(trim(p_unidade), '') = '' then
    raise exception 'Unidade é obrigatória';
  end if;
  if coalesce(trim(p_justificativa), '') = '' then
    raise exception 'Justificativa é obrigatória';
  end if;
  if p_urgente and coalesce(trim(p_urgencia_justificativa), '') = '' then
    raise exception 'Justificativa de urgência é obrigatória quando marcado urgente';
  end if;

  select id into v_sector_id from compras.sectors where code = '25220' limit 1;
  if v_sector_id is null then
    raise exception 'Setor de Manutenção (código 25220) não encontrado em compras.sectors';
  end if;

  insert into compras.purchase_requests (
    sector_id, requester_id, description, quantity, unit, needed_by,
    justification, priority, urgente, urgencia_justificativa, tipo_compra,
    origem_sistema, origem_referencia, item_id
  ) values (
    v_sector_id, v_requester, p_descricao, p_quantidade, p_unidade, p_data_necessaria,
    p_justificativa, p_prioridade::compras.request_priority, p_urgente, p_urgencia_justificativa,
    'insumos_outros'::compras.purchase_type,
    'manutencao', 'OS #' || v_os.numero, p_item_id
  )
  returning id, number into v_request_id, v_number;

  insert into compras.request_items (request_id, item_id, description, quantity, unit, position)
  values (v_request_id, p_item_id, p_descricao, p_quantidade, p_unidade, 0);

  insert into manutencao.os_pausas (os_id, compra_request_id, created_by)
  values (p_os_id, v_request_id, v_requester);

  -- abrir SC já indica que o trabalho começou: promove 'aberta' -> 'em_andamento'.
  -- não interfere no trigger manutencao.sync_maquina_status (só olha status/maquina_parada).
  update manutencao.ordens_servico
     set status = 'em_andamento'
   where id = p_os_id and status = 'aberta';

  return query select v_request_id, v_number;
end;
$$;

revoke all on function manutencao.criar_pedido_compra_os(uuid,text,numeric,text,date,text,text,boolean,text,uuid) from public;
grant execute on function manutencao.criar_pedido_compra_os(uuid,text,numeric,text,date,text,text,boolean,text,uuid) to authenticated;

-- ============================================================
-- TRIGGER: retoma o MTTR sozinho quando a SC chega a um desfecho final
-- (finalizado = peça chegou de verdade na mão do técnico, "comprado"
-- sozinho não conta — só atende quando chega; negado/cancelado = não
-- vai vir mesmo, não faz sentido travar a OS esperando pra sempre)
-- ============================================================
create or replace function manutencao.retomar_mttr_compra()
returns trigger
language plpgsql
security definer
set search_path = manutencao, public
as $$
begin
  update manutencao.os_pausas
     set retomado_em = now()
   where compra_request_id = new.id
     and retomado_em is null;
  return new;
end;
$$;

drop trigger if exists trg_compras_retomar_mttr on compras.purchase_requests;
create trigger trg_compras_retomar_mttr
  after update on compras.purchase_requests
  for each row
  when (new.status in ('finalizado','negado','cancelado')
        and old.status is distinct from new.status)
  execute function manutencao.retomar_mttr_compra();

-- ============================================================
-- TRIGGER: se a SC for EXCLUÍDA (não só mudar de status) no Compras,
-- fecha a pausa antes — senão o FK vira SET NULL e o retomado_em nunca
-- seria setado, deixando a OS pausada pra sempre.
-- ============================================================
create or replace function manutencao.fechar_pausa_compra_excluida()
returns trigger
language plpgsql
security definer
set search_path = manutencao, public
as $$
begin
  update manutencao.os_pausas
     set retomado_em = now()
   where compra_request_id = old.id
     and retomado_em is null;
  return old;
end;
$$;

drop trigger if exists trg_compras_excluir_retomar_mttr on compras.purchase_requests;
create trigger trg_compras_excluir_retomar_mttr
  before delete on compras.purchase_requests
  for each row
  execute function manutencao.fechar_pausa_compra_excluida();

-- ============================================================
-- Recarrega o cache do PostgREST (a RPC precisa aparecer pro Pro-Care)
-- ============================================================
notify pgrst, 'reload schema';
