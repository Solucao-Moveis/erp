# ENV da virada — como fica o EasyPanel/.env de cada app (compras, fabrill, bip)

## Princípio
Depois da virada, os **3 apps apontam pro MESMO Supabase (SMERP)**. O que separa os dados de cada um é o `db: { schema }` **no código** (compras/fabrill/bip), **não** o env. Logo, **os envs ficam iguais nos 3** (só muda o schema, que está no código).

- SMERP URL: `https://supabase-supabase.h5xdag.easypanel.host`
- anon (pública): `eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImFub24iLCAiaXNzIjogInN1cGFiYXNlIiwgImlhdCI6IDE2NDE3NjkyMDAsICJleHAiOiAxODkzNDU2MDAwfQ.n_Z8vVhAqNlxq3qRr0_JbyBcKilz_Tm4Xjc7LNjFH38`
- service_role (**SECRETA** — pegar de `migrate-storage.js`, NÃO colar em repositório público)

## EasyPanel → Environment (IGUAL nos 3 serviços)
```
SUPABASE_URL=https://supabase-supabase.h5xdag.easypanel.host
SUPABASE_PUBLISHABLE_KEY=<anon acima>
SUPABASE_SERVICE_ROLE_KEY=<service_role do migrate-storage.js>
VITE_SUPABASE_URL=https://supabase-supabase.h5xdag.easypanel.host
VITE_SUPABASE_PUBLISHABLE_KEY=<anon acima>
VITE_SUPABASE_PROJECT_ID=smerp
```
- `SUPABASE_*` (sem VITE) = lado **servidor** (SSR/server functions). `SUPABASE_SERVICE_ROLE_KEY` é usada pelo `client.server.ts` (ex.: criar/excluir usuário no bip) — setar nos 3 por segurança.
- `VITE_SUPABASE_*` = lado **navegador**. Setar aqui TAMBÉM (caso o build use o env do EasyPanel).
- `VITE_SUPABASE_PROJECT_ID` é **cosmético** (o client não usa); pode ser `smerp`.

## `.env` versionado de cada repo (build do navegador)
O Dockerfile injeta as `VITE_*` do `.env` no build, então **edite o `.env` committado** de cada app:
```
VITE_SUPABASE_URL="https://supabase-supabase.h5xdag.easypanel.host"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon acima>"
VITE_SUPABASE_PROJECT_ID="smerp"
```
> Mantemos os dois (`.env` + EasyPanel) com o MESMO valor → sem ambiguidade de qual o build usa.

## ANTES (Lovable) — para rollback
Cada app apontava pro seu projeto Lovable (anon própria, no git de cada `.env`):
| App | ref Lovable | URL |
|---|---|---|
| compras | `wbxnaemipiqxtaledycl` | https://wbxnaemipiqxtaledycl.supabase.co |
| fabrill | `oqghoelwiqnpcfmijhny` | https://oqghoelwiqnpcfmijhny.supabase.co |
| bip | `dbdoacdhflrxjlngpwif` | https://dbdoacdhflrxjlngpwif.supabase.co |

**Rollback** = `git revert` do commit que mexeu no `.env` + devolver o Environment do EasyPanel pros valores Lovable acima (anon de cada um está no histórico do git e nos registros do usuário).

## Diferença que NÃO vai no env (vai no código)
- `db: { schema: 'compras' | 'fabrill' | 'bip' }` no `client.ts`, `client.server.ts` e `auth-middleware.ts` de cada app (já feito localmente).
