import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Volume2, Copy, Printer, Share2, Loader2, AlertTriangle, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { say } from '../lib/speechFeedback';
import {
  identityLine, clinicalOf, reportSections, reportText, missingFields, listPhotos, logAccess,
} from '../lib/patientRecord';
import { useI18n } from '../i18n/index.jsx';

// The complete handoff file for the receiving hospital / authority:
// identity, IDs, allergies, blood type, medications, history, notes, the
// IMIST-AMBO handover, the full field timeline and the ID photos.
// The AI writes only the narrative and is given clinical facts only —
// name, address and ID numbers are added here, on the device.
export const PatientHandoff = ({ patient, record, timeline: recent, names, responder, basicNarrative, onClose }) => {
  const { t, lang } = useI18n();
  const [narrative, setNarrative] = useState(null);
  const [ai, setAi] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [timeline, setTimeline] = useState(recent);
  const [printing, setPrinting] = useState(false);
  const [done, setDone] = useState(null);
  const id = identityLine(patient, record, t);

  useEffect(() => {
    let off = false;
    (async () => {
      // the whole timeline, not just the recent entries on screen
      let tl = recent;
      try {
        const { data } = await supabase.from('events').select('*').eq('subject', patient.id).is('deleted_at', null)
          .in('type', ['patient.entry', 'patient.triage', 'patient.created', 'patient.status']).order('at').limit(1000);
        if (data?.length >= recent.length) { tl = data; if (!off) setTimeline(data); }
      } catch { /* keep the recent ones */ }
      try {
        const { data, error } = await supabase.functions.invoke('field-assist', {
          body: { mode: 'handoff', patient: { num: patient.num, tag: patient.tag, triage: patient.triage }, clinical: clinicalOf(record), entries: tl, language: lang },
        });
        if (error || !data?.handoff) throw error ?? new Error('no result');
        let text = String(data.handoff);
        text = text.includes('{{IDENTITY}}') ? text.replaceAll('{{IDENTITY}}', id) : `I — ${id}\n${text}`;
        if (!off) { setNarrative(text); setAi(true); }
      } catch {
        if (!off) { setNarrative(basicNarrative); setAi(false); }
      }
    })();
    listPhotos(patient.id).then(p => { if (!off) setPhotos(p); });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id]);

  const text = useMemo(() => narrative == null ? '' : reportText({ patient, record, narrative, timeline, names, photos, responder, t }),
    [patient, record, narrative, timeline, names, photos, responder, t]);
  const missing = missingFields(record);
  const sections = reportSections(patient, record, t);
  const flash = (k) => { setDone(k); setTimeout(() => setDone(null), 1800); };

  const copy = async () => { await navigator.clipboard?.writeText(text); logAccess(patient.id, 'copy'); flash('copy'); };
  const share = async () => {
    const title = t('pat.rep.shareTitle', { who: id });
    let files = [];
    try {
      files = await Promise.all(photos.filter(p => p.url).map(async (p, i) => {
        const b = await (await fetch(p.url)).blob();
        return new File([b], `${t(`pat.kind.${p.kind}`)}-${i + 1}.jpg`, { type: 'image/jpeg' });
      }));
    } catch { files = []; }
    const withFiles = files.length && navigator.canShare?.({ files }) ? { files } : {};
    try {
      if (navigator.share) { await navigator.share({ title, text, ...withFiles }); logAccess(patient.id, 'share'); flash('share'); }
      else { await copy(); }
    } catch { /* cancelled */ }
  };
  const print = () => {
    setPrinting(true);
    logAccess(patient.id, 'print');
    const go = () => {
      const done = () => { setPrinting(false); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      window.print();
      setTimeout(done, 60000);
    };
    // let the print sheet render and its photos load first
    setTimeout(() => {
      const imgs = [...document.querySelectorAll('#wt-print-root img')];
      Promise.all(imgs.map(i => (i.complete ? null : new Promise(r => { i.onload = r; i.onerror = r; })))).then(go);
    }, 50);
  };

  const sheet = printing && narrative != null && createPortal(
    <div id="wt-print-root">
      <h1>{t('pat.rep.title')}</h1>
      <p className="meta">{new Date().toLocaleString()} · {t('pat.rep.by', { who: responder || '—' })}</p>
      <p className="conf">{t('pat.rep.confidential')}</p>
      <p><b>{t('pat.rep.triage')}:</b> {t(`log.triage.${patient.triage}`)} · {t(`pat.status.${patient.status}`)}
        {patient.lat != null && <> · {t('pat.rep.foundAt')}: {Number(patient.lat).toFixed(5)}, {Number(patient.lng).toFixed(5)} · {new Date(patient.created_at).toLocaleString()}</>}</p>
      <h2>{t('pat.sec.patient')}</h2>
      <table><tbody>{sections.patient.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
      <h2>{t('pat.sec.medical')}</h2>
      <table><tbody>{sections.medical.map(([k, v, alert]) => <tr key={k} className={alert ? 'alert' : ''}><th>{alert ? '⚠ ' : ''}{k}</th><td>{v}</td></tr>)}</tbody></table>
      {missing.length > 0 && <p className="missing">{t('pat.rep.missing')}: {missing.map(m => t(`pat.req.${m}`)).join(', ')}</p>}
      <h2>{t('pat.sec.handover')}</h2>
      <pre>{narrative}</pre>
      <h2>{t('pat.sec.timeline')}</h2>
      <table><tbody>{timeline.map(e => (
        <tr key={e.id}><th>{new Date(e.payload?.at_client ?? e.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</th>
          <td>{names[e.actor_id] ? `${names[e.actor_id]} — ` : ''}{e.payload?.text ?? (e.payload?.triage ? t('log.entry.triage', { v: e.payload.triage }) : e.payload?.status ? t('log.entry.status', { v: e.payload.status }) : e.type === 'patient.created' ? t('log.entry.created') : e.type)}</td></tr>
      ))}</tbody></table>
      {photos.some(p => p.url) && (<>
        <h2>{t('pat.rep.photosTitle')}</h2>
        <div className="photos">{photos.filter(p => p.url).map(p => <figure key={p.id}><img src={p.url} alt="" /><figcaption>{t(`pat.kind.${p.kind}`)}</figcaption></figure>)}</div>
      </>)}
    </div>,
    document.body,
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3" onClick={onClose}>
      {sheet}
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl p-4 max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2 gap-2">
          <h3 className="text-sm font-bold text-white min-w-0 truncate">
            {t('pat.rep.modalTitle', { who: id })}
            {narrative != null && (
              <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded ${ai ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                {ai ? t('log.handoffAi') : t('log.handoffTemplate')}
              </span>
            )}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded shrink-0"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        {missing.length > 0 && (
          <p className="mb-2 text-[11px] text-yellow-300 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{t('pat.rep.missingWarn', { list: missing.map(m => t(`pat.req.${m}`)).join(', ') })}
          </p>
        )}
        {narrative == null
          ? <div className="flex-1 flex items-center justify-center py-10 text-xs text-slate-400 gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('pat.rep.composing')}</div>
          : <pre className="flex-1 overflow-y-auto text-xs text-slate-200 whitespace-pre-wrap bg-slate-950 border border-slate-800 rounded-lg p-3">{text}</pre>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <button disabled={narrative == null} onClick={() => say(narrative)} className="py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 flex items-center justify-center gap-1.5 disabled:opacity-40">
            <Volume2 className="w-3.5 h-3.5" />{t('log.readAloud')}
          </button>
          <button disabled={narrative == null} onClick={copy} className="py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 flex items-center justify-center gap-1.5 disabled:opacity-40">
            {done === 'copy' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}{t('log.copy')}
          </button>
          <button disabled={narrative == null} onClick={print} className="py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 flex items-center justify-center gap-1.5 disabled:opacity-40">
            <Printer className="w-3.5 h-3.5" />{t('pat.rep.print')}
          </button>
          <button disabled={narrative == null} onClick={share} className="py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-40">
            {done === 'share' ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}{t('pat.rep.share')}
          </button>
        </div>
      </div>
    </div>
  );
};
