/* ============================================================
   Solução Móveis — Landing "Editorial Craft" · interações
   ============================================================ */

/* ---- CONFIG: número do WhatsApp (só dígitos, com DDI 55) ---- */
const WHATSAPP = '5531998108836'; // (31) 99810-8836 — confirmar se é o WhatsApp oficial

/* ---- ano no rodapé ---- */
document.getElementById('year').textContent = new Date().getFullYear();

/* ---- barra de progresso de scroll ---- */
const bar = document.getElementById('scrollbar');
const onProgress = () => {
  const h = document.documentElement;
  const max = h.scrollHeight - h.clientHeight;
  bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
};

/* ---- nav: estado rolado ---- */
const nav = document.getElementById('nav');
const onScroll = () => {
  nav.classList.toggle('is-scrolled', window.scrollY > 40);
  onProgress();
};
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

/* ---- menu mobile ---- */
const burger = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');
burger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('is-open');
  burger.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
});
navLinks.querySelectorAll('a').forEach((a) =>
  a.addEventListener('click', () => {
    navLinks.classList.remove('is-open');
    burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  })
);

/* ---- reveal on scroll ---- */
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }),
  { threshold: 0.12 }
);
document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.transitionDelay = `${Math.min(i % 5, 4) * 60}ms`;
  io.observe(el);
});

/* ---- hero: crossfade + dots ---- */
const heroBgs = [...document.querySelectorAll('.hero__bg')];
const heroDots = document.getElementById('heroDots');
if (heroBgs.length > 1) {
  let cur = 0;
  const dots = heroBgs.map((_, i) => {
    const b = document.createElement('button');
    if (i === 0) b.classList.add('is-on');
    b.addEventListener('click', () => go(i));
    heroDots.appendChild(b);
    return b;
  });
  const go = (i) => {
    heroBgs[cur].classList.remove('is-on');
    dots[cur].classList.remove('is-on');
    cur = i;
    heroBgs[cur].classList.add('is-on');
    dots[cur].classList.add('is-on');
  };
  let timer = setInterval(() => go((cur + 1) % heroBgs.length), 5500);
  heroDots.addEventListener('click', () => { clearInterval(timer); timer = setInterval(() => go((cur + 1) % heroBgs.length), 5500); });
}

/* ---- carrossel genérico (setas + arrastar) ---- */
function initCarousel(root) {
  const track = root.querySelector('[data-track]');
  if (!track) return null;
  const prev = root.querySelector('[data-prev]');
  const next = root.querySelector('[data-next]');

  const step = () => {
    const first = [...track.children].find((c) => !c.classList.contains('is-hidden'));
    if (!first) return track.clientWidth * 0.8;
    const gap = parseFloat(getComputedStyle(track).gap) || 24;
    return first.getBoundingClientRect().width + gap;
  };
  const update = () => {
    const max = track.scrollWidth - track.clientWidth - 2;
    if (prev) prev.toggleAttribute('disabled', track.scrollLeft <= 2);
    if (next) next.toggleAttribute('disabled', track.scrollLeft >= max);
  };
  prev && prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next && next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  track.addEventListener('scroll', update, { passive: true });

  /* arrastar pra rolar */
  let down = false, sx = 0, sl = 0, moved = false;
  track.addEventListener('pointerdown', (e) => {
    down = true; moved = false; sx = e.clientX; sl = track.scrollLeft;
    track.classList.add('is-grab'); track.setPointerCapture(e.pointerId);
  });
  track.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 5) moved = true;
    track.scrollLeft = sl - dx;
  });
  const end = () => { down = false; track.classList.remove('is-grab'); };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  track.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);

  update();
  window.addEventListener('resize', update, { passive: true });
  return { update, track };
}
const carousels = [...document.querySelectorAll('[data-carousel]')].map(initCarousel).filter(Boolean);

/* ---- filtro de produtos por nível ---- */
const filtro = document.getElementById('filtro');
if (filtro) {
  const botoes = filtro.querySelectorAll('.filtro__btn');
  const grid = document.getElementById('produtosGrid');
  const cards = grid.querySelectorAll('.card');
  const car = carousels.find((c) => c.track === grid);
  filtro.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.filtro__btn');
    if (!btn) return;
    botoes.forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', String(b === btn));
    });
    const seg = btn.dataset.seg;
    cards.forEach((c) => {
      const show = seg === 'todos' || (c.dataset.seg || '').split(' ').includes(seg);
      c.classList.toggle('is-hidden', !show);
    });
    grid.scrollTo({ left: 0, behavior: 'smooth' });
    car && car.update();
  });
}

/* ---- clipes de produção: tocam quando visíveis, pausam fora ---- */
const clips = document.querySelectorAll('.clip video');
if (clips.length) {
  const vio = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause();
  }), { threshold: 0.35 });
  clips.forEach((v) => vio.observe(v));
}

/* ---- loop infinito do ticker e do marquee (duplica o conteúdo) ---- */
['ticker', 'marquee'].forEach((id) => {
  const row = document.getElementById(id);
  if (row) row.innerHTML += row.innerHTML;
});

/* ---- formulário -> WhatsApp ---- */
const form = document.getElementById('form');
if (form) form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const d = new FormData(form);
  const txt =
    `*Trabalhe conosco — Solução Móveis*%0A` +
    `Nome: ${encodeURIComponent(d.get('nome') || '')}%0A` +
    `Telefone: ${encodeURIComponent(d.get('fone') || '')}%0A` +
    `Área de interesse: ${encodeURIComponent(d.get('area') || '')}%0A` +
    `Sobre: ${encodeURIComponent(d.get('msg') || '')}`;
  window.open(`https://wa.me/${WHATSAPP}?text=${txt}`, '_blank', 'noopener');
});
