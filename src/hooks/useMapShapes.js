import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getOrgId } from '../lib/org';
import { logEvent } from '../lib/eventLog';

// Built-in shape categories. Ids are stored on map_shapes rows — never
// rename one. Severity drives geofence alerts (supabase/functions/
// geofence-watch mirrors this list). Text: t(`map.cat.${id}`).
export const SHAPE_CATEGORIES = [
  { id: 'exclusion', kind: 'zone', color: '#ef4444', alert: 'enter', severity: 'critical' },
  { id: 'hazard_area', kind: 'zone', color: '#f97316', alert: 'enter', severity: 'warning' },
  { id: 'evacuation', kind: 'zone', color: '#eab308', alert: 'none', severity: 'warning' },
  { id: 'staging_area', kind: 'zone', color: '#22c55e', alert: 'none', severity: 'warning' },
  { id: 'search_sector', kind: 'zone', color: '#38bdf8', alert: 'none', severity: 'warning' },
  { id: 'perimeter', kind: 'zone', color: '#a855f7', alert: 'exit', severity: 'warning' },
  { id: 'evac_route', kind: 'route', color: '#22c55e', alert: 'none', severity: 'warning' },
  { id: 'access_route', kind: 'route', color: '#38bdf8', alert: 'none', severity: 'warning' },
  { id: 'flight_path', kind: 'route', color: '#a855f7', alert: 'none', severity: 'warning' },
  { id: 'fire_line', kind: 'route', color: '#ef4444', alert: 'none', severity: 'warning' },
];

export const SHAPE_KINDS = ['zone', 'circle', 'route'];
export const ALERT_MODES = ['none', 'enter', 'exit', 'both'];

// Zones and circles share the area categories; routes have their own.
export function categoryFitsKind(cat, kind) {
  return kind === 'route' ? cat.kind === 'route' : cat.kind === 'zone';
}

// Category record for an id, from the built-ins or the company's custom list.
export function shapeCategoryMeta(id, custom = []) {
  return SHAPE_CATEGORIES.find(c => c.id === id)
    ?? (custom ?? []).find(c => c.id === id)
    ?? null;
}

// Display name of a category: translated for built-ins, the company's own words for custom ones.
export function shapeCategoryLabel(t, id, custom = []) {
  const meta = shapeCategoryMeta(id, custom);
  if (!meta) return id || '';
  return meta.custom ? meta.label : t(`map.cat.${meta.id}`);
}

const POLL_MS = 60 * 1000; // safety net — realtime does the heavy lifting

// Shapes drawn on the tactical map (zones, circles, routes), shared live
// with the company. Rights mirror markers: field+ draw, creator or
// operator+ edit/remove (enforced by RLS in migration 0034).
export const useMapShapes = () => {
  const isLive = isSupabaseConfigured;
  const [shapes, setShapes] = useState([]);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!isLive) return;
    const org = await getOrgId();
    if (!org) return;
    const { data, error: err } = await supabase
      .from('map_shapes')
      .select('*')
      .eq('org_id', org)
      .order('created_at', { ascending: true })
      .limit(500);
    if (err) { setError(err.message); return; }
    setError(null);
    setShapes(data ?? []);
  }, [isLive]);

  useEffect(() => {
    if (!isLive) return;
    refresh();
    const t = setInterval(refresh, POLL_MS);
    const channel = supabase
      .channel(`map-shapes-live-${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_shapes' }, refresh)
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, [isLive, refresh]);

  const createShapes = useCallback(async (list) => {
    if (!list?.length) return [];
    const { data: { user } } = await supabase.auth.getUser();
    const org = await getOrgId();
    const rows = list.map(s => ({
      org_id: org, kind: s.kind, category: s.category ?? '', label: (s.label ?? '').slice(0, 200),
      notes: s.notes ? String(s.notes).slice(0, 4000) : null, color: s.color ?? '#38bdf8',
      alert: s.kind === 'route' ? 'none' : (s.alert ?? 'none'), active: s.active !== false,
      geometry: s.geometry, created_by: user.id, updated_by: user.id,
    }));
    const { data, error: err } = await supabase.from('map_shapes').insert(rows).select();
    if (err) throw err;
    if (rows.length === 1) await logEvent('shape.created', { kind: rows[0].kind, category: rows[0].category, label: rows[0].label }, data?.[0]?.id ?? null);
    else await logEvent('shape.imported', { count: rows.length });
    await refresh();
    return data ?? [];
  }, [refresh]);

  const createShape = useCallback(async (shape) => (await createShapes([shape]))[0], [createShapes]);

  const updateShape = useCallback(async (id, patch, { quiet = false } = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase
      .from('map_shapes')
      .update({ ...patch, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (err) throw err;
    // geometry drags save often — log them once, not per vertex
    if (!quiet) await logEvent('shape.updated', { ...patch, geometry: patch.geometry ? '(reshaped)' : undefined }, id);
    await refresh();
  }, [refresh]);

  const removeShape = useCallback(async (id) => {
    const s = shapes.find(x => x.id === id);
    const { error: err } = await supabase.from('map_shapes').delete().eq('id', id);
    if (err) throw err;
    await logEvent('shape.removed', { kind: s?.kind, category: s?.category, label: s?.label }, id);
    await refresh();
  }, [shapes, refresh]);

  return { isLive, shapes, error, refresh, createShape, createShapes, updateShape, removeShape };
};
