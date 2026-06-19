/* ============================================================
   SMERP — Módulo ENGENHARIA · Assistência (RNC)
   ------------------------------------------------------------
   Aba interna do Hub (mesmo molde de Usuários/Solicitações):
     - Nova assistência: formulário fiel ao "Relatório de Não
       Conformidade", gera nº sequencial (RNC-00001/2026) + PDF.
     - Registros: lista com filtros (tudo, menos os campos escritos).
     - Dashboard: o que MAIS saiu (tipo, causa, ação) + totais.
   Acesso: gated por my_systems().engenharia (perfil no schema 'engenharia').
   Recebe o client Supabase do script.js via SMERPEngenharia.init(sb).
   ============================================================ */
window.SMERPEngenharia = (function () {
  'use strict';

  // -------- Opções canônicas (chave -> rótulo). Fonte única: form, filtros e dashboard. --------
  var OPC = {
    origem: [['interno', 'Interno'], ['externo', 'Externo']],
    onde: [['produto', 'Produto'], ['cliente', 'Cliente'], ['fornecedor', 'Fornecedor'], ['outros', 'Outros']],
    tipo_nc: [
      ['contagem', 'Contagem'], ['transporte', 'Transporte'], ['fabricacao', 'Fabricação'], ['projeto', 'Projeto'],
      ['procedimento', 'Procedimento não seguido'], ['inspecao', 'Falha de inspeção'], ['materia_prima', 'Matéria prima'], ['outros', 'Outros']
    ],
    causa: [
      ['mao_de_obra', 'Mão-de-Obra'], ['procedimento_its', 'Procedimento/ITs'], ['medicao', 'Medição'], ['quantidade', 'Quantidade'],
      ['produto_danificado', 'Produto danificado'], ['problema_fornecedor', 'Problema fornecedor'], ['maquina', 'Máquina'],
      ['falta_padronizacao', 'Falta padronização'], ['atraso_entrega', 'Atraso na entrega'], ['outros', 'Outros']
    ],
    acao_imediata: [
      ['separar', 'Separar'], ['retrabalho', 'Retrabalho'], ['refugo', 'Refugo'], ['comunicacao_setor', 'Comunicação c/ setor'],
      ['insumos_recebidos', 'Insumos recebidos'], ['insumos_rejeitados', 'Insumos rejeitados'], ['envio_produtos', 'Envio de produtos'], ['outros', 'Outros']
    ],
    acao_corretiva: [
      ['treinamento', 'Realização de treinamento'], ['revisao_documento', 'Revisão de documento'], ['correcao_equipamento', 'Correção de equipamento'],
      ['padronizar_processo', 'Padronizar processo'], ['projetar_dispositivo', 'Projetar dispositivo'], ['reuniao_responsaveis', 'Reunião c/ responsáveis'],
      ['investigar_causa', 'Investigar/eliminar a causa'], ['outros', 'Outros']
    ]
  };

  function label(group, key) {
    var arr = OPC[group] || [];
    for (var i = 0; i < arr.length; i++) if (arr[i][0] === key) return arr[i][1];
    return key;
  }
  function labels(group, keys) { return (keys || []).map(function (k) { return label(group, k); }); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtData(d) {
    if (!d) return '';
    try { var p = String(d).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; } catch (e) { return d; }
  }
  function hoje() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function statusOf(r) {
    if (r.realizado) return { key: 'realizado', label: 'Realizado', cor: '#1F9D55' };
    if (r.previsao) return { key: 'previsto', label: 'Previsto', cor: '#2E78D2' };
    return { key: 'aberta', label: 'Aberta', cor: '#E8722A' };
  }

  // ============================================================
  //  init — chamado pelo script.js depois de criar o client `sb`
  // ============================================================
  function init(sb) {
    var $ = function (id) { return document.getElementById(id); };
    var overlay = $('engOverlay');
    var navBtn = $('btnEng');
    if (!overlay || !navBtn || typeof sb.schema !== 'function') return null;

    var elForm = $('engPanelForm'), elList = $('engPanelList'), elDash = $('engPanelDash');
    var pdfStage = $('engPdfStage');
    var db = function () { return sb.schema('engenharia'); };

    var podeCriar = false;   // papel 'criador'
    var editingId = null;    // null = nova; uuid = editando
    var cache = [];          // últimos registros carregados (lista)

    // ---------- grupos de checkbox a partir do OPC ----------
    function checkGroup(group, name, sel) {
      sel = sel || [];
      return '<div class="eng-checks">' + (OPC[group] || []).map(function (o) {
        var on = sel.indexOf(o[0]) !== -1;
        return '<label class="eng-chk"><input type="checkbox" name="' + name + '" value="' + esc(o[0]) + '"' + (on ? ' checked' : '') + ' /><span>' + esc(o[1]) + '</span></label>';
      }).join('') + '</div>';
    }
    function radioGroup(group, name, val) {
      return '<div class="eng-checks eng-checks--radio">' + (OPC[group] || []).map(function (o) {
        var on = val === o[0];
        return '<label class="eng-chk"><input type="radio" name="' + name + '" value="' + esc(o[0]) + '"' + (on ? ' checked' : '') + ' /><span>' + esc(o[1]) + '</span></label>';
      }).join('') + '</div>';
    }
    function getChecks(name) {
      return Array.prototype.slice.call(elForm.querySelectorAll('input[name="' + name + '"]:checked')).map(function (i) { return i.value; });
    }
    function getRadio(name) {
      var n = elForm.querySelector('input[name="' + name + '"]:checked'); return n ? n.value : null;
    }
    function fval(id) { var n = $(id); return n ? (n.value || '').trim() : ''; }

    // ============================================================
    //  TELA 1 — FORMULÁRIO (RNC)
    // ============================================================
    function renderForm(rec) {
      rec = rec || {};
      editingId = rec.id || null;
      var titulo = editingId
        ? 'Editando ' + esc(rec.numero || 'assistência')
        : 'Nova assistência — o número é gerado ao salvar';
      elForm.innerHTML =
        '<form id="engForm" autocomplete="off" class="eng-form">' +
          '<p class="eng-form__hd">' + titulo + '</p>' +

          '<label class="smerp-field" style="max-width:220px"><span>Data do relatório</span>' +
            '<input id="eg_data" type="date" value="' + esc((rec.data || hoje()).slice(0, 10)) + '" /></label>' +

          '<fieldset class="eng-fs"><legend>1 · Emissor do registro (quem identificou)</legend>' +
            '<input id="eg_emissor" type="text" class="eng-in" placeholder="Nome e matrícula — ex.: Vitor Renan S. da Conceição - 1073" value="' + esc(rec.emissor || '') + '" />' +
          '</fieldset>' +

          '<div class="eng-grid2">' +
            '<fieldset class="eng-fs"><legend>2 · Origem</legend>' + radioGroup('origem', 'eg_origem', rec.origem) + '</fieldset>' +
            '<fieldset class="eng-fs"><legend>3 · Onde?</legend>' + checkGroup('onde', 'eg_onde', rec.onde) +
              '<input id="eg_onde_outros" type="text" class="eng-in eng-in--sm" placeholder="Outros (qual?)" value="' + esc(rec.onde_outros || '') + '" />' +
            '</fieldset>' +
          '</div>' +

          '<div class="eng-grid2">' +
            '<label class="smerp-field"><span>4 · Cliente</span><input id="eg_cliente" type="text" value="' + esc(rec.cliente || '') + '" /></label>' +
            '<label class="smerp-field"><span>5 · Fornecedor</span><input id="eg_fornecedor" type="text" value="' + esc(rec.fornecedor || '') + '" /></label>' +
          '</div>' +

          '<fieldset class="eng-fs"><legend>6 · Produto/processo não conforme</legend>' +
            '<div class="eng-grid2">' +
              '<input id="eg_produto" type="text" class="eng-in" placeholder="Código do produto pai e/ou filho" value="' + esc(rec.produto || '') + '" />' +
              '<input id="eg_qtd" type="text" class="eng-in" placeholder="Quantidade" value="' + esc(rec.quantidade || '') + '" />' +
            '</div>' +
          '</fieldset>' +

          '<fieldset class="eng-fs"><legend>7 · Tipo de Não Conformidade</legend>' +
            checkGroup('tipo_nc', 'eg_tipo', rec.tipo_nc) +
            '<input id="eg_tipo_outros" type="text" class="eng-in eng-in--sm" placeholder="Outros (qual?)" value="' + esc(rec.tipo_nc_outros || '') + '" />' +
            '<textarea id="eg_tipo_desc" class="eng-ta" rows="2" placeholder="Descrição: o que foi identificado fora do padrão">' + esc(rec.tipo_desc || '') + '</textarea>' +
          '</fieldset>' +

          '<fieldset class="eng-fs"><legend>8 · Causa da Não Conformidade</legend>' +
            checkGroup('causa', 'eg_causa', rec.causa) +
            '<input id="eg_causa_outros" type="text" class="eng-in eng-in--sm" placeholder="Outros (qual?)" value="' + esc(rec.causa_outros || '') + '" />' +
            '<textarea id="eg_causa_desc" class="eng-ta" rows="2" placeholder="Descrição: motivo principal que gerou o erro/desvio">' + esc(rec.causa_desc || '') + '</textarea>' +
          '</fieldset>' +

          '<fieldset class="eng-fs"><legend>9 · Ação Imediata</legend>' +
            checkGroup('acao_imediata', 'eg_acaoi', rec.acao_imediata) +
            '<input id="eg_acaoi_outros" type="text" class="eng-in eng-in--sm" placeholder="Outros (qual?)" value="' + esc(rec.acao_imediata_outros || '') + '" />' +
          '</fieldset>' +

          '<div class="eng-grid2">' +
            '<label class="smerp-field"><span>10 · Funcionário responsável pelo tratamento</span><input id="eg_func" type="text" placeholder="Nome e matrícula" value="' + esc(rec.funcionario_resp || '') + '" /></label>' +
            '<label class="smerp-field"><span>Data do tratamento</span><input id="eg_func_data" type="date" value="' + esc((rec.funcionario_data || '').slice(0, 10)) + '" /></label>' +
          '</div>' +

          '<label class="smerp-field"><span>11 · Número da OS referente à ação (deixe em branco se não precisar)</span><input id="eg_os" type="text" value="' + esc(rec.numero_os || '') + '" /></label>' +

          '<fieldset class="eng-fs"><legend>Ação corretiva (eliminar a causa e evitar recorrência)</legend>' +
            checkGroup('acao_corretiva', 'eg_corr', rec.acao_corretiva) +
            '<input id="eg_corr_outros" type="text" class="eng-in eng-in--sm" placeholder="Outros (qual?)" value="' + esc(rec.acao_corretiva_outros || '') + '" />' +
            '<textarea id="eg_corr_desc" class="eng-ta" rows="2" placeholder="Descrever as ações corretivas">' + esc(rec.acao_corretiva_desc || '') + '</textarea>' +
          '</fieldset>' +

          '<fieldset class="eng-fs"><legend>Observação da assistência</legend>' +
            '<div class="eng-grid2">' +
              '<label class="smerp-field"><span>N° RNC</span><input id="eg_rnc" type="text" value="' + esc(rec.rnc_ref || '') + '" /></label>' +
              '<label class="smerp-field"><span>Número da NF</span><input id="eg_nf" type="text" value="' + esc(rec.nf_numero || '') + '" /></label>' +
            '</div>' +
            '<div class="eng-grid2">' +
              '<label class="smerp-field"><span>Número do pedido</span><input id="eg_pedido" type="text" value="' + esc(rec.pedido_numero || '') + '" /></label>' +
              '<label class="smerp-field"><span>Local de entrega</span><input id="eg_local" type="text" value="' + esc(rec.local_entrega || '') + '" /></label>' +
            '</div>' +
          '</fieldset>' +

          '<div class="eng-grid3">' +
            '<label class="smerp-field"><span>Resp. pela análise crítica</span><input id="eg_resp" type="text" value="' + esc(rec.resp_analise || '') + '" /></label>' +
            '<label class="smerp-field"><span>Previsão</span><input id="eg_previsao" type="date" value="' + esc((rec.previsao || '').slice(0, 10)) + '" /></label>' +
            '<label class="smerp-field"><span>Realizado</span><input id="eg_realizado" type="date" value="' + esc((rec.realizado || '').slice(0, 10)) + '" /></label>' +
          '</div>' +

          '<label class="smerp-field"><span>Anexos (fotos / evidências)</span><input id="eg_anexos" type="file" accept="image/*,application/pdf" multiple /></label>' +
          (rec.anexos && rec.anexos.length ? '<p class="eng-hint">' + rec.anexos.length + ' anexo(s) já salvo(s).</p>' : '') +

          '<p class="smerp-login__error" id="engErr" hidden></p>' +
          '<p class="usr__ok" id="engOk" hidden></p>' +

          '<div class="eng-form__actions">' +
            '<button class="smerp-login__btn" id="engSave" type="submit">' + (editingId ? 'Salvar alterações' : 'Salvar e gerar nº + PDF') + '</button>' +
            (editingId ? '<button class="eng-btn-ghost" id="engNew" type="button">＋ Nova</button>' : '') +
          '</div>' +
        '</form>';

      if (!podeCriar) {
        // leitor: bloqueia edição (só consulta/baixa PDF na aba Registros)
        elForm.querySelectorAll('input,textarea,button').forEach(function (n) { n.disabled = true; });
        var hd = elForm.querySelector('.eng-form__hd');
        if (hd) hd.textContent = 'Seu acesso é de leitor — consulte os registros e baixe os PDFs na aba "Registros".';
      }

      var f = $('engForm');
      if (f) f.addEventListener('submit', onSave);
      var nb = $('engNew'); if (nb) nb.addEventListener('click', function () { renderForm(); });
    }

    function collectForm() {
      return {
        data: fval('eg_data') || undefined, // vazio -> deixa o default (current_date)
        emissor: fval('eg_emissor'),
        origem: getRadio('eg_origem'),
        onde: getChecks('eg_onde'), onde_outros: fval('eg_onde_outros') || null,
        cliente: fval('eg_cliente') || null, fornecedor: fval('eg_fornecedor') || null,
        produto: fval('eg_produto') || null, quantidade: fval('eg_qtd') || null,
        tipo_nc: getChecks('eg_tipo'), tipo_nc_outros: fval('eg_tipo_outros') || null, tipo_desc: fval('eg_tipo_desc') || null,
        causa: getChecks('eg_causa'), causa_outros: fval('eg_causa_outros') || null, causa_desc: fval('eg_causa_desc') || null,
        acao_imediata: getChecks('eg_acaoi'), acao_imediata_outros: fval('eg_acaoi_outros') || null,
        funcionario_resp: fval('eg_func') || null, funcionario_data: fval('eg_func_data') || null,
        numero_os: fval('eg_os') || null,
        acao_corretiva: getChecks('eg_corr'), acao_corretiva_outros: fval('eg_corr_outros') || null, acao_corretiva_desc: fval('eg_corr_desc') || null,
        rnc_ref: fval('eg_rnc') || null, nf_numero: fval('eg_nf') || null,
        pedido_numero: fval('eg_pedido') || null, local_entrega: fval('eg_local') || null,
        resp_analise: fval('eg_resp') || null,
        previsao: fval('eg_previsao') || null, realizado: fval('eg_realizado') || null
      };
    }

    async function uploadAnexos(recId) {
      var input = $('eg_anexos');
      if (!input || !input.files || !input.files.length) return null;
      var out = [];
      for (var i = 0; i < input.files.length; i++) {
        var file = input.files[i];
        var safe = file.name.replace(/[^\w.\-]+/g, '_');
        var path = recId + '/' + Date.now() + '-' + i + '-' + safe;
        var up = await sb.storage.from('engenharia-anexos').upload(path, file, { upsert: false });
        if (!up.error) out.push({ path: path, name: file.name });
      }
      return out;
    }

    async function onSave(e) {
      e.preventDefault();
      var err = $('engErr'), ok = $('engOk'), btn = $('engSave');
      err.hidden = true; ok.hidden = true;
      var data = collectForm();
      if (!data.origem) { err.textContent = 'Marque a origem (Interno ou Externo).'; err.hidden = false; return; }
      if (!data.tipo_nc.length && !data.tipo_nc_outros) { err.textContent = 'Marque ao menos um tipo de não conformidade.'; err.hidden = false; return; }

      btn.disabled = true; var prev = btn.textContent; btn.textContent = 'Salvando…';
      try {
        var row;
        if (editingId) {
          var ru = await db().from('assistencias').update(data).eq('id', editingId).select('*').single();
          if (ru.error) throw ru.error; row = ru.data;
        } else {
          var ri = await db().from('assistencias').insert(data).select('*').single();
          if (ri.error) throw ri.error; row = ri.data;
        }
        // anexos (depois do insert, sob o id do registro)
        var anex = await uploadAnexos(row.id);
        if (anex && anex.length) {
          var merged = (row.anexos || []).concat(anex);
          var ra = await db().from('assistencias').update({ anexos: merged }).eq('id', row.id).select('*').single();
          if (!ra.error) row = ra.data;
        }
        ok.textContent = 'Assistência ' + row.numero + ' salva!'; ok.hidden = false;
        // gera o PDF automaticamente para novas
        if (!editingId) gerarPdf(row);
        editingId = row.id;
        cache = []; // invalida a lista
      } catch (e2) {
        err.textContent = (e2 && e2.message) || 'Não foi possível salvar.'; err.hidden = false;
        console.error('[ENG] save', e2);
      } finally {
        btn.disabled = false; btn.textContent = prev;
      }
    }

    // ============================================================
    //  TELA 2 — REGISTROS + FILTROS
    // ============================================================
    function renderList() {
      elList.innerHTML =
        '<div class="eng-filters" id="engFilters">' +
          '<div class="eng-filters__row">' +
            '<label class="eng-f"><span>De</span><input type="date" id="ef_de" /></label>' +
            '<label class="eng-f"><span>Até</span><input type="date" id="ef_ate" /></label>' +
            '<label class="eng-f"><span>Origem</span><select id="ef_origem"><option value="">Todas</option><option value="interno">Interno</option><option value="externo">Externo</option></select></label>' +
            '<label class="eng-f"><span>Onde</span>' + selFromOpc('onde', 'ef_onde') + '</label>' +
            '<label class="eng-f"><span>Status</span><select id="ef_status"><option value="">Todos</option><option value="aberta">Aberta</option><option value="previsto">Previsto</option><option value="realizado">Realizado</option></select></label>' +
          '</div>' +
          '<div class="eng-filters__row">' +
            '<label class="eng-f eng-f--grow"><span>Cliente</span><input type="text" id="ef_cliente" placeholder="contém…" /></label>' +
            '<label class="eng-f eng-f--grow"><span>Fornecedor</span><input type="text" id="ef_fornecedor" placeholder="contém…" /></label>' +
            '<label class="eng-f"><span>Tipo de NC</span>' + selFromOpc('tipo_nc', 'ef_tipo') + '</label>' +
            '<label class="eng-f"><span>Causa</span>' + selFromOpc('causa', 'ef_causa') + '</label>' +
            '<label class="eng-f"><span>Ação imediata</span>' + selFromOpc('acao_imediata', 'ef_acaoi') + '</label>' +
          '</div>' +
          '<div class="eng-filters__actions">' +
            '<button class="eng-btn-ghost" id="ef_clear" type="button">Limpar filtros</button>' +
            '<span class="eng-count" id="ef_count"></span>' +
          '</div>' +
        '</div>' +
        '<div class="eng-list" id="engRows"><p class="usr__empty">Carregando…</p></div>';

      elList.querySelectorAll('#engFilters input, #engFilters select').forEach(function (n) {
        n.addEventListener('input', applyFilters);
        n.addEventListener('change', applyFilters);
      });
      $('ef_clear').addEventListener('click', function () {
        elList.querySelectorAll('#engFilters input').forEach(function (n) { n.value = ''; });
        elList.querySelectorAll('#engFilters select').forEach(function (n) { n.value = ''; });
        applyFilters();
      });
      loadRows();
    }
    function selFromOpc(group, id) {
      return '<select id="' + id + '"><option value="">Todos</option>' +
        (OPC[group] || []).map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('') +
        '</select>';
    }

    async function loadRows() {
      var box = $('engRows');
      if (!cache.length) {
        try {
          var res = await db().from('assistencias').select('*').order('data', { ascending: false }).order('created_at', { ascending: false });
          if (res.error) throw res.error;
          cache = res.data || [];
        } catch (e) {
          if (box) box.innerHTML = '<p class="usr__empty">Não foi possível carregar.</p>';
          console.error('[ENG] list', e); return;
        }
      }
      applyFilters();
    }

    function applyFilters() {
      var de = fval('ef_de'), ate = fval('ef_ate'), origem = fval('ef_origem'), status = fval('ef_status');
      var onde = fval('ef_onde'), tipo = fval('ef_tipo'), causa = fval('ef_causa'), acaoi = fval('ef_acaoi');
      var cli = fval('ef_cliente').toLowerCase(), forn = fval('ef_fornecedor').toLowerCase();
      var rows = cache.filter(function (r) {
        if (de && (r.data || '') < de) return false;
        if (ate && (r.data || '') > ate) return false;
        if (origem && r.origem !== origem) return false;
        if (status && statusOf(r).key !== status) return false;
        if (onde && (r.onde || []).indexOf(onde) === -1) return false;
        if (tipo && (r.tipo_nc || []).indexOf(tipo) === -1) return false;
        if (causa && (r.causa || []).indexOf(causa) === -1) return false;
        if (acaoi && (r.acao_imediata || []).indexOf(acaoi) === -1) return false;
        if (cli && (r.cliente || '').toLowerCase().indexOf(cli) === -1) return false;
        if (forn && (r.fornecedor || '').toLowerCase().indexOf(forn) === -1) return false;
        return true;
      });
      var cnt = $('ef_count'); if (cnt) cnt.textContent = rows.length + ' registro(s)';
      var box = $('engRows');
      if (!box) return;
      if (!rows.length) { box.innerHTML = '<p class="usr__empty">Nenhuma assistência com esses filtros.</p>'; return; }
      box.innerHTML = rows.map(rowHtml).join('');
      box.querySelectorAll('[data-open]').forEach(function (b) {
        b.addEventListener('click', function () { var r = byId(b.getAttribute('data-open')); if (r) { setTab('form'); renderForm(r); } });
      });
      box.querySelectorAll('[data-pdf]').forEach(function (b) {
        b.addEventListener('click', function () { var r = byId(b.getAttribute('data-pdf')); if (r) gerarPdf(r); });
      });
      box.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', function () { delRow(b.getAttribute('data-del')); });
      });
    }
    function byId(id) { for (var i = 0; i < cache.length; i++) if (cache[i].id === id) return cache[i]; return null; }

    function rowHtml(r) {
      var st = statusOf(r);
      var tags = labels('tipo_nc', r.tipo_nc).slice(0, 3).map(function (t) { return '<span class="eng-tag">' + esc(t) + '</span>'; }).join('');
      var alvo = r.cliente || r.fornecedor || '—';
      return '<div class="eng-row">' +
        '<div class="eng-row__main">' +
          '<div class="eng-row__top"><b class="eng-row__num">' + esc(r.numero || '—') + '</b>' +
            '<span class="eng-status" style="--c:' + st.cor + '">' + st.label + '</span>' +
            '<span class="eng-row__date">' + esc(fmtData(r.data)) + '</span>' +
            '<span class="eng-row__orig">' + esc(label('origem', r.origem)) + '</span>' +
          '</div>' +
          '<div class="eng-row__sub">' + esc(alvo) + (r.produto ? ' · ' + esc(r.produto) : '') + '</div>' +
          (tags ? '<div class="eng-row__tags">' + tags + '</div>' : '') +
        '</div>' +
        '<div class="eng-row__acts">' +
          '<button class="eng-btn-ghost" data-pdf="' + esc(r.id) + '" type="button">PDF</button>' +
          (podeCriar ? '<button class="eng-btn-ghost" data-open="' + esc(r.id) + '" type="button">Abrir</button>' : '') +
          (podeCriar ? '<button class="eng-btn-ghost eng-btn-del" data-del="' + esc(r.id) + '" type="button">Excluir</button>' : '') +
        '</div>' +
      '</div>';
    }

    async function delRow(id) {
      var r = byId(id);
      if (!confirm('Excluir a assistência ' + (r ? r.numero : '') + '? Essa ação não pode ser desfeita.')) return;
      try {
        var res = await db().from('assistencias').delete().eq('id', id);
        if (res.error) throw res.error;
        cache = cache.filter(function (x) { return x.id !== id; });
        applyFilters();
      } catch (e) { alert((e && e.message) || 'Não foi possível excluir.'); }
    }

    // ============================================================
    //  TELA 3 — DASHBOARD
    // ============================================================
    function renderDash() {
      elDash.innerHTML =
        '<div class="eng-dash__bar">' +
          '<label class="eng-f"><span>De</span><input type="date" id="ed_de" /></label>' +
          '<label class="eng-f"><span>Até</span><input type="date" id="ed_ate" /></label>' +
          '<button class="eng-btn-ghost" id="ed_go" type="button">Atualizar</button>' +
        '</div>' +
        '<div id="engDashBody"><p class="usr__empty">Carregando…</p></div>';
      $('ed_go').addEventListener('click', loadDash);
      loadDash();
    }

    async function loadDash() {
      var body = $('engDashBody');
      var de = fval('ed_de') || null, ate = fval('ed_ate') || null;
      body.innerHTML = '<p class="usr__empty">Carregando…</p>';
      try {
        var res = await db().rpc('dashboard', { _de: de, _ate: ate });
        if (res.error) throw res.error;
        body.innerHTML = dashHtml(res.data || {});
      } catch (e) {
        body.innerHTML = '<p class="usr__empty">Não foi possível carregar o dashboard.</p>';
        console.error('[ENG] dashboard', e);
      }
    }

    function rankBars(group, arr, accent) {
      arr = arr || [];
      if (!arr.length) return '<p class="eng-empty">Sem dados no período.</p>';
      var max = arr[0].n || 1;
      return '<div class="eng-bars">' + arr.map(function (it, i) {
        var pct = Math.max(6, Math.round((it.n / max) * 100));
        return '<div class="eng-bar' + (i === 0 ? ' is-top' : '') + '">' +
          '<span class="eng-bar__lbl">' + esc(label(group, it.chave)) + '</span>' +
          '<span class="eng-bar__track"><span class="eng-bar__fill" style="width:' + pct + '%;background:' + accent + '"></span></span>' +
          '<span class="eng-bar__n">' + it.n + '</span>' +
        '</div>';
      }).join('') + '</div>';
    }
    function topLine(group, arr) {
      if (!arr || !arr.length) return '—';
      return esc(label(group, arr[0].chave)) + ' <b>(' + arr[0].n + ')</b>';
    }

    function dashHtml(d) {
      var kpis = [
        ['Total de assistências', d.total || 0, '#E8722A'],
        ['Interno', d.interno || 0, '#2E78D2'],
        ['Externo', d.externo || 0, '#8B5CF6'],
        ['Concluídas (realizado)', d.concluidas || 0, '#1F9D55']
      ];
      var mesMax = (d.por_mes || []).reduce(function (m, x) { return Math.max(m, x.n); }, 1);
      return '' +
        '<div class="eng-kpis">' + kpis.map(function (k) {
          return '<div class="eng-kpi" style="--c:' + k[2] + '"><span class="eng-kpi__n">' + k[1] + '</span><span class="eng-kpi__l">' + esc(k[0]) + '</span></div>';
        }).join('') + '</div>' +

        '<div class="eng-highlight">' +
          '<div class="eng-hl"><span class="eng-hl__t">Tipo que mais saiu</span><span class="eng-hl__v">' + topLine('tipo_nc', d.tipo_nc) + '</span></div>' +
          '<div class="eng-hl"><span class="eng-hl__t">Causa que mais saiu</span><span class="eng-hl__v">' + topLine('causa', d.causa) + '</span></div>' +
          '<div class="eng-hl"><span class="eng-hl__t">Ação imediata mais usada</span><span class="eng-hl__v">' + topLine('acao_imediata', d.acao_imediata) + '</span></div>' +
        '</div>' +

        '<div class="eng-grid2">' +
          '<section class="eng-card"><h4>Tipo de Não Conformidade</h4>' + rankBars('tipo_nc', d.tipo_nc, '#E8722A') + '</section>' +
          '<section class="eng-card"><h4>Causa da Não Conformidade</h4>' + rankBars('causa', d.causa, '#2E78D2') + '</section>' +
        '</div>' +
        '<div class="eng-grid2">' +
          '<section class="eng-card"><h4>Ação Imediata</h4>' + rankBars('acao_imediata', d.acao_imediata, '#1F9D55') + '</section>' +
          '<section class="eng-card"><h4>Ação Corretiva</h4>' + rankBars('acao_corretiva', d.acao_corretiva, '#8B5CF6') + '</section>' +
        '</div>' +

        '<section class="eng-card"><h4>Assistências por mês</h4>' +
          ((d.por_mes && d.por_mes.length) ? '<div class="eng-months">' + d.por_mes.map(function (m) {
            var h = Math.max(8, Math.round((m.n / mesMax) * 100));
            return '<div class="eng-month"><span class="eng-month__bar" style="height:' + h + '%"></span><span class="eng-month__n">' + m.n + '</span><span class="eng-month__l">' + esc(m.mes) + '</span></div>';
          }).join('') + '</div>' : '<p class="eng-empty">Sem dados no período.</p>') +
        '</section>' +

        '<section class="eng-card"><h4>Top clientes</h4>' +
          ((d.por_cliente && d.por_cliente.length) ? '<div class="eng-bars">' + d.por_cliente.map(function (c, i) {
            var mx = d.por_cliente[0].n || 1, pct = Math.max(6, Math.round((c.n / mx) * 100));
            return '<div class="eng-bar"><span class="eng-bar__lbl">' + esc(c.nome) + '</span><span class="eng-bar__track"><span class="eng-bar__fill" style="width:' + pct + '%;background:#0891B2"></span></span><span class="eng-bar__n">' + c.n + '</span></div>';
          }).join('') + '</div>' : '<p class="eng-empty">Sem dados no período.</p>') +
        '</section>';
    }

    // ============================================================
    //  PDF — réplica do Relatório de Não Conformidade
    // ============================================================
    function box(on) { return on ? '☑' : '☐'; }
    function checklist(group, sel, outros) {
      sel = sel || [];
      var items = (OPC[group] || []).map(function (o) {
        if (o[0] === 'outros') {
          return '<span class="pchk">' + box(sel.indexOf('outros') !== -1 || !!outros) + ' Outros: ' + esc(outros || '____') + '</span>';
        }
        return '<span class="pchk">' + box(sel.indexOf(o[0]) !== -1) + ' ' + esc(o[1]) + '</span>';
      });
      return '<div class="pchks">' + items.join('') + '</div>';
    }

    function buildRncHtml(r) {
      return '' +
      '<div class="pdoc">' +
        '<table class="pt phead"><tr>' +
          '<td class="plogo"><img src="assets/logo-solucao-moveis.png" alt="" /></td>' +
          '<td class="ptitle">RELATÓRIO DE NÃO CONFORMIDADE</td>' +
          '<td class="pnum"><div><b>Número:</b> ' + esc(r.numero || '') + '</div><div><b>Data:</b> ' + esc(fmtData(r.data)) + '</div></td>' +
        '</tr></table>' +

        '<table class="pt"><tr><td class="plbl">1 · Emissor do registro</td><td class="pval" colspan="3">' + esc(r.emissor || '') + '</td></tr>' +
        '<tr><td class="plbl">2 · Origem</td><td class="pval" colspan="3">' + box(r.origem === 'interno') + ' Interno&nbsp;&nbsp;&nbsp;' + box(r.origem === 'externo') + ' Externo</td></tr>' +
        '<tr><td class="plbl">3 · Onde?</td><td class="pval" colspan="3">' +
          box((r.onde || []).indexOf('produto') !== -1) + ' Produto&nbsp;&nbsp;' +
          box((r.onde || []).indexOf('cliente') !== -1) + ' Cliente&nbsp;&nbsp;' +
          box((r.onde || []).indexOf('fornecedor') !== -1) + ' Fornecedor&nbsp;&nbsp;' +
          box((r.onde || []).indexOf('outros') !== -1 || !!r.onde_outros) + ' Outros: ' + esc(r.onde_outros || '____') + '</td></tr>' +
        '<tr><td class="plbl">4 · Cliente</td><td class="pval">' + esc(r.cliente || '') + '</td><td class="plbl">5 · Fornecedor</td><td class="pval">' + esc(r.fornecedor || '') + '</td></tr>' +
        '<tr><td class="plbl">6 · Produto/processo não conforme</td><td class="pval" colspan="3">' + esc(r.produto || '') + (r.quantidade ? ' &nbsp;|&nbsp; Qtd: ' + esc(r.quantidade) : '') + '</td></tr>' +
        '</table>' +

        '<table class="pt"><tr><td class="psec" colspan="2">7 · Tipo de Não Conformidade</td></tr>' +
          '<tr><td class="pcol">' + checklist('tipo_nc', r.tipo_nc, r.tipo_nc_outros) + '</td>' +
              '<td class="pcol"><b>Descrição:</b><br/>' + esc(r.tipo_desc || '') + '</td></tr></table>' +

        '<table class="pt"><tr><td class="psec" colspan="2">8 · Causa da Não Conformidade</td></tr>' +
          '<tr><td class="pcol">' + checklist('causa', r.causa, r.causa_outros) + '</td>' +
              '<td class="pcol"><b>Descrição:</b><br/>' + esc(r.causa_desc || '') + '</td></tr></table>' +

        '<table class="pt"><tr><td class="psec" colspan="2">9 · Ação Imediata &nbsp;|&nbsp; 10 · Responsável pelo tratamento</td></tr>' +
          '<tr><td class="pcol">' + checklist('acao_imediata', r.acao_imediata, r.acao_imediata_outros) + '</td>' +
              '<td class="pcol"><b>Nome:</b> ' + esc(r.funcionario_resp || '') + '<br/><b>Data:</b> ' + esc(fmtData(r.funcionario_data)) + '<br/><b>11 · Nº OS:</b> ' + esc(r.numero_os || '') + '</td></tr></table>' +

        '<table class="pt"><tr><td class="psec">Ação Corretiva</td></tr>' +
          '<tr><td class="pcol">' + checklist('acao_corretiva', r.acao_corretiva, r.acao_corretiva_outros) +
            '<div class="pdesc"><b>Descrever:</b> ' + esc(r.acao_corretiva_desc || '') + '</div></td></tr></table>' +

        '<table class="pt"><tr><td class="psec" colspan="4">Observação da assistência</td></tr>' +
          '<tr><td class="plbl">N° RNC</td><td class="pval">' + esc(r.rnc_ref || '') + '</td><td class="plbl">Número da NF</td><td class="pval">' + esc(r.nf_numero || '') + '</td></tr>' +
          '<tr><td class="plbl">Número do pedido</td><td class="pval">' + esc(r.pedido_numero || '') + '</td><td class="plbl">Local de entrega</td><td class="pval">' + esc(r.local_entrega || '') + '</td></tr>' +
          '<tr><td class="plbl">Resp. análise crítica</td><td class="pval">' + esc(r.resp_analise || '') + '</td><td class="plbl">Previsão / Realizado</td><td class="pval">' + esc(fmtData(r.previsao)) + ' / ' + esc(fmtData(r.realizado)) + '</td></tr>' +
        '</table>' +
      '</div>';
    }

    function gerarPdf(r) {
      if (!window.html2pdf) { alert('Gerador de PDF ainda carregando — tente de novo em 1s.'); return; }
      pdfStage.innerHTML = '<div class="pdf-wrap">' + buildRncHtml(r) + '</div>';
      var el = pdfStage.querySelector('.pdf-wrap');
      window.html2pdf().set({
        margin: [8, 8, 8, 8],
        filename: (r.numero || 'assistencia').replace(/[\/\\]/g, '-') + '.pdf',
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#2f2f2f' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      }).from(el).save().then(function () { pdfStage.innerHTML = ''; });
    }

    // ============================================================
    //  Abas + abrir/fechar
    // ============================================================
    function setTab(tab) {
      overlay.querySelectorAll('.eng__tab').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-tab') === tab); });
      elForm.hidden = tab !== 'form'; elList.hidden = tab !== 'list'; elDash.hidden = tab !== 'dash';
      if (tab === 'form' && !elForm.innerHTML) renderForm();
      if (tab === 'list') renderList();
      if (tab === 'dash') renderDash();
    }
    overlay.querySelectorAll('.eng__tab').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    });

    function open() {
      overlay.hidden = false;
      requestAnimationFrame(function () { overlay.classList.add('is-open'); });
      setTab(podeCriar ? 'form' : 'list'); // leitor abre direto nos Registros
    }
    function close() { overlay.classList.remove('is-open'); setTimeout(function () { overlay.hidden = true; }, 200); }

    navBtn.addEventListener('click', open);
    overlay.querySelectorAll('[data-close]').forEach(function (el) { el.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) close(); });

    // ============================================================
    //  Gate: mostra a aba só p/ quem tem acesso ao módulo
    // ============================================================
    async function gate() {
      try {
        var res = await sb.rpc('my_systems');
        var sys = (!res.error && res.data) || {};
        var roles = sys.engenharia; // array de papéis, ou undefined
        var has = Array.isArray(roles);
        podeCriar = has && roles.indexOf('criador') !== -1;
        navBtn.hidden = !has;
      } catch (e) { navBtn.hidden = true; }
    }

    return { gate: gate, hide: function () { navBtn.hidden = true; close(); } };
  }

  return { init: init };
})();
