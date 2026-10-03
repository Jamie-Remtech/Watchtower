import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Download, Loader2, CalendarSearch, TrendingDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getOrgId } from '../lib/org';
import { useI18n } from '../i18n/index.jsx';

// ============================================
// TRACK RECORD — proof is in the pudding.
// Every prediction the ledger issued for this company, frozen at issue,
// scored ~6 days later against ERA5. Shows how often warnings were
// right, how far off the numbers were — raw model vs Watchtower's
// local correction — and lets anyone pull up what was said on a date.
// ============================================

const METRICS = ['gust_max', 'precip_sum', 'temp_max', 'temp_min', 'tstorm', 'burn_runoff', 'temp_mean', 'precip_month'];
const VERDICT_STYLE = {
  hit: 'text-green-300', correct_negative: 'text-slate-400', miss: 'text-red-300',
  false_alarm: 'text-amber-300', pending: 'text-sky-300', no_data: 'text-slate-600', scored: 'text-slate-400',
};
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const fmt = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));

function toCsv(rows) {
  const cols = ['issued_at', 'issue_date', 'valid_date', 'lead_days', 'place', 'region_key', 'kind', 'metric', 'unit',
    'predicted_raw', 'predicted', 'flagged', 'threshold', 'observed', 'observed_flag', 'verdict', 'verdict_raw',
    'abs_error', 'abs_error_raw', 'observed_source', 'scored_at', 'source', 'version', 'fingerprint', 'inputs'];
  const esc = (v) => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
}

