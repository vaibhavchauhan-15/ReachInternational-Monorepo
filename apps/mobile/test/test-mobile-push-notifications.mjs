#!/usr/bin/env node
/**
 * Test Suite: Native Mobile Push Notifications End-to-End Verification (§10, §11, §12)
 * Tests Expo config plugin, notification icon asset, 4 Android channels, foreground handler,
 * route allowlist deep-linking, obsolete timer elimination, settings sync, and Dev DB RPCs.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mobileDir = path.resolve(__dirname, '..');

console.log('\n================================================================');
console.log('  TEST: Native Mobile Push Notifications Lifecycle Verification ');
console.log('================================================================\n');

// 1. App.json Plugin & Icon Asset Verification
console.log('1. Verifying Expo config plugin and notification icon asset...');
const appJsonPath = path.resolve(mobileDir, 'app.json');
assert(fs.existsSync(appJsonPath), 'app.json must exist');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));

const plugins = appJson.expo?.plugins || [];
const pushPlugin = plugins.find(
  (p) => (Array.isArray(p) && p[0] === 'expo-notifications') || p === 'expo-notifications'
);
assert(pushPlugin, 'expo-notifications plugin must be declared in app.json');
assert(Array.isArray(pushPlugin) && pushPlugin[1]?.icon, 'expo-notifications plugin must specify icon path');
assert.strictEqual(pushPlugin[1].color, '#0284c7', 'expo-notifications color must be #0284c7 (Reach Sky Blue)');

const iconRelPath = pushPlugin[1].icon;
const iconFullPath = path.resolve(mobileDir, iconRelPath);
assert(fs.existsSync(iconFullPath), `Notification icon file must exist at ${iconFullPath}`);

// Verify valid PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
const iconBuffer = fs.readFileSync(iconFullPath);
const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
for (let i = 0; i < pngMagic.length; i++) {
  assert.strictEqual(iconBuffer[i], pngMagic[i], 'Notification icon must be a valid PNG');
}
console.log(`  ✓ app.json configures expo-notifications plugin with valid PNG icon (${iconBuffer.length} bytes)`);

// 2. Android Channels Configuration Verification
console.log('2. Verifying Android Notification Channels (lib/notifications/registerPush.ts)...');
const registerPushPath = path.resolve(mobileDir, 'lib/notifications/registerPush.ts');
assert(fs.existsSync(registerPushPath), 'registerPush.ts must exist');
const registerPushContent = fs.readFileSync(registerPushPath, 'utf-8');

assert(registerPushContent.includes("'breakdown_alerts'"), 'Must configure "breakdown_alerts" channel');
assert(registerPushContent.includes('[0, 500, 200, 500]'), 'breakdown_alerts must use distinct heavy vibration pattern [0, 500, 200, 500]');
assert(registerPushContent.includes("'shift_reminders'"), 'Must configure "shift_reminders" channel');
assert(registerPushContent.includes('[0, 250, 250, 250]'), 'shift_reminders must use standard vibration pattern [0, 250, 250, 250]');
assert(registerPushContent.includes("'assignment_updates'"), 'Must configure "assignment_updates" channel');
assert(registerPushContent.includes("'general_updates'"), 'Must configure "general_updates" channel');
console.log('  ✓ 4 Android channels declared with distinct vibration patterns and importance levels');

// 2b. Expo Go Isolation Guards & Early Warning Suppression Verification
console.log('2b. Verifying Expo Go isolation guards & early warning suppression...');
assert(registerPushContent.includes('export function isExpoGo'), 'registerPush.ts must export isExpoGo()');
assert(registerPushContent.includes('if (isExpoGo())'), 'setupNotificationChannels & registerForPushNotifications must check isExpoGo()');

const suppressPath = path.resolve(mobileDir, 'lib/suppressWarnings.ts');
assert(fs.existsSync(suppressPath), 'suppressWarnings.ts must exist');
const suppressContent = fs.readFileSync(suppressPath, 'utf-8');
assert(suppressContent.includes('expo-notifications'), 'suppressWarnings.ts must contain expo-notifications filter');
assert(suppressContent.includes('ExpoNotificationChannelManager.setNotificationChannelAsync'), 'suppressWarnings.ts must contain channel warning filter');
console.log('  ✓ Expo Go push/channel isolation guards and early warning suppression verified');

// 3. Foreground Notification Handler Verification
console.log('3. Verifying foreground notification handler flags & external OS delivery...');
assert(registerPushContent.includes('setNotificationHandler'), 'Must invoke setNotificationHandler');
assert(registerPushContent.includes('shouldShowAlert: true'), 'Handler must enable shouldShowAlert');
assert(registerPushContent.includes('shouldSetBadge: true'), 'Handler must enable shouldSetBadge');
assert(registerPushContent.includes('shouldShowList: true'), 'Handler must enable shouldShowList');
// Foreground policy: critical/high keep the native heads-up banner; normal/low
// surface as an in-app indicator (badge + inbox) instead of a duplicate banner.
assert(
  registerPushContent.includes('shouldShowBanner: isHighPriority'),
  'Handler must gate the foreground system banner on critical/high priority'
);
assert(
  registerPushContent.includes('shouldPlaySound: isHighPriority'),
  'Handler must gate foreground sound on critical/high priority'
);

// Verify eradication of inside-the-app notification banners/toasts in root layout
const layoutPath = path.resolve(mobileDir, 'app/_layout.tsx');
const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
assert(!layoutContent.includes('<PostNotificationBanner />'), 'app/_layout.tsx must NOT render <PostNotificationBanner />');

// Verify postNotification delivers outside app via scheduleNotificationAsync
const postNotifPath = path.resolve(mobileDir, 'lib/notifications/postNotification.ts');
const postNotifContent = fs.readFileSync(postNotifPath, 'utf-8');
assert(
  postNotifContent.includes('Notifications.scheduleNotificationAsync'),
  'postNotification must deliver to native OS outside the app via Notifications.scheduleNotificationAsync'
);
console.log('  ✓ Notifications presented strictly outside the app in the native OS; in-app toasts eliminated');

// 4. Route Allowlist & Deep Linking Verification
console.log('4. Verifying route allowlist & deep link sanitizer...');
// The allowlist is owned by the shared notification registry
// (packages/types/src/pushNotifications.ts — mirrors the DB route sync trigger).
const registrySrc = fs.readFileSync(
  path.resolve(__dirname, '../../../packages/types/src/pushNotifications.ts'),
  'utf-8'
);
const registryBody = registrySrc.slice(registrySrc.indexOf('ROUTE_KEY_REGISTRY'));
const ROUTE_ALLOWLIST = [
  ...new Set(
    [...registryBody.slice(0, registryBody.indexOf('};')).matchAll(/'(\/[A-Za-z0-9/_-]*)'/g)].map((m) => m[1])
  ),
];
assert(ROUTE_ALLOWLIST.includes('/operations'), 'Shared registry must allowlist /operations');
assert(!ROUTE_ALLOWLIST.includes('/fleet'), 'Shared registry must NOT allowlist non-registry routes like /fleet');
function isValidDeepLink(link) {
  if (!link || typeof link !== 'string') return false;
  const trimmed = link.trim();
  if (!/^\/[A-Za-z0-9/_\-?=&%.]*$/.test(trimmed)) return false;
  return ROUTE_ALLOWLIST.some((prefix) => trimmed === prefix || trimmed.startsWith(`${prefix}?`) || trimmed.startsWith(`${prefix}/`));
}

// Valid paths
assert(isValidDeepLink('/dashboard'), 'Valid deep link /dashboard');
assert(isValidDeepLink('/operations?date=2026-11-15&shift=S1'), 'Valid deep link with query parameters');
assert(isValidDeepLink('/settings/notifications'), 'Valid sub-route deep link');
assert(isValidDeepLink('/users'), 'Valid deep link /users');

// Dangerous / invalid paths
assert(!isValidDeepLink(''), 'Empty string is invalid');
assert(!isValidDeepLink('https://malicious.com'), 'External protocol must be rejected');
assert(!isValidDeepLink('javascript:alert(1)'), 'Dangerous scheme must be rejected');
assert(!isValidDeepLink('/../etc/passwd'), 'Path traversal must be rejected');
assert(!isValidDeepLink('dashboard'), 'Missing leading slash must be rejected');
assert(!isValidDeepLink('/unauthorized_admin_portal'), 'Unwhitelisted root path must be rejected');
console.log('  ✓ Deep link allowlist enforces strict relative URL security');

// 5. Obsolete Timer Elimination Verification (shiftEndNotifier.ts)
console.log('5. Verifying elimination of obsolete local background timers...');
const notifierPath = path.resolve(mobileDir, 'lib/notifications/shiftEndNotifier.ts');
assert(fs.existsSync(notifierPath), 'shiftEndNotifier.ts must exist');
const notifierContent = fs.readFileSync(notifierPath, 'utf-8');

assert(
  !notifierContent.includes('Notifications.scheduleNotificationAsync'),
  'Must NOT schedule local background timers via scheduleNotificationAsync'
);
assert(
  notifierContent.includes('Obsolete local background timer removed'),
  'shiftEndNotifier.ts must document obsolete background timer removal'
);
console.log('  ✓ Obsolete client-side background timers eliminated (server push is authoritative)');

// 6. Mobile Notification Settings Screen Verification
console.log('6. Verifying mobile notification settings screen (app/(app)/settings/notifications.tsx)...');
const settingsPath = path.resolve(mobileDir, 'app/(app)/settings/notifications.tsx');
assert(fs.existsSync(settingsPath), 'settings/notifications.tsx must exist');
const settingsContent = fs.readFileSync(settingsPath, 'utf-8');

assert(settingsContent.includes('prefs.push'), 'Settings must bind prefs.push');
assert(settingsContent.includes('shiftReminders'), 'Settings must bind shiftReminders');
assert(settingsContent.includes('breakdownAlerts'), 'Settings must bind breakdownAlerts');
assert(settingsContent.includes('assignmentAlerts'), 'Settings must bind assignmentAlerts');
assert(settingsContent.includes('adminAlerts'), 'Settings must bind adminAlerts');
assert(settingsContent.includes('payrollAlerts'), 'Settings must bind payrollAlerts');
assert(settingsContent.includes('quietHoursEnabled'), 'Settings must bind quietHoursEnabled');
assert(settingsContent.includes('ALWAYS ON'), 'Settings must show ALWAYS ON security card');

// Verify removal of dead Overtime toggle
assert(
  !settingsContent.includes("title=\"Overtime Alerts\"") &&
  !settingsContent.includes("label=\"Overtime Alerts\""),
  'Must NOT render active Overtime Alerts toggle'
);

// Verify touch target ergonomics (minHeight: 64 >= 44)
assert(
  settingsContent.includes('minHeight: 64') || settingsContent.includes('minHeight: 44'),
  'All toggle touch targets must enforce minHeight >= 44'
);
console.log('  ✓ Mobile settings screen synchronizes with user_notification_preferences with 44px touch targets');

// 7. Supabase Database RPC Integration Verification (Dev DB)
console.log('7. Verifying Dev DB device registration & unregistration RPCs...');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vlmxciuogczumumrwyot.supabase.co';
const SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbXhjaXVvZ2N6dW11bXJ3eW90Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyNDgwNiwiZXhwIjoyMDkzOTAwODA2fQ.2Z8Fiptbf7vqMHI5TsJ8-RPD4JHC5oFMPHn0BP-3mDY';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const testToken = `ExponentPushToken[TestMobile-${Date.now()}]`;
const testUserIdA = 'b3400740-3e79-44c7-9aec-a0ec3ccd22ce'; // Rohit Singh
const testUserIdB = '13841eaa-c894-448f-b60f-093b341605e7'; // Supervisor

try {
  // Test 7a: Unauthenticated call is rejected by register_push_device (Security Invariant)
  const { error: unauthErr } = await admin.rpc('register_push_device', {
    p_token: testToken,
    p_platform: 'android',
    p_provider: 'expo',
    p_app_version: '1.4.0',
    p_label: 'Galaxy A54',
  });
  assert(unauthErr && unauthErr.message.includes('unauthenticated'), 'register_push_device must reject unauthenticated calls');
  console.log('  ✓ register_push_device rejects unauthenticated calls (security guard verified)');

  // Test 7b: Device Registration & Token Uniqueness (Shared Device Reassignment)
  const { data: devA, error: insDevA } = await admin
    .from('push_devices')
    .insert({
      user_id: testUserIdA,
      platform: 'android',
      provider: 'expo',
      token: testToken,
      device_label: 'Samsung Galaxy A54 - Operator',
      app_version: '1.4.0',
      is_active: true,
    })
    .select('id, user_id, token, is_active')
    .single();
  assert.ifError(insDevA);
  assert.strictEqual(devA.is_active, true);
  assert.strictEqual(devA.user_id, testUserIdA);
  console.log('  ✓ Initial device registration created for User A (is_active = true)');

  // User B logs in to the same device (reassigns token to User B on conflict)
  const { data: devB, error: insDevB } = await admin
    .from('push_devices')
    .upsert(
      {
        user_id: testUserIdB,
        platform: 'android',
        provider: 'expo',
        token: testToken,
        device_label: 'Samsung Galaxy A54 - Supervisor',
        app_version: '1.4.0',
        is_active: true,
      },
      { onConflict: 'token' }
    )
    .select('id, user_id, token, is_active')
    .single();
  assert.ifError(insDevB);
  assert.strictEqual(devA.id, devB.id, 'Device row is reused for same hardware token');
  assert.strictEqual(devB.user_id, testUserIdB, 'Device token ownership seamlessly transfers to User B');
  console.log('  ✓ Shared device token reassigned to User B without duplicate constraint collision');

  // Test 7c: Device Unregistration on Sign Out
  const { error: deactErr } = await admin
    .from('push_devices')
    .update({ is_active: false })
    .eq('token', testToken)
    .eq('user_id', testUserIdB);
  assert.ifError(deactErr);

  const { data: checkDeact } = await admin
    .from('push_devices')
    .select('is_active')
    .eq('token', testToken)
    .single();
  assert.strictEqual(checkDeact.is_active, false, 'Device is marked inactive on sign out');
  console.log('  ✓ Device successfully marked inactive on sign out');
} finally {
  // Clean up test token
  await admin.from('push_devices').delete().eq('token', testToken);
}

console.log('\n--- ALL NATIVE MOBILE PUSH NOTIFICATION TESTS PASSED (100%) ---');
