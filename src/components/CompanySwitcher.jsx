import { useState, useEffect } from 'react';
import { Building2, ChevronDown, Search, Loader2, Eye, Home } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { switchCompany } from '../lib/org';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/index.jsx';

// Sidebar company badge. For the platform owner and system admins it is a
// switcher: open any company and the whole app shows it as its admin sees
// it (0040). Everyone else just sees their company.
export const CompanySwitcher = ({ org }) => {
  const { t } = useI18n();
  const { profile } = useAuth();
  const isStaff = ['owner', 'staff'].includes(profile?.platform_role);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!open || list.length) return;
    supabase.from('organizations').select('id, name, region').order('name').then(({ data }) => setList(data ?? []));
  }, [open, list.length]);

  const go = async (id) => {
    setBusy(id ?? 'home'); setErr(null);
    try { await switchCompany(id); } catch (e) { setErr(e.message); setBusy(null); }
  };

  const badge = (
    <div className="flex items-center gap-2 min-w-0">
      {profile?.viewing ? <Eye className="w-3.5 h-3.5 text-purple-300 shrink-0" /> : <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
      <span className="font-medium text-white text-xs truncate">{org.name}</span>
      {org.region && <span className="text-xs text-slate-500 truncate">· {org.region}</span>}
    </div>
  );
  if (!isStaff) return <div className="px-2 py-1.5 bg-slate-800/50 rounded-lg">{badge}</div>;

  const needle = q.trim().toLowerCase();
  const shown = list.filter(o => !needle || `${o.name} ${o.region ?? ''}`.toLowerCase().includes(needle));
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} title={t('sw.title')}
        className={`w-full px-2 py-1.5 rounded-lg flex items-center justify-between gap-1 ${profile?.viewing ? 'bg-purple-600/25 border border-purple-500/50' : 'bg-slate-800/50 hover:bg-slate-800'}`}>
        {badge}<ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 mt-1 z-[70] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-1.5 space-y-1">
          <p className="px-1 text-[10px] text-slate-400">{t('sw.lead')}</p>
          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t('sw.search')}
              className="w-full pl-6 pr-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500" />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {profile?.viewing && (
              <button onClick={() => go(null)} className="w-full text-left px-2 py-1.5 rounded text-xs text-purple-200 hover:bg-slate-800 flex items-center gap-1.5">
                {busy === 'home' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Home className="w-3 h-3" />}{t('sw.back')}
              </button>
            )}
            {list.length === 0 && <p className="px-2 py-1 text-[11px] text-slate-500"><Loader2 className="w-3 h-3 animate-spin inline" /></p>}
            {shown.map(o => {
              const here = o.id === profile?.org_id;
              const home = o.id === profile?.home_org_id;
              return (
                <button key={o.id} disabled={here || !!busy} onClick={() => go(home ? null : o.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-1.5 ${here ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                  {busy === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : home ? <Home className="w-3 h-3 text-blue-400" /> : <Building2 className="w-3 h-3 text-slate-500" />}
                  <span className="truncate">{o.name}</span>
                  {o.region && <span className="text-[10px] text-slate-500 truncate">· {o.region}</span>}
                  {here && <span className="ml-auto text-[9px] text-slate-400">{t('sw.here')}</span>}
                </button>
              );
            })}
          </div>
          {err && <p className="px-1 text-[11px] text-red-400">{err}</p>}
          <p className="px-1 text-[9px] text-slate-500">{t('sw.note')}</p>
        </div>
      )}
    </div>
  );
};

// Shown on every screen while platform staff view another company.
export const ViewingBanner = ({ org }) => {
  const { t } = useI18n();
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!profile?.viewing) return null;
  return (
    <div className="bg-purple-700 text-white text-xs font-semibold px-4 py-2 flex items-center gap-2 flex-shrink-0" role="status">
      <Eye className="w-4 h-4 shrink-0" />
      <span className="flex-1 min-w-0 truncate">{t('sw.banner', { name: org?.name ?? '…' })}</span>
      <button disabled={busy} onClick={async () => { setBusy(true); try { await switchCompany(null); } catch { setBusy(false); } }}
        className="px-2.5 py-1 rounded bg-white text-purple-800 font-bold flex items-center gap-1 shrink-0">
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Home className="w-3 h-3" />}{t('sw.backShort')}
      </button>
    </div>
  );
};
