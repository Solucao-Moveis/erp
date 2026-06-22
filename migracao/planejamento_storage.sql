-- ============================================================================
-- PLANEJAMENTO — bucket de anexos (Supabase Storage)
-- O componente AnexoClip sobe os arquivos no bucket privado 'planejamento'
-- e abre via signed URL. Rodar no SQL Editor do Supabase SMERP. Idempotente.
-- ============================================================================

-- Bucket PRIVADO (acesso só via signed URL p/ quem tem acesso ao módulo)
insert into storage.buckets (id, name, public)
values ('planejamento', 'planejamento', false)
on conflict (id) do nothing;

-- Quem tem acesso ao módulo (planejamento.is_member) lê/grava/remove neste bucket.
drop policy if exists "planejamento_anexo_read"   on storage.objects;
create policy "planejamento_anexo_read" on storage.objects for select to authenticated
  using (bucket_id = 'planejamento' and planejamento.is_member(auth.uid()));

drop policy if exists "planejamento_anexo_insert" on storage.objects;
create policy "planejamento_anexo_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'planejamento' and planejamento.is_member(auth.uid()));

drop policy if exists "planejamento_anexo_update" on storage.objects;
create policy "planejamento_anexo_update" on storage.objects for update to authenticated
  using (bucket_id = 'planejamento' and planejamento.is_member(auth.uid()));

drop policy if exists "planejamento_anexo_delete" on storage.objects;
create policy "planejamento_anexo_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'planejamento' and planejamento.is_member(auth.uid()));
