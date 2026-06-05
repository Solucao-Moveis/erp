-- ============================================================
-- SCHEMA: gestao  /  GERENCIADOR DE PROJETOS (Kanban) — SMERP
-- ------------------------------------------------------------
-- Mini-Trello dentro do app "SMERP Gerencial". Vive no schema
-- 'gestao' (que o app já usa via db.schema='gestao'), então NÃO
-- precisa mexer no PGRST_DB_SCHEMAS do EasyPanel — só rodar este
-- arquivo e, ao final, `notify pgrst, 'reload schema';`.
--
-- Acesso: novo escopo de área 'projetos' em gestao.user_scopes,
-- liberado pela diretoria na aba "Usuários" (sistema Gerencial).
-- 'diretoria' vê tudo. Projetos têm MEMBROS: só membros (e a
-- diretoria) enxergam o projeto e seus cards.
--
-- Rodar no SQL Editor do Supabase Studio (ou psql) do banco SMERP.
-- Idempotente: pode ser reexecutado com segurança.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Novo escopo 'projetos' no CHECK de gestao.user_scopes
--    (a tabela já existe; create table if not exists não altera o
--    constraint, então trocamos via ALTER de forma idempotente).
-- ------------------------------------------------------------
alter table gestao.user_scopes drop constraint if exists user_scopes_scope_check;
alter table gestao.user_scopes add constraint user_scopes_scope_check
  check (scope in ('diretoria','compras','producao','expedicao','projetos'));

-- ------------------------------------------------------------
-- 1) updated_at helper (reutilizável no schema gestao)
-- ------------------------------------------------------------
create or replace function gestao.set_updated_at()
returns trigger language plpgsql set search_path = gestao
as $$
begin new.updated_at = now(); return new; end $$;

-- ============================================================
-- 2) TABELAS
-- ============================================================

