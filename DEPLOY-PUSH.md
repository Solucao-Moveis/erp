# Avisos no Windows (Web Push) — deploy

Notificação do sistema operacional nas **Solicitações**, mesmo com o ERP **fechado**
(PC no Edge/Chrome e Android pelo PWA). Espelha o caminho do WhatsApp: trigger no
banco → `pg_net` → um serviço HTTP. Aqui o serviço é o **push-service** (pasta
`push-service/`), que assina o Web Push com a chave VAPID e entrega.

> O "app aberto" já avisa sozinho (o Hub vigia as solicitações a cada ~45s). Este
> deploy é só pro **app fechado**.

## Visão geral

```
Hub (notify.js) --salva inscrição--> public.push_subscriptions
solicitação nova/resolvida --> trigger --> pg_net --> push-service /push --> Web Push --> Windows/Android
```

As chaves VAPID já foram geradas:
- **Pública** (já no `config.js`): `BPtoVpZ…OnADxk08`
- **Privada** (só no serviço, fora do git): vai no Environment do push-service.

---

## 1) Rodar o SQL

No **SQL Editor** do Supabase SMERP, rode `migracao/push_solicitacoes.sql`
(cria `public.push_subscriptions`, as RPCs, `notify.send_push` e os 2 triggers).
Pré-requisito: o `migracao/solicitacoes.sql` já foi rodado (já está no ar).

## 2) Subir o push-service no EasyPanel

1. **+ Create → App**. Nome sugerido: `push` (gera `solucaomoveis-push.h5xdag.easypanel.host`).
2. **Source**: GitHub → repo do ERP, branch `main`, **Build Path / Root**: `push-service`.
3. **Build**: Dockerfile (já existe em `push-service/Dockerfile`).
4. **Porta**: `3000` (padrão do EasyPanel).
5. **Environment** (cole; troque os segredos):
   ```env
   PUSH_SECRET=UM-SEGREDO-FORTE
   VAPID_PUBLIC=BPtoVpZVNWhG7bU7lU8z375Xv_tjmebZEvKfQNsyu8_hWeFEOLlQfAHztaquy7KubmDvX-FWVAvjcS_OnADxk08
   VAPID_PRIVATE=<a chave privada VAPID — fora do git; veja onde foi anotada>
   VAPID_SUBJECT=mailto:operacoesgeonai@gmail.com
   SUPABASE_URL=https://supabase-supabase.h5xdag.easypanel.host
   SUPABASE_SERVICE_ROLE_KEY=<a service role key do Supabase SMERP>
   ```
   > A **service role** é secreta (acesso total, ignora RLS) — só vive aqui.
6. **Deploy**. Teste: abrir `https://solucaomoveis-push.h5xdag.easypanel.host/health` → `{"ok":true}`.

## 3) Ligar o banco no serviço (1 linha — NÃO commitar)

No **SQL Editor**, com a URL pública do serviço e o **mesmo** `PUSH_SECRET`:

```sql
insert into notify.push_config (base_url, secret)
values ('https://solucaomoveis-push.h5xdag.easypanel.host', 'UM-SEGREDO-FORTE')
on conflict (id) do update
  set base_url = excluded.base_url, secret = excluded.secret, enabled = true;
```

## 4) Testar de ponta a ponta

1. No **Hub** (Edge/Chrome ou Android PWA), entre, clique em **Ativar avisos** e aceite.
2. **Feche** o app (ou minimize tudo).
3. No SQL Editor, dispare:
   ```sql
   select public.create_solicitacao('manutencao','alta','Teste push','passos...');
   ```
   - O **master** recebe "🔔 Nova solicitação" como toast do Windows.
   - Marque resolvido pra testar a VIA 2 (o solicitante recebe):
   ```sql
   select public.set_solicitacao_status('<uuid>'::uuid,'concluida','feito!');
   ```
4. Diagnóstico do envio (pg_net):
   ```sql
   select id, status_code, error_msg, created from net._http_response order by created desc limit 5;
   ```
   `status_code` 200 = entregue ao serviço. 401 = `PUSH_SECRET` diferente. Vazio = `pg_net` parado.

Desligar temporariamente sem mexer no resto:
```sql
update notify.push_config set enabled = false where id = 1;
```

## Notas
- **Duplicidade:** com o app aberto e visível, o service worker **não** mostra o push
  (o vigia do Hub já avisou) — sem aviso dobrado.
- **Permissão:** o navegador exige um clique do usuário pra liberar — é o botão
  **Ativar avisos** na barra lateral.
- **Tauri (app de PC):** o push de SO-fechado não se aplica (não roda service worker
  com o processo morto); lá o "fechado" é **minimizar pra bandeja**, e o aviso é nativo.
