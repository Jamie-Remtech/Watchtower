import { supabase } from './supabase';
import { getOrgId } from './org';

// ============================================
// PATIENT FILE — identity + medical facts that travel with the patient.
// Personal health information: stored in patient_records (field rank and
// up, same company only), ID photos in the private 'patient-files' bucket.
// Every change keeps the previous version (trigger); every view, print,
// share or copy is written to patient_record_access.
// ============================================

export const SEXES = ['female', 'male', 'other', 'unknown'];
export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'];

// Form layout: [section, [[field, input kind], …]]
export const SECTIONS = [
  ['identity', [['last_name', 'text'], ['first_name', 'text'], ['dob', 'date'], ['age_est', 'number'], ['sex', 'sex'], ['language', 'text'], ['phone', 'tel'], ['address', 'text']]],
  ['ids', [['id_type', 'text'], ['id_number', 'text'], ['id_issuer', 'text'], ['health_card', 'text'], ['health_card_issuer', 'text'], ['health_card_expiry', 'text']]],
  ['emergency', [['emergency_name', 'text'], ['emergency_relation', 'text'], ['emergency_phone', 'tel']]],
  ['medical', [['blood_type', 'blood'], ['allergies', 'area'], ['medications', 'area'], ['conditions', 'area'], ['weight_kg', 'number'], ['notes', 'area']]],
];
export const FIELDS = SECTIONS.flatMap(([, f]) => f.map(([k]) => k)).concat('no_known_allergies');

// What a receiving hospital needs before the file counts as complete.
export const REQUIRED = [
  ['name', r => r.last_name || r.first_name],
  ['age', r => r.dob || r.age_est != null],
  ['sex', r => r.sex],
  ['allergies', r => r.allergies || r.no_known_allergies],
  ['blood_type', r => r.blood_type],
  ['medications', r => r.medications],
  ['health_card', r => r.health_card || r.id_number],
  ['emergency', r => r.emergency_name || r.emergency_phone],
];
export const missingFields = (r) => REQUIRED.filter(([, ok]) => !ok(r ?? {})).map(([k]) => k);

export const ageOf = (r) => {
  if (r?.dob) {
    const d = new Date(r.dob + 'T00:00:00');
    if (!isNaN(d)) {
      const now = new Date();
      let a = now.getFullYear() - d.getFullYear();
      if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
      return a;
    }
  }
  return r?.age_est ?? null;
};

export const fullName = (r) => [r?.first_name, r?.last_name].filter(Boolean).join(' ');
export const shortName = (r) => r?.last_name || r?.first_name || '';

// The record without empty strings; numbers as numbers.
export const cleanRecord = (draft) => {
  const out = {};
  for (const k of FIELDS) {
    let v = draft?.[k];
    if (k === 'no_known_allergies') { out[k] = !!v; continue; }
    if (typeof v === 'string') v = v.trim();
    if (v === '' || v === undefined) v = null;
    if ((k === 'age_est' || k === 'weight_kg') && v != null) { const n = Number(v); v = Number.isFinite(n) ? n : null; }
    out[k] = v;
  }
  return out;
};

export async function saveRecord(patientId, draft) {
  const org = await getOrgId();
  const { data, error } = await supabase.from('patient_records')
    .upsert({ patient_id: patientId, org_id: org, ...cleanRecord(draft) }, { onConflict: 'patient_id' })
    .select().single();
  if (error) throw error;
  return data;
}

export async function logAccess(patientId, action) {
  try {
    const org = await getOrgId();
    await supabase.from('patient_record_access').insert({ patient_id: patientId, org_id: org, action });
  } catch { /* the log never blocks care */ }
}

// ---------- photos ----------

// Shrink a camera photo to ≤1600 px JPEG (~300–600 KB): quick to upload on
// one bar of signal and small enough for the AI reader.
export async function compressImage(file, max = 1600, quality = 0.85) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('compress failed'))), 'image/jpeg', quality));
  } finally { URL.revokeObjectURL(url); }
}

const toBase64 = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.onerror = rej;
  r.readAsDataURL(blob);
});

