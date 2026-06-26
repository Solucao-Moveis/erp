-- ============================================================
-- Caderno — resolução de nomes de autores (para Comentários).
--
-- A RLS de caderno.profiles deixa cada usuário ver SÓ o próprio
-- perfil, e auth.users não é exposto ao cliente. Então, para mostrar
-- quem escreveu cada comentário, usamos uma função SECURITY DEFINER
-- que mapeia ids -> nome — mesmo padrão do feed caderno.atividade_recente.
--
-- Só devolve o nome de exibição (id -> nome); não expõe e-mail de
-- terceiros além do que já serve de fallback de nome. A lista de
-- comentários em si continua protegida pela RLS da tabela comments.
--
-- Rodar uma vez no Supabase (schema caderno já exposto no PostgREST).
-- ============================================================

create or replace function caderno.nomes_de(p_ids uuid[])
returns table (id uuid, nome text)
language sql stable security definer set search_path = caderno, public
as $$
  select u.id,
         coalesce(p.full_name, u.raw_user_meta_data->>'full_name', u.email) as nome
    from auth.users u
    left join caderno.profiles p on p.id = u.id
   where u.id = any(p_ids);
$$;

grant execute on function caderno.nomes_de(uuid[]) to authenticated;
