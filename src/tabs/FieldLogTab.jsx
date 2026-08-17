import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic, MicOff, Send, Loader2, MapPin, ClipboardList, Radio, Info,
  UserPlus, X, FileText, Volume2, Copy, WifiOff
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logEvent } from '../lib/eventLog';
import { queuedCount } from '../lib/offlineQueue';
import { useSpeech } from '../hooks/useSpeech';
import { usePositions } from '../hooks/usePositions';
import { usePatients } from '../hooks/usePatients';
import { parseCommand, TRIAGE_META } from '../lib/fieldCommands';
import { beep, say } from '../lib/speechFeedback';

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

const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleString();
};

const patientLabel = (p) => (p.tag ? `Tag ${p.tag}` : `P${p.num}`);

// Plain (non-AI) IMIST-AMBO skeleton from the timeline — works with no
// API key. The AI edge function upgrades this when configured.
const basicHandoff = (patient, entries) => {
  const lines = entries
    .slice().reverse()
    .map(e => `  ${new Date(e.payload?.at_client ?? e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${e.payload?.text ?? e.type}`);
  return [
    `IMIST-AMBO HANDOVER — ${patientLabel(patient)} · triage ${patient.triage.toUpperCase()}`,
    `I — Identity: ${patientLabel(patient)}${patient.tag ? '' : ' (no physical tag)'}`,
    `M — Mechanism / complaint: [state]`,
    `I — Injuries / information: [state]`,
    `S — Signs & symptoms: [state]`,
    `T — Treatment & trends (timeline):`,
    ...lines,
    `A — Allergies: [state]   M — Medications: [state]`,
    `B — Background: [state]   O — Other: [state]`,
  ].join('\n');
};