export async function uploadPhoto(patientId, blob, kind = 'id') {
  const org = await getOrgId();
  const path = `${org}/${patientId}/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage.from('patient-files').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (up.error) throw up.error;
  const { data, error } = await supabase.from('patient_files')
    .insert({ patient_id: patientId, org_id: org, kind, path }).select().single();
  if (error) { await supabase.storage.from('patient-files').remove([path]); throw error; }
  logAccess(patientId, 'photo');
  return data;
}

export async function listPhotos(patientId) {
  const { data } = await supabase.from('patient_files').select('*').eq('patient_id', patientId).order('created_at');
  const rows = data ?? [];
  if (!rows.length) return [];
  const { data: signed } = await supabase.storage.from('patient-files').createSignedUrls(rows.map(r => r.path), 3600);
  const byPath = Object.fromEntries((signed ?? []).map(s => [s.path, s.signedUrl]));
  return rows.map(r => ({ ...r, url: byPath[r.path] ?? null }));
}

export async function deletePhoto(file) {
  const { error } = await supabase.from('patient_files').delete().eq('id', file.id);
  if (error) throw error;
  await supabase.storage.from('patient-files').remove([file.path]);
}

// Read a photographed ID / health card with the AI. Returns form fields.
export async function readIdPhoto(blob) {
  const image = await toBase64(blob);
  const { data, error } = await supabase.functions.invoke('field-assist', { body: { mode: 'id_extract', image, media_type: 'image/jpeg' } });
  if (error || !data?.fields) throw error ?? new Error(data?.error ?? 'no result');
  return data.fields;
}

// Map what the AI read onto the form: empty fields are filled, differing
// ones come back as suggestions for the responder to accept.
export function mergeExtracted(draft, ex) {
  const map = {
    last_name: ex.last_name, first_name: ex.first_name, dob: ex.dob, sex: ex.sex, address: ex.address,
    id_type: ex.id_type || (ex.id_number ? ex.doc_type : null), id_number: ex.id_number, id_issuer: ex.id_issuer,
    health_card: ex.health_card, health_card_issuer: ex.health_card_issuer, health_card_expiry: ex.health_card_expiry,
    blood_type: BLOOD_TYPES.includes(String(ex.blood_type ?? '').toUpperCase().replace(/\s+/g, '').replace('POS', '+').replace('NEG', '-')) ? String(ex.blood_type).toUpperCase().replace(/\s+/g, '').replace('POS', '+').replace('NEG', '-') : null,
    allergies: ex.allergies, conditions: ex.conditions,
  };
  if (map.dob && !/^\d{4}-\d{2}-\d{2}$/.test(map.dob)) map.dob = null;
  if (map.sex && !SEXES.includes(map.sex)) map.sex = null;
  const next = { ...draft };
  const filled = [];
  const suggestions = [];
  for (const [k, v] of Object.entries(map)) {
    if (v == null || v === '') continue;
    const cur = draft[k];
    if (cur == null || cur === '') { next[k] = v; filled.push(k); }
    else if (String(cur).trim().toLowerCase() !== String(v).trim().toLowerCase()) suggestions.push({ key: k, value: v });
  }
  if (ex.notes) suggestions.push({ key: 'notes', value: ex.notes, append: true });
  return { next, filled, suggestions };
}

// ---------- the handoff file ----------

export const identityLine = (patient, r, t) => {
  const bits = [];
  const name = fullName(r);
  bits.push(name || t('pat.noName'));
  const age = ageOf(r);
  if (age != null) bits.push(t('pat.ageY', { n: age }));
  if (r?.sex && r.sex !== 'unknown') bits.push(t(`pat.sex.${r.sex}`));
  if (r?.dob) bits.push(t('pat.dobShort', { d: r.dob }));
  bits.push(patient.tag ? t('log.tag', { tag: patient.tag }) : t('log.pNum', { num: patient.num }));
  return bits.join(', ');
};

// Clinical facts only — what the AI needs for the narrative, no identifiers.
export const clinicalOf = (r) => ({
  age: ageOf(r), sex: r?.sex ?? null, weight_kg: r?.weight_kg ?? null, blood_type: r?.blood_type ?? null,
  allergies: r?.no_known_allergies ? 'NO KNOWN ALLERGIES' : (r?.allergies ?? null),
  home_medications: r?.medications ?? null, conditions_history: r?.conditions ?? null, special_notes: r?.notes ?? null,
});

// Structured sections of the complete form, shared by text, print and share.
export function reportSections(patient, r, t) {
  const nr = t('pat.notRecorded');
  const v = (x) => (x == null || x === '' ? nr : String(x));
  const age = ageOf(r);
  const allergies = r?.no_known_allergies ? t('pat.nka') : (r?.allergies || nr);
  return {
    patient: [
      [t('pat.f.name'), fullName(r) ? `${r.last_name ?? ''}${r.last_name && r.first_name ? ', ' : ''}${r.first_name ?? ''}` : nr],
      [t('pat.f.dob'), r?.dob ? `${r.dob}${age != null ? ` (${t('pat.ageY', { n: age })})` : ''}` : (r?.age_est != null ? t('pat.ageEst', { n: r.age_est }) : nr)],
      [t('pat.f.sex'), r?.sex ? t(`pat.sex.${r.sex}`) : nr],
      [t('pat.f.language'), v(r?.language)],
      [t('pat.f.phone'), v(r?.phone)],
      [t('pat.f.address'), v(r?.address)],
      [t('pat.f.id'), r?.id_number ? [r.id_type, r.id_number, r.id_issuer && `(${r.id_issuer})`].filter(Boolean).join(' ') : nr],
      [t('pat.f.health_card'), r?.health_card ? [r.health_card, r.health_card_issuer && `(${r.health_card_issuer})`, r.health_card_expiry && t('pat.exp', { d: r.health_card_expiry })].filter(Boolean).join(' ') : nr],
      [t('pat.f.emergency'), (r?.emergency_name || r?.emergency_phone) ? [r.emergency_name, r.emergency_relation && `(${r.emergency_relation})`, r.emergency_phone].filter(Boolean).join(' ') : nr],
    ],
    medical: [
      [t('pat.f.allergies'), allergies, !r?.no_known_allergies && !!r?.allergies],
      [t('pat.f.blood_type'), r?.blood_type ? (r.blood_type === 'unknown' ? t('pat.unknown') : r.blood_type) : nr],
      [t('pat.f.medications'), v(r?.medications)],
      [t('pat.f.conditions'), v(r?.conditions)],
      [t('pat.f.weight_kg'), r?.weight_kg != null ? `${r.weight_kg} kg` : nr],
      [t('pat.f.notes'), v(r?.notes)],
    ],
  };
}

export function reportText({ patient, record, narrative, timeline, names, photos, responder, t }) {
  const s = reportSections(patient, record, t);
  const when = (e) => new Date(e.payload?.at_client ?? e.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const missing = missingFields(record);
  return [
    t('pat.rep.title'),
    `${new Date().toLocaleString()} · ${t('pat.rep.by', { who: responder || '—' })}`,
    t('pat.rep.confidential'),
    '',
    `${t('pat.rep.triage')}: ${t(`log.triage.${patient.triage}`)} · ${t(`pat.status.${patient.status}`)}`,
    patient.lat != null ? `${t('pat.rep.foundAt')}: ${Number(patient.lat).toFixed(5)}, ${Number(patient.lng).toFixed(5)} · ${new Date(patient.created_at).toLocaleString()}` : null,
    '',
    `— ${t('pat.sec.patient')} —`,
    ...s.patient.map(([k, v]) => `${k}: ${v}`),
    '',
    `— ${t('pat.sec.medical')} —`,
    ...s.medical.map(([k, v, alert]) => `${alert ? '⚠ ' : ''}${k}: ${v}`),
    missing.length ? `\n${t('pat.rep.missing')}: ${missing.map(m => t(`pat.req.${m}`)).join(', ')}` : null,
    '',
    `— ${t('pat.sec.handover')} —`,
    narrative,
    '',
    `— ${t('pat.sec.timeline')} —`,
    ...(timeline.length ? timeline.map(e => `${when(e)}  ${names[e.actor_id] ?? ''} — ${e.payload?.text ?? (e.payload?.triage ? t('log.entry.triage', { v: e.payload.triage }) : e.payload?.status ? t('log.entry.status', { v: e.payload.status }) : e.type === 'patient.created' ? t('log.entry.created') : e.type)}`) : [t('pat.rep.noTimeline')]),
    photos?.length ? `\n${t('pat.rep.photos', { n: photos.length })}` : null,
  ].filter(x => x != null).join('\n');
}
