-- ============================================================
-- SCHEMA: caderno   (app "Caderno" — clone do BookStack / base de conhecimento)
-- ------------------------------------------------------------
-- Wiki interno do ERP SMERP: estantes (shelves) > livros (books) >
-- capitulos (chapters) > paginas (pages), com revisoes, anexos, tags,
-- comentarios, favoritos, vistos recentes e busca full-text em portugues.
--
-- Acesso: o Caderno e' PESSOAL — todo usuario autenticado tem o seu
-- (ver migracao/utilitarios-my-systems.sql, chave 'utilitarios'). Por isso
-- caderno.has_access() = "esta' autenticado". O isolamento de conteudo e'
-- feito pela VISIBILIDADE (pessoal / time / todos) em cada estante/livro.
--
-- Idempotente: roda do comeco ao fim varias vezes no SQL Editor do Supabase SMERP.
--
-- ATENCAO (PostgREST): o schema 'caderno' precisa estar exposto na variavel
--   PGRST_DB_SCHEMAS (db-schemas) do PostgREST/Supabase no EasyPanel, junto com
--   os demais (public, compras, bip, ...). Isto NAO se roda em SQL — e' config
--   do servico. Sem isso o app nao enxerga as tabelas via REST.
-- ============================================================

create schema if not exists caderno;
grant usage on schema caderno to anon, authenticated, service_role;
alter default privileges in schema caderno grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema caderno grant all on functions to anon, authenticated, service_role;
alter default privileges in schema caderno grant all on sequences to anon, authenticated, service_role;

