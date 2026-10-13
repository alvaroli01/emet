// Checks the 7 translation files: same keys everywhere, same {placeholders}, and every
// t("key") used in the code exists. Run: npm run check:i18n
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const LOCALES = ["en", "es", "de", "fr", "fi", "pt-BR", "ru"];
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) =>
  typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]);
// Top-level {name} placeholders (ignores the words inside plural branches)
const vars = (s) => {
  const out = new Set(); let depth = 0, buf = "";
  for (const ch of s) {
    if (ch === "{") { depth++; if (depth === 1) buf = ""; continue; }
    if (ch === "}") { if (depth === 1) out.add(buf.split(",")[0].trim()); depth--; continue; }
    if (depth === 1) buf += ch;
  }
  return [...out].sort().join(",");
};

let problems = 0;
const fail = (m) => { problems++; console.log("✗ " + m); };

const msgs = {};
for (const l of LOCALES) {
  try { msgs[l] = Object.fromEntries(flat(JSON.parse(readFileSync(`messages/${l}.json`, "utf8")))); }
  catch (e) { fail(`messages/${l}.json: ${e.message}`); }
}
const en = msgs.en;
for (const l of LOCALES.slice(1)) {
  if (!msgs[l]) continue;
  for (const k of Object.keys(en)) {
    if (!(k in msgs[l])) fail(`${l}: missing ${k}`);
    else if (vars(en[k]) !== vars(msgs[l][k])) fail(`${l}: placeholders differ in ${k} (${vars(en[k])} vs ${vars(msgs[l][k])})`);
    else if (l !== "en" && msgs[l][k].trim() === "") fail(`${l}: empty ${k}`);
  }
  for (const k of Object.keys(msgs[l])) if (!(k in en)) fail(`${l}: extra key ${k}`);
}

// Keys used in code
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = join(d, f);
  statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && !f.endsWith(".test.ts") && files.push(p);
});
walk("src");
let used = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const vars = {};
  for (const m of src.matchAll(/const (\w+) = (?:await )?(?:useTranslations|getTranslations)\("([\w.-]+)"\)/g)) vars[m[1]] = m[2];
  for (const [v, ns] of Object.entries(vars)) {
    for (const m of src.matchAll(new RegExp(`\\b${v}\\("([\\w.-]+)"`, "g"))) {
      used++;
      if (!(`${ns}.${m[1]}` in en)) fail(`${f}: ${ns}.${m[1]} is not in en.json`);
    }
  }
}
console.log(problems ? `\n${problems} problem(s)` : `✓ ${LOCALES.length} languages · ${Object.keys(en).length} texts · ${used} keys used in code all exist`);
process.exit(problems ? 1 : 0);
