// ============================================
// FIELD COMMAND GRAMMAR
// Short spoken commands drawn from SALT / TCCC practice. Anything
// that isn't a command is a log entry for the active patient.
// ============================================

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, to: 2, too: 2, for: 4,
};

const TRIAGE_WORDS = { red: 'red', yellow: 'yellow', green: 'green', gray: 'gray', grey: 'gray', black: 'black' };

const clean = (t) => t.trim().replace(/[.,!?]+$/g, '').toLowerCase();

const parseNumber = (w) => {
  if (/^\d+$/.test(w)) return parseInt(w, 10);
  return NUMBER_WORDS[w] ?? null;
};

// parse(text) -> one of:
//  { type: 'new_patient' }
//  { type: 'switch_patient', num } | { type: 'switch_patient', tag }
//  { type: 'triage', color }
//  { type: 'status', status }
//  { type: 'mark' }
//  { type: 'entry', text }   (default: log it)
export const parseCommand = (raw) => {
  const t = clean(raw);
  if (!t) return null;

  if (/^(new|next) (patient|casualty)$/.test(t)) return { type: 'new_patient' };

  let m = t.match(/^patient tag ([\w-]+)$/);
  if (m) return { type: 'switch_patient', tag: m[1] };

  m = t.match(/^patient (\w+)$/);
  if (m) {
    const num = parseNumber(m[1]);
    if (num != null) return { type: 'switch_patient', num };
  }

  m = t.match(/^triage (\w+)$/);
  if (m && TRIAGE_WORDS[m[1]]) return { type: 'triage', color: TRIAGE_WORDS[m[1]] };

  if (/^(transported|patient transported)$/.test(t)) return { type: 'status', status: 'transported' };
  if (/^(handed off|handoff complete)$/.test(t)) return { type: 'status', status: 'handed_off' };

  if (/^(mark|mark time|timestamp|time stamp)$/.test(t)) return { type: 'mark' };

  // Patient file — keeps the spoken casing for names and drugs.
  const r = raw.trim().replace(/[.!?]+$/g, '');
  m = r.match(/^(?:patient(?:'s)? )?name(?: is)?:? (.+)$/i);
  if (m) return { type: 'record', field: 'name', value: m[1].trim() };
  if (/^(no known allergies|no allergies|nka|nkda)$/.test(t)) return { type: 'record', field: 'nka' };
  m = r.match(/^(?:allergic to|allergy to|allergies to|allergies|allergy):? (.+)$/i);
  if (m) return { type: 'record', field: 'allergies', value: m[1].trim() };
  m = t.match(/^blood (?:type |group )?(.+)$/);
  if (m) { const b = parseBlood(m[1]); if (b) return { type: 'record', field: 'blood_type', value: b }; }
  m = t.match(/^(?:age|aged) (\d{1,3})$/) || t.match(/^(\d{1,3}) years? old$/);
  if (m) return { type: 'record', field: 'age_est', value: parseInt(m[1], 10) };
  m = t.match(/^(?:sex )?(male|female)(?: patient)?$/);
  if (m) return { type: 'record', field: 'sex', value: m[1] };

  return { type: 'entry', text: raw.trim() };
};

// "o positive", "oh negative", "a b plus", "0+" → "O+"
const parseBlood = (s) => {
  const x = s.replace(/\b(oh|zero|0)\b/g, 'o').replace(/\ba b\b/g, 'ab').replace(/\s+/g, ' ').trim();
  const m = x.match(/^(ab|a|b|o) ?(positive|plus|pos|\+|negative|minus|neg|-)$/) || x.match(/^(ab|a|b|o)(\+|-)$/);
  if (!m) return /^unknown$/.test(x) ? 'unknown' : null;
  return m[1].toUpperCase() + (/^(positive|plus|pos|\+)$/.test(m[2]) ? '+' : '-');
};

export const TRIAGE_META = {
  red: { label: 'Immediate', dot: '#ef4444' },
  yellow: { label: 'Delayed', dot: '#eab308' },
  green: { label: 'Minimal', dot: '#22c55e' },
  gray: { label: 'Expectant', dot: '#9ca3af' },
  black: { label: 'Deceased', dot: '#1e293b' },
  unknown: { label: 'Untriaged', dot: '#64748b' },
};
