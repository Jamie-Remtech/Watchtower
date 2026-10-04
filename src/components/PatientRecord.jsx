import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, ScanLine, Loader2, Check, AlertTriangle, History, Trash2, ChevronDown, ChevronRight, ImagePlus, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  SECTIONS, SEXES, BLOOD_TYPES, missingFields, ageOf, cleanRecord,
  compressImage, uploadPhoto, listPhotos, deletePhoto, readIdPhoto, mergeExtracted, logAccess,
} from '../lib/patientRecord';
import { useI18n } from '../i18n/index.jsx';

// The patient file: who the patient is and the medical facts the hospital
// needs. Scan an ID or health card and the form fills itself; every field
// stays editable. Saves automatically; every change keeps the old value.
export const PatientRecord = ({ patient, record, save, names, myId, isCoord }) => {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => ({ ...(record ?? {}) }));
  const [state, setState] = useState('idle'); // idle | dirty | saving | saved | error
  const [err, setErr] = useState(null);
  const [filled, setFilled] = useState(() => new Set());
  const [suggestions, setSuggestions] = useState([]);
  const [scan, setScan] = useState(null); // { step, msg }
  const [photos, setPhotos] = useState([]);
  const [confirmDel, setConfirmDel] = useState(null);
  const [revs, setRevs] = useState(null);
  const [open, setOpen] = useState({ identity: true, medical: true, ids: false, emergency: false });
  const scanRef = useRef(null);
  const photoRef = useRef(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const dirtyRef = useRef(false);

  // Someone else saved this file — take their version unless we are mid-edit.
  useEffect(() => {
    if (!dirtyRef.current && record) setDraft({ ...record });
  }, [record]);

  const loadPhotos = useCallback(async () => setPhotos(await listPhotos(patient.id)), [patient.id]);
  useEffect(() => { loadPhotos(); logAccess(patient.id, 'view'); }, [patient.id, loadPhotos]);

  const flush = useCallback(async () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    setState('saving'); setErr(null);
    try {
      await save(patient.id, draftRef.current);
      setState(dirtyRef.current ? 'dirty' : 'saved');
    } catch (e) {
      dirtyRef.current = true;
      setState('error'); setErr(e.message);
    }
  }, [patient.id, save]);

  // Autosave 1.5 s after the last keystroke, and when the file closes.
  useEffect(() => {
    if (state !== 'dirty') return;
    const id = setTimeout(flush, 1500);
    return () => clearTimeout(id);
  }, [draft, state, flush]);
  useEffect(() => () => { flush(); }, [flush]);

  const set = (k, v) => {
    dirtyRef.current = true;
    setState('dirty');
    setDraft(d => ({ ...d, [k]: v }));
    setFilled(f => { if (!f.has(k)) return f; const n = new Set(f); n.delete(k); return n; });
  };

  const onScan = async (file, kind) => {
    if (!file) return;
    setScan({ step: 'upload' });
    let blob, row;
    try {
      blob = await compressImage(file);
      row = await uploadPhoto(patient.id, blob, kind);
      loadPhotos();
    } catch (e) {
      setScan({ step: 'error', msg: /fetch|network/i.test(e.message ?? '') ? t('pat.scan.offline') : e.message });
      return;
    }
    if (kind === 'other') { setScan(null); return; }
    setScan({ step: 'read' });
    try {
      const ex = await readIdPhoto(blob);
      if (!ex || ex.doc_type === 'unreadable') { setScan({ step: 'error', msg: t('pat.scan.unreadable') }); return; }
      await supabase.from('patient_files').update({ extracted: ex, kind: /health|santé|ramq|ohip|medicare|nhs|insurance/i.test(ex.doc_type ?? '') && !ex.id_number ? 'health_card' : 'id' }).eq('id', row.id);
      const { next, filled: got, suggestions: sug } = mergeExtracted(draftRef.current, ex);
      if (got.length) { dirtyRef.current = true; setState('dirty'); setDraft(next); }
      setFilled(new Set(got));
      setSuggestions(sug);
      logAccess(patient.id, 'scan');
      setScan({ step: 'done', msg: t('pat.scan.done', { doc: ex.doc_type ?? '—', n: got.length }) });
    } catch {
      setScan({ step: 'error', msg: t('pat.scan.aiFailed') });
    }
  };

  const applySuggestion = (s) => {
    set(s.key, s.append && draftRef.current[s.key] ? `${draftRef.current[s.key]}\n${s.value}` : s.value);
    setSuggestions(list => list.filter(x => x !== s));
  };

  const openHistory = async () => {
    if (revs) { setRevs(null); return; }
    const { data } = await supabase.from('patient_record_revisions').select('*').eq('patient_id', patient.id).order('at', { ascending: false }).limit(50);
    setRevs(data ?? []);
  };

  const missing = missingFields(cleanRecord(draft));
  const age = ageOf(cleanRecord(draft));
  const input = (k) => `w-full px-2.5 py-2 bg-slate-800 border rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500 ${filled.has(k) ? 'border-sky-400 ring-1 ring-sky-400/40' : 'border-slate-700'}`;

  const field = ([k, kind]) => {
    const label = (
      <span className="block text-[10px] text-slate-400 mb-0.5">
        {t(`pat.f.${k}`)}{filled.has(k) && <span className="text-sky-300"> · {t('pat.fromId')}</span>}
        {k === 'dob' && age != null && draft.dob && <span className="text-slate-500"> · {t('pat.ageY', { n: age })}</span>}
      </span>
    );
    const val = draft[k] ?? '';
    if (kind === 'sex') return (
      <div key={k} className="sm:col-span-2">{label}
        <div className="flex gap-1 flex-wrap">
          {SEXES.map(s => (
            <button key={s} type="button" onClick={() => set(k, val === s ? null : s)}
              className={`px-3 py-1.5 rounded-lg border text-xs ${val === s ? 'bg-orange-500/20 border-orange-500/50 text-orange-200' : 'bg-slate-800 border-slate-700 text-slate-300'} ${filled.has(k) && val === s ? 'ring-1 ring-sky-400/50' : ''}`}>
              {t(`pat.sex.${s}`)}
            </button>
          ))}
        </div>
      </div>
    );
    if (kind === 'blood') return (
      <div key={k} className="sm:col-span-2">{label}
        <div className="flex gap-1 flex-wrap">
          {BLOOD_TYPES.map(b => (
            <button key={b} type="button" onClick={() => set(k, val === b ? null : b)}
              className={`min-w-[2.75rem] px-2 py-1.5 rounded-lg border text-xs font-semibold ${val === b ? 'bg-red-500/20 border-red-500/50 text-red-200' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
              {b === 'unknown' ? t('pat.unknown') : b}
            </button>
          ))}
        </div>
      </div>
    );
    if (kind === 'area') return (
      <div key={k} className="sm:col-span-2">{label}
        {k === 'allergies' && (
          <label className="flex items-center gap-2 text-xs text-slate-300 mb-1">
            <input type="checkbox" className="accent-green-500" checked={!!draft.no_known_allergies}
              disabled={!!(draft.allergies ?? '').trim()} onChange={e => set('no_known_allergies', e.target.checked)} />
            {t('pat.nka')}
          </label>
        )}
        <textarea rows={2} value={val} onChange={e => set(k, e.target.value)} placeholder={t(`pat.ph.${k}`)}
          disabled={k === 'allergies' && draft.no_known_allergies}
          className={`${input(k)} resize-y ${k === 'allergies' && val ? 'text-red-200' : ''} disabled:opacity-40`} />
      </div>
    );
    return (
      <div key={k} className={k === 'address' ? 'sm:col-span-2' : ''}>{label}
        <input type={kind === 'number' ? 'number' : kind === 'tel' ? 'tel' : kind === 'date' ? 'date' : 'text'}
          inputMode={kind === 'number' ? 'decimal' : undefined}
          value={val} onChange={e => set(k, e.target.value)} className={input(k)}
          autoComplete="off" placeholder={kind === 'date' ? undefined : t(`pat.ph.${k}`)} />
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Scan + status */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => scanRef.current?.click()} disabled={scan?.step === 'upload' || scan?.step === 'read'}
          className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-xs font-semibold text-white disabled:opacity-50">
          {scan?.step === 'upload' || scan?.step === 'read' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
          {t('pat.scanId')}
        </button>
        <button onClick={() => photoRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200">
          <ImagePlus className="w-4 h-4" />{t('pat.addPhoto')}
        </button>
        <input ref={scanRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; onScan(f, 'id'); }} />
        <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; onScan(f, 'other'); }} />
        <span className="ml-auto text-[10px] flex items-center gap-1">
          {state === 'saving' && <><Loader2 className="w-3 h-3 animate-spin text-slate-400" /><span className="text-slate-400">{t('pat.saving')}</span></>}
          {state === 'saved' && <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">{t('pat.saved')}</span></>}
          {state === 'dirty' && <span className="text-slate-500">{t('pat.editing')}</span>}
          {state === 'error' && <span className="text-red-400">{t('pat.saveFailed')}</span>}
        </span>
      </div>

      {scan && scan.step !== 'upload' && (
        <div className={`flex items-start gap-2 p-2 rounded-lg text-[11px] ${scan.step === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-200' : 'bg-sky-500/10 border border-sky-500/30 text-sky-100'}`}>
          {scan.step === 'read' ? <><Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />{t('pat.scan.reading')}</> : <span className="flex-1">{scan.msg}{scan.step === 'done' && <> {t('pat.scan.check')}</>}</span>}
          {scan.step !== 'read' && <button onClick={() => setScan(null)} className="text-slate-400"><X className="w-3.5 h-3.5" /></button>}
        </div>
      )}
      {scan?.step === 'upload' && <p className="text-[11px] text-slate-400">{t('pat.scan.uploading')}</p>}

      {suggestions.length > 0 && (
        <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700 space-y-1">
          <p className="text-[10px] text-slate-400">{t('pat.scan.differs')}</p>
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-400 shrink-0">{t(`pat.f.${s.key}`)}:</span>
              <span className="text-white flex-1 min-w-0 truncate">{String(s.value)}</span>
              <button onClick={() => applySuggestion(s)} className="px-2 py-0.5 rounded bg-sky-600 text-white text-[10px]">{s.append ? t('pat.scan.add') : t('pat.scan.use')}</button>
              <button onClick={() => setSuggestions(l => l.filter(x => x !== s))} className="text-slate-500"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}

      {missing.length > 0 ? (
        <p className="text-[11px] text-yellow-300 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{t('pat.missing', { list: missing.map(m => t(`pat.req.${m}`)).join(', ') })}</span>
        </p>
      ) : (
        <p className="text-[11px] text-green-400 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />{t('pat.complete')}</p>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map(p => (
            <div key={p.id} className="relative shrink-0">
              <a href={p.url ?? '#'} target="_blank" rel="noreferrer" onClick={() => logAccess(patient.id, 'view')}>
                {p.url ? <img src={p.url} alt={t(`pat.kind.${p.kind}`)} className="h-20 w-auto max-w-[9rem] object-cover rounded-lg border border-slate-700" />
                  : <div className="h-20 w-28 rounded-lg bg-slate-800 flex items-center justify-center"><Camera className="w-5 h-5 text-slate-500" /></div>}
              </a>
              <span className="absolute bottom-1 left-1 text-[9px] px-1 rounded bg-black/70 text-white">{t(`pat.kind.${p.kind}`)}</span>
              {(p.created_by === myId || isCoord) && (confirmDel === p.id
                ? <button onClick={async () => { try { await deletePhoto(p); loadPhotos(); } catch (e) { setErr(e.message); } setConfirmDel(null); }} className="absolute top-1 right-1 text-[9px] px-1.5 py-0.5 rounded bg-red-600 text-white font-bold">{t('pat.sure')}</button>
                : <button onClick={() => setConfirmDel(p.id)} className="absolute top-1 right-1 p-1 rounded bg-black/60 text-slate-200"><Trash2 className="w-3 h-3" /></button>)}
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      {[SECTIONS.find(s => s[0] === 'identity'), SECTIONS.find(s => s[0] === 'medical'), SECTIONS.find(s => s[0] === 'ids'), SECTIONS.find(s => s[0] === 'emergency')].map(([sec, fields]) => (
        <div key={sec} className="rounded-lg border border-slate-800">
          <button onClick={() => setOpen(o => ({ ...o, [sec]: !o[sec] }))} className="w-full flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-white">
            {open[sec] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}{t(`pat.sec.${sec}`)}
          </button>
          {open[sec] && <div className="grid sm:grid-cols-2 gap-2 px-2.5 pb-2.5">{fields.map(field)}</div>}
        </div>
      ))}

      {err && <p className="text-[11px] text-red-400">{err}</p>}

      <p className="text-[10px] text-slate-500">{t('pat.voiceHint')}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-slate-500">{t('pat.privacy')}</p>
        <button onClick={openHistory} className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 shrink-0"><History className="w-3.5 h-3.5" />{t('pat.history')}</button>
      </div>
      {revs && (
        <div className="space-y-1.5 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700">
          {revs.length === 0 && <p className="text-[11px] text-slate-500">{t('pat.noHistory')}</p>}
          {revs.map(r => (
            <div key={r.id} className="text-[11px] text-slate-300">
              <span className="text-slate-500">{new Date(r.at).toLocaleString()} · {names[r.by_id] ?? '—'} · </span>
              {r.changed.map(k => (
                <span key={k} className="mr-2">
                  <b>{t(`pat.f.${k}`)}</b>
                  {r.old_values?.[k] != null && r.old_values[k] !== '' && <span className="text-slate-500 line-through ml-1">{String(r.old_values[k])}</span>}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
