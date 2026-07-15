/**
 * Renova o token OAuth CODI via Spring Security + implicit flow.
 * Uso (na maquina da fabrica, dentro de codi-coletor/):
 *   node renovar-token.mjs
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';

const ACTION_URL = (process.env.CODI_ACTION_URL ?? '').replace(/\/$/, '');
const CLIENT_ID  = process.env.CODI_CLIENT_ID;
const SECRET     = process.env.CODI_CLIENT_SECRET;
const USER       = process.env.CODI_WS_USER;
const PASS       = process.env.CODI_WS_PASS;
const BASE       = 'http://192.168.2.210:8080';

if (!USER || !PASS) { console.error('CODI_WS_USER / CODI_WS_PASS nao definidos'); process.exit(1); }

function extrairJsessionid(headers) {
  const cookies = headers.getSetCookie
    ? headers.getSetCookie()
    : [headers.get('set-cookie') ?? ''];
  for (const c of cookies) {
    const m = c.match(/JSESSIONID=([^;,\s]+)/i);
    if (m) return m[1];
  }
  return null;
}

async function tryPasswordGrant(company, companyId) {
  const body = new URLSearchParams({
    grant_type:    'password',
    client_id:     CLIENT_ID,
    client_secret: SECRET,
    username:      USER,
    password:      PASS,
    company,
    companyId,
  });
  const r = await fetch(`${BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const txt = await r.text();
  return { status: r.status, body: txt };
}

async function main() {
  // ── Tentativa 0: OAuth2 password grant (evita o login web) ───
  console.log('\n[0] Tentando password grant com company=somvsomvpo...');
  const pg = await tryPasswordGrant('somvsomvpo', '1');
  console.log(`    Status: ${pg.status}  Body: ${pg.body.substring(0, 300)}`);
  if (pg.status === 200) {
    const json = JSON.parse(pg.body);
    const rt = json.refresh_token ?? json.refreshToken;
    const at = json.access_token  ?? json.accessToken;
    console.log(`\n✓ Password grant OK!  Access: ${at?.substring(0,16)}...`);
    if (rt) {
      writeFileSync('.token', rt, 'utf8');
      console.log(`✓ Refresh token salvo em .token! Reinicie: pm2 restart codi-coletor`);
    }
    return;
  }
  console.log('    Falhou. Continuando com login web...\n');

  // ── Passo 1: GET /action/home → pega JSESSIONID inicial ──────
  console.log(`\n[1] GET ${ACTION_URL}/home`);
  const r0 = await fetch(`${ACTION_URL}/home`, {
    redirect: 'manual',
    headers: { 'User-Agent': 'Mozilla/5.0 codi-coletor/2.0' },
  });
  const initSession = extrairJsessionid(r0.headers);
  const loc0 = r0.headers.get('location') ?? '';
  console.log(`    Status: ${r0.status}  Location: ${loc0}`);
  console.log(`    JSESSIONID: ${initSession ? initSession.substring(0, 12) + '...' : 'NENHUM'}`);

  // ── Passo 2: GET da pagina de login ──────────────────────────
  // Pega CSRF e tambem a URL real do form action
  const loginPath = loc0 || `${ACTION_URL}/login`;
  const loginUrl  = loginPath.startsWith('http') ? loginPath : `${BASE}${loginPath}`;
  console.log(`\n[2] GET ${loginUrl}`);
  const r1 = await fetch(loginUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 codi-coletor/2.0',
      ...(initSession ? { 'Cookie': `JSESSIONID=${initSession}` } : {}),
    },
  });
  const html = await r1.text().catch(() => '');
  const newSession1 = extrairJsessionid(r1.headers) ?? initSession;
  console.log(`    Status: ${r1.status}  JSESSIONID: ${newSession1 ? newSession1.substring(0, 12) + '...' : 'NENHUM'}`);

  // Extrai o action do <form>
  const formMatch  = html.match(/<form[^>]+action="([^"]+)"/i);
  const csrfMatch  = html.match(/name="_csrf"[^>]+value="([^"]+)"/i)
                  ?? html.match(/name="CSRFToken"[^>]+value="([^"]+)"/i);
  const formAction = formMatch?.[1] ?? null;
  const csrfToken  = csrfMatch?.[1] ?? null;
  console.log(`    Form action: ${formAction ?? '(nao encontrado)'}`);
  console.log(`    CSRF: ${csrfToken ?? '(sem csrf)'}`);
  // Mostra os campos do formulario para identificar os nomes corretos
  const inputs = [...html.matchAll(/<input[^>]+>/gi)].map(m => m[0]);
  console.log(`    Campos do form:\n      ${inputs.join('\n      ')}`);
  if (!formAction) {
    console.log('\n--- HTML parcial da pagina de login ---');
    console.log(html.substring(0, 1200));
    console.log('--------------------------------------');
  }

  // Resolve URL absoluta do form action (relativo à página atual, não ao ACTION_URL)
  const baseDir = loginUrl.substring(0, loginUrl.lastIndexOf('/') + 1);
  const postUrl = !formAction ? null
    : formAction.startsWith('http') ? formAction
    : formAction.startsWith('/') ? `${BASE}${formAction}`
    : `${baseDir}${formAction}`;
  console.log(`    POST URL resolvida: ${postUrl}`);

  if (!postUrl) {
    throw new Error('Nao foi possivel determinar a URL do formulario de login — veja o HTML acima');
  }

  // ── Passo 3: POST credenciais ─────────────────────────────────
  // Detecta nomes dos campos no HTML (j_username/j_password ou username/password)
  const userField  = html.includes('j_username') ? 'j_username' : 'username';
  const passField  = html.includes('j_password') ? 'j_password' : 'password';
  console.log(`    Campos detectados: ${userField} / ${passField}`);

  // Coleta todos os hidden inputs do form (company, companyId, etc.)
  const hiddenFields = [...html.matchAll(/<input[^>]+type="hidden"[^>]*>/gi)]
    .reduce((acc, m) => {
      const name  = m[0].match(/name="([^"]+)"/i)?.[1];
      const value = m[0].match(/value="([^"]*)"/i)?.[1] ?? '';
      if (name) acc[name] = value;
      return acc;
    }, {});
  console.log(`    Hidden fields: ${JSON.stringify(hiddenFields)}`);

  const body = new URLSearchParams({ ...hiddenFields, [userField]: USER, [passField]: PASS });
  if (csrfToken) body.set('_csrf', csrfToken);

  const sessionParaPost = newSession1 ?? initSession;
  const cookieEnvio = sessionParaPost
    ? `org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=pt-BR; JSESSIONID=${sessionParaPost}`
    : 'org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=pt-BR';

  console.log(`\n[3] POST ${postUrl}`);
  const r2 = await fetch(postUrl, {
    method:   'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent':   'Mozilla/5.0 codi-coletor/2.0',
      'Cookie':       cookieEnvio,
      'Origin':       BASE,
      'Referer':      loginUrl,
    },
    body,
  });

  const loc2 = r2.headers.get('location') ?? '';
  const newSession2 = extrairJsessionid(r2.headers) ?? sessionParaPost;
  console.log(`    Status: ${r2.status}  Location: ${loc2}`);
  console.log(`    JSESSIONID: ${newSession2 ? newSession2.substring(0, 12) + '...' : 'NENHUM'}`);

  if (r2.status >= 400) {
    const txt = await r2.text().catch(() => '');
    throw new Error(`Login HTTP ${r2.status}: ${txt.substring(0, 300)}`);
  }
  if (loc2.includes('error') || loc2.includes('login?error')) {
    throw new Error(`Credenciais recusadas. Location: ${loc2}`);
  }

  const authSession = newSession2;
  console.log(`    Login OK! Usando JSESSIONID: ${authSession.substring(0, 12)}...`);

  // ── Passo 4: GET /auth/authorize ─────────────────────────────
  const redirect = `${BASE}/coletor-web/pt/`;
  const authUrl  = `${BASE}/auth/authorize?response_type=token&client_id=${CLIENT_ID}&client_secret=${SECRET}&redirect_uri=${encodeURIComponent(redirect)}&state=`;

  console.log(`\n[4] GET /auth/authorize ...`);
  const r3 = await fetch(authUrl, {
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 codi-coletor/2.0',
      'Cookie': `JSESSIONID=${authSession}`,
    },
  });

  const loc3 = r3.headers.get('location') ?? '';
  console.log(`    Status: ${r3.status}  Location: ${loc3.substring(0, 150)}`);

  const params = {};
  for (const part of (loc3.match(/[#&?]([^#&?]+)/g) ?? [])) {
    const kv = part.replace(/^[#&?]/, '').split('=');
    if (kv.length === 2) params[kv[0]] = decodeURIComponent(kv[1]);
  }

  const accessToken  = params['access_token'];
  const refreshToken = params['refresh_token'];
  const expiresIn    = params['expires_in'];

  if (!accessToken) {
    const body3 = await r3.text().catch(() => '');
    console.log('\nSem token. Body:', body3.substring(0, 500));
    return;
  }

  console.log(`\n✓ Access token:  ${accessToken.substring(0, 16)}... (expires_in=${expiresIn}s)`);
  if (refreshToken) {
    console.log(`✓ Refresh token: ${refreshToken}`);
    writeFileSync('.token', refreshToken, 'utf8');
    console.log('✓ Salvo em .token!');
    console.log('\nAgora reinicie o PM2:');
    console.log('  pm2 restart codi-coletor');
  } else {
    console.log('Sem refresh_token (implicit flow nao retorna refresh_token por padrao).');
    writeFileSync('.access_token', accessToken, 'utf8');
    console.log('Access token salvo em .access_token para diagnostico.');
  }
}

main().catch(e => { console.error('\nErro:', e.message); process.exit(1); });
