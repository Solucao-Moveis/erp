# Kit da Virada (17h) — repoint dos apps pro SMERP

> Regra de ouro: **nada nos 3 apps até o "GO"** (após o último lançamento). bip = virada simples (não usa mais; sem re-sync). compras + fabrill = re-sync completo antes.

## Alvo (SMERP)
- `VITE_SUPABASE_URL` / `SUPABASE_URL` = `https://supabase-supabase.h5xdag.easypanel.host`
- anon (`VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY`) = **a mesma do `erp/config.js`** (custom, termina em `...LNjFH38`)
- service_role (só bip, `SUPABASE_SERVICE_ROLE_KEY`) = **a do `migracao/migrate-storage.js`**

## Rollback (se algo quebrar)
Valores do Lovable estão no **git de cada app** (`.env` versionado). Reverter = `git revert` do commit do repoint + restaurar o Environment do EasyPanel. Projetos Lovable: compras `wbxnaemipiqxtaledycl` · fabrill `oqghoelwiqnpcfmijhny` · bip `dbdoacdhflrxjlngpwif` (`https://<id>.supabase.co`). Lovable continua intacto.

---

## Passo 0 — Re-sync final (SÓ compras e fabrill)
1. **Congelar**: avisar pra pararem de usar compras e hora a hora no Lovable.
2. **Re-export** (functions ainda vivas): `node` não — via `curl`/Invoke-WebRequest em
   `https://<ref>.supabase.co/functions/v1/export-smerp?token=smerp_export_7f3a9c2e8b14d6f05a1c9e2b&resource=tables|users|storage` (refs compras/fabrill acima).
3. **Refresh no SMERP** (SQL Editor): `TRUNCATE` só as tabelas de DADOS de compras e fabrill (NÃO auth.users/identities/profiles/user_roles) → rodar `gen-import.js` (export fresco) → aplicar import → `cleanup_compras.sql`.
4. **Novos usuários**: `set_default_password.sql` + `fix_auth_null_tokens.sql`.
5. **Storage**: `migrate-storage.js` (novos anexos/fotos).
6. **Conferir 100%**: `relatorio_integridade.sql` + `relatorio_usuarios.sql` + comparar contagens com o export (igual fizemos com items = 1547).

## Passo 1 — Banco (1x)
- `PGRST_DB_SCHEMAS = public,compras,fabrill,bip` no Supabase (EasyPanel) → restart.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE compras.notifications;`

## Passo 2 — Trocar as chaves (cada app, 2 lugares)
- **`.env` versionado** → `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` = SMERP.
- **EasyPanel → Environment** → `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` = SMERP; **bip também** `SUPABASE_SERVICE_ROLE_KEY`.

## Passo 3 — Commit + deploy (ordem: bip → fabrill → compras)
Mudanças locais já prontas em cada app (db.schema nos 3 clients, SSO no boot, `app:'<sistema>'` no cadastro, botão "Voltar ao ERP", fix realtime do compras) + `.env` editado → commit → push.

## Passo 4 — Validar (por app)
Login direto (user real + `12345678`) → vê só o dele (RLS); botão "Voltar ao ERP"; SSO (do ERP cai logado, mesma aba, URL limpa); cadastro cria perfil só no schema certo; compras: notificação realtime.

## Passo 5 — Pós-virada
- **Apagar as 3 edge functions `export-smerp`** do Lovable.
- Avisar pra trocar a senha (todos com `12345678`).
- ERP: adicionar nota em `notas.js` ("agora você acessa tudo pelo SMERP") — conforme REGRAS-DE-COMMIT.md.