-- Projeto = um quadro Kanban.
create table if not exists gestao.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Quem participa de cada projeto (dono é sempre membro).
create table if not exists gestao.project_members (
  project_id uuid not null references gestao.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'membro' check (role in ('dono','membro')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- Colunas do quadro (listas).
create table if not exists gestao.project_columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references gestao.projects(id) on delete cascade,
  title text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Cards. Guarda project_id (além de column_id) p/ facilitar RLS e mover.
create table if not exists gestao.project_cards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references gestao.projects(id) on delete cascade,
  column_id uuid not null references gestao.project_columns(id) on delete cascade,
  title text not null,
  description text,
  position int not null default 0,
  assignee_id uuid references auth.users(id) on delete set null,
  due_date date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Etiquetas por projeto + vínculo com cards.
create table if not exists gestao.project_labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references gestao.projects(id) on delete cascade,
  name text not null,
  color text not null default '#8B5CF6',
  created_at timestamptz not null default now()
);

create table if not exists gestao.project_card_labels (
  card_id uuid not null references gestao.project_cards(id) on delete cascade,
  label_id uuid not null references gestao.project_labels(id) on delete cascade,
  primary key (card_id, label_id)
);

-- Checklist (subtarefas) do card.
create table if not exists gestao.project_checklist_items (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references gestao.project_cards(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Comentários do card.
create table if not exists gestao.project_comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references gestao.project_cards(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- Anexos do card (arquivo vive no bucket 'project-attachments').
create table if not exists gestao.project_attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references gestao.project_cards(id) on delete cascade,
  path text not null,
  filename text not null,
  size int,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------- ÍNDICES ----------
create index if not exists idx_proj_members_user      on gestao.project_members(user_id);
create index if not exists idx_proj_columns_project   on gestao.project_columns(project_id, position);
create index if not exists idx_proj_cards_board       on gestao.project_cards(project_id, column_id, position);
create index if not exists idx_proj_labels_project    on gestao.project_labels(project_id);
create index if not exists idx_proj_checklist_card    on gestao.project_checklist_items(card_id, position);
create index if not exists idx_proj_comments_card     on gestao.project_comments(card_id, created_at);
create index if not exists idx_proj_attachments_card  on gestao.project_attachments(card_id);

-- ---------- TRIGGERS updated_at ----------
drop trigger if exists trg_projects_updated on gestao.projects;
create trigger trg_projects_updated before update on gestao.projects
  for each row execute function gestao.set_updated_at();
drop trigger if exists trg_proj_cards_updated on gestao.project_cards;
create trigger trg_proj_cards_updated before update on gestao.project_cards
  for each row execute function gestao.set_updated_at();

-- ============================================================
-- 3) FUNÇÕES GUARDIÃS (SECURITY DEFINER)
-- ============================================================

-- true se o usuário é membro do projeto (ou diretoria, que vê tudo).
create or replace function gestao.is_project_member(_project_id uuid, _uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = gestao
as $$
  select exists (
    select 1 from gestao.project_members
    where project_id = _project_id and user_id = _uid
  ) or gestao.can_see('diretoria', _uid)
$$;

-- mesma checagem a partir de um card (resolve o projeto).
create or replace function gestao.is_card_member(_card_id uuid, _uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = gestao
as $$
  select exists (
    select 1 from gestao.project_cards c
    where c.id = _card_id and gestao.is_project_member(c.project_id, _uid)
  )
$$;

-- lista usuários para preencher seletores de membro/responsável/menção.
-- A RLS de gestao.profiles só deixa ver o próprio perfil; este RPC contorna
-- isso de forma controlada (exige escopo 'projetos'). Devolve só quem TEM
-- acesso a Projetos (escopo 'projetos' ou 'diretoria') — não adianta atrelar
-- alguém que nem consegue abrir a aba.
create or replace function gestao.list_users_for_projects()
returns table (id uuid, full_name text, email text)
language plpgsql stable security definer set search_path = gestao
as $$
begin
  if not gestao.can_see('projetos') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select p.id, coalesce(p.full_name, p.email) as full_name, p.email
    from gestao.profiles p
    where exists (
      select 1 from gestao.user_scopes s
      where s.user_id = p.id and s.scope in ('projetos','diretoria')
    )
    order by coalesce(p.full_name, p.email);
end $$;

-- ============================================================
-- 4) RLS
-- ============================================================
alter table gestao.projects                enable row level security;
alter table gestao.project_members          enable row level security;
alter table gestao.project_columns          enable row level security;
alter table gestao.project_cards            enable row level security;
alter table gestao.project_labels           enable row level security;
alter table gestao.project_card_labels      enable row level security;
alter table gestao.project_checklist_items  enable row level security;
alter table gestao.project_comments         enable row level security;
alter table gestao.project_attachments      enable row level security;

-- projects: membro (ou o dono) lê; criador com escopo 'projetos' cria; dono/diretoria edita.
-- IMPORTANTE: incluir `owner_id = auth.uid()` aqui é o que permite o dono ver o
-- projeto recém-criado no `insert ... returning` ANTES de a linha de membro existir
-- (o membro 'dono' só é inserido no passo seguinte). Sem isso, criar projeto falha
-- para quem não é diretoria.
drop policy if exists "proj_select" on gestao.projects;
create policy "proj_select" on gestao.projects for select to authenticated
  using (gestao.is_project_member(id) or owner_id = auth.uid());
drop policy if exists "proj_insert" on gestao.projects;
create policy "proj_insert" on gestao.projects for insert to authenticated
  with check (owner_id = auth.uid() and gestao.can_see('projetos'));
drop policy if exists "proj_update" on gestao.projects;
create policy "proj_update" on gestao.projects for update to authenticated
  using (owner_id = auth.uid() or gestao.can_see('diretoria'));
drop policy if exists "proj_delete" on gestao.projects;
create policy "proj_delete" on gestao.projects for delete to authenticated
  using (owner_id = auth.uid() or gestao.can_see('diretoria'));

-- project_members: membro lê; dono do projeto (ou diretoria) gerencia.
drop policy if exists "pm_select" on gestao.project_members;
create policy "pm_select" on gestao.project_members for select to authenticated
  using (gestao.is_project_member(project_id));
drop policy if exists "pm_admin" on gestao.project_members;
create policy "pm_admin" on gestao.project_members for all to authenticated
  using (
    exists (select 1 from gestao.projects p where p.id = project_id and p.owner_id = auth.uid())
    or gestao.can_see('diretoria')
  )
  with check (
    exists (select 1 from gestao.projects p where p.id = project_id and p.owner_id = auth.uid())
    or gestao.can_see('diretoria')
  );

-- colunas / cards / etiquetas: liberadas a membros do projeto.
drop policy if exists "pcol_all" on gestao.project_columns;
create policy "pcol_all" on gestao.project_columns for all to authenticated
  using (gestao.is_project_member(project_id))
  with check (gestao.is_project_member(project_id));

drop policy if exists "pcard_all" on gestao.project_cards;
create policy "pcard_all" on gestao.project_cards for all to authenticated
  using (gestao.is_project_member(project_id))
  with check (gestao.is_project_member(project_id));

drop policy if exists "plabel_all" on gestao.project_labels;
create policy "plabel_all" on gestao.project_labels for all to authenticated
  using (gestao.is_project_member(project_id))
  with check (gestao.is_project_member(project_id));

-- vínculos card<->etiqueta e checklist: liberados a membros (via card).
drop policy if exists "pcl_all" on gestao.project_card_labels;
create policy "pcl_all" on gestao.project_card_labels for all to authenticated
  using (gestao.is_card_member(card_id))
  with check (gestao.is_card_member(card_id));

drop policy if exists "pchk_all" on gestao.project_checklist_items;
create policy "pchk_all" on gestao.project_checklist_items for all to authenticated
  using (gestao.is_card_member(card_id))
  with check (gestao.is_card_member(card_id));

-- comentários: membro lê; só o próprio autor cria; autor/diretoria apaga.
drop policy if exists "pcm_select" on gestao.project_comments;
create policy "pcm_select" on gestao.project_comments for select to authenticated
  using (gestao.is_card_member(card_id));
drop policy if exists "pcm_insert" on gestao.project_comments;
create policy "pcm_insert" on gestao.project_comments for insert to authenticated
  with check (user_id = auth.uid() and gestao.is_card_member(card_id));
drop policy if exists "pcm_delete" on gestao.project_comments;
create policy "pcm_delete" on gestao.project_comments for delete to authenticated
  using (user_id = auth.uid() or gestao.can_see('diretoria'));

-- anexos: membro lê; só quem subiu cria; autor/diretoria apaga.
drop policy if exists "pat_select" on gestao.project_attachments;
create policy "pat_select" on gestao.project_attachments for select to authenticated
  using (gestao.is_card_member(card_id));
drop policy if exists "pat_insert" on gestao.project_attachments;
create policy "pat_insert" on gestao.project_attachments for insert to authenticated
  with check (uploaded_by = auth.uid() and gestao.is_card_member(card_id));
drop policy if exists "pat_delete" on gestao.project_attachments;
create policy "pat_delete" on gestao.project_attachments for delete to authenticated
  using (uploaded_by = auth.uid() or gestao.can_see('diretoria'));

-- ============================================================
-- 5) GRANTS
-- ============================================================
grant select, insert, update, delete on all tables in schema gestao to authenticated;
grant all on all tables in schema gestao to service_role;

revoke all on function gestao.list_users_for_projects() from public, anon;
grant execute on function gestao.list_users_for_projects() to authenticated;

-- ============================================================
-- 6) STORAGE: bucket + policies (nomes prefixados p/ não colidir)
--    Caminho: <uid>/<card_id>/<timestamp>-<filename>
-- ============================================================
insert into storage.buckets (id, name, public)
values ('project-attachments', 'project-attachments', false)
on conflict (id) do nothing;

drop policy if exists "projetos att_storage_select" on storage.objects;
create policy "projetos att_storage_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'project-attachments' and (
      (auth.uid())::text = (storage.foldername(name))[1]
      or gestao.can_see('diretoria')
      or exists (
        select 1 from gestao.project_attachments pa
        where pa.path = storage.objects.name and gestao.is_card_member(pa.card_id)
      )
    )
  );
