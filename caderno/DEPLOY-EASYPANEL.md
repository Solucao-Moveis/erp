# Caderno (Utilitários) — deploy no EasyPanel

App nativo do ERP (clone do BookStack), no mesmo molde dos outros apps: TanStack Start +
Vite + Bun + Supabase. **Não precisa de banco novo** — usa o schema `caderno` no Supabase
SMERP que já existe. Login é o SSO padrão do hub (sem ponte).

## 1. Banco (SQL Editor do Supabase SMERP — nesta ordem)

1. `erp/migracao/caderno_schema.sql` — cria o schema `caderno` (tabelas, RLS, helpers,
   trigger de busca, bucket de storage `caderno-midia`).
2. `erp/migracao/utilitarios-my-systems.sql` — (se ainda não rodou) libera `utilitarios`
   pra todo usuário autenticado.
3. `erp/migracao/avesta-user.sql` — (se ainda não rodou) cria o login do avesta.
4. `erp/migracao/caderno-seed-base-conhecimento.sql` — cria a "Base de Conhecimento Técnica"
   (time Manutenção) com os 9 equipamentos × 7 capítulos.

### Expor o schema ao PostgREST (IMPORTANTE)
Como nos outros apps, adicione `caderno` à variável de schemas do PostgREST no Supabase do
EasyPanel (env `PGRST_DB_SCHEMAS`, ex.: `public,compras,...,caderno`) e reinicie o serviço
`rest`. Sem isso o app recebe erro de schema desconhecido.

## 2. Serviço do app no EasyPanel

- Novo serviço apontando para o repositório `caderno-solucao`, build por **Dockerfile**
  (igual aos outros apps; usa Bun, serve via `server.mjs` na porta 3000).
- Branch de deploy: `deploy/easypanel-docker` (padrão dos apps). Token CLASSIC com scope
  `repo` p/ o auto-deploy (ver memória `easypanel-github-token-classic`).
- Domínio sugerido: `solucaomoveis-caderno.h5xdag.easypanel.host` (é o que está no
  `erp/config.js` → `APPS.utilitarios`). Se o EasyPanel gerar outro, ajuste lá.
- Variáveis de ambiente (as MESMAS dos outros apps — mesmo Supabase):
  - `VITE_SUPABASE_URL=https://supabase-supabase.h5xdag.easypanel.host`
  - `VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>` (a mesma do hub/config.js)
  - `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` (idem, p/ SSR)
  - (opcional) `SUPABASE_SERVICE_ROLE_KEY` — só se for usar operações admin no servidor.

## 3. Hub

- `erp/config.js` → `APPS.utilitarios` já aponta para o domínio do app. Publique o hub
  (push na `main`). O card **Utilitários → Caderno** abre o app logado (SSO via hash).

## Verificação

1. Abrir o app pelo hub: entra logado, sem nova tela de login.
2. Criar estante → livro → capítulo → página; escrever no editor; colar imagem (vai pro
   bucket `caderno-midia`).
3. Busca acha a página pelo conteúdo.
4. Pessoal vs Equipe: livro `pessoal` só o dono vê; a "Base de Conhecimento Técnica" (time
   Manutenção) aparece pra equipe de manutenção + avesta, e não pros demais.
