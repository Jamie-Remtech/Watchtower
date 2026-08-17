import { supabase, isSupabaseConfigured } from './supabase';

// ============================================
// OFFLINE QUEUE (slice 3)
// Field entries must never be lost to a dead spot. Failed event
// inserts are queued in localStorage with their original client
// timestamp and flushed when connectivity returns.
// ============================================

const QUEUE_KEY = 'watchtower-event-queue';

const readQueue = () => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]'); } catch { return []; }
};
const writeQueue = (q) => localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-500)));

export const enqueueEvent = (row) => {
  const q = readQueue();
  q.push(row);
  writeQueue(q);
};

export const queuedCount = () => readQueue().length;

let flushing = false;
export const flushQueue = async () => {
  if (!isSupabaseConfigured || flushing) return 0;
  const q = readQueue();
  if (!q.length) return 0;
  flushing = true;
  let sent = 0;
  const remaining = [];
  for (const row of q) {
    const { error } = await supabase.from('events').insert(row);
    if (error) remaining.push(row);
    else sent++;
  }
  writeQueue(remaining);
  flushing = false;
  return sent;
};

// Flush whenever the network comes back, and shortly after load
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue(); });
  setTimeout(() => { flushQueue(); }, 5000);
}
