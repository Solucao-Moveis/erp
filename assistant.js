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
  var ttsPrimed = false; // iOS: fala só destrava após um toque do usuário
  var rec = null;            // reconhecimento de fala (STT)
  var callMode = false;      // tela de "ligação" (conversa por voz) ativa
  var callProcessing = false; // aguardando resposta/falando -> não re-ouvir agora
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
      + '.ai-hd{flex:0 0 auto;background:linear-gradient(135deg,#E8722A,#f0913f);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}'
      + '.ai-hd b{font-size:15px;font-weight:700}.ai-hd small{display:block;font-size:11px;opacity:.9;font-weight:500}'
      + '.ai-hd .ai-voice{margin-left:auto;background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center}'
      + '.ai-hd .ai-voice.on{background:#fff;color:#E8722A}.ai-hd .ai-voice svg{width:16px;height:16px}'
      + '.ai-hd .ai-x{margin-left:6px;background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:18px;line-height:1}'
      + '.ai-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:16px;background:#f7f7f8;display:flex;flex-direction:column;gap:10px}'
      + '.ai-msg{max-width:85%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}'
      + '.ai-msg.user{align-self:flex-end;background:#E8722A;color:#fff;border-bottom-right-radius:4px}'
      + '.ai-msg.bot{align-self:flex-start;background:#fff;color:#222;border:1px solid #ececec;border-bottom-left-radius:4px}'
      + '.ai-msg.typing{color:#999;font-style:italic}'
      + '.ai-foot{flex:0 0 auto;padding:10px;border-top:1px solid #eee;background:#fff;display:flex;gap:8px;align-items:flex-end}'
      + '.ai-foot textarea{flex:1;resize:none;border:1px solid #ddd;border-radius:12px;padding:10px 12px;font-size:14px;font-family:inherit;max-height:90px;outline:none}'
      + '.ai-foot textarea:focus{border-color:#E8722A}'
      + '.ai-btn{border:none;border-radius:12px;cursor:pointer;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}'
      + '.ai-send{background:#E8722A;color:#fff}.ai-send:disabled{opacity:.5;cursor:default}'
      + '.ai-mic{background:#f0f0f0;color:#555}.ai-mic.rec{background:#DC2626;color:#fff;animation:aipulse 1s infinite}'
      + '.ai-btn svg{width:20px;height:20px}'
      + '@keyframes aipulse{0%,100%{opacity:1}50%{opacity:.55}}'
      // ---- tela de "ligação" (modo voz) ----
      + '.ai-call{position:fixed;inset:0;z-index:9100;display:none;flex-direction:column;align-items:center;justify-content:space-between;'
      + 'background:linear-gradient(160deg,#E8722A 0%,#c75416 100%);color:#fff;padding:calc(40px + env(safe-area-inset-top)) 24px calc(40px + env(safe-area-inset-bottom));font-family:Inter,system-ui,sans-serif}'
      + '.ai-call.is-open{display:flex}'
      + '.ai-call__top{font-size:13px;letter-spacing:1.5px;opacity:.8;text-transform:uppercase}'
      + '.ai-call__center{display:flex;flex-direction:column;align-items:center;gap:18px;margin-top:4vh}'
      + '.ai-call__avatar{width:130px;height:130px;border-radius:50%;object-fit:cover;border:4px solid rgba(255,255,255,.55)}'
      + '.ai-call.listening .ai-call__avatar{animation:aicall 1.5s infinite}'
      + '.ai-call.speaking .ai-call__avatar{animation:aicall 0.9s infinite}'
      + '@keyframes aicall{0%{box-shadow:0 0 0 0 rgba(255,255,255,.5)}70%{box-shadow:0 0 0 28px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}'
      + '.ai-call__name{font-size:27px;font-weight:800}'
      + '.ai-call__status{font-size:15px;opacity:.92;min-height:22px;text-align:center;max-width:280px}'
      + '.ai-call__end{width:70px;height:70px;border-radius:50%;border:none;background:#DC2626;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px rgba(0,0,0,.35)}'
      + '.ai-call__end:active{transform:scale(.94)}.ai-call__end svg{width:32px;height:32px}'
      // ---- celular: chat em tela cheia (corrige a UX quebrada) ----
      + '@media(max-width:480px){.ai-panel{right:0;left:0;top:0;bottom:0;width:100%;height:100dvh;max-width:none;max-height:none;border-radius:0}'
      + '.ai-hd{padding-top:calc(14px + env(safe-area-inset-top))}.ai-foot{padding-bottom:calc(10px + env(safe-area-inset-bottom))}'
      + '.ai-fab{width:56px;height:56px;right:16px;bottom:16px}}';
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

    // ---- tela de "ligação" (modo voz, tela cheia) ----
    var call = document.createElement('div');
    call.className = 'ai-call';
    call.innerHTML =
      '<div class="ai-call__top">Conversa por voz</div>'
      + '<div class="ai-call__center">'
      + '<img class="ai-call__avatar" src="assets/icon-192.png" alt="Sila" />'
      + '<div class="ai-call__name">Sila</div>'
      + '<div class="ai-call__status" id="aiCallStatus">Conectando…</div>'
      + '</div>'
      + '<button class="ai-call__end" id="aiCallEnd" type="button" title="Encerrar conversa">'
      + '<svg viewBox="0 0 24 24" fill="currentColor" style="transform:rotate(135deg)"><path d="M21 15.46l-5.27-.61-2.52 2.52a15.05 15.05 0 0 1-6.59-6.59l2.53-2.53L8.54 3H3.03C2.45 13.18 10.82 21.55 21 20.97v-5.51z"/></svg>'
      + '</button>';
    document.body.appendChild(call);
    els.call = call;
    els.callStatus = call.querySelector('#aiCallStatus');
    call.querySelector('#aiCallEnd').addEventListener('click', endCall);

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
      if (voiceOn) primeTTS(); // destrava a fala no iPhone (gesto do usuário)
      else if (window.speechSynthesis) window.speechSynthesis.cancel();
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
  // iOS/Safari só "destrava" a fala dentro de um toque do usuário. Chamamos
  // isto no 1º toque (microfone / alto-falante) com uma fala muda, pra liberar.
  function primeTTS() {
    if (ttsPrimed || !window.speechSynthesis) return;
    ttsPrimed = true;
    try {
      var u = new SpeechSynthesisUtterance(' ');
      u.volume = 0; u.lang = 'pt-BR';
      window.speechSynthesis.speak(u);
      window.speechSynthesis.resume();
    } catch (e) { /* ignora */ }
  }

  function speak(text, onend) {
    // fala se a voz estiver ligada OU se estiver numa ligação
    if (!window.speechSynthesis || !text || (!voiceOn && !callMode)) { if (onend) onend(); return; }
    window.speechSynthesis.cancel();
    if (!ttsVoice) ttsVoice = pickVoice();
    // tira emojis/símbolos pra não "ler" caracteres estranhos
    var clean = text.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '').trim();
    if (!clean) { if (onend) onend(); return; }
    var u = new SpeechSynthesisUtterance(clean);
    u.lang = 'pt-BR';
    if (ttsVoice) u.voice = ttsVoice;
    u.rate = 1.0; u.pitch = 1.05;
    if (onend) { u.onend = onend; u.onerror = onend; }
    window.speechSynthesis.speak(u);
    try { window.speechSynthesis.resume(); } catch (e) { /* iOS às vezes pausa */ }
  }
  // as vozes carregam de forma assíncrona em alguns navegadores
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () { ttsVoice = pickVoice(); };
  }

  // ---------- enviar pro serviço ----------
  function send() {
    var text = (els.input.value || '').trim();
    if (!text) return;
    els.input.value = ''; els.input.style.height = 'auto';
    sendText(text);
  }

  async function sendText(text) {
    text = (text || '').trim();
    if (!text || sending) return;
    addUser(text);
    messages.push({ role: 'user', content: text });

    sending = true; els.send.disabled = true;
    var typing = callMode ? null : addMsg('digitando…', 'bot typing');
    if (callMode) setCallStatus('Sila está pensando…', 'thinking');

    try {
      var ses = (await sb.auth.getSession()).data.session;
      if (!ses) { if (typing) typing.remove(); finishReply('Você precisa estar logado no Hub.'); return; }

      var r = await fetch(CFG.AI_SERVICE_URL.replace(/\/$/, '') + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: ses.access_token, messages: messages })
      });
      var data = await r.json().catch(function () { return {}; });
      if (typing) typing.remove();
      var reply = data.reply || 'Não consegui responder agora. Tente de novo.';
      addBot(reply);
      messages.push({ role: 'assistant', content: reply });
      finishReply(reply);
    } catch (e) {
      if (typing) typing.remove();
      var msg = 'Tive um problema de conexão. Tente de novo em instantes.';
      addBot(msg);
      finishReply(msg);
    } finally {
      sending = false; els.send.disabled = false;
      if (!callMode) els.input.focus();
    }
  }

  // Fala a resposta. Em modo ligação, ao terminar de falar volta a te ouvir.
  function finishReply(text) {
    if (callMode) {
      setCallStatus('Sila está falando…', 'speaking');
      speak(text, function () { callProcessing = false; if (callMode) startListen(); });
    } else {
      speak(text);
    }
  }

  // ---------- voz: microfone abre a "ligação" (ouvir <-> responder) ----------
  function setupMic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    // sem suporte a STT (ex.: iPhone/Safari): o microfone vira só um aviso.
    if (!SR) {
      els.mic.title = 'Falar por voz funciona no Android (Chrome) e no PC';
      els.mic.addEventListener('click', function () {
        addBot('Pra falar por voz, use o Android (Chrome) ou o computador. No iPhone dá pra digitar e eu respondo falando, se a voz estiver ligada (🔊).');
      });
      return;
    }
    rec = new SR();
    rec.lang = 'pt-BR'; rec.interimResults = false; rec.maxAlternatives = 1;

    rec.onresult = function (ev) {
      var t = (ev.results[0][0].transcript || '').trim();
      if (callMode) {
        if (!t) { startListen(); return; }   // não pegou nada: continua ouvindo
        callProcessing = true;
        sendText(t);
      } else {
        els.mic.classList.remove('rec');
        if (t) { els.input.value = (els.input.value ? els.input.value + ' ' : '') + t; els.input.dispatchEvent(new Event('input')); }
      }
    };
    rec.onend = function () {
      if (!callMode) { els.mic.classList.remove('rec'); return; }
      // em ligação: terminou de ouvir; se não pegou fala e não está processando, volta a ouvir
      if (!callProcessing) setTimeout(function () { if (callMode && !callProcessing) startListen(); }, 350);
    };
    rec.onerror = function (e) {
      if (!callMode) { els.mic.classList.remove('rec'); return; }
      var err = e && e.error;
      if (err === 'not-allowed' || err === 'service-not-allowed') { setCallStatus('Preciso de permissão do microfone 🎤', null); return; }
      if (!callProcessing && err !== 'aborted') setTimeout(function () { if (callMode && !callProcessing) startListen(); }, 500);
    };

    els.mic.addEventListener('click', startCall);
  }

  function startListen() {
    if (!rec || !callMode) return;
    try { rec.start(); setCallStatus('Pode falar… estou te ouvindo', 'listening'); }
    catch (e) { /* já está ativo */ }
  }

  function setCallStatus(txt, state) {
    if (els.callStatus) els.callStatus.textContent = txt;
    if (els.call) {
      els.call.classList.remove('listening', 'thinking', 'speaking');
      if (state) els.call.classList.add(state);
    }
  }

  function startCall() {
    if (!rec) return;
    primeTTS(); // destrava a fala no iPhone (este clique é um gesto do usuário)
    callMode = true; callProcessing = false;
    voiceOn = true; if (els.voice) els.voice.classList.add('on'); localStorage.setItem('sila-voz', '1');
    els.call.classList.add('is-open');
    setCallStatus('Pode falar… estou te ouvindo', 'listening');
    startListen();
  }

  function endCall() {
    callMode = false; callProcessing = false;
    if (rec) { try { rec.abort(); } catch (e) {} }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (els.call) els.call.classList.remove('is-open', 'listening', 'thinking', 'speaking');
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
