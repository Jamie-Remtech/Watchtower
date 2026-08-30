import { useState, useEffect } from 'react';
import { Building2, Loader2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { logEvent } from '../lib/eventLog';

// Organization identity — name and (optional) region, editable by admins.
// Leave region empty to avoid tying the org to any specific place.
export const OrgSettings = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [org, setOrg] = useState(null);
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [fireKm, setFireKm] = useState('');
  const [hazardKm, setHazardKm] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('organizations').select('*').limit(1).single();
      if (data) {
        setOrg(data);
        setName(data.name ?? '');
        setRegion(data.region ?? '');
        setFireKm(data.settings?.wildfire_radius_km ?? '');
        setHazardKm(data.settings?.hazard_radius_km ?? '');
      }
    })();
  }, []);

  const save = async () => {
    if (!org) return;
    setBusy(true);
    setError(null);
    const settings = {
      ...(org.settings ?? {}),
      wildfire_radius_km: +fireKm > 0 ? +fireKm : undefined,
      hazard_radius_km: +hazardKm > 0 ? +hazardKm : undefined,
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
        <h3 className="text-sm font-bold text-white">Organization</h3>
        {!isAdmin && <span className="text-[10px] text-slate-500">admin can edit</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={!isAdmin}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Region <span className="text-slate-600">(optional — empty for none)</span></label>
          <input
            value={region}
            onChange={e => setRegion(e.target.value)}
            disabled={!isAdmin}
            placeholder="no fixed location"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500 disabled:opacity-60"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">
            Wildfire watch radius (km) <span className="text-slate-600">— default 150</span>
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
            Hazard watch radius (km) <span className="text-slate-600">— quakes/storms, default 300</span>
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
        The attention engine alarms on threats inside these ranges of any device or crew member. Applies to everyone in the org on the next sweep (≤5 min).
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {isAdmin && (
        <button
          onClick={save}
          disabled={busy}
          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
          {saved ? 'Saved' : 'Save'}
        </button>
      )}
    </div>
  );
};
