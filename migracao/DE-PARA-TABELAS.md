# DE-PARA das tabelas — Lovable → SMERP (exato)

## Regra geral
No **Lovable**, cada app vive no schema `public` do **seu próprio projeto**. No **SMERP** (banco único), cada app vive no **seu schema**. **O nome da tabela é o mesmo — muda só o schema.**

| Sistema | Projeto Lovable (ref) | Origem | Destino no SMERP |
|---|---|---|---|
| compras (SC Manager) | `wbxnaemipiqxtaledycl` | `public.<tabela>` | `compras.<tabela>` |
| hora a hora (fabrill) | `oqghoelwiqnpcfmijhny` | `public.<tabela>` | `fabrill.<tabela>` |
| bip | `dbdoacdhflrxjlngpwif` | `public.<tabela>` | `bip.<tabela>` |

**Identidade (compartilhada):** `auth.users` / `auth.identities` do Lovable → **mesmo `auth.users` único** do SMERP, **deduplicado por e-mail** (1 pessoa = 1 login mesmo se estava em 2 sistemas). O `id` é preservado; quem já existia de outro sistema reusa o `id` canônico.

> Verificado por **cruzamento de 3 fontes** (export real do Lovable × ordem de import do `gen-import.js` × `CREATE TABLE` dos schemas): **bate exato** — 0 tabela exportada sem destino, 0 import sem tabela, 0 tabela órfã.

## compras — `public.X` → `compras.X` (12 tabelas)
| Tabela (mesmo nome) | Linhas (migração) |
|---|---|
| profiles | 17 |
| user_roles | 26 |
| sectors | 62 |
| cost_centers | 62 |
| request_sequences | 1 |
| **items** (catálogo/SKU) | **1547** |
| purchase_requests | 170 |
| request_items | 204 |
| request_comments | 28 |
| request_history | 944 |
| request_attachments | 57 |
| notifications | 1314 |

## fabrill (hora a hora) — `public.X` → `fabrill.X` (13 tabelas)
| Tabela | Linhas |
|---|---|
| areas | 8 |
| machines | 33 |
| profiles | 10 |
| user_roles | 13 |
| user_areas | 16 |
| production_goals | 183 |
| machine_operators | 168 |
| production_entries | 1198 |
| viewer_tokens | 1 |
| overtime_days | 5 |
| meta_justifications | 35 |
| production_deviations | 3 |
| collaborators | 37 |

## bip — `public.X` → `bip.X` (8 tabelas)
| Tabela | Linhas |
|---|---|
| products | 30 |
| loading_orders | 21 |
| loading_order_items | 71 |
| scanned_codes | 1591 |
| profiles | 4 |
| user_roles | 6 |
| audit_log | 1080 |
| loading_photos | 27 |

> **Contagens são da migração**; serão re-conferidas com export fresco na virada das 17h (compras e fabrill). bip não muda (estático).

## Remapeamento de DONO (colunas que apontam pra auth.users)
Pra dedup por e-mail ficar exata, estas colunas são reapontadas pro `id` canônico no import (`gen-import.js` → `userRefs`):
- **compras:** profiles.id, user_roles.user_id, sectors.approver_id, purchase_requests.requester_id, purchase_requests.approver_id, request_comments.user_id, request_history.user_id, request_attachments.uploaded_by, notifications.user_id
- **bip:** profiles.id, user_roles.user_id, audit_log.user_id
- **fabrill:** (sem remap — foi o 1º sistema importado; ids são os canônicos)

## Coluna gerada (pulada no import, o banco recalcula)
- `fabrill.production_deviations.total_weight` (GENERATED = quantity × piece_weight)

## Observações importantes
- **bip não tem dono por linha** nos pedidos: `loading_orders`/`scanned_codes` são **compartilhados** (sem coluna de usuário); o "quem fez" fica em `bip.audit_log`.
- **compras.items** não tinha `CREATE TABLE` nas migrations do Lovable (criada por fora) — foi reconstruída e **conferida idêntica** ao export real (1547, todos com SKU).
- Ordem de import respeita FK (ver `gen-import.js`); compras é dividido em 3 arquivos por tamanho.
