import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logEvent } from '../lib/eventLog';
import { startProtocolRun } from '../lib/protocols';

// ============================================
// PROTOCOLS — playbooks the team executes together.
// Library (protocols) + live runs (protocol_runs, realtime-synced).
// Every start / step-check / completion is logged as an event, and a
// completed run gets an AI after-action debrief: recorded patterns.
// ============================================

const orgIdOf = async () => {
  let orgId = localStorage.getItem('watchtower-org-id');
  if (!orgId) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user?.id).single();
    orgId = prof?.org_id;
    if (orgId) localStorage.setItem('watchtower-org-id', orgId);
  }
  return orgId;
};

// The starter library — real, editable playbooks seeded on demand.
export const STARTER_PROTOCOLS = [
  {
    name: 'Wildfire approaching crew',
    trigger_kind: 'wildfire',
    description: 'Run when a fire or downwind warning threatens a crew position.',
    steps: [
      'Account for every crew member on the tactical map (voice check any stale position)',
      'Identify at least two escape routes and a safety zone upwind or on burned ground',
      'Check wind speed and direction at the fire and at the crew (World tab, wind layer)',
      'Move vehicles and fuel/equipment out of the projected spread corridor',
      'Notify the coordinator with positions, routes, and the trigger conditions',
      'Set a re-check interval: reassess wind and fire position every 15 minutes',
      'If trigger conditions worsen, execute withdrawal along the primary route now',
      'Stand down: confirm all accounted for, log end state, run the debrief',
    ],
  },
  {
    name: 'Earthquake felt on site',
    trigger_kind: 'seismic',
    description: 'Run after significant shaking or a seismic attention alert nearby.',
    steps: [
      'Drop, cover, hold until shaking stops — then move clear of structures and slopes',
      'Roll-call every crew member; mark anyone unreachable on the tactical map',
      'Check USGS magnitude, depth and distance (World tab) and note tsunami flag',
      'Assess surroundings for cascade risks: landslide slopes, dams, glacier outflows, damaged structures',
      'Treat and triage any injuries in the Field Log',
      'Notify the coordinator with status and any structural or terrain concerns',
      'Expect aftershocks: keep clear of compromised structures for the re-check period',
      'Stand down: confirm all accounted for, run the debrief',
    ],
  },
  {
    name: 'Severe weather inbound',
    trigger_kind: 'weather',
    description: 'Run on a heavy-rain, storm, or rain-nowcast critical alert.',
    steps: [
      'Confirm the nowcast: minutes to onset and expected intensity at each crew position',
      'Move crews out of drainages, burn scars, and flash-flood paths',
      'Secure loose equipment and put sensitive gear under cover',
      'Identify hard shelter for each crew and confirm they can reach it before onset',
      'Notify the coordinator: positions, shelter plan, expected duration',
      'Hold until the clearing signal (rain-clearing alert or radar clean)',
      'Sweep for hazards after passage: washouts, downed lines, unstable slopes',
      'Stand down and run the debrief',
    ],
  },
];

