-- ============================================================
-- PERFORMANCE: índices faltando no schema manutencao (Pro-Care)
-- ------------------------------------------------------------
-- Diagnóstico: manutencao.ordens_servico (a tabela mais consultada do
-- sistema — Dashboard, Indicadores, tela de Ordens, sino de notificação
-- a cada 30s) não tinha NENHUM índice além da chave primária. Toda leitura
-- filtrando por maquina_id/status/aberto_em/tecnico_id/setor_id fazia
-- sequential scan. Pior: o trigger sync_maquina_status roda 2 consultas
-- nessa mesma tabela em TODA abertura/atendimento/fechamento/cancelamento
-- de OS — ou seja, escrita também sofria, não só leitura.
-- manutencao.preventivas e manutencao.maquinas também estavam sem índice
-- nas colunas usadas em filtro.
--
-- Seguro de rodar a qualquer momento: só cria índice (não altera dados),
-- idempotente (IF NOT EXISTS). Em tabelas desse tamanho (centenas/poucos
-- milhares de linhas) o lock de criação é da ordem de milissegundos.
--
-- Rodar no SQL Editor do Supabase SMERP.
-- ============================================================

-- ordens_servico — cobre: filtros de status/máquina/técnico/setor em
-- ordens.tsx, .in("status",...) do Dashboard, .gte/.lte(aberto_em) do
-- Indicadores, e as duas subqueries do trigger sync_maquina_status.
create index if not exists idx_os_maquina_status  on manutencao.ordens_servico(maquina_id, status);
create index if not exists idx_os_aberto_em       on manutencao.ordens_servico(aberto_em desc);
create index if not exists idx_os_status          on manutencao.ordens_servico(status);
create index if not exists idx_os_tecnico         on manutencao.ordens_servico(tecnico_id);
create index if not exists idx_os_setor           on manutencao.ordens_servico(setor_id);
create index if not exists idx_os_categoria_falha on manutencao.ordens_servico(categoria_falha);

-- preventivas — cobre o calendário mensal (data_agendada) e o filtro por
-- máquina automática (Indicadores/Dashboard).
create index if not exists idx_prev_maquina on manutencao.preventivas(maquina_id);
create index if not exists idx_prev_data    on manutencao.preventivas(data_agendada);

-- maquinas — cobre .eq("ativo",true) (quase toda tela) e
-- .eq("ativo",true).eq("manual",false) (Indicadores/Dashboard/KPIs).
create index if not exists idx_maquinas_ativo_manual on manutencao.maquinas(ativo, manual);
create index if not exists idx_maquinas_setor        on manutencao.maquinas(setor_id);

-- Atualiza as estatísticas do planner imediatamente (sem esperar o autovacuum).
analyze manutencao.ordens_servico;
analyze manutencao.preventivas;
analyze manutencao.maquinas;
