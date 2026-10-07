-- ============================================================
-- PCP (app timestamp) — 2 pedidos do Goubiah (Processos):
--
--   1) SIMULADOR DE CARGA: hoje o /simulador guarda tudo só no
--      localStorage do navegador (chave pcp.sim.items) — um único
--      estado global, sem separar por setor, sem salvar no banco.
--      Troca de aba sobrescreve; troca de computador perde tudo.
--      Isso vira "cenários salvos": nomeia, salva no banco, abre
--      de novo depois, compara com outro cenário salvo.
--
--   2) CADERNO VIRTUAL: cada vez que ele salva uma Folha de
--      Apontamentos (cronoanálise), quer que aquilo vire uma
--      "página" permanente e consultável depois (com o gráfico),
--      em vez de só inserir linhas soltas em pcp.cronoanalises.
--      Isso vira uma aba nova "Salvos" na Cronoanálise.
--
-- Rodar no SQL Editor do Supabase SMERP. Idempotente.
-- ============================================================

-- ---------- 1) CENÁRIOS DO SIMULADOR ----------
create table if not exists pcp.simulador_cenarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 1 and 120),
  setor_codigo text references pcp.setores(codigo),
  horas_dia numeric not null default 16,
  fonte_tempo text not null default 'manual',
  itens jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sim_cenarios_setor on pcp.simulador_cenarios (setor_codigo, created_at desc);

alter table pcp.simulador_cenarios enable row level security;

drop policy if exists "auth read cenarios" on pcp.simulador_cenarios;
create policy "auth read cenarios" on pcp.simulador_cenarios
  for select to authenticated using (pcp.has_access(auth.uid()));

drop policy if exists "auth insert cenarios" on pcp.simulador_cenarios;
create policy "auth insert cenarios" on pcp.simulador_cenarios
  for insert to authenticated
  with check (pcp.has_access(auth.uid()) and created_by = auth.uid());

drop policy if exists "owner or pcp update cenarios" on pcp.simulador_cenarios;
create policy "owner or pcp update cenarios" on pcp.simulador_cenarios
  for update to authenticated
  using (pcp.has_access(auth.uid()) and (created_by = auth.uid() or pcp.is_pcp(auth.uid())));

drop policy if exists "owner or pcp delete cenarios" on pcp.simulador_cenarios;
create policy "owner or pcp delete cenarios" on pcp.simulador_cenarios
  for delete to authenticated
  using (pcp.has_access(auth.uid()) and (created_by = auth.uid() or pcp.is_pcp(auth.uid())));

create or replace function pcp.touch_sim_cenarios_updated()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_sim_cenarios_touch on pcp.simulador_cenarios;
create trigger trg_sim_cenarios_touch
  before update on pcp.simulador_cenarios
  for each row execute function pcp.touch_sim_cenarios_updated();

-- ---------- 2) PÁGINAS SALVAS DA FOLHA DE APONTAMENTOS ----------
create table if not exists pcp.folha_paginas (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  operacao text,
  equipamento text,
  operador text,
  turno_horas int not null default 8,
  obs_geral text,
  linhas jsonb not null default '[]'::jsonb,     -- linhas preenchidas (código/descrição/qtd/tempo/observação)
  stats jsonb not null default '{}'::jsonb,       -- médias já calculadas (tempo médio, pçs/h, forwood, repetição) + série pro gráfico
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_folha_paginas_data on pcp.folha_paginas (data desc, created_at desc);

alter table pcp.folha_paginas enable row level security;

drop policy if exists "auth read folha paginas" on pcp.folha_paginas;
create policy "auth read folha paginas" on pcp.folha_paginas
  for select to authenticated using (pcp.has_access(auth.uid()));

drop policy if exists "auth insert folha paginas" on pcp.folha_paginas;
create policy "auth insert folha paginas" on pcp.folha_paginas
  for insert to authenticated
  with check (pcp.has_access(auth.uid()) and created_by = auth.uid());

drop policy if exists "owner or pcp delete folha paginas" on pcp.folha_paginas;
create policy "owner or pcp delete folha paginas" on pcp.folha_paginas
  for delete to authenticated
  using (pcp.has_access(auth.uid()) and (created_by = auth.uid() or pcp.is_pcp(auth.uid())));

-- ============================================================
-- TESTE
-- ============================================================
--   select * from pcp.simulador_cenarios order by created_at desc;
--   select * from pcp.folha_paginas order by data desc, created_at desc;
