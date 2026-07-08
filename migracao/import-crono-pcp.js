// Importa pcp.cronoanalises (137k linhas) no SMERP via REST em lotes —
// grande demais pro SQL Editor. Rodar DEPOIS de:
//   1. pcp_schema.sql aplicado;
//   2. import_pcp.sql aplicado (usuários/cadastros);
//   3. schema pcp exposto no PostgREST (PGRST_DB_SCHEMAS += ,pcp).
// Idempotente: on_conflict=id + ignore-duplicates (pode rodar de novo).
// Lê TARGET/SERVICE_ROLE do migrate-storage.js (gitignored).
// Uso: node import-crono-pcp.js
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "migrate-storage.js"), "utf8");
const TARGET = src.match(/const TARGET = "([^"]+)"/)[1];
const SERVICE_ROLE = src.match(/const SERVICE_ROLE = "([^"]+)"/)[1];

const DIR = path.join(__dirname, "dados-pcp");
const rows = JSON.parse(fs.readFileSync(path.join(DIR, "tables.json"), "utf8")).tables.cronoanalises;

// mesmo remapeamento de identidade do gen-import.js (created_by → id canônico)
const users = JSON.parse(fs.readFileSync(path.join(DIR, "users.json"), "utf8")).users;
const live = JSON.parse(fs.readFileSync(path.join(DIR, "live_users.json"), "utf8"));
const liveArr = Array.isArray(live) ? live : (live.users || []);
const emailToId = {};
for (const u of liveArr) if (u.email && !(u.email in emailToId)) emailToId[u.email] = u.id;
const idMap = {};
for (const u of users) idMap[u.id] = (u.email && emailToId[u.email]) ? emailToId[u.email] : u.id;
for (const r of rows) if (r.created_by && idMap[r.created_by]) r.created_by = idMap[r.created_by];

const BATCH = 1000;
(async () => {
  console.log("cronoanalises:", rows.length, "linhas em lotes de", BATCH);
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(`${TARGET}/rest/v1/cronoanalises?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
        "Content-Profile": "pcp",
        Prefer: "return=minimal,resolution=ignore-duplicates",
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      console.error(`ERRO no lote ${i}-${i + batch.length}: HTTP ${res.status}`, await res.text());
      process.exit(1);
    }
    process.stdout.write(`\r${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  console.log("\nOK. Confira: GET /rest/v1/cronoanalises?select=count (Accept-Profile: pcp)");
})();
