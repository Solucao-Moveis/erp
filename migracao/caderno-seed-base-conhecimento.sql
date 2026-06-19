-- ============================================================
-- SEED: Base de Conhecimento Tecnica (app Caderno, schema 'caderno')
-- ------------------------------------------------------------
-- Cria o time "Manutencao", coloca nele o usuario avesta + todos os
-- usuarios da Manutencao (manutencao.profiles), e monta uma estante
-- compartilhada com 9 livros, cada um com 7 capitulos e 1 pagina-modelo.
--
-- Visibilidade = 'time' (so o time Manutencao enxerga).
-- created_by = avesta (autor "dono" do conteudo seed).
--
-- Idempotente: pode rodar varias vezes sem duplicar.
-- Rodar no SQL Editor do Supabase SMERP DEPOIS de:
--   1) caderno_schema.sql
--   2) avesta-user.sql   (cria o login avesta@solucaomoveis.ind.br)
-- ============================================================

do $$
declare
  v_avesta uuid;
  v_team   uuid;
  v_shelf  uuid;
  v_book   uuid;
  v_chapter uuid;
  v_equip  text;
  v_cat    text;
  v_book_ordem int;
  v_cap_ordem  int;
  v_slug_book  text;
  v_slug_cap   text;

  -- slug feito inline com regexp_replace (minusculas, espacos -> '-').

  -- 9 equipamentos -> viram livros
  equipamentos text[] := array[
    'Laser de Corte',
    'Dobradeiras',
    'Robos de Solda',
    'Compressores',
    'Empilhadeiras',
    'Sistemas de Exaustao',
    'Equipamentos de Movimentacao',
    'Maquinas de Producao',
    'Infraestrutura Predial'
  ];

  -- 7 categorias -> viram capitulos (1 pagina-modelo cada)
  categorias text[] := array[
    'Informacoes Gerais',
    'Documentacao Tecnica',
    'Automacao',
    'Manutencao',
    'Base de Falhas e Diagnosticos',
    'Pecas de Reposicao',
    'Licoes Aprendidas'
  ];
begin
  -- ---------- 1) usuario avesta ----------
  select id into v_avesta
    from auth.users
    where lower(email) = 'avesta@solucaomoveis.ind.br'
    limit 1;

  if v_avesta is null then
    raise exception 'Usuario avesta@solucaomoveis.ind.br nao encontrado. Rode avesta-user.sql antes.';
  end if;

  -- garante profile do avesta no Caderno (created_by referencia auth.users, mas
  -- e' bom ter o profile p/ o app exibir nome/email do autor).
  insert into caderno.profiles (id, email, full_name)
    values (v_avesta, 'avesta@solucaomoveis.ind.br', 'Avesta')
    on conflict (id) do nothing;

  -- ---------- 2) time "Manutencao" ----------
  select id into v_team from caderno.teams where nome = 'Manutencao' limit 1;
  if v_team is null then
    insert into caderno.teams (nome) values ('Manutencao')
      returning id into v_team;
  end if;

  -- avesta entra no time
  insert into caderno.team_members (team_id, user_id)
    values (v_team, v_avesta)
    on conflict (team_id, user_id) do nothing;

  -- todos os usuarios com perfil na Manutencao entram no time
  insert into caderno.team_members (team_id, user_id)
    select v_team, mp.id from manutencao.profiles mp
    on conflict (team_id, user_id) do nothing;

  -- ---------- 3) estante "Base de Conhecimento Tecnica" ----------
  select id into v_shelf
    from caderno.shelves
    where nome = 'Base de Conhecimento Tecnica' and team_id = v_team
    limit 1;
  if v_shelf is null then
    insert into caderno.shelves (nome, slug, descricao, visibilidade, team_id, created_by, ordem)
    values (
      'Base de Conhecimento Tecnica',
      'base-de-conhecimento-tecnica',
      'Documentacao tecnica dos equipamentos e infraestrutura da fabrica (time Manutencao).',
      'time', v_team, v_avesta, 0
    )
    returning id into v_shelf;
  end if;

  -- ---------- 4) livros + capitulos + paginas ----------
  v_book_ordem := 0;
  foreach v_equip in array equipamentos loop
    -- slug do livro
    v_slug_book := regexp_replace(
                     regexp_replace(lower(v_equip), '[^a-z0-9]+', '-', 'g'),
                     '(^-|-$)', '', 'g');

    -- livro (idempotente por nome + team)
    select id into v_book
      from caderno.books
      where nome = v_equip and team_id = v_team
      limit 1;
    if v_book is null then
      insert into caderno.books (nome, slug, descricao, visibilidade, team_id, created_by, ordem)
      values (
        v_equip, v_slug_book,
        'Base de conhecimento do equipamento: ' || v_equip || '.',
        'time', v_team, v_avesta, v_book_ordem
      )
      returning id into v_book;
    end if;

    -- vincula o livro a' estante
    insert into caderno.shelf_books (shelf_id, book_id, ordem)
      values (v_shelf, v_book, v_book_ordem)
      on conflict (shelf_id, book_id) do nothing;

    -- 7 capitulos, cada um com 1 pagina-modelo
    v_cap_ordem := 0;
    foreach v_cat in array categorias loop
      v_slug_cap := regexp_replace(
                      regexp_replace(lower(v_cat), '[^a-z0-9]+', '-', 'g'),
                      '(^-|-$)', '', 'g');

      -- capitulo (idempotente por book + nome)
      select id into v_chapter
        from caderno.chapters
        where book_id = v_book and nome = v_cat
        limit 1;
      if v_chapter is null then
        insert into caderno.chapters (book_id, nome, slug, descricao, created_by, ordem)
        values (v_book, v_cat, v_slug_cap, null, v_avesta, v_cap_ordem)
        returning id into v_chapter;
      end if;

      -- pagina-modelo (idempotente por book + chapter + nome)
      if not exists (
        select 1 from caderno.pages
        where book_id = v_book and chapter_id = v_chapter and nome = v_cat
      ) then
        insert into caderno.pages (book_id, chapter_id, nome, slug, html, texto, created_by, ordem)
        values (
          v_book, v_chapter, v_cat, v_slug_cap,
          '<h2>' || v_cat || '</h2><p>Preencher.</p>',
          v_cat || E'\nPreencher.',
          v_avesta, 0
        );
      end if;

      v_cap_ordem := v_cap_ordem + 1;
    end loop;

    v_book_ordem := v_book_ordem + 1;
  end loop;

  raise notice 'Seed concluido: estante % com % livros (time %).',
    v_shelf, array_length(equipamentos, 1), v_team;
end $$;

-- ============================================================
-- CONFERENCIA
-- ============================================================
--   select * from caderno.teams where nome = 'Manutencao';
--   select count(*) from caderno.team_members tm
--     join caderno.teams t on t.id = tm.team_id where t.nome = 'Manutencao';
--   select b.nome,
--          (select count(*) from caderno.chapters c where c.book_id = b.id) capitulos,
--          (select count(*) from caderno.pages    p where p.book_id = b.id) paginas
--     from caderno.books b order by b.nome;
