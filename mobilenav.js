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

  // Espelha o aviso de "Solicitações" (#solBadge) num pontinho vermelho
  // no hambúrguer, pra a pessoa ver que há novidade sem abrir a gaveta.
  var solBadge = document.getElementById('solBadge');
  var dot = document.getElementById('navDot');
  if (solBadge && dot) {
    var sync = function () { dot.hidden = solBadge.hidden; };
    sync();
    try {
      new MutationObserver(sync).observe(solBadge, { attributes: true, attributeFilter: ['hidden'] });
    } catch (e) { /* navegador sem MutationObserver: ignora */ }
  }
})();