export const TrackRecord = () => {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [day, setDay] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const org = await getOrgId();
      if (!org) return;
      const { data, error } = await supabase.from('predictions')
        .select('id, issue_date, issued_at, valid_date, lead_days, place, region_key, kind, metric, unit, predicted_raw, predicted, flagged, flagged_raw, threshold, observed, observed_flag, verdict, verdict_raw, abs_error, abs_error_raw, inputs')
        .eq('org_id', org).order('issue_date', { ascending: false }).limit(5000);
      if (cancelled) return;
      if (error) setErr(error.message); else setRows(data ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    if (!rows) return null;
    const scored = rows.filter(r => r.abs_error != null);
    const daily = scored.filter(r => r.kind === 'daily');
    const count = (arr, k, v) => arr.filter(r => r[k] === v).length;
    const hits = count(daily, 'verdict', 'hit'), misses = count(daily, 'verdict', 'miss'), fa = count(daily, 'verdict', 'false_alarm');
    const hitsRaw = count(daily, 'verdict_raw', 'hit'), missesRaw = count(daily, 'verdict_raw', 'miss'), faRaw = count(daily, 'verdict_raw', 'false_alarm');
    const seasonal = scored.filter(r => r.kind === 'seasonal');
    const perMetric = METRICS.map(m => {
      const s = scored.filter(r => r.metric === m);
      return { m, n: s.length, mae: mean(s.map(r => Number(r.abs_error))), maeRaw: mean(s.map(r => Number(r.abs_error_raw))) };
    }).filter(x => x.n > 0);
    const gain = perMetric.length
      ? mean(perMetric.filter(x => x.maeRaw > 0).map(x => (x.maeRaw - x.mae) / x.maeRaw)) : null;
    return {
      total: rows.length, scored: scored.length,
      pending: rows.filter(r => r.verdict === 'pending').length,
      noData: rows.filter(r => r.verdict === 'no_data').length,
      pod: hits + misses ? hits / (hits + misses) : null,
      far: hits + fa ? fa / (hits + fa) : null,
      podRaw: hitsRaw + missesRaw ? hitsRaw / (hitsRaw + missesRaw) : null,
      events: hits + misses, warnings: hits + fa,
      seasonalHit: seasonal.length ? count(seasonal, 'verdict', 'hit') / seasonal.length : null,
      seasonalN: seasonal.length,
      perMetric, gain,
      first: rows.at(-1)?.issue_date ?? null,
      nextDue: rows.filter(r => r.verdict === 'pending').map(r => r.valid_date).sort()[0] ?? null,
    };
  }, [rows]);

  const issueDays = useMemo(() => [...new Set((rows ?? []).map(r => r.issue_date))], [rows]);
  useEffect(() => { if (!day && issueDays.length) setDay(issueDays[0]); }, [issueDays, day]);
  const dayRows = (rows ?? []).filter(r => r.issue_date === day)
    .sort((a, b) => (a.kind === b.kind ? (a.valid_date === b.valid_date ? a.metric.localeCompare(b.metric) : a.valid_date.localeCompare(b.valid_date)) : a.kind.localeCompare(b.kind)));

  const exportAll = async () => {
    setExporting(true);
    try {
      const org = await getOrgId();
      const { data } = await supabase.from('predictions').select('*').eq('org_id', org).order('issued_at').limit(50000);
      const blob = new Blob([toCsv(data ?? [])], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `watchtower-prediction-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally { setExporting(false); }
  };

  const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
  const dateFmt = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-green-400" />{t('tr.title')}</h3>
        <button onClick={exportAll} disabled={exporting || !rows?.length}
          className="text-[11px] px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white flex items-center gap-1.5 disabled:opacity-40">
          {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}{t('tr.export')}
        </button>
      </div>
      <p className="text-[11px] text-slate-500">{t('tr.lead')}</p>
      {err && <p className="text-xs text-red-400">{err}</p>}
      {!rows && !err && <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />…</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              [t('tr.recorded'), stats.total, stats.first ? t('tr.since', { d: dateFmt(stats.first) }) : ''],
              [t('tr.checked'), stats.scored, t('tr.waiting', { n: stats.pending })],
              [t('tr.caught'), pct(stats.pod), stats.events ? t('tr.ofEvents', { n: stats.events }) : t('tr.noEvents')],
              [t('tr.falseAlarms'), pct(stats.far), stats.warnings ? t('tr.ofWarnings', { n: stats.warnings }) : t('tr.noWarnings')],
            ].map(([label, value, sub]) => (
              <div key={label} className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
                <p className="text-lg font-bold text-white">{value}</p>
                <p className="text-[10px] text-slate-500">{sub}</p>
              </div>
            ))}
          </div>

          {stats.scored === 0 && (
            <p className="text-[11px] text-sky-300 bg-sky-500/10 border border-sky-500/30 rounded-lg p-2.5">
              {t('tr.firstCheck', { d: dateFmt(stats.nextDue ? new Date(Date.parse(stats.nextDue) + 6 * 86400000).toISOString().slice(0, 10) : null) })}
            </p>
          )}

          {stats.perMetric.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><TrendingDown className="w-3 h-3" />{t('tr.howFar')}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead><tr className="text-slate-500 text-left">
                    <th className="py-1 pr-2 font-normal">{t('tr.what')}</th><th className="py-1 pr-2 font-normal">{t('tr.checks')}</th>
                    <th className="py-1 pr-2 font-normal">{t('tr.model')}</th><th className="py-1 font-normal">{t('tr.watchtower')}</th>
                  </tr></thead>
                  <tbody>
                    {stats.perMetric.map(x => (
                      <tr key={x.m} className="border-t border-slate-800">
                        <td className="py-1 pr-2 text-slate-200">{t(`metric.${x.m}`)}</td>
                        <td className="py-1 pr-2 text-slate-400">{x.n}</td>
                        <td className="py-1 pr-2 text-slate-400">±{fmt(x.maeRaw)}</td>
                        <td className={`py-1 ${x.mae < x.maeRaw ? 'text-green-300' : 'text-slate-300'}`}>±{fmt(x.mae)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {stats.gain != null && (
                <p className="text-[10px] text-slate-500">
                  {stats.gain > 0.005 ? t('tr.gain', { p: Math.round(stats.gain * 100) }) : t('tr.noGain')}
                </p>
              )}
              {stats.seasonalN > 0 && <p className="text-[10px] text-slate-500">{t('tr.seasonal', { p: pct(stats.seasonalHit), n: stats.seasonalN })}</p>}
            </div>
          )}

          {issueDays.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><CalendarSearch className="w-3 h-3" />{t('tr.lookup')}</p>
                <select value={day} onChange={e => setDay(e.target.value)}
                  className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-100 focus:outline-none">
                  {issueDays.map(d => <option key={d} value={d}>{dateFmt(d)}</option>)}
                </select>
              </div>
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-slate-900"><tr className="text-slate-500 text-left">
                    <th className="py-1 pr-2 font-normal">{t('tr.for')}</th><th className="py-1 pr-2 font-normal">{t('tr.what')}</th>
                    <th className="py-1 pr-2 font-normal">{t('tr.said')}</th><th className="py-1 pr-2 font-normal">{t('tr.happened')}</th>
                    <th className="py-1 font-normal">{t('tr.verdict')}</th>
                  </tr></thead>
                  <tbody>
                    {dayRows.map(r => {
                      const unit = r.unit === 'flag' ? '' : ` ${r.unit}`;
                      const said = r.metric === 'tstorm' ? (r.flagged ? t('tr.yes') : t('tr.no'))
                        : r.kind === 'seasonal' ? `${fmt(r.predicted)}${unit} · ${t(`scat.${r.inputs?.category ?? 'near'}`)}`
                        : `${fmt(r.predicted)}${unit}${r.flagged ? ' ⚠' : ''}`;
                      return (
                        <tr key={r.id} className="border-t border-slate-800">
                          <td className="py-1 pr-2 text-slate-400 whitespace-nowrap">
                            {r.kind === 'seasonal' ? new Date(`${r.valid_date}T12:00:00`).toLocaleDateString(lang, { month: 'short', year: 'numeric' }) : dateFmt(r.valid_date)}
                          </td>
                          <td className="py-1 pr-2 text-slate-200">{t(`metric.${r.metric}`)}<span className="text-slate-600"> · {r.place ?? r.region_key}</span></td>
                          <td className="py-1 pr-2 text-slate-300 whitespace-nowrap" title={r.predicted_raw !== r.predicted ? `${t('tr.model')}: ${fmt(r.predicted_raw)}` : undefined}>{said}</td>
                          <td className="py-1 pr-2 text-slate-300 whitespace-nowrap">{r.observed != null ? `${fmt(r.observed)}${unit}` : '—'}</td>
                          <td className={`py-1 whitespace-nowrap ${VERDICT_STYLE[r.verdict] ?? ''}`}>{t(`verdict.${r.verdict}`)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className="text-[10px] text-slate-600">{t('tr.note')}</p>
        </>
      )}
    </div>
  );
};
