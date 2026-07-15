/* ============================================================
   Desenvolvimento (Inovação) — página própria, separada do Hub.
   Usa a MESMA casca do Hub (classes app/side/main de ../styles.css,
   a mesma barra lateral recolhível que todo o ERP usa) — só que a
   barra aqui lista PÁGINAS (Nova solicitação, Minhas solicitações,
   Quadro, Dashboard) em vez de setores.
   ------------------------------------------------------------
   - Nova solicitação / Minhas solicitações: qualquer usuário do ERP.
   - Quadro / Dashboard: só quem está em inovacao.gestores.
   ============================================================ */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://supabase-supabase.h5xdag.easypanel.host';
  var SUPABASE_ANON_KEY =
    'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImFub24iLCAiaXNzIjogInN1cGFiYXNlIiwgImlhdCI6IDE2NDE3NjkyMDAsICJleHAiOiAxODkzNDU2MDAwfQ.n_Z8vVhAqNlxq3qRr0_JbyBcKilz_Tm4Xjc7LNjFH38';
  var HUB_URL = 'https://solucaomoveis-erp.h5xdag.easypanel.host/';

  var COLUNAS = [
    { value: 'solicitacao',     label: 'Solicitação',            cor: '#6B7280' },
    { value: 'analise',         label: 'Em Análise/Priorizado',  cor: '#2E78D2' },
    { value: 'desenvolvimento', label: 'Em Desenvolvimento',     cor: '#E8722A' },
    { value: 'finalizado',      label: 'Finalizado',             cor: '#1F9D55' },
    { value: 'recusado',        label: 'Recusado',               cor: '#DC2626' }
  ];

  var ICONS = {
    novo:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    quadro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="6" height="16" rx="1"/><rect x="10" y="4" width="6" height="10" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/></svg>',
    dash:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/></svg>',
    back:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
    total: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M15.09 14c.937-.834 1.91-2.084 1.91-4a5 5 0 1 0-10 0c0 1.916.973 3.166 1.91 4 .53.47.99 1.077.99 1.766V17h4.2v-1.234c0-.69.46-1.297.99-1.766z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>',
    timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"/></svg>'
  };

  var PAGINAS = [
    { id: 'novo',      titulo: 'Nova solicitação',     sub: 'Descreva o pedido com o máximo de detalhe', icon: 'novo',   todos: true },
    { id: 'minhas',    titulo: 'Minhas solicitações',  sub: 'Acompanhe o status dos seus pedidos',        icon: 'lista',  todos: true },
    { id: 'quadro',    titulo: 'Quadro',               sub: 'Solicitação → Análise → Desenvolvimento → Finalizado', icon: 'quadro', todos: false },
    { id: 'dashboard', titulo: 'Dashboard',            sub: 'Visão geral das solicitações de desenvolvimento',       icon: 'dash',   todos: false }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtData(d) {
    if (!d) return '';
    try { var p = String(d).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; } catch (e) { return d; }
  }
  function $(id) { return document.getElementById(id); }
  function fval(id) { var n = $(id); return n ? (n.value || '').trim() : ''; }
  function colInfo(value) {
    for (var i = 0; i < COLUNAS.length; i++) if (COLUNAS[i].value === value) return COLUNAS[i];
    return { value: value, label: value, cor: '#6B7280' };
  }
  function iniciais(nome, email) {
    var base = (nome || email || '?').trim();
    var partes = base.split(/\s+/);
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return base.slice(0, 2).toUpperCase();
  }

  var sb = null;
  var isGestor = false;
  var pendentes = [];
  var cacheQuadro = [];
  var paginaAtual = 'novo';

  function db() { return sb.schema('inovacao'); }

  // ---- SSO: adota a sessão que o Hub mandou no hash (#smerp_sso&at=&rt=) ----
  async function consumeSmerpSso() {
    var hash = window.location.hash;
    if (!hash || hash.indexOf('smerp_sso') === -1) return;
    var params = new URLSearchParams(hash.replace(/^#/, ''));
    var access_token = params.get('at'), refresh_token = params.get('rt');
    if (access_token && refresh_token) {
      try { await sb.auth.setSession({ access_token: access_token, refresh_token: refresh_token }); }
      catch (e) { console.error('[SMERP SSO]', e); }
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  // ============================================================
  //  Casca (mesma barra lateral .app/.side/.main do Hub)
  // ============================================================
  function paginasVisiveis() { return PAGINAS.filter(function (p) { return p.todos || isGestor; }); }

  function renderShell(user) {
    var itens = paginasVisiveis();
    document.getElementById('app').innerHTML =
      '<aside class="side">' +
        '<a class="side__brand" href="' + esc(HUB_URL) + '">' +
          '<img src="../assets/logo-solucao-moveis.png" alt="Solução Móveis" />' +
          '<span class="side__brand-txt"><b>SMERP</b><span>Desenvolvimento</span></span>' +
        '</a>' +
        '<div class="side__lbl">Páginas</div>' +
        '<nav id="devNav">' + itens.map(function (p) {
          return '<button class="nav nav--home" type="button" data-page="' + p.id + '">' +
            ICONS[p.icon] + p.titulo + '</button>';
        }).join('') + '</nav>' +
        '<div style="flex:1"></div>' +
        '<a class="side__back" href="' + esc(HUB_URL) + '">' + ICONS.back + ' Voltar ao ERP</a>' +
        '<div class="side__user">' +
          '<div class="side__av">' + esc(iniciais(null, user.email)) + '</div>' +
          '<div class="side__userinfo"><span class="user-email">' + esc(user.email || '') + '</span></div>' +
        '</div>' +
      '</aside>' +
      '<main class="main" id="devMain"></main>';

    $('devNav').querySelectorAll('.nav').forEach(function (b) {
      b.addEventListener('click', function () { setPagina(b.getAttribute('data-page')); });
    });
  }

  function renderGate(msg) {
    document.getElementById('app').innerHTML =
      '<div class="dev-gate" style="grid-column:1/-1">' +
        '<h1>Desenvolvimento</h1>' +
        '<p>' + esc(msg) + '</p>' +
        '<a class="smerp-login__btn" style="display:inline-block;text-decoration:none" href="' + esc(HUB_URL) + '">Ir para o SMERP</a>' +
      '</div>';
  }

  function setPagina(id) {
    paginaAtual = id;
    document.querySelectorAll('#devNav .nav').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-page') === id);
    });
    var info = PAGINAS.filter(function (p) { return p.id === id; })[0] || PAGINAS[0];
    var main = $('devMain');
    main.classList.toggle('main--wide', id === 'quadro' || id === 'dashboard');
    main.innerHTML =
      '<div class="main__top"><div><p class="hello">Desenvolvimento</p><h1 class="h1">' + esc(info.titulo) + '</h1><p class="sub">' + esc(info.sub) + '</p></div></div>' +
      '<div id="devBody"></div>';

    if (id === 'novo') renderNovo();
    if (id === 'minhas') renderMinhas();
    if (id === 'quadro' && isGestor) renderQuadro();
    if (id === 'dashboard' && isGestor) renderDashboard();
  }

  // ============================================================
  //  PÁGINA — NOVA SOLICITAÇÃO
  // ============================================================
  function renderNovo() {
    $('devBody').innerHTML =
      '<form id="dvForm" autocomplete="off" class="eng-form" style="margin-top:24px">' +
        '<p class="eng-form__hd">Capriche no detalhe: quanto mais completo, mais rápido dá pra entender e resolver.</p>' +

        '<label class="smerp-field"><span>Título</span><input id="dv_titulo" type="text" maxlength="160" placeholder="Resumo curto do pedido" /></label>' +
        '<label class="smerp-field"><span>O que você quer?</span><textarea id="dv_oque" class="eng-ta" rows="3" placeholder="Descreva o que você precisa"></textarea></label>' +
        '<label class="smerp-field"><span>Como você gostaria que funcionasse?</span><textarea id="dv_como" class="eng-ta" rows="3" placeholder="Fluxo esperado, passo a passo, comportamento na tela"></textarea></label>' +
        '<label class="smerp-field"><span>Qual a finalidade/objetivo desse pedido?</span><textarea id="dv_final" class="eng-ta" rows="2" placeholder="Por que isso é importante"></textarea></label>' +

        '<fieldset class="eng-fs"><legend>Print da tela (opcional, mas ajuda bastante)</legend>' +
          '<div class="kb-drop" id="dvDrop" tabindex="0">' +
            'Arraste uma imagem aqui, cole com Ctrl+V ou ' +
            '<label class="kb-drop__pick">escolha um arquivo<input id="dv_file" type="file" accept="image/*" multiple hidden /></label>' +
          '</div>' +
          '<div class="kb-thumbs" id="dvThumbs"></div>' +
        '</fieldset>' +

        '<p class="smerp-login__error" id="dvErr" hidden></p>' +
        '<p class="usr__ok" id="dvOk" hidden></p>' +

        '<div class="eng-form__actions"><button class="smerp-login__btn" id="dvSave" type="submit">Enviar solicitação</button></div>' +
      '</form>';

    pendentes = [];
    renderThumbs();

    var drop = $('dvDrop'), fileInput = $('dv_file');
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-drag'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('is-drag'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('is-drag'); handleFiles(e.dataTransfer.files); });
    fileInput.addEventListener('change', function () { handleFiles(fileInput.files); fileInput.value = ''; });
    $('dvForm').addEventListener('submit', onSaveNovo);
  }

  function handleFiles(fileList) {
    Array.prototype.forEach.call(fileList || [], function (f) {
      if (f && f.type && f.type.indexOf('image') === 0) pendentes.push(f);
    });
    renderThumbs();
  }

  function renderThumbs() {
    var box = $('dvThumbs'); if (!box) return;
    box.innerHTML = pendentes.map(function (f, i) {
      var url = URL.createObjectURL(f);
      return '<div class="kb-thumb"><img src="' + url + '" alt="" />' +
        '<button type="button" class="kb-thumb__rm" data-i="' + i + '" aria-label="Remover">&times;</button></div>';
    }).join('');
    box.querySelectorAll('.kb-thumb__rm').forEach(function (b) {
      b.addEventListener('click', function () { pendentes.splice(parseInt(b.getAttribute('data-i'), 10), 1); renderThumbs(); });
    });
  }

  async function uploadPendentes(id) {
    var out = [];
    for (var i = 0; i < pendentes.length; i++) {
      var file = pendentes[i];
      var safe = file.name.replace(/[^\w.\-]+/g, '_');
      var path = id + '/' + Date.now() + '-' + i + '-' + safe;
      var up = await sb.storage.from('inovacao-anexos').upload(path, file, { upsert: false });
      if (!up.error) out.push({ path: path, name: file.name });
    }
    return out;
  }

  async function onSaveNovo(e) {
    e.preventDefault();
    var err = $('dvErr'), ok = $('dvOk'), btn = $('dvSave');
    err.hidden = true; ok.hidden = true;
    var titulo = fval('dv_titulo'), oque = fval('dv_oque'), como = fval('dv_como'), final = fval('dv_final');
    if (!titulo) { err.textContent = 'Informe um título.'; err.hidden = false; return; }
    if (!oque)   { err.textContent = 'Descreva o que você quer.'; err.hidden = false; return; }
    if (!como)   { err.textContent = 'Descreva como você gostaria que funcionasse.'; err.hidden = false; return; }
    if (!final)  { err.textContent = 'Informe a finalidade/objetivo do pedido.'; err.hidden = false; return; }

    btn.disabled = true; var prev = btn.textContent; btn.textContent = 'Enviando…';
    try {
      var res = await db().rpc('criar_solicitacao', { p_titulo: titulo, p_o_que_quer: oque, p_como_quer: como, p_finalidade: final });
      if (res.error) throw res.error;
      var id = res.data && res.data.id;
      if (id && pendentes.length) {
        var anexos = await uploadPendentes(id);
        if (anexos.length) await db().rpc('anexar_solicitacao', { p_id: id, p_anexos: anexos });
      }
      renderNovo();
      var okAfter = $('dvOk'); okAfter.textContent = 'Solicitação enviada! Você vai ser avisado a cada atualização.'; okAfter.hidden = false;
    } catch (e2) {
      err.textContent = (e2 && e2.message) || 'Não foi possível enviar.'; err.hidden = false;
      console.error('[DEV] criar_solicitacao', e2);
    } finally {
      btn.disabled = false; btn.textContent = prev;
    }
  }

  // ============================================================
  //  PÁGINA — MINHAS SOLICITAÇÕES
  // ============================================================
  async function renderMinhas() {
    var box = $('devBody');
    box.innerHTML = '<p class="usr__empty" style="margin-top:24px">Carregando…</p>';
    try {
      var res = await db().rpc('minhas_solicitacoes');
      if (res.error) throw res.error;
      var rows = res.data || [];
      box.innerHTML = rows.length
        ? '<div class="kb-mine">' + rows.map(minhaItemHtml).join('') + '</div>'
        : '<p class="usr__empty" style="margin-top:24px">Você ainda não abriu nenhuma solicitação.</p>';
      try { await db().rpc('marcar_notificacoes_vistas'); } catch (e) {}
    } catch (e) {
      box.innerHTML = '<p class="usr__empty" style="margin-top:24px">Não foi possível carregar.</p>';
      console.error('[DEV] minhas_solicitacoes', e);
    }
  }

  function minhaItemHtml(s) {
    var col = colInfo(s.coluna);
    var extra = '';
    if (s.coluna === 'desenvolvimento' && s.data_prevista) {
      extra = '<div class="kb-mine__extra">Previsão de entrega: ' + esc(fmtData(s.data_prevista)) + '</div>';
    } else if (s.coluna === 'recusado' && s.motivo_recusa) {
      extra = '<div class="kb-mine__extra kb-mine__extra--neg">Motivo: ' + esc(s.motivo_recusa) + '</div>';
    }
    return '<div class="kb-mine__item">' +
      '<div class="kb-mine__top"><b>' + esc(s.titulo) + '</b><span class="eng-status" style="--c:' + esc(col.cor) + '">' + esc(col.label) + '</span></div>' +
      '<div class="kb-mine__sub">' + esc((s.o_que_quer || '').slice(0, 160)) + '</div>' +
      extra +
      (s.anexos && s.anexos.length ? '<div class="eng-hint">📎 ' + s.anexos.length + ' anexo(s)</div>' : '') +
    '</div>';
  }

  // ============================================================
  //  PÁGINA — QUADRO (só gestor)
  // ============================================================
  async function renderQuadro() {
    var box = $('devBody');
    box.innerHTML = '<p class="usr__empty" style="margin-top:24px">Carregando…</p>';
    try {
      var res = await db().rpc('quadro');
      if (res.error) throw res.error;
      cacheQuadro = res.data || [];
      drawQuadro();
    } catch (e) {
      box.innerHTML = '<p class="usr__empty" style="margin-top:24px">Não foi possível carregar.</p>';
      console.error('[DEV] quadro', e);
    }
  }

  function cardById(id) { for (var i = 0; i < cacheQuadro.length; i++) if (cacheQuadro[i].id === id) return cacheQuadro[i]; return null; }

  function cardHtml(s) {
    var quem = esc(s.created_by_nome || s.created_by_email || 'Alguém');
    return '<div class="kb-card" draggable="true" data-id="' + esc(s.id) + '">' +
      '<div class="kb-card__top"><b>' + esc(s.titulo) + '</b></div>' +
      '<div class="kb-card__who">' + quem + '</div>' +
      '<div class="kb-card__sub">' + esc((s.o_que_quer || '').slice(0, 90)) + '</div>' +
      (s.anexos && s.anexos.length ? '<div class="kb-card__anexos">📎 ' + s.anexos.length + '</div>' : '') +
    '</div>';
  }

  function drawQuadro() {
    var box = $('devBody');
    box.innerHTML = '<div class="kb-board">' + COLUNAS.map(function (c) {
      var itens = cacheQuadro.filter(function (s) { return s.coluna === c.value; });
      return '<div class="kb-col" data-coluna="' + esc(c.value) + '">' +
        '<div class="kb-col__hd" style="--c:' + esc(c.cor) + '">' + esc(c.label) + ' <span class="kb-col__count">' + itens.length + '</span></div>' +
        '<div class="kb-col__body">' + (itens.length ? itens.map(cardHtml).join('') : '<p class="kb-col__empty">Vazio</p>') + '</div>' +
      '</div>';
    }).join('') + '</div>';

    box.querySelectorAll('.kb-card').forEach(function (el) {
      el.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', el.getAttribute('data-id')); el.classList.add('is-dragging'); });
      el.addEventListener('dragend', function () { el.classList.remove('is-dragging'); });
      el.addEventListener('click', function () { abrirDetalhe(el.getAttribute('data-id')); });
    });
    box.querySelectorAll('.kb-col').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('is-over'); });
      col.addEventListener('dragleave', function () { col.classList.remove('is-over'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault(); col.classList.remove('is-over');
        onDropCard(e.dataTransfer.getData('text/plain'), col.getAttribute('data-coluna'));
      });
    });
  }

  function onDropCard(id, destino) {
    var card = cardById(id);
    if (!card || card.coluna === destino) return;
    if (destino === 'desenvolvimento') {
      abrirMiniForm({ titulo: 'Previsão de entrega', campo: 'data', label: 'Data prevista (opcional)', obrigatorio: false,
        onConfirm: function (v) { moverCard(id, destino, v || null, null); } });
      return;
    }
    if (destino === 'recusado') {
      abrirMiniForm({ titulo: 'Motivo da recusa', campo: 'texto', label: 'Explique por que não será feito', obrigatorio: true,
        onConfirm: function (v) { moverCard(id, destino, null, v); } });
      return;
    }
    moverCard(id, destino, null, null);
  }

  async function moverCard(id, coluna, dataPrevista, motivo) {
    try {
      var res = await db().rpc('mover_solicitacao', { p_id: id, p_coluna: coluna, p_data_prevista: dataPrevista, p_motivo_recusa: motivo });
      if (res.error) throw res.error;
      await renderQuadro();
    } catch (e) {
      alert((e && e.message) || 'Não foi possível mover o card.');
      console.error('[DEV] mover_solicitacao', e);
    }
  }

  function abrirMiniForm(opts) {
    var m = $('dvMiniForm');
    if (!m) { m = document.createElement('div'); m.id = 'dvMiniForm'; m.className = 'eng-picker'; document.body.appendChild(m); }
    var campoHtml = opts.campo === 'data'
      ? '<input type="date" id="dvmf_val" class="eng-in" />'
      : '<textarea id="dvmf_val" class="eng-ta" rows="3" placeholder="' + esc(opts.label) + '"></textarea>';
    m.innerHTML =
      '<div class="eng-picker__card" style="max-width:420px">' +
        '<div class="eng-picker__hd"><b>' + esc(opts.titulo) + '</b><button type="button" class="smerp-modal__close" id="dvmf_close" aria-label="Fechar">&times;</button></div>' +
        '<div class="eng-picker__filters" style="flex-direction:column;align-items:stretch">' +
          '<label class="smerp-field"><span>' + esc(opts.label) + '</span>' + campoHtml + '</label>' +
          '<p class="smerp-login__error" id="dvmf_err" hidden></p>' +
          '<div class="eng-form__actions"><button type="button" class="smerp-login__btn" id="dvmf_ok">Confirmar</button></div>' +
        '</div>' +
      '</div>';
    m.hidden = false;
    $('dvmf_close').onclick = function () { m.hidden = true; };
    m.addEventListener('click', function (e) { if (e.target === m) m.hidden = true; });
    $('dvmf_ok').onclick = function () {
      var v = fval('dvmf_val');
      if (opts.obrigatorio && !v) { var er = $('dvmf_err'); er.textContent = 'Esse campo é obrigatório.'; er.hidden = false; return; }
      m.hidden = true;
      opts.onConfirm(v || null);
    };
  }

  async function abrirDetalhe(id) {
    var s = cardById(id); if (!s) return;
    var m = $('dvDetalhe');
    if (!m) { m = document.createElement('div'); m.id = 'dvDetalhe'; m.className = 'eng-picker'; document.body.appendChild(m); }
    var col = colInfo(s.coluna);
    m.innerHTML =
      '<div class="eng-picker__card" style="max-width:640px">' +
        '<div class="eng-picker__hd"><b>' + esc(s.titulo) + '</b><button type="button" class="smerp-modal__close" id="dvd_close" aria-label="Fechar">&times;</button></div>' +
        '<div class="eng-picker__filters" style="flex-direction:column;align-items:stretch;gap:10px">' +
          '<span class="eng-status" style="--c:' + esc(col.cor) + '">' + esc(col.label) + '</span>' +
          '<div><b>Solicitante:</b> ' + esc(s.created_by_nome || '') + (s.created_by_email ? ' — ' + esc(s.created_by_email) : '') + '</div>' +
          '<div><b>O que quer:</b><br/>' + esc(s.o_que_quer) + '</div>' +
          '<div><b>Como quer:</b><br/>' + esc(s.como_quer) + '</div>' +
          '<div><b>Finalidade:</b><br/>' + esc(s.finalidade) + '</div>' +
          (s.data_prevista ? '<div><b>Previsão de entrega:</b> ' + esc(fmtData(s.data_prevista)) + '</div>' : '') +
          (s.motivo_recusa ? '<div><b>Motivo da recusa:</b> ' + esc(s.motivo_recusa) + '</div>' : '') +
          '<div id="dvd_anexos">' + (s.anexos && s.anexos.length ? 'Carregando anexos…' : 'Sem anexos.') + '</div>' +
        '</div>' +
      '</div>';
    m.hidden = false;
    $('dvd_close').onclick = function () { m.hidden = true; };
    m.addEventListener('click', function (e) { if (e.target === m) m.hidden = true; });
    if (s.anexos && s.anexos.length) loadAnexos(s.anexos);
  }

  async function loadAnexos(anexos) {
    var box = $('dvd_anexos'); if (!box) return;
    var htmls = [];
    for (var i = 0; i < anexos.length; i++) {
      try {
        var r = await sb.storage.from('inovacao-anexos').createSignedUrl(anexos[i].path, 3600);
        if (!r.error && r.data) htmls.push('<a href="' + r.data.signedUrl + '" target="_blank" rel="noopener"><img src="' + r.data.signedUrl + '" class="kb-thumb__view" alt="" /></a>');
      } catch (e) {}
    }
    box.innerHTML = htmls.length ? '<div class="kb-thumbs">' + htmls.join('') + '</div>' : 'Não foi possível carregar os anexos.';
  }

  // ============================================================
  //  PÁGINA — DASHBOARD (só gestor)
  // ============================================================
  async function renderDashboard() {
    var box = $('devBody');
    box.innerHTML =
      '<div class="eng-dash__bar" style="margin-top:20px">' +
        '<label class="eng-f"><span>De</span><input type="date" id="dd_de" /></label>' +
        '<label class="eng-f"><span>Até</span><input type="date" id="dd_ate" /></label>' +
        '<button class="eng-btn-ghost" id="dd_go" type="button">Atualizar</button>' +
      '</div>' +
      '<div id="dvDashBody"><p class="usr__empty">Carregando…</p></div>';
    $('dd_go').addEventListener('click', loadDash);
    loadDash();
  }

  async function loadDash() {
    var body = $('dvDashBody');
    var de = fval('dd_de') || null, ate = fval('dd_ate') || null;
    body.innerHTML = '<p class="usr__empty">Carregando…</p>';
    try {
      var res = await db().rpc('dashboard', { _de: de, _ate: ate });
      if (res.error) throw res.error;
      body.innerHTML = dashHtml(res.data || {});
    } catch (e) {
      body.innerHTML = '<p class="usr__empty">Não foi possível carregar o dashboard.</p>';
      console.error('[DEV] dashboard', e);
    }
  }

  function statCard(label, n, icone, cor, corSoft, desc) {
    return '<div class="stat" style="--c:' + cor + ';--c-soft:' + corSoft + '">' +
      '<div class="stat__top"><span class="stat__lbl">' + esc(label) + '</span><span class="stat__ic">' + ICONS[icone] + '</span></div>' +
      '<span class="stat__n">' + n + '</span><span class="stat__d">' + esc(desc) + '</span>' +
    '</div>';
  }

  function dashHtml(d) {
    var stats =
      statCard('Total de solicitações', d.total || 0, 'total', '#E8722A', 'rgba(232,114,42,.12)', 'Desde sempre') +
      statCard('Em desenvolvimento', d.desenvolvimento || 0, 'clock', '#2E78D2', 'rgba(46,120,210,.12)', 'Sendo feitas agora') +
      statCard('Finalizadas', d.finalizado || 0, 'check', '#1F9D55', 'rgba(31,157,85,.12)', 'Entregues no período') +
      statCard('Tempo médio de resolução', (d.tempo_medio_dias != null ? d.tempo_medio_dias + ' dia(s)' : '—'), 'timer', '#8B5CF6', 'rgba(139,92,246,.12)', 'Do pedido até finalizar');

    var funil = [
      { label: 'Solicitação', n: d.solicitacao || 0 },
      { label: 'Em Análise/Priorizado', n: d.analise || 0 },
      { label: 'Em Desenvolvimento', n: d.desenvolvimento || 0 },
      { label: 'Finalizado', n: d.finalizado || 0 },
      { label: 'Recusado', n: d.recusado || 0 }
    ];
    var maxFunil = Math.max.apply(null, funil.map(function (f) { return f.n; }).concat([1]));
    var ranking = d.ranking || [];
    var maxRank = ranking.length ? ranking[0].n : 1;
    var meses = d.por_mes || [];
    var maxMes = meses.reduce(function (m, x) { return Math.max(m, x.n); }, 1);

    return '<div class="stats">' + stats + '</div>' +

      '<section class="eng-card dev-section"><h4>Funil (todas as colunas no período)</h4><div class="eng-bars">' +
        funil.map(function (f) {
          var pct = Math.max(4, Math.round((f.n / maxFunil) * 100));
          return '<div class="eng-bar"><span class="eng-bar__lbl">' + esc(f.label) + '</span>' +
            '<span class="eng-bar__track"><span class="eng-bar__fill" style="width:' + pct + '%;background:#E8722A"></span></span>' +
            '<span class="eng-bar__n">' + f.n + '</span></div>';
        }).join('') +
      '</div></section>' +

      '<section class="eng-card dev-section"><h4>Solicitações finalizadas por mês</h4>' +
        (meses.length ? '<div class="eng-months">' + meses.map(function (m) {
          var h = Math.max(8, Math.round((m.n / maxMes) * 100));
          return '<div class="eng-month"><span class="eng-month__bar" style="height:' + h + '%"></span><span class="eng-month__n">' + m.n + '</span><span class="eng-month__l">' + esc(m.mes) + '</span></div>';
        }).join('') + '</div>' : '<p class="eng-empty">Sem dados no período.</p>') +
      '</section>' +

      '<section class="eng-card dev-section"><h4>Quem mais pediu</h4>' +
        (ranking.length ? '<div class="eng-bars">' + ranking.map(function (r) {
          var pct = Math.max(4, Math.round((r.n / maxRank) * 100));
          return '<div class="eng-bar"><span class="eng-bar__lbl">' + esc(r.nome) + '</span>' +
            '<span class="eng-bar__track"><span class="eng-bar__fill" style="width:' + pct + '%;background:#0891B2"></span></span>' +
            '<span class="eng-bar__n">' + r.n + '</span></div>';
        }).join('') + '</div>' : '<p class="eng-empty">Sem dados no período.</p>') +
      '</section>';
  }

  // ============================================================
  //  Boot
  // ============================================================
  async function boot() {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storageKey: 'smerp-inovacao-auth', persistSession: true, autoRefreshToken: true }
    });

    await consumeSmerpSso();
    var sess = (await sb.auth.getSession()).data.session;
    if (!sess || !sess.user) {
      renderGate('Você precisa entrar pelo SMERP pra acessar o Desenvolvimento.');
      return;
    }

    try {
      var r = await db().rpc('is_gestor');
      isGestor = !r.error && r.data === true;
    } catch (e) { isGestor = false; }

    renderShell(sess.user);
    setPagina(isGestor ? 'quadro' : 'novo');

    // Cola (Ctrl+V) só é capturada com a página "Nova solicitação" visível.
    document.addEventListener('paste', function (e) {
      if (paginaAtual !== 'novo') return;
      var items = (e.clipboardData || {}).items || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image') === 0) {
          var f = items[i].getAsFile();
          if (f) handleFiles([f]);
        }
      }
    });
  }

  boot();
})();
