/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope;

// Background Sync fires this event even for a backgrounded tab; not in the TS DOM lib.
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
}

// Take over immediately on install/update. iOS home-screen apps almost never
// close every client, so a waiting worker would otherwise never activate.
// The page reloads itself onto the new build when it's safe (lib/pwaUpdate.ts).
self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Offline app-shell: serve the precached index.html for SPA navigations so a
// reload while offline still boots the app (Supabase API calls are cross-origin
// fetches, not navigations, so they fall through to the network — never cached).
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Self-hosted font subsets that aren't precached (only Latin is) — fetched on
// demand by unicode-range, then kept; hashed filenames never change.
registerRoute(
  ({ url, request }) => url.origin === self.location.origin && request.destination === 'font',
  new CacheFirst({
    cacheName: 'fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);
// NOTE: Supabase REST/auth responses are intentionally NOT cached (authed,
// privacy-sensitive, staleness risk). Leave them to always hit the network.

function readPush(event: PushEvent): { title?: string; body?: string } {
  try {
    return (event.data?.json() as { title?: string; body?: string } | null) ?? {};
  } catch {
    return { body: event.data?.text() };
  }
}

// Every push MUST show a notification: WebKit revokes the subscription after
// pushes that don't, so a malformed payload can't be allowed to throw first.
self.addEventListener('push', (event: PushEvent) => {
  const data = readPush(event);
  const title = data.title || 'cache reminder';
  const body = data.body || 'you have a note reminder';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/pwa-192x192.png',
      badge: '/icons/pwa-192x192.png',
      tag: 'cache-reminder',
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});

// Background Sync wake-up: the SW can't read the outbox (localStorage) or the
// Supabase session, so on `sync` it just nudges any live client to flush. Tag
// mirrors SYNC_TAG in web/src/lib/bgsync.ts; the page listener lives in App.tsx.
// Fully-closed app → no client to message → flush happens on next open, as today.
self.addEventListener('sync', ((event: SyncEvent) => {
  if (event.tag !== 'cn-flush') return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) client.postMessage({ type: 'cn-flush' });
    })
  );
}) as EventListener);