export const useProtocols = () => {
  const isLive = isSupabaseConfigured;
  const [protocols, setProtocols] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(isLive);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!isLive) return;
    const [p, r] = await Promise.all([
      supabase.from('protocols').select('*').order('updated_at', { ascending: false }),
      supabase.from('protocol_runs').select('*').order('started_at', { ascending: false }).limit(40),
    ]);
    if (p.error) setError(p.error.message);
    setProtocols(p.data ?? []);
    setRuns(r.data ?? []);
    setLoading(false);
  }, [isLive]);

  useEffect(() => {
    if (!isLive) return;
    refresh();
    const channel = supabase
      .channel('protocol-runs-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'protocol_runs' }, refresh)
      .subscribe();
    const t = setInterval(refresh, 60 * 1000);
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, [isLive, refresh]);

  const createProtocol = useCallback(async ({ name, trigger_kind, description, steps }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const orgId = await orgIdOf();
    const { error: err } = await supabase.from('protocols').insert({
      org_id: orgId, name, trigger_kind: trigger_kind || 'custom', description: description || null,
      steps: steps.map((text, i) => ({ id: `s${i + 1}`, text })),
      created_by: user?.id,
    });
    if (err) throw err;
    logEvent('protocol.created', { name, trigger_kind, steps: steps.length });
    await refresh();
  }, [refresh]);

  const updateProtocol = useCallback(async (id, { name, trigger_kind, description, steps }) => {
    const { error: err } = await supabase.from('protocols').update({
      name, trigger_kind, description: description || null,
      steps: steps.map((text, i) => ({ id: `s${i + 1}`, text })),
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (err) throw err;
    logEvent('protocol.updated', { name });
    await refresh();
  }, [refresh]);

  const deleteProtocol = useCallback(async (id) => {
    const p = protocols.find(x => x.id === id);
    const { error: err } = await supabase.from('protocols').delete().eq('id', id);
    if (err) throw err;
    logEvent('protocol.deleted', { name: p?.name });
    await refresh();
  }, [protocols, refresh]);

  const seedStarters = useCallback(async () => {
    for (const p of STARTER_PROTOCOLS) {
      // eslint-disable-next-line no-await-in-loop
      await createProtocol({ ...p });
    }
  }, [createProtocol]);

  // Start a live run — snapshot the steps, alert the whole team.
  const startRun = useCallback(async (protocol, context = {}) => {
    const data = await startProtocolRun(protocol, context);
    await refresh();
    return data;
  }, [refresh]);

  const toggleStep = useCallback(async (runId, stepId, displayName) => {
    const run = runs.find(r => r.id === runId);
    if (!run) return;
    const { data: { user } } = await supabase.auth.getUser();
    const steps = (run.steps ?? []).map(s => {
      if (s.id !== stepId) return s;
      const done = !s.done;
      return { ...s, done, by: done ? user?.id : null, by_name: done ? displayName : null, at: done ? new Date().toISOString() : null };
    });
    const { error: err } = await supabase.from('protocol_runs').update({ steps }).eq('id', runId);
    if (err) throw err;
    const step = run.steps.find(s => s.id === stepId);
    if (step && !step.done) logEvent('protocol.step_done', { run: run.name, step: step.text.slice(0, 100) }, runId);
    await refresh();
  }, [runs, refresh]);

  // End a run; ask the AI for the after-action debrief (best effort).
  const endRun = useCallback(async (runId, status) => {
    const run = runs.find(r => r.id === runId);
    if (!run) return;
    let debrief = null;
    if (status === 'completed') {
      try {
        const { data: evs } = await supabase
          .from('events').select('at, type, payload')
          .gte('at', run.started_at).order('at').limit(80);
        const { data } = await supabase.functions.invoke('field-assist', {
          body: { mode: 'debrief', run: { name: run.name, started_at: run.started_at, steps: run.steps, context: run.context }, events: evs ?? [] },
        });
        debrief = data?.debrief ?? null;
      } catch { /* debrief is best-effort — the run still closes */ }
    }
    const { error: err } = await supabase.from('protocol_runs')
      .update({ status, ended_at: new Date().toISOString(), debrief })
      .eq('id', runId);
    if (err) throw err;
    logEvent(status === 'completed' ? 'protocol.run_completed' : 'protocol.run_aborted',
      { name: run.name, done: run.steps.filter(s => s.done).length, total: run.steps.length }, runId);
    await refresh();
  }, [runs, refresh]);

  // AI drafts a playbook from a plain-language situation.
  const draftWithAI = useCallback(async (situation) => {
    const { data, error: err } = await supabase.functions.invoke('field-assist', {
      body: { mode: 'protocol_draft', situation },
    });
    if (err) throw err;
    if (data?.error) throw new Error(data.error);
    return data; // {name, trigger_kind, description, steps: [..]}
  }, []);

  return {
    isLive, protocols, runs, loading, error, refresh,
    createProtocol, updateProtocol, deleteProtocol, seedStarters,
    startRun, toggleStep, endRun, draftWithAI,
  };
};
