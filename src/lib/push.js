import { supabase, isSupabaseConfigured } from './supabase';

// ============================================
// NOTIFICATIONS
// Local: shown via the service worker while the app runs.
// Push: true Web Push — reaches the device even when Watchtower is
// closed (installed PWA on iOS, any state on Android/desktop).
// ============================================

// Public half of the VAPID keypair (safe to ship; private half lives
// only in the push-notify edge function secret).
const APP_SERVER_KEY = 'BACsHZcpsD4Jc5nrk1g2iobUypZyV6Y3-XBzDRaf5iLseKwY4Q4zIxud4YpWuD-F3KJ4y9ZzTWMXZIoThmcMyHw';

const b64ToBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
};

export const notificationPermission = () =>
  ('Notification' in window ? Notification.permission : 'unsupported');

// Ask permission (must be from a user gesture) and register this
// device for push. Safe to call again — upserts the subscription.
export async function enableNotifications() {
  if (!('Notification' in window)) return { error: 'Notifications not supported in this browser' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { error: 'Permission not granted' };
  return ensureSubscribed();
}

export async function ensureSubscribed() {
  if (!isSupabaseConfigured || notificationPermission() !== 'granted') return { error: 'not ready' };
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) return { ok: true, pushless: true }; // local notifications only
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToBytes(APP_SERVER_KEY),
    });
    const j = sub.toJSON();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'not signed in' };
    let orgId = localStorage.getItem('watchtower-org-id');
    if (!orgId) {
      const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
      orgId = prof?.org_id;
      if (orgId) localStorage.setItem('watchtower-org-id', orgId);
    }
    if (!orgId) return { error: 'no organization' };
    const { error } = await supabase.from('push_subscriptions').upsert(
      { org_id: orgId, profile_id: user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth },
      { onConflict: 'endpoint' }
    );
    if (error) return { error: error.message };
    return { ok: true };
  } catch (e) {
    // Push subscription can fail (e.g. iOS Safari tab instead of the
    // installed app) — local notifications still work.
    return { ok: true, pushless: true, note: e.message };
  }
}

// Show a notification from the running app (used when the event
// arrives via realtime while the app is open but not being watched).
export async function localNotify(title, body, url = '/') {
  if (notificationPermission() !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification(title, {
      body, icon: '/icon-192.png', badge: '/icon-192.png', tag: url, renotify: true, data: { url },
    });
  } catch { /* no SW — best effort */ }
}

// Ask the server to push to the org (fire-and-forget). Sends this
// device's own push endpoint so the server can skip just THIS device
// (which already saw the event) instead of the whole profile — your
// other devices must still be alerted about danger at your position.
export async function pushToTeam(payload) {
  if (!isSupabaseConfigured) return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    const sub = await reg?.pushManager?.getSubscription();
    if (sub?.endpoint) payload = { ...payload, exclude_endpoint: sub.endpoint };
  } catch { /* no SW — send without exclusion */ }
  supabase.functions.invoke('push-notify', { body: payload }).catch(() => {});
}
