-- ============================================================
-- PERFORMANCE: bucket maquina-miniaturas vira público
-- ------------------------------------------------------------
-- Achado: o Dashboard carregava a miniatura de CADA máquina ativa
-- gerando uma signed URL (1 round-trip de rede por máquina) — e repetia
-- isso a cada 60s (refetch automático). Com dezenas de máquinas ativas,
-- isso significava dezenas de requisições em paralelo brigando pelo pool
-- de conexões do navegador, atrasando a tela inteira e o carregamento
-- das próprias imagens.
--
-- Fotos de equipamento não são dado sensível (mesmo padrão já usado no
-- bucket os-midias, que é público) — deixar público elimina o passo de
-- assinatura: a URL vira só uma string, sem request nenhum.
--
-- Rodar no SQL Editor do Supabase SMERP. Precisa do deploy do código
-- (getPublicUrl no lugar de createSignedUrl) pra fazer efeito na tela.
-- ============================================================

update storage.buckets set public = true where id = 'maquina-miniaturas';
