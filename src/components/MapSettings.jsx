import { useState } from 'react';
import { Map as MapIcon, Plus, Trash2, Check, Loader2, Eye, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { hasAtLeast } from '../auth/roles';
import { useI18n } from '../i18n/index.jsx';
import { MARKER_KINDS } from '../hooks/useMarkers';
import { SHAPE_CATEGORIES, ALERT_MODES } from '../hooks/useMapShapes';
import { useMapConfig, MAP_MODES, newConfigId } from '../hooks/useMapConfig';
import { overlayTileUrl, lngLatToTile } from '../lib/geo';
import { getLastCoords } from '../lib/tracker';

// Company map setup: which marker kinds and shape categories the team is
// offered, the company's own ones, map overlays (XYZ tiles or WMS) and the
// default map type. Coordinators and admins change it; others read it.

const input = 'w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sky-500 disabled:opacity-60';
const EMPTY_KIND = { icon: '', label: '' };
const EMPTY_CAT = { label: '', kind: 'zone', color: '#38bdf8', alert: 'none', severity: 'warning' };
const EMPTY_OVERLAY = { name: '', type: 'xyz', url: '', layers: '', opacity: 0.7, attribution: '', on_by_default: false };

function toggleIn(list, id) {
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id];
}

// Where to sample a test tile: the device's last fix, else a default spot.
function previewTile() {
  let c = null;
  try { c = getLastCoords(24 * 3600e3); } catch { c = null; }
  const lat = Number.isFinite(c?.lat) ? c.lat : 45.5;
  const lng = Number.isFinite(c?.lng) ? c.lng : -73.57;
  return lngLatToTile(lat, lng, 10);
}

function overlayProblem(o, t) {
  const url = String(o.url ?? '').trim();
  if (!o.name.trim()) return t('map.cfg.ov.needName');
  if (!/^https:\/\//i.test(url)) return t('map.cfg.ov.needHttps');
  if (o.type === 'xyz' && !(/\{z\}/.test(url) && /\{x\}/.test(url) && /\{-?y\}/.test(url))) return t('map.cfg.ov.needXyz');
  if (o.type === 'wms' && !String(o.layers ?? '').trim()) return t('map.cfg.ov.needLayers');
  return null;
}

const TilePreview = ({ overlay }) => {
  const { t } = useI18n();
  const [state, setState] = useState('loading');
  const tile = previewTile();
  const src = overlayTileUrl(overlay, tile.x, tile.y, tile.z);
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-24 rounded-lg border border-slate-700 overflow-hidden flex-shrink-0"
        style={{ backgroundImage: 'linear-gradient(45deg,#1e293b 25%,transparent 25%,transparent 75%,#1e293b 75%),linear-gradient(45deg,#1e293b 25%,transparent 25%,transparent 75%,#1e293b 75%)', backgroundSize: '12px 12px', backgroundPosition: '0 0,6px 6px' }}>
        {src && <img src={src} alt="" className="w-full h-full" onLoad={() => setState('ok')} onError={() => setState('error')} />}
      </div>
      <p className={`text-[10px] ${state === 'error' ? 'text-red-400' : state === 'ok' ? 'text-green-400' : 'text-slate-400'}`}>
        {state === 'error' ? t('map.cfg.ov.testFail') : state === 'ok' ? t('map.cfg.ov.testOk') : t('map.cfg.ov.testLoading')}
      </p>
    </div>
  );
};

