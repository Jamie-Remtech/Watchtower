// Generates interface dictionaries for every offered language with the app's
// own translation engine (field-assist, mode 'translate', format 'ui').
//   node scripts/i18n-translate.mjs            all languages, only what's missing/changed
//   node scripts/i18n-translate.mjs de pt      just these
// Writes src/i18n/gen/<lang>.js (+ _sources.json: the English each translation
// was made from, so changed English is re-translated) and the homepage /
// tutorial into src/public/content.gen.js. fr/es keep their hand-written
// dictionaries; only keys those lack are generated.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const impFresh = (p) => import(pathToFileURL(path.join(ROOT, p)).href + '?t=' + Date.now());

const env = Object.fromEntries(
  fs.readdirSync(ROOT).filter(f => f.startsWith('.env')).flatMap(f => fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/))
    .map(l => l.match(/^\s*(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)\s*=\s*(.+)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const URL_ = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not found in .env');

const ALL = ['fr', 'es', 'pt', 'de', 'it', 'uk', 'pl', 'tr', 'ar', 'hi', 'zh', 'ja', 'tl', 'sw'];
const HOME_LANGS = ALL.filter(l => l !== 'fr' && l !== 'es');
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

// ---------- English master ----------
const { en: core } = await imp('src/i18n/en.js');
const extraDir = path.join(ROOT, 'src/i18n/extra');
const extras = {};
for (const f of fs.readdirSync(extraDir).filter(f => f.endsWith('.js'))) Object.assign(extras, (await imp(`src/i18n/extra/${f}`)).default);
const EN = { ...extras, ...core };
const hand = { fr: (await imp('src/i18n/fr.js')).fr, es: (await imp('src/i18n/es.js')).es };

// ---------- engine ----------
const PH = /\{(\w+)\}/g;
const protect = (s) => { const names = []; const out = s.replace(PH, (_, n) => { names.push(n); return `⟦${names.length - 1}⟧`; }); return { out, names }; };
const restore = (s, names) => {
  for (let i = 0; i < names.length; i++) {
    const tok = `⟦${i}⟧`;
    if (s.split(tok).length !== 2) return null; // missing or duplicated placeholder
    s = s.replace(tok, `{${names[i]}}`);
  }
  return /⟦\d+⟧/.test(s) ? null : s;
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function callEngine(texts, target) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(`${URL_}/functions/v1/field-assist`, {
        method: 'POST',
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'translate', format: 'ui', target, texts }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(j.translations) && j.translations.length === texts.length) return j.translations;
      if (attempt === 4) throw new Error(j.error ?? `HTTP ${r.status}`);
    } catch (e) { if (attempt === 4) throw e; }
    await sleep(1500 * attempt);
  }
}
// batches: ≤ 30 items and ≤ 2500 characters
function batches(items) {
  const out = []; let cur = []; let chars = 0;
  for (const it of items) {
    if (cur.length && (cur.length >= 30 || chars + it.text.length > 2500)) { out.push(cur); cur = []; chars = 0; }
    cur.push(it); chars += it.text.length;
  }
  if (cur.length) out.push(cur);
  return out;
}
async function pool(jobs, n) {
  const results = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const k = i++; results[k] = await jobs[k](); } }));
  return results;
}
// translate [{id, text}] → { id: translated } (failed items omitted → English fallback at runtime)
async function translateItems(items, target, label) {
  const result = {}; let failed = 0;
  const jobs = batches(items).map(batch => async () => {
    const prot = batch.map(it => protect(it.text));
    let tr;
    try { tr = await callEngine(prot.map(p => p.out), target); } catch (e) { failed += batch.length; console.log(`  ! ${label} batch failed: ${e.message}`); return; }
    for (let i = 0; i < batch.length; i++) {
      let s = restore(String(tr[i] ?? '').trim(), prot[i].names);
      if (!s) {
        try { s = restore(String((await callEngine([prot[i].out], target))[0] ?? '').trim(), prot[i].names); } catch { s = null; }
      }
      if (s) result[batch[i].id] = s; else failed++;
    }
    process.stdout.write('.');
  });
  await pool(jobs, 5);
  process.stdout.write('\n');
  return { result, failed };
}

