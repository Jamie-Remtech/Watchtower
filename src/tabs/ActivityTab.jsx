import { useState, useEffect, useCallback } from 'react';
import { Activity, MapPin } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ============================================
// ACTIVITY — the operation, unfolding live
// A realtime tail of the events log: every report, marker, patient
// action, device change, AI interaction and alert, with who did it.
// This is the observability window for improving the app against
// real field use.
// ============================================

const TYPE_META = {
  'field.report': { icon: '📋', label: 'Field report' },
  'patient.created': { icon: '🩺', label: 'Patient created' },
  'patient.entry': { icon: '🩺', label: 'Patient entry' },
  'patient.triage': { icon: '🩺', label: 'Triage' },
  'patient.status': { icon: '🩺', label: 'Patient status' },
  'marker.created': { icon: '📍', label: 'Marker placed' },
  'marker.updated': { icon: '📍', label: 'Marker updated' },
  'marker.removed': { icon: '📍', label: 'Marker removed' },
  'device.registered': { icon: '📡', label: 'Device registered' },
  'device.updated': { icon: '📡', label: 'Device updated' },
  'device.removed': { icon: '📡', label: 'Device removed' },
  'attention.raised': { icon: '⚠️', label: 'Attention raised' },
  'attention.acknowledged': { icon: '✅', label: 'Acknowledged' },
  'invitation.created': { icon: '👥', label: 'Invitation created' },
  'user.joined': { icon: '👥', label: 'Member joined' },
  'mapview.created': { icon: '🗺️', label: 'View saved' },
  'mapview.updated': { icon: '🗺️', label: 'View updated' },
  'mapview.removed': { icon: '🗺️', label: 'View removed' },
  'ai.asked': { icon: '🤖', label: 'Asked the AI' },
  'org.updated': { icon: '⚙️', label: 'Org settings' },
  'member.updated': { icon: '👥', label: 'Profile updated' },
  'member.dropped': { icon: '👥', label: 'Member stood down' },
  'member.role_changed': { icon: '👥', label: 'Role changed' },
  'access.requested': { icon: '🔑', label: 'Access requested' },
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'field', label: 'Field & patients', match: t => t.startsWith('field.') || t.startsWith('patient.') },
  { id: 'map', label: 'Map', match: t => t.startsWith('marker.') || t.startsWith('mapview.') },
  { id: 'alerts', label: 'Alerts', match: t => t.startsWith('attention.') },
  { id: 'system', label: 'Team & system', match: t => t.startsWith('device.') || t.startsWith('invitation') || t.startsWith('user.') || t.startsWith('org.') || t.startsWith('ai.') },
];

const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleString();
};

const summarize = (e) => {
  const p = e.payload ?? {};
  if (p.text) return p.text;
  if (e.type === 'patient.triage') return `→ ${p.triage}`;
  if (e.type === 'patient.status') return `→ ${p.status}`;
  if (e.type === 'attention.raised') return p.title ?? '';
  if (e.type === 'attention.acknowledged') return p.title ?? '';
  if (e.type === 'ai.asked') return p.question ?? '';
  if (e.type.startsWith('marker.')) return [p.kind, p.label].filter(Boolean).join(' — ');
  if (e.type.startsWith('device.')) return [p.name, p.kind ?? p.status].filter(Boolean).join(' — ');
  if (e.type.startsWith('mapview.')) return p.name ?? '';
  if (e.type === 'invitation.created') return `role: ${p.role}${p.email ? ` for ${p.email}` : ''}`;
  if (e.type === 'user.joined') return `via ${p.via ?? 'signup'} as ${p.role ?? 'member'}`;
  if (e.type === 'org.updated') return [p.name, p.region].filter(Boolean).join(' · ');
  if (e.type === 'member.updated') return p.name ?? '';
  if (e.type === 'member.dropped') return `${p.name ?? 'member'} (was ${p.was})`;
  if (e.type === 'member.role_changed') return `${p.name ?? 'member'}: ${p.from} → ${p.to}`;
  if (e.type === 'access.requested') return p.message ?? '';
  const s = JSON.stringify(p);
  return s === '{}' ? '' : s.slice(0, 120);
};

export const ActivityTab = () => {
  const [events, setEvents] = useState([]);
  const [names, setNames] = useState({});
  const [filter, setFilter] = useState('all');

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const [{ data: evs }, { data: profs }] = await Promise.all([
      supabase.from('events').select('*').order('at', { ascending: false }).limit(200),
      supabase.from('profiles').select('id, display_name'),
    ]);
    setEvents(evs ?? []);
    setNames(Object.fromEntries((profs ?? []).map(p => [p.id, p.display_name])));
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel('events-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (payload) => {
        setEvents(prev => [payload.new, ...prev].slice(0, 300));
      })
      .subscribe();
    const t = setInterval(refresh, 60 * 1000);
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, [refresh]);

  const f = FILTERS.find(x => x.id === filter);
  const visible = filter === 'all' ? events : events.filter(e => f?.match?.(e.type));

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-orange-400" />
          Activity
          <span className="flex items-center gap-1 text-[10px] font-normal text-green-400">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />live
          </span>
        </h2>
        <div className="flex items-center gap-1">
          {FILTERS.map(x => (
            <button
              key={x.id}
              onClick={() => setFilter(x.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] border ${
                filter === x.id ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {visible.length === 0 && (
          <p className="text-xs text-slate-500 py-8 text-center">Nothing yet in this filter — the log fills as the team works.</p>
        )}
        {visible.map(e => {
          const meta = TYPE_META[e.type] ?? { icon: '•', label: e.type };
          const summary = summarize(e);
          return (
            <div key={e.id} className="flex items-start gap-2.5 px-3 py-2 bg-slate-900/50 border border-slate-800 rounded-lg">
              <span className="text-base leading-none mt-0.5">{meta.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-100">
                  <b className="text-white">{names[e.actor_id] ?? (e.actor_kind === 'user' ? 'Team' : e.actor_kind)}</b>
                  <span className="text-slate-400"> · {meta.label}</span>
                  {summary && <span className="text-slate-300"> — {summary.slice(0, 160)}</span>}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                  <span>{timeAgo(e.payload?.at_client ?? e.at)}</span>
                  {e.payload?.lat != null && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      {Number(e.payload.lat).toFixed(3)}, {Number(e.payload.lng).toFixed(3)}
                    </span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
