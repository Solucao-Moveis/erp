/* ============================================================
   SMERP — interações + login único da Página Principal (Hub)
   ============================================================ */
(function () {
  'use strict';

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

  /* ---- Atualizações: página dedicada com filtro por versão (independe do login) ---- */
  (function initUpdates() {
    var btn = $('btnUpdates');
    var modal = $('updatesOverlay');
    var filtersEl = $('updFilters');
    var detailEl = $('updDetail');
    if (!btn || !modal) return;

    var notas = window.SMERP_NOTAS || [];
    var selected = 'all';

    function renderFilters() {
      if (!filtersEl) return;
      var items = [{ key: 'all', ver: 'Todas', date: '' }].concat(notas.map(function (n) {
        return { key: n.versao, ver: 'v' + n.versao, date: n.data };
      }));
      filtersEl.innerHTML = items.map(function (it) {
        var active = it.key === selected ? ' upd__filter--active' : '';
        return '<button type="button" class="upd__filter' + active + '" data-ver="' + escapeHtml(it.key) + '">' +
          '<span class="upd__filter-ver">' + escapeHtml(it.ver) + '</span>' +
          (it.date ? '<span class="upd__filter-date">' + escapeHtml(it.date) + '</span>' : '') +
        '</button>';
      }).join('');
    }

    function shotsHtml(m) {
      if (!m.antes && !m.depois) return '';
      var shot = function (src, label, mod) {
        // Quadro com "Print em breve" ao fundo; se o print existir, a imagem cobre.
        // Se o arquivo ainda não foi adicionado, a imagem some (onerror) e fica o aviso.
        return '<figure class="upd__shot upd__shot--' + mod + '">' +
          '<figcaption class="upd__shot-label">' + label + '</figcaption>' +
          '<div class="upd__shot-frame">' +
            '<span class="upd__shot-ph">Print em breve</span>' +
            (src ? '<img src="' + escapeHtml(src) + '" alt="' + label + '" loading="lazy" onerror="this.remove()" />' : '') +
          '</div>' +
        '</figure>';
      };
      return '<div class="upd__shots">' + shot(m.antes, 'Antes', 'antes') + shot(m.depois, 'Depois', 'depois') + '</div>';
    }

    function releaseHtml(n) {
      var changes = (n.mudancas || []).map(function (m) {
        return '<div class="upd__change">' +
          (m.app ? '<span class="upd__app">' + escapeHtml(m.app) + '</span>' : '') +
          '<span class="upd__oque">' + escapeHtml(m.o_que) + '</span>' +
          (m.como ? '<span class="upd__como"><b>Como usar:</b> ' + escapeHtml(m.como) + '</span>' : '') +
          shotsHtml(m) +
        '</div>';
      }).join('');
      return '<section class="upd__release">' +
        '<div class="nota__head"><span class="nota__ver">v' + escapeHtml(n.versao) + '</span>' +
        '<span class="nota__data">' + escapeHtml(n.data) + '</span></div>' +
        '<h3 class="nota__titulo">' + escapeHtml(n.titulo) + '</h3>' +
        (n.resumo ? '<p class="upd__resumo">' + escapeHtml(n.resumo) + '</p>' : '') +
        changes +
      '</section>';
    }

    function renderDetail() {
      if (!detailEl) return;
      var list = selected === 'all' ? notas : notas.filter(function (n) { return n.versao === selected; });
      detailEl.innerHTML = list.length
        ? list.map(releaseHtml).join('')
        : '<p class="nota__vazio">Nenhuma atualização.</p>';
      detailEl.scrollTop = 0;
    }

    function render() { renderFilters(); renderDetail(); }

    if (filtersEl) filtersEl.addEventListener('click', function (e) {
      var b = e.target.closest('.upd__filter');
      if (!b) return;
      selected = b.getAttribute('data-ver');
      render();
    });

    function open() { render(); modal.hidden = false; requestAnimationFrame(function () { modal.classList.add('is-open'); }); }
    function close() { modal.classList.remove('is-open'); setTimeout(function () { modal.hidden = true; }, 200); }

    btn.addEventListener('click', open);
    modal.querySelectorAll('[data-close]').forEach(function (el) { el.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });
  })();

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
    bars:  '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5v14M7 5v14M11 5v14M14 5v14M18 5v14M21 5v14"/></svg>',
    chart: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/></svg>'
  };
  var SETOR_CHEVRON = '<svg class="setor__chev" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  var ARROW = '<svg class="sys__go" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // #E8722A -> rgba(232,114,42,a) — para o acento "soft" de cada setor.
  function hexToRgba(hex, a) {
    var h = String(hex || '#E8722A').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function closeAllMenus(except) {
    document.querySelectorAll('.setor.open').forEach(function (c) {
      if (c === except) return;
      c.classList.remove('open');
      var b = c.querySelector('.setor__hd');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }

  // Renderiza:
  //  - barra lateral: um atalho por SISTEMA liberado (abre na mesma aba via SSO);
  //  - principal: um card por SETOR; clicar expande os sistemas pra a pessoa escolher.
  // Só aparecem os setores/sistemas que vierem em my_systems() (acesso da pessoa).
  function renderSetores(systems) {
    var container = $('systems');
    var sideEl = $('sideSystems');
    if (!container) return;
    container.innerHTML = '';
    if (sideEl) sideEl.innerHTML = '';
    var keys = systems && typeof systems === 'object' ? Object.keys(systems) : [];
    var setores = CFG.SETORES || [];
    var visible = 0;

    setores.forEach(function (setor) {
      var mods = (setor.modulos || []).filter(function (m) { return keys.indexOf(m.system) !== -1; });
      if (!mods.length) return;
      visible++;

      var cor = setor.cor || '#E8722A';
      var corSoft = hexToRgba(cor, 0.12);
      var icon = ICONS[setor.icon] || '';

      // --- BARRA LATERAL: um atalho por sistema ---
      if (sideEl) {
        mods.forEach(function (m) {
          var b = document.createElement('button');
          b.className = 'nav nav--sys';
          b.type = 'button';
          b.setAttribute('data-system', m.system);
          b.setAttribute('data-path', m.path || '');
          b.innerHTML = '<span class="nav__dot" style="background:' + cor + '">' + icon + '</span>' + escapeHtml(m.nome);
          b.addEventListener('click', function () { openApp(m.system, m.path || ''); });
          sideEl.appendChild(b);
        });
      }

      // --- PRINCIPAL: card do setor (expande) ---
      var card = document.createElement('article');
      card.className = 'setor';
      card.setAttribute('data-setor', setor.id);
      card.style.setProperty('--ac', cor);
      card.style.setProperty('--ac-soft', corSoft);
      card.innerHTML =
        '<button class="setor__hd" type="button" aria-expanded="false">' +
          '<span class="setor__ic" aria-hidden="true">' + icon + '</span>' +
          '<span class="setor__b">' +
            '<span class="setor__name">' + escapeHtml(setor.nome) + '</span>' +
          '</span>' + SETOR_CHEVRON +
        '</button>' +
        '<div class="setor__menu"><div><div class="setor__menu-inner">' +
          mods.map(function (m) {
            return '<button class="sys" type="button" data-system="' + escapeHtml(m.system) + '" data-path="' + escapeHtml(m.path || '') + '">' +
              '<span class="sys__ic" aria-hidden="true">' + icon + '</span>' +
              '<span class="sys__b"><span class="sys__name">' + escapeHtml(m.nome) + '</span>' +
              (m.desc ? '<span class="sys__desc">' + escapeHtml(m.desc) + '</span>' : '') + '</span>' +
              ARROW +
            '</button>';
          }).join('') +
        '</div></div></div>';

      var hd = card.querySelector('.setor__hd');
      hd.addEventListener('click', function (e) {
        e.stopPropagation();
        var willOpen = !card.classList.contains('open');
        closeAllMenus(card);
        card.classList.toggle('open', willOpen);
        hd.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });

      card.querySelectorAll('.sys').forEach(function (item) {
        item.addEventListener('click', function (e) {
          e.stopPropagation();
          openApp(item.getAttribute('data-system'), item.getAttribute('data-path') || '');
        });
      });

      container.appendChild(card);
    });

    var intro = $('introDesc');
    if (intro) {
      intro.textContent = visible === 0
        ? 'Nenhum sistema liberado para o seu usuário ainda. Fale com o administrador.'
        : 'Escolha um setor e o sistema que quer usar.';
    }
  }

  // fecha qualquer setor aberto ao clicar fora
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
  async function openApp(system, path) {
    var url = CFG.APPS && CFG.APPS[system];
    if (!url) return;
    // 'path' opcional: abre uma sub-rota do app (ex.: bip em modo celular -> /apontar).
    if (path) {
      url = url.replace(/\/+$/, '') + '/' + String(path).replace(/^\/+/, '');
    }
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
      var sidec = $('sideSystems'); if (sidec) sidec.innerHTML = '';
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
