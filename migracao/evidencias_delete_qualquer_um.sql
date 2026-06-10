-- Planos de Ação (Gestor de Projeto): permitir que QUALQUER usuário autenticado
-- remova evidências (antes só o autor do upload conseguia).
-- Rodar no SQL Editor do Supabase SMERP.

-- 1) Tabela planos_acao.evidencias --------------------------------------------
DROP POLICY IF EXISTS "evidencias_delete_own"  ON planos_acao.evidencias;
DROP POLICY IF EXISTS "evidencias_delete_auth" ON planos_acao.evidencias;

CREATE POLICY "evidencias_delete_auth"
  ON planos_acao.evidencias
  FOR DELETE
  TO authenticated
  USING (true);

-- 2) Storage (bucket 'evidencias') --------------------------------------------
-- Buckets são globais (schema storage), não dependem do schema do app.
DROP POLICY IF EXISTS "evidencias_storage_delete"      ON storage.objects;
DROP POLICY IF EXISTS "evidencias_storage_delete_auth" ON storage.objects;

CREATE POLICY "evidencias_storage_delete_auth"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'evidencias');
