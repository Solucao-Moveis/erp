/* ============================================================
   SMERP — interações da Página Principal
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

    // Fecha o menu ao clicar em um link
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
})();
