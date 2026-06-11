/* ============================================================
   SMERP — Assistente de IA (cérebro).
   ------------------------------------------------------------
   Recebe do Hub  POST /chat  { access_token, messages, audio? }
   e conversa com o Gemini (Flash). O Gemini pode:
     - responder em texto;
     - chamar uma "ferramenta" (ex.: criar_solicitacao_compra), que
       este serviço executa NO SUPABASE USANDO O TOKEN DA PESSOA.
   Como usa o token do usuário, o RLS do banco filtra sozinho o que
   ela pode ver/fazer — o assistente nunca enxerga além do dono.

   Segredo: a GEMINI_API_KEY vive SÓ aqui (env do EasyPanel).
   ============================================================ */
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const {
  PORT = '3000',
  GEMINI_API_KEY,
  GEMINI_MODEL = 'gemini-2.5-flash-lite',
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  ALLOWED_ORIGIN = '*',
  // Voz neural (ElevenLabs). Opcional: sem a chave, a Sila usa a voz do navegador.
  ELEVEN_API_KEY,
  ELEVEN_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL', // Sarah (feminina). Outras grátis: Jessica cgSgspJ2msm6clMCkdW9, Bella hpp4J3VqNfWAUOO0d1Us
  ELEVEN_MODEL = 'eleven_turbo_v2_5',       // turbo = metade dos créditos
  ELEVEN_MONTHLY_LIMIT = '9500',            // trava: para antes dos 10 mil/mês do grátis
} = process.env;

for (const [k, v] of Object.entries({ GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY })) {
  if (!v) { console.error(`[ai] Falta a variável de ambiente ${k}`); process.exit(1); }
}

// Lista de modelos GRÁTIS em cascata: se um estourar a cota (429) ou estiver
// sobrecarregado (503), a Sila tenta o próximo, e o próximo... até um funcionar
// (ou acabarem todos). Cada modelo tem cota grátis SEPARADA, então isso
// multiplica bastante o quanto dá pra usar de graça.
// Dá pra customizar pelo env GEMINI_MODELS (lista separada por vírgula).
const MODEL_LIST = [...new Set(
  // Capacidade primeiro (modelo mais esperto), caindo pros mais leves quando a cota acaba.
  (process.env.GEMINI_MODELS || 'gemini-2.5-flash,gemini-flash-latest,gemini-2.0-flash,gemini-2.5-flash-lite,gemini-2.0-flash-lite')
    .split(',').map((s) => s.trim()).filter(Boolean)
)];

