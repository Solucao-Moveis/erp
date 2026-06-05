/* ============================================================
   SMERP — Registro do Service Worker (PWA Android).
   ADITIVO e isolado: roda depois que a página carrega, sem
   interferir no boot do Hub. Se o navegador não suportar PWA,
   simplesmente não faz nada (o site funciona igual).
   ============================================================ */
(function () {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function (err) {
      console.warn('[SMERP] PWA service worker não registrou:', err);
    });
  });
})();
