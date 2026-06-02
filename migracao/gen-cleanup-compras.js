// Remove linhas geradas por triggers durante o import (id não presente no export real).
const fs = require("fs");
const path = require("path");
const t = JSON.parse(fs.readFileSync(path.join(__dirname, "dados-compras", "tables.json"), "utf8")).tables;

function delNotIn(table, rows) {
  const ids = rows.map((r) => `'${r.id}'`);
  return `DELETE FROM compras.${table} WHERE id NOT IN (\n  ${ids.join(",\n  ")}\n);\n`;
}

let out = "-- Limpeza: apaga linhas criadas por triggers durante o import (compras)\nBEGIN;\n\n";
out += `-- request_history: manter só os ${t.request_history.length} ids reais\n`;
out += delNotIn("request_history", t.request_history) + "\n";
out += `-- notifications: manter só os ${t.notifications.length} ids reais\n`;
out += delNotIn("notifications", t.notifications) + "\n";
out += "COMMIT;\n";

const p = path.join(__dirname, "cleanup_compras.sql");
fs.writeFileSync(p, out, "utf8");
console.log("OK ->", path.basename(p), "(" + Math.round(fs.statSync(p).size / 1024) + " KB)");
console.log("manter request_history:", t.request_history.length, "| notifications:", t.notifications.length);
