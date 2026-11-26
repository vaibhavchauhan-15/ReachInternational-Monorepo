/**
 * ReachInternational Web — Service Worker
 * Handles Web Push notification display, allowlist-validated notificationclick
 * routing (focus existing tab or open the approved route), and push
 * subscription lifecycle changes (re-subscribe + server re-registration).
 *
 * UPDATE POLICY: `skipWaiting()`/`clients.claim()` activate a new worker
 * immediately. This worker holds no persistent session state between events,
 * so an update cannot break an open session mid-flow.
 *
 * KEEP IN SYNC (enforced by test suites):
 * - PUSH_ROUTE_PREFIXES mirrors @reachinternational/types PUSH_ROUTE_PREFIXES
 *   (the single notification route allowlist owned by the inbox registry).
 * - VAPID_PUBLIC_KEY mirrors NEXT_PUBLIC_VAPID_PUBLIC_KEY (PUBLIC key only;
 *   used solely to re-create a PushSubscription on `pushsubscriptionchange`).
 */

const VAPID_PUBLIC_KEY =
  'BICrnhbND6KveFxhqPQt1n7tZINfLxQJ0eD2oh0N_49hwW2Y-jCNOnAOkXR9lL342S-fYVDlQbjq7erm8q21xuA';

const PUSH_ROUTE_PREFIXES = [
  '/operations',
  '/machines',
  '/users',
  '/approvals',
  '/payroll',
  '/attendance',
  '/admin/sales/rfq',
  '/rfq',
  '/settings',
  '/dashboard',
  '/',
];

function isAllowedLink(link) {
  if (typeof link !== 'string') return false;
  const trimmed = link.trim();
  if (!/^\/(?!\/)[A-Za-z0-9/_\-?=&%.]*$/.test(trimmed)) return false;
  const pathname = trimmed.split('?')[0].replace(/\/$/, '') || '/';
  return PUSH_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

self.addEventListener('install', () => {
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

  const title = typeof d.title === 'string' && d.title ? d.title : 'ReachInternational';
  const body = typeof d.body === 'string' ? d.body : '';
  const tag = typeof d.tag === 'string' && d.tag ? d.tag : d.nid;
  const link = isAllowedLink(d.link) ? d.link : '/dashboard';
  const nid = typeof d.nid === 'string' ? d.nid : undefined;

  // All web push notifications MUST be presented outside the web app directly to the OS / desktop.
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

  // Secure routing: only allowlisted same-origin relative routes are ever
  // navigated. Invalid/unavailable links fall back to the dashboard.
  const rawLink = event.notification.data?.link;
  const link = isAllowedLink(rawLink) ? rawLink : '/dashboard';
  const targetPath = link.split('?')[0].replace(/\/$/, '') || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Focus a tab already on the target route and sync its query string
      for (const client of windowClients) {
        try {
          const clientUrl = new URL(client.url);
          const clientPath = clientUrl.pathname.replace(/\/$/, '') || '/';
          if (clientPath === targetPath && 'focus' in client) {
            return client.focus().then((focused) =>
              focused && focused.url !== new URL(link, self.location.origin).href && 'navigate' in focused
                ? focused.navigate(link)
                : focused
            );
          }
        } catch {
          // Ignore unparsable client URLs
        }
      }

      // 2. Otherwise focus the first existing window and navigate it
      if (windowClients.length > 0 && 'navigate' in windowClients[0] && 'focus' in windowClients[0]) {
        const client = windowClients[0];
        return client.focus().then(() => client.navigate(link));
      }

      // 3. Or open a new window on the approved route
      if (self.clients.openWindow) {
        return self.clients.openWindow(link);
      }
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // Preserve the application server key so the re-subscription is valid
        // in every browser (a bare { userVisibleOnly } subscribe throws).
        const oldOptions = event.oldSubscription ? event.oldSubscription.options : null;
        const applicationServerKey =
          (oldOptions && oldOptions.applicationServerKey) || urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        // Re-register with the server using the user's session cookie. This can
        // fire with no tab open, so it cannot rely on page code.
        await fetch('/api/push/resubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh') || []))),
              auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth') || []))),
            },
          }),
        });

        // Also broadcast to any open windows as a fallback registration path.
        const windowClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        for (const client of windowClients) {
          client.postMessage({
            type: 'PUSH_SUBSCRIPTION_CHANGED',
            subscription: JSON.stringify(subscription),
          });
        }
      } catch (err) {
        console.warn('[SW] pushsubscriptionchange handling failed:', err);
      }
    })()
  );
});
