'use client';

/**
 * ReachInternational Web — Browser Web Push Client Helper
 * Handles service worker registration, VAPID key conversion,
 * browser push subscription lifecycle, and Supabase device synchronization.
 */

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Ensures the service worker is registered
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (err) {
    console.warn('[WebPushClient] Service worker registration failed:', err);
    return null;
  }
}

/**
 * Checks if Web Push is currently active and permitted in the browser
 */
export async function isWebPushSubscribed(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  // Shell skip (§9.4): if web is hosted inside native app's WebView, skip web push (native handles push)
  if (typeof (window as any).ReactNativeWebView !== 'undefined') {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return Boolean(subscription);
  } catch {
    return false;
  }
}

/**
 * Subscribes current browser session to Web Push and registers device endpoint in Supabase
 */
export async function subscribeToWebPush(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[WebPushClient] Web Push is not supported in this browser environment');
    return false;
  }

  // Shell skip (§9.4): if web is hosted inside native app's WebView, skip web push (native handles push)
  if (typeof (window as any).ReactNativeWebView !== 'undefined') {
    return false;
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    console.error('[WebPushClient] NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing');
    return false;
  }

  try {
    // 1. Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[WebPushClient] Notification permission denied');
      return false;
    }

    // 2. Register service worker and await readiness
    await registerServiceWorker();
    const registration = await navigator.serviceWorker.ready;

    // 3. Create or reuse PushSubscription
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });
    }

    const p256dh = arrayBufferToBase64(subscription.getKey('p256dh'));
    const auth = arrayBufferToBase64(subscription.getKey('auth'));

    if (!p256dh || !auth) {
      console.warn('[WebPushClient] Subscription missing encryption keys');
      return false;
    }

    // 4. Register with Supabase RPC
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc('register_push_device', {
      p_token: subscription.endpoint,
      p_platform: 'web',
      p_app_version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      p_web_keys: {
        p256dh,
        auth,
      },
    });

    if (error) {
      console.error('[WebPushClient] Failed to register web push device in Supabase:', error);
      return false;
    }

    console.log('[WebPushClient] Successfully subscribed to Web Push');
    return true;
  } catch (err) {
    console.error('[WebPushClient] Error subscribing to Web Push:', err);
    return false;
  }
}

/**
 * Unsubscribes from Web Push and deactivates endpoint in Supabase
 */
export async function unsubscribeFromWebPush(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const supabase = createSupabaseBrowserClient();
      await supabase.rpc('unregister_push_device', {
        p_token: subscription.endpoint,
      });

      await subscription.unsubscribe();
      console.log('[WebPushClient] Unsubscribed from Web Push');
      return true;
    }
    return false;
  } catch (err) {
    console.error('[WebPushClient] Error unsubscribing from Web Push:', err);
    return false;
  }
}