export const MapSettings = () => {
  const { t } = useI18n();
  const { profile } = useAuth() ?? {};
  const canEdit = hasAtLeast(profile?.role, 'coordinator');
  const { config, save, loaded, error: loadError } = useMapConfig();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);
  const [kindForm, setKindForm] = useState(null);   // EMPTY_KIND while adding
  const [catForm, setCatForm] = useState(null);     // EMPTY_CAT while adding
  const [ovForm, setOvForm] = useState(null);       // EMPTY_OVERLAY while adding
  const [testing, setTesting] = useState(null);     // overlay id being previewed ('new' for the form)
  const [confirmDel, setConfirmDel] = useState(null);

  const apply = async (mutate) => {
    if (!canEdit) return false;
    setBusy(true); setErr(null); setSaved(false);
    try {
      await save(mutate(config));
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      setBusy(false);
      return true;
    } catch (e) {
      setErr(/does not exist|schema cache/i.test(e.message ?? '') ? t('map.tableMissing') : (e.message ?? t('map.saveFailed')));
      setBusy(false);
      return false;
    }
  };

  const addKind = async () => {
    const label = kindForm.label.trim();
    if (!label) return;
    const icon = kindForm.icon.trim() || '📍';
    if (await apply(c => ({ ...c, custom_marker_kinds: [...c.custom_marker_kinds, { id: newConfigId('mk'), icon, label }] }))) setKindForm(null);
  };
  const addCat = async () => {
    const label = catForm.label.trim();
    if (!label) return;
    const cat = { id: newConfigId('sc'), label, kind: catForm.kind, color: catForm.color, alert: catForm.kind === 'route' ? 'none' : catForm.alert, severity: catForm.severity };
    if (await apply(c => ({ ...c, custom_shape_categories: [...c.custom_shape_categories, cat] }))) setCatForm(null);
  };
  const addOverlay = async () => {
    if (overlayProblem(ovForm, t)) return;
    const o = { ...ovForm, id: newConfigId('ov'), name: ovForm.name.trim(), url: ovForm.url.trim(), layers: ovForm.type === 'wms' ? ovForm.layers.trim() : '', attribution: ovForm.attribution.trim() };
    if (await apply(c => ({ ...c, overlays: [...c.overlays, o] }))) { setOvForm(null); setTesting(null); }
  };
  const delButton = (key, onDelete) => (confirmDel === key
    ? <button onClick={() => { setConfirmDel(null); onDelete(); }} className="text-[10px] font-bold text-red-400">{t('map.cfg.sure')}</button>
    : <button onClick={() => setConfirmDel(key)} className="p-1 text-slate-500 hover:text-red-400" title={t('map.cfg.remove')}><Trash2 className="w-3.5 h-3.5" /></button>);

  const section = 'space-y-2 pt-3 border-t border-slate-800';
  const heading = 'text-xs font-semibold text-slate-200';
  const chip = (on) => `flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] ${on ? 'bg-sky-500/10 border-sky-500/40 text-sky-100' : 'bg-slate-800/40 border-slate-700 text-slate-500 line-through'} ${canEdit ? 'hover:border-sky-400' : 'cursor-default'}`;
  const ovProblem = ovForm ? overlayProblem(ovForm, t) : null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><MapIcon className="w-4 h-4 text-orange-400" />{t('map.cfg.title')}</h3>
        <span className="text-[10px] text-slate-500 flex items-center gap-1">
          {busy && <Loader2 className="w-3 h-3 animate-spin" />}
          {saved && <><Check className="w-3 h-3 text-green-400" />{t('map.cfg.saved')}</>}
        </span>
      </div>
      <p className="text-[11px] text-slate-500">{t('map.cfg.lead')}</p>
      {!canEdit && <p className="text-[11px] text-amber-300/80">{t('map.cfg.readOnly')}</p>}
      {(err || loadError) && <p className="text-[11px] text-red-400">{err || (/does not exist|schema cache/i.test(loadError) ? t('map.tableMissing') : loadError)}</p>}
      {!loaded && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}

      {/* default map type */}
      <div className={section}>
        <p className={heading}>{t('map.cfg.defaultMode')}</p>
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 w-fit">
          {MAP_MODES.map(m => (
            <button key={m} disabled={!canEdit || busy} onClick={() => apply(c => ({ ...c, default_mode: m }))}
              className={`px-2 py-1 rounded text-xs ${config.default_mode === m ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'} disabled:cursor-default`}>
              {t(`tac.mode.${m}`)}
            </button>
          ))}
        </div>
      </div>

      {/* marker kinds */}
      <div className={section}>
        <div className="flex items-center justify-between">
          <p className={heading}>{t('map.cfg.markers')}</p>
          {canEdit && !kindForm && <button onClick={() => setKindForm(EMPTY_KIND)} className="text-[11px] text-sky-300 hover:text-sky-200 flex items-center gap-1"><Plus className="w-3 h-3" />{t('map.cfg.addKind')}</button>}
        </div>
        <p className="text-[10px] text-slate-500">{t('map.cfg.markersHelp')}</p>
        <div className="flex flex-wrap gap-1.5">
          {MARKER_KINDS.map(k => {
            const on = !config.marker_kinds_hidden.includes(k.id);
            return (
              <button key={k.id} disabled={!canEdit || busy} onClick={() => apply(c => ({ ...c, marker_kinds_hidden: toggleIn(c.marker_kinds_hidden, k.id) }))} className={chip(on)}>
                <span>{k.icon}</span>{t(`marker.${k.id}`)}
              </button>
            );
          })}
        </div>
        {config.custom_marker_kinds.length > 0 && (
          <div className="space-y-1">
            {config.custom_marker_kinds.map(k => (
              <div key={k.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/40">
                <span className="text-base leading-none">{k.icon}</span>
                <span className="text-xs text-white flex-1 min-w-0 truncate">{k.label}</span>
                <span className="text-[10px] text-slate-500">{t('map.cfg.custom')}</span>
                {canEdit && delButton(`k:${k.id}`, () => apply(c => ({ ...c, custom_marker_kinds: c.custom_marker_kinds.filter(x => x.id !== k.id) })))}
              </div>
            ))}
          </div>
        )}
        {kindForm && (
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 space-y-2">
            <div className="flex gap-2">
              <input className={`${input} w-16 text-center text-base`} placeholder="🛟" value={kindForm.icon} maxLength={8}
                onChange={e => setKindForm(f => ({ ...f, icon: e.target.value }))} aria-label={t('map.cfg.emoji')} />
              <input className={input} placeholder={t('map.cfg.kindLabelPh')} value={kindForm.label} maxLength={60}
                onChange={e => setKindForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <button onClick={addKind} disabled={busy || !kindForm.label.trim()} className="px-3 py-1.5 bg-sky-600 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"><Plus className="w-3.5 h-3.5" />{t('map.cfg.add')}</button>
              <button onClick={() => setKindForm(null)} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300">{t('map.cfg.cancel')}</button>
            </div>
          </div>
        )}
      </div>

      {/* shape categories */}
      <div className={section}>
        <div className="flex items-center justify-between">
          <p className={heading}>{t('map.cfg.shapes')}</p>
          {canEdit && !catForm && <button onClick={() => setCatForm(EMPTY_CAT)} className="text-[11px] text-sky-300 hover:text-sky-200 flex items-center gap-1"><Plus className="w-3 h-3" />{t('map.cfg.addCategory')}</button>}
        </div>
        <p className="text-[10px] text-slate-500">{t('map.cfg.shapesHelp')}</p>
        <div className="flex flex-wrap gap-1.5">
          {SHAPE_CATEGORIES.map(c => {
            const on = !config.shape_categories_hidden.includes(c.id);
            return (
              <button key={c.id} disabled={!canEdit || busy} onClick={() => apply(cf => ({ ...cf, shape_categories_hidden: toggleIn(cf.shape_categories_hidden, c.id) }))} className={chip(on)}>
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c.color }} />
                {t(`map.cat.${c.id}`)}
                {c.alert !== 'none' && <span title={t(`map.alert.${c.alert}`)}>🔔</span>}
              </button>
            );
          })}
        </div>
        {config.custom_shape_categories.length > 0 && (
          <div className="space-y-1">
            {config.custom_shape_categories.map(c => (
              <div key={c.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/40">
                <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ background: c.color }} />
                <span className="text-xs text-white flex-1 min-w-0 truncate">{c.label}</span>
                <span className="text-[10px] text-slate-400">{t(`map.kind.${c.kind}`)}</span>
                {c.kind !== 'route' && c.alert !== 'none' && (
                  <span className={`text-[10px] ${c.severity === 'critical' ? 'text-red-400' : 'text-amber-300'}`}>{t(`map.alert.${c.alert}`)} · {t(`map.sev.${c.severity}`)}</span>
                )}
                {canEdit && delButton(`c:${c.id}`, () => apply(cf => ({ ...cf, custom_shape_categories: cf.custom_shape_categories.filter(x => x.id !== c.id) })))}
              </div>
            ))}
          </div>
        )}
        {catForm && (
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 space-y-2">
            <input className={input} placeholder={t('map.cfg.catLabelPh')} value={catForm.label} maxLength={60}
              onChange={e => setCatForm(f => ({ ...f, label: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] text-slate-400">{t('map.cfg.kind')}
                <select className={input} value={catForm.kind} onChange={e => setCatForm(f => ({ ...f, kind: e.target.value }))}>
                  <option value="zone">{t('map.cfg.kindArea')}</option>
                  <option value="route">{t('map.kind.route')}</option>
                </select>
              </label>
              <label className="text-[10px] text-slate-400">{t('map.cfg.color')}
                <input type="color" className="block w-full h-[30px] bg-slate-800 border border-slate-700 rounded-lg" value={catForm.color}
                  onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))} />
              </label>
              {catForm.kind !== 'route' && (
                <>
                  <label className="text-[10px] text-slate-400">{t('map.ed.alert')}
                    <select className={input} value={catForm.alert} onChange={e => setCatForm(f => ({ ...f, alert: e.target.value }))}>
                      {ALERT_MODES.map(a => <option key={a} value={a}>{t(`map.alert.${a}`)}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] text-slate-400">{t('map.cfg.severity')}
                    <select className={input} value={catForm.severity} onChange={e => setCatForm(f => ({ ...f, severity: e.target.value }))}>
                      <option value="warning">{t('map.sev.warning')}</option>
                      <option value="critical">{t('map.sev.critical')}</option>
                    </select>
                  </label>
                </>
              )}
            </div>
            {catForm.kind !== 'route' && <p className="text-[10px] text-slate-500">{t('map.cfg.severityHelp')}</p>}
            <div className="flex gap-2">
              <button onClick={addCat} disabled={busy || !catForm.label.trim()} className="px-3 py-1.5 bg-sky-600 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"><Plus className="w-3.5 h-3.5" />{t('map.cfg.add')}</button>
              <button onClick={() => setCatForm(null)} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300">{t('map.cfg.cancel')}</button>
            </div>
          </div>
        )}
      </div>

      {/* overlays */}
      <div className={section}>
        <div className="flex items-center justify-between">
          <p className={heading}>{t('map.overlays')}</p>
          {canEdit && !ovForm && <button onClick={() => { setOvForm(EMPTY_OVERLAY); setTesting(null); }} className="text-[11px] text-sky-300 hover:text-sky-200 flex items-center gap-1"><Plus className="w-3 h-3" />{t('map.cfg.addOverlay')}</button>}
        </div>
        <p className="text-[10px] text-slate-500">{t('map.cfg.overlaysHelp')}</p>
        {config.overlays.length === 0 && !ovForm && <p className="text-[11px] text-slate-500">{t('map.cfg.noOverlays')}</p>}
        <div className="space-y-1">
          {config.overlays.map(o => (
            <div key={o.id} className="px-2.5 py-1.5 rounded-lg bg-slate-800/40 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white flex-1 min-w-0 truncate" title={o.url}>{o.name}</span>
                <span className="text-[10px] text-slate-400 uppercase">{o.type}</span>
                <span className="text-[10px] text-slate-500">{Math.round(o.opacity * 100)}%</span>
                <label className="flex items-center gap-1 text-[10px] text-slate-400" title={t('map.cfg.ov.onByDefault')}>
                  <input type="checkbox" checked={o.on_by_default} disabled={!canEdit || busy} className="accent-sky-500"
                    onChange={() => apply(c => ({ ...c, overlays: c.overlays.map(x => (x.id === o.id ? { ...x, on_by_default: !x.on_by_default } : x)) }))} />
                  {t('map.cfg.ov.default')}
                </label>
                <button onClick={() => setTesting(v => (v === o.id ? null : o.id))} className="p-1 text-slate-400 hover:text-sky-300" title={t('map.cfg.ov.test')}><Eye className="w-3.5 h-3.5" /></button>
                {canEdit && delButton(`o:${o.id}`, () => apply(c => ({ ...c, overlays: c.overlays.filter(x => x.id !== o.id) })))}
              </div>
              {testing === o.id && <TilePreview key={o.url + o.layers} overlay={o} />}
            </div>
          ))}
        </div>
        {ovForm && (
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-white">{t('map.cfg.addOverlay')}</p>
              <button onClick={() => { setOvForm(null); setTesting(null); }} className="p-1 text-slate-400"><X className="w-3.5 h-3.5" /></button>
            </div>
            <input className={input} placeholder={t('map.cfg.ov.namePh')} value={ovForm.name} maxLength={80}
              onChange={e => setOvForm(f => ({ ...f, name: e.target.value }))} />
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 w-fit">
              {['xyz', 'wms'].map(ty => (
                <button key={ty} onClick={() => setOvForm(f => ({ ...f, type: ty }))}
                  className={`px-2.5 py-1 rounded text-xs ${ovForm.type === ty ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}>{t(`map.cfg.ov.type.${ty}`)}</button>
              ))}
            </div>
            <input className={`${input} font-mono`} value={ovForm.url} maxLength={1000}
              placeholder={ovForm.type === 'xyz' ? 'https://tiles.example.org/{z}/{x}/{y}.png' : 'https://maps.example.org/geoserver/wms'}
              onChange={e => setOvForm(f => ({ ...f, url: e.target.value }))} />
            <p className="text-[10px] text-slate-500">{t(ovForm.type === 'xyz' ? 'map.cfg.ov.xyzHelp' : 'map.cfg.ov.wmsHelp')}</p>
            {ovForm.type === 'wms' && (
              <input className={`${input} font-mono`} placeholder={t('map.cfg.ov.layersPh')} value={ovForm.layers} maxLength={300}
                onChange={e => setOvForm(f => ({ ...f, layers: e.target.value }))} />
            )}
            <label className="flex items-center gap-2 text-[10px] text-slate-400">
              {t('map.cfg.ov.opacity')}
              <input type="range" min="0.1" max="1" step="0.05" value={ovForm.opacity} className="flex-1 accent-sky-500"
                onChange={e => setOvForm(f => ({ ...f, opacity: Number(e.target.value) }))} />
              <span className="w-8 text-right">{Math.round(ovForm.opacity * 100)}%</span>
            </label>
            <input className={input} placeholder={t('map.cfg.ov.attributionPh')} value={ovForm.attribution} maxLength={200}
              onChange={e => setOvForm(f => ({ ...f, attribution: e.target.value }))} />
            <label className="flex items-center gap-2 text-[11px] text-slate-300">
              <input type="checkbox" checked={ovForm.on_by_default} className="accent-sky-500"
                onChange={e => setOvForm(f => ({ ...f, on_by_default: e.target.checked }))} />
              {t('map.cfg.ov.onByDefault')}
            </label>
            {ovProblem && ovForm.url && <p className="text-[10px] text-amber-300">{ovProblem}</p>}
            {testing === 'new' && !ovProblem && <TilePreview key={ovForm.type + ovForm.url + ovForm.layers} overlay={ovForm} />}
            <div className="flex gap-2">
              <button onClick={addOverlay} disabled={busy || Boolean(ovProblem)} className="px-3 py-1.5 bg-sky-600 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"><Plus className="w-3.5 h-3.5" />{t('map.cfg.add')}</button>
              <button onClick={() => setTesting('new')} disabled={Boolean(ovProblem)} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 flex items-center gap-1.5 disabled:opacity-50"><Eye className="w-3.5 h-3.5" />{t('map.cfg.ov.test')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapSettings;
