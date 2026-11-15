/**
 * ReachInternational Web — Service Worker
 * Handles Web Push notifications, notification click routing with focus/openWindow,
 * and push subscription lifecycle changes.
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let d;
  try {
    d = event.data.json();
  } catch (err) {
    console.warn('[SW] Failed to parse push payload as JSON:', err);
    return;
  }

  const title = d.title || 'ReachInternational';
  const body = d.body || '';
  const tag = d.tag || d.nid;
  const link = d.link || '/dashboard';
  const nid = d.nid;

  // All web push notifications MUST be presented outside the web app directly to the OS / desktop.
  // Zero inside-the-app toast suppression — always display native browser / OS notification.
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/light-web-app-manifest-192x192.png',
      badge: '/light-favicon-96x96.png',
      tag: tag,
      renotify: Boolean(tag),
      requireInteraction: d.priority === 'critical' || d.priority === 'high',
      data: {
        link,
        nid,
        category: d.category,
        priority: d.priority,
      },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = event.notification.data?.link || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. If a matching window is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes(link) && 'focus' in client) {
          return client.focus();
        }
      }

      // 2. Otherwise focus any active window or open a new window
      if (windowClients.length > 0 && 'navigate' in windowClients[0] && 'focus' in windowClients[0]) {
        const client = windowClients[0];
        client.focus();
        return client.navigate(link);
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(link);
      }
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription ? event.oldSubscription.options : { userVisibleOnly: true })
      .then((subscription) => {
        // Broadcast new subscription to active windows for server registration
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
          for (const client of windowClients) {
            client.postMessage({
              type: 'PUSH_SUBSCRIPTION_CHANGED',
              subscription: JSON.stringify(subscription),
            });
          }
        });
      })
  );
});
