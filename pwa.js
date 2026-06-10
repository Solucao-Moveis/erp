/* ============================================================
   SMERP — PWA: registro do service worker + INSTALAR/BAIXAR o app.
   ------------------------------------------------------------
   • Registra o service worker (instalar na tela inicial / abrir rápido).
   • Botão de download no rodapé da barra lateral (estilo do Claude):
       - "Instalar no navegador" -> dispara o prompt nativo do PWA
         (vira app na hora; só funciona quando o navegador permite).
       - "Baixar para Windows"   -> baixa o instalador .exe servido
         pelo próprio Hub (config WINDOWS_INSTALLER_URL).
   Tudo ADITIVO: se algo não houver, degrada sem quebrar o Hub.
   ============================================================ */
(function () {
  var CFG = window.SMERP_CONFIG || {};

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (err) {
        console.warn('[SMERP] PWA service worker não registrou:', err);
      });
    });
  }

  var deferredPrompt = null;   // evento beforeinstallprompt guardado
  function isTauri() { return !!window.__TAURI__; }
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
           window.navigator.standalone === true;
  }
  function canInstallPwa() { return !!deferredPrompt; }

  async function promptInstall() {
    if (!deferredPrompt) return false;
    var ev = deferredPrompt;
    deferredPrompt = null;
    try { ev.prompt(); await ev.userChoice; } catch (e) {}
    syncDownloadUI();
    return true;
  }

  // --- UI do rodapé (botão + menu) -----------------------------------------
  function el(id) { return document.getElementById(id); }

  function syncDownloadUI() {
    var btn = el('btnDownload');
    if (!btn) return;
    // No app de PC (Tauri) você já está dentro do app: esconde o botão.
    btn.hidden = isTauri();

    var pwaItem = el('dlInstallPwa');
    if (pwaItem) {
      // Desabilita "Instalar no navegador" quando não dá (já instalado / sem suporte).
      var ok = canInstallPwa() && !isStandalone();
      pwaItem.classList.toggle('is-disabled', !ok);
      pwaItem.title = ok ? '' : 'Já instalado ou não disponível neste navegador';
    }
    var win = el('dlWindows');
    if (win && CFG.WINDOWS_INSTALLER_URL) win.setAttribute('href', CFG.WINDOWS_INSTALLER_URL);
  }

  function openMenu() {
    var menu = el('dlMenu'), btn = el('btnDownload');
    if (!menu) return;
    syncDownloadUI();
    menu.hidden = false;
    if (btn) btn.setAttribute('aria-expanded', 'true');
    setTimeout(function () { document.addEventListener('click', onDocClick, true); }, 0);
    document.addEventListener('keydown', onEsc);
  }
  function closeMenu() {
    var menu = el('dlMenu'), btn = el('btnDownload');
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onEsc);
  }
  function onDocClick(e) {
    var menu = el('dlMenu'), btn = el('btnDownload');
    if (menu && (menu.contains(e.target) || (btn && btn.contains(e.target)))) return;
    closeMenu();
  }
  function onEsc(e) { if (e.key === 'Escape') closeMenu(); }

  function wireDownload() {
    var btn = el('btnDownload');
    if (!btn || btn.__wired) return;
    btn.__wired = true;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var menu = el('dlMenu');
      if (menu && menu.hidden) openMenu(); else closeMenu();
    });

    var pwaItem = el('dlInstallPwa');
    if (pwaItem) pwaItem.addEventListener('click', async function () {
      closeMenu();
      if (canInstallPwa()) { await promptInstall(); }
      else { alert('Para instalar pelo navegador, use o Microsoft Edge ou o Chrome. Pelo Windows, baixe o instalador .exe.'); }
    });

    var win = el('dlWindows');
    if (win) win.addEventListener('click', function () { closeMenu(); }); // o download é via href

    syncDownloadUI();
  }

  // beforeinstallprompt: guarda o evento e reflete na UI.
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    syncDownloadUI();
  });
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    syncDownloadUI();
  });

  // API enxuta pra quem quiser disparar a instalação de outro lugar.
  window.SMERPInstall = { available: canInstallPwa, prompt: promptInstall };

  if (document.readyState !== 'loading') wireDownload();
  else document.addEventListener('DOMContentLoaded', wireDownload);
})();