// ------------------------------------------------------------
// Cliente Supabase "como a pessoa": o token dela vai no Authorization,
// então toda leitura/escrita respeita o RLS do usuário logado.
// ------------------------------------------------------------
function sbAsUser(accessToken, schema) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: schema ? { schema } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// ------------------------------------------------------------
// SYSTEM PROMPT — o "manual" do sistema + como o assistente se comporta.
// ------------------------------------------------------------
const SYSTEM_PROMPT = `Você é a Sila, assistente do SMERP (sistema de gestão da Solução Móveis, fábrica de móveis escolares). Quando se apresentar, diga que é a Sila. Fale em português do Brasil, como uma colega esperta, rápida e prestativa. Quem fala com você é GERENTE, DIRETOR ou gente do escritório/chão de fábrica — NÃO são técnicos.

⚠️ REGRA DE OURO: o trabalho técnico é SEU, não da pessoa. NUNCA pergunte sobre "schema", "tabela", "coluna", "banco de dados", nem peça nomes técnicos. A pessoa não sabe e não precisa saber — VOCÊ descobre sozinha. Pense num gerente ocupado: ele pede, você resolve e entrega. Sem enrolação, sem fazer ele explicar o sistema pra você.

FORMATO: escreva em TEXTO SIMPLES. NÃO use markdown nem símbolos de formatação (nada de *, **, #, -, _, backticks). O texto é mostrado no chat E LIDO EM VOZ ALTA — asteriscos e marcações ficam horríveis falados. Para enumerar, use frases curtas ou quebras de linha simples (ex.: "A OMP fez 2448 peças, 122% da meta." em uma linha; a próxima em outra). Nada de "1. **Nome**".

QUANDO PEDIREM UM DADO / NÚMERO / RELATÓRIO / STATUS:
- Resolva SOZINHA. Use as ferramentas descrever_banco (pra VOCÊ ver a estrutura) e consultar_dados (pra buscar) por conta própria, EM SILÊNCIO. Não narre "vou consultar o schema X" — só trabalhe e traga o resultado.
- Faça suposições razoáveis. "hoje" = a data de hoje. Setor/área/máquina que a pessoa citar (ex.: "metalurgia"), procure você no banco. Não peça confirmação de coisa óbvia.
- Só faça UMA pergunta se for dúvida de NEGÓCIO que muda a resposta (ex.: "de hoje ou do mês?"). Senão, escolha a interpretação mais provável e RESPONDA.
- Traga a resposta direta, em linguagem de gestor. Nada de SQL nem nomes técnicos (a menos que peçam "como você achou").

ONDE CADA COISA VIVE (pra VOCÊ saber onde procurar — nunca conte isso pra pessoa):
- Produção, metas, máquinas, "bateu/não bateu a meta", hora a hora, áreas como metalurgia/marcenaria → schema fabrill.
- Solicitações de compra, pedidos, fornecedores, quanto se gastou → schema compras.
- Ordens de serviço, manutenção de máquina, peças → schema manutencao.
- Planos de ação, projetos, 5W2H, marcos/prazos → schema planos_acao.
- Expedição, carregamento → schema bip. Veículos/frota/abastecimento → frota. Sobras → sobras.

COMO BUSCAR BEM (faça sozinha, rápido):
1. Identifique o schema certo pela pergunta. 2. Chame descrever_banco(schema) UMA vez pra ver tabelas/colunas. 3. Escreva UM consultar_dados com um SELECT objetivo — use joins e agregações (count, sum, comparação meta x realizado). Sempre qualifique a tabela com o schema (ex.: fabrill.production_goals). 4. Responda em linguagem simples.
- Se vier vazio, tente OUTRO ângulo (outra tabela/filtro) antes de desistir. Só diga que não achou depois de tentar de verdade; aí explique simples (pode não existir ainda, ou você pode não ter acesso àquela informação — você só enxerga o que a própria pessoa já poderia ver).

AÇÕES (criar/abrir coisas):
- Você sabe abrir solicitação de compra (criar_solicitacao_compra): junte itens, setor, prazo e motivo, faça um resumo curto e peça confirmação ("posso criar?"). Só crie após o "pode". Devolva o número gerado (ex.: SC-0001/2026).
- Ações que você ainda não tem ferramenta: diga que por enquanto só consegue consultar e abrir solicitação de compra.`;

// Adendo quando a conversa é por VOZ (modo ligação): estilo falado, natural.
const VOICE_STYLE = `IMPORTANTE: ESTA CONVERSA É POR VOZ (a pessoa vai OUVIR sua resposta, como num telefone). Então:
- Fale curto e natural, do jeito que se fala em voz alta. No máximo 2 ou 3 frases.
- NADA de listas, tópicos, números de item, tabelas ou símbolos. Só frases.
- Diga os números de forma natural e arredondada quando der (ex.: "a OMP bateu 122% da meta, com cerca de 2.450 peças"). Não despeje uma lista enorme de números — destaque o essencial e ofereça detalhar se quiserem.
- Soe como uma colega conversando, não como um relatório lido.`;

