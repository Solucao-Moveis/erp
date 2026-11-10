-- ============================================================
-- codi_contagem_hora.sql: contagem de peças por hora (processo dedicado)
-- ------------------------------------------------------------
-- Usado pelo processo codi-coletor/contagem-metalurgia.mjs (PM2
-- "codi-contagem"), separado do coletor principal.
-- Idempotente: pode ser reaplicado a qualquer momento.
-- Rodar no SQL Editor do Supabase SMERP.
--
-- codi.contagem_hora: 1 linha por (máquina, dia, hora local de
-- Brasília). "hora" = hora de início (7 = 7h-8h). O processo lê o
-- CODI a cada minuto e, na volta de uma falha, relê até 7 dias.
--
-- codi.contagem_saude: "batimento" do processo. Se ultimo_ok ficar
-- velho, o Hora a Hora mostra o aviso de contagem parada.
-- Escrita só pelo service_role (processo). Leitura: membros do CODI.
-- ============================================================

create table if not exists codi.contagem_hora (
  maquina_id   integer     not null,
  dia          date        not null,
  hora         smallint    not null check (hora between 0 and 23),
  quantidade   integer     not null default 0,
  suspeito     boolean     not null default false,
  lido_em      timestamptz not null default now(),
  primary key (maquina_id, dia, hora)
);

-- O CODI manda hora negativa quando há estorno; guardamos igual (o total
-- do dia tem que bater com o CODI). A trava >= 0 da 1ª versão sai.
alter table codi.contagem_hora drop constraint if exists contagem_hora_quantidade_check;

create index if not exists idx_codi_contagem_hora_dia
  on codi.contagem_hora (dia desc);

create table if not exists codi.contagem_saude (
  processo      text        primary key,
  ultimo_ok     timestamptz,
  ultimo_erro   timestamptz,
  mensagem      text,
  maquinas      jsonb,
  atualizado_em timestamptz not null default now()
);

-- ---------- RLS ----------
alter table codi.contagem_hora  enable row level security;
alter table codi.contagem_saude enable row level security;

drop policy if exists codi_contagem_hora_select on codi.contagem_hora;
create policy codi_contagem_hora_select on codi.contagem_hora
  for select to authenticated using (codi.is_member());

drop policy if exists codi_contagem_saude_select on codi.contagem_saude;
create policy codi_contagem_saude_select on codi.contagem_saude
  for select to authenticated using (codi.is_member());

grant select on codi.contagem_hora, codi.contagem_saude to authenticated;
grant all    on codi.contagem_hora, codi.contagem_saude to service_role;
revoke all   on codi.contagem_hora, codi.contagem_saude from anon;

notify pgrst, 'reload schema';

-- Conferência (depois que o processo rodar uns minutos):
-- select processo, ultimo_ok, ultimo_erro, mensagem from codi.contagem_saude;
-- select maquina_id, hora, quantidade, lido_em from codi.contagem_hora
--  where dia = current_date order by maquina_id, hora;

-- Reversão:
--   drop table if exists codi.contagem_hora;
--   drop table if exists codi.contagem_saude;
--   notify pgrst, 'reload schema';
