/* ============================================================
   SMERP — Tema (claro/escuro).
   ------------------------------------------------------------
   Carregado CEDO no <head> pra aplicar a classe .dark no <html>
   ANTES da pintura (sem flash branco). Guarda a escolha em
   localStorage['smerp-theme']; sem escolha, segue o sistema.
   Expõe window.SMERPTheme = { get, set, toggle }.
   ============================================================ */
(function () {
  var KEY = 'smerp-theme';
  function system() {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function current() { return stored() || system(); }
  function apply(t) {
    var d = document.documentElement;
    if (t === 'dark') d.classList.add('dark'); else d.classList.remove('dark');
  }

  apply(current());   // aplica já (antes do body renderizar)

  function set(t) {
    t = (t === 'dark') ? 'dark' : 'light';
    try { localStorage.setItem(KEY, t); } catch (e) {}
    apply(t);
    return t;
  }
  function toggle() { return set(current() === 'dark' ? 'light' : 'dark'); }

  window.SMERPTheme = { get: current, set: set, toggle: toggle };

  // Se a pessoa ainda não escolheu manualmente, acompanha o tema do sistema ao vivo.
  try {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', function () { if (!stored()) apply(system()); });
  } catch (e) {}

  // Liga o botão sol/lua quando o DOM existir.
  function wire() {
    var btn = document.getElementById('themeToggle');
    if (btn && !btn.__wired) { btn.__wired = true; btn.addEventListener('click', toggle); }
  }
  if (document.readyState !== 'loading') wire();
  else document.addEventListener('DOMContentLoaded', wire);
})();