// ------------------------------------------------------------
// FERRAMENTAS que o Gemini pode chamar (function calling).
// ------------------------------------------------------------
const TOOLS = [{
  functionDeclarations: [
    {
      name: 'listar_setores',
      description: 'Lista os setores disponíveis em Compras (para escolher o setor de uma solicitação). Use quando precisar saber os setores válidos ou quando a pessoa não souber o nome exato.',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'descrever_banco',
      description: 'Lista as tabelas e colunas de um schema (app) do banco, pra você saber o que consultar. Schemas: compras, fabrill, bip, manutencao, planos_acao, gestao, sobras, frota, expedicao, public.',
      parameters: {
        type: 'object',
        properties: { schema: { type: 'string', description: 'Nome do schema/app (ex.: compras)' } },
        required: ['schema'],
      },
    },
    {
      name: 'consultar_dados',
      description: 'Roda UMA consulta SELECT (somente leitura) e devolve o resultado. Use nomes de tabela qualificados com o schema (ex.: compras.purchase_requests). Respeita o acesso da pessoa (RLS).',
      parameters: {
        type: 'object',
        properties: { sql: { type: 'string', description: 'A consulta SELECT (uma só, sem ponto-e-vírgula)' } },
        required: ['sql'],
      },
    },
    {
      name: 'criar_solicitacao_compra',
      description: 'Cria uma nova solicitação de compra (SC) em nome da pessoa. Só chame DEPOIS que a pessoa confirmar claramente. Todos os campos de itens, prazo e justificativa são obrigatórios.',
      parameters: {
        type: 'object',
        properties: {
          setor: { type: 'string', description: 'Nome do setor que está pedindo (ex.: "Produção"). Será casado com os setores de Compras.' },
          itens: {
            type: 'array',
            description: 'Itens que estão sendo pedidos.',
            items: {
              type: 'object',
              properties: {
                descricao: { type: 'string', description: 'O que é o item (ex.: "Cadeira escolar")' },
                quantidade: { type: 'number', description: 'Quantidade pedida (maior que zero)' },
                unidade: { type: 'string', description: 'Unidade (ex.: un, kg, m, cx, h)' },
              },
              required: ['descricao', 'quantidade', 'unidade'],
            },
          },
          necessario_ate: { type: 'string', description: 'Data limite de entrega no formato AAAA-MM-DD' },
          justificativa: { type: 'string', description: 'Motivo da compra (mínimo 5 caracteres)' },
          prioridade: { type: 'string', enum: ['baixa', 'media', 'alta'], description: 'Prioridade (padrão media)' },
          confirmado: { type: 'boolean', description: 'true SOMENTE depois que a pessoa confirmou que pode criar' },
        },
        required: ['setor', 'itens', 'necessario_ate', 'justificativa', 'confirmado'],
      },
    },
  ],
}];

// ------------------------------------------------------------
// Execução de cada ferramenta (roda no banco, como a pessoa).
// Retorna um objeto que volta pro Gemini como "functionResponse".
// ------------------------------------------------------------
async function runTool(name, args, accessToken) {
  // Consultas gerais usam o schema public (onde vivem as funções sila_*).
  if (name === 'descrever_banco') {
    const pub = sbAsUser(accessToken);
    const { data, error } = await pub.rpc('sila_schema', { p_schema: String(args.schema || '').trim() });
    if (error) return { erro: 'Não consegui descrever o banco: ' + error.message };
    return { schema: args.schema, tabelas: data };
  }

  if (name === 'consultar_dados') {
    const pub = sbAsUser(accessToken);
    const { data, error } = await pub.rpc('sila_consultar', { p_sql: String(args.sql || '') });
    if (error) return { erro: 'Consulta falhou: ' + error.message };
    return { resultado: data };
  }

  const sb = sbAsUser(accessToken, 'compras');

  if (name === 'listar_setores') {
    const { data, error } = await sb.from('sectors').select('id, name').order('name');
    if (error) return { erro: 'Não consegui listar os setores: ' + error.message };
    return { setores: (data || []).map((s) => s.name) };
  }

  if (name === 'criar_solicitacao_compra') {
    if (!args.confirmado) {
      return { status: 'precisa_confirmar', aviso: 'A pessoa ainda não confirmou. Faça um resumo e peça confirmação antes de criar.' };
    }
    const itens = Array.isArray(args.itens) ? args.itens.filter((i) => i && i.descricao && i.quantidade > 0 && i.unidade) : [];
    if (!itens.length) return { erro: 'Preciso de pelo menos um item com descrição, quantidade (>0) e unidade.' };
    if (!args.necessario_ate || !/^\d{4}-\d{2}-\d{2}$/.test(args.necessario_ate)) return { erro: 'Preciso da data limite no formato AAAA-MM-DD.' };
    if (!args.justificativa || args.justificativa.trim().length < 5) return { erro: 'Preciso de uma justificativa (motivo) com pelo menos 5 caracteres.' };

    // Descobre quem é a pessoa (requester_id) pelo token.
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) return { erro: 'Não consegui identificar você. Tente entrar de novo.' };

    // Casa o setor pelo nome (se vier). É opcional na tabela.
    let sector_id = null;
    if (args.setor && args.setor.trim()) {
      const { data: secs } = await sb.from('sectors').select('id, name');
      const alvo = args.setor.trim().toLowerCase();
      const exato = (secs || []).find((s) => s.name.toLowerCase() === alvo);
      const parcial = (secs || []).filter((s) => s.name.toLowerCase().includes(alvo) || alvo.includes(s.name.toLowerCase()));
      const match = exato || (parcial.length === 1 ? parcial[0] : null);
      if (!match) {
        return { erro: 'Não achei o setor "' + args.setor + '". Setores disponíveis: ' + (secs || []).map((s) => s.name).join(', ') + '. Pergunte qual é o certo.' };
      }
      sector_id = match.id;
    }

    const first = itens[0];
    const aggDescription = itens.slice(0, 3).map((i) => `${i.quantidade} ${i.unidade} ${i.descricao}`).join('; ')
      + (itens.length > 3 ? ` (+${itens.length - 3} item(ns))` : '');
    const priority = ['baixa', 'media', 'alta'].includes(args.prioridade) ? args.prioridade : 'media';

    const { data: inserted, error } = await sb
      .from('purchase_requests')
      .insert({
        sector_id,
        requester_id: userData.user.id,
        description: aggDescription,
        quantity: first.quantidade,
        unit: first.unidade,
        needed_by: args.necessario_ate,
        justification: args.justificativa.trim(),
        priority,
      })
      .select('id, number')
      .single();

    if (error) {
      // Mensagem amigável quando o RLS barra (sem perfil em Compras).
      if (/row-level security|permission|policy/i.test(error.message)) {
        return { erro: 'Você não tem acesso para abrir solicitações de compra. Fale com o responsável do setor de Compras.' };
      }
      return { erro: 'Não consegui criar a solicitação: ' + error.message };
    }

    const itemsPayload = itens.map((i, idx) => ({
      request_id: inserted.id,
      description: i.descricao.trim(),
      quantity: i.quantidade,
      unit: i.unidade.trim(),
      position: idx,
    }));
    await sb.from('request_items').insert(itemsPayload);

    return { status: 'criada', numero: inserted.number, id: inserted.id };
  }

  return { erro: 'Ferramenta desconhecida.' };
}

