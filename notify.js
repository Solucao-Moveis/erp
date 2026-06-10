/* ============================================================
   SMERP — Avisos no computador (notificações).
   ------------------------------------------------------------
   Camada única que o resto do Hub usa. Esconde a diferença entre:
     • App de PC (Tauri)  -> notificação NATIVA do SO (plugin).
     • Navegador / PWA    -> Web Notification (app aberto) e
                             Web Push via service worker (app fechado).
   Tudo ADITIVO: se o ambiente não suporta, as funções viram no-op
   e o Hub segue funcionando igual.
   Exposto como window.SMERPNotify.
   ============================================================ */
(function () {
  var CFG = window.SMERP_CONFIG || {};

  function isTauri() {
    return typeof window !== 'undefined' && !!window.__TAURI__;
  }
  function tauriNotif() {
    return (isTauri() && window.__TAURI__ && window.__TAURI__.notification) || null;
  }

  // ---- Suporte / permissão -------------------------------------------------
  function supported() {
    return isTauri() || ('Notification' in window);
  }

  // 'granted' | 'denied' | 'default' | 'unsupported'
  function permission() {
    if (isTauri()) return 'default';            // o Tauri pergunta na hora de enviar
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }

  // Pede permissão (precisa de um gesto do usuário). Resolve true se liberado.
  async function ensurePermission() {
    try {
      var t = tauriNotif();
      if (t) {
        var granted = await t.isPermissionGranted();
        if (!granted) granted = (await t.requestPermission()) === 'granted';
        return !!granted;
      }
      if (!('Notification' in window)) return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      return (await Notification.requestPermission()) === 'granted';
    } catch (e) {
      console.warn('[SMERP] ensurePermission:', e && e.message);
      return false;
    }
  }

  // ---- Mostrar um aviso AGORA (app aberto) ---------------------------------
  function notify(title, body, opts) {
    opts = opts || {};
    try {
      var t = tauriNotif();
      if (t) { t.sendNotification({ title: title, body: body || '' }); return; }
      if (('Notification' in window) && Notification.permission === 'granted') {
        var n = new Notification(title, {
          body: body || '',
          icon: 'assets/icon-192.png',
          badge: 'assets/icon-192.png',
          tag: opts.tag || 'smerp',
          renotify: true
        });
        n.onclick = function () {
          try { window.focus(); } catch (e) {}
          if (opts.url) { try { window.open(opts.url, '_blank'); } catch (e) {} }
          n.close();
        };
      }
    } catch (e) {
      console.warn('[SMERP] notify:', e && e.message);
    }
  }

  // ---- Web Push (app fechado) ----------------------------------------------
  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function pushSupported() {
    return ('serviceWorker' in navigator) && ('PushManager' in window) && !isTauri();
  }

  // Inscreve no Web Push e grava a inscrição no banco (RPC save_push_subscription).
  // No Tauri o push de SO fechado não se aplica (vide bandeja) — vira no-op.
  async function subscribePush(sb) {
    try {
      if (!pushSupported() || !CFG.VAPID_PUBLIC_KEY || !sb) return false;
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(CFG.VAPID_PUBLIC_KEY)
        });
      }
      var json = sub.toJSON();
      var res = await sb.rpc('save_push_subscription', {
        p_endpoint: sub.endpoint,
        p_p256dh: json.keys && json.keys.p256dh,
        p_auth: json.keys && json.keys.auth,
        p_ua: navigator.userAgent || null
      });
      if (res && res.error) { console.warn('[SMERP] save_push_subscription:', res.error.message); return false; }
      return true;
    } catch (e) {
      console.warn('[SMERP] subscribePush:', e && e.message);
      return false;
    }
  }

  // Remove a inscrição local e do banco (ao sair, opcional).
  async function unsubscribePush(sb) {
    try {
      if (!('serviceWorker' in navigator)) return;
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      var endpoint = sub.endpoint;
      try { await sub.unsubscribe(); } catch (e) {}
      if (sb) { try { await sb.rpc('delete_push_subscription', { p_endpoint: endpoint }); } catch (e) {} }
    } catch (e) {
      console.warn('[SMERP] unsubscribePush:', e && e.message);
    }
  }

  window.SMERPNotify = {
    isTauri: isTauri,
    supported: supported,
    permission: permission,
    ensurePermission: ensurePermission,
    notify: notify,
    pushSupported: pushSupported,
    subscribePush: subscribePush,
    unsubscribePush: unsubscribePush
  };
})();
