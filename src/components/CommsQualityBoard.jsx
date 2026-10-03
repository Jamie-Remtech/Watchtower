import { useEffect, useState } from 'react';
import { RadioTower } from 'lucide-react';
import { usePositions } from '../hooks/usePositions';
import { useTeam } from '../hooks/useTeam';
import { memberLink, QUALITY_STYLE } from '../lib/link';
import { BarsIcon } from './SignalPill';
import { useI18n } from '../i18n/index.jsx';

const RANK = { lost: 0, offline: 1, poor: 2, fair: 3, unknown: 4, good: 5 };

// Control-centre view: every tracked member's link, worst first. A member
// whose device has gone quiet for 10+ minutes shows as "lost contact".
export const CommsQualityBoard = () => {
  const { t } = useI18n();
  const { latest } = usePositions();
  const { liveMembers } = useTeam();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);

  const rows = liveMembers
    .map(m => {
      const pos = latest.find(p => p.profile_id === m.id);
      if (!pos || now - Date.parse(pos.at) > 24 * 3600e3) return null;
      return { m, pos, link: memberLink(pos, now) };
    })
    .filter(Boolean)
    .sort((a, b) => (RANK[a.link.quality] ?? 9) - (RANK[b.link.quality] ?? 9));

  const lost = rows.filter(r => r.link.quality === 'lost').length;
  const weak = rows.filter(r => ['poor', 'offline'].includes(r.link.quality)).length;
  const fmtAge = (min) => (min < 1 ? t('sig.now') : min < 60 ? t('sig.minAgo', { m: Math.round(min) }) : t('sig.hAgo', { h: Math.round(min / 60) }));

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><RadioTower className="w-4 h-4 text-orange-400" />{t('sig.boardTitle')}</h3>
        <span className="text-[11px] text-slate-500">
          {lost > 0 && <span className="text-red-300 font-semibold">{t('sig.lostCount', { n: lost })} · </span>}
          {weak > 0 && <span className="text-orange-300">{t('sig.weakCount', { n: weak })} · </span>}
          {t('sig.tracked', { n: rows.length })}
        </span>
      </div>
      {rows.length === 0 && <p className="text-xs text-slate-500">{t('sig.noneTracked')}</p>}
      <div className="space-y-1">
        {rows.map(({ m, link }) => {
          const st = QUALITY_STYLE[link.quality];
          return (
            <div key={m.id} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border ${link.quality === 'lost' ? st.bg : 'bg-slate-800/40 border-slate-800'}`}>
              <BarsIcon quality={link.quality} />
              <span className="text-xs text-white font-medium flex-1 min-w-0 truncate">
                {m.radioCallsign && m.radioCallsign !== '—' ? `${m.radioCallsign} · ` : ''}{m.name}
              </span>
              <span className={`text-[11px] font-semibold ${st.text}`}>{t(`sig.q.${link.quality}`)}</span>
              <span className="text-[10px] text-slate-500 tabular-nums w-16 text-right">{link.rtt != null && link.quality !== 'lost' ? `${link.rtt} ms` : ''}</span>
              <span className="text-[10px] text-slate-500 w-20 text-right hidden sm:inline">{link.effective ? link.effective.toUpperCase() : ''}{link.type ? ` ${link.type}` : ''}</span>
              <span className="text-[10px] text-slate-500 w-16 text-right">{fmtAge(link.ageMin)}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-600">{t('sig.boardNote')}</p>
    </div>
  );
};