// ------------------------------------------------------------
// Converte o histórico do front ([{role, content}]) para o
// formato do Gemini (contents). Áudio entra como parte inline.
// ------------------------------------------------------------
function toGeminiContents(messages, audio) {
  const contents = (messages || []).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '') }],
  }));
  if (audio && audio.data && audio.mime) {
    // Áudio do microfone vira a última fala do usuário.
    contents.push({ role: 'user', parts: [{ inlineData: { mimeType: audio.mime, data: audio.data } }] });
  }
  return contents;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Chama UM modelo. Re-tenta só 503 (sobrecarga passageira) no mesmo modelo.
async function callModel(model, contents, sysExtra, attempt = 0) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const sysText = sysExtra ? `${SYSTEM_PROMPT}\n\n${sysExtra}` : SYSTEM_PROMPT;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sysText }] },
      contents,
      tools: TOOLS,
      generationConfig: { temperature: 0.3 },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    if (resp.status === 503 && attempt < 2) {
      await sleep(700 * (attempt + 1));
      return callModel(model, contents, sysExtra, attempt + 1);
    }
    const err = new Error(`Gemini ${resp.status}: ${t.slice(0, 300)}`);
    err.status = resp.status;
    throw err;
  }
  const json = await resp.json();
  return json?.candidates?.[0]?.content || null;
}

// Cascata: tenta cada modelo da lista; se um estourar a cota (429) ou cair
// (503/500), passa pro próximo. Só desiste quando TODOS falharem.
async function callGemini(contents, sysExtra) {
  let lastErr;
  for (const model of MODEL_LIST) {
    try {
      return await callModel(model, contents, sysExtra);
    } catch (e) {
      lastErr = e;
      if (e.status === 429 || e.status === 503 || e.status === 500) {
        console.warn(`[ai] modelo ${model} indisponível (${e.status}) — tentando o próximo`);
        continue; // próximo modelo da lista
      }
      throw e; // erro que não é de cota/disponibilidade (ex.: 400): trocar não ajuda
    }
  }
  throw lastErr || new Error('Nenhum modelo disponível');
}

// ============================================================
//  VOZ (TTS) — ElevenLabs (voz neural). Gera o MP3 da fala da Sila.
//  Funciona no iPhone também (o navegador só TOCA o áudio).
//  TRAVA DE GASTO: conta caracteres do mês; passou do limite grátis,
//  para de chamar (o front cai na voz do navegador). Qualquer erro da
//  API também faz cair. Impossível gerar cobrança.
// ============================================================
const ELEVEN_LIMIT = Number(ELEVEN_MONTHLY_LIMIT) || 9500;
let ttsMonth = '';
let ttsCharsUsed = 0;
function ttsMonthKey() { const d = new Date(); return `${d.getUTCFullYear()}-${d.getUTCMonth()}`; }

