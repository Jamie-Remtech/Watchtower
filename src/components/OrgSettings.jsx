import { useState, useEffect } from 'react';
import { Building2, Loader2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { logEvent } from '../lib/eventLog';
import { parSettings } from '../hooks/useCheckins';
import { ROLE_LABELS } from '../auth/roles';
import { useI18n } from '../i18n/index.jsx';

// Organization identity — name and (optional) region, editable by admins.
// Leave region empty to avoid tying the org to any specific place.
export const OrgSettings = () => {
  const { profile } = useAuth();
  const { t } = useI18n();
  const isAdmin = profile?.role === 'admin';
  const [org, setOrg] = useState(null);
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [fireKm, setFireKm] = useState('');
  const [hazardKm, setHazardKm] = useState('');
  const [autoProtocols, setAutoProtocols] = useState(false);
  const [parAmber, setParAmber] = useState('5');
  const [parRed, setParRed] = useState('10');
  const [parMinRole, setParMinRole] = useState('coordinator');
  const [parEscalate, setParEscalate] = useState(true);
  const [parAuto, setParAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      if (!profile?.org_id) return;
      const { data } = await supabase.from('organizations').select('*').eq('id', profile.org_id).single();
      if (data) {
        setOrg(data);
        setName(data.name ?? '');
        setRegion(data.region ?? '');
        setFireKm(data.settings?.wildfire_radius_km ?? '');
        setHazardKm(data.settings?.hazard_radius_km ?? '');
        setAutoProtocols(data.settings?.auto_run_protocols === true);
        const p = parSettings(data);
        setParAmber(String(p.amberMin));
        setParRed(String(p.redMin));
        setParMinRole(p.requestMinRole);
        setParEscalate(p.autoEscalate);
        setParAuto(p.autoOnCritical);
      }
    })();
  }, [profile?.org_id]);

  const save = async () => {
    if (!org) return;
    setBusy(true);
    setError(null);
    const settings = {
      ...(org.settings ?? {}),
      wildfire_radius_km: +fireKm > 0 ? +fireKm : undefined,
      hazard_radius_km: +hazardKm > 0 ? +hazardKm : undefined,
      auto_run_protocols: autoProtocols,
      par_amber_min: Math.max(1, +parAmber || 5),
      par_red_min: Math.max((+parAmber || 5) + 1, +parRed || 10),
      par_request_min_role: parMinRole,
      par_auto_escalate: parEscalate,
      par_auto_on_critical: parAuto,
    };
    const patch = { name: name.trim() || 'Watchtower', region: region.trim() || null, settings };
    const { error: err } = await supabase.from('organizations').update(patch).eq('id', org.id);
    if (err) {
      setError(err.message);
    } else {
      logEvent('org.updated', patch);
      window.dispatchEvent(new Event('watchtower-org-updated'));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setBusy(false);
  };

  if (!org) return null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-bold text-white">{t('admin.org.title')}</h3>
        {!isAdmin && <span className="text-[10px] text-slate-500">{t('admin.org.adminCanEdit')}</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">{t('admin.org.name')}</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={!isAdmin}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">{t('admin.org.region')} <span className="text-slate-600">{t('admin.org.regionOptional')}</span></label>
          <input
            value={region}
            onChange={e => setRegion(e.target.value)}
            disabled={!isAdmin}
            placeholder={t('admin.org.regionPh')}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500 disabled:opacity-60"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">
            {t('admin.org.fireRadius')} <span className="text-slate-600">{t('admin.org.fireDefault')}</span>
          </label>
          <input
            type="number" min="1"
            value={fireKm}
            onChange={e => setFireKm(e.target.value)}
            disabled={!isAdmin}
            placeholder="150"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">
            {t('admin.org.hazardRadius')} <span className="text-slate-600">{t('admin.org.hazardDefault')}</span>
          </label>
          <input
            type="number" min="1"
            value={hazardKm}
            onChange={e => setHazardKm(e.target.value)}
            disabled={!isAdmin}
            placeholder="300"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500 disabled:opacity-60"
          />
        </div>
      </div>
      <p className="text-[10px] text-slate-600">
        {t('admin.org.radiusNote')}
      </p>
      <label className={`flex items-start gap-2.5 p-3 rounded-lg border ${autoProtocols ? 'bg-purple-500/10 border-purple-500/30' : 'bg-slate-800/40 border-slate-700'} ${isAdmin ? 'cursor-pointer' : 'opacity-60'}`}>
        <input
          type="checkbox"
          checked={autoProtocols}
          disabled={!isAdmin}
          onChange={e => setAutoProtocols(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-purple-500"
        />
        <span className="min-w-0">
          <span className="block text-xs font-medium text-white">{t('admin.org.autoProtocols')}</span>
          <span className="block text-[10px] text-slate-500 mt-0.5">
            {t('admin.org.autoProtocolsNote')}
          </span>
        </span>
      </label>
      <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/40 space-y-2">
        <p className="text-xs font-medium text-white">{t('admin.org.checkin')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <label className="text-[11px] text-slate-400">
            {t('admin.org.amberAfter')}
            <input type="number" min="1" value={parAmber} onChange={e => setParAmber(e.target.value)} disabled={!isAdmin}
              className="mt-1 w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none disabled:opacity-60" />
          </label>
          <label className="text-[11px] text-slate-400">
            {t('admin.org.redAfter')}
            <input type="number" min="2" value={parRed} onChange={e => setParRed(e.target.value)} disabled={!isAdmin}
              className="mt-1 w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none disabled:opacity-60" />
          </label>
          <label className="text-[11px] text-slate-400 col-span-2 sm:col-span-1">
            {t('admin.org.whoCanRequest')}
            <select value={parMinRole} onChange={e => setParMinRole(e.target.value)} disabled={!isAdmin}
              className="mt-1 w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none disabled:opacity-60">
              {['field', 'operator', 'coordinator', 'admin'].map(r => (
                <option key={r} value={r}>{t('admin.org.roleAndUp', { role: ROLE_LABELS[r] ? t(`role.${r}`) : r })}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-start gap-2 text-[11px] text-slate-300">
          <input type="checkbox" checked={parEscalate} onChange={e => setParEscalate(e.target.checked)} disabled={!isAdmin} className="mt-0.5 accent-orange-500" />
          <span>{t('admin.org.escalate')}</span>
        </label>
        <label className="flex items-start gap-2 text-[11px] text-slate-300">
          <input type="checkbox" checked={parAuto} onChange={e => setParAuto(e.target.checked)} disabled={!isAdmin} className="mt-0.5 accent-orange-500" />
          <span>{t('admin.org.autoAsk')}</span>
        </label>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {isAdmin && (
        <button
          onClick={save}
          disabled={busy}
          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
          {saved ? t('admin.saved') : t('admin.save')}
        </button>
      )}
    </div>
  );
};
