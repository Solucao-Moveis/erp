/* ============================================================
   SMERP — interações + login único da Página Principal (Hub)
   ============================================================ */
(function () {
  'use strict';

  /* ---- Menu mobile (hamburguer) ---- */
  var hamburger = document.querySelector('.hamburger');
  var nav = document.querySelector('.nav');

  if (hamburger && nav) {
    hamburger.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('nav--open');
      hamburger.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.classList.contains('nav__link')) {
        nav.classList.remove('nav--open');
      }
    });
  }

  /* ---- Toque nos cards (mobile): destaca o card tocado ---- */
  var cards = document.querySelectorAll('.card');
  cards.forEach(function (card) {
    card.addEventListener('touchstart', function () {
      cards.forEach(function (c) { c.classList.remove('card--active'); });
      card.classList.add('card--active');
    }, { passive: true });
  });

  /* ============================================================
     LOGIN ÚNICO (SMERP) + SSO para os 3 sistemas
     ============================================================ */
  var CFG = window.SMERP_CONFIG;
  var lib = window.supabase; // UMD global do @supabase/supabase-js

  var $ = function (id) { return document.getElementById(id); };
  var loadingOverlay = $('loadingOverlay');
  var loginOverlay = $('loginOverlay');
  var loginForm = $('loginForm');
  var loginEmail = $('loginEmail');
  var loginPassword = $('loginPassword');
  var loginError = $('loginError');
  var loginSubmit = $('loginSubmit');
  var btnForgot = $('btnForgot');
  var btnLogout = $('btnLogout');
  var userEmail = $('userEmail');

  function show(el) { if (el) el.hidden = false; }
  function hide(el) { if (el) el.hidden = true; }

  // Degradação graciosa: se a lib/CDN ou o config falharem, libera o hub estático.
  if (!CFG || !lib || typeof lib.createClient !== 'function') {
    document.body.classList.remove('smerp-booting');
    hide(loadingOverlay);
    hide(loginOverlay);
    console.warn('[SMERP] Supabase/config indisponível — hub aberto sem login.');
    return;
  }

  var sb = lib.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: {
      storageKey: CFG.STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  function setError(msg) {
    if (!loginError) return;
    if (msg) { loginError.textContent = msg; loginError.hidden = false; }
    else { loginError.textContent = ''; loginError.hidden = true; }
  }

  function showLoadingState() {
    document.body.classList.add('smerp-booting');
    show(loadingOverlay);
    hide(loginOverlay);
  }

  function showLoginState() {
    document.body.classList.add('smerp-booting'); // mantém os cards cobertos
    hide(loadingOverlay);
    show(loginOverlay);
    hide(btnLogout);
    hide(userEmail);
    if (loginEmail) { try { loginEmail.focus(); } catch (e) {} }
  }

  function showAppState(session) {
    document.body.classList.remove('smerp-booting');
    hide(loadingOverlay);
    hide(loginOverlay);
    if (userEmail && session && session.user) {
      userEmail.textContent = session.user.email || '';
      show(userEmail);
    }
    show(btnLogout);
  }

  // Mostra só os cards dos sistemas que o usuário tem acesso.
  function applySystems(systems) {
    var keys = systems && typeof systems === 'object' ? Object.keys(systems) : [];
    var visible = 0;
    document.querySelectorAll('.card[data-system]').forEach(function (card) {
      var sys = card.getAttribute('data-system');
      var ok = keys.indexOf(sys) !== -1;
      card.style.display = ok ? '' : 'none';
      if (ok) visible++;
    });
    var intro = document.querySelector('.intro__desc');
    if (visible === 0 && intro) {
      intro.textContent = 'Nenhum sistema liberado para o seu usuário ainda. Fale com o administrador.';
    }
  }

  async function enterApp(session) {
    showAppState(session);
    try {
      var res = await sb.rpc('my_systems');
      if (res.error) {
        console.error('[SMERP] my_systems:', res.error.message);
        applySystems({}); // sem dados -> nenhum card
        return;
      }
      applySystems(res.data || {});
    } catch (e) {
      console.error('[SMERP] my_systems falhou:', e);
      applySystems({});
    }
  }

  // Abre o app levando a sessão atual no hash (SSO). Sem sessão, cai no link normal.
  async function openApp(system, fallbackHref) {
    var url = (CFG.APPS && CFG.APPS[system]) || fallbackHref;
    if (!url) return;
    try {
      var s = (await sb.auth.getSession()).data.session;
      if (s && s.access_token && s.refresh_token) {
        var sep = url.indexOf('#') === -1 ? '#' : '&';
        url = url + sep + 'smerp_sso=1'
          + '&at=' + encodeURIComponent(s.access_token)
          + '&rt=' + encodeURIComponent(s.refresh_token);
      }
    } catch (e) {
      console.warn('[SMERP] sem sessão para SSO, abrindo direto:', e);
    }
    window.open(url, '_blank', 'noopener');
  }

  // Intercepta o clique no botão "Acessar Sistema" de cada card.
  document.querySelectorAll('.card[data-system] .card__btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var card = btn.closest('.card');
      var system = card && card.getAttribute('data-system');
      openApp(system, btn.getAttribute('href'));
    });
  });

  // Login
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      setError('');
      var email = (loginEmail.value || '').trim();
      var password = loginPassword.value || '';
      if (!email || !password) { setError('Informe e-mail e senha.'); return; }
      loginSubmit.disabled = true;
      var prev = loginSubmit.textContent;
      loginSubmit.textContent = 'Entrando…';
      try {
        var res = await sb.auth.signInWithPassword({ email: email, password: password });
        if (res.error) {
          setError(res.error.message === 'Invalid login credentials'
            ? 'E-mail ou senha inválidos.' : res.error.message);
          return;
        }
        await enterApp(res.data.session);
      } catch (err) {
        setError('Falha ao entrar. Tente novamente.');
        console.error(err);
      } finally {
        loginSubmit.disabled = false;
        loginSubmit.textContent = prev;
      }
    });
  }

  // Esqueci minha senha
  if (btnForgot) {
    btnForgot.addEventListener('click', async function () {
      var email = (loginEmail && loginEmail.value || '').trim()
        || window.prompt('Informe seu e-mail para receber o link de redefinição:');
      if (!email) return;
      try {
        var res = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (res.error) setError(res.error.message);
        else setError('Enviamos um link de redefinição para o seu e-mail.');
      } catch (e) { setError('Não foi possível enviar o e-mail agora.'); }
    });
  }

  // Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', async function () {
      try { await sb.auth.signOut(); } catch (e) {}
      document.querySelectorAll('.card[data-system]').forEach(function (c) { c.style.display = ''; });
      if (loginPassword) loginPassword.value = '';
      showLoginState();
    });
  }

  // Reage a expiração/refresh/troca de sessão
  sb.auth.onAuthStateChange(function (event, session) {
    if (event === 'SIGNED_OUT' || !session) {
      if (!document.body.classList.contains('smerp-booting')) showLoginState();
    }
  });

  // Boot
  (async function boot() {
    showLoadingState();
    try {
      var s = (await sb.auth.getSession()).data.session;
      if (s) await enterApp(s);
      else showLoginState();
    } catch (e) {
      console.error('[SMERP] boot:', e);
      showLoginState();
    }
  })();
})();
