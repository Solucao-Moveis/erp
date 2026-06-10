/* ============================================================
   SMERP — Service Worker do Hub (PWA Android).
   ADITIVO: não altera nada do site; só permite instalar na tela
   inicial e abrir rápido/offline a "casca" do app.
   ------------------------------------------------------------
   REGRAS DE OURO:
   • Só intercepta GET do MESMO domínio (o Hub). Qualquer coisa de
     fora — Supabase (login/dados), CDN, Google Fonts — passa DIRETO
     pra rede, sem cache. Assim nunca há dado velho nem login fantasma.
   • Navegação (HTML) = rede primeiro (deploy novo entra na hora),
     caindo no cache só se estiver offline.
   • Demais arquivos do Hub = responde do cache e atualiza por trás
     (stale-while-revalidate): abre rápido e se mantém fresco.
   • Pra forçar atualização geral, suba o número do CACHE (v1 -> v2).
   ============================================================ */
const CACHE = 'smerp-hub-v4';

// Casca mínima pra abrir offline. URLs estáveis (sem ?v=) — o resto
// é cacheado sozinho conforme o uso, então a lista fica curta e segura.
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                       // POST/PUT etc. -> rede

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // Supabase/CDN/fonts -> rede direto

  // Navegação (abrir uma página): rede primeiro, cache como rede de segurança.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // Config que muda a cada deploy (cards, papéis, ícones, notas): REDE PRIMEIRO,
  // pra o card novo aparecer na hora — inclusive no celular (PWA). Cai no cache
  // só se estiver offline.
  if (/\/(config|script|notas)\.js$/.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Demais arquivos do Hub: responde do cache e revalida por trás.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

/* ============================================================
   WEB PUSH — avisos com o app FECHADO (Solicitações).
   O serviço de push (push-service) manda um JSON: { title, body, url }.
   Aqui só mostramos o aviso do Windows e, ao clicar, focamos/abrimos o Hub.
   Tudo defensivo: payload faltando vira um aviso genérico.
   ============================================================ */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  event.waitUntil((async () => {
    // Se o Hub está aberto e visível, o "vigia" do app já avisa — não duplica.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some((c) => c.visibilityState === 'visible')) return;
    await self.registration.showNotification(data.title || 'SMERP', {
      body: data.body || '',
      icon: 'assets/icon-192.png',
      badge: 'assets/icon-192.png',
      tag: data.tag || 'smerp-push',
      renotify: true,
      data: { url: data.url || '/' }
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.focus(); if ('navigate' in c && target !== '/') c.navigate(target).catch(() => {}); return; }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