async function elevenTTS(text) {
  // reseta o contador quando vira o mês
  const mk = ttsMonthKey();
  if (mk !== ttsMonth) { ttsMonth = mk; ttsCharsUsed = 0; }
  // trava: não passa do limite grátis do mês
  if (ttsCharsUsed + text.length > ELEVEN_LIMIT) { const e = new Error('limite mensal de voz atingido'); e.capped = true; throw e; }

  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVEN_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: ELEVEN_MODEL }),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`eleven ${r.status}: ${t.slice(0, 160)}`); }
  const buf = Buffer.from(await r.arrayBuffer());
  ttsCharsUsed += text.length; // só conta quando deu certo
  return buf;
}

// ============================================================
//  Servidor HTTP
// ============================================================
const app = express();
app.use(express.json({ limit: '12mb' })); // áudio base64 cabe aqui

// CORS — o Hub (browser) chama de outra origem. Espelha a origem de quem
// chama (navegador, celular ou app de PC). O endpoint já é protegido pelo
// token do usuário + can_use_assistant, então refletir a origem é seguro.
// Se ALLOWED_ORIGIN for um domínio específico (≠ '*'), só ele é aceito.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || ALLOWED_ORIGIN || '*');
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true }));

// Voz da Sila: recebe { text } e devolve o MP3 falado (ElevenLabs).
app.post('/tts', async (req, res) => {
  if (!ELEVEN_API_KEY) return res.status(503).json({ error: 'tts_desligado' }); // sem chave: front usa voz do navegador
  const text = String((req.body && req.body.text) || '').slice(0, 1200).trim();
  if (!text) return res.status(400).json({ error: 'sem_texto' });
  try {
    const audio = await elevenTTS(text);
    if (!audio || !audio.length) throw new Error('audio vazio');
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'no-store');
    res.send(audio);
  } catch (e) {
    console.warn('[ai] tts:', e && e.message); // capped/erro -> front cai na voz do navegador
    res.status(502).json({ error: 'tts_falhou' });
  }
});

app.post('/chat', async (req, res) => {
  const { access_token, messages, audio, voice } = req.body || {};
  const sysExtra = voice ? VOICE_STYLE : '';
  if (!access_token) return res.status(401).json({ error: 'sem_token' });

  try {
    // 1) Valida o token e identifica a pessoa.
    const sb = sbAsUser(access_token);
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) return res.status(401).json({ error: 'token_invalido' });

    // 2) Esta pessoa pode usar o assistente? (só quem o master liberou)
    const { data: allowed, error: gateErr } = await sb.rpc('can_use_assistant');
    if (gateErr) {
      console.error('[ai] gate (can_use_assistant) falhou:', gateErr.message);
      return res.status(500).json({ error: 'gate_falhou', reply: 'Não consegui verificar seu acesso agora. Tente de novo em instantes.' });
    }
    if (allowed !== true) return res.status(403).json({ error: 'sem_acesso', reply: 'Você ainda não tem acesso ao assistente. Peça pro responsável (master) liberar.' });

    // 3) Conversa com o Gemini, executando ferramentas até ele responder em texto.
    const contents = toGeminiContents(messages, audio);
    let reply = 'Desculpe, não consegui responder agora.';

    for (let i = 0; i < 6; i++) {
      const content = await callGemini(contents, sysExtra);
      if (!content) break;
      contents.push(content); // guarda a vez do modelo

      const calls = (content.parts || []).filter((p) => p.functionCall).map((p) => p.functionCall);
      if (calls.length === 0) {
        reply = (content.parts || []).map((p) => p.text || '').join('').trim() || reply;
        break;
      }

      // Executa cada ferramenta pedida e devolve o resultado pro modelo.
      const responseParts = [];
      for (const call of calls) {
        const result = await runTool(call.name, call.args || {}, access_token);
        responseParts.push({ functionResponse: { name: call.name, response: result } });
      }
      contents.push({ role: 'user', parts: responseParts });
    }

    res.json({ reply });
  } catch (e) {
    const msg = (e && e.message) || '';
    console.error('[ai] erro:', msg);
    const amigavel = /429|quota|rate limit/i.test(msg)
      ? 'Estou recebendo muitas perguntas agora e bati o limite de uso da IA. Tente de novo daqui a pouco. 🙏'
      : 'Tive um problema técnico agora. Tente de novo em instantes.';
    res.status(500).json({ error: 'erro_interno', reply: amigavel });
  }
});

app.listen(Number(PORT), () => console.log(`[ai] assistente ouvindo na porta ${PORT} (modelos em cascata: ${MODEL_LIST.join(' › ')})`));
