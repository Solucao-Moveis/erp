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
  GEMINI_MODEL = 'gemini-2.5-flash',
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  ALLOWED_ORIGIN = '*',
} = process.env;

for (const [k, v] of Object.entries({ GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY })) {
  if (!v) { console.error(`[ai] Falta a variável de ambiente ${k}`); process.exit(1); }
}

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

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
const SYSTEM_PROMPT = `Você é a Sila, a assistente de IA do SMERP, o sistema de gestão da Solução Móveis (uma fábrica de móveis escolares). Quando se apresentar, diga que é a Sila. Fale SEMPRE em português do Brasil, de forma simples, curta e gentil — as pessoas que usam são do chão de fábrica e do escritório, não são técnicas.

O SMERP é um Hub central com vários sistemas (apps), cada um de um setor:
- Compras: solicitações de compra (SC) e pedidos. Quem precisa de algo abre uma "solicitação de compra".
- Gestor de Projeto (planos de ação): planos de ação no formato 5W2H, com marcos e prazos.
- BIP / Produção: apontamento de produção das máquinas, metas batidas.
- Hora a Hora (Fabrill): produção hora a hora, metas por máquina.
- Manutenção: ordens de serviço das máquinas.
- Gerencial: painel executivo com números (BI).
- Sobras, Frota, Expedição: estoque de sobras, veículos, carregamento.

COMO AGIR:
1. ENTENDA COMPLETAMENTE antes de fazer. Se faltar informação pra atender o pedido, PERGUNTE — não invente nem chute dados.
2. Você só consegue ver e fazer o que a PRÓPRIA PESSOA já poderia (o sistema bloqueia o resto automaticamente). Se algo der "sem permissão", explique gentilmente que ela não tem acesso àquilo e sugira falar com o responsável — nunca tente burlar.
3. Para AÇÕES que criam ou mudam dados (como abrir uma solicitação de compra), faça um RESUMO do que vai fazer e PEÇA CONFIRMAÇÃO ("posso criar?"). Só chame a ferramenta depois que a pessoa confirmar claramente (ex.: "pode", "sim", "confirma").
4. Seja direto no resultado: depois de criar algo, diga o número/identificador gerado.

Hoje você sabe fazer: abrir solicitação de compra (ferramenta criar_solicitacao_compra) e listar os setores de Compras (listar_setores). Se pedirem algo que você ainda não sabe fazer, explique que essa habilidade ainda será adicionada.`;

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

async function callGemini(contents, attempt = 0) {
  const resp = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      tools: TOOLS,
      generationConfig: { temperature: 0.3 },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    // Engasgo temporário do Gemini (sobrecarga / limite): tenta de novo.
    if ((resp.status === 503 || resp.status === 429) && attempt < 4) {
      await sleep(700 * (attempt + 1));
      return callGemini(contents, attempt + 1);
    }
    throw new Error(`Gemini ${resp.status}: ${t.slice(0, 400)}`);
  }
  const json = await resp.json();
  return json?.candidates?.[0]?.content || null;
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

// Autoteste temporário: confirma se o container alcança o Gemini com a chave
// do Ambiente. Não revela a chave. (remover depois do diagnóstico)
app.get('/selftest', async (_req, res) => {
  const keyHint = (GEMINI_API_KEY || '').slice(0, 4) + '…(' + (GEMINI_API_KEY || '').length + ' chars)';
  try {
    const c = await callGemini([{ role: 'user', parts: [{ text: 'ping' }] }]);
    res.json({ gemini: 'ok', model: GEMINI_MODEL, keyHint, text: (c?.parts || []).map((p) => p.text || '').join('') });
  } catch (e) {
    res.status(500).json({ gemini: 'falhou', model: GEMINI_MODEL, keyHint, erro: e && e.message });
  }
});

app.post('/chat', async (req, res) => {
  const { access_token, messages, audio } = req.body || {};
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
      return res.status(500).json({ error: 'gate_falhou', reply: '[diagnóstico] Falha ao verificar acesso: ' + gateErr.message });
    }
    if (allowed !== true) return res.status(403).json({ error: 'sem_acesso', reply: 'Você ainda não tem acesso ao assistente. Peça pro responsável (master) liberar.' });

    // 3) Conversa com o Gemini, executando ferramentas até ele responder em texto.
    const contents = toGeminiContents(messages, audio);
    let reply = 'Desculpe, não consegui responder agora.';

    for (let i = 0; i < 6; i++) {
      const content = await callGemini(contents);
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
    console.error('[ai] erro:', e && e.message);
    res.status(500).json({ error: 'erro_interno', reply: '[diagnóstico] Erro técnico: ' + (e && e.message ? e.message : 'desconhecido') });
  }
});

app.listen(Number(PORT), () => console.log(`[ai] assistente ouvindo na porta ${PORT} (modelo ${GEMINI_MODEL})`));
