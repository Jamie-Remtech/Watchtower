import { useCallback, useEffect, useState } from 'react';
import { RadioReceiver, Plus, Trash2, Copy, Check, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { getOrgId } from '../lib/org';
import { hasAtLeast } from '../auth/roles';
import { useI18n } from '../i18n/index.jsx';

// Air links: receivers and drone feeds that put aircraft and drones in the
// company's airspace picture. The key is shown once; only its SHA-256 is kept.
const SITE = typeof window !== 'undefined' ? window.location.origin : 'https://watchtowerx.netlify.app';

const randomKey = () => {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return 'wt_' + btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');

const installFor = (kind, key) => {
  if (kind === 'adsb') return [
    `curl -fsSL ${SITE}/tools/adsb-feeder.sh -o ~/watchtower-feeder.sh`,
    `WATCHTOWER_KEY=${key} sh ~/watchtower-feeder.sh`,
    `(crontab -l 2>/dev/null; echo "@reboot WATCHTOWER_KEY=${key} sh $HOME/watchtower-feeder.sh >/tmp/watchtower-feeder.log 2>&1") | crontab -`,
  ];
  if (kind === 'remoteid') return [
    `pip3 install requests pyserial`,
    `curl -fsSL ${SITE}/tools/remoteid-feeder.py -o ~/watchtower-remoteid.py`,
    `WATCHTOWER_KEY=${key} python3 ~/watchtower-remoteid.py /dev/ttyUSB0`,
  ];
  return [
    `pip3 install pymavlink requests`,
    `curl -fsSL ${SITE}/tools/mavlink-bridge.py -o ~/watchtower-mavlink.py`,
    `WATCHTOWER_KEY=${key} python3 ~/watchtower-mavlink.py udpin:0.0.0.0:14550`,
  ];
};

export const AirLinks = () => {
  const { t } = useI18n();
  const { profile, session } = useAuth();
  const canManage = hasAtLeast(profile?.role, 'coordinator');
  const [links, setLinks] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', kind: 'adsb' });
  const [fresh, setFresh] = useState(null); // { name, kind, key }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [copied, setCopied] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const load = useCallback(async () => {
    const org = await getOrgId();
    const { data } = await supabase.from('air_links').select('id, name, kind, key_hint, last_seen_at, last_count, created_at').eq('org_id', org).order('created_at');
    setLinks(data ?? []);
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  const create = async () => {
    if (!form.name.trim()) return;
    setBusy(true); setErr(null);
    try {
      const key = randomKey();
      const org = await getOrgId();
      const { error } = await supabase.from('air_links').insert({
        org_id: org, name: form.name.trim().slice(0, 80), kind: form.kind,
        key_hash: await sha256(key), key_hint: key.slice(-4), created_by: session?.user?.id,
      });
      if (error) throw error;
      setFresh({ name: form.name.trim(), kind: form.kind, key });
      setAdding(false);
      setForm({ name: '', kind: 'adsb' });
      load();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const remove = async (id) => {
    const { error } = await supabase.from('air_links').delete().eq('id', id);
    if (error) setErr(error.message); else load();
    setConfirmDel(null);
  };
  const copy = (text, id) => navigator.clipboard?.writeText(text).then(() => { setCopied(id); setTimeout(() => setCopied(null), 1800); });
  const seen = (iso) => {
    if (!iso) return t('air.links.never');
    const s = (Date.now() - Date.parse(iso)) / 1000;
    return s < 120 ? t('air.links.live') : s < 3600 ? t('air.links.minAgo', { m: Math.round(s / 60) }) : new Date(iso).toLocaleString();
  };
  const input = 'w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sky-500';

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><RadioReceiver className="w-4 h-4 text-sky-400" />{t('air.links.title')}</h3>
        {canManage && !adding && (
          <button onClick={() => { setAdding(true); setErr(null); }} className="text-[11px] text-sky-300 hover:text-sky-200 flex items-center gap-1"><Plus className="w-3 h-3" />{t('air.links.add')}</button>
        )}
      </div>
      <p className="text-[11px] text-slate-500">{t('air.links.lead')}</p>

      {adding && (
        <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 space-y-2">
          <input className={input} placeholder={t('air.links.namePh')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={80} />
          <div className="grid gap-1.5">
            {['adsb', 'remoteid', 'telemetry'].map(k => (
              <label key={k} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer ${form.kind === k ? 'border-sky-500/50 bg-sky-500/10' : 'border-slate-700'}`}>
                <input type="radio" name="air-kind" checked={form.kind === k} onChange={() => setForm(f => ({ ...f, kind: k }))} className="mt-0.5 accent-sky-500" />
                <span><span className="block text-xs text-white font-medium">{t(`air.links.kind.${k}`)}</span><span className="block text-[10px] text-slate-400">{t(`air.links.kind.${k}.d`)}</span></span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={create} disabled={busy || !form.name.trim()} className="px-3 py-1.5 bg-sky-600 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}{t('air.links.create')}
            </button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300">{t('air.links.cancel')}</button>
          </div>
        </div>
      )}

      {fresh && (
        <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/40 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-white">{t('air.links.keyTitle', { name: fresh.name })}</p>
            <button onClick={() => setFresh(null)} className="p-1 text-slate-400"><X className="w-3.5 h-3.5" /></button>
          </div>
          <p className="text-[11px] text-sky-100">{t('air.links.keyOnce')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate px-2 py-1 rounded bg-slate-950 text-orange-300 text-[11px]">{fresh.key}</code>
            <button onClick={() => copy(fresh.key, 'key')} className="p-1.5 rounded bg-slate-800 text-slate-200">{copied === 'key' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}</button>
          </div>
          <p className="text-[10px] text-slate-400">{t(`air.links.install.${fresh.kind}`)}</p>
          {installFor(fresh.kind, fresh.key).map((cmd, i) => (
            <div key={i} className="flex items-start gap-2">
              <code className="flex-1 min-w-0 break-all px-2 py-1 rounded bg-slate-950 text-slate-200 text-[10px]">{cmd}</code>
              <button onClick={() => copy(cmd, `c${i}`)} className="p-1.5 rounded bg-slate-800 text-slate-200 shrink-0">{copied === `c${i}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}</button>
            </div>
          ))}
          {fresh.kind === 'telemetry' && <p className="text-[10px] text-slate-400">{t('air.links.telemetryMore')}</p>}
        </div>
      )}

      {err && <p className="text-[11px] text-red-400">{err}</p>}
      {links.length === 0 && !adding && <p className="text-[11px] text-slate-500">{t('air.links.none')}</p>}
      <div className="space-y-1">
        {links.map(l => (
          <div key={l.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-800/40">
            <span className={`w-2 h-2 rounded-full shrink-0 ${l.last_seen_at && Date.now() - Date.parse(l.last_seen_at) < 120000 ? 'bg-green-400' : 'bg-slate-600'}`} />
            <span className="text-xs text-white flex-1 min-w-0 truncate">{l.name}</span>
            <span className="text-[10px] text-slate-400">{t(`air.links.kind.${l.kind}`)}</span>
            <span className="text-[10px] text-slate-500 w-24 text-right">{seen(l.last_seen_at)}{l.last_count != null && l.last_seen_at ? ` · ${l.last_count}` : ''}</span>
            <span className="text-[10px] text-slate-600 font-mono">…{l.key_hint}</span>
            {canManage && (confirmDel === l.id
              ? <button onClick={() => remove(l.id)} className="text-[10px] font-bold text-red-400">{t('air.links.sure')}</button>
              : <button onClick={() => setConfirmDel(l.id)} className="p-1 text-slate-500 hover:text-red-400" title={t('air.links.delete')}><Trash2 className="w-3.5 h-3.5" /></button>)}
          </div>
        ))}
      </div>
    </div>
  );
};
