/* ============================================================
   SMERP — Módulo INOVAÇÃO · Desenvolvimento
   ------------------------------------------------------------
   Aba interna do Hub (mesmo molde de Engenharia/Assistências):
     - Nova solicitação: qualquer usuário autenticado abre um pedido
       de desenvolvimento (título, o que quer, como quer, finalidade
       — todos obrigatórios — + print opcional, colado ou arrastado).
     - Minhas solicitações: cada um acompanha o status dos próprios
       pedidos (marca as notificações como vistas ao abrir).
     - Quadro: só o(s) gestor(es) — 5 colunas com drag-and-drop nativo
       (Solicitação → Em Análise/Priorizado → Em Desenvolvimento →
       Finalizado / Recusado).
   Acesso: liberado a todo mundo por my_systems().inovacao — o papel
   (solicitante/gestor) é resolvido por script.js via inovacao.is_gestor()
   e informado aqui por setIsGestor(). Recebe o client Supabase do
   script.js via SMERPInovacao.init(sb).
   ============================================================ */
window.SMERPInovacao = (function () {
  'use strict';

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
  function colunas() {
    var cfg = window.SMERP_CONFIG && window.SMERP_CONFIG.INOVACAO;
    return (cfg && cfg.COLUNAS) || [];
  }
  function colInfo(value) {
    var cs = colunas();
    for (var i = 0; i < cs.length; i++) if (cs[i].value === value) return cs[i];
    return { value: value, label: value, cor: '#6B7280' };
  }

  var sb = null;
  var overlay, elNovo, elMinhas, elQuadro;
  var inited = false;
  var isGestor = false;
  var pendentes = [];      // File[] em memória até o envio da nova solicitação
  var cacheQuadro = [];    // últimas linhas carregadas do quadro (gestor)

  function db() { return sb.schema('inovacao'); }
  function avisaMudanca() { document.dispatchEvent(new Event('smerp-inov-changed')); }

  // ============================================================
  //  ABA 1 — NOVA SOLICITAÇÃO
  // ============================================================
  function renderNovo() {
    elNovo.innerHTML =
      '<form id="invForm" autocomplete="off" class="eng-form">' +
        '<p class="eng-form__hd">Capriche no detalhe: quanto mais completo, mais rápido dá pra entender e resolver.</p>' +

        '<label class="smerp-field"><span>Título</span>' +
          '<input id="iv_titulo" type="text" maxlength="160" placeholder="Resumo curto do pedido" /></label>' +

        '<label class="smerp-field"><span>O que você quer?</span>' +
          '<textarea id="iv_oque" class="eng-ta" rows="3" placeholder="Descreva o que você precisa"></textarea></label>' +

        '<label class="smerp-field"><span>Como você gostaria que funcionasse?</span>' +
          '<textarea id="iv_como" class="eng-ta" rows="3" placeholder="Fluxo esperado, passo a passo, comportamento na tela"></textarea></label>' +

        '<label class="smerp-field"><span>Qual a finalidade/objetivo desse pedido?</span>' +
          '<textarea id="iv_final" class="eng-ta" rows="2" placeholder="Por que isso é importante pra você/pro setor"></textarea></label>' +

        '<fieldset class="eng-fs"><legend>Print da tela (opcional, mas ajuda bastante)</legend>' +
          '<div class="inv-drop" id="ivDrop" tabindex="0">' +
            'Arraste uma imagem aqui, cole com Ctrl+V ou ' +
            '<label class="inv-drop__pick">escolha um arquivo<input id="iv_file" type="file" accept="image/*" multiple hidden /></label>' +
          '</div>' +
          '<div class="inv-thumbs" id="ivThumbs"></div>' +
        '</fieldset>' +

        '<p class="smerp-login__error" id="ivErr" hidden></p>' +
        '<p class="usr__ok" id="ivOk" hidden></p>' +

        '<div class="eng-form__actions">' +
          '<button class="smerp-login__btn" id="ivSave" type="submit">Enviar solicitação</button>' +
        '</div>' +
      '</form>';

    pendentes = [];
    renderThumbs();

    var drop = $('ivDrop'), fileInput = $('iv_file');
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-drag'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('is-drag'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('is-drag'); handleFiles(e.dataTransfer.files); });
    fileInput.addEventListener('change', function () { handleFiles(fileInput.files); fileInput.value = ''; });

    $('invForm').addEventListener('submit', onSaveNovo);
  }

  function handleFiles(fileList) {
    Array.prototype.forEach.call(fileList || [], function (f) {
      if (f && f.type && f.type.indexOf('image') === 0) pendentes.push(f);
    });
    renderThumbs();
  }

  function renderThumbs() {
    var box = $('ivThumbs'); if (!box) return;
    box.innerHTML = pendentes.map(function (f, i) {
      var url = URL.createObjectURL(f);
      return '<div class="inv-thumb"><img src="' + url + '" alt="" />' +
        '<button type="button" class="inv-thumb__rm" data-i="' + i + '" aria-label="Remover">&times;</button></div>';
    }).join('');
    box.querySelectorAll('.inv-thumb__rm').forEach(function (b) {
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
    var err = $('ivErr'), ok = $('ivOk'), btn = $('ivSave');
    err.hidden = true; ok.hidden = true;
    var titulo = fval('iv_titulo'), oque = fval('iv_oque'), como = fval('iv_como'), final = fval('iv_final');
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
      ok.textContent = 'Solicitação enviada! Você vai ser avisado a cada atualização.';
      var okAfter = $('ivOk'); if (okAfter) okAfter.hidden = false;
      avisaMudanca();
    } catch (e2) {
      err.textContent = (e2 && e2.message) || 'Não foi possível enviar.'; err.hidden = false;
      console.error('[INOV] criar_solicitacao', e2);
    } finally {
      btn.disabled = false; btn.textContent = prev;
    }
  }

  // ============================================================
  //  ABA 2 — MINHAS SOLICITAÇÕES
  // ============================================================
  async function renderMinhas() {
    elMinhas.innerHTML = '<p class="usr__empty">Carregando…</p>';
    try {
      var res = await db().rpc('minhas_solicitacoes');
      if (res.error) throw res.error;
      var rows = res.data || [];
      elMinhas.innerHTML = rows.length
        ? rows.map(minhaItemHtml).join('')
        : '<p class="usr__empty">Você ainda não abriu nenhuma solicitação.</p>';
      try { await db().rpc('marcar_notificacoes_vistas'); avisaMudanca(); } catch (e) {}
    } catch (e) {
      elMinhas.innerHTML = '<p class="usr__empty">Não foi possível carregar.</p>';
      console.error('[INOV] minhas_solicitacoes', e);
    }
  }

  function minhaItemHtml(s) {
    var col = colInfo(s.coluna);
    var extra = '';
    if (s.coluna === 'desenvolvimento' && s.data_prevista) {
      extra = '<div class="inv-card__extra">Previsão de entrega: ' + esc(fmtData(s.data_prevista)) + '</div>';
    } else if (s.coluna === 'recusado' && s.motivo_recusa) {
      extra = '<div class="inv-card__extra inv-card__extra--neg">Motivo: ' + esc(s.motivo_recusa) + '</div>';
    }
    return '<div class="inv-card inv-card--flat">' +
      '<div class="inv-card__top"><b>' + esc(s.titulo) + '</b><span class="eng-status" style="--c:' + esc(col.cor) + '">' + esc(col.label) + '</span></div>' +
      '<div class="inv-card__sub">' + esc((s.o_que_quer || '').slice(0, 160)) + '</div>' +
      extra +
      (s.anexos && s.anexos.length ? '<div class="eng-hint">📎 ' + s.anexos.length + ' anexo(s)</div>' : '') +
    '</div>';
  }

  // ============================================================
  //  ABA 3 — QUADRO (só gestor)
  // ============================================================
  async function renderQuadro() {
    elQuadro.innerHTML = '<p class="usr__empty">Carregando…</p>';
    try {
      var res = await db().rpc('quadro');
      if (res.error) throw res.error;
      cacheQuadro = res.data || [];
      drawQuadro();
    } catch (e) {
      elQuadro.innerHTML = '<p class="usr__empty">Não foi possível carregar.</p>';
      console.error('[INOV] quadro', e);
    }
  }

  function cardById(id) { for (var i = 0; i < cacheQuadro.length; i++) if (cacheQuadro[i].id === id) return cacheQuadro[i]; return null; }

  function cardHtml(s) {
    var quem = esc(s.created_by_nome || s.created_by_email || 'Alguém');
    return '<div class="inv-card" draggable="true" data-id="' + esc(s.id) + '">' +
      '<div class="inv-card__top"><b>' + esc(s.titulo) + '</b></div>' +
      '<div class="inv-card__who">' + quem + '</div>' +
      '<div class="inv-card__sub">' + esc((s.o_que_quer || '').slice(0, 90)) + '</div>' +
      (s.anexos && s.anexos.length ? '<div class="inv-card__anexos">📎 ' + s.anexos.length + '</div>' : '') +
    '</div>';
  }

  function drawQuadro() {
    var C = colunas();
    elQuadro.innerHTML = '<div class="inv-board">' + C.map(function (c) {
      var itens = cacheQuadro.filter(function (s) { return s.coluna === c.value; });
      return '<div class="inv-col" data-coluna="' + esc(c.value) + '">' +
        '<div class="inv-col__hd" style="--c:' + esc(c.cor) + '">' + esc(c.label) + ' <span class="inv-col__count">' + itens.length + '</span></div>' +
        '<div class="inv-col__body">' + (itens.length ? itens.map(cardHtml).join('') : '<p class="inv-col__empty">Vazio</p>') + '</div>' +
      '</div>';
    }).join('') + '</div>';

    elQuadro.querySelectorAll('.inv-card').forEach(function (el) {
      el.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', el.getAttribute('data-id'));
        el.classList.add('is-dragging');
      });
      el.addEventListener('dragend', function () { el.classList.remove('is-dragging'); });
      el.addEventListener('click', function () { abrirDetalhe(el.getAttribute('data-id')); });
    });
    elQuadro.querySelectorAll('.inv-col').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('is-over'); });
      col.addEventListener('dragleave', function () { col.classList.remove('is-over'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault(); col.classList.remove('is-over');
        var id = e.dataTransfer.getData('text/plain');
        onDropCard(id, col.getAttribute('data-coluna'));
      });
    });
  }

  function onDropCard(id, destino) {
    var card = cardById(id);
    if (!card || card.coluna === destino) return;
    if (destino === 'desenvolvimento') {
      abrirMiniForm({
        titulo: 'Previsão de entrega', campo: 'data',
        label: 'Data prevista (opcional)', obrigatorio: false,
        onConfirm: function (valor) { moverCard(id, destino, valor || null, null); }
      });
      return;
    }
    if (destino === 'recusado') {
      abrirMiniForm({
        titulo: 'Motivo da recusa', campo: 'texto',
        label: 'Explique por que não será feito', obrigatorio: true,
        onConfirm: function (valor) { moverCard(id, destino, null, valor); }
      });
      return;
    }
    moverCard(id, destino, null, null);
  }

  async function moverCard(id, coluna, dataPrevista, motivo) {
    try {
      var res = await db().rpc('mover_solicitacao', { p_id: id, p_coluna: coluna, p_data_prevista: dataPrevista, p_motivo_recusa: motivo });
      if (res.error) throw res.error;
      await renderQuadro();
      avisaMudanca();
    } catch (e) {
      alert((e && e.message) || 'Não foi possível mover o card.');
      console.error('[INOV] mover_solicitacao', e);
    }
  }

  // Mini-formulário genérico (data ou texto obrigatório) — usado ao mover
  // pra "Em Desenvolvimento" (data prevista) ou "Recusado" (motivo).
  function abrirMiniForm(opts) {
    var m = $('invMiniForm');
    if (!m) { m = document.createElement('div'); m.id = 'invMiniForm'; m.className = 'eng-picker'; document.body.appendChild(m); }
    var campoHtml = opts.campo === 'data'
      ? '<input type="date" id="imf_val" class="eng-in" />'
      : '<textarea id="imf_val" class="eng-ta" rows="3" placeholder="' + esc(opts.label) + '"></textarea>';
    m.innerHTML =
      '<div class="eng-picker__card inv-miniform">' +
        '<div class="eng-picker__hd"><b>' + esc(opts.titulo) + '</b>' +
          '<button type="button" class="smerp-modal__close" id="imf_close" aria-label="Fechar">&times;</button></div>' +
        '<div class="inv-miniform__body">' +
          '<label class="smerp-field"><span>' + esc(opts.label) + '</span>' + campoHtml + '</label>' +
          '<p class="smerp-login__error" id="imf_err" hidden></p>' +
          '<div class="eng-form__actions"><button type="button" class="smerp-login__btn" id="imf_ok">Confirmar</button></div>' +
        '</div>' +
      '</div>';
    m.hidden = false;
    $('imf_close').onclick = function () { m.hidden = true; };
    m.addEventListener('click', function (e) { if (e.target === m) m.hidden = true; });
    $('imf_ok').onclick = function () {
      var v = fval('imf_val');
      if (opts.obrigatorio && !v) {
        var er = $('imf_err'); er.textContent = 'Esse campo é obrigatório.'; er.hidden = false; return;
      }
      m.hidden = true;
      opts.onConfirm(v || null);
    };
  }

  // Detalhe do card (somente leitura) — abre ao clicar no card no Quadro.
  async function abrirDetalhe(id) {
    var s = cardById(id); if (!s) return;
    var m = $('invDetalhe');
    if (!m) { m = document.createElement('div'); m.id = 'invDetalhe'; m.className = 'eng-picker'; document.body.appendChild(m); }
    var col = colInfo(s.coluna);
    m.innerHTML =
      '<div class="eng-picker__card inv-detalhe">' +
        '<div class="eng-picker__hd"><b>' + esc(s.titulo) + '</b>' +
          '<button type="button" class="smerp-modal__close" id="ivd_close" aria-label="Fechar">&times;</button></div>' +
        '<div class="inv-detalhe__body">' +
          '<span class="eng-status" style="--c:' + esc(col.cor) + '">' + esc(col.label) + '</span>' +
          '<div><b>Solicitante:</b> ' + esc(s.created_by_nome || '') + (s.created_by_email ? ' — ' + esc(s.created_by_email) : '') + '</div>' +
          '<div><b>O que quer:</b><br/>' + esc(s.o_que_quer) + '</div>' +
          '<div><b>Como quer:</b><br/>' + esc(s.como_quer) + '</div>' +
          '<div><b>Finalidade:</b><br/>' + esc(s.finalidade) + '</div>' +
          (s.data_prevista ? '<div><b>Previsão de entrega:</b> ' + esc(fmtData(s.data_prevista)) + '</div>' : '') +
          (s.motivo_recusa ? '<div><b>Motivo da recusa:</b> ' + esc(s.motivo_recusa) + '</div>' : '') +
          '<div id="ivd_anexos">' + (s.anexos && s.anexos.length ? 'Carregando anexos…' : 'Sem anexos.') + '</div>' +
        '</div>' +
      '</div>';
    m.hidden = false;
    $('ivd_close').onclick = function () { m.hidden = true; };
    m.addEventListener('click', function (e) { if (e.target === m) m.hidden = true; });
    if (s.anexos && s.anexos.length) loadAnexos(s.anexos);
  }

  async function loadAnexos(anexos) {
    var box = $('ivd_anexos'); if (!box) return;
    var htmls = [];
    for (var i = 0; i < anexos.length; i++) {
      try {
        var r = await sb.storage.from('inovacao-anexos').createSignedUrl(anexos[i].path, 3600);
        if (!r.error && r.data) htmls.push('<a href="' + r.data.signedUrl + '" target="_blank" rel="noopener"><img src="' + r.data.signedUrl + '" class="inv-thumb__view" alt="" /></a>');
      } catch (e) {}
    }
    box.innerHTML = htmls.length ? '<div class="inv-thumbs">' + htmls.join('') + '</div>' : 'Não foi possível carregar os anexos.';
  }

  // ============================================================
  //  Abas + abrir/fechar
  // ============================================================
  function setTab(tab) {
    overlay.querySelectorAll('.eng__tab').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-tab') === tab); });
    elNovo.hidden = tab !== 'novo'; elMinhas.hidden = tab !== 'minhas'; elQuadro.hidden = tab !== 'quadro';
    if (tab === 'novo' && !elNovo.innerHTML) renderNovo();
    if (tab === 'minhas') renderMinhas();
    if (tab === 'quadro' && isGestor) renderQuadro();
  }

  function open() {
    if (!inited) return;
    if (!elNovo.innerHTML) renderNovo();
    overlay.hidden = false;
    requestAnimationFrame(function () { overlay.classList.add('is-open'); });
    setTab(isGestor ? 'quadro' : 'novo');
  }
  function close() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    setTimeout(function () { overlay.hidden = true; }, 200);
  }

  function setIsGestor(v) {
    isGestor = !!v;
    var tabBtn = $('invTabQuadro');
    if (tabBtn) tabBtn.hidden = !isGestor;
  }

  // ============================================================
  //  init — chamado pelo script.js depois de criar o client `sb`
  // ============================================================
  function init(sbClient) {
    sb = sbClient;
    overlay = $('invOverlay');
    if (!overlay || typeof sbClient.schema !== 'function') return null;

    elNovo = $('invPanelNovo'); elMinhas = $('invPanelMinhas'); elQuadro = $('invPanelQuadro');
    inited = true;

    overlay.querySelectorAll('.eng__tab').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    });
    overlay.querySelectorAll('[data-close]').forEach(function (el) { el.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) close(); });

    // Cola (Ctrl+V) só é capturada com o overlay aberto e na aba "Nova solicitação".
    document.addEventListener('paste', function (e) {
      if (overlay.hidden || elNovo.hidden) return;
      var items = (e.clipboardData || {}).items || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image') === 0) {
          var f = items[i].getAsFile();
          if (f) handleFiles([f]);
        }
      }
    });

    return true;
  }

  return { init: init, open: open, hide: function () { close(); }, setIsGestor: setIsGestor };
})();
