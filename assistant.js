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
  var voiceOn = false; // Sila falar as respostas (TTS)
  var ttsVoice = null; // voz pt-BR escolhida
  var els = {};

  // ---------- estilos ----------
  function injectStyles() {
    var css = ''
      + '.ai-fab{position:fixed;right:20px;bottom:20px;z-index:9000;width:62px;height:62px;border-radius:50%;border:2px solid #fff;cursor:pointer;'
      + 'background:#fff;box-shadow:0 8px 24px rgba(232,114,42,.5);display:flex;align-items:center;justify-content:center;transition:transform .15s;overflow:hidden;padding:0}'
      + '.ai-fab:hover{transform:scale(1.07)}.ai-fab img{width:100%;height:100%;object-fit:cover}'
      + '.ai-hd-logo{width:30px;height:30px;border-radius:8px;object-fit:cover;flex:0 0 auto;background:#fff}'
      + '.ai-panel{position:fixed;right:20px;bottom:90px;z-index:9001;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 130px);'
      + 'background:#fff;border-radius:18px;box-shadow:0 16px 50px rgba(0,0,0,.22);display:none;flex-direction:column;overflow:hidden;font-family:Inter,system-ui,sans-serif}'
      + '.ai-panel.is-open{display:flex}'
      + '.ai-hd{background:linear-gradient(135deg,#E8722A,#f0913f);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}'
      + '.ai-hd b{font-size:15px;font-weight:700}.ai-hd small{display:block;font-size:11px;opacity:.9;font-weight:500}'
      + '.ai-hd .ai-voice{margin-left:auto;background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center}'
      + '.ai-hd .ai-voice.on{background:#fff;color:#E8722A}.ai-hd .ai-voice svg{width:16px;height:16px}'
      + '.ai-hd .ai-x{margin-left:6px;background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:18px;line-height:1}'
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
    fab.className = 'ai-fab'; fab.type = 'button'; fab.title = 'Sila — assistente';
    fab.innerHTML = '<img src="assets/icon-192.png" alt="Sila" />';
    fab.addEventListener('click', toggle);

    var panel = document.createElement('div');
    panel.className = 'ai-panel';
    panel.innerHTML =
      '<div class="ai-hd"><img class="ai-hd-logo" src="assets/icon-192.png" alt="" />'
      + '<div><b>Sila</b><small>Assistente da Solução Móveis</small></div>'
      + '<button class="ai-voice" id="aiVoice" type="button" title="Sila falar as respostas"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg></button>'
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
    els.voice = panel.querySelector('#aiVoice');
    panel.querySelector('.ai-x').addEventListener('click', toggle);
    els.send.addEventListener('click', send);
    // Voz da Sila (TTS): liga/desliga, lembrado entre sessões.
    voiceOn = localStorage.getItem('sila-voz') === '1';
    els.voice.classList.toggle('on', voiceOn);
    els.voice.addEventListener('click', function () {
      voiceOn = !voiceOn;
      els.voice.classList.toggle('on', voiceOn);
      localStorage.setItem('sila-voz', voiceOn ? '1' : '0');
      if (!voiceOn && window.speechSynthesis) window.speechSynthesis.cancel();
    });
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
      if (!messages.length) addBot('Oi! 👋 Eu sou a Sila, sua assistente aqui no SMERP. Posso abrir uma solicitação de compra pra você ou tirar dúvidas. O que você precisa?');
      els.input.focus();
    } else if (window.speechSynthesis) {
      window.speechSynthesis.cancel(); // para de falar ao fechar
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

  // ---------- voz da Sila (TTS, grátis, via navegador) ----------
  // Escolhe a melhor voz em PORTUGUÊS DO BRASIL disponível no aparelho.
  function pickVoice() {
    if (!window.speechSynthesis) return null;
    var vs = window.speechSynthesis.getVoices() || [];
    var br = vs.filter(function (v) { return /pt[-_]?br/i.test(v.lang); });
    if (!br.length) br = vs.filter(function (v) { return /^pt/i.test(v.lang); });
    // preferência por vozes brasileiras naturais/conhecidas
    var pref = ['Google português do Brasil', 'Luciana', 'Maria', 'Francisca', 'Thalita', 'Camila', 'Microsoft Maria', 'Microsoft Daniel', 'Natural', 'Brasil'];
    for (var i = 0; i < pref.length; i++) {
      for (var j = 0; j < br.length; j++) { if (br[j].name.indexOf(pref[i]) !== -1) return br[j]; }
    }
    return br[0] || null;
  }
  function speak(text) {
    if (!voiceOn || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    if (!ttsVoice) ttsVoice = pickVoice();
    // tira emojis/símbolos pra não "ler" caracteres estranhos
    var clean = text.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '').trim();
    var u = new SpeechSynthesisUtterance(clean);
    u.lang = 'pt-BR';
    if (ttsVoice) u.voice = ttsVoice;
    u.rate = 1.0; u.pitch = 1.05;
    window.speechSynthesis.speak(u);
  }
  // as vozes carregam de forma assíncrona em alguns navegadores
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () { ttsVoice = pickVoice(); };
  }

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
      speak(reply);
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
