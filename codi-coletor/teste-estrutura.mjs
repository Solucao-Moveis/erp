/**
 * Teste avulso — ConsultaEstruturaProduto (API Industrial)
 * Rodar diretamente: node teste-estrutura.mjs
 * Não commitar (está no .gitignore).
 */

import http from 'http';
import 'dotenv/config';

const TOKEN = process.env.CODI_API_INDUSTRIAL_TOKEN;
if (!TOKEN) { console.error('Defina CODI_API_INDUSTRIAL_TOKEN no .env'); process.exit(1); }

// Testa os dois servidores / paths mais prováveis
const TARGETS = [
  { host: '10.7.10.234', port: 8080, path: 'API_Industrial18_Producao' },
  { host: '10.7.10.239', port: 8080, path: 'API_Industrial18_Producao' },
  { host: '10.7.10.234', port: 8080, path: 'API_Industrial_Producao'   },
  { host: '10.7.10.239', port: 8080, path: 'API_Industrial_Producao'   },
  { host: '192.168.2.210', port: 8080, path: 'API_Industrial18_Producao' },
];

function probe(host, port, apiPath, endpoint, body) {
  return new Promise(resolve => {
    const bodyStr = JSON.stringify(body);
    const req = http.request({
      hostname: host, port, method: 'GET',
      path: `/${apiPath}/Core/${endpoint}`,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ ok: res.statusCode < 300, status: res.statusCode, data }));
    });
    req.on('error', e => resolve({ ok: false, status: 0, data: e.message }));
    req.setTimeout(6000, () => { req.destroy(); resolve({ ok: false, status: 0, data: 'timeout' }); });
    req.write(bodyStr);
    req.end();
  });
}

console.log('\n=== Testando conectividade + endpoint ===\n');

for (const t of TARGETS) {
  const label = `${t.host}:${t.port}/${t.path}`;
  process.stdout.write(`${label} ... `);
  const r = await probe(t.host, t.port, t.path, 'API_Produto/ConsultaEstruturaProduto', {
    ApiToken: TOKEN, DataEstrutura: '01/01/2023', CodigoPai: '',
  });
  if (r.ok) {
    console.log(`✓ HTTP ${r.status}`);
    let json;
    try { json = JSON.parse(r.data); } catch { console.log('  resposta não-JSON:', r.data.slice(0, 200)); continue; }
    const arr = Array.isArray(json) ? json : (json.Estrutura ?? json.Result ?? [json]);
    console.log(`  Total registros: ${arr.length}`);
    if (arr.length > 0) {
      console.log('  Exemplo (primeiro):', JSON.stringify(arr[0], null, 2));
    }
    console.log('\n=== FUNCIONA! URL para o .env: ===');
    console.log(`CODI_INDUSTRIAL_URL=http://${t.host}:${t.port}/${t.path}`);
    break;
  } else {
    console.log(`✗ ${r.status || r.data}`);
  }
}
