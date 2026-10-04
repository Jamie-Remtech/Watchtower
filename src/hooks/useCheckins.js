import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logEvent } from '../lib/eventLog';
import { pushToTeam } from '../lib/push';
import { getOrgId } from '../lib/org';
import { getLastCoords } from '../lib/tracker';

// ============================================
// CHECK-IN / PAR — "everyone, are you OK?"
// The open check-ins of the org with their responses, live. Who is
// expected to answer = operational members (not viewers) of the
// targeted team (or the whole org), minus whoever asked.
// ============================================

export const PAR_DEFAULTS = { amberMin: 5, redMin: 10, requestMinRole: 'coordinator', autoEscalate: true, autoOnCritical: false };

export const parSettings = (org) => {
  const s = org?.settings ?? {};
  return {
    amberMin: +s.par_amber_min > 0 ? +s.par_amber_min : PAR_DEFAULTS.amberMin,
    redMin: +s.par_red_min > 0 ? +s.par_red_min : PAR_DEFAULTS.redMin,
    requestMinRole: s.par_request_min_role ?? PAR_DEFAULTS.requestMinRole,
    autoEscalate: s.par_auto_escalate !== false,
    autoOnCritical: s.par_auto_on_critical === true,
  };
};

// A fresh fix, bounded by our OWN timer: the browser's timeout only
// starts after location permission is granted, so without this an
// unanswered permission prompt would hang forever.
const freshFix = (ms = 8000) => new Promise((resolve) => {
  if (!navigator.geolocation) return resolve(null);
  const timer = setTimeout(() => resolve(null), ms);
  navigator.geolocation.getCurrentPosition(
    (p) => { clearTimeout(timer); resolve({ lat: p.coords.latitude, lng: p.coords.longitude }); },
    () => { clearTimeout(timer); resolve(null); },
    { enableHighAccuracy: true, timeout: ms, maximumAge: 60000 }
  );
});

export const expectedFor = (checkin, members) =>
  members.filter(m =>
    m.role !== 'viewer'
    && m.id !== checkin.requested_by
    && (!checkin.team_id || m.teamId === checkin.team_id)
  );

export const useCheckins = () => {
  const isLive = isSupabaseConfigured;
  const [checkins, setCheckins] = useState([]);
  const [responses, setResponses] = useState([]);

  const refresh = useCallback(async () => {
    if (!isLive) return;
    const orgId = await getOrgId();
    if (!orgId) return;
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: cks } = await supabase
      .from('checkins').select('*')
      .eq('org_id', orgId)
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    const ids = (cks ?? []).map(c => c.id);
    const { data: rs } = ids.length
      ? await supabase.from('checkin_responses').select('*').in('checkin_id', ids)
      : { data: [] };
    setCheckins(cks ?? []);
    setResponses(rs ?? []);
  }, [isLive]);

  useEffect(() => {
    if (!isLive) return;
    refresh();
    const channel = supabase
      .channel(`checkins-live-${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkin_responses' }, refresh)
      .subscribe();
    const t = setInterval(refresh, 60 * 1000);
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, [isLive, refresh]);

  const requestCheckin = useCallback(async ({ teamId = null, message = '', expectedIds = [] }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const orgId = await getOrgId();
    const { data, error } = await supabase.from('checkins').insert({
      org_id: orgId, team_id: teamId, requested_by: user?.id, message: message.trim() || null,
    }).select().single();
    if (error) throw error;
    logEvent('checkin.requested', { team_id: teamId, message: message.trim() || null, expected: expectedIds.length }, data.id);
    pushToTeam({
      kind: 'checkin',
      category: 'checkin',
      severity: 'critical',
      title: '✋ Check-in requested — are you OK?',
      body: message.trim() || 'Tap to answer: OK or NEED HELP.',
      url: `/?checkin=${data.id}`,
      tag: `checkin:${data.id}`,
      profile_ids: expectedIds,
    });
    await refresh();
    return data;
  }, [refresh]);

  const respond = useCallback(async (checkinId, status, note = '') => {
    const { data: { user } } = await supabase.auth.getUser();
    const orgId = await getOrgId();
    // The answer never waits for GPS: last known position now, a
    // fresh fix attached afterwards if one arrives.
    let fix = getLastCoords();
    if (!fix) {
      const { data: last } = await supabase.from('positions')
        .select('lat, lng, at').eq('profile_id', user?.id)
        .gte('at', new Date(Date.now() - 2 * 3600e3).toISOString())
        .order('at', { ascending: false }).limit(1);
      if (last?.[0]) fix = { lat: last[0].lat, lng: last[0].lng };
    }
    const { error } = await supabase.from('checkin_responses').upsert({
      checkin_id: checkinId, profile_id: user?.id, org_id: orgId, status,
      note: note.trim() || null, lat: fix?.lat ?? null, lng: fix?.lng ?? null,
      at: new Date().toISOString(),
    }, { onConflict: 'checkin_id,profile_id' });
    if (error) throw error;
    logEvent('checkin.answered', { status, note: note.trim() || null }, checkinId);
    freshFix().then(f => {
      if (f) {
        supabase.from('checkin_responses')
          .update({ lat: f.lat, lng: f.lng })
          .eq('checkin_id', checkinId).eq('profile_id', user?.id)
          .then(() => {});
      }
    });
    if (status === 'help') {
      const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', user?.id).single();
      const who = prof?.display_name ?? 'A crew member';
      await supabase.from('attention_items').insert({
        org_id: orgId,
        dedupe_key: `par-help:${checkinId}:${user?.id}`,
        severity: 'critical',
        kind: 'hazard',
        title: `${who} NEEDS HELP (check-in)`,
        detail: `${note.trim() ? `"${note.trim()}" — ` : ''}${fix ? `at ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}` : 'position unknown'}.`,
        source: fix ? { lat: fix.lat, lng: fix.lng } : null,
      });
      pushToTeam({
        kind: 'attention', category: 'hazard', severity: 'critical',
        title: `🆘 ${who} NEEDS HELP`,
        body: note.trim() || 'Answered a check-in with NEED HELP. Open Watchtower for their position.',
        url: '/', tag: `par-help:${checkinId}:${user?.id}`,
      });
    }
    await refresh();
  }, [refresh]);

  const closeCheckin = useCallback(async (id, summary) => {
    const { error } = await supabase.from('checkins')
      .update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    logEvent('checkin.closed', summary ?? {}, id);
    await refresh();
  }, [refresh]);

  return { isLive, checkins, responses, refresh, requestCheckin, respond, closeCheckin };
};

// One live subscription for the whole app, shared by the shell's
// answer prompt and the Team tab's board.
export const CheckinsContext = createContext(null);
export const useCheckinsShared = () => useContext(CheckinsContext);
