# Evolution API no EasyPanel — WhatsApp das Solicitações

Passo a passo pra ligar a notificação por WhatsApp da aba **Solicitações**.
O lado do banco (os 2 SQLs) **já foi rodado** — falta só subir o Evolution,
conectar o WhatsApp e preencher a linha de configuração.

No fim você precisa ter **4 valores** anotados:

| Valor | O que é | Exemplo |
|-------|---------|---------|
| `base_url` | Endereço **interno** do Evolution no EasyPanel | `http://solucaomoveis_evolution:8080` |
| `instance` | Nome da instância (a conexão do WhatsApp) | `smerp` |
| `api_key`  | A chave de API global do Evolution | `uma-chave-bem-grande-e-secreta` |
| `to_number`| **Seu** número (só dígitos, com DDI 55) | `5554999999999` |

---

## 1) Subir o Evolution (Postgres + Redis + App)

O Evolution v2 precisa de um **Postgres** (guardar as conexões/sessão) e de um
**Redis** (cache). Tem dois caminhos no EasyPanel — use o que for mais fácil.

### Opção A — Template pronto (mais fácil) ✅

O EasyPanel tem um template "Evolution API" que cria os 3 serviços de uma vez.

1. No projeto, clique em **+ Create → Template**.
2. Procure por **Evolution API** e selecione.
3. Ele cria: o app `evolution` + um `postgres` + um `redis` já ligados entre si.
4. Antes de finalizar, **defina/confira** a variável `AUTHENTICATION_API_KEY`
   (invente uma chave forte e **guarde** — é o seu `api_key`).
5. Deploy. Pule pro **passo 2** (domínio) se o template não tiver criado um.

### Opção B — Manual (se preferir controlar tudo)

**1. Postgres do Evolution**
- **+ Create → Postgres**. Nome: `evolution-db`.
- Anote usuário, senha, nome do banco e o **host interno** que o EasyPanel mostra
  (algo como `solucaomoveis_evolution-db`), porta `5432`.

**2. Redis**
- **+ Create → Redis**. Nome: `evolution-redis`.
- Anote a senha e o **host interno** (ex.: `solucaomoveis_evolution-redis`), porta `6379`.

**3. App Evolution**
- **+ Create → App**. Nome: `evolution`.
- **Source → Docker Image**: `atendai/evolution-api:latest`
  (ou fixe uma versão v2, ex.: `atendai/evolution-api:v2.2.3` — confira a mais
  nova no Docker Hub).
- **Environment** (cole e ajuste host/senha/chave):
  ```env
  SERVER_URL=https://evolution.<seu-dominio>.easypanel.host
  AUTHENTICATION_API_KEY=uma-chave-bem-grande-e-secreta

  DATABASE_ENABLED=true
  DATABASE_PROVIDER=postgresql
  DATABASE_CONNECTION_URI=postgresql://USUARIO:SENHA@solucaomoveis_evolution-db:5432/evolution
  DATABASE_CONNECTION_CLIENT_NAME=evolution
  DATABASE_SAVE_DATA_INSTANCE=true
  DATABASE_SAVE_DATA_NEW_MESSAGE=true
  DATABASE_SAVE_MESSAGE_UPDATE=true
  DATABASE_SAVE_DATA_CONTACTS=true
  DATABASE_SAVE_DATA_CHATS=true

  CACHE_REDIS_ENABLED=true
  CACHE_REDIS_URI=redis://default:SENHA_REDIS@solucaomoveis_evolution-redis:6379/6
  CACHE_REDIS_PREFIX_KEY=evolution
  CACHE_REDIS_SAVE_INSTANCES=false
  CACHE_LOCAL_ENABLED=false
  ```
  > Troque `USUARIO`/`SENHA`/`SENHA_REDIS` e os hosts pelos que você anotou.
  > O `<seu-dominio>` é o mesmo padrão dos outros serviços (h5xdag…).

---

## 2) Domínio e porta

- Em **Domains** do app `evolution`, confirme/defina a porta **8080**
  (é a porta que o Evolution escuta).
- O EasyPanel cuida do HTTPS sozinho. Anote a URL pública, ex.:
  `https://evolution.solucaomoveis.h5xdag.easypanel.host` — você só vai usar ela
  pra abrir o painel e ler o QR Code. **A notificação do sistema usa o endereço
  interno** (passo 5).
- Clique em **Deploy** e espere o serviço ficar verde/rodando.

---

## 3) Criar a instância e conectar seu WhatsApp (QR Code)

1. Abra o **Manager** no navegador: `https://evolution.<seu-dominio>.easypanel.host/manager`
2. Faça login com a sua `AUTHENTICATION_API_KEY`.
3. Clique em **Create Instance / Nova instância**:
   - **Name**: `smerp`  *(esse vira o seu `instance`)*
   - **Integration / Channel**: **WhatsApp Baileys** (é a opção de QR Code).
4. Abra a instância criada e clique em **Connect / QR Code**.
5. No celular: **WhatsApp → Configurações → Aparelhos conectados → Conectar um
   aparelho** e escaneie o QR.
   - Dica: use de preferência um **número secundário "do sistema"** pra enviar.
     Se for usar o seu próprio número, ele consegue mandar mensagem **pra você
     mesmo** (recurso "Mensagem para você" do WhatsApp) — funciona igual.
