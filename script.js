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
  var usersUI = null; // inicializado depois de criar o client (sb)
  var solUI = null;   // aba "Solicitações" — idem

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
    // libera (ou esconde) a aba "Usuários" conforme a permissão de quem entrou
    if (usersUI) usersUI.gate();
    // Solicitações: ajusta a visão (master vê "todas") e calcula o aviso (badge)
    if (solUI) { solUI.gate(); solUI.refreshBadge(); }
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
      var lok = $('loginOk'); if (lok) lok.hidden = true;
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

  // Switch Entrar | Criar conta + AUTOCADASTRO (self_register)
  (function initRegister() {
    var registerForm = $('registerForm');
    var loginOk = $('loginOk');
    if (!registerForm || !loginForm) return;

    var sw = $('authSwitch'), tabLogin = $('tabLogin'), tabReg = $('tabRegister'), authSub = $('authSub');
    var regName = $('regName'), regEmail = $('regEmail'), regPwd = $('regPwd'), regPwd2 = $('regPwd2');
    var regError = $('regError'), regSubmit = $('regSubmit');

    function setRegError(msg) { if (!regError) return; if (msg) { regError.textContent = msg; regError.hidden = false; } else { regError.hidden = true; } }
    function setLoginOk(msg)  { if (!loginOk) return;  if (msg) { loginOk.textContent = msg;  loginOk.hidden = false; }  else { loginOk.hidden = true; } }

    function setTab(reg) {
      if (sw) sw.classList.toggle('is-register', reg);
      if (tabLogin) { tabLogin.classList.toggle('is-active', !reg); tabLogin.setAttribute('aria-selected', String(!reg)); }
      if (tabReg)   { tabReg.classList.toggle('is-active', reg);    tabReg.setAttribute('aria-selected', String(reg)); }
      if (authSub) authSub.textContent = reg
        ? 'Cadastre-se. O acesso aos sistemas é liberado pelo administrador.'
        : 'Entre para acessar seus sistemas';
    }

    function showRegister() {
      setError(''); setLoginOk(''); setRegError('');
      setTab(true);
      loginForm.hidden = true; registerForm.hidden = false;
      try { regName.focus(); } catch (e) {}
    }
    function showLoginCard() {
      setRegError('');
      setTab(false);
      registerForm.hidden = true; loginForm.hidden = false;
      try { loginEmail.focus(); } catch (e) {}
    }

    if (tabReg) tabReg.addEventListener('click', showRegister);
    if (tabLogin) tabLogin.addEventListener('click', showLoginCard);

    registerForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      setRegError('');
      var name = (regName.value || '').trim();
      var email = (regEmail.value || '').trim();
      var pwd = regPwd.value || '';
      var pwd2 = regPwd2.value || '';
      if (!name) { setRegError('Informe seu nome.'); return; }
      if (!email) { setRegError('Informe seu e-mail.'); return; }
      if (pwd.length < 6) { setRegError('A senha precisa ter ao menos 6 caracteres.'); return; }
      if (pwd !== pwd2) { setRegError('As senhas não conferem.'); return; }

      regSubmit.disabled = true;
      var prev = regSubmit.textContent; regSubmit.textContent = 'Criando…';
      try {
        var res = await sb.rpc('self_register', { p_email: email, p_password: pwd, p_full_name: name });
        if (res.error) { setRegError(res.error.message || 'Não foi possível criar a conta.'); return; }
        // sucesso -> volta pro login com o e-mail preenchido e um aviso verde
        registerForm.reset();
        showLoginCard();
        if (loginEmail) loginEmail.value = email;
        if (loginPassword) loginPassword.value = '';
        setLoginOk('Conta criada! Faça login. Seu acesso aos sistemas será liberado pelo administrador.');
      } catch (err) {
        setRegError('Falha ao criar a conta. Tente novamente.');
        console.error(err);
      } finally {
        regSubmit.disabled = false; regSubmit.textContent = prev;
      }
    });
  })();

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
      if (usersUI) usersUI.hide();
      if (solUI) solUI.hide();
      if (loginPassword) loginPassword.value = '';
      showLoginState();
    });
  }

  // ============================================================
  //  USUÁRIOS — criar acesso direto no ERP (só master/diretoria)
  //  A aba só aparece se public.can_manage_users() devolver true.
  // ============================================================
  function initUsers(client) {
    var overlay = $('usersOverlay');
    var navBtn  = $('btnUsers');
    var form    = $('usersForm');
    if (!overlay || !navBtn || !form) return null;

    var elName = $('usrName'), elEmail = $('usrEmail'), elPwd = $('usrPwd');
    var elSystems = $('usrSystems'), elErr = $('usrError'), elOk = $('usrOk');
    var elSubmit = $('usrSubmit'), elList = $('usrList'), elCount = $('usrCount');
    var editBar = $('usrEditBar'), editWho = $('usrEditWho'), newBtn = $('usrNewBtn'), pwdField = $('usrPwdField');
    var cfg = (CFG.USUARIOS && CFG.USUARIOS.SISTEMAS) || [];
    var built = false;
    var editingId = null;   // null = modo "criar"; uuid = editando o acesso de alguém
    var lastRows = [];      // últimas pessoas carregadas (pra achar quem foi clicado)

    function setErr(msg) { if (!elErr) return; if (msg) { elErr.textContent = msg; elErr.hidden = false; } else { elErr.hidden = true; } }
    function setOk(msg)  { if (!elOk) return;  if (msg) { elOk.textContent = msg;  elOk.hidden = false; }  else { elOk.hidden = true; } }

    // Monta os blocos de sistema + papéis a partir do config (1ª vez que abre).
    function build() {
      if (built || !elSystems) return;
      built = true;
      elSystems.innerHTML = cfg.map(function (s) {
        var icon = ICONS[s.icon] || '';
        var soft = hexToRgba(s.cor, 0.14);
        var roles = (s.papeis || []).map(function (p) {
          return '<label class="usr__role">' +
            '<input type="checkbox" class="usr__role-chk" value="' + escapeHtml(p.value) + '" />' +
            '<span class="usr__role-b">' +
              '<span class="usr__role-name">' + escapeHtml(p.label) + '</span>' +
              (p.desc ? '<span class="usr__role-desc">' + escapeHtml(p.desc) + '</span>' : '') +
            '</span></label>';
        }).join('');
        return '<div class="usr__sys" data-system="' + escapeHtml(s.system) + '" style="--ac:' + escapeHtml(s.cor) + ';--ac-soft:' + soft + '">' +
          '<label class="usr__sys-hd">' +
            '<span class="usr__sys-ic">' + icon + '</span>' +
            '<span class="usr__sys-name">' + escapeHtml(s.nome) + '</span>' +
            '<input type="checkbox" class="usr__sys-chk" />' +
          '</label>' +
          '<div class="usr__roles">' + roles + '</div>' +
        '</div>';
      }).join('');

      elSystems.querySelectorAll('.usr__sys').forEach(function (box) {
        var chk = box.querySelector('.usr__sys-chk');
        chk.addEventListener('change', function () {
          box.classList.toggle('is-on', chk.checked);
          if (!chk.checked) box.querySelectorAll('.usr__role-chk').forEach(function (c) { c.checked = false; });
        });
        // marcar um papel já liga o sistema
        box.querySelectorAll('.usr__role-chk').forEach(function (rc) {
          rc.addEventListener('change', function () {
            if (rc.checked && !chk.checked) { chk.checked = true; box.classList.add('is-on'); }
          });
        });
      });
    }

    // Lê do form: { sistema: [papéis marcados] } só dos sistemas marcados.
    function collectSystems() {
      var out = {};
      elSystems.querySelectorAll('.usr__sys').forEach(function (box) {
        var chk = box.querySelector('.usr__sys-chk');
        if (!chk || !chk.checked) return;
        var roles = [];
        box.querySelectorAll('.usr__role-chk').forEach(function (c) { if (c.checked) roles.push(c.value); });
        if (roles.length) out[box.getAttribute('data-system')] = roles;
      });
      return out;
    }

    function resetForm() {
      form.reset();
      elSystems.querySelectorAll('.usr__sys').forEach(function (b) { b.classList.remove('is-on'); });
    }

    // Marca no formulário os sistemas/papéis que a pessoa já tem (modo edição).
    function setSystems(systemsObj) {
      var obj = systemsObj || {};
      elSystems.querySelectorAll('.usr__sys').forEach(function (box) {
        var key = box.getAttribute('data-system');
        var roles = obj[key] || [];
        var on = roles.length > 0;
        var chk = box.querySelector('.usr__sys-chk');
        if (chk) chk.checked = on;
        box.classList.toggle('is-on', on);
        box.querySelectorAll('.usr__role-chk').forEach(function (c) {
          c.checked = roles.indexOf(c.value) !== -1;
        });
      });
    }

    // Modo CRIAR: campos limpos, com senha, botão "Criar usuário".
    function enterCreateMode() {
      editingId = null;
      setErr(''); setOk('');
      if (editBar) editBar.hidden = true;
      if (pwdField) pwdField.hidden = false;
      if (elName) elName.disabled = false;
      if (elEmail) elEmail.disabled = false;
      resetForm();
      if (elList) elList.querySelectorAll('.usr__item.is-editing').forEach(function (n) { n.classList.remove('is-editing'); });
      elSubmit.textContent = 'Criar usuário';
    }

    // Modo EDITAR: nome/e-mail só leitura, sem senha, botão "Salvar permissões".
    function enterEditMode(user) {
      build();
      editingId = user.id;
      setErr(''); setOk('');
      if (elName)  { elName.value = user.full_name || '';  elName.disabled = true; }
      if (elEmail) { elEmail.value = user.email || '';     elEmail.disabled = true; }
      if (pwdField) pwdField.hidden = true;
      setSystems(user.systems);
      if (editWho) editWho.innerHTML = 'Editando o acesso de <b>' + escapeHtml(user.email || '') + '</b>';
      if (editBar) editBar.hidden = false;
      elSubmit.textContent = 'Salvar permissões';
      if (elList) elList.querySelectorAll('.usr__item').forEach(function (n) {
        n.classList.toggle('is-editing', n.getAttribute('data-id') === user.id);
      });
    }

    // Lista de quem já existe (admin_list_users) — evita duplicar e confirma a criação.
    async function loadList() {
      if (!elList) return;
      elList.innerHTML = '<p class="usr__empty">Carregando…</p>';
      try {
        var res = await client.rpc('admin_list_users');
        if (res.error) throw res.error;
        var rows = res.data || [];
        lastRows = rows;
        if (elCount) elCount.textContent = rows.length;
        if (!rows.length) { elList.innerHTML = '<p class="usr__empty">Ninguém cadastrado ainda.</p>'; return; }
        elList.innerHTML = rows.map(function (u) {
          var sys = u.systems || {};
          var keys = Object.keys(sys);
          var tags = keys.length
            ? '<div class="usr__item-tags">' + keys.map(function (k) { return '<span class="usr__tag">' + escapeHtml(k) + '</span>'; }).join('') + '</div>'
            : '<span class="usr__item-none">sem acesso — clique p/ liberar</span>';
          return '<div class="usr__item" data-id="' + escapeHtml(u.id) + '" title="Clique para definir o acesso">' +
            '<div class="usr__item-name">' + escapeHtml(u.full_name || '(sem nome)') + '</div>' +
            '<div class="usr__item-mail">' + escapeHtml(u.email || '') + '</div>' +
            tags +
          '</div>';
        }).join('');
        // clicar numa pessoa abre o modo edição com o acesso atual dela
        elList.querySelectorAll('.usr__item').forEach(function (node) {
          node.addEventListener('click', function () {
            var id = node.getAttribute('data-id'), u = null;
            for (var i = 0; i < lastRows.length; i++) { if (lastRows[i].id === id) { u = lastRows[i]; break; } }
            if (u) enterEditMode(u);
          });
        });
      } catch (e) {
        elList.innerHTML = '<p class="usr__empty">Não foi possível carregar a lista.</p>';
        console.warn('[SMERP] admin_list_users:', e && e.message);
      }
    }

    function open() {
      build();
      enterCreateMode();
      overlay.hidden = false;
      requestAnimationFrame(function () { overlay.classList.add('is-open'); });
      loadList();
      try { elName.focus(); } catch (e) {}
    }
    function close() {
      overlay.classList.remove('is-open');
      setTimeout(function () { overlay.hidden = true; }, 200);
    }

    navBtn.addEventListener('click', open);
    if (newBtn) newBtn.addEventListener('click', enterCreateMode);
    overlay.querySelectorAll('[data-close]').forEach(function (el) { el.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) close(); });

    // mostrar/ocultar senha + gerar uma forte
    var pwdToggle = $('usrPwdToggle'), pwdGen = $('usrPwdGen');
    if (pwdToggle) pwdToggle.addEventListener('click', function () {
      elPwd.type = elPwd.type === 'password' ? 'text' : 'password';
    });
    if (pwdGen) pwdGen.addEventListener('click', function () {
      var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
      var arr = new Uint32Array(10), p = '';
      if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(arr);
      for (var i = 0; i < 10; i++) {
        var n = arr[i] || Math.floor(Math.random() * 1e9);
        p += chars[n % chars.length];
      }
      elPwd.value = p; elPwd.type = 'text';
    });

    // submit -> CRIA (modo novo) OU SALVA permissões (modo edição)
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      setErr(''); setOk('');
      var systems = collectSystems();

      // ---- MODO EDIÇÃO: só ajusta sistemas/papéis (pode zerar p/ revogar tudo) ----
      if (editingId) {
        var who = (elEmail.value || '').trim();
        elSubmit.disabled = true; elSubmit.textContent = 'Salvando…';
        try {
          var resE = await client.rpc('admin_set_user_systems', { p_user_id: editingId, p_systems: systems });
          if (resE.error) { setErr(resE.error.message || 'Não foi possível salvar.'); return; }
          enterCreateMode();
          setOk('Acesso de ' + who + ' atualizado.');
          loadList();
        } catch (err) {
          setErr('Falha ao salvar. Tente novamente.');
          console.error(err);
        } finally {
          elSubmit.disabled = false;
          if (editingId) elSubmit.textContent = 'Salvar permissões';
        }
        return;
      }

      // ---- MODO CRIAR ----
      var name = (elName.value || '').trim();
      var email = (elEmail.value || '').trim();
      var pwd = elPwd.value || '';
      if (!name) { setErr('Informe o nome da pessoa.'); return; }
      if (!email) { setErr('Informe o e-mail de acesso.'); return; }
      if (pwd.length < 6) { setErr('A senha precisa ter ao menos 6 caracteres.'); return; }
      if (!Object.keys(systems).length) { setErr('Marque ao menos 1 sistema e o tipo de acesso.'); return; }

      elSubmit.disabled = true; elSubmit.textContent = 'Criando…';
      try {
        var res = await client.rpc('admin_create_user', {
          p_email: email, p_password: pwd, p_full_name: name, p_systems: systems
        });
        if (res.error) { setErr(res.error.message || 'Não foi possível criar o usuário.'); return; }
        setOk('Usuário ' + email + ' criado com sucesso.');
        resetForm();
        loadList();
      } catch (err) {
        setErr('Falha ao criar. Tente novamente.');
        console.error(err);
      } finally {
        elSubmit.disabled = false;
        if (!editingId) elSubmit.textContent = 'Criar usuário';
      }
    });

    // Mostra/oculta a aba conforme a permissão do usuário logado.
    async function gate() {
      try {
        var res = await client.rpc('can_manage_users');
        navBtn.hidden = !(!res.error && res.data === true);
      } catch (e) { navBtn.hidden = true; }
    }

    return { gate: gate, hide: function () { navBtn.hidden = true; close(); } };
  }

  usersUI = initUsers(sb);

  // ============================================================
  //  SOLICITAÇÕES — chamados pro desenvolvedor (todos abrem).
  //  O botão aparece pra todo mundo; só o master vê "todas" e muda
  //  o status. Quem abriu recebe um aviso (badge) quando é resolvido.
  // ============================================================
  function initSolicitacoes(client) {
    var overlay = $('solOverlay');
    var navBtn  = $('btnSolic');
    var form    = $('solForm');
    if (!overlay || !navBtn || !form) return null;

    var elTipo = $('solTipo'), elUrg = $('solUrgencia'), elTit = $('solTitulo'), elDesc = $('solDescricao');
    var elWhats = $('solWhats');
    var elErr = $('solError'), elOk = $('solOk'), elSubmit = $('solSubmit');
    var elMyList = $('solMyList'), elMaster = $('solMaster'), elAllList = $('solAllList');
    var elBadge = $('solBadge');
    var cfg = CFG.SOLICITACOES || {};
    var TIPOS = cfg.TIPOS || [], URGS = cfg.URGENCIAS || [], STATUS = cfg.STATUS || {};
    var built = false, isMaster = false;

    function setErr(msg) { if (!elErr) return; if (msg) { elErr.textContent = msg; elErr.hidden = false; } else { elErr.hidden = true; } }
    function setOk(msg)  { if (!elOk) return;  if (msg) { elOk.textContent = msg;  elOk.hidden = false; }  else { elOk.hidden = true; } }

    function labelTipo(v) { for (var i = 0; i < TIPOS.length; i++) if (TIPOS[i].value === v) return TIPOS[i].label; return v; }
    function infoUrg(v)   { for (var i = 0; i < URGS.length; i++)  if (URGS[i].value === v)  return URGS[i];  return { label: v, cor: '#6B7280' }; }
    function infoStatus(v){ return STATUS[v] || { label: v, cor: '#6B7280' }; }

    function urgPill(v)    { var u = infoUrg(v);    return '<span class="sol__urg" style="--c:' + escapeHtml(u.cor) + '">' + escapeHtml(u.label) + '</span>'; }
    function statusBadge(v){ var s = infoStatus(v); return '<span class="sol__status" style="--c:' + escapeHtml(s.cor) + '">' + escapeHtml(s.label) + '</span>'; }

    function fmtDate(iso) {
      if (!iso) return '';
      try { var d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
      catch (e) { return ''; }
    }

    // Monta os <select> de tipo e urgência a partir do config (1ª vez).
    function build() {
      if (built) return;
      built = true;
      if (elTipo) elTipo.innerHTML = TIPOS.map(function (t) {
        return '<option value="' + escapeHtml(t.value) + '">' + escapeHtml(t.label) + '</option>';
      }).join('');
      if (elUrg) {
        elUrg.innerHTML = URGS.map(function (u) {
          return '<option value="' + escapeHtml(u.value) + '">' + escapeHtml(u.label) + '</option>';
        }).join('');
        // urgência padrão = "media" se existir na lista
        for (var i = 0; i < URGS.length; i++) if (URGS[i].value === 'media') elUrg.value = 'media';
      }
    }

    // Render de um chamado na visão "minhas".
    function myItemHtml(s) {
      var resp = (s.status === 'concluida' || s.status === 'recusada') && s.resposta
        ? '<div class="sol__resp"><b>Resposta do dev:</b> ' + escapeHtml(s.resposta) + '</div>' : '';
      var novo = (s.status === 'concluida' || s.status === 'recusada') && !s.visto_em
        ? ' <span class="sol__new">novo</span>' : '';
      return '<div class="sol__item">' +
        '<div class="sol__item-head">' +
          '<span class="sol__item-title">' + escapeHtml(s.titulo) + '</span>' +
          statusBadge(s.status) + novo +
        '</div>' +
        '<div class="sol__item-meta">' + urgPill(s.urgencia) +
          '<span class="sol__item-tipo">' + escapeHtml(labelTipo(s.tipo)) + '</span>' +
          '<span class="sol__item-date">' + escapeHtml(fmtDate(s.created_at)) + '</span>' +
        '</div>' +
        '<div class="sol__item-desc">' + escapeHtml(s.descricao) + '</div>' +
        resp +
      '</div>';
    }

    async function loadMyList() {
      if (!elMyList) return;
      elMyList.innerHTML = '<p class="usr__empty">Carregando…</p>';
      try {
        var res = await client.rpc('list_my_solicitacoes');
        if (res.error) throw res.error;
        var rows = res.data || [];
        // "lembra o último": pré-preenche o WhatsApp com o mais recente já usado.
        if (elWhats && !elWhats.value) {
          for (var i = 0; i < rows.length; i++) {
            if (rows[i].whatsapp) { elWhats.value = rows[i].whatsapp; break; }
          }
        }
        elMyList.innerHTML = rows.length
          ? rows.map(myItemHtml).join('')
          : '<p class="usr__empty">Você ainda não abriu nenhuma solicitação.</p>';
      } catch (e) {
        elMyList.innerHTML = '<p class="usr__empty">Não foi possível carregar.</p>';
        console.warn('[SMERP] list_my_solicitacoes:', e && e.message);
      }
    }

    // Render de um chamado na visão "todas" (master): com controles de status.
    function allItemHtml(s) {
      var who = escapeHtml(s.requester_name || '') +
        (s.requester_email ? ' <span class="sol__item-mail">' + escapeHtml(s.requester_email) + '</span>' : '');
      var opts = Object.keys(STATUS).map(function (k) {
        return '<option value="' + escapeHtml(k) + '"' + (k === s.status ? ' selected' : '') + '>' + escapeHtml(STATUS[k].label) + '</option>';
      }).join('');
      return '<div class="sol__item" data-id="' + escapeHtml(s.id) + '">' +
        '<div class="sol__item-head">' +
          '<span class="sol__item-title">' + escapeHtml(s.titulo) + '</span>' +
          statusBadge(s.status) +
        '</div>' +
        '<div class="sol__item-meta">' + urgPill(s.urgencia) +
          '<span class="sol__item-tipo">' + escapeHtml(labelTipo(s.tipo)) + '</span>' +
          '<span class="sol__item-date">' + escapeHtml(fmtDate(s.created_at)) + '</span>' +
        '</div>' +
        '<div class="sol__item-who">' + who + '</div>' +
        '<div class="sol__item-desc">' + escapeHtml(s.descricao) + '</div>' +
        '<div class="sol__ctrl">' +
          '<select class="sol__ctrl-status">' + opts + '</select>' +
          '<input class="sol__ctrl-resp" type="text" maxlength="2000" placeholder="Resposta (opcional)" value="' + escapeHtml(s.resposta || '') + '" />' +
          '<button type="button" class="sol__ctrl-save">Salvar</button>' +
          '<button type="button" class="sol__ctrl-del" title="Excluir solicitação">Excluir</button>' +
        '</div>' +
      '</div>';
    }

    async function loadAllList() {
      if (!elAllList || !isMaster) return;
      elAllList.innerHTML = '<p class="usr__empty">Carregando…</p>';
      try {
        var res = await client.rpc('list_all_solicitacoes');
        if (res.error) throw res.error;
        var rows = res.data || [];
        elAllList.innerHTML = rows.length
          ? rows.map(allItemHtml).join('')
          : '<p class="usr__empty">Nenhuma solicitação ainda.</p>';
        elAllList.querySelectorAll('.sol__item').forEach(function (node) {
          var btn = node.querySelector('.sol__ctrl-save');
          if (!btn) return;
          btn.addEventListener('click', async function () {
            var id = node.getAttribute('data-id');
            var st = node.querySelector('.sol__ctrl-status').value;
            var rp = node.querySelector('.sol__ctrl-resp').value;
            btn.disabled = true; var prev = btn.textContent; btn.textContent = 'Salvando…';
            try {
              var r = await client.rpc('set_solicitacao_status', { p_id: id, p_status: st, p_resposta: rp });
              if (r.error) { alert(r.error.message || 'Não foi possível salvar.'); return; }
              await loadAllList();
              refreshBadge();
            } catch (err) {
              console.error(err); alert('Falha ao salvar. Tente novamente.');
            } finally {
              btn.disabled = false; btn.textContent = prev;
            }
          });

          // Excluir (só o master vê esta lista) — ação definitiva, pede confirmação.
          var del = node.querySelector('.sol__ctrl-del');
          if (del) del.addEventListener('click', async function () {
            var id = node.getAttribute('data-id');
            if (!confirm('Excluir esta solicitação? Essa ação não pode ser desfeita.')) return;
            del.disabled = true; var prevD = del.textContent; del.textContent = 'Excluindo…';
            try {
              var rd = await client.rpc('delete_solicitacao', { p_id: id });
              if (rd.error) { alert(rd.error.message || 'Não foi possível excluir.'); return; }
              await loadAllList();
              refreshBadge();
            } catch (err) {
              console.error(err); alert('Falha ao excluir. Tente novamente.');
            } finally {
              del.disabled = false; del.textContent = prevD;
            }
          });
        });
      } catch (e) {
        elAllList.innerHTML = '<p class="usr__empty">Não foi possível carregar.</p>';
        console.warn('[SMERP] list_all_solicitacoes:', e && e.message);
      }
    }

    function updateBadge(n) {
      n = n || 0;
      if (!elBadge) return;
      if (n > 0) { elBadge.textContent = n > 99 ? '99+' : String(n); elBadge.hidden = false; navBtn.classList.add('has-badge'); }
      else { elBadge.hidden = true; navBtn.classList.remove('has-badge'); }
    }
    async function refreshBadge() {
      try { var res = await client.rpc('solicitacoes_badge'); updateBadge(!res.error ? res.data : 0); }
      catch (e) { updateBadge(0); }
    }

    async function open() {
      build();
      setErr(''); setOk('');
      overlay.hidden = false;
      requestAnimationFrame(function () { overlay.classList.add('is-open'); });
      loadMyList();
      if (isMaster) loadAllList();
      try { await client.rpc('mark_my_solicitacoes_seen'); } catch (e) {}
      refreshBadge();
    }
    function close() {
      overlay.classList.remove('is-open');
      setTimeout(function () { overlay.hidden = true; }, 200);
    }

    navBtn.addEventListener('click', open);
    overlay.querySelectorAll('[data-close]').forEach(function (el) { el.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) close(); });

    // Enviar um novo chamado.
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      setErr(''); setOk('');
      var tipo = elTipo ? elTipo.value : '';
      var urg = elUrg ? elUrg.value : '';
      var tit = (elTit.value || '').trim();
      var desc = (elDesc.value || '').trim();
      var wpp = elWhats ? (elWhats.value || '').trim() : '';
      if (!tit) { setErr('Informe um título.'); return; }
      if (!desc) { setErr('Descreva a solicitação.'); return; }
      // WhatsApp é opcional; se preenchido, confere a quantidade de dígitos antes de enviar.
      if (wpp) {
        var dig = wpp.replace(/\D/g, '');
        if (dig.length < 10 || dig.length > 13) {
          setErr('Confira o WhatsApp — use DDD + número, ex.: 54 9 9999-9999.'); return;
        }
      }

      elSubmit.disabled = true; var prev = elSubmit.textContent; elSubmit.textContent = 'Enviando…';
      try {
        var res = await client.rpc('create_solicitacao', { p_tipo: tipo, p_urgencia: urg, p_titulo: tit, p_descricao: desc, p_whatsapp: wpp });
        if (res.error) { setErr(res.error.message || 'Não foi possível enviar.'); return; }
        setOk('Solicitação enviada! O desenvolvedor já pode ver.');
        if (elTit) elTit.value = ''; if (elDesc) elDesc.value = '';
        loadMyList();
        if (isMaster) { loadAllList(); refreshBadge(); }
      } catch (err) {
        setErr('Falha ao enviar. Tente novamente.');
        console.error(err);
      } finally {
        elSubmit.disabled = false; elSubmit.textContent = prev;
      }
    });

    // Descobre se quem entrou é o master (mostra/oculta a seção "todas").
    async function gate() {
      try {
        var res = await client.rpc('is_master');
        isMaster = !res.error && res.data === true;
      } catch (e) { isMaster = false; }
      if (elMaster) elMaster.hidden = !isMaster;
    }

    return {
      gate: gate,
      refreshBadge: refreshBadge,
      hide: function () { close(); updateBadge(0); }
    };
  }

  solUI = initSolicitacoes(sb);

  // Reage a expiração/refresh/troca de sessão
  sb.auth.onAuthStateChange(function (event, session) {
    if (event === 'SIGNED_OUT' || !session) {
      if (usersUI) usersUI.hide();
      if (solUI) solUI.hide();
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
