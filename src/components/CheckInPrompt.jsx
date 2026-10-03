import { useState, useEffect, useRef } from 'react';
import { ShieldCheck, LifeBuoy, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { playAlert } from '../lib/alertSound';
import { withDefaults } from '../lib/notifyPrefs';
import { useI18n } from '../i18n/index.jsx';
import { useTranslations } from '../lib/translate';

const MAX_AGE_MS = 3 * 3600 * 1000; // a check-in older than 3 h no longer interrupts

// Full-screen answer card: shown on any tab while an open check-in
// expects this member and they haven't answered. Two huge targets,
// usable with gloves, plus an optional one-line note on NEED HELP.
export const CheckInPrompt = ({ checkins, responses, respond }) => {
  const { profile, session } = useAuth();
  const myId = session?.user?.id;
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const played = useRef(new Set());
  const { t, lang } = useI18n();

  // Arriving from a check-in push: /?checkin=<id> — tidy the URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.has('checkin')) {
      p.delete('checkin');
      const qs = p.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, []);

  const pending = (checkins ?? []).find(c =>
    c.status === 'open'
    && Date.now() - new Date(c.created_at).getTime() < MAX_AGE_MS
    && c.requested_by !== myId
    && profile?.role && profile.role !== 'viewer'
    && (!c.team_id || c.team_id === profile.team_id)
    && !(responses ?? []).some(r => r.checkin_id === c.id && r.profile_id === myId)
  );

  useEffect(() => {
    if (pending && !played.current.has(pending.id)) {
      played.current.add(pending.id);
      playAlert(withDefaults(profile?.notification_prefs).sound);
    }
  }, [pending, profile?.notification_prefs]);

  const msgTr = useTranslations(pending?.message ? [pending.message] : [], lang, Boolean(pending?.message));

  if (!pending) return null;

  const answer = async (status) => {
    setBusy(status);
    setError(null);
    try {
      await respond(pending.id, status, status === 'help' ? note : '');
      setNote('');
      setShowNote(false);
    } catch (e) {
      setError(e.message ?? t('ci.sendFail'));
    }
    setBusy(null);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/95 flex items-center justify-center p-4 short:p-2 overflow-y-auto wt-safe-x">
      <div className="w-full max-w-md short:max-w-2xl space-y-4 short:space-y-2 text-center my-auto">
        <p className="text-xs uppercase tracking-widest text-orange-400 font-bold">{t('ci.requested')}</p>
        <h2 className="text-2xl short:text-xl font-bold text-white">{t('ci.areYouOk')}</h2>
        {pending.message && <p className="text-sm text-slate-300">“{msgTr[pending.message] ?? pending.message}”</p>}
        <p className="text-[11px] text-slate-500">{t('ci.positionNote')}</p>

        <div className="grid gap-4 short:gap-3 short:grid-cols-2">
        <button
          onClick={() => answer('ok')}
          disabled={!!busy}
          className="w-full py-8 short:py-5 rounded-2xl bg-green-600 hover:bg-green-500 active:scale-[0.99] text-white text-2xl font-bold flex items-center justify-center gap-3 disabled:opacity-60"
        >
          {busy === 'ok' ? <Loader2 className="w-8 h-8 animate-spin" /> : <ShieldCheck className="w-8 h-8" />}
          {t('ci.ok')}
        </button>

        <button
          onClick={() => answer('help')}
          disabled={!!busy}
          className="w-full py-8 short:py-5 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-[0.99] text-white text-2xl font-bold flex items-center justify-center gap-3 disabled:opacity-60"
        >
          {busy === 'help' ? <Loader2 className="w-8 h-8 animate-spin" /> : <LifeBuoy className="w-8 h-8" />}
          {t('ci.help')}
        </button>
        </div>
        {showNote ? (
          <input
            autoFocus
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t('ci.notePh')}
            className="w-full px-4 py-3 bg-slate-800 border border-red-500/40 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none"
          />
        ) : (
          <button onClick={() => setShowNote(true)} className="text-xs text-slate-400 underline">
            {t('ci.addNote')}
          </button>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
};
