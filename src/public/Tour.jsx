import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { contentFor } from './content';
import { PublicHeader } from './Landing';
import { go } from './nav';

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

export const Tour = ({ signedIn }) => {
  const { lang } = useI18n();
  const c = contentFor(lang);
  const steps = c.tour.steps;
  const [i, setI] = useState(() => {
    const n = parseInt(new URLSearchParams(window.location.search).get('step') ?? '1', 10);
    return Number.isFinite(n) ? Math.min(Math.max(n - 1, 0), steps.length - 1) : 0;
  });
  const last = i === steps.length - 1;
  const finish = () => go(signedIn ? '/' : '/signin');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') setI(v => Math.min(v + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') setI(v => Math.max(v - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps.length]);

  const [icon, title, body, tips] = steps[i];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 overflow-x-hidden flex flex-col">
      <PublicHeader c={c} signedIn={signedIn} />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">{c.tour.title}</h1>
          <button onClick={() => go('/about')} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
            <X className="w-3.5 h-3.5" />{c.tour.exit}
          </button>
        </div>

        <div className="flex gap-1 mt-4" role="tablist">
          {steps.map((s, k) => (
            <button key={k} onClick={() => setI(k)} aria-label={s[1]}
              className={`h-1.5 flex-1 rounded-full transition-colors ${k <= i ? 'bg-orange-500' : 'bg-slate-800'}`} />
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-2">{fill(c.tour.step, { n: i + 1, total: steps.length })}</p>

        <div className="mt-6 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-8 flex-1">
          <div className="text-5xl" aria-hidden="true">{icon}</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mt-4">{title}</h2>
          <p className="text-slate-300 mt-4 leading-relaxed">{body}</p>
          {tips?.length > 0 && (
            <ul className="mt-6 space-y-2">
              {tips.map(t => (
                <li key={t} className="flex gap-2 text-sm text-slate-200 bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2">
                  <Check className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />{t}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => setI(v => Math.max(v - 1, 0))} disabled={i === 0}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 flex items-center gap-1.5 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" />{c.tour.back}
          </button>
          <button onClick={() => (last ? finish() : setI(v => v + 1))}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:opacity-90">
            {last ? c.tour.done : c.tour.next}<ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
};
