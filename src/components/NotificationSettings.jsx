import { useState, useEffect } from 'react';
import { Bell, Volume2, Loader2, Check, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { CATEGORIES, LEVELS, SOUNDS, withDefaults } from '../lib/notifyPrefs';
import { playAlert } from '../lib/alertSound';
import { enableNotifications, notificationPermission } from '../lib/push';
import { logEvent } from '../lib/eventLog';

// Each member's own notification center: what reaches them, from what
// severity up, and how it sounds. Check-ins and life-safety criticals
// can be made quieter here but never switched off.
export const NotificationSettings = () => {
  const { profile, session, reloadProfile } = useAuth();
  const [prefs, setPrefs] = useState(withDefaults(profile?.notification_prefs));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [testNote, setTestNote] = useState(null);
  const [perm, setPerm] = useState(notificationPermission());

  useEffect(() => { setPrefs(withDefaults(profile?.notification_prefs)); }, [profile?.notification_prefs]);

  const save = async (next) => {
    setPrefs(next);
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('profiles').update({ notification_prefs: next }).eq('id', session?.user?.id);
    if (err) setError(err.message);
    else {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      reloadProfile?.();
      logEvent('member.notifications_updated', { level: next.level, sound: next.sound });
    }
    setBusy(false);
  };

  const sendTest = async () => {
    setTestNote('Sending…');
    const { data, error: err } = await supabase.functions.invoke('push-notify', {
      body: {
        kind: 'attention', category: 'hazard', severity: 'critical',
        title: '🔔 Test — your Watchtower alert', body: `This is how a critical alert reaches you (sound: ${prefs.sound}).`,
        url: '/', tag: 'self-test', profile_ids: [session?.user?.id],
      },
    });
    if (err || data?.error) setTestNote(`Could not send: ${err?.message ?? data.error}`);
    else if (!data?.sent) setTestNote('No device registered for push yet — enable notifications on this device first.');
    else setTestNote(`Sent to ${data.sent} device${data.sent > 1 ? 's' : ''}.`);
  };

  const row = 'flex items-start gap-2.5 p-2.5 rounded-lg border';

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-orange-400" />My notifications
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
          {saved && <Check className="w-3.5 h-3.5 text-green-400" />}
        </h3>
        {perm !== 'granted' ? (
          <button
            onClick={async () => { await enableNotifications(); setPerm(notificationPermission()); }}
            className="px-3 py-1.5 bg-sky-500/20 border border-sky-500/40 text-sky-300 rounded-lg text-xs font-medium"
          >Enable notifications on this device</button>
        ) : (
          <span className="text-[11px] text-green-400">This device receives alerts</span>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-slate-500 uppercase tracking-wide">What reaches me</p>
        {CATEGORIES.map(c => (
          <label key={c.id} className={`${row} cursor-pointer ${prefs.categories[c.id] ? 'border-slate-700 bg-slate-800/40' : 'border-slate-800 opacity-70'}`}>
            <input
              type="checkbox"
              checked={prefs.categories[c.id] !== false}
              onChange={e => save({ ...prefs, categories: { ...prefs.categories, [c.id]: e.target.checked } })}
              className="mt-0.5 accent-orange-500"
            />
            <span className="min-w-0">
              <span className="block text-xs text-white font-medium">{c.label}</span>
              <span className="block text-[10px] text-slate-500">{c.desc}</span>
            </span>
          </label>
        ))}
        <p className="text-[10px] text-slate-500">
          Check-ins and life-safety criticals always reach you — switching their category off makes them arrive silently instead.
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-slate-500 uppercase tracking-wide">How alert I want to be</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
          {LEVELS.map(l => (
            <button
              key={l.id}
              onClick={() => save({ ...prefs, level: l.id })}
              className={`text-left p-2.5 rounded-lg border ${prefs.level === l.id ? 'border-orange-500/50 bg-orange-500/10' : 'border-slate-700 bg-slate-800/40'}`}
            >
              <span className="block text-xs text-white font-medium">{l.label}</span>
              <span className="block text-[10px] text-slate-500">{l.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-slate-500 uppercase tracking-wide">My alert sound</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {SOUNDS.map(snd => (
            <div key={snd.id} className={`flex items-center gap-2 p-2.5 rounded-lg border ${prefs.sound === snd.id ? 'border-orange-500/50 bg-orange-500/10' : 'border-slate-700 bg-slate-800/40'}`}>
              <button onClick={() => save({ ...prefs, sound: snd.id })} className="flex-1 text-left min-w-0">
                <span className="block text-xs text-white font-medium">{snd.label}</span>
                <span className="block text-[10px] text-slate-500">{snd.desc}</span>
              </button>
              <button onClick={() => playAlert(snd.id)} className="p-1.5 text-slate-400 hover:text-orange-300" title="Preview">
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500">
          Plays inside Watchtower and sets your vibration pattern. While the app is closed, phones use their own notification tone until the native Watchtower app ships.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={sendTest} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 flex items-center gap-1.5 hover:border-orange-500/40">
          <Send className="w-3.5 h-3.5" />Send me a test alert
        </button>
        {testNote && <span className="text-[11px] text-slate-400">{testNote}</span>}
        {error && <span className="text-[11px] text-red-400">{error}</span>}
      </div>
    </div>
  );
};