drop policy if exists "projetos att_storage_insert" on storage.objects;
create policy "projetos att_storage_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-attachments' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "projetos att_storage_delete" on storage.objects;
create policy "projetos att_storage_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'project-attachments' and (auth.uid()::text = (storage.foldername(name))[1] or gestao.can_see('diretoria')));

-- ============================================================
-- 7) NOTIFICAÇÕES (menção @pessoa nos comentários)
--    Quando alguém é mencionado num comentário, criamos uma linha aqui
--    para o destinatário ver no sininho do Gerencial.
-- ============================================================
create table if not exists gestao.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,   -- destinatário
  actor_id uuid references auth.users(id) on delete set null,          -- quem mencionou
  project_id uuid references gestao.projects(id) on delete cascade,
  card_id uuid references gestao.project_cards(id) on delete cascade,
  comment_id uuid references gestao.project_comments(id) on delete cascade,
  type text not null default 'mention',
  body text,                                                            -- prévia do comentário
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_gestao_notif_user on gestao.notifications(user_id, created_at desc);

alter table gestao.notifications enable row level security;
-- cada um lê/baixa só as próprias notificações.
drop policy if exists "notif_select_own" on gestao.notifications;
create policy "notif_select_own" on gestao.notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "notif_update_own" on gestao.notifications;
create policy "notif_update_own" on gestao.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notif_delete_own" on gestao.notifications;
create policy "notif_delete_own" on gestao.notifications for delete to authenticated
  using (user_id = auth.uid());
-- só dá p/ notificar dentro de um projeto do qual você é membro, em seu próprio nome.
drop policy if exists "notif_insert_mention" on gestao.notifications;
create policy "notif_insert_mention" on gestao.notifications for insert to authenticated
  with check (actor_id = auth.uid() and gestao.is_project_member(project_id));

grant select, insert, update, delete on gestao.notifications to authenticated;
grant all on gestao.notifications to service_role;

-- ============================================================
-- 8) TAREFAS RECORRENTES (prazo mensal + alerta antecipado)
--    Um card recorrente tem um dia do mês como prazo e avisa N dias
--    antes. O alerta (subir ao topo + borda vermelha + sininho) é
--    calculado no app; aqui só guardamos a configuração.
-- ============================================================
alter table gestao.project_cards
  add column if not exists recurring boolean not null default false,
  add column if not exists recur_day int,                            -- 1..31: dia do prazo no mês
  add column if not exists recur_alert_days int not null default 0,  -- avisar N dias antes
  add column if not exists recur_done_period text;                   -- 'YYYY-MM' do último mês concluído
alter table gestao.project_cards drop constraint if exists project_cards_recur_day_chk;
alter table gestao.project_cards add constraint project_cards_recur_day_chk
  check (recur_day is null or (recur_day between 1 and 31));

-- ============================================================
-- Recarrega o cache de schema do PostgREST (expõe as tabelas/RPC novos).
-- ============================================================
notify pgrst, 'reload schema';