// ---------- interface dictionaries ----------
const genDir = path.join(ROOT, 'src/i18n/gen');
fs.mkdirSync(genDir, { recursive: true });
const srcFile = path.join(genDir, '_sources.json');
const sources = fs.existsSync(srcFile) ? JSON.parse(fs.readFileSync(srcFile, 'utf8')) : {};
const report = [];
for (const lang of targets) {
  const file = path.join(genDir, `${lang}.js`);
  const existing = fs.existsSync(file) ? (await impFresh(`src/i18n/gen/${lang}.js`)).default : {};
  const src = sources[lang] ?? {};
  const keep = {};
  const todo = [];
  for (const [k, v] of Object.entries(EN)) {
    if (hand[lang]?.[k] != null) continue;            // hand-written wins
    if (existing[k] != null && src[k] === v) { keep[k] = existing[k]; continue; }
    todo.push({ id: k, text: v });
  }
  console.log(`${lang}: ${todo.length} to translate, ${Object.keys(keep).length} kept`);
  const { result, failed } = todo.length ? await translateItems(todo, lang, lang) : { result: {}, failed: 0 };
  const merged = { ...keep, ...result };
  const ordered = Object.fromEntries(Object.keys(EN).filter(k => merged[k] != null).map(k => [k, merged[k]]));
  fs.writeFileSync(file, `// Generated by scripts/i18n-translate.mjs — machine translation, pending native review.\nexport default ${JSON.stringify(ordered, null, 1)};\n`);
  sources[lang] = Object.fromEntries(Object.keys(ordered).map(k => [k, EN[k]]));
  fs.writeFileSync(srcFile, JSON.stringify(sources, null, 1));
  report.push(`${lang}: ${Object.keys(ordered).length} keys, ${failed} fell back to English`);
}

// ---------- homepage + tutorial ----------
const { CONTENT } = await imp('src/public/content.js');
const leaves = [];
const walk = (v, p) => { if (typeof v === 'string') leaves.push({ id: p.join('|'), text: v }); else if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...p, i])); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, [...p, k]); };
walk(CONTENT.en, []);
const homeFile = path.join(ROOT, 'src/public/content.gen.js');
const homeSrcFile = path.join(ROOT, 'src/public/content.gen.sources.json');
const homeExisting = fs.existsSync(homeFile) ? (await impFresh('src/public/content.gen.js')).default : {};
const homeSources = fs.existsSync(homeSrcFile) ? JSON.parse(fs.readFileSync(homeSrcFile, 'utf8')) : {};
const isEmojiOnly = (s) => !/[A-Za-z]/.test(s);
const build = (tr) => {
  const clone = (v, p) => (typeof v === 'string' ? (tr[p.join('|')] ?? v)
    : Array.isArray(v) ? v.map((x, i) => clone(x, [...p, i]))
    : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x, [...p, k])])));
  return clone(CONTENT.en, []);
};
const flatten = (obj) => { const m = {}; const w = (v, p) => { if (typeof v === 'string') m[p.join('|')] = v; else if (Array.isArray(v)) v.forEach((x, i) => w(x, [...p, i])); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) w(x, [...p, k]); }; w(obj, []); return m; };
const homeOut = { ...homeExisting };
for (const lang of targets.filter(l => HOME_LANGS.includes(l))) {
  const prev = homeExisting[lang] ? flatten(homeExisting[lang]) : {};
  const srcs = homeSources[lang] ?? {};
  const tr = {}; const todo = [];
  for (const it of leaves) {
    if (isEmojiOnly(it.text)) continue;
    if (prev[it.id] != null && srcs[it.id] === it.text) tr[it.id] = prev[it.id]; else todo.push(it);
  }
  console.log(`home ${lang}: ${todo.length} to translate`);
  const { result, failed } = todo.length ? await translateItems(todo, lang, `home ${lang}`) : { result: {}, failed: 0 };
  Object.assign(tr, result);
  homeOut[lang] = build(tr);
  homeSources[lang] = Object.fromEntries(leaves.map(it => [it.id, it.text]));
  fs.writeFileSync(homeFile, `// Generated by scripts/i18n-translate.mjs — machine translation, pending native review.\nexport default ${JSON.stringify(homeOut, null, 1)};\n`);
  fs.writeFileSync(homeSrcFile, JSON.stringify(homeSources, null, 1));
  report.push(`home ${lang}: ${failed} fell back to English`);
}
console.log('\n' + report.join('\n'));
