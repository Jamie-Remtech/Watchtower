import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { en as enCore } from './en';
import { fr } from './fr';
import { es } from './es';

// English interface text also lives in per-area files (src/i18n/extra/*.js,
// default export = { key: 'English text' }) so screens can be worked on
// independently. Other languages: hand-written fr/es first, then the
// generated dictionaries in src/i18n/gen/<lang>.js (scripts/i18n-translate.mjs),
// loaded only when that language is chosen.
const EXTRA = import.meta.glob('./extra/*.js', { eager: true, import: 'default' });
const en = Object.assign({}, ...Object.values(EXTRA), enCore);
const GEN = import.meta.glob('./gen/*.js', { import: 'default' });
const genLoader = (code) => GEN[`./gen/${code}.js`];

// ============================================
// LANGUAGE — each member reads Watchtower in their own language.
// Interface words come from dictionaries (en, fr, es today; a missing
// key falls back to English). Everything PEOPLE write — messages,
// alerts, notes — is machine-translated on the fly (lib/translate.js),
// so a member can pick ANY language and still read their team.
// ============================================

const DICTS = { en, fr, es };

// Offered languages. UI dictionaries exist for en/fr/es; the others get
// English interface words but full translation of everything written.
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'uk', name: 'Українська' },
  { code: 'pl', name: 'Polski' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'tl', name: 'Filipino' },
  { code: 'sw', name: 'Kiswahili' },
];
export const hasDictionary = (code) => code === 'en' || Boolean(DICTS[code]) || Boolean(genLoader(code));
export const EN = en;

const DEVICE_KEY = 'wt-lang';
const deviceLang = () => {
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved) return saved;
  } catch { /* storage unavailable */ }
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return LANGUAGES.some(l => l.code === nav) ? nav : 'en';
};

export const langName = (code) => LANGUAGES.find(l => l.code === code)?.name ?? code;

const I18nContext = createContext({ lang: 'en', t: (k) => k, setDeviceLang: () => {} });

const interpolate = (s, vars) =>
  vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`)) : s;

export const I18nProvider = ({ children }) => {
  const { profile } = useAuth() ?? {};
  const [device, setDevice] = useState(deviceLang);
  const lang = profile?.language || device;

  const setDeviceLang = useCallback((code) => {
    try { localStorage.setItem(DEVICE_KEY, code); } catch { /* storage unavailable */ }
    setDevice(code);
  }, []);

  // generated dictionary for this language (fills what fr/es don't hand-write)
  const [gen, setGen] = useState({});
  useEffect(() => {
    const load = genLoader(lang);
    if (!load || gen[lang]) return;
    let cancelled = false;
    load().then(d => { if (!cancelled) setGen(g => ({ ...g, [lang]: d })); }).catch(() => { /* English until it loads */ });
    return () => { cancelled = true; };
  }, [lang, gen]);

  const value = useMemo(() => {
    const hand = DICTS[lang] ?? {};
    const machine = gen[lang] ?? {};
    const t = (key, vars) => interpolate(hand[key] ?? machine[key] ?? en[key] ?? key, vars);
    return { lang, t, setDeviceLang };
  }, [lang, setDeviceLang, gen]);

  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
