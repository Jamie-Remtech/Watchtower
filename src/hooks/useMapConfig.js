import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getOrgId } from '../lib/org';
import { logEvent } from '../lib/eventLog';
import { MARKER_KINDS, setCustomMarkerKinds } from './useMarkers';
import { SHAPE_CATEGORIES } from './useMapShapes';

// Per-company map setup (table map_config, one row per company):
//   marker_kinds_hidden      built-in marker kind ids not offered
//   custom_marker_kinds      [{ id, icon, label }]
//   shape_categories_hidden  built-in shape category ids not offered
//   custom_shape_categories  [{ id, label, kind, color, alert, severity }]
//   overlays                 [{ id, name, type: 'xyz'|'wms', url, layers?, opacity, attribution, on_by_default }]
//   default_mode             'satellite' | 'roadmap' | 'terrain' | 'hybrid'
// Everyone in the company reads it; coordinators and admins change it.

export const MAP_MODES = ['satellite', 'roadmap', 'terrain', 'hybrid'];

const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v, max = 200) => String(v ?? '').slice(0, max);
const hex = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(String(v ?? '')) ? String(v) : d);

export function newConfigId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// Fill defaults and drop malformed entries, so screens can trust the shape.
export function normalizeMapConfig(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  return {
    marker_kinds_hidden: arr(c.marker_kinds_hidden).map(String),
    custom_marker_kinds: arr(c.custom_marker_kinds)
      .filter(k => k && k.id && k.label)
      .map(k => ({ id: str(k.id, 40), icon: str(k.icon || '📍', 16), label: str(k.label, 60), custom: true })),
    shape_categories_hidden: arr(c.shape_categories_hidden).map(String),
    custom_shape_categories: arr(c.custom_shape_categories)
      .filter(k => k && k.id && k.label)
      .map(k => ({
        id: str(k.id, 40), label: str(k.label, 60), kind: k.kind === 'route' ? 'route' : 'zone',
        color: hex(k.color, '#38bdf8'),
        alert: k.kind === 'route' ? 'none' : (['none', 'enter', 'exit', 'both'].includes(k.alert) ? k.alert : 'none'),
        severity: k.severity === 'critical' ? 'critical' : 'warning', custom: true,
      })),
    overlays: arr(c.overlays)
      .filter(o => o && o.id && o.url)
      .map(o => ({
        id: str(o.id, 40), name: str(o.name || 'Overlay', 80), type: o.type === 'wms' ? 'wms' : 'xyz',
        url: str(o.url, 1000), layers: str(o.layers, 300),
        opacity: Number.isFinite(Number(o.opacity)) ? Math.min(1, Math.max(0.05, Number(o.opacity))) : 0.7,
        attribution: str(o.attribution, 200), on_by_default: Boolean(o.on_by_default),
      })),
    default_mode: MAP_MODES.includes(c.default_mode) ? c.default_mode : 'satellite',
  };
}

// Strip derived fields before saving.
function toStored(cfg) {
  const strip = (list) => list.map(({ custom, ...rest }) => rest); // eslint-disable-line no-unused-vars
  return {
    ...cfg,
    custom_marker_kinds: strip(cfg.custom_marker_kinds ?? []),
    custom_shape_categories: strip(cfg.custom_shape_categories ?? []),
  };
}

export const useMapConfig = () => {
  const isLive = isSupabaseConfigured;
  const [raw, setRaw] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [orgId, setOrgId] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!isLive) { setLoaded(true); return; }
    const org = await getOrgId();
    setOrgId(org);
    if (!org) { setLoaded(true); return; }
    const { data, error: err } = await supabase.from('map_config').select('config, updated_at').eq('org_id', org).maybeSingle();
    if (err) setError(err.message); else setError(null);
    setRaw(data?.config ?? {});
    setLoaded(true);
  }, [isLive]);

  useEffect(() => {
    if (!isLive) { setLoaded(true); return; }
    refresh();
    const channel = supabase
      .channel(`map-config-live-${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_config' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isLive, refresh]);

  // Registering here (not in an effect) keeps markerMeta() aware of this
  // company's own kinds during the same render that receives them.
  const config = useMemo(() => {
    const c = normalizeMapConfig(raw);
    if (raw) setCustomMarkerKinds(c.custom_marker_kinds);
    return c;
  }, [raw]);

  const save = useCallback(async (next) => {
    const org = orgId ?? await getOrgId();
    const { data: { user } } = await supabase.auth.getUser();
    const stored = toStored(normalizeMapConfig(next));
    setRaw(stored); // optimistic
    const { error: err } = await supabase.from('map_config').upsert(
      { org_id: org, config: stored, updated_by: user?.id ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'org_id' },
    );
    if (err) { await refresh(); throw err; }
    await logEvent('mapconfig.updated', {});
  }, [orgId, refresh]);

  // What the palettes offer right now
  const markerKinds = useMemo(() => [
    ...MARKER_KINDS.filter(k => !config.marker_kinds_hidden.includes(k.id)),
    ...config.custom_marker_kinds,
  ], [config]);
  const shapeCategories = useMemo(() => [
    ...SHAPE_CATEGORIES.filter(c => !config.shape_categories_hidden.includes(c.id)),
    ...config.custom_shape_categories,
  ], [config]);

  return { isLive, loaded, error, config, save, refresh, markerKinds, shapeCategories };
};
