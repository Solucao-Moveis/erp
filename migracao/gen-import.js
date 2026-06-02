// Gera o SQL de importação a partir do JSON exportado (genérico por sistema).
// Uso: node gen-import.js <schema>
//   ex.: node gen-import.js fabrill | node gen-import.js bip | node gen-import.js compras
const fs = require("fs");
const path = require("path");

// Config por sistema: dir dos dados, ordem segura de FK e colunas GENERATED (puladas).
const SCHEMAS = {
  fabrill: {
    dir: "dados-fabrill",
    order: ["areas", "machines", "profiles", "user_roles", "user_areas",
      "production_goals", "machine_operators", "production_entries",
      "viewer_tokens", "overtime_days", "meta_justifications",
      "production_deviations", "collaborators"],
    generated: { production_deviations: ["total_weight"] },
  },
  bip: {
    dir: "dados-bip",
    order: ["products", "loading_orders", "loading_order_items", "scanned_codes",
      "profiles", "user_roles", "audit_log", "loading_photos"],
    generated: {},
    priorSystems: ["dados-fabrill"],
    userRefs: [["profiles", "id"], ["user_roles", "user_id"], ["audit_log", "user_id"]],
  },
  compras: {
    dir: "dados-compras",
    order: ["profiles", "user_roles", "sectors", "cost_centers", "request_sequences",
      "items", "purchase_requests", "request_items", "request_comments",
      "request_history", "request_attachments", "notifications"],
    generated: {},
    priorSystems: ["dados-fabrill", "dados-bip"],
    userRefs: [["profiles", "id"], ["user_roles", "user_id"], ["sectors", "approver_id"],
      ["purchase_requests", "requester_id"], ["purchase_requests", "approver_id"],
      ["request_comments", "user_id"], ["request_history", "user_id"],
      ["request_attachments", "uploaded_by"], ["notifications", "user_id"]],
    // divide em arquivos menores (cada parte = 1 transação; rodar em ordem)
    split: [
      ["profiles", "user_roles", "sectors", "cost_centers", "request_sequences", "items"],
      ["purchase_requests", "request_items", "request_comments", "request_history"],
      ["request_attachments", "notifications"],
    ],
  },
};

const schema = process.argv[2];
const cfg = SCHEMAS[schema];
if (!cfg) { console.error("Schema desconhecido. Use: fabrill | bip | compras"); process.exit(1); }

const DIR = path.join(__dirname, cfg.dir);
const tables = JSON.parse(fs.readFileSync(path.join(DIR, "tables.json"), "utf8")).tables;
const users = JSON.parse(fs.readFileSync(path.join(DIR, "users.json"), "utf8")).users;

// ----- Identidade compartilhada entre sistemas (dedup por email) -----
// Emails já importados por sistemas anteriores: id canônico = o que já está no auth.users.
const priorEmailToId = {};
for (const pdir of (cfg.priorSystems || [])) {
  const pu = JSON.parse(fs.readFileSync(path.join(__dirname, pdir, "users.json"), "utf8")).users;
  for (const u of pu) if (u.email && !(u.email in priorEmailToId)) priorEmailToId[u.email] = u.id;
}
// Mapa id-deste-sistema -> id-canônico (reaproveita o anterior quando o email já existe).
const idMap = {};
for (const u of users) idMap[u.id] = (u.email && priorEmailToId[u.email]) ? priorEmailToId[u.email] : u.id;
const mapId = (v) => (v != null && idMap[v]) ? idMap[v] : v;
// Conjunto de colunas (tabela.coluna) que referenciam auth.users e precisam remapear.
const userRefSet = new Set((cfg.userRefs || []).map(([t, c]) => `${t}.${c}`));

function q(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }
function val(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "'{}'::text[]";
    return "ARRAY[" + v.map((e) => q(e)).join(",") + "]::text[]";
  }
  if (typeof v === "object") return q(JSON.stringify(v)) + "::jsonb";
  return q(v);
}

function authSection() {
  let s = `-- ===== auth.users (preserva o id original; pula emails que já existem de outro sistema) =====\n`;
  for (const u of users) {
    if (u.email && priorEmailToId[u.email]) continue;
    const cols = ["instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","created_at","updated_at","raw_app_meta_data","raw_user_meta_data","is_sso_user","is_anonymous"];
    const vals = [
      "'00000000-0000-0000-0000-000000000000'",
      q(u.id), "'authenticated'", "'authenticated'",
      u.email ? q(u.email) : "NULL", "NULL",
      u.email_confirmed_at ? q(u.email_confirmed_at) : "now()",
      u.created_at ? q(u.created_at) : "now()", "now()",
      val(u.raw_app_meta_data || {}), val(u.raw_user_meta_data || {}),
      "false", "false",
    ];
    s += `INSERT INTO auth.users (${cols.join(",")}) VALUES (${vals.join(",")}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  s += `\n-- ===== auth.identities (login por email) =====\n`;
  for (const u of users) {
    if (!u.email || priorEmailToId[u.email]) continue;
    const idata = { sub: u.id, email: u.email, email_verified: true, phone_verified: false };
    s += `INSERT INTO auth.identities (provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at) VALUES (${q(u.id)},${q(u.id)},${val(idata)},'email',now(),${u.created_at ? q(u.created_at) : "now()"},now()) ON CONFLICT (provider,provider_id) DO NOTHING;\n`;
  }
  return s + "\n";
}

function tableSection(t) {
  const rows = tables[t] || [];
  let s = `-- ===== ${schema}.${t} (${rows.length}) =====\n`;
  if (rows.length === 0) return s + "\n";
  const skip = cfg.generated[t] || [];
  const cols = Object.keys(rows[0]).filter((c) => !skip.includes(c));
  for (const r of rows) {
    const vs = cols.map((c) => userRefSet.has(`${t}.${c}`) ? val(mapId(r[c])) : val(r[c]));
    s += `INSERT INTO ${schema}.${t} (${cols.join(",")}) VALUES (${vs.join(",")}) ON CONFLICT DO NOTHING;\n`;
  }
  return s + "\n";
}

const header = `-- IMPORT DE DADOS — schema ${schema} (gerado de export Lovable). Idempotente.\n`;
const parts = cfg.split || [cfg.order]; // sem split = 1 arquivo com tudo

parts.forEach((groupTables, i) => {
  const single = !cfg.split;
  let s = header + `\nBEGIN;\n\n`;
  if (i === 0) s += authSection();           // auth só na 1ª parte
  for (const t of groupTables) s += tableSection(t);
  s += "COMMIT;\n";
  const suffix = single ? "" : `_${i + 1}`;
  const outPath = path.join(__dirname, `import_${schema}${suffix}.sql`);
  fs.writeFileSync(outPath, s, "utf8");
  console.log("OK ->", path.basename(outPath), "(" + Math.round(fs.statSync(outPath).size / 1024) + " KB)", "→", groupTables.join(", "));
});
console.log("usuarios:", users.length);
