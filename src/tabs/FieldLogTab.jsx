import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic, MicOff, Send, Loader2, MapPin, ClipboardList, Radio, Info,
  UserPlus, X, FileText, WifiOff, Pencil, Trash2, RotateCcw, History, Check, UserMinus, Contact2, AlertTriangle
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logEvent } from '../lib/eventLog';
import { queuedCount } from '../lib/offlineQueue';
import { useSpeech } from '../hooks/useSpeech';
import { useTracker } from '../hooks/useTracker';
import { startTracking, pauseTracking, isTrackingPaused } from '../lib/tracker';
import { usePatients } from '../hooks/usePatients';
import { usePatientRecords } from '../hooks/usePatientRecords';
import { PatientRecord } from '../components/PatientRecord';
import { PatientHandoff } from '../components/PatientHandoff';
import { identityLine, shortName, ageOf, missingFields } from '../lib/patientRecord';
import { parseCommand, TRIAGE_META } from '../lib/fieldCommands';
import { beep, say } from '../lib/speechFeedback';
import { useAuth } from '../auth/AuthContext';
import { ROLES } from '../auth/roles';
import { useI18n } from '../i18n/index.jsx';

// ============================================
// FIELD LOG v2 — multi-casualty, voice-commanded
// Spoken commands (SALT/TCCC practice): "new patient", "patient two",
// "triage red", "transported", "mark time". Everything else spoken is
// logged to the active patient with time + GPS. Offline entries queue
// and sync when signal returns.
// ============================================

const quickPosition = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 30000 }
    );
  });

const timeAgo = (iso, t) => {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return t('log.justNow');
  if (s < 3600) return t('log.mAgo', { m: Math.floor(s / 60) });
  if (s < 86400) return t('log.hAgo', { h: Math.floor(s / 3600) });
  return new Date(iso).toLocaleString();
};

const patientLabel = (p, t) => (p.tag ? t('log.tag', { tag: p.tag }) : t('log.pNum', { num: p.num }));

// Plain (non-AI) IMIST-AMBO skeleton from the timeline — works with no
// API key. The AI edge function upgrades this when configured.
const basicHandoff = (patient, record, entries, t) => {
  const nr = t('pat.notRecorded');
  const lines = entries
    .map(e => `  ${new Date(e.payload?.at_client ?? e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${e.payload?.text ?? e.type}`);
  return [
    t('log.ho.header', { p: patientLabel(patient, t), triage: patient.triage.toUpperCase() }),
    t('log.ho.identity', { p: identityLine(patient, record, t) }),
    t('log.ho.mechanism'),
    t('log.ho.injuries'),
    t('log.ho.signs'),
    t('log.ho.treatment'),
    ...lines,
    t('log.ho.allergiesMedsV', { a: record?.no_known_allergies ? t('pat.nka') : (record?.allergies || nr), m: record?.medications || nr }),
    t('log.ho.backgroundOtherV', { b: record?.conditions || nr, o: [record?.blood_type && ` `, record?.notes].filter(Boolean).join(' · ') || nr }),
  ].join('\n');
};

const NOTE_TYPES = ['field.report', 'patient.entry'];

