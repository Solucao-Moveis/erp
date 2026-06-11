# Assistente de IA — como colocar no ar

Serviço `ai-service`: o "cérebro" do assistente do Hub. Recebe a conversa do Hub,
fala com o Gemini (Flash) e executa ações no Supabase **usando o token da própria
pessoa** (o RLS filtra o que ela pode ver/fazer). Molde igual ao `push-service`.

## 1) Rodar o SQL (uma vez)

No **SQL Editor** do Supabase SMERP, rode o arquivo:

    migracao/assistente_ia.sql

Ele cria a tabela `public.assistant_users`, a função `public.can_use_assistant()`
(quem pode usar o chat) e a `public.assistant_set_access(...)` (liberar/remover gente).
O **master sempre pode**. Pra liberar mais alguém:

    select public.assistant_set_access(
      (select id from auth.users where lower(email)='fulano@empresa.com'), true);

> Depois de criar funções novas, recarregue o PostgREST:
> `notify pgrst, 'reload schema';`

## 2) Criar o serviço no EasyPanel

1. **New → App** (ou Service). Aponte para este repositório (`erp`).
2. **Build:** Dockerfile. **Build context / path:** `ai-service` (a subpasta).
3. **Port:** `3000`.
4. **Environment** (cole os segredos aqui — NÃO vão pro git):

       GEMINI_API_KEY=<a chave do aistudio.google.com/apikey>
       GEMINI_MODEL=gemini-2.5-flash
       SUPABASE_URL=https://supabase-supabase.h5xdag.easypanel.host
       SUPABASE_ANON_KEY=<a mesma anon key do config.js do Hub>
       ALLOWED_ORIGIN=https://solucaomoveis-erp.h5xdag.easypanel.host

5. **Deploy.** Anote a URL que o EasyPanel gerar (ex.: `https://solucaomoveis-ai.h5xdag.easypanel.host`).
6. Teste a saúde abrindo `…/health` no navegador → deve responder `{"ok":true}`.

## 3) Apontar o Hub pro serviço

No `config.js` do Hub, ajuste `AI_SERVICE_URL` para a URL real do passo 2.5
(o placeholder atual é `https://solucaomoveis-ai.h5xdag.easypanel.host`).
Depois faça **push na main** — o Hub reconstrói sozinho e o botão do assistente
aparece (só pra quem o `can_use_assistant` liberar).

## Como testar (ponta a ponta)

1. Logue no Hub como **master** (já tem acesso ao assistente).
2. Clique no botão laranja (canto inferior direito).
3. Digite: *"abre uma solicitação de 10 cadeiras pro setor X, pra sexta, porque furou estoque"*.
4. O assistente pergunta o que faltar, resume e pede confirmação.
5. Responda *"pode"* → ele cria a SC e devolve o número (ex.: `SC-0001/2026`).
6. Confira no app de Compras que a solicitação apareceu.

## O que já funciona nesta fase

- Chat de texto + **voz** (botão de microfone: fala vira texto — usa o
  reconhecimento do navegador, em pt-BR).
- Ação: **criar solicitação de compra** (com confirmação antes).
- Segurança: age sempre como a pessoa logada (RLS); acesso ao chat liberado só
  pelo master.

## Próximas fases (já planejadas)

- Perguntas de dados ("quantas solicitações abertas", "quantos usuários").
- Metas de produção do BIP/Hora a Hora ("meta da laser x batido hoje").
- Mais ações (pedido de compra, abrir manutenção, criar plano de ação…).