-- ============================================================
-- ENUMS (idempotentes via duplicate_object)
-- ============================================================
do $$ begin
  create type caderno.app_role as enum ('admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type caderno.visibilidade as enum ('pessoal', 'time', 'todos');
exception when duplicate_object then null; end $$;

-- ============================================================
-- TABELAS
-- ============================================================

-- Perfil do usuario no app (id = auth.users.id).
create table if not exists caderno.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

-- Papeis (admin/member).
create table if not exists caderno.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role caderno.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- Times (para compartilhamento por equipe).
create table if not exists caderno.teams (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

-- Membros de cada time.
create table if not exists caderno.team_members (
  team_id uuid not null references caderno.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- Estantes.
create table if not exists caderno.shelves (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null,
  descricao text,
  capa_url text,
  ordem int not null default 0,
  visibilidade caderno.visibilidade not null default 'pessoal',
  team_id uuid references caderno.teams(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Livros (mesmas colunas das estantes).
create table if not exists caderno.books (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null,
  descricao text,
  capa_url text,
  ordem int not null default 0,
  visibilidade caderno.visibilidade not null default 'pessoal',
  team_id uuid references caderno.teams(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Vinculo N:N estante <-> livro (um livro pode estar em varias estantes).
create table if not exists caderno.shelf_books (
  shelf_id uuid not null references caderno.shelves(id) on delete cascade,
  book_id uuid not null references caderno.books(id) on delete cascade,
  ordem int default 0,
  primary key (shelf_id, book_id)
);

-- Capitulos (dentro de um livro).
create table if not exists caderno.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references caderno.books(id) on delete cascade,
  nome text not null,
  slug text not null,
  descricao text,
  ordem int default 0,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Paginas (conteudo). chapter_id null = pagina solta no livro.
create table if not exists caderno.pages (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references caderno.books(id) on delete cascade,
  chapter_id uuid references caderno.chapters(id) on delete set null,
  nome text not null,
  slug text not null,
  html text not null default '',
  texto text not null default '',
  busca tsvector,
  ordem int default 0,
  rascunho boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Historico de revisoes de uma pagina.
create table if not exists caderno.page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references caderno.pages(id) on delete cascade,
  numero int not null,
  nome text,
  html text,
  resumo text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

-- Anexos de pagina (arquivo no Storage OU link externo).
create table if not exists caderno.attachments (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references caderno.pages(id) on delete cascade,
  nome text,
  externo boolean default false,
  path text,
  url text,
  tamanho bigint,
  mime text,
  ordem int default 0,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

-- Tags (genericas; ligadas por tipo + entidade_id).
create table if not exists caderno.tags (
  id uuid primary key default gen_random_uuid(),
  tipo text check (tipo in ('shelf', 'book', 'chapter', 'page')),
  entidade_id uuid,
  nome text,
  valor text,
  ordem int default 0
);

-- Comentarios em paginas (com thread via parent_id).
create table if not exists caderno.comments (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references caderno.pages(id) on delete cascade,
  parent_id uuid references caderno.comments(id),
  html text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Favoritos do usuario.
create table if not exists caderno.favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo text,
  entidade_id uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, tipo, entidade_id)
);

-- Vistos recentemente.
create table if not exists caderno.views (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo text,
  entidade_id uuid,
  visto_em timestamptz not null default now(),
  primary key (user_id, tipo, entidade_id)
);

-- ============================================================
-- INDICES
-- ============================================================
create index if not exists idx_caderno_pages_busca      on caderno.pages using gin (busca);
create index if not exists idx_caderno_pages_book       on caderno.pages(book_id);
create index if not exists idx_caderno_pages_chapter    on caderno.pages(chapter_id);
create index if not exists idx_caderno_pages_slug       on caderno.pages(slug);
create index if not exists idx_caderno_chapters_book    on caderno.chapters(book_id);
create index if not exists idx_caderno_chapters_slug    on caderno.chapters(slug);
create index if not exists idx_caderno_books_slug       on caderno.books(slug);
create index if not exists idx_caderno_shelves_slug     on caderno.shelves(slug);
create index if not exists idx_caderno_revisions_page   on caderno.page_revisions(page_id);
create index if not exists idx_caderno_attachments_page on caderno.attachments(page_id);
create index if not exists idx_caderno_comments_page    on caderno.comments(page_id);
create index if not exists idx_caderno_tags_entidade    on caderno.tags(tipo, entidade_id);

-- ============================================================
-- HELPERS (security definer)
-- ============================================================

-- gate de acesso ao app: basta estar autenticado (Caderno e' pessoal p/ todos).
create or replace function caderno.has_access(_user_id uuid)
returns boolean
language sql stable security definer set search_path = caderno, public
as $$
  select _user_id is not null
$$;

-- tem o papel informado?
create or replace function caderno.has_role(_user_id uuid, _role caderno.app_role)
returns boolean
language sql stable security definer set search_path = caderno, public
as $$
  select exists (select 1 from caderno.user_roles where user_id = _user_id and role = _role)
$$;

-- usuario faz parte do time?
create or replace function caderno.in_team(_user_id uuid, _team_id uuid)
returns boolean
language sql stable security definer set search_path = caderno, public
as $$
  select exists (
    select 1 from caderno.team_members
    where user_id = _user_id and team_id = _team_id
  )
$$;

-- regra unica de visibilidade (reaproveitada pelas policies de SELECT).
--   'todos'   -> qualquer autenticado
--   'pessoal' -> so o autor
--   'time'    -> membros do time
create or replace function caderno.pode_ver(
  _vis caderno.visibilidade,
  _team_id uuid,
  _created_by uuid
)
returns boolean
language sql stable security definer set search_path = caderno, public
as $$
  select _vis = 'todos'
      or (_vis = 'pessoal' and _created_by = auth.uid())
      or (_vis = 'time'    and caderno.in_team(auth.uid(), _team_id))
$$;

-- regra de edicao de estante/livro: autor, admin, ou membro do time (quando 'time').
create or replace function caderno.pode_editar(
  _vis caderno.visibilidade,
  _team_id uuid,
  _created_by uuid
)
returns boolean
language sql stable security definer set search_path = caderno, public
as $$
  select _created_by = auth.uid()
      or caderno.has_role(auth.uid(), 'admin')
      or (_vis = 'time' and caderno.in_team(auth.uid(), _team_id))
$$;

-- mantem updated_at em dia.
create or replace function caderno.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- monta o tsvector de busca da pagina (nome com peso A, texto com peso B).
create or replace function caderno.pages_busca_trg()
returns trigger
language plpgsql
as $$
begin
  new.busca :=
       setweight(to_tsvector('portuguese', coalesce(new.nome, '')),  'A')
    || setweight(to_tsvector('portuguese', coalesce(new.texto, '')), 'B');
  return new;
end;
$$;

-- profile automatico no signup, COM trava por app (metadado app='caderno').
create or replace function caderno.handle_new_user()
returns trigger
language plpgsql security definer set search_path = caderno, public
as $$
begin
  if (new.raw_user_meta_data->>'app') is distinct from 'caderno' then
    return new;
  end if;

  insert into caderno.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================
-- em auth.users (tabela COMPARTILHADA) — nome prefixado p/ nao colidir.
drop trigger if exists caderno_on_auth_user_created on auth.users;
create trigger caderno_on_auth_user_created
  after insert on auth.users
  for each row execute function caderno.handle_new_user();

drop trigger if exists caderno_pages_busca on caderno.pages;
create trigger caderno_pages_busca
  before insert or update on caderno.pages
  for each row execute function caderno.pages_busca_trg();

drop trigger if exists caderno_shelves_updated_at on caderno.shelves;
create trigger caderno_shelves_updated_at
  before update on caderno.shelves
  for each row execute function caderno.set_updated_at();

drop trigger if exists caderno_books_updated_at on caderno.books;
create trigger caderno_books_updated_at
  before update on caderno.books
  for each row execute function caderno.set_updated_at();

drop trigger if exists caderno_chapters_updated_at on caderno.chapters;
create trigger caderno_chapters_updated_at
  before update on caderno.chapters
  for each row execute function caderno.set_updated_at();

drop trigger if exists caderno_pages_updated_at on caderno.pages;
create trigger caderno_pages_updated_at
  before update on caderno.pages
  for each row execute function caderno.set_updated_at();

drop trigger if exists caderno_comments_updated_at on caderno.comments;
create trigger caderno_comments_updated_at
  before update on caderno.comments
  for each row execute function caderno.set_updated_at();

-- ============================================================
-- RLS — habilitar em TODAS as tabelas
-- ============================================================
alter table caderno.profiles       enable row level security;
alter table caderno.user_roles     enable row level security;
alter table caderno.teams          enable row level security;
alter table caderno.team_members   enable row level security;
alter table caderno.shelves        enable row level security;
alter table caderno.books          enable row level security;
alter table caderno.shelf_books    enable row level security;
alter table caderno.chapters       enable row level security;
alter table caderno.pages          enable row level security;
alter table caderno.page_revisions enable row level security;
alter table caderno.attachments    enable row level security;
alter table caderno.tags           enable row level security;
alter table caderno.comments       enable row level security;
alter table caderno.favorites      enable row level security;
alter table caderno.views          enable row level security;

-- ---------- profiles ----------
drop policy if exists "Profiles view own"   on caderno.profiles;
drop policy if exists "Profiles update own" on caderno.profiles;
drop policy if exists "Profiles insert own" on caderno.profiles;
create policy "Profiles view own"   on caderno.profiles
  for select to authenticated using (auth.uid() = id);
create policy "Profiles update own" on caderno.profiles
  for update to authenticated using (auth.uid() = id);
create policy "Profiles insert own" on caderno.profiles
  for insert to authenticated with check (auth.uid() = id);

-- ---------- user_roles ----------
drop policy if exists "Roles view own" on caderno.user_roles;
create policy "Roles view own" on caderno.user_roles
  for select to authenticated using (auth.uid() = user_id);

-- ---------- teams ---------- (lista de times visivel a autenticados)
drop policy if exists "Teams view" on caderno.teams;
create policy "Teams view" on caderno.teams
  for select to authenticated using (true);

-- ---------- team_members ---------- (proprio + admin)
drop policy if exists "Team members view" on caderno.team_members;
create policy "Team members view" on caderno.team_members
  for select to authenticated
  using (user_id = auth.uid() or caderno.has_role(auth.uid(), 'admin'));

-- ---------- shelves ----------
drop policy if exists "Shelves select" on caderno.shelves;
drop policy if exists "Shelves insert" on caderno.shelves;
drop policy if exists "Shelves update" on caderno.shelves;
drop policy if exists "Shelves delete" on caderno.shelves;
create policy "Shelves select" on caderno.shelves
  for select to authenticated
  using (caderno.pode_ver(visibilidade, team_id, created_by));
create policy "Shelves insert" on caderno.shelves
  for insert to authenticated
  with check (created_by = auth.uid());
create policy "Shelves update" on caderno.shelves
  for update to authenticated
  using (caderno.pode_editar(visibilidade, team_id, created_by))
  with check (caderno.pode_editar(visibilidade, team_id, created_by));
create policy "Shelves delete" on caderno.shelves
  for delete to authenticated
  using (caderno.pode_editar(visibilidade, team_id, created_by));

-- ---------- books ----------
drop policy if exists "Books select" on caderno.books;
drop policy if exists "Books insert" on caderno.books;
drop policy if exists "Books update" on caderno.books;
drop policy if exists "Books delete" on caderno.books;
create policy "Books select" on caderno.books
  for select to authenticated
  using (caderno.pode_ver(visibilidade, team_id, created_by));
create policy "Books insert" on caderno.books
  for insert to authenticated
  with check (created_by = auth.uid());
create policy "Books update" on caderno.books
  for update to authenticated
  using (caderno.pode_editar(visibilidade, team_id, created_by))
  with check (caderno.pode_editar(visibilidade, team_id, created_by));
create policy "Books delete" on caderno.books
  for delete to authenticated
  using (caderno.pode_editar(visibilidade, team_id, created_by));

-- ---------- shelf_books ---------- (acesso ao shelf OU ao book pai)
drop policy if exists "Shelf books select" on caderno.shelf_books;
drop policy if exists "Shelf books all"    on caderno.shelf_books;
create policy "Shelf books select" on caderno.shelf_books
  for select to authenticated
  using (
    exists (select 1 from caderno.shelves s
            where s.id = shelf_id and caderno.pode_ver(s.visibilidade, s.team_id, s.created_by))
    or exists (select 1 from caderno.books b
            where b.id = book_id  and caderno.pode_ver(b.visibilidade, b.team_id, b.created_by))
  );
create policy "Shelf books all" on caderno.shelf_books
  for all to authenticated
  using (
    exists (select 1 from caderno.shelves s
            where s.id = shelf_id and caderno.pode_editar(s.visibilidade, s.team_id, s.created_by))
    or exists (select 1 from caderno.books b
            where b.id = book_id  and caderno.pode_editar(b.visibilidade, b.team_id, b.created_by))
  )
  with check (
    exists (select 1 from caderno.shelves s
            where s.id = shelf_id and caderno.pode_editar(s.visibilidade, s.team_id, s.created_by))
    or exists (select 1 from caderno.books b
            where b.id = book_id  and caderno.pode_editar(b.visibilidade, b.team_id, b.created_by))
  );

-- ---------- chapters ---------- (herdam do livro pai)
drop policy if exists "Chapters select" on caderno.chapters;
drop policy if exists "Chapters insert" on caderno.chapters;
drop policy if exists "Chapters update" on caderno.chapters;
drop policy if exists "Chapters delete" on caderno.chapters;
create policy "Chapters select" on caderno.chapters
  for select to authenticated
  using (exists (select 1 from caderno.books b
                 where b.id = book_id and caderno.pode_ver(b.visibilidade, b.team_id, b.created_by)));
create policy "Chapters insert" on caderno.chapters
  for insert to authenticated
  with check (exists (select 1 from caderno.books b
                 where b.id = book_id and caderno.pode_editar(b.visibilidade, b.team_id, b.created_by)));
create policy "Chapters update" on caderno.chapters
  for update to authenticated
  using (exists (select 1 from caderno.books b
                 where b.id = book_id and caderno.pode_editar(b.visibilidade, b.team_id, b.created_by)))
  with check (exists (select 1 from caderno.books b
                 where b.id = book_id and caderno.pode_editar(b.visibilidade, b.team_id, b.created_by)));
create policy "Chapters delete" on caderno.chapters
  for delete to authenticated
  using (exists (select 1 from caderno.books b
                 where b.id = book_id and caderno.pode_editar(b.visibilidade, b.team_id, b.created_by)));

-- ---------- pages ---------- (herdam do livro pai)
drop policy if exists "Pages select" on caderno.pages;
drop policy if exists "Pages insert" on caderno.pages;
drop policy if exists "Pages update" on caderno.pages;
drop policy if exists "Pages delete" on caderno.pages;
create policy "Pages select" on caderno.pages
  for select to authenticated
  using (exists (select 1 from caderno.books b
                 where b.id = book_id and caderno.pode_ver(b.visibilidade, b.team_id, b.created_by)));
create policy "Pages insert" on caderno.pages
  for insert to authenticated
  with check (exists (select 1 from caderno.books b
                 where b.id = book_id and caderno.pode_editar(b.visibilidade, b.team_id, b.created_by)));
create policy "Pages update" on caderno.pages
  for update to authenticated
  using (exists (select 1 from caderno.books b
                 where b.id = book_id and caderno.pode_editar(b.visibilidade, b.team_id, b.created_by)))
  with check (exists (select 1 from caderno.books b
                 where b.id = book_id and caderno.pode_editar(b.visibilidade, b.team_id, b.created_by)));
create policy "Pages delete" on caderno.pages
  for delete to authenticated
  using (exists (select 1 from caderno.books b
                 where b.id = book_id and caderno.pode_editar(b.visibilidade, b.team_id, b.created_by)));

-- ---------- page_revisions ---------- (via page -> book)
drop policy if exists "Revisions select" on caderno.page_revisions;
drop policy if exists "Revisions insert" on caderno.page_revisions;
create policy "Revisions select" on caderno.page_revisions
  for select to authenticated
  using (exists (select 1 from caderno.pages p
                 join caderno.books b on b.id = p.book_id
                 where p.id = page_id and caderno.pode_ver(b.visibilidade, b.team_id, b.created_by)));
create policy "Revisions insert" on caderno.page_revisions
  for insert to authenticated
  with check (exists (select 1 from caderno.pages p
                 join caderno.books b on b.id = p.book_id
                 where p.id = page_id and caderno.pode_editar(b.visibilidade, b.team_id, b.created_by)));

-- ---------- attachments ---------- (via page -> book)
drop policy if exists "Attachments select" on caderno.attachments;
drop policy if exists "Attachments insert" on caderno.attachments;
drop policy if exists "Attachments update" on caderno.attachments;
drop policy if exists "Attachments delete" on caderno.attachments;
create policy "Attachments select" on caderno.attachments
  for select to authenticated
  using (exists (select 1 from caderno.pages p
                 join caderno.books b on b.id = p.book_id
                 where p.id = page_id and caderno.pode_ver(b.visibilidade, b.team_id, b.created_by)));
create policy "Attachments insert" on caderno.attachments
  for insert to authenticated
  with check (exists (select 1 from caderno.pages p
                 join caderno.books b on b.id = p.book_id
                 where p.id = page_id and caderno.pode_editar(b.visibilidade, b.team_id, b.created_by)));
create policy "Attachments update" on caderno.attachments
  for update to authenticated
  using (exists (select 1 from caderno.pages p
                 join caderno.books b on b.id = p.book_id
                 where p.id = page_id and caderno.pode_editar(b.visibilidade, b.team_id, b.created_by)))
  with check (exists (select 1 from caderno.pages p
                 join caderno.books b on b.id = p.book_id
                 where p.id = page_id and caderno.pode_editar(b.visibilidade, b.team_id, b.created_by)));
create policy "Attachments delete" on caderno.attachments
  for delete to authenticated
  using (exists (select 1 from caderno.pages p
                 join caderno.books b on b.id = p.book_id
                 where p.id = page_id and caderno.pode_editar(b.visibilidade, b.team_id, b.created_by)));

-- ---------- comments ---------- (via page -> book; ver herda, editar/apagar = autor ou admin)
drop policy if exists "Comments select" on caderno.comments;
drop policy if exists "Comments insert" on caderno.comments;
drop policy if exists "Comments update" on caderno.comments;
drop policy if exists "Comments delete" on caderno.comments;
create policy "Comments select" on caderno.comments
  for select to authenticated
  using (exists (select 1 from caderno.pages p
                 join caderno.books b on b.id = p.book_id
                 where p.id = page_id and caderno.pode_ver(b.visibilidade, b.team_id, b.created_by)));
create policy "Comments insert" on caderno.comments
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (select 1 from caderno.pages p
                join caderno.books b on b.id = p.book_id
                where p.id = page_id and caderno.pode_ver(b.visibilidade, b.team_id, b.created_by))
  );
create policy "Comments update" on caderno.comments
  for update to authenticated
  using (created_by = auth.uid() or caderno.has_role(auth.uid(), 'admin'))
  with check (created_by = auth.uid() or caderno.has_role(auth.uid(), 'admin'));
create policy "Comments delete" on caderno.comments
  for delete to authenticated
  using (created_by = auth.uid() or caderno.has_role(auth.uid(), 'admin'));

-- ---------- tags ---------- (acesso a quem tem o app; isolamento e' por entidade no app)
drop policy if exists "Tags all" on caderno.tags;
create policy "Tags all" on caderno.tags
  for all to authenticated
  using (caderno.has_access(auth.uid()))
  with check (caderno.has_access(auth.uid()));

-- ---------- favorites ---------- (so o proprio)
drop policy if exists "Favorites own" on caderno.favorites;
create policy "Favorites own" on caderno.favorites
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- views ---------- (so o proprio)
drop policy if exists "Views own" on caderno.views;
create policy "Views own" on caderno.views
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- BUSCA para o app (SECURITY INVOKER — respeita o RLS do usuario)
-- ============================================================
create or replace function caderno.buscar_paginas(termo text)
returns table (
  page_id   uuid,
  nome      text,
  book_id   uuid,
  book_nome text,
  trecho    text,
  rank      real
)
language sql stable security invoker set search_path = caderno, public
as $$
  select
    p.id   as page_id,
    p.nome as nome,
    p.book_id as book_id,
    b.nome as book_nome,
    ts_headline('portuguese', p.texto, q, 'MaxWords=30, MinWords=10') as trecho,
    ts_rank(p.busca, q) as rank
  from caderno.pages p
  join caderno.books b on b.id = p.book_id,
       websearch_to_tsquery('portuguese', termo) q
  where p.busca @@ q
  order by rank desc
  limit 50
$$;

grant execute on function caderno.buscar_paginas(text) to authenticated;

-- ============================================================
-- GRANTS explicitos (garantia p/ o PostgREST)
-- ============================================================
grant select, insert, update, delete on all tables in schema caderno to authenticated;
grant all on all tables in schema caderno to service_role;

-- ============================================================
-- STORAGE: bucket de midia (publico p/ imagens inline via URL publica)
-- nome global -> policies prefixadas com 'caderno'.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('caderno-midia', 'caderno-midia', true)
on conflict (id) do nothing;

drop policy if exists "caderno midia read"   on storage.objects;
drop policy if exists "caderno midia insert" on storage.objects;
drop policy if exists "caderno midia update" on storage.objects;
drop policy if exists "caderno midia delete" on storage.objects;
create policy "caderno midia read"   on storage.objects for select
  using (bucket_id = 'caderno-midia');
create policy "caderno midia insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'caderno-midia');
create policy "caderno midia update" on storage.objects for update to authenticated
  using (bucket_id = 'caderno-midia');
create policy "caderno midia delete" on storage.objects for delete to authenticated
  using (bucket_id = 'caderno-midia');

-- ============================================================
-- TESTE rapido (logado como um usuario com acesso)
-- ============================================================
--   select caderno.has_access(auth.uid());        -- true se autenticado
--   select * from caderno.shelves;                 -- vazio, sem erro de permissao
--   select * from caderno.buscar_paginas('compressor');
--   -- conferir que o schema esta' exposto no PostgREST (db-schemas) p/ o REST.