6. Quando o status ficar **connected / open** (verde), está conectado. ✔️

---

## 4) Validar o envio (teste rápido)

Antes de ligar no sistema, confirme que o Evolution manda mensagem. Use a URL
**pública** aqui (é só teste). Troque a chave, a instância e o número.

**No PowerShell (Windows):**
```powershell
$headers = @{ "apikey" = "SUA_API_KEY"; "Content-Type" = "application/json" }
$body = @{ number = "5554999999999"; text = "teste do Evolution 🚀" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Headers $headers `
  -Uri "https://evolution.<seu-dominio>.easypanel.host/message/sendText/smerp" `
  -Body $body
```

**Ou com curl (cmd / Git Bash):**
```bash
curl -X POST "https://evolution.<seu-dominio>.easypanel.host/message/sendText/smerp" \
  -H "apikey: SUA_API_KEY" -H "Content-Type: application/json" \
  -d '{"number":"5554999999999","text":"teste do Evolution 🚀"}'
```

➡️ Se a mensagem **chegou no WhatsApp**, está tudo certo. Se não, veja
**Problemas comuns** no fim.

---

## 5) Definir o endereço que o sistema vai usar (`base_url`)

⚠️ **Importante (testado nesta instalação):** o Supabase self-hosted roda numa
**rede Docker própria**, separada do Evolution — então o endereço **interno**
(`http://projeto_evolution:8080`) **NÃO resolve** a partir do Supabase (dá
`Couldn't resolve host name`). Por isso, **use a URL PÚBLICA** como `base_url`:

```
https://supabase-evolution-api.h5xdag.easypanel.host
```

(É a mesma URL do passo 4. O pg_net faz HTTPS sem problema.)

> Só dá pra usar o hostname interno `projeto_evolution:8080` se o Evolution e o
> Supabase estiverem na **mesma rede Docker** — não é o caso aqui.

Esse endereço público é o seu `base_url`.

---

## 6) Ligar no sistema (a linha de config)

Você já rodou os SQLs. Agora rode **só este insert** no **SQL Editor** do
Supabase, com os valores reais (essa linha tem a chave — **não vai pro git**):

```sql
insert into notify.evolution_config (base_url, instance, api_key, to_number)
values ('https://supabase-evolution-api.h5xdag.easypanel.host', 'smerp',
        'SUA_API_KEY', '5554999999999')
on conflict (id) do update
  set base_url = excluded.base_url, instance = excluded.instance,
      api_key  = excluded.api_key,  to_number = excluded.to_number,
      enabled  = true;
```

---

## 7) Testar de ponta a ponta

No **SQL Editor**:

```sql
-- VIA 1: você (master) recebe o chamado novo, e o WhatsApp do solicitante fica gravado
select public.create_solicitacao('manutencao','alta','Teste WhatsApp','passos...', '5554911112222');

-- VIA 2: o número acima recebe o aviso de resolução
select public.set_solicitacao_status('<uuid-do-chamado>'::uuid,'concluida','feito! veja na próxima versão');
```

- No passo da VIA 1, **você** deve receber a mensagem "🔔 Nova solicitação".
- No passo da VIA 2, o número `5554911112222` (troque pelo seu pra testar) recebe
  o "✅ Sua solicitação foi concluída…".
- Pelo **Hub**: abra a aba Solicitações, preencha o campo **WhatsApp** e abra um
  chamado real — você (master) recebe na hora; e quando marcar Feito/Não feito, a
  pessoa recebe.

Pra **desligar** temporariamente sem mexer em nada:
```sql
update notify.evolution_config set enabled = false where id = 1;
```

---

## Problemas comuns

- **Mensagem não chega no teste (passo 4):**
  - Instância não está "connected" → reabra o QR e reconecte.
  - `number` errado → tem que ser **só dígitos com DDI**: `55` + DDD + número.
  - Chave errada → confira `AUTHENTICATION_API_KEY` (header `apikey`).
- **Teste manual funciona, mas o sistema não envia:**
  - `base_url` interno errado → confirme o host `<projeto>_evolution` e a porta `8080`
    (interno é `http://`, não `https://`).
  - Veja o diagnóstico do envio no SQL Editor:
    ```sql
    select id, status_code, error_msg, created
    from net._http_response order by created desc limit 5;
    ```
    Se aparecer erro de conexão, é o `base_url`/rede. Se `status_code` 401 →
    `api_key`. Se vier vazio (nada na fila) → `pg_net` pode não estar processando.
  - Confirme que a linha de config existe e está ligada:
    ```sql
    select base_url, instance, enabled from notify.evolution_config;
    ```
- **`pg_net` não habilitado:** no SQL Editor, `create extension if not exists pg_net;`
  Se der erro de permissão/indisponível, me avise — tem um plano B com Edge Function.

---

> Resumo do fluxo: chamado novo → trigger no Supabase → `pg_net` chama o
> Evolution (rede interna) → Evolution manda o WhatsApp. Tudo "fire-and-forget":
> se o Evolution estiver fora do ar, o chamado abre/atualiza normalmente, só não
> sai a notificação.
