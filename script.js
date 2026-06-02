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

  // --- transições suaves (fade) ---
  var bootStart = Date.now();
  var SPLASH_MIN_MS = 1000; // segura a splash pelo menos 1s pra não "piscar"

  function showLoadingState() {
    document.body.classList.add('smerp-booting');
    if (loadingOverlay) { loadingOverlay.classList.remove('is-leaving'); loadingOverlay.hidden = false; }
    if (loginOverlay) { loginOverlay.classList.remove('is-visible'); loginOverlay.hidden = true; }
  }

  // some com a splash em fade (respeitando o tempo mínimo) e então chama done()
  function fadeOutLoading(done) {
    if (!loadingOverlay || loadingOverlay.hidden) { if (done) done(); return; }
    var wait = Math.max(0, SPLASH_MIN_MS - (Date.now() - bootStart));
    setTimeout(function () {
      loadingOverlay.classList.add('is-leaving');
      var finished = false;
      var finish = function () {
        if (finished) return; finished = true;
        loadingOverlay.hidden = true;
        if (done) done();
      };
      loadingOverlay.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, 700); // segurança caso o transitionend não dispare
    }, wait);
  }

  function revealLogin() {
    if (loginOverlay) { loginOverlay.hidden = false; loginOverlay.classList.remove('is-visible'); }
    hide(btnLogout); hide(userEmail);
    requestAnimationFrame(function () { if (loginOverlay) loginOverlay.classList.add('is-visible'); });
    if (loginEmail) { try { loginEmail.focus(); } catch (e) {} }
  }

  function hideLogin(done) {
    if (!loginOverlay || loginOverlay.hidden) { if (done) done(); return; }
    loginOverlay.classList.remove('is-visible'); // fade-out
    setTimeout(function () { loginOverlay.hidden = true; if (done) done(); }, 350);
  }

  function showLoginState() {
    document.body.classList.add('smerp-booting'); // mantém os cards cobertos
    fadeOutLoading(revealLogin);
  }

  // Ícones por setor (SVG inline)
  var ICONS = {
    cart:  '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    bars:  '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5v14M7 5v14M11 5v14M14 5v14M18 5v14M21 5v14"/></svg>'
  };
  var CHEVRON = '<svg class="card__chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  var ARROW = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function closeAllMenus(except) {
    document.querySelectorAll('.card.card--open').forEach(function (c) {
      if (c === except) return;
      c.classList.remove('card--open');
      var b = c.querySelector('.card__btn');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }

  // Renderiza um card por SETOR, só com os módulos liberados pra pessoa.
  // Clicar no card abre um dropdown interno; clicar num módulo abre na MESMA aba.
  function renderSetores(systems) {
    var container = $('systems');
    if (!container) return;
    container.innerHTML = '';
    var keys = systems && typeof systems === 'object' ? Object.keys(systems) : [];
    var setores = CFG.SETORES || [];
    var visible = 0;

    setores.forEach(function (setor) {
      var mods = (setor.modulos || []).filter(function (m) { return keys.indexOf(m.system) !== -1; });
      if (!mods.length) return;
      visible++;

      var card = document.createElement('article');
      card.className = 'card';
      card.setAttribute('data-setor', setor.id);
      card.innerHTML =
        '<div class="card__icon" aria-hidden="true">' + (ICONS[setor.icon] || '') + '</div>' +
        '<h2 class="card__title">' + escapeHtml(setor.nome) + '</h2>' +
        '<button class="card__btn" type="button" aria-expanded="false">Acessar' + CHEVRON + '</button>' +
        '<div class="card__menu" role="menu">' +
          mods.map(function (m) {
            return '<button class="card__menu-item" type="button" role="menuitem" data-system="' + escapeHtml(m.system) + '">' +
              '<span class="card__menu-text"><span class="card__menu-name">' + escapeHtml(m.nome) + '</span>' +
              (m.desc ? '<span class="card__menu-desc">' + escapeHtml(m.desc) + '</span>' : '') + '</span>' +
              ARROW +
            '</button>';
          }).join('') +
        '</div>';

      var btn = card.querySelector('.card__btn');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var willOpen = !card.classList.contains('card--open');
        closeAllMenus(card);
        card.classList.toggle('card--open', willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });

      card.querySelectorAll('.card__menu-item').forEach(function (item) {
        item.addEventListener('click', function (e) {
          e.stopPropagation();
          openApp(item.getAttribute('data-system'));
        });
      });

      container.appendChild(card);
    });

    var intro = document.querySelector('.intro__desc');
    if (intro) {
      intro.textContent = visible === 0
        ? 'Nenhum sistema liberado para o seu usuário ainda. Fale com o administrador.'
        : 'Selecione um setor e o módulo que quer usar.';
    }
  }

  // fecha qualquer dropdown ao clicar fora
  document.addEventListener('click', function () { closeAllMenus(null); });

  async function enterApp(session) {
    if (userEmail && session && session.user) {
      userEmail.textContent = session.user.email || '';
      show(userEmail);
    }
    show(btnLogout);
    // monta os cards ANTES de revelar, pra não piscar
    try {
      var res = await sb.rpc('my_systems');
      if (res.error) { console.error('[SMERP] my_systems:', res.error.message); renderSetores({}); }
      else renderSetores(res.data || {});
    } catch (e) {
      console.error('[SMERP] my_systems falhou:', e);
      renderSetores({});
    }
    // revela o hub: some a splash (se visível) e o login (se visível) em fade suave
    fadeOutLoading(function () {
      hideLogin(function () { document.body.classList.remove('smerp-booting'); });
    });
  }

  // Abre o app na MESMA aba, levando a sessão atual no hash (SSO).
  async function openApp(system) {
    var url = CFG.APPS && CFG.APPS[system];
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
    window.location.href = url; // mesma aba (o app tem botão "Voltar ao ERP")
  }

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
      var sysc = $('systems'); if (sysc) sysc.innerHTML = '';
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
