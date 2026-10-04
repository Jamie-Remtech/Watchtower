import { useState } from 'react';
import { Plus, X, Loader2, Trash2, MapPin, Cpu, Settings, Crosshair } from 'lucide-react';
import { DEVICE_KINDS, DEVICE_STATUSES } from '../hooks/useDevices';
import { useOrg } from '../hooks/useOrg';
import { useI18n } from '../i18n/index.jsx';

// Browser geolocation as a promise. Works on phones and laptops alike;
// requires the user to grant the permission prompt. `t` words the errors.
const getPosition = (t) =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error(t('dev.geoUnsupported')));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new Error(
        err.code === 1 ? t('dev.geoDenied') :
        err.code === 2 ? t('dev.geoUnavailable') : t('dev.geoTimeout')
      )),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });

const STATUS_STYLES = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  offline: 'bg-slate-500/20 text-slate-400 border-slate-600',
  maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  alert: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// Live-mode device management: register real devices, set status and
// position. Everything here reads/writes the devices table directly.
export const DeviceManager = ({ devices, createDevice, updateDevice, removeDevice }) => {
  const { t } = useI18n();
  const org = useOrg();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [locatingId, setLocatingId] = useState(null);
  const channelsUsed = devices.reduce((acc, d) => acc + (d.channel_cost ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-orange-400" />
            {t('dev.title')}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {org.name} · {t(devices.length === 1 ? 'dev.device1' : 'dev.deviceN', { n: devices.length })} · {t(channelsUsed === 1 ? 'dev.channel1' : 'dev.channelN', { n: channelsUsed })}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-sm font-medium text-white flex items-center gap-2 self-start"
        >
          <Plus className="w-4 h-4" />{t('dev.register')}
        </button>
      </div>

      {/* Device list */}
      {devices.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-10 text-center">
          <Cpu className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 text-sm font-medium">{t('dev.noneTitle')}</p>
          <p className="text-slate-500 text-xs mt-1">
            {t('dev.noneNote')}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl divide-y divide-slate-800">
          {devices.map(d => {
            const kind = DEVICE_KINDS.find(k => k.id === d.kind);
            return (
              <div key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0">{kind?.icon ?? '📍'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{d.name}</p>
                    <p className="text-xs text-slate-500">
                      {kind ? t(`dev.kind.${kind.id}`) : d.kind} · {t('dev.ch', { n: d.channel_cost })}
                      {d.lat != null && d.lng != null && (
                        <span className="inline-flex items-center gap-0.5 ml-2">
                          <MapPin className="w-3 h-3 inline" />{Number(d.lat).toFixed(4)}, {Number(d.lng).toFixed(4)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={async () => {
                      setLocatingId(d.id);
                      try {
                        const pos = await getPosition(t);
                        await updateDevice(d.id, { lat: pos.lat, lng: pos.lng });
                      } catch { /* denied or unavailable — leave coords as-is */ }
                      setLocatingId(null);
                    }}
                    disabled={locatingId === d.id}
                    className="p-2 text-slate-500 hover:text-orange-400 rounded-lg disabled:opacity-50"
                    title={t('dev.setHereTitle')}
                  >
                    {locatingId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                  </button>
                  <select
                    value={d.status}
                    onChange={e => updateDevice(d.id, { status: e.target.value }).catch(() => {})}
                    className={`text-xs px-2 py-1.5 rounded-lg border bg-slate-900 focus:outline-none ${STATUS_STYLES[d.status] ?? STATUS_STYLES.offline}`}
                  >
                    {DEVICE_STATUSES.map(s => <option key={s} value={s}>{t(`dev.status.${s}`)}</option>)}
                  </select>
                  {confirmRemove === d.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { removeDevice(d.id).catch(() => {}); setConfirmRemove(null); }}
                        className="px-2 py-1.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded-lg text-xs font-medium"
                      >
                        {t('dev.confirm')}
                      </button>
                      <button onClick={() => setConfirmRemove(null)} className="px-2 py-1.5 text-slate-400 text-xs">{t('cib.cancel')}</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemove(d.id)}
                      className="p-2 text-slate-500 hover:text-red-400 rounded-lg"
                      title={t('dev.removeTitle')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-600 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
        {t('dev.footer')}
      </p>

      {showAdd && <AddDeviceModal onClose={() => setShowAdd(false)} onCreate={createDevice} />}
    </div>
  );
};

const AddDeviceModal = ({ onClose, onCreate }) => {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [kind, setKind] = useState('camera');
  const [status, setStatus] = useState('offline');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(null);
  const [locAccuracy, setLocAccuracy] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        kind,
        status,
        lat: lat === '' ? null : Number(lat),
        lng: lng === '' ? null : Number(lng),
      });
      onClose();
    } catch (err) {
      setError(err.message ?? t('dev.registerFailed'));
      setBusy(false);
    }
  };

  const input = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-orange-400" />{t('dev.registerTitle')}
          </h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-800 rounded"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1.5">{t('dev.name')}</label>
          <input className={input} placeholder={t('dev.namePh')} value={name} onChange={e => setName(e.target.value)} required />
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1.5">{t('dev.type')}</label>
          <div className="grid grid-cols-1 gap-1">
            {DEVICE_KINDS.map(k => (
              <button
                type="button"
                key={k.id}
                onClick={() => setKind(k.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left text-xs ${
                  kind === k.id ? 'bg-orange-500/15 border-orange-500/40 text-orange-300' : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-base">{k.icon}</span>
                <span className="flex-1">
                  <span className="font-medium">{t(`dev.kind.${k.id}`)}</span>
                  <span className="block text-[10px] text-slate-500">{t(`dev.kind.${k.id}.d`)}</span>
                </span>
                <span className="text-[10px] text-slate-500">{t('dev.ch', { n: k.cost })}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-slate-400">{t('dev.position')}</label>
            <button
              type="button"
              onClick={async () => {
                setLocating(true);
                setLocError(null);
                try {
                  const pos = await getPosition(t);
                  setLat(pos.lat.toFixed(6));
                  setLng(pos.lng.toFixed(6));
                  setLocAccuracy(Math.round(pos.accuracy));
                } catch (err) {
                  setLocError(err.message);
                }
                setLocating(false);
              }}
              disabled={locating}
              className="flex items-center gap-1.5 px-2 py-1 bg-orange-500/15 border border-orange-500/30 text-orange-300 rounded-lg text-[10px] font-medium hover:bg-orange-500/25 disabled:opacity-50"
            >
              {locating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crosshair className="w-3 h-3" />}
              {t('dev.useMyLocation')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className={input} type="number" step="any" placeholder={t('dev.latPh')} value={lat} onChange={e => setLat(e.target.value)} />
            <input className={input} type="number" step="any" placeholder={t('dev.lngPh')} value={lng} onChange={e => setLng(e.target.value)} />
          </div>
          {locAccuracy != null && !locError && (
            <p className="text-[10px] text-green-400 mt-1">{t('dev.located', { m: locAccuracy })}</p>
          )}
          {locError && <p className="text-[10px] text-red-400 mt-1">{locError}</p>}
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1.5">{t('dev.initialStatus')}</label>
          <div className="flex gap-1">
            {DEVICE_STATUSES.map(s => (
              <button
                type="button"
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-1.5 rounded-lg border text-xs capitalize ${
                  status === s ? 'bg-orange-500/15 border-orange-500/40 text-orange-300' : 'bg-slate-800/50 border-slate-700 text-slate-400'
                }`}
              >
                {t(`dev.status.${s}`)}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="w-full py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{t('dev.registerSubmit')}
        </button>
      </form>
    </div>
  );
};
