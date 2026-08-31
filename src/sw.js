/* eslint-env serviceworker */
// ============================================
// Watchtower service worker (custom)
// Precaches the app shell AND handles Web Push — notifications
// reach the device even when the app is closed.
// ============================================
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Watchtower', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      // Monochrome white-on-transparent: Android renders the badge from
      // the alpha channel only — an opaque icon becomes a black square.
      badge: '/badge-96.png',
      tag: data.tag ?? data.kind ?? 'watchtower',
      renotify: true,
      data: { url: data.url ?? '/' },
      vibrate: data.kind === 'attention' ? [200, 100, 200, 100, 400] : [150, 80, 150],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const client = list.find((w) => 'focus' in w);
      if (client) { client.focus(); return client.navigate ? client.navigate(url) : undefined; }
      return self.clients.openWindow(url);
    })
  );
});
