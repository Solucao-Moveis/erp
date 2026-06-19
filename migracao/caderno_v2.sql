-- ============================================================
-- CADERNO v2 — recursos do redesenho fiel ao BookStack
-- ------------------------------------------------------------
-- Atividade recente (+triggers), revisoes automaticas de pagina,
-- vistos recentemente / livros populares, favoritos e rascunhos.
-- Idempotente. Rodar DEPOIS de caderno_schema.sql (e caderno_equipes.sql).
-- ============================================================

-- ============================================================
-- 1) ATIVIDADE (feed "Fulano criou/atualizou a pagina X")
-- ============================================================
create table if not exists caderno.activities (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid default auth.uid() references auth.users(id) on delete set null,
  acao          text not null,                 -- 'criou' | 'atualizou' | 'excluiu'
  tipo          text not null,                 -- 'shelf'|'book'|'chapter'|'page'
  entidade_id   uuid,
  entidade_nome text,
  book_id       uuid,                          -- livro de contexto (p/ visibilidade)
  created_at    timestamptz not null default now()
);
create index if not exists idx_caderno_activities_created on caderno.activities(created_at desc);

alter table caderno.activities enable row level security;
drop policy if exists "Activities select own" on caderno.activities;
create policy "Activities select own" on caderno.activities
  for select to authenticated using (user_id = auth.uid());
grant select on caderno.activities to authenticated;

-- trigger generico: registra a acao. Recebe o 'tipo' via TG_ARGV[0].
create or replace function caderno.log_activity()
returns trigger
language plpgsql security definer set search_path = caderno, public
as $$
declare
  v_acao text;
  v_tipo text := TG_ARGV[0];
  v_id   uuid;
  v_nome text;
  v_book uuid;
  v_actor uuid;
begin
  if    TG_OP = 'INSERT' then v_acao := 'criou';    v_id := NEW.id; v_nome := NEW.nome; v_actor := NEW.created_by;
  elsif TG_OP = 'UPDATE' then v_acao := 'atualizou'; v_id := NEW.id; v_nome := NEW.nome; v_actor := NEW.created_by;
  else                        v_acao := 'excluiu';   v_id := OLD.id; v_nome := OLD.nome; v_actor := OLD.created_by;
  end if;

  if v_tipo = 'book' then
    v_book := v_id;
  elsif v_tipo in ('chapter','page') then
    v_book := case when TG_OP = 'DELETE' then OLD.book_id else NEW.book_id end;
  else
    v_book := null; -- shelf
  end if;

  insert into caderno.activities(user_id, acao, tipo, entidade_id, entidade_nome, book_id)
    values (coalesce(auth.uid(), v_actor), v_acao, v_tipo, v_id, v_nome, v_book);

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

drop trigger if exists caderno_act_shelves  on caderno.shelves;
drop trigger if exists caderno_act_books    on caderno.books;
drop trigger if exists caderno_act_chapters on caderno.chapters;
drop trigger if exists caderno_act_pages    on caderno.pages;
create trigger caderno_act_shelves  after insert or update or delete on caderno.shelves  for each row execute function caderno.log_activity('shelf');
create trigger caderno_act_books    after insert or update or delete on caderno.books    for each row execute function caderno.log_activity('book');
create trigger caderno_act_chapters after insert or update or delete on caderno.chapters for each row execute function caderno.log_activity('chapter');
create trigger caderno_act_pages    after insert or update or delete on caderno.pages    for each row execute function caderno.log_activity('page');

-- feed respeitando visibilidade (a propria, ou shelf/book que pode ver)
create or replace function caderno.atividade_recente(_limit int default 20)
returns table (
  id uuid, user_id uuid, autor text, acao text, tipo text,
  entidade_id uuid, entidade_nome text, book_id uuid, created_at timestamptz
)
language sql stable security definer set search_path = caderno, public
as $$
  select a.id, a.user_id,
         coalesce(p.full_name, u.raw_user_meta_data->>'full_name', u.email) as autor,
         a.acao, a.tipo, a.entidade_id, a.entidade_nome, a.book_id, a.created_at
    from caderno.activities a
    left join auth.users u on u.id = a.user_id
    left join caderno.profiles p on p.id = a.user_id
   where a.user_id = auth.uid()
      or (a.tipo = 'shelf' and exists (
            select 1 from caderno.shelves s
             where s.id = a.entidade_id and caderno.pode_ver(s.visibilidade, s.team_id, s.created_by)))
      or (a.book_id is not null and exists (
            select 1 from caderno.books b
             where b.id = a.book_id and caderno.pode_ver(b.visibilidade, b.team_id, b.created_by)))
   order by a.created_at desc
   limit _limit;
$$;
grant execute on function caderno.atividade_recente(int) to authenticated;

-- ============================================================
-- 2) REVISOES automaticas de pagina (snapshot da versao ANTERIOR)
-- ============================================================
create or replace function caderno.snapshot_revision()
returns trigger
language plpgsql security definer set search_path = caderno, public
as $$
declare v_num int;
begin
  if (OLD.html is distinct from NEW.html) or (OLD.nome is distinct from NEW.nome) then
    select coalesce(max(numero), 0) + 1 into v_num
      from caderno.page_revisions where page_id = OLD.id;
    insert into caderno.page_revisions (page_id, numero, nome, html, resumo, created_by)
      values (OLD.id, v_num, OLD.nome, OLD.html, 'Versao anterior',
              coalesce(OLD.updated_by, OLD.created_by));
  end if;
  return NEW;
