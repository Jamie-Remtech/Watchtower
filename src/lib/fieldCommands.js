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

  return { type: 'entry', text: raw.trim() };
};

export const TRIAGE_META = {
  red: { label: 'Immediate', dot: '#ef4444' },
  yellow: { label: 'Delayed', dot: '#eab308' },
  green: { label: 'Minimal', dot: '#22c55e' },
  gray: { label: 'Expectant', dot: '#9ca3af' },
  black: { label: 'Deceased', dot: '#1e293b' },
  unknown: { label: 'Untriaged', dot: '#64748b' },
};
