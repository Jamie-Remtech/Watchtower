import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { getOrgId } from './org';

// ============================================
// MACHINE TRANSLATION of what people and the tower write — messages,
// alert titles, notes. Three layers so each sentence is translated
// once per language per company: memory → translations table → AI.
// Emergency rule: the original is always one tap away in the UI.
// ============================================

const mem = new Map(); // `${lang}|${hash}` → text

// FNV-1a 64-bit as hex: fast, stable, good enough to key a cache
export const hashText = (s) => {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16);
};

export async function translateMany(texts, lang) {
  const out = texts.map(() => null);
  if (!lang || lang === 'en' && texts.every(t => /^[\x20-\x7e\s]*$/.test(t ?? ''))) {
    // English reader + plain-ASCII text: nothing to do
    return texts;
  }
  const todo = [];
  texts.forEach((t, i) => {
    if (!t || !t.trim()) { out[i] = t; return; }
    const k = `${lang}|${hashText(t)}`;
    if (mem.has(k)) out[i] = mem.get(k);
    else todo.push(i);
  });
  if (!todo.length) return out;

  const orgId = await getOrgId();
  const hashes = [...new Set(todo.map(i => hashText(texts[i])))];
  if (orgId) {
    const { data } = await supabase.from('translations')
      .select('src_hash, text').eq('org_id', orgId).eq('lang', lang).in('src_hash', hashes);
    for (const row of data ?? []) mem.set(`${lang}|${row.src_hash}`, row.text);
  }

  const missing = [...new Set(todo.map(i => texts[i]).filter(t => !mem.has(`${lang}|${hashText(t)}`)))];
  for (let s = 0; s < missing.length; s += 30) {
    const chunk = missing.slice(s, s + 30);
    try {
      const { data } = await supabase.functions.invoke('field-assist', {
        body: { mode: 'translate', texts: chunk, target: lang },
      });
      const tr = data?.translations;
      if (Array.isArray(tr) && tr.length === chunk.length) {
        const rows = chunk.map((src, j) => {
          mem.set(`${lang}|${hashText(src)}`, tr[j]);
          return { org_id: orgId, src_hash: hashText(src), lang, text: tr[j] };
        });
        if (orgId) await supabase.from('translations').upsert(rows, { onConflict: 'org_id,src_hash,lang', ignoreDuplicates: true });
      }
    } catch { /* translation unavailable — originals stay */ }
  }

  todo.forEach(i => { out[i] = mem.get(`${lang}|${hashText(texts[i])}`) ?? texts[i]; });
  return out;
}

// texts in → { [original]: translated } once ready (originals until then)
export const useTranslations = (texts, lang, enabled = true) => {
  const key = enabled ? `${lang}|${texts.join('\u0001')}` : '';
  const [map, setMap] = useState({});
  useEffect(() => {
    if (!enabled || !texts.length) return;
    let cancelled = false;
    translateMany(texts, lang).then(tr => {
      if (cancelled) return;
      setMap(Object.fromEntries(texts.map((t, i) => [t, tr[i] ?? t])));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
};
