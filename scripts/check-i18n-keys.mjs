// Every static t('key') used in src/ must have English text (src/i18n/en.js
// or src/i18n/extra/*.js). Template keys (t(`a.${x}`)) are listed, not checked.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { en } = await imp('src/i18n/en.js');
const EN = { ...en };
for (const f of fs.readdirSync(path.join(ROOT, 'src/i18n/extra')).filter(f => f.endsWith('.js'))) {
  const part = (await imp(`src/i18n/extra/${f}`)).default;
  for (const k of Object.keys(part)) if (k in EN && EN[k] !== part[k] && !(k in en)) console.log(`duplicate key with different text: ${k} (${f})`);
  Object.assign(EN, part);
}
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!['i18n', 'node_modules'].includes(e.name)) walk(p); } else if (/\.(jsx?|tsx?)$/.test(e.name)) files.push(p); } };
walk(path.join(ROOT, 'src'));
const missing = [];
let used = 0;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/\b(?:t|tt|tRef\.current)\(\s*'([a-zA-Z][\w.-]*)'/g)) {
    used++;
    if (!(m[1] in EN)) missing.push(`${path.relative(ROOT, f)}: ${m[1]}`);
  }
}
console.log(`${Object.keys(EN).length} English keys, ${used} static uses, ${missing.length} missing`);
if (missing.length) { console.log(missing.join('\n')); process.exit(1); }
