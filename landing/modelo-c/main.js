/* Solução Móveis — Modelo C · interações */
document.getElementById('year').textContent = new Date().getFullYear();

const bar = document.getElementById('scrollbar');
const nav = document.getElementById('nav');
const onScroll = () => {
  const h = document.documentElement, max = h.scrollHeight - h.clientHeight;
  bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
  nav.classList.toggle('is-scrolled', window.scrollY > 30);
};
onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

const burger = document.getElementById('burger'), navLinks = document.getElementById('navLinks');
burger.addEventListener('click', () => { burger.classList.toggle('is-open'); navLinks.classList.toggle('is-open'); });
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('is-open')));

/* reveal em cascata */
const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: .14 });
document.querySelectorAll('.reveal').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`; io.observe(el); });

/* clipes de produção: tocam quando visíveis, pausam fora */
const clips = document.querySelectorAll('.clip video');
if (clips.length) {
  const vio = new IntersectionObserver((es) => es.forEach(e => {
    if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause();
  }), { threshold: .35 });
  clips.forEach(v => vio.observe(v));
}
