// Despeja JSON bruto de ConsultarProduto para inspecionar todos os campos
// node teste-campos-produto.mjs [codigo]   (default: 1101301)
import http from 'http';
import 'dotenv/config';

const BASE  = (process.env.CODI_INDUSTRIAL_URL  || '').replace(/\/$/, '');
const TOKEN = process.env.CODI_INDUSTRIAL_TOKEN || '';
if (!BASE || !TOKEN) { console.error('Sem CODI_INDUSTRIAL_URL / CODI_INDUSTRIAL_TOKEN'); process.exit(1); }

function post(endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ ApiToken: TOKEN, ...body });
    const url = new URL(`${BASE}/Core/${endpoint}`);
    const req = http.request({
      hostname: url.hostname, port: parseInt(url.port || '80', 10),
      method: 'POST', path: url.pathname,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(30_000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload); req.end();
  });
}

const codigo = process.argv[2] || '1101301';
console.log(`\n=== ConsultarProduto: ${codigo} ===\n`);

const r = await post('API_Produto/ConsultarProduto', {
  Produto: [{ Codigo: codigo }],
});
console.log('HTTP', r.status, '\n');

let arr;
try { arr = JSON.parse(r.body); if (!Array.isArray(arr)) arr = [arr]; }
catch { console.log('Não-JSON:', r.body.slice(0, 500)); process.exit(1); }

if (!arr.length) { console.log('Resposta vazia'); process.exit(0); }

console.log('=== JSON completo ===');
console.log(JSON.stringify(arr[0], null, 2));

console.log('\n=== Chaves disponíveis ===');
console.log(Object.keys(arr[0]).join('\n'));
