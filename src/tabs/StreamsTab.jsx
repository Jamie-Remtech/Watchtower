import { Video } from 'lucide-react';
import { LiveEmptyState } from '../components/LiveEmptyState';
import { useDevices } from '../hooks/useDevices';

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

const STATUS_STYLE = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  offline: 'bg-slate-500/20 text-slate-400 border-slate-600',
  maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

export const StreamsTab = () => {
  const { devices } = useDevices();

  if (devices.length === 0) {
    return (
      <LiveEmptyState
        icon={Video}
        title="No feeds connected"
        description="Register devices in Settings and their feeds appear here."
        facts={[
          { label: 'Registered devices', value: 0 },
          { label: 'Active now', value: 0 },
        ]}
        hint="Connected to Supabase · live mode"
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Video className="w-4 h-4 text-orange-400" />
        <h2 className="text-sm font-bold text-white">Live Feeds</h2>
        <span className="text-xs text-slate-500">
          {devices.length} device{devices.length === 1 ? '' : 's'} · {devices.filter(d => d.status === 'active').length} active
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
                  {isVideo ? 'Awaiting video ingest' : 'Awaiting telemetry'}
                </p>
              </div>
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{d.name}</p>
                  <p className="text-[10px] text-slate-500">{meta.label}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize flex-shrink-0 ${STATUS_STYLE[d.status] ?? STATUS_STYLE.offline}`}>
                  {d.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-600 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
        Connected to Supabase · video ingest (RTSP/WebRTC) is a roadmap step
      </p>
    </div>
  );
};
