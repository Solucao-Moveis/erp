// Gera dados-<sistema>/live_users.json ({email,id} do auth.users do SMERP)
// para o dedup de identidade do gen-import.js. NÃO imprime dados (PII) —
// só a contagem. Lê TARGET/SERVICE_ROLE do migrate-storage.js (gitignored).
// Uso: node gen-live-users.js <schema>     ex.: node gen-live-users.js pcp
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "migrate-storage.js"), "utf8");
const TARGET = src.match(/const TARGET = "([^"]+)"/)[1];
const SERVICE_ROLE = src.match(/const SERVICE_ROLE = "([^"]+)"/)[1];

const schema = process.argv[2];
if (!schema) { console.error("Uso: node gen-live-users.js <schema>"); process.exit(1); }

(async () => {
  const users = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${TARGET}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    });
    if (!res.ok) { console.error("HTTP", res.status, await res.text()); process.exit(1); }
    const body = await res.json();
    const batch = body.users || [];
    for (const u of batch) users.push({ email: u.email, id: u.id });
    if (batch.length < 200) break;
  }
  const out = path.join(__dirname, `dados-${schema}`, "live_users.json");
  fs.writeFileSync(out, JSON.stringify(users));
  console.log("OK ->", out, "|", users.length, "usuarios (conteudo nao exibido)");
})();
