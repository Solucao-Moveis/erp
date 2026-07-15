/* ============================================================
   SMERP — Menu mobile (gaveta / off-canvas).
   ADITIVO: no celular, a barra lateral vira uma gaveta aberta
   pelo hambúrguer (☰) do topo. No desktop nada disto roda
   (o topo mobile fica escondido por CSS). Não altera o script.js.
   ============================================================ */
(function () {
  var toggle = document.getElementById('navToggle');
  var backdrop = document.getElementById('navBackdrop');
  var side = document.querySelector('.side');
  if (!toggle || !side) return;

  function isOpen() { return document.body.classList.contains('nav-open'); }
  function open() {
    document.body.classList.add('nav-open');
    toggle.setAttribute('aria-expanded', 'true');
  }
  function close() {
    document.body.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', function () { isOpen() ? close() : open(); });
  if (backdrop) backdrop.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  // Fecha a gaveta ao tocar em qualquer item de navegação (inclui os
  // sistemas, que são inseridos pelo script.js depois — por isso usamos
  // delegação de evento no contêiner .side).
  side.addEventListener('click', function (e) {
    if (e.target.closest('.nav, .sys, .nav--sys, .side__brand')) close();
  });

  // Recolher/expandir a barra lateral no DESKTOP (persistente em smerp-side).
  // O estado já é aplicado cedo pelo theme.js (html.side-collapsed) — aqui só o clique.
  var collapseBtn = document.getElementById('sideCollapse');
  if (collapseBtn) {
    var syncTitle = function () {
      var c = document.documentElement.classList.contains('side-collapsed');
      collapseBtn.setAttribute('title', c ? 'Expandir menu' : 'Recolher menu');
      collapseBtn.setAttribute('aria-label', c ? 'Expandir menu' : 'Recolher menu');
    };
    syncTitle();
    collapseBtn.addEventListener('click', function () {
      var c = document.documentElement.classList.toggle('side-collapsed');
      try { localStorage.setItem('smerp-side', c ? 'collapsed' : 'expanded'); } catch (e) {}
      syncTitle();
    });
  }

  // Espelha o aviso de "Desenvolvimento" ([data-badge-for="inovacao"]) num
  // pontinho vermelho no hambúrguer, pra a pessoa ver que há novidade sem
  // abrir a gaveta. O badge é injetado pelo script.js depois do login —
  // por isso observa o container (delegação), não o elemento em si.
  var dot = document.getElementById('navDot');
  var sideEl = document.querySelector('.side');
  if (dot && sideEl) {
    var sync = function () {
      var b = sideEl.querySelector('[data-badge-for="inovacao"]');
      dot.hidden = !b || b.hidden;
    };
    sync();
    try {
      new MutationObserver(sync).observe(sideEl, { attributes: true, attributeFilter: ['hidden'], subtree: true, childList: true });
    } catch (e) { /* navegador sem MutationObserver: ignora */ }
  }
})();
