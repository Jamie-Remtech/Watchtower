import { Video } from 'lucide-react';
import { LiveEmptyState } from '../components/LiveEmptyState';
import { useDevices } from '../hooks/useDevices';
import { useI18n } from '../i18n/index.jsx';

// ============================================
// STREAMS TAB — real feeds only
// Device cards show live status; video ingest (RTSP/WebRTC)
// is the roadmap step that fills the frames.
// ============================================

const KIND_META = {
  drone: { icon: '🚁', label: 'Drone' },
  ptz_camera: { icon: '📹', label: 'PTZ Camera' },
  camera: { icon: '📷', label: 'Fixed Camera' },
  sensor: { icon: '📡', label: 'Sensor' },
  edge_box: { icon: '🖥️', label: 'Edge AI Box' },
};

// Translate a key built from data; show the raw value when no text exists for it.
const tOr = (t, key, fallback) => { const v = t(key); return v === key ? fallback : v; };

const STATUS_STYLE = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  offline: 'bg-slate-500/20 text-slate-400 border-slate-600',
  maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

export const StreamsTab = () => {
  const { t } = useI18n();
  const { devices } = useDevices();

  if (devices.length === 0) {
    return (
      <LiveEmptyState
        icon={Video}
        title={t('dev.noFeeds')}
        description={t('dev.noFeedsNote')}
        facts={[
          { label: t('dev.registered'), value: 0 },
          { label: t('dev.activeNow'), value: 0 },
        ]}
        hint={t('dev.liveMode')}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Video className="w-4 h-4 text-orange-400" />
        <h2 className="text-sm font-bold text-white">{t('dev.liveFeeds')}</h2>
        <span className="text-xs text-slate-500">
          {t(devices.length === 1 ? 'dev.device1' : 'dev.deviceN', { n: devices.length })} · {t('dev.activeCount', { n: devices.filter(d => d.status === 'active').length })}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {devices.map(d => {
          const meta = KIND_META[d.kind] ?? { icon: '📍', label: d.kind };
          const isVideo = ['drone', 'ptz_camera', 'camera'].includes(d.kind);
          return (
            <div key={d.id} className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              <div className="aspect-video bg-slate-950 flex flex-col items-center justify-center gap-2">
                <span className="text-3xl opacity-60">{meta.icon}</span>
                <p className="text-[11px] text-slate-500">
                  {isVideo ? t('dev.awaitingVideo') : t('dev.awaitingTelemetry')}
                </p>
              </div>
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{d.name}</p>
                  <p className="text-[10px] text-slate-500">{KIND_META[d.kind] ? t(`dev.kind.${d.kind}`) : meta.label}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize flex-shrink-0 ${STATUS_STYLE[d.status] ?? STATUS_STYLE.offline}`}>
                  {tOr(t, `dev.status.${d.status}`, d.status)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-600 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
        {t('dev.streamsFooter')}
      </p>
    </div>
  );
};
