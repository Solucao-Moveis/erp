/* ============================================================
   SMERP — Assistente de IA (widget do Hub).
   ------------------------------------------------------------
   Autocontido: injeta seu próprio visual e compartilha o login
   do Hub (mesmo storageKey). Só aparece pra quem o master liberou
   (RPC public.can_use_assistant). Fala com o serviço ai-service.
   Voz: usa o reconhecimento de fala do navegador (fala -> texto).
   ============================================================ */
(function () {
  'use strict';
  var CFG = window.SMERP_CONFIG || {};
  if (!CFG.AI_SERVICE_URL || !window.supabase) return;

  // Cliente próprio, mas compartilhando a sessão do Hub (mesmo storageKey).
  var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { storageKey: CFG.STORAGE_KEY, persistSession: true, autoRefreshToken: true }
  });

  var messages = [];   // histórico { role:'user'|'assistant', content }
  var open = false;
  var sending = false;
  var built = false;
  var els = {};

  // ---------- estilos ----------
  function injectStyles() {
    var css = ''
      + '.ai-fab{position:fixed;right:20px;bottom:20px;z-index:9000;width:58px;height:58px;border-radius:50%;border:none;cursor:pointer;'
      + 'background:linear-gradient(135deg,#E8722A,#f0913f);color:#fff;box-shadow:0 8px 24px rgba(232,114,42,.45);display:flex;align-items:center;justify-content:center;transition:transform .15s}'
      + '.ai-fab:hover{transform:scale(1.06)}.ai-fab svg{width:26px;height:26px}'
      + '.ai-panel{position:fixed;right:20px;bottom:90px;z-index:9001;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 130px);'
      + 'background:#fff;border-radius:18px;box-shadow:0 16px 50px rgba(0,0,0,.22);display:none;flex-direction:column;overflow:hidden;font-family:Inter,system-ui,sans-serif}'
      + '.ai-panel.is-open{display:flex}'
      + '.ai-hd{background:linear-gradient(135deg,#E8722A,#f0913f);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}'
      + '.ai-hd b{font-size:15px;font-weight:700}.ai-hd small{display:block;font-size:11px;opacity:.9;font-weight:500}'
      + '.ai-hd .ai-x{margin-left:auto;background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:18px;line-height:1}'
      + '.ai-body{flex:1;overflow-y:auto;padding:16px;background:#f7f7f8;display:flex;flex-direction:column;gap:10px}'
      + '.ai-msg{max-width:85%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}'
      + '.ai-msg.user{align-self:flex-end;background:#E8722A;color:#fff;border-bottom-right-radius:4px}'
      + '.ai-msg.bot{align-self:flex-start;background:#fff;color:#222;border:1px solid #ececec;border-bottom-left-radius:4px}'
      + '.ai-msg.typing{color:#999;font-style:italic}'
      + '.ai-foot{padding:10px;border-top:1px solid #eee;background:#fff;display:flex;gap:8px;align-items:flex-end}'
      + '.ai-foot textarea{flex:1;resize:none;border:1px solid #ddd;border-radius:12px;padding:10px 12px;font-size:14px;font-family:inherit;max-height:90px;outline:none}'
      + '.ai-foot textarea:focus{border-color:#E8722A}'
      + '.ai-btn{border:none;border-radius:12px;cursor:pointer;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}'
      + '.ai-send{background:#E8722A;color:#fff}.ai-send:disabled{opacity:.5;cursor:default}'
      + '.ai-mic{background:#f0f0f0;color:#555}.ai-mic.rec{background:#DC2626;color:#fff;animation:aipulse 1s infinite}'
      + '.ai-btn svg{width:20px;height:20px}'
      + '@keyframes aipulse{0%,100%{opacity:1}50%{opacity:.55}}'
      + '@media(max-width:480px){.ai-panel{right:8px;left:8px;width:auto;bottom:84px}}';
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  }

  // ---------- montagem do DOM ----------
  function build() {
    if (built) return; built = true;
    injectStyles();

    var fab = document.createElement('button');
    fab.className = 'ai-fab'; fab.type = 'button'; fab.title = 'Assistente';
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
    fab.addEventListener('click', toggle);

    var panel = document.createElement('div');
    panel.className = 'ai-panel';
    panel.innerHTML =
      '<div class="ai-hd"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.9 5.8L20 8l-4.7 3.6L17 18l-5-3.4L7 18l1.7-6.4L4 8l6.1-.2z"/></svg>'
      + '<div><b>Assistente SMERP</b><small>Posso abrir solicitações e responder dúvidas</small></div>'
      + '<button class="ai-x" type="button" title="Fechar">&times;</button></div>'
      + '<div class="ai-body" id="aiBody"></div>'
      + '<div class="ai-foot">'
      + '<button class="ai-btn ai-mic" id="aiMic" type="button" title="Falar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg></button>'
      + '<textarea id="aiInput" rows="1" placeholder="Escreva ou fale..."></textarea>'
      + '<button class="ai-btn ai-send" id="aiSend" type="button" title="Enviar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button>'
      + '</div>';

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    els.fab = fab; els.panel = panel;
    els.body = panel.querySelector('#aiBody');
    els.input = panel.querySelector('#aiInput');
    els.send = panel.querySelector('#aiSend');
    els.mic = panel.querySelector('#aiMic');
    panel.querySelector('.ai-x').addEventListener('click', toggle);
    els.send.addEventListener('click', send);
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    els.input.addEventListener('input', function () {
      els.input.style.height = 'auto'; els.input.style.height = Math.min(els.input.scrollHeight, 90) + 'px';
    });
    setupMic();
  }

  function toggle() {
    open = !open;
    els.panel.classList.toggle('is-open', open);
    if (open) {
      if (!messages.length) addBot('Oi! 👋 Sou o assistente do SMERP. Posso abrir uma solicitação de compra pra você ou tirar dúvidas. O que você precisa?');
      els.input.focus();
    }
  }

  function addMsg(text, who) {
    var d = document.createElement('div');
    d.className = 'ai-msg ' + who; d.textContent = text;
    els.body.appendChild(d); els.body.scrollTop = els.body.scrollHeight;
    return d;
  }
  function addUser(t) { addMsg(t, 'user'); }
  function addBot(t) { addMsg(t, 'bot'); }

  // ---------- enviar pro serviço ----------
  async function send() {
    var text = (els.input.value || '').trim();
    if (!text || sending) return;
    els.input.value = ''; els.input.style.height = 'auto';
    addUser(text);
    messages.push({ role: 'user', content: text });

    sending = true; els.send.disabled = true;
    var typing = addMsg('digitando…', 'bot typing');

    try {
      var ses = (await sb.auth.getSession()).data.session;
      if (!ses) { typing.remove(); addBot('Você precisa estar logado no Hub.'); return; }

      var r = await fetch(CFG.AI_SERVICE_URL.replace(/\/$/, '') + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: ses.access_token, messages: messages })
      });
      var data = await r.json().catch(function () { return {}; });
      typing.remove();
      var reply = data.reply || 'Não consegui responder agora. Tente de novo.';
      addBot(reply);
      messages.push({ role: 'assistant', content: reply });
    } catch (e) {
      typing.remove();
      addBot('Tive um problema de conexão. Tente de novo em instantes.');
    } finally {
      sending = false; els.send.disabled = false; els.input.focus();
    }
  }

  // ---------- microfone (fala -> texto, via navegador) ----------
  function setupMic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { els.mic.style.display = 'none'; return; }   // navegador sem suporte: esconde
    var rec = new SR();
    rec.lang = 'pt-BR'; rec.interimResults = false; rec.maxAlternatives = 1;
    var listening = false;

    rec.onresult = function (ev) {
      var t = ev.results[0][0].transcript;
      els.input.value = (els.input.value ? els.input.value + ' ' : '') + t;
      els.input.dispatchEvent(new Event('input'));
    };
    rec.onend = function () { listening = false; els.mic.classList.remove('rec'); };
    rec.onerror = function () { listening = false; els.mic.classList.remove('rec'); };

    els.mic.addEventListener('click', function () {
      if (listening) { rec.stop(); return; }
      try { rec.start(); listening = true; els.mic.classList.add('rec'); els.input.focus(); }
      catch (e) { /* já rodando */ }
    });
  }

  // ---------- gate: só mostra pra quem o master liberou ----------
  async function maybeShow() {
    try {
      var ses = (await sb.auth.getSession()).data.session;
      if (!ses) { if (els.fab) els.fab.style.display = 'none'; return; }
      var res = await sb.rpc('can_use_assistant');
      var allowed = !res.error && res.data === true;
      if (allowed) { build(); els.fab.style.display = 'flex'; }
      else if (els.fab) els.fab.style.display = 'none';
    } catch (e) { /* silencioso */ }
  }

  // Reage ao login/logout do Hub.
  sb.auth.onAuthStateChange(function () { maybeShow(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeShow);
  else maybeShow();
})();