export const FieldLogTab = () => {
  const isLive = isSupabaseConfigured;
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState([]);
  const [names, setNames] = useState({});
  const [activePatientId, setActivePatientId] = useState(null);
  const [lastAck, setLastAck] = useState(null);
  const [handoff, setHandoff] = useState(null); // { patient, text, ai }
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [queued, setQueued] = useState(queuedCount());
  const { sharing, startSharing, stopSharing, lastSent, shareError } = usePositions();
  const { patients, createPatient, updatePatient } = usePatients();

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
          ack(`Patient ${p.num} created`, `patient ${p.num}`);
          break;
        }
        case 'switch_patient': {
          const p = cmd.tag
            ? ps.find(x => (x.tag ?? '').toLowerCase() === String(cmd.tag).toLowerCase())
            : ps.find(x => x.num === cmd.num);
          if (!p) { nack(`no patient ${cmd.tag ?? cmd.num}`); return; }
          setActivePatientId(p.id);
          ack(`Active: ${patientLabel(p)}`, `patient ${p.tag ?? p.num}`);
          break;
        }
        case 'triage': {
          if (!active) { nack('no active patient'); return; }
          await updatePatient(active.id, { triage: cmd.color }, 'patient.triage');
          ack(`${patientLabel(active)} → ${cmd.color}`, `triage ${cmd.color}`);
          break;
        }
        case 'status': {
          if (!active) { nack('no active patient'); return; }
          await updatePatient(active.id, { status: cmd.status }, 'patient.status');
          ack(`${patientLabel(active)} ${cmd.status.replace('_', ' ')}`, cmd.status.replace('_', ' '));
          break;
        }
        case 'mark': {
          await logEntry(`— time mark —`, active?.id);
          ack('Time marked', 'marked');
          break;
        }
        case 'entry': {
          await logEntry(cmd.text, active?.id);
          ack(`Logged${active ? ` → ${patientLabel(active)}` : ''}`, 'logged');
          break;
        }
        default: break;
      }
    } catch (err) {
      nack(/does not exist/i.test(err?.message ?? '') ? 'patients table missing — run migration 0009' : 'failed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createPatient, updatePatient, logEntry]);

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

  // Handoff: AI-composed IMIST-AMBO if the edge function is deployed,
  // honest template otherwise.
  const generateHandoff = async (patient) => {
    setHandoffBusy(true);
    const timeline = entries.filter(e => e.subject === patient.id);
    try {
      const { data, error } = await supabase.functions.invoke('field-assist', {
        body: { mode: 'handoff', patient, entries: timeline.slice().reverse() },
      });
      if (error || !data?.handoff) throw error ?? new Error('no result');
      setHandoff({ patient, text: data.handoff, ai: true });
    } catch {
      setHandoff({ patient, text: basicHandoff(patient, timeline), ai: false });
    }
    setHandoffBusy(false);
  };

  const visibleEntries = activePatient
    ? entries.filter(e => e.subject === activePatient.id)
    : entries.filter(e => e.type === 'field.report' || e.type === 'patient.entry');

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-400" />
            Field Log
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Say <b className="text-slate-300">"new patient"</b>, <b className="text-slate-300">"patient two"</b>, <b className="text-slate-300">"triage red"</b>, <b className="text-slate-300">"transported"</b> — everything else you say is logged to the active patient.
          </p>
        </div>
        {queued > 0 && (
          <span className="flex items-center gap-1.5 px-2 py-1 bg-yellow-500/15 border border-yellow-500/30 rounded-lg text-[10px] text-yellow-400 flex-shrink-0">
            <WifiOff className="w-3 h-3" />{queued} queued offline
          </span>
        )}
      </div>

      {/* Patients */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => execute({ type: 'new_patient' })}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-600 text-xs text-slate-400 hover:border-orange-500/40 hover:text-orange-300"
        >
          <UserPlus className="w-3.5 h-3.5" />New patient
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
            {patientLabel(p)}
          </button>
        ))}
      </div>

      {/* Active patient card */}
      {activePatient && (
        <div className="bg-slate-900 border border-orange-500/30 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-bold text-white">
              {patientLabel(activePatient)}
              <span className="text-[10px] font-normal text-slate-500 ml-2">
                {TRIAGE_META[activePatient.triage]?.label} · since {timeAgo(activePatient.created_at)}
              </span>
            </p>
            <button onClick={() => setActivePatientId(null)} className="p-1 text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {['red', 'yellow', 'green', 'gray', 'black'].map(c => (
              <button
                key={c}
                onClick={() => execute({ type: 'triage', color: c })}
                title={TRIAGE_META[c].label}
                className={`w-7 h-7 rounded-full border-2 ${activePatient.triage === c ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                style={{ background: TRIAGE_META[c].dot }}
              />
            ))}
            <div className="flex-1" />
            <button
              onClick={() => execute({ type: 'status', status: 'transported' })}
              className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-[10px] text-slate-300 hover:bg-slate-700"
            >
              Transported
            </button>
            <button
              onClick={() => generateHandoff(activePatient)}
              disabled={handoffBusy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-[10px] font-semibold text-white disabled:opacity-50"
            >
              {handoffBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              Handoff
            </button>
          </div>
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
            title={supported ? (listening ? 'Stop hands-free mode' : 'Start hands-free mode') : 'Speech recognition not supported in this browser'}
          >
            {listening ? <MicOff className="w-7 h-7 text-white" /> : <Mic className="w-7 h-7 text-white" />}
          </button>
          <div className="flex-1 min-w-0">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={3}
              placeholder={listening
                ? 'Hands-free mode: speak commands or actions — each sentence is executed or logged instantly.'
                : 'Type an entry or command here — or tap the mic for hands-free mode.'}
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
            <MapPin className="w-3 h-3" />Time & position attach automatically · entries queue offline
          </p>
          <button
            onClick={saveTyped}
            disabled={saving || !text.trim()}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Log entry
          </button>
        </div>
        {!supported && (
          <p className="text-[10px] text-yellow-500/90 flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            This browser has no built-in speech recognition — Chrome and Android work best. On iPhone, use the keyboard mic key.
          </p>
        )}
      </div>

      {/* Live location sharing */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white flex items-center gap-2">
            <Radio className={`w-4 h-4 ${sharing ? 'text-green-400' : 'text-slate-500'}`} />
            Share my live position
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {sharing
              ? `Broadcasting to the tactical map${lastSent ? ` · last fix ${timeAgo(lastSent.toISOString())}` : ''} · keep the app open`
              : 'Your team sees you on the tactical map while this is on'}
          </p>
          {shareError && <p className="text-[10px] text-red-400 mt-0.5">{shareError}</p>}
        </div>
        <button
          onClick={sharing ? stopSharing : startSharing}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex-shrink-0 ${
            sharing ? 'bg-green-500/20 border border-green-500/40 text-green-400' : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {sharing ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-white">
          {activePatient ? `${patientLabel(activePatient)} timeline` : 'Recent entries'}
          {visibleEntries.length > 0 && <span className="text-slate-500 font-normal"> ({visibleEntries.length})</span>}
        </h3>
        {visibleEntries.length === 0 ? (
          <p className="text-xs text-slate-500">
            Nothing yet. Every spoken action becomes part of the record — timestamped, located, per patient.
          </p>
        ) : (
          visibleEntries.map(e => (
            <div key={e.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
              <p className="text-sm text-slate-100 whitespace-pre-wrap">
                {e.type === 'patient.triage' ? `Triage → ${e.payload?.triage}` :
                 e.type === 'patient.status' ? `Status → ${e.payload?.status}` :
                 e.type === 'patient.created' ? `Patient created` :
                 e.payload?.text}
              </p>
              <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
                <span>{names[e.actor_id] ?? 'Team'}</span>
                <span>·</span>
                <span>{timeAgo(e.payload?.at_client ?? e.at)}</span>
                {!activePatient && e.subject && (() => {
                  const p = patients.find(x => x.id === e.subject);
                  return p ? (<><span>·</span><span className="text-orange-300">{patientLabel(p)}</span></>) : null;
                })()}
                {e.payload?.lat != null && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      {Number(e.payload.lat).toFixed(4)}, {Number(e.payload.lng).toFixed(4)}
                    </span>
                  </>
                )}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Handoff modal */}
      {handoff && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setHandoff(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg p-5 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">
                Handoff — {patientLabel(handoff.patient)}
                <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded ${handoff.ai ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                  {handoff.ai ? 'AI · IMIST-AMBO' : 'template — AI assist not configured'}
                </span>
              </h3>
              <button onClick={() => setHandoff(null)} className="p-1 hover:bg-slate-800 rounded"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <pre className="flex-1 overflow-y-auto text-xs text-slate-200 whitespace-pre-wrap bg-slate-950 border border-slate-800 rounded-lg p-3">{handoff.text}</pre>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => say(handoff.text)}
                className="flex-1 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 flex items-center justify-center gap-1.5 hover:bg-slate-700"
              >
                <Volume2 className="w-3.5 h-3.5" />Read aloud
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(handoff.text)}
                className="flex-1 py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
