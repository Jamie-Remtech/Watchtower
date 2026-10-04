import { useState, useEffect, useCallback } from 'react';
import { Activity, MapPin } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useI18n } from '../i18n/index.jsx';

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
  'protocol.created': { icon: '📋', label: 'Protocol created' },
  'protocol.updated': { icon: '📋', label: 'Protocol updated' },
  'protocol.deleted': { icon: '📋', label: 'Protocol deleted' },
  'protocol.run_started': { icon: '▶️', label: 'Protocol started' },
  'protocol.step_done': { icon: '☑️', label: 'Step completed' },
  'protocol.run_completed': { icon: '✅', label: 'Protocol completed' },
  'protocol.run_aborted': { icon: '⏹️', label: 'Protocol aborted' },
  'ai.action': { icon: '⚡', label: 'AI acted' },
  'brief.sent': { icon: '☀️', label: 'Daily brief' },
  'checkin.requested': { icon: '✋', label: 'Check-in requested' },
  'checkin.answered': { icon: '✋', label: 'Check-in answered' },
  'checkin.escalated': { icon: '⏰', label: 'Check-in silence' },
  'checkin.closed': { icon: '✋', label: 'Check-in closed' },
  'log.entry_edited': { icon: '✏️', label: 'Log entry corrected' },
  'log.entry_removed': { icon: '🗑️', label: 'Log entry removed' },
  'log.entry_restored': { icon: '↩️', label: 'Log entry restored' },
  'vehicle.help': { icon: '🆘', label: 'Help call from vehicle' },
  'vehicle.unit_named': { icon: '🚒', label: 'Unit named' },
  'app.error': { icon: '⚠️', label: 'Screen crashed' },
  'member.notifications_updated': { icon: '🔔', label: 'Notification settings' },
  'team.created': { icon: '🧩', label: 'Team created' },
  'team.removed': { icon: '🧩', label: 'Team removed' },
  'member.team_changed': { icon: '🧩', label: 'Team assignment' },
  'platform.company_created': { icon: '🏢', label: 'Company created' },
  'platform.member_moved': { icon: '🏢', label: 'Member moved' },
  'platform.invoice_created': { icon: '🧾', label: 'Invoice created' },
  'platform.link_created': { icon: '🔗', label: 'Companies linked' },
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'field', label: 'Field & patients', match: t => t.startsWith('field.') || t.startsWith('patient.') },
  { id: 'map', label: 'Map', match: t => t.startsWith('marker.') || t.startsWith('mapview.') },
  { id: 'alerts', label: 'Alerts', match: t => t.startsWith('attention.') },
  { id: 'protocols', label: 'Protocols', match: t => t.startsWith('protocol.') },
  { id: 'system', label: 'Team & system', match: t => t.startsWith('device.') || t.startsWith('invitation') || t.startsWith('user.') || t.startsWith('org.') || t.startsWith('ai.') },
];

const timeAgo = (iso, t) => {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return t('time.justNow');
  if (s < 3600) return t('act.mAgo', { m: Math.floor(s / 60) });
  if (s < 86400) return t('act.hAgo', { h: Math.floor(s / 3600) });
  return new Date(iso).toLocaleString();
};

