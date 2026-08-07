import { AlertTriangle, AlertCircle, Info, X, RefreshCw, Check, BellOff } from 'lucide-react';

const SEVERITY_META = {
  critical: { icon: AlertTriangle, row: 'border-red-500/40 bg-red-500/10', text: 'text-red-400', label: 'CRITICAL' },
  warning: { icon: AlertCircle, row: 'border-orange-500/30 bg-orange-500/5', text: 'text-orange-400', label: 'WARNING' },
  info: { icon: Info, row: 'border-slate-700 bg-slate-800/40', text: 'text-blue-400', label: 'INFO' },
};

const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// Slide-over inbox for the attention queue. Ranked by severity;
// acknowledge keeps an item visible but quiet; device conditions
// auto-resolve when they clear.
export const AttentionPanel = ({ open, onClose, items, sweeping, lastSweep, onSweep, onAcknowledge }) => {
  if (!open) return null;

  const openItems = items.filter(i => i.status === 'open');
  const acked = items.filter(i => i.status === 'acknowledged');

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 w-full sm:w-96 bg-slate-900 border-l border-slate-800 z-50 flex flex-col">
        <header className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white">Attention</h2>
            <p className="text-[10px] text-slate-500">
              {openItems.length} open · {acked.length} acknowledged
              {lastSweep && ` · checked ${timeAgo(lastSweep.toISOString())}`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onSweep}
              disabled={sweeping}
              className="p-2 text-slate-400 hover:text-orange-400 rounded-lg disabled:opacity-50"
              title="Run checks now"
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
              <p className="text-slate-300 text-sm font-medium">All quiet</p>
              <p className="text-slate-500 text-xs mt-1">
                Devices, nearby hazards, weather, and admin items are being watched.
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
                      <span className={`text-[9px] font-bold ${meta.text}`}>{meta.label}</span>
                      <span className="text-[9px] text-slate-500">{timeAgo(item.created_at)}</span>
                    </div>
                    <p className="text-xs font-semibold text-white mt-0.5">{item.title}</p>
                    {item.detail && <p className="text-[11px] text-slate-400 mt-1 break-words">{item.detail}</p>}
                  </div>
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => onAcknowledge(item.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] font-medium text-slate-200 flex items-center gap-1.5"
                  >
                    <Check className="w-3 h-3" />Acknowledge
                  </button>
                </div>
              </div>
            );
          })}

          {acked.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide pt-2">Acknowledged</p>
              {acked.map(item => {
                const meta = SEVERITY_META[item.severity] ?? SEVERITY_META.info;
                return (
                  <div key={item.id} className="border border-slate-800 rounded-xl p-3 opacity-60">
                    <div className="flex items-start gap-2.5">
                      <meta.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.text}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-300">{item.title}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          acknowledged {item.acknowledged_at ? timeAgo(item.acknowledged_at) : ''}
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
            Watching: device health · NASA EONET hazards · USGS seismic · Open-Meteo fire weather · invitations
          </p>
        </footer>
      </aside>
    </>
  );
};
