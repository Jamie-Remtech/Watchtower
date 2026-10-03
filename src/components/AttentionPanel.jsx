import { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, X, RefreshCw, Check, BellOff, Play, Loader2 } from 'lucide-react';
import { matchTriggerKind } from '../lib/protocols';
import { useI18n } from '../i18n/index.jsx';
import { useTranslations } from '../lib/translate';

const SEVERITY_META = {
  critical: { icon: AlertTriangle, row: 'border-red-500/40 bg-red-500/10', text: 'text-red-400', label: 'sev.critical' },
  warning: { icon: AlertCircle, row: 'border-orange-500/30 bg-orange-500/5', text: 'text-orange-400', label: 'sev.warning' },
  info: { icon: Info, row: 'border-slate-700 bg-slate-800/40', text: 'text-blue-400', label: 'sev.info' },
};

const timeAgoT = (t, iso) => {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return t('time.justNow');
  if (s < 3600) return t('time.minAgo', { m: Math.floor(s / 60) });
  if (s < 86400) return t('time.hAgo', { h: Math.floor(s / 3600) });
  return t('time.dAgo', { d: Math.floor(s / 86400) });
};

// Slide-over inbox for the attention queue. Ranked by severity;
// acknowledge keeps an item visible but quiet; device conditions
// auto-resolve when they clear.
export const AttentionPanel = ({ open, onClose, items, sweeping, lastSweep, onSweep, onAcknowledge, onRunProtocol, canRunProtocols }) => {
  const [launching, setLaunching] = useState(null);
  const [launchError, setLaunchError] = useState(null);
  const { t, lang } = useI18n();
  const timeAgo = (iso) => timeAgoT(t, iso);
  // Alert texts are written by the tower in English: translate for the reader
  const texts = open && lang !== 'en' ? items.flatMap(i => [i.title, i.detail].filter(Boolean)) : [];
  const tr = useTranslations(texts, lang, texts.length > 0);
  const T = (x) => (x ? tr[x] ?? x : x);
  if (!open) return null;

  const openItems = items.filter(i => i.status === 'open');
  const acked = items.filter(i => i.status === 'acknowledged');

  const launch = async (item) => {
    setLaunching(item.id);
    setLaunchError(null);
    try {
      await onRunProtocol(item);
    } catch (e) {
      setLaunchError(e.message ?? 'Could not start protocol');
    }
    setLaunching(null);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 w-full sm:w-96 bg-slate-900 border-l border-slate-800 z-50 flex flex-col">
        <header className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white">{t('ap.title')}</h2>
            <p className="text-[10px] text-slate-500">
              {t('ap.counts', { o: openItems.length, a: acked.length })}
              {lastSweep && t('ap.checked', { ago: timeAgo(lastSweep.toISOString()) })}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onSweep}
              disabled={sweeping}
              className="p-2 text-slate-400 hover:text-orange-400 rounded-lg disabled:opacity-50"
              title={t('ap.runChecks')}
            >
              <RefreshCw className={`w-4 h-4 ${sweeping ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {items.length === 0 && (
            <div className="text-center py-12">
              <BellOff className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 text-sm font-medium">{t('ap.allQuiet')}</p>
              <p className="text-slate-500 text-xs mt-1">
                {t('ap.watching')}
              </p>
            </div>
          )}

          {openItems.map(item => {
            const meta = SEVERITY_META[item.severity] ?? SEVERITY_META.info;
            return (
              <div key={item.id} className={`border rounded-xl p-3 ${meta.row}`}>
                <div className="flex items-start gap-2.5">
                  <meta.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.text}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold ${meta.text}`}>{t(meta.label)}</span>
                      <span className="text-[9px] text-slate-500">{timeAgo(item.created_at)}</span>
                    </div>
                    <p className="text-xs font-semibold text-white mt-0.5">{T(item.title)}</p>
                    {item.detail && <p className="text-[11px] text-slate-400 mt-1 break-words">{T(item.detail)}</p>}
                  </div>
                </div>
                <div className="flex justify-end items-center gap-1.5 mt-2">
                  {launchError && launching === null && (
                    <span className="text-[9px] text-red-400 mr-auto">{launchError}</span>
                  )}
                  {canRunProtocols && onRunProtocol && matchTriggerKind(item) && (
                    <button
                      onClick={() => launch(item)}
                      disabled={launching === item.id}
                      className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 rounded-lg text-[10px] font-medium text-orange-300 flex items-center gap-1.5 disabled:opacity-50"
                      title="Start the matching playbook — the whole team gets the checklist"
                    >
                      {launching === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      {t('ap.runProtocol')}
                    </button>
                  )}
                  <button
                    onClick={() => onAcknowledge(item.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] font-medium text-slate-200 flex items-center gap-1.5"
                  >
                    <Check className="w-3 h-3" />{t('ap.acknowledge')}
                  </button>
                </div>
              </div>
            );
          })}

          {acked.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide pt-2">{t('ap.acknowledged')}</p>
              {acked.map(item => {
                const meta = SEVERITY_META[item.severity] ?? SEVERITY_META.info;
                return (
                  <div key={item.id} className="border border-slate-800 rounded-xl p-3 opacity-60">
                    <div className="flex items-start gap-2.5">
                      <meta.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.text}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-300">{T(item.title)}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          {t('ap.ackAgo', { ago: item.acknowledged_at ? timeAgo(item.acknowledged_at) : '' })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <footer className="px-4 py-2 border-t border-slate-800 flex-shrink-0">
          <p className="text-[9px] text-slate-600">
            {t('ap.footer')}
          </p>
        </footer>
      </aside>
    </>
  );
};