const summarize = (e, t) => {
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
  if (e.type === 'invitation.created') return p.email ? t('act.sum.roleFor', { role: p.role, email: p.email }) : t('act.sum.role', { role: p.role });
  if (e.type === 'user.joined') return t('act.sum.joined', { via: p.via ?? t('act.sum.signup'), role: p.role ?? t('act.sum.member') });
  if (e.type === 'org.updated') return [p.name, p.region].filter(Boolean).join(' · ');
  if (e.type === 'member.updated') return p.name ?? '';
  if (e.type === 'member.dropped') return t('act.sum.was', { name: p.name ?? t('act.sum.member'), was: p.was });
  if (e.type === 'member.role_changed') return `${p.name ?? t('act.sum.member')}: ${p.from} → ${p.to}`;
  if (e.type === 'access.requested') return p.message ?? '';
  if (e.type === 'protocol.step_done') return `${p.run}: ${p.step}`;
  if (e.type.startsWith('protocol.run_')) return p.total ? t('act.sum.steps', { name: p.name, done: p.done, total: p.total }) : `${p.name}`;
  if (e.type.startsWith('protocol.')) return p.name ?? '';
  if (e.type === 'ai.action') return `${p.action}: ${p.protocol ?? p.title ?? p.text ?? ''}`;
  if (e.type === 'brief.sent') return `${p.label}: ${p.brief}`;
  if (e.type === 'checkin.requested') return p.source === 'auto' ? t('act.sum.auto', { trigger: p.trigger }) : (p.message ?? t('act.sum.membersAsked', { n: p.expected ?? '' }));
  if (e.type === 'checkin.answered') return p.status === 'help' ? (p.note ? t('act.sum.needsHelpNote', { note: p.note }) : t('cib.needsHelp')) : t('cib.answeredOk');
  if (e.type === 'checkin.escalated') return t('act.sum.noAnswer', { name: p.name, m: p.minutes });
  if (e.type.startsWith('log.entry_')) return p.reason ? t('act.sum.reason', { reason: p.reason }) : '';
  if (e.type === 'vehicle.help') return p.unit ?? '';
  if (e.type === 'vehicle.unit_named') return p.unit ?? '';
  if (e.type === 'app.error') return `${p.where}: ${p.message}`;
  if (e.type === 'checkin.closed') return t('act.sum.closed', { ok: p.ok ?? 0, help: p.help ?? 0, silent: p.silent ?? 0, m: p.minutes ?? 0 });
  if (e.type === 'member.notifications_updated') return t('act.sum.notif', { level: p.level, sound: p.sound });
  if (e.type.startsWith('team.')) return p.name ?? '';
  if (e.type === 'member.team_changed') return `${p.name ?? t('act.sum.member')} → ${p.team}`;
  if (e.type === 'platform.member_moved') return `${p.name} → ${p.to} (${p.role})`;
  if (e.type === 'platform.invoice_created') return `${p.company}: ${p.label} — $${p.amount}`;
  if (e.type === 'platform.link_created') return `${p.a} ⇄ ${p.b}`;
  if (e.type.startsWith('platform.')) return p.name ?? '';
  const s = JSON.stringify(p);
  return s === '{}' ? '' : s.slice(0, 120);
};

export const ActivityTab = () => {
  const { t } = useI18n();
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
      .channel(`events-live-${Math.random().toString(36).slice(2, 10)}`)
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
          {t('nav.activity')}
          <span className="flex items-center gap-1 text-[10px] font-normal text-green-400">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />{t('act.live')}
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
              {t(`act.filter.${x.id}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {visible.length === 0 && (
          <p className="text-xs text-slate-500 py-8 text-center">{t('act.empty')}</p>
        )}
        {visible.map(e => {
          const meta = TYPE_META[e.type] ?? { icon: '•', label: e.type };
          const typeKey = `act.type.${e.type}`;
          const typeLabel = t(typeKey);
          const label = typeLabel === typeKey ? meta.label : typeLabel;
          const summary = summarize(e, t);
          return (
            <div key={e.id} className="flex items-start gap-2.5 px-3 py-2 bg-slate-900/50 border border-slate-800 rounded-lg">
              <span className="text-base leading-none mt-0.5">{meta.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-100">
                  <b className="text-white">{names[e.actor_id] ?? (e.actor_kind === 'user' ? t('act.team') : e.actor_kind)}</b>
                  <span className="text-slate-400"> · {label}</span>
                  {summary && <span className="text-slate-300"> — {summary.slice(0, 160)}</span>}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                  <span>{timeAgo(e.payload?.at_client ?? e.at, t)}</span>
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
