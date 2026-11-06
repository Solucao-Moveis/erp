-- =============================================================================
-- Hora a Hora (schema fabrill): telas de TV por setor
-- -----------------------------------------------------------------------------
-- Cada linha é uma TV: um setor (area) + um token secreto que vai no link
-- /tv/<token>. A TV abre SEM login; quem lê os dados é a server function do app
-- (service_role), que valida o token. Por isso anon NÃO recebe acesso aqui.
-- Gerenciar (criar/desativar/excluir) é só PCP ou administrador.
-- Idempotente: pode rodar de novo sem quebrar.
-- =============================================================================

create table if not exists fabrill.tv_screens (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references fabrill.areas(id) on delete cascade,
  name text not null,
  token text not null unique,
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_fabrill_tv_screens_token
  on fabrill.tv_screens (token) where active;

alter table fabrill.tv_screens enable row level security;

-- anon fica de fora: a TV lê via servidor, nunca direto na tabela
revoke all on fabrill.tv_screens from anon;
grant select, insert, update, delete on fabrill.tv_screens to authenticated;
grant all on fabrill.tv_screens to service_role;

drop policy if exists "tv_screens pcp all" on fabrill.tv_screens;
create policy "tv_screens pcp all" on fabrill.tv_screens
  for all to authenticated
  using (fabrill.is_pcp(auth.uid()) or fabrill.is_admin(auth.uid()))
  with check (fabrill.is_pcp(auth.uid()) or fabrill.is_admin(auth.uid()));

notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Reversão:
--   drop table if exists fabrill.tv_screens;
--   notify pgrst, 'reload schema';
-- -----------------------------------------------------------------------------
