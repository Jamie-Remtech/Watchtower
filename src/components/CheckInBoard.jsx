import { useState, useEffect } from 'react';
import { Hand, Loader2, X, ShieldCheck, LifeBuoy, Clock, Phone, MapPin } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useOrg } from '../hooks/useOrg';
import { usePositions } from '../hooks/usePositions';
import { hasAtLeast } from '../auth/roles';
import { parSettings, expectedFor } from '../hooks/useCheckins';
import { useI18n } from '../i18n/index.jsx';
import { useTranslations } from '../lib/translate';

const mins = (ms) => Math.floor(ms / 60000);
const agoT = (t, iso) => {
  const m = mins(Date.now() - new Date(iso).getTime());
  return m < 1 ? t('time.justNow') : m < 60 ? t('time.minAgo', { m }) : t('time.hmAgo', { h: Math.floor(m / 60), m: m % 60 });
};

// Coordinator view of personnel accountability: request a check-in
// for the whole org or one team, then watch answers arrive. Silence
// turns amber, then red, at the org's own thresholds.
export const CheckInBoard = ({ members, teams, checkins, responses, requestCheckin, closeCheckin }) => {
  const { profile, session } = useAuth();
  const org = useOrg();
  const par = parSettings(org);
  const { latest: positions } = usePositions();
  const canRequest = hasAtLeast(profile?.role, par.requestMinRole);
  const [composing, setComposing] = useState(false);
  const [teamId, setTeamId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [, tick] = useState(0);
  const { t, lang } = useI18n();
  const ago = (iso) => agoT(t, iso);
  const msgs = (checkins ?? []).filter(c => c.status === 'open' && c.message).map(c => c.message);
  const msgTr = useTranslations(msgs, lang, msgs.length > 0);

  // Re-render each 15 s so waiting times and colours advance
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const open = (checkins ?? []).filter(c => c.status === 'open');
  const recentClosed = (checkins ?? []).filter(c => c.status === 'closed').slice(0, 3);
  const teamName = (id) => teams.find(t => t.id === id)?.name;
  const posOf = (id) => positions.find(p => p.profile_id === id);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const target = { team_id: teamId || null, requested_by: session?.user?.id };
      const expected = expectedFor(target, members).map(m => m.id);
      await requestCheckin({ teamId: teamId || null, message, expectedIds: expected });
      setComposing(false);
      setMessage('');
      setTeamId('');
    } catch (e) {
      setError(e.message ?? t('ci.sendFail'));
    }
    setBusy(false);
  };

  if (!canRequest && open.length === 0) return null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Hand className="w-4 h-4 text-orange-400" />{t('cib.title')}
        </h3>
        {canRequest && !composing && (
          <button
            onClick={() => setComposing(true)}
            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
          >
            <Hand className="w-3.5 h-3.5" />{t('cib.request')}
          </button>
        )}
      </div>

      {composing && (
        <div className="p-3 bg-slate-800/60 border border-orange-500/30 rounded-lg space-y-2">
          <div className="flex gap-2 flex-wrap">
            <select
              value={teamId}
              onChange={e => setTeamId(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none"
            >
              <option value="">{t('cib.everyone')}</option>
              {teams.map(tm => <option key={tm.id} value={tm.id}>{t('cib.team', { name: tm.name })}</option>)}
            </select>
            <input
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('cib.msgPh')}
              className="flex-1 min-w-[180px] px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
            />
          </div>
          <p className="text-[10px] text-slate-500">
            {t('cib.asks', { n: expectedFor({ team_id: teamId || null, requested_by: session?.user?.id }, members).length })}{' '}
            {t('cib.silence', { a: par.amberMin, r: par.redMin })}{par.autoEscalate ? t('cib.reAlert') : ''}.
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setComposing(false)} className="px-3 py-1.5 text-xs text-slate-400">{t('cib.cancel')}</button>
            <button onClick={send} disabled={busy} className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{t('cib.send')}
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      {open.map(c => {
        const expected = expectedFor(c, members);
        const answered = responses.filter(r => r.checkin_id === c.id);
        const elapsed = Date.now() - new Date(c.created_at).getTime();
        const okCount = answered.filter(r => r.status === 'ok').length;
        const helpCount = answered.filter(r => r.status === 'help').length;
        const waiting = expected.filter(m => !answered.some(r => r.profile_id === m.id));
        const silenceColour = mins(elapsed) >= par.redMin ? 'red' : mins(elapsed) >= par.amberMin ? 'amber' : 'none';
        return (
          <div key={c.id} className="border border-slate-700 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-800/60 flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-white">
                <span className="font-semibold">{c.team_id ? t('cib.teamName', { name: teamName(c.team_id) ?? '' }) : t('cib.wholeCompany')}</span>
                <span className="text-slate-400"> · {t('cib.asked', { ago: ago(c.created_at) })}{c.source === 'auto' ? t('cib.byTower') : ''}</span>
                {c.message && <span className="text-slate-300"> · “{msgTr[c.message] ?? c.message}”</span>}
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-green-400">{t('cib.ok', { n: okCount })}</span>
                {helpCount > 0 && <span className="text-red-400 font-bold animate-pulse">{t('cib.help', { n: helpCount })}</span>}
                <span className="text-slate-400">{t('cib.waiting', { n: waiting.length })}</span>
                <button
                  onClick={() => closeCheckin(c.id, { ok: okCount, help: helpCount, silent: waiting.length, minutes: mins(elapsed) })}
                  className="ml-1 px-2 py-0.5 border border-slate-600 rounded text-slate-300 hover:text-white flex items-center gap-1"
                  title={t('cib.close')}
                ><X className="w-3 h-3" />{t('cib.close')}</button>
              </div>
            </div>
            <div className="divide-y divide-slate-800">
              {expected.map(m => {
                const r = answered.find(x => x.profile_id === m.id);
                const pos = posOf(m.id);
                const phone = m.mobile !== '—' ? m.mobile : m.phone !== '—' ? m.phone : null;
                const state = r?.status === 'help' ? 'help' : r ? 'ok' : silenceColour;
                const row = {
                  help: 'bg-red-500/15', ok: '', red: 'bg-red-500/10', amber: 'bg-amber-500/10', none: '',
                }[state];
                return (
                  <div key={m.id} className={`px-3 py-2 flex items-center gap-2 text-xs ${row}`}>
                    {state === 'help' ? <LifeBuoy className="w-4 h-4 text-red-400 flex-shrink-0" />
                      : state === 'ok' ? <ShieldCheck className="w-4 h-4 text-green-400 flex-shrink-0" />
                      : <Clock className={`w-4 h-4 flex-shrink-0 ${state === 'red' ? 'text-red-400' : state === 'amber' ? 'text-amber-400' : 'text-slate-500'}`} />}
                    <span className="text-white font-medium flex-1 truncate">{m.name}</span>
                    <span className={`text-[11px] ${state === 'help' ? 'text-red-300 font-bold' : state === 'ok' ? 'text-green-400' : 'text-slate-400'}`}>
                      {r ? `${r.status === 'help' ? t('cib.needsHelp') : t('cib.answeredOk')} · ${ago(r.at)}${r.note ? ` · “${r.note}”` : ''}` : t('cib.noAnswer', { m: mins(elapsed) })}
                    </span>
                    {pos && (
                      <span className="hidden sm:flex items-center gap-0.5 text-[10px] text-slate-500" title={`${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`}>
                        <MapPin className="w-3 h-3" />{ago(pos.at)}
                      </span>
                    )}
                    {phone && r?.status !== 'ok' && (
                      <a href={`tel:${phone}`} className="p-1 text-sky-300 hover:text-sky-200" title={t('cib.call', { phone })}><Phone className="w-3.5 h-3.5" /></a>
                    )}
                  </div>
                );
              })}
              {expected.length === 0 && <p className="px-3 py-2 text-[11px] text-slate-500">{t('cib.none')}</p>}
            </div>
          </div>
        );
      })}

      {open.length === 0 && recentClosed.length > 0 && (
        <p className="text-[11px] text-slate-500">
          {t('cib.lastClosed', { ago: ago(recentClosed[0].closed_at ?? recentClosed[0].created_at) })}
        </p>
      )}
    </div>
  );
};