// One timeline entry. Notes can be corrected or removed by their author or a
// coordinator+ — the original is kept in event_revisions, never lost.
const LogEntry = ({ e, names, patientTag, canChange, canRestore, onChanged }) => {
  const { t } = useI18n();
  const [mode, setMode] = useState(null); // 'edit' | 'remove' | 'history'
  const [draft, setDraft] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [revs, setRevs] = useState(null);
  const isNote = NOTE_TYPES.includes(e.type);
  const removed = !!e.deleted_at;

  const run = async (fn, args) => {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMode(null); setReason('');
    onChanged();
  };
  const openHistory = async () => {
    if (mode === 'history') { setMode(null); return; }
    setMode('history');
    const { data } = await supabase.from('event_revisions').select('*').eq('event_id', e.id).order('at');
    setRevs(data ?? []);
  };
  const input = 'w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500';

  return (
    <div className={`rounded-xl p-3 border ${removed ? 'bg-slate-900/30 border-red-500/20 opacity-70' : 'bg-slate-900/60 border-slate-800'}`}>
      {mode === 'edit' ? (
        <div className="space-y-2">
          <textarea value={draft} onChange={ev => setDraft(ev.target.value)} rows={3} className={`${input} resize-none`} autoFocus />
          <input value={reason} onChange={ev => setReason(ev.target.value)} placeholder={t('log.entry.reasonEditPh')} className={input} maxLength={500} />
          <div className="flex gap-2">
            <button disabled={busy || !draft.trim()} onClick={() => run('edit_log_entry', { p_id: e.id, p_text: draft, p_reason: reason || null })}
              className="px-3 py-1.5 bg-orange-500 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}{t('log.entry.saveCorrection')}
            </button>
            <button onClick={() => setMode(null)} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300">{t('log.cancel')}</button>
          </div>
        </div>
      ) : (
        <p className={`text-sm whitespace-pre-wrap ${removed ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
          {e.type === 'patient.triage' ? t('log.entry.triage', { v: e.payload?.triage }) :
           e.type === 'patient.status' ? t('log.entry.status', { v: e.payload?.status }) :
           e.type === 'patient.created' ? t('log.entry.created') :
           e.payload?.text}
        </p>
      )}
      {mode === 'remove' && (
        <div className="mt-2 space-y-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-xs text-red-200">{t('log.entry.removeConfirm')}</p>
          <input value={reason} onChange={ev => setReason(ev.target.value)} placeholder={t('log.entry.reasonRemovePh')} className={input} maxLength={500} autoFocus />
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => run('remove_log_entry', { p_id: e.id, p_reason: reason || null })}
              className="px-3 py-1.5 bg-red-600 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}{t('log.entry.remove')}
            </button>
            <button onClick={() => setMode(null)} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300">{t('log.entry.keep')}</button>
          </div>
        </div>
      )}
      {mode === 'history' && (
        <div className="mt-2 space-y-1.5 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700">
          {!revs && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
          {revs?.length === 0 && <p className="text-[11px] text-slate-500">{t('log.entry.noChanges')}</p>}
          {revs?.map(r => (
            <div key={r.id} className="text-[11px] text-slate-300">
              <span className="text-slate-500">{new Date(r.at).toLocaleString()} · {names[r.by_id] ?? t('log.entry.team')} · </span>
              <span className="font-semibold">{r.action === 'edit' ? t('log.entry.corrected') : r.action === 'remove' ? t('log.entry.removed') : t('log.entry.restored')}</span>
              {r.reason && <span className="text-slate-400"> — “{r.reason}”</span>}
              {r.action === 'edit' && <p className="text-slate-500 line-through whitespace-pre-wrap">{r.old_payload?.text}</p>}
            </div>
          ))}
        </div>
      )}
      {err && <p className="text-[11px] text-red-400 mt-1">{err}</p>}
      <div className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
        <span>{names[e.actor_id] ?? t('log.entry.team')}</span>
        <span>·</span>
        <span>{timeAgo(e.payload?.at_client ?? e.at, t)}</span>
        {patientTag && (<><span>·</span><span className="text-orange-300">{patientTag}</span></>)}
        {e.payload?.lat != null && (
          <>
            <span>·</span>
            <span className="flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" />
              {Number(e.payload.lat).toFixed(4)}, {Number(e.payload.lng).toFixed(4)}
            </span>
          </>
        )}
        {e.edited_at && !removed && <span className="text-sky-300">· {t('log.entry.corrected')}</span>}
        {removed && <span className="text-red-300">· {t('log.entry.removed')}</span>}
        {isNote && (
          <span className="ml-auto flex items-center gap-1">
            {(e.edited_at || removed) && (
              <button onClick={openHistory} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200" title={t('log.entry.historyTitle')}><History className="w-3.5 h-3.5" /></button>
            )}
            {canChange && !removed && mode !== 'edit' && (
              <button onClick={() => { setDraft(e.payload?.text ?? ''); setReason(''); setMode('edit'); }} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-orange-300" title={t('log.entry.correctTitle')}><Pencil className="w-3.5 h-3.5" /></button>
            )}
            {canChange && !removed && (
              <button onClick={() => { setReason(''); setMode(mode === 'remove' ? null : 'remove'); }} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-red-300" title={t('log.entry.removeTitle')}><Trash2 className="w-3.5 h-3.5" /></button>
            )}
            {canRestore && removed && (
              <button disabled={busy} onClick={() => run('restore_log_entry', { p_id: e.id })} className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1" title={t('log.entry.restoreTitle')}><RotateCcw className="w-3 h-3" />{t('log.entry.restore')}</button>
            )}
          </span>
        )}
      </div>
    </div>
  );
};

export const FieldLogTab = () => {
  const { t } = useI18n();
  const isLive = isSupabaseConfigured;
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [allEntries, setEntries] = useState([]);
  const [showRemoved, setShowRemoved] = useState(false);
  const [confirmRemovePatient, setConfirmRemovePatient] = useState(false);
  const { profile, session } = useAuth();
  const myId = session?.user?.id;
  const isCoord = ROLES.indexOf(profile?.role) >= ROLES.indexOf('coordinator');
  const entries = allEntries.filter(e => !e.deleted_at);
  const removedCount = allEntries.length - entries.length;
  const [names, setNames] = useState({});
  const [activePatientId, setActivePatientId] = useState(null);
  const [lastAck, setLastAck] = useState(null);
  const [handoffFor, setHandoffFor] = useState(null); // patient
  const [showRecord, setShowRecord] = useState(false);
  const [queued, setQueued] = useState(queuedCount());
  const tracker = useTracker();
  const { patients, createPatient, updatePatient } = usePatients();
  const { records, save: saveRecord } = usePatientRecords();
  const recordsRef = useRef(records);
  recordsRef.current = records;

  const activePatient = patients.find(p => p.id === activePatientId) ?? null;
  const patientsRef = useRef(patients);
  patientsRef.current = patients;
  const activeRef = useRef(activePatientId);
  activeRef.current = activePatientId;

  const refresh = useCallback(async () => {
    if (!isLive) return;
    const [{ data: events }, { data: profiles }] = await Promise.all([
      supabase.from('events').select('*')
        .in('type', ['field.report', 'patient.entry', 'patient.triage', 'patient.created', 'patient.status'])
        .order('at', { ascending: false }).limit(150),
      supabase.from('profiles').select('id, display_name'),
    ]);
    setEntries(events ?? []);
    setNames(Object.fromEntries((profiles ?? []).map(p => [p.id, p.display_name])));
    setQueued(queuedCount());
  }, [isLive]);

  useEffect(() => { refresh(); const t = setInterval(refresh, 20000); return () => clearInterval(t); }, [refresh]);

  const ack = (msg, spoken = msg) => { beep(true); say(spoken); setLastAck({ msg, at: Date.now() }); };
  const nack = (msg) => { beep(false); say(msg); setLastAck({ msg, at: Date.now(), bad: true }); };

  const logEntry = useCallback(async (body, patientId) => {
    const pos = await quickPosition();
    await logEvent('patient.entry', { text: body, ...(pos ?? {}) }, patientId ?? null);
    refresh();
  }, [refresh]);

  // Execute a parsed voice command — the hands-free brain of the tab.
  const execute = useCallback(async (cmd) => {
    const ps = patientsRef.current;
    const active = ps.find(p => p.id === activeRef.current);
    try {
      switch (cmd.type) {
        case 'new_patient': {
          const pos = await quickPosition();
          const p = await createPatient({ lat: pos?.lat ?? null, lng: pos?.lng ?? null });
          setActivePatientId(p.id);
          ack(t('log.ack.created', { n: p.num }), t('log.say.patient', { id: p.num }));
          break;
        }
        case 'switch_patient': {
          const p = cmd.tag
            ? ps.find(x => (x.tag ?? '').toLowerCase() === String(cmd.tag).toLowerCase())
            : ps.find(x => x.num === cmd.num);
          if (!p) { nack(t('log.nack.noPatient', { id: cmd.tag ?? cmd.num })); return; }
          setActivePatientId(p.id);
          ack(t('log.ack.active', { p: patientLabel(p, t) }), t('log.say.patient', { id: p.tag ?? p.num }));
          break;
        }
        case 'triage': {
          if (!active) { nack(t('log.nack.noActive')); return; }
          await updatePatient(active.id, { triage: cmd.color }, 'patient.triage');
          ack(t('log.ack.triage', { p: patientLabel(active, t), color: cmd.color }), t('log.say.triage', { color: cmd.color }));
          break;
        }
        case 'status': {
          if (!active) { nack(t('log.nack.noActive')); return; }
          await updatePatient(active.id, { status: cmd.status }, 'patient.status');
          ack(t('log.ack.status', { p: patientLabel(active, t), status: t(`log.status.${cmd.status}`) }), t(`log.status.${cmd.status}`));
          break;
        }
        case 'record': {
          if (!active) { nack(t('log.nack.noActive')); return; }
          const cur = recordsRef.current[active.id] ?? {};
          const patch = {};
          if (cmd.field === 'name') {
            const parts = cmd.value.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1));
            patch.last_name = parts.length > 1 ? parts.pop() : parts[0];
            patch.first_name = parts.length ? parts.join(' ') : cur.first_name ?? null;
          } else if (cmd.field === 'nka') { patch.no_known_allergies = true; patch.allergies = null; }
          else if (cmd.field === 'allergies') { patch.allergies = cur.allergies ? `, ` : cmd.value; patch.no_known_allergies = false; }
          else patch[cmd.field] = cmd.value;
          await saveRecord(active.id, { ...cur, ...patch });
          const what = t(`pat.f.`);
          ack(t('pat.ack.saved', { field: what, p: patientLabel(active, t) }), t('pat.say.saved', { field: what }));
          break;
        }
        case 'mark': {
          await logEntry(`— time mark —`, active?.id);
          ack(t('log.ack.marked'), t('log.say.marked'));
          break;
        }
        case 'entry': {
          await logEntry(cmd.text, active?.id);
          ack(active ? t('log.ack.loggedTo', { p: patientLabel(active, t) }) : t('log.ack.logged'), t('log.say.logged'));
          break;
        }
        default: break;
      }
    } catch (err) {
      nack(/does not exist/i.test(err?.message ?? '') ? t('log.nack.noTable') : t('log.nack.failed'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createPatient, updatePatient, logEntry, saveRecord, t]);

  const { supported, listening, interim, start, stop } = useSpeech({
    onFinal: (t) => { const cmd = parseCommand(t); if (cmd) execute(cmd); },
  });

  const saveTyped = async () => {
    const body = text.trim();
    if (!body) return;
    setSaving(true);
    const cmd = parseCommand(body);
    await execute(cmd ?? { type: 'entry', text: body });
    setText('');
    setSaving(false);
  };

  const pool = showRemoved ? allEntries : entries;
  const visibleEntries = activePatient
    ? pool.filter(e => e.subject === activePatient.id)
    : pool.filter(e => e.type === 'field.report' || e.type === 'patient.entry');

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-400" />
            {t('log.title')}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {t('log.hint.say')} <b className="text-slate-300">"new patient"</b>, <b className="text-slate-300">"patient two"</b>, <b className="text-slate-300">"triage red"</b>, <b className="text-slate-300">"transported"</b> {t('log.hint.rest')}
          </p>
        </div>
        {queued > 0 && (
          <span className="flex items-center gap-1.5 px-2 py-1 bg-yellow-500/15 border border-yellow-500/30 rounded-lg text-[10px] text-yellow-400 flex-shrink-0">
            <WifiOff className="w-3 h-3" />{t('log.queued', { n: queued })}
          </span>
        )}
      </div>

      {/* Patients */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => execute({ type: 'new_patient' })}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-600 text-xs text-slate-400 hover:border-orange-500/40 hover:text-orange-300"
        >
          <UserPlus className="w-3.5 h-3.5" />{t('log.newPatient')}
        </button>
        {patients.filter(p => p.status === 'active').map(p => (
          <button
            key={p.id}
            onClick={() => setActivePatientId(p.id === activePatientId ? null : p.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
              activePatientId === p.id
                ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: TRIAGE_META[p.triage]?.dot }} />
            {patientLabel(p, t)}
            {shortName(records[p.id]) && <span className="font-normal opacity-80">· {shortName(records[p.id])}</span>}
            {records[p.id]?.allergies && <AlertTriangle className="w-3 h-3 text-red-400" />}
          </button>
        ))}
      </div>

      {/* Active patient card */}
      {activePatient && (
        <div className="bg-slate-900 border border-orange-500/30 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-bold text-white">
              {patientLabel(activePatient, t)}
              <span className="text-[10px] font-normal text-slate-500 ml-2">
                {TRIAGE_META[activePatient.triage] && t(`log.triage.${activePatient.triage}`)} · {t('log.since', { ago: timeAgo(activePatient.created_at, t) })}
              </span>
            </p>
            <div className="flex items-center gap-1">
              {(isCoord || activePatient.created_by === myId) && (
                <button onClick={() => setConfirmRemovePatient(v => !v)} className="p-1 text-slate-500 hover:text-red-300" title={t('log.removePatientTitle')}>
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setActivePatientId(null)} className="p-1 text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          {(() => {
            const r = records[activePatient.id];
            const age = ageOf(r);
            const bits = [shortName(r) && [r.first_name, r.last_name].filter(Boolean).join(' '), age != null && t('pat.ageY', { n: age }), r?.sex && r.sex !== 'unknown' && t(`pat.sex.${r.sex}`), r?.blood_type && r.blood_type !== 'unknown' && r.blood_type].filter(Boolean);
            return (<>
              {bits.length > 0 && <p className="text-xs text-slate-200">{bits.join(' · ')}</p>}
              {r?.allergies && <p className="text-xs font-semibold text-red-200 bg-red-500/15 border border-red-500/40 rounded-lg px-2 py-1 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{t('pat.allergyBanner', { a: r.allergies })}</p>}
              {r?.no_known_allergies && <p className="text-[11px] text-green-400">{t('pat.nka')}</p>}
            </>);
          })()}
          {confirmRemovePatient && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 flex-wrap">
              <p className="text-xs text-red-200 flex-1 min-w-[12rem]">{t('log.removePatientConfirm', { p: patientLabel(activePatient, t) })}</p>
              <button onClick={async () => { await updatePatient(activePatient.id, { status: 'removed' }, 'patient.status'); setConfirmRemovePatient(false); setActivePatientId(null); }}
                className="px-3 py-1.5 bg-red-600 rounded-lg text-xs font-semibold text-white">{t('log.removePatient')}</button>
              <button onClick={() => setConfirmRemovePatient(false)} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300">{t('log.cancel')}</button>
            </div>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            {['red', 'yellow', 'green', 'gray', 'black'].map(c => (
              <button
                key={c}
                onClick={() => execute({ type: 'triage', color: c })}
                title={t(`log.triage.${c}`)}
                className={`w-7 h-7 rounded-full border-2 ${activePatient.triage === c ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                style={{ background: TRIAGE_META[c].dot }}
              />
            ))}
            <div className="flex-1" />
            <button
              onClick={() => setShowRecord(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] ${showRecord ? 'bg-sky-500/20 border-sky-500/50 text-sky-200' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
            >
              <Contact2 className="w-3 h-3" />{t('pat.file')}
              {missingFields(records[activePatient.id]).length > 0 && <span className="ml-0.5 px-1 rounded bg-yellow-500/25 text-yellow-300">{missingFields(records[activePatient.id]).length}</span>}
            </button>
            <button
              onClick={() => execute({ type: 'status', status: 'transported' })}
              className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-[10px] text-slate-300 hover:bg-slate-700"
            >
              {t('log.transported')}
            </button>
            <button
              onClick={() => setHandoffFor(activePatient)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-[10px] font-semibold text-white"
            >
              <FileText className="w-3 h-3" />
              {t('log.handoff')}
            </button>
          </div>
          {showRecord && (
            <div className="pt-2 border-t border-slate-800">
              <PatientRecord key={activePatient.id} patient={activePatient} record={records[activePatient.id]} save={saveRecord}
                names={names} myId={myId} isCoord={isCoord} />
            </div>
          )}
        </div>
      )}

      {/* Dictation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <button
            onClick={listening ? stop : start}
            disabled={!supported}
            className={`flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
              listening
                ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/40'
                : 'bg-gradient-to-br from-orange-500 to-orange-600 hover:scale-105'
            } disabled:opacity-40 disabled:hover:scale-100`}
            title={supported ? (listening ? t('log.mic.stop') : t('log.mic.start')) : t('log.mic.unsupported')}
          >
            {listening ? <MicOff className="w-7 h-7 text-white" /> : <Mic className="w-7 h-7 text-white" />}
          </button>
          <div className="flex-1 min-w-0">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={3}
              placeholder={listening
                ? t('log.ph.listening')
                : t('log.ph.idle')}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500 resize-none"
            />
            {interim && <p className="text-xs text-orange-300/80 italic mt-1">{interim}…</p>}
            {lastAck && Date.now() - lastAck.at < 6000 && (
              <p className={`text-xs mt-1 font-medium ${lastAck.bad ? 'text-red-400' : 'text-green-400'}`}>✓ {lastAck.msg}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-500 flex items-center gap-1">
            <MapPin className="w-3 h-3" />{t('log.autoAttach')}
          </p>
          <button
            onClick={saveTyped}
            disabled={saving || !text.trim()}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {t('log.logEntry')}
          </button>
        </div>
        {!supported && (
          <p className="text-[10px] text-yellow-500/90 flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            {t('log.noSpeech')}
          </p>
        )}
      </div>

      {/* Automatic position tracking status */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white flex items-center gap-2">
            <Radio className={`w-4 h-4 ${tracker.active ? 'text-green-400' : 'text-slate-500'}`} />
            {t('log.track.title')}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {tracker.active
              ? (tracker.lastFix ? t('log.track.autoFix', { ago: timeAgo(tracker.lastFix.toISOString(), t) }) : t('log.track.autoAcquiring'))
              : isTrackingPaused()
                ? t('log.track.paused')
                : tracker.error ?? t('log.track.starting')}
          </p>
          {tracker.error && !isTrackingPaused() && <p className="text-[10px] text-red-400 mt-0.5">{tracker.error}</p>}
        </div>
        <button
          onClick={tracker.active ? () => pauseTracking() : () => startTracking()}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex-shrink-0 ${
            tracker.active
              ? 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
              : 'bg-green-500/20 border border-green-500/40 text-green-400'
          }`}
        >
          {tracker.active ? t('log.track.pause') : t('log.track.resume')}
        </button>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-white">
            {activePatient ? t('log.timeline', { p: patientLabel(activePatient, t) }) : t('log.recent')}
            {visibleEntries.length > 0 && <span className="text-slate-500 font-normal"> ({visibleEntries.length})</span>}
          </h3>
          {isCoord && removedCount > 0 && (
            <button onClick={() => setShowRemoved(v => !v)} className="text-[11px] text-slate-400 hover:text-white">
              {showRemoved ? t('log.hideRemoved') : t('log.showRemoved', { n: removedCount })}
            </button>
          )}
        </div>
        {visibleEntries.length === 0 ? (
          <p className="text-xs text-slate-500">
            {t('log.empty')}
          </p>
        ) : (
          visibleEntries.map(e => {
            const p = !activePatient && e.subject ? patients.find(x => x.id === e.subject) : null;
            return (
              <LogEntry key={e.id} e={e} names={names} patientTag={p ? patientLabel(p, t) : null}
                canChange={e.actor_id === myId || isCoord} canRestore={isCoord} onChanged={refresh} />
            );
          })
        )}
      </div>

      {/* Handoff — the complete patient file */}
      {handoffFor && (() => {
        const p = patients.find(x => x.id === handoffFor.id) ?? handoffFor;
        const timeline = entries.filter(e => e.subject === p.id).slice().reverse();
        return (
          <PatientHandoff patient={p} record={records[p.id]} timeline={timeline} names={names}
            responder={profile?.display_name} basicNarrative={basicHandoff(p, records[p.id], timeline, t)}
            onClose={() => setHandoffFor(null)} />
        );
      })()}
    </div>
  );
};
