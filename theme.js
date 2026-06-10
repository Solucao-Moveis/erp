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
  // Padrão = CLARO. A pessoa troca no botão sol/lua e fica salvo no aparelho.
  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function current() { return stored() || 'light'; }
  function apply(t) {
    var d = document.documentElement;
    if (t === 'dark') d.classList.add('dark'); else d.classList.remove('dark');
  }

  apply(current());   // aplica já (antes do body renderizar)

  // Estado recolhido da barra lateral (desktop) — aplica cedo no <html> p/ não dar flash.
  try { if (localStorage.getItem('smerp-side') === 'collapsed') document.documentElement.classList.add('side-collapsed'); } catch (e) {}

  function set(t) {
    t = (t === 'dark') ? 'dark' : 'light';
    try { localStorage.setItem(KEY, t); } catch (e) {}
    apply(t);
    return t;
  }
  function toggle() { return set(current() === 'dark' ? 'light' : 'dark'); }

  window.SMERPTheme = { get: current, set: set, toggle: toggle };

  // Liga o botão sol/lua quando o DOM existir.
  function wire() {
    var btn = document.getElementById('themeToggle');
    if (btn && !btn.__wired) { btn.__wired = true; btn.addEventListener('click', toggle); }
  }
  if (document.readyState !== 'loading') wire();
  else document.addEventListener('DOMContentLoaded', wire);
})();
