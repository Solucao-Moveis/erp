/* ============================================================
   Desenvolvimento (Inovação) — página própria, separada do Hub.
   O Hub só linka pra cá (via SSO, mesma origem/deploy, pasta
   /desenvolvimento/) e o resto mora inteiramente aqui.
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
    { value: 'desenvolvimento', label: 'Em Desenvolvimento',     cor: '#F59E0B' },
    { value: 'finalizado',      label: 'Finalizado',             cor: '#1F9D55' },
    { value: 'recusado',        label: 'Recusado',               cor: '#DC2626' }
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

  var sb = null;
  var isGestor = false;
  var pendentes = [];
  var cacheQuadro = [];

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
  //  Casca da página (header + abas + painéis)
  // ============================================================
  function renderShell(user) {
    document.getElementById('app').innerHTML =
      '<header class="dv-hd">' +
        '<div class="dv-hd__brand">' +
          '<span class="dv-hd__ic"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M15.09 14c.937-.834 1.91-2.084 1.91-4a5 5 0 1 0-10 0c0 1.916.973 3.166 1.91 4 .53.47.99 1.077.99 1.766V17h4.2v-1.234c0-.69.46-1.297.99-1.766z"/></svg></span>' +
          '<div><p class="dv-hd__title">Desenvolvimento</p><p class="dv-hd__sub">Peça uma melhoria e acompanhe o andamento</p></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:14px">' +
          '<span class="dv-hd__user">' + esc(user.email || '') + '</span>' +
          '<a class="dv-btn" href="' + esc(HUB_URL) + '">Voltar ao ERP</a>' +
        '</div>' +
      '</header>' +
      '<div class="dv-tabs" id="dvTabs">' +
        '<button class="dv-tab is-active" data-tab="novo" type="button">＋ Nova solicitação</button>' +
        '<button class="dv-tab" data-tab="minhas" type="button">Minhas solicitações</button>' +
        '<button class="dv-tab" data-tab="quadro" type="button" id="dvTabQuadro" hidden>Quadro</button>' +
        '<button class="dv-tab" data-tab="dashboard" type="button" id="dvTabDash" hidden>Dashboard</button>' +
      '</div>' +
      '<div class="dv-body">' +
        '<div class="dv-panel" id="dvPanelNovo"></div>' +
        '<div class="dv-panel" id="dvPanelMinhas" hidden></div>' +
        '<div class="dv-panel" id="dvPanelQuadro" hidden></div>' +
        '<div class="dv-panel" id="dvPanelDash" hidden></div>' +
      '</div>';

    $('dvTabs').querySelectorAll('.dv-tab').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    });
  }

  function renderGate(msg) {
    document.getElementById('app').innerHTML =
      '<div class="dv-gate">' +
        '<h1>Desenvolvimento</h1>' +
        '<p>' + esc(msg) + '</p>' +
        '<a class="dv-btn dv-btn--primary" href="' + esc(HUB_URL) + '">Ir para o SMERP</a>' +
      '</div>';
  }

  function setTab(tab) {
    document.querySelectorAll('.dv-tab').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-tab') === tab); });
    $('dvPanelNovo').hidden = tab !== 'novo';
    $('dvPanelMinhas').hidden = tab !== 'minhas';
    $('dvPanelQuadro').hidden = tab !== 'quadro';
    $('dvPanelDash').hidden = tab !== 'dashboard';
    if (tab === 'novo' && !$('dvPanelNovo').innerHTML) renderNovo();
    if (tab === 'minhas') renderMinhas();
    if (tab === 'quadro' && isGestor) renderQuadro();
    if (tab === 'dashboard' && isGestor) renderDashboard();
  }

  // ============================================================
  //  ABA 1 — NOVA SOLICITAÇÃO
  // ============================================================
  function renderNovo() {
    $('dvPanelNovo').innerHTML =
      '<form id="dvForm" autocomplete="off" class="dv-form">' +
        '<p class="dv-form__hd">Capriche no detalhe: quanto mais completo, mais rápido dá pra entender e resolver.</p>' +

        '<label class="dv-field"><span>Título</span><input id="dv_titulo" type="text" maxlength="160" placeholder="Resumo curto do pedido" /></label>' +
        '<label class="dv-field"><span>O que você quer?</span><textarea id="dv_oque" rows="3" placeholder="Descreva o que você precisa"></textarea></label>' +
        '<label class="dv-field"><span>Como você gostaria que funcionasse?</span><textarea id="dv_como" rows="3" placeholder="Fluxo esperado, passo a passo, comportamento na tela"></textarea></label>' +
        '<label class="dv-field"><span>Qual a finalidade/objetivo desse pedido?</span><textarea id="dv_final" rows="2" placeholder="Por que isso é importante"></textarea></label>' +

        '<fieldset class="dv-fs"><legend>Print da tela (opcional, mas ajuda bastante)</legend>' +
          '<div class="dv-drop" id="dvDrop" tabindex="0">' +
            'Arraste uma imagem aqui, cole com Ctrl+V ou ' +
            '<label class="dv-drop__pick">escolha um arquivo<input id="dv_file" type="file" accept="image/*" multiple hidden /></label>' +
          '</div>' +
          '<div class="dv-thumbs" id="dvThumbs"></div>' +
        '</fieldset>' +

        '<p class="dv-err" id="dvErr" hidden></p>' +
        '<p class="dv-ok" id="dvOk" hidden></p>' +

        '<div class="dv-actions"><button class="dv-btn dv-btn--primary" id="dvSave" type="submit">Enviar solicitação</button></div>' +
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
      return '<div class="dv-thumb"><img src="' + url + '" alt="" />' +
        '<button type="button" class="dv-thumb__rm" data-i="' + i + '" aria-label="Remover">&times;</button></div>';
    }).join('');
    box.querySelectorAll('.dv-thumb__rm').forEach(function (b) {
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
  //  ABA 2 — MINHAS SOLICITAÇÕES
  // ============================================================
  async function renderMinhas() {
    var box = $('dvPanelMinhas');
    box.innerHTML = '<p class="dv-empty">Carregando…</p>';
    try {
      var res = await db().rpc('minhas_solicitacoes');
      if (res.error) throw res.error;
      var rows = res.data || [];
      box.innerHTML = rows.length
        ? '<div class="dv-mine">' + rows.map(minhaItemHtml).join('') + '</div>'
        : '<p class="dv-empty">Você ainda não abriu nenhuma solicitação.</p>';
      try { await db().rpc('marcar_notificacoes_vistas'); } catch (e) {}
    } catch (e) {
      box.innerHTML = '<p class="dv-empty">Não foi possível carregar.</p>';
      console.error('[DEV] minhas_solicitacoes', e);
    }
  }

  function minhaItemHtml(s) {
    var col = colInfo(s.coluna);
    var extra = '';
    if (s.coluna === 'desenvolvimento' && s.data_prevista) {
      extra = '<div class="dv-mine__extra">Previsão de entrega: ' + esc(fmtData(s.data_prevista)) + '</div>';
    } else if (s.coluna === 'recusado' && s.motivo_recusa) {
      extra = '<div class="dv-mine__extra dv-mine__extra--neg">Motivo: ' + esc(s.motivo_recusa) + '</div>';
    }
    return '<div class="dv-mine__item">' +
      '<div class="dv-mine__top"><b>' + esc(s.titulo) + '</b><span class="dv-pill" style="--c:' + esc(col.cor) + '">' + esc(col.label) + '</span></div>' +
      '<div class="dv-mine__sub">' + esc((s.o_que_quer || '').slice(0, 160)) + '</div>' +
      extra +
      (s.anexos && s.anexos.length ? '<div class="dv-hint">📎 ' + s.anexos.length + ' anexo(s)</div>' : '') +
    '</div>';
  }

  // ============================================================
  //  ABA 3 — QUADRO (só gestor)
  // ============================================================
  async function renderQuadro() {
    var box = $('dvPanelQuadro');
    box.innerHTML = '<p class="dv-empty">Carregando…</p>';
    try {
      var res = await db().rpc('quadro');
      if (res.error) throw res.error;
      cacheQuadro = res.data || [];
      drawQuadro();
    } catch (e) {
      box.innerHTML = '<p class="dv-empty">Não foi possível carregar.</p>';
      console.error('[DEV] quadro', e);
    }
  }

  function cardById(id) { for (var i = 0; i < cacheQuadro.length; i++) if (cacheQuadro[i].id === id) return cacheQuadro[i]; return null; }

  function cardHtml(s) {
    var quem = esc(s.created_by_nome || s.created_by_email || 'Alguém');
    return '<div class="dv-card" draggable="true" data-id="' + esc(s.id) + '">' +
      '<div class="dv-card__top"><b>' + esc(s.titulo) + '</b></div>' +
      '<div class="dv-card__who">' + quem + '</div>' +
      '<div class="dv-card__sub">' + esc((s.o_que_quer || '').slice(0, 90)) + '</div>' +
      (s.anexos && s.anexos.length ? '<div class="dv-card__anexos">📎 ' + s.anexos.length + '</div>' : '') +
    '</div>';
  }

  function drawQuadro() {
    var box = $('dvPanelQuadro');
    box.innerHTML = '<div class="dv-board">' + COLUNAS.map(function (c) {
      var itens = cacheQuadro.filter(function (s) { return s.coluna === c.value; });
      return '<div class="dv-col" data-coluna="' + esc(c.value) + '">' +
        '<div class="dv-col__hd" style="--c:' + esc(c.cor) + '">' + esc(c.label) + ' <span class="dv-col__count">' + itens.length + '</span></div>' +
        '<div class="dv-col__body">' + (itens.length ? itens.map(cardHtml).join('') : '<p class="dv-col__empty">Vazio</p>') + '</div>' +
      '</div>';
    }).join('') + '</div>';

    box.querySelectorAll('.dv-card').forEach(function (el) {
      el.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', el.getAttribute('data-id')); el.classList.add('is-dragging'); });
      el.addEventListener('dragend', function () { el.classList.remove('is-dragging'); });
      el.addEventListener('click', function () { abrirDetalhe(el.getAttribute('data-id')); });
    });
    box.querySelectorAll('.dv-col').forEach(function (col) {
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
    if (!m) { m = document.createElement('div'); m.id = 'dvMiniForm'; m.className = 'dv-modal'; document.body.appendChild(m); }
    var campoHtml = opts.campo === 'data'
      ? '<input type="date" id="dvmf_val" />'
      : '<textarea id="dvmf_val" rows="3" placeholder="' + esc(opts.label) + '"></textarea>';
    m.innerHTML =
      '<div class="dv-modal__card">' +
        '<div class="dv-modal__hd"><b>' + esc(opts.titulo) + '</b><button type="button" class="dv-modal__close" id="dvmf_close" aria-label="Fechar">&times;</button></div>' +
        '<div class="dv-modal__body">' +
          '<label class="dv-field"><span>' + esc(opts.label) + '</span>' + campoHtml + '</label>' +
          '<p class="dv-err" id="dvmf_err" hidden></p>' +
          '<div class="dv-actions"><button type="button" class="dv-btn dv-btn--primary" id="dvmf_ok">Confirmar</button></div>' +
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
    if (!m) { m = document.createElement('div'); m.id = 'dvDetalhe'; m.className = 'dv-modal'; document.body.appendChild(m); }
    var col = colInfo(s.coluna);
    m.innerHTML =
      '<div class="dv-modal__card dv-modal__card--wide">' +
        '<div class="dv-modal__hd"><b>' + esc(s.titulo) + '</b><button type="button" class="dv-modal__close" id="dvd_close" aria-label="Fechar">&times;</button></div>' +
        '<div class="dv-modal__body">' +
          '<span class="dv-pill" style="--c:' + esc(col.cor) + '">' + esc(col.label) + '</span>' +
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
        if (!r.error && r.data) htmls.push('<a href="' + r.data.signedUrl + '" target="_blank" rel="noopener"><img src="' + r.data.signedUrl + '" class="dv-thumb__view" alt="" /></a>');
      } catch (e) {}
    }
    box.innerHTML = htmls.length ? '<div class="dv-thumbs">' + htmls.join('') + '</div>' : 'Não foi possível carregar os anexos.';
  }

  // ============================================================
  //  ABA 4 — DASHBOARD (só gestor)
  // ============================================================
  async function renderDashboard() {
    var box = $('dvPanelDash');
    box.innerHTML =
      '<div class="dv-dashbar">' +
        '<label class="dv-field"><span>De</span><input type="date" id="dd_de" /></label>' +
        '<label class="dv-field"><span>Até</span><input type="date" id="dd_ate" /></label>' +
        '<button class="dv-btn" id="dd_go" type="button">Atualizar</button>' +
      '</div>' +
      '<div id="dvDashBody"><p class="dv-empty">Carregando…</p></div>';
    $('dd_go').addEventListener('click', loadDash);
    loadDash();
  }

  async function loadDash() {
    var body = $('dvDashBody');
    var de = fval('dd_de') || null, ate = fval('dd_ate') || null;
    body.innerHTML = '<p class="dv-empty">Carregando…</p>';
    try {
      var res = await db().rpc('dashboard', { _de: de, _ate: ate });
      if (res.error) throw res.error;
      body.innerHTML = dashHtml(res.data || {});
    } catch (e) {
      body.innerHTML = '<p class="dv-empty">Não foi possível carregar o dashboard.</p>';
      console.error('[DEV] dashboard', e);
    }
  }

  function dashHtml(d) {
    var kpis = [
      ['Total de solicitações', d.total || 0, '#F59E0B'],
      ['Em desenvolvimento', d.desenvolvimento || 0, '#2E78D2'],
      ['Finalizadas', d.finalizado || 0, '#1F9D55'],
      ['Tempo médio de resolução', (d.tempo_medio_dias != null ? d.tempo_medio_dias + ' dia(s)' : '—'), '#8B5CF6']
    ];
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

    return '' +
      '<div class="dv-kpis">' + kpis.map(function (k) {
        return '<div class="dv-kpi" style="--c:' + k[2] + '"><span class="dv-kpi__n">' + k[1] + '</span><span class="dv-kpi__l">' + esc(k[0]) + '</span></div>';
      }).join('') + '</div>' +

      '<div class="dv-card-box"><h4>Funil (todas as colunas no período)</h4><div class="dv-bars">' +
        funil.map(function (f) {
          var pct = Math.max(4, Math.round((f.n / maxFunil) * 100));
          return '<div class="dv-bar"><span class="dv-bar__lbl">' + esc(f.label) + '</span>' +
            '<span class="dv-bar__track"><span class="dv-bar__fill" style="width:' + pct + '%"></span></span>' +
            '<span class="dv-bar__n">' + f.n + '</span></div>';
        }).join('') +
      '</div></div>' +

      '<div class="dv-card-box"><h4>Solicitações finalizadas por mês</h4>' +
        (meses.length ? '<div class="dv-months">' + meses.map(function (m) {
          var h = Math.max(8, Math.round((m.n / maxMes) * 100));
          return '<div class="dv-month"><span class="dv-month__bar" style="height:' + h + '%"></span><span class="dv-month__n">' + m.n + '</span><span class="dv-month__l">' + esc(m.mes) + '</span></div>';
        }).join('') + '</div>' : '<p class="dv-empty">Sem dados no período.</p>') +
      '</div>' +

      '<div class="dv-card-box"><h4>Quem mais pediu</h4>' +
        (ranking.length ? '<div class="dv-bars">' + ranking.map(function (r) {
          var pct = Math.max(4, Math.round((r.n / maxRank) * 100));
          return '<div class="dv-bar"><span class="dv-bar__lbl">' + esc(r.nome) + '</span>' +
            '<span class="dv-bar__track"><span class="dv-bar__fill" style="width:' + pct + '%"></span></span>' +
            '<span class="dv-bar__n">' + r.n + '</span></div>';
        }).join('') + '</div>' : '<p class="dv-empty">Sem dados no período.</p>') +
      '</div>';
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
    if (isGestor) {
      $('dvTabQuadro').hidden = false;
      $('dvTabDash').hidden = false;
    }
    setTab(isGestor ? 'quadro' : 'novo');

    // Cola (Ctrl+V) só é capturada com a aba "Nova solicitação" visível.
    document.addEventListener('paste', function (e) {
      var painel = $('dvPanelNovo');
      if (!painel || painel.hidden) return;
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
