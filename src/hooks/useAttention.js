import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { runAttentionSweep } from '../lib/attentionEngine';
import { logEvent } from '../lib/eventLog';

const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 };
const SWEEP_INTERVAL = 5 * 60 * 1000;

// The coordinator's attention queue: sweeps rules on an interval and
// exposes ranked, acknowledgeable items.
export const useAttention = () => {
  const isLive = isSupabaseConfigured;
  const [items, setItems] = useState([]);
  const [sweeping, setSweeping] = useState(false);
  const [lastSweep, setLastSweep] = useState(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!isLive) return;
    const { data } = await supabase
      .from('attention_items')
      .select('*')
      .neq('status', 'resolved')
      .order('created_at', { ascending: false });
    if (!mounted.current) return;
    const sorted = (data ?? []).sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
    );
    setItems(sorted);
  }, [isLive]);

  const sweep = useCallback(async () => {
    if (!isLive) return;
    setSweeping(true);
    try {
      await runAttentionSweep();
      await refresh();
      if (mounted.current) setLastSweep(new Date());
    } finally {
      if (mounted.current) setSweeping(false);
    }
  }, [isLive, refresh]);

  useEffect(() => {
    mounted.current = true;
    if (!isLive) return;
    sweep();
    const timer = setInterval(sweep, SWEEP_INTERVAL);
    return () => { mounted.current = false; clearInterval(timer); };
  }, [isLive, sweep]);

  const acknowledge = useCallback(async (id) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('attention_items')
      .update({ status: 'acknowledged', acknowledged_by: user?.id, acknowledged_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      const item = items.find(i => i.id === id);
      logEvent('attention.acknowledged', { title: item?.title, severity: item?.severity }, item?.dedupe_key);
      await refresh();
    }
  }, [items, refresh]);

  const openItems = items.filter(i => i.status === 'open');
  const hasCritical = openItems.some(i => i.severity === 'critical');

  return { isLive, items, openItems, hasCritical, sweeping, lastSweep, sweep, acknowledge };
};
