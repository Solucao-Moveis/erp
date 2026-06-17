/* Solução Móveis — Modelo B · interações */
document.getElementById('year').textContent = new Date().getFullYear();

/* progresso + nav scrolled */
const bar = document.getElementById('scrollbar');
const nav = document.getElementById('nav');
const onScroll = () => {
  const h = document.documentElement, max = h.scrollHeight - h.clientHeight;
  bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
  nav.classList.toggle('is-scrolled', window.scrollY > 30);
};
onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

/* menu mobile */
const burger = document.getElementById('burger'), navLinks = document.getElementById('navLinks');
burger.addEventListener('click', () => { burger.classList.toggle('is-open'); navLinks.classList.toggle('is-open'); });
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('is-open')));

/* reveal */
const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: .12 });
document.querySelectorAll('.sec, .stats, .cta-band').forEach(el => { el.classList.add('reveal'); io.observe(el); });

/* count-up nos números */
const fmt = (n) => n.toLocaleString('pt-BR');
const countUp = (el) => {
  if (el.hasAttribute('data-raw')) return;            // ex.: 2016 (ano) — não anima
  const target = parseInt(el.dataset.count, 10), suf = el.dataset.suffix || '';
  const dur = 1300; let start = null;
  const tick = (t) => { if (!start) start = t; const p = Math.min((t - start) / dur, 1);
    el.textContent = (el.dataset.suffix === '+' ? '+' : '') + fmt(Math.floor(p * target)) + (suf === '+' ? '' : suf);
    if (p < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
};
const io2 = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { countUp(e.target); io2.unobserve(e.target); } }), { threshold: .5 });
document.querySelectorAll('.stat strong[data-count]').forEach(el => io2.observe(el));

/* clipes de produção: tocam quando visíveis, pausam fora (economiza dados) */
const clips = document.querySelectorAll('.clip video');
if (clips.length) {
  const vio = new IntersectionObserver((es) => es.forEach(e => {
    if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause();
  }), { threshold: .35 });
  clips.forEach(v => vio.observe(v));
}
