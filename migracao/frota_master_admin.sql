-- ============================================================
-- frota: o MASTER (super-admin do SMERP) pode tudo, mesmo sem papel atribuído.
-- Inclui o e-mail master no helper is_manager (usado nas policies de escrita).
-- Roda DEPOIS do frota_schema.sql. Idempotente.
-- ============================================================

create or replace function frota.is_manager(_user_id uuid)
returns boolean language sql stable security definer set search_path = frota, public
as $$
  select frota.has_role(_user_id, 'admin')
      or frota.has_role(_user_id, 'gestor')
      or exists (
        select 1 from auth.users
        where id = _user_id and lower(email) = 'master@solucaomoveis.ind.br'
      )
$$;

revoke execute on function frota.is_manager(uuid) from public, anon;

notify pgrst, 'reload schema';
