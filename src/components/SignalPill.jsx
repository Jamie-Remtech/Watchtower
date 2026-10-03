import { useEffect, useRef, useState } from 'react';
import { Signal, SignalLow, SignalMedium, SignalHigh, SignalZero } from 'lucide-react';
import { subscribeLink, QUALITY_STYLE } from '../lib/link';
import { useI18n } from '../i18n/index.jsx';

export const BarsIcon = ({ quality, className = 'w-4 h-4' }) => {
  const bars = QUALITY_STYLE[quality]?.bars ?? 0;
  const Icon = quality === 'good' ? SignalHigh : bars === 2 ? SignalMedium : bars === 1 ? SignalLow : quality === 'unknown' ? Signal : SignalZero;
  return <Icon className={`${className} ${QUALITY_STYLE[quality]?.text ?? 'text-slate-400'}`} />;
};

const ago = (t, ms) => {
  if (!ms) return '—';
  const s = Math.round((Date.now() - ms) / 1000);
  return s < 60 ? t('sig.secAgo', { s }) : t('sig.minAgo', { m: Math.round(s / 60) });
};

// This device's link to Watchtower — tap for the details
export const SignalPill = ({ compact = false, large = false }) => {
  const { t } = useI18n();
  const [link, setLink] = useState(null);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => subscribeLink(setLink), []);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  if (!link) return null;
  const q = link.quality;
  const st = QUALITY_STYLE[q];
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 rounded-lg border ${st.bg} ${large ? 'h-11 px-2.5' : 'px-1.5 py-1'}`}
        aria-label={t('sig.label', { q: t(`sig.q.${q}`) })} title={t('sig.label', { q: t(`sig.q.${q}`) })}>
        <BarsIcon quality={q} className={large ? 'w-5 h-5' : 'w-4 h-4'} />
        {!compact && <span className={`text-[11px] font-semibold ${st.text}`}>{t(`sig.q.${q}`)}</span>}
        {large && link.rtt != null && <span className="text-[11px] text-slate-400 tabular-nums">{link.rtt} ms</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-[140] w-64 p-3 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl text-left space-y-1.5">
          <p className={`text-sm font-bold ${st.text} flex items-center gap-1.5`}><BarsIcon quality={q} />{t(`sig.q.${q}`)}</p>
          <p className="text-[11px] text-slate-400">{t(`sig.d.${q}`)}</p>
          <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
            <dt className="text-slate-500">{t('sig.rtt')}</dt><dd className="text-slate-200 tabular-nums">{link.rtt != null ? `${link.rtt} ms` : '—'}</dd>
            <dt className="text-slate-500">{t('sig.lastOk')}</dt><dd className="text-slate-200">{ago(t, link.lastOkAt)}</dd>
            {link.effective && (<><dt className="text-slate-500">{t('sig.network')}</dt><dd className="text-slate-200 uppercase">{link.effective}{link.type ? ` · ${link.type}` : ''}</dd></>)}
            {link.downlink != null && (<><dt className="text-slate-500">{t('sig.speed')}</dt><dd className="text-slate-200 tabular-nums">~{link.downlink} Mbit/s</dd></>)}
          </dl>
          <p className="text-[10px] text-slate-600">{t('sig.note')}</p>
        </div>
      )}
    </div>
  );
};
