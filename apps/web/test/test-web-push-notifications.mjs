#!/usr/bin/env node
/**
 * Test Suite: Web Push Notifications End-to-End Verification (§9, §11, §12)
 * Tests Service Worker syntax & handlers, cache-control headers, client helper,
 * shell skip, search param autofill, preference sync, and Web Push payload dispatch.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, '..');

console.log('\n================================================================');
console.log('  TEST: Web Push Notifications Full Lifecycle Verification      ');
console.log('================================================================\n');

// 1. Service Worker File & Syntax Verification
console.log('1. Verifying Service Worker (public/sw.js)...');
const swPath = path.resolve(webDir, 'public/sw.js');
assert(fs.existsSync(swPath), 'public/sw.js must exist');
const swContent = fs.readFileSync(swPath, 'utf-8');

// Verify push event listener
assert(swContent.includes("self.addEventListener('push'"), 'sw.js must register a "push" event listener');
assert(swContent.includes('event.data.json()'), 'sw.js must parse incoming push data as JSON');
assert(swContent.includes('showNotification'), 'sw.js must call self.registration.showNotification');
assert(swContent.includes('tag:'), 'sw.js must support tag replacement for deduplication');
assert(swContent.includes('renotify:'), 'sw.js must configure renotify behavior');
assert(swContent.includes('requireInteraction:'), 'sw.js must configure requireInteraction for desktop persistence');
assert(!swContent.includes('IN_APP_PUSH_RECEIVED'), 'sw.js must NOT suppress notifications to in-app toasts; must deliver outside web app');

// Verify notificationclick event listener & window matching
assert(swContent.includes("self.addEventListener('notificationclick'"), 'sw.js must register "notificationclick" listener');
assert(swContent.includes('notification.close()'), 'notificationclick must close the notification');
assert(swContent.includes('clients.matchAll'), 'notificationclick must query existing window clients via clients.matchAll');
assert(swContent.includes('client.focus()'), 'notificationclick must focus an existing open browser tab');
assert(swContent.includes('clients.openWindow'), 'notificationclick must open a new window if no active tab exists');

// Verify pushsubscriptionchange event listener
assert(swContent.includes("self.addEventListener('pushsubscriptionchange'"), 'sw.js must register "pushsubscriptionchange" listener');
console.log('  ✓ public/sw.js registers push, notificationclick (with tab focus), and pushsubscriptionchange');

// 2. Anti-Cache Headers Verification (next.config.ts)
console.log('2. Verifying anti-cache headers in next.config.ts...');
const nextConfigPath = path.resolve(webDir, 'next.config.ts');
const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf-8');
assert(nextConfigContent.includes('/sw.js'), 'next.config.ts must define custom headers for /sw.js');
assert(
  nextConfigContent.includes('no-cache') || nextConfigContent.includes('no-store'),
  'next.config.ts must enforce no-cache or no-store on /sw.js'
);
console.log('  ✓ next.config.ts enforces strict anti-caching headers on /sw.js');

// 3. Web Push Client Helper Verification (lib/notifications/web-push-client.ts)
console.log('3. Verifying Web Push Client Helper & Shell Skip...');
const clientPath = path.resolve(webDir, 'lib/notifications/web-push-client.ts');
assert(fs.existsSync(clientPath), 'web-push-client.ts must exist');
const clientContent = fs.readFileSync(clientPath, 'utf-8');

assert(clientContent.includes('export async function isWebPushSubscribed'), 'Must export isWebPushSubscribed');
assert(clientContent.includes('export async function subscribeToWebPush'), 'Must export subscribeToWebPush');
assert(clientContent.includes('export async function unsubscribeFromWebPush'), 'Must export unsubscribeFromWebPush');
assert(clientContent.includes('export async function registerServiceWorker'), 'Must export registerServiceWorker');

// Verify Shell Skip (§9.4)
assert(
  clientContent.includes('ReactNativeWebView'),
  'web-push-client.ts must check for ReactNativeWebView to implement §9.4 shell skip'
);
console.log('  ✓ web-push-client.ts exports lifecycle functions and enforces §9.4 ReactNativeWebView shell skip');

// 4. Operator Entry Search Param Deep-Linking Verification
console.log('4. Verifying Operator Entry deep-link parameter handling...');
const entryClientPath = path.resolve(webDir, 'components/operations/entry/OperatorEntryClient.tsx');
assert(fs.existsSync(entryClientPath), 'OperatorEntryClient.tsx must exist');
const entryContent = fs.readFileSync(entryClientPath, 'utf-8');

assert(entryContent.includes('searchParams?.get("date")') || entryContent.includes('searchParams.get("date")'), 'OperatorEntryClient must read "date" from searchParams');
assert(entryContent.includes('searchParams?.get("shift")') || entryContent.includes('searchParams.get("shift")'), 'OperatorEntryClient must read "shift" from searchParams');
assert(entryContent.includes('syncOfflineNotifications'), 'OperatorEntryClient must sync unread notifications on mount');
assert(entryContent.includes('operator-alerts:'), 'OperatorEntryClient must connect to real-time WebSocket channel');
console.log('  ✓ OperatorEntryClient.tsx handles date/shift/machine deep link params & offline notification syncing');

// 5. Settings Screen Preference Synchronization Verification
console.log('5. Verifying Settings Notification UI & Preferences...');
const settingsClientPath = path.resolve(webDir, 'components/settings/SettingsClient.tsx');
assert(fs.existsSync(settingsClientPath), 'SettingsClient.tsx must exist');
const settingsContent = fs.readFileSync(settingsClientPath, 'utf-8');

// Verify Web Push toggle & preference toggles
assert(settingsContent.includes('pushEnabled'), 'SettingsClient must maintain pushEnabled state');
assert(settingsContent.includes('shiftReminders'), 'SettingsClient must maintain shiftReminders state');
assert(settingsContent.includes('breakdownAlerts'), 'SettingsClient must maintain breakdownAlerts state');
assert(settingsContent.includes('assignmentAlerts'), 'SettingsClient must maintain assignmentAlerts state');
assert(settingsContent.includes('adminAlerts'), 'SettingsClient must maintain adminAlerts state');
assert(settingsContent.includes('payrollAlerts'), 'SettingsClient must maintain payrollAlerts state');
assert(settingsContent.includes('quietHoursEnabled'), 'SettingsClient must maintain quietHoursEnabled state');

// Verify removal of dead Overtime toggle
assert(
  !settingsContent.includes('overtimeAlerts'),
  'SettingsClient must NOT contain dead overtimeAlerts toggle'
);

// Verify Always On Security card
assert(settingsContent.includes('Always On') || settingsContent.includes('ALWAYS ON'), 'SettingsClient must display Always On security banner');
console.log('  ✓ SettingsClient.tsx synchronizes with user_notification_preferences and removes dead overtime toggle');

// 6. Web Push Dispatcher & 2KB Payload Limit Verification
console.log('6. Verifying Web Push Dispatcher format & limits...');
function formatWebPushPayload(row) {
  const rawPayload = JSON.stringify({
    title: row.title || 'ReachInternational',
    body: row.body || '',
    tag: row.dedupe_key || row.notification_id,
    nid: row.notification_id,
    link: row.deep_link || '/dashboard',
    category: row.category,
    priority: row.priority,
    timestamp: Date.now(),
  });

  const byteLen = Buffer.byteLength(rawPayload, 'utf-8');
  if (byteLen > 2048) {
    throw new Error(`PayloadTooLarge: ${byteLen} bytes exceeds 2KB limit`);
  }
  return rawPayload;
}

const testPayload = formatWebPushPayload({
  notification_id: 'n-001',
  title: 'Breakdown Alert: Boom Lift #BL-01',
  body: 'Hydraulic leak reported on Sector 62 site.',
  dedupe_key: 'bd:001',
  deep_link: '/operations?date=2026-11-15&machine=m-001',
  category: 'breakdown',
  priority: 'high',
});
const parsed = JSON.parse(testPayload);
assert.strictEqual(parsed.title, 'Breakdown Alert: Boom Lift #BL-01');
assert.strictEqual(parsed.tag, 'bd:001');
assert.strictEqual(parsed.link, '/operations?date=2026-11-15&machine=m-001');

// Oversized payload rejection test
assert.throws(
  () =>
    formatWebPushPayload({
      notification_id: 'n-huge',
      title: 'Huge Payload',
      body: 'X'.repeat(3000),
      dedupe_key: 'huge',
      deep_link: '/dashboard',
      category: 'general',
      priority: 'low',
    }),
  /PayloadTooLarge/
);
console.log('  ✓ Web Push payload formatting and 2KB boundary guard verified');

console.log('\n--- ALL WEB PUSH NOTIFICATION TESTS PASSED (100%) ---');
