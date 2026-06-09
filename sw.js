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
const CACHE = 'smerp-hub-v2';

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
