/* ============================================================
   SMERP — Serviço de Web Push.
   ------------------------------------------------------------
   Recebe POST /push  { user_id, title, body, url }  do banco (via
   pg_net, função notify.send_push), busca as inscrições do usuário
   no Supabase (service role) e entrega a notificação assinada (VAPID).
   Inscrições mortas (404/410) são removidas.
   Protegido por um segredo compartilhado no header x-push-secret.
   ============================================================ */
import express from 'express';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const {
  PORT = '3000',
  PUSH_SECRET,
  VAPID_PUBLIC,
  VAPID_PRIVATE,
  VAPID_SUBJECT = 'mailto:operacoesgeonai@gmail.com',
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

for (const [k, v] of Object.entries({ PUSH_SECRET, VAPID_PUBLIC, VAPID_PRIVATE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!v) { console.error(`[push] Falta a variável de ambiente ${k}`); process.exit(1); }
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const app = express();
app.use(express.json({ limit: '64kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/push', async (req, res) => {
  if (req.get('x-push-secret') !== PUSH_SECRET) return res.status(401).json({ error: 'unauthorized' });

  const { user_id, title, body, url } = req.body || {};
  if (!user_id || !title) return res.status(400).json({ error: 'user_id e title são obrigatórios' });

  // Responde já (fire-and-forget); a entrega segue em segundo plano.
  res.json({ ok: true });

  try {
    const { data: subs, error } = await sb
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth_key')
      .eq('user_id', user_id);
    if (error) { console.error('[push] consulta:', error.message); return; }
    if (!subs || !subs.length) return;

    const payload = JSON.stringify({ title, body: body || '', url: url || '/' });
    const dead = [];

    await Promise.all(subs.map(async (s) => {
      const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } };
      try {
        await webpush.sendNotification(subscription, payload);
      } catch (err) {
        const code = err && err.statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint);        // inscrição expirada
        else console.warn('[push] envio falhou:', code || (err && err.message));
      }
    }));

    if (dead.length) {
      await sb.from('push_subscriptions').delete().in('endpoint', dead);
      console.log(`[push] removidas ${dead.length} inscrição(ões) morta(s)`);
    }
  } catch (e) {
    console.error('[push] erro geral:', e && e.message);
  }
});

app.listen(Number(PORT), () => console.log(`[push] serviço ouvindo na porta ${PORT}`));