end;
$$;

drop trigger if exists caderno_pages_revision on caderno.pages;
create trigger caderno_pages_revision
  before update on caderno.pages
  for each row execute function caderno.snapshot_revision();

-- ============================================================
-- 3) VISTOS RECENTEMENTE / POPULARES
-- ============================================================
alter table caderno.views add column if not exists vezes int not null default 1;

-- registra/atualiza um "visto" (chamado ao abrir uma entidade)
create or replace function caderno.registrar_view(_tipo text, _id uuid)
returns void
language sql security definer set search_path = caderno, public
as $$
  insert into caderno.views (user_id, tipo, entidade_id, visto_em, vezes)
    values (auth.uid(), _tipo, _id, now(), 1)
  on conflict (user_id, tipo, entidade_id)
    do update set visto_em = now(), vezes = caderno.views.vezes + 1;
$$;
grant execute on function caderno.registrar_view(text, uuid) to authenticated;

-- meus vistos recentemente (com nome resolvido por tipo)
create or replace function caderno.meus_vistos(_limit int default 10)
returns table (tipo text, entidade_id uuid, nome text, book_id uuid, visto_em timestamptz)
language sql stable security definer set search_path = caderno, public
as $$
  select v.tipo, v.entidade_id,
         case v.tipo when 'book' then b.nome when 'page' then pg.nome
                     when 'chapter' then c.nome when 'shelf' then s.nome end as nome,
         case v.tipo when 'page' then pg.book_id when 'chapter' then c.book_id
                     when 'book' then b.id else null end as book_id,
         v.visto_em
    from caderno.views v
    left join caderno.books b   on v.tipo='book'    and b.id  = v.entidade_id
    left join caderno.pages pg  on v.tipo='page'    and pg.id = v.entidade_id
    left join caderno.chapters c on v.tipo='chapter' and c.id  = v.entidade_id
    left join caderno.shelves s on v.tipo='shelf'   and s.id  = v.entidade_id
   where v.user_id = auth.uid()
     and coalesce(b.nome, pg.nome, c.nome, s.nome) is not null  -- entidade ainda existe
   order by v.visto_em desc
   limit _limit;
$$;
grant execute on function caderno.meus_vistos(int) to authenticated;

-- livros populares (mais vistos no total) que o usuario pode ver
create or replace function caderno.livros_populares(_limit int default 8)
returns setof caderno.books
language sql stable security definer set search_path = caderno, public
as $$
  select b.*
    from caderno.books b
    left join (select entidade_id, sum(vezes) v from caderno.views
                where tipo='book' group by entidade_id) vv on vv.entidade_id = b.id
   where caderno.pode_ver(b.visibilidade, b.team_id, b.created_by)
   order by coalesce(vv.v, 0) desc, b.updated_at desc
   limit _limit;
$$;
grant execute on function caderno.livros_populares(int) to authenticated;

-- ============================================================
-- 4) FAVORITOS (com nome resolvido + nº de visualizacoes)
-- ============================================================
create or replace function caderno.meus_favoritos()
returns table (tipo text, entidade_id uuid, nome text, book_id uuid, vezes int)
language sql stable security definer set search_path = caderno, public
as $$
  select f.tipo, f.entidade_id,
         case f.tipo when 'book' then b.nome when 'page' then pg.nome
                     when 'chapter' then c.nome when 'shelf' then s.nome end as nome,
         case f.tipo when 'page' then pg.book_id when 'chapter' then c.book_id
                     when 'book' then b.id else null end as book_id,
         coalesce((select sum(vezes)::int from caderno.views v
                    where v.tipo = f.tipo and v.entidade_id = f.entidade_id), 0) as vezes
    from caderno.favorites f
    left join caderno.books b    on f.tipo='book'    and b.id  = f.entidade_id
    left join caderno.pages pg   on f.tipo='page'    and pg.id = f.entidade_id
    left join caderno.chapters c on f.tipo='chapter' and c.id  = f.entidade_id
    left join caderno.shelves s  on f.tipo='shelf'   and s.id  = f.entidade_id
   where f.user_id = auth.uid()
     and coalesce(b.nome, pg.nome, c.nome, s.nome) is not null
   order by vezes desc, nome;
$$;
grant execute on function caderno.meus_favoritos() to authenticated;

-- ============================================================
-- 5) MEUS RASCUNHOS (paginas em rascunho do usuario)
-- ============================================================
create or replace function caderno.meus_rascunhos(_limit int default 10)
returns table (page_id uuid, nome text, book_id uuid, book_nome text, updated_at timestamptz)
language sql stable security invoker set search_path = caderno, public
as $$
  select p.id, p.nome, p.book_id, b.nome, p.updated_at
    from caderno.pages p
    join caderno.books b on b.id = p.book_id
   where p.rascunho and p.created_by = auth.uid()
   order by p.updated_at desc
   limit _limit;
$$;
grant execute on function caderno.meus_rascunhos(int) to authenticated;

-- ============================================================
-- TESTE
-- ============================================================
--   select * from caderno.atividade_recente(10);
--   select caderno.registrar_view('book', '<book_id>');
--   select * from caderno.meus_vistos(10);
--   select * from caderno.livros_populares(8);
--   select * from caderno.meus_favoritos();
--   select * from caderno.meus_rascunhos(10);
