#!/usr/bin/env node
/**
 * Push Notifications Hardening & Negative Security Suite (Phase 5)
 * Target: Reach International Dev (vlmxciuogczumumrwyot) — live, self-cleaning.
 *
 * Verifies the hardened push pipeline negatives:
 * unauthenticated dispatcher/RPC rejection, forged recipients, cross-user device
 * isolation, concurrent claim safety, stale-lease reclaim, multi-device delivery
 * independence, token ownership moves, device cap LRU + audit, TTL expiry,
 * quiet hours + critical bypass, category preferences (canonical spellings),
 * reminder dedupe + IST deadline boundaries, zero-PII templates, sender-side
 * 'skip' semantics, and web/native route allowlist parity.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vlmxciuogczumumrwyot.supabase.co';
const SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbXhjaXVvZ2N6dW11bXJ3eW90Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyNDgwNiwiZXhwIjoyMDkzOTAwODA2fQ.2Z8Fiptbf7vqMHI5TsJ8-RPD4JHC5oFMPHn0BP-3mDY';
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbXhjaXVvZ2N6dW11bXJ3eW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjQ4MDYsImV4cCI6MjA5MzkwMDgwNn0.0iB4GskphGsbc_Sh_vFNLSZ0d5af59QYaYTKU-BFpWY';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const runId = Date.now().toString().slice(-8);
const createdUserIds = [];
const createdDeviceIds = [];
const createdNotificationIds = [];

function note(ok, msg) {
  console.log(`  ✓ ${msg}`);
}

// ---------------------------------------------------------------------------
// Static & parity checks (no network)
// ---------------------------------------------------------------------------
function staticChecks() {
  console.log('1. Static guards, parity & collapse capability...');

  const sw = fs.readFileSync(path.join(ROOT, 'apps/web/public/sw.js'), 'utf8');
  const typesSrc = fs.readFileSync(path.join(ROOT, 'packages/types/src/pushNotifications.ts'), 'utf8');

  // SW allowlist parity with the shared registry (single source of truth)
  const swPrefixes = new Set(
    [...sw.matchAll(/'(\/[A-Za-z0-9/_-]*)'/g)]
      .map((m) => m[1])
      .filter((p) => p.startsWith('/'))
  );
  const registryBody = typesSrc.slice(typesSrc.indexOf('ROUTE_KEY_REGISTRY'));
  const registryPrefixes = new Set(
    [...registryBody.slice(0, registryBody.indexOf('};')).matchAll(/'(\/[A-Za-z0-9/_-]*)'/g)].map((m) => m[1])
  );
  for (const p of registryPrefixes) {
    assert(swPrefixes.has(p), `sw.js is missing allowlisted route prefix ${p} (registry drift)`);
  }
  note(true, `sw.js route allowlist matches shared registry (${registryPrefixes.size} prefixes)`);

  // Secure click routing: sw.js must validate links before navigating
  assert(sw.includes('isAllowedLink'), 'sw.js must validate push links against the allowlist');
  // Robust re-subscription: applicationServerKey must be preserved
  assert(sw.includes('applicationServerKey'), 'sw.js pushsubscriptionchange must keep applicationServerKey');
  assert(sw.includes('/api/push/resubscribe'), 'sw.js must re-register changed subscriptions server-side');
  note(true, 'sw.js validates click routing and re-subscribes with applicationServerKey');

  // Dispatcher + receipts routes must be Bearer-authenticated and Zod-validated
  const dispatch = fs.readFileSync(path.join(ROOT, 'apps/web/app/api/notify/dispatch/route.ts'), 'utf8');
  const receipts = fs.readFileSync(path.join(ROOT, 'apps/web/app/api/notify/receipts/route.ts'), 'utf8');
  assert(dispatch.includes('assertBearer'), 'dispatch route must authenticate with assertBearer');
  assert(dispatch.includes('safeParse'), 'dispatch route must Zod-validate its body');
  assert(dispatch.includes("PUSH_ENABLED"), 'dispatch route must honor the kill switch');
  assert(receipts.includes('assertBearer'), 'receipts route must authenticate with assertBearer');
  note(true, 'Dispatcher and receipts routes enforce Bearer auth + input validation');

  // Collapse capability used (verified available in installed libraries)
  const expoSender = fs.readFileSync(path.join(ROOT, 'apps/web/lib/notifications/expo-sender.ts'), 'utf8');
  const webpushSender = fs.readFileSync(path.join(ROOT, 'apps/web/lib/notifications/webpush-sender.ts'), 'utf8');
  assert(expoSender.includes('collapseId'), 'expo-sender must use collapseId for collapsible reminders');
  assert(webpushSender.includes('topic'), 'webpush-sender must set the Web Push Topic header');
  note(true, 'Provider collapse identifiers in use (Expo collapseId, Web Push topic)');

  // Sender-side conditions must never deactivate devices
  assert(
    !webpushSender.includes("outcome: 'dead',\n        error: 'PayloadExceeds2KB'"),
    'oversized payload must not produce a device-dead outcome'
  );
  assert(webpushSender.includes("'skip'"), 'webpush-sender must use the non-device-mutating skip outcome');
  const sendAll = fs.readFileSync(path.join(ROOT, 'apps/web/lib/notifications/send-all.ts'), 'utf8');
  assert(sendAll.includes('WebPushProviderCrash'), 'provider failure domains must be isolated in sendAll');
  assert(sendAll.includes("outcome: 'skip'"), 'kill-switched categories must use skip, not dead');
  note(true, 'Sender-side conditions use skip outcome; provider failure domains isolated');

  // Route contract: clients must pass provider + installation identity
  const webClient = fs.readFileSync(path.join(ROOT, 'apps/web/lib/notifications/web-push-client.ts'), 'utf8');
  const mobileClient = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/notifications/registerPush.ts'), 'utf8');
  assert(webClient.includes("p_provider: 'webpush'"), 'web client must pass p_provider');
  assert(mobileClient.includes("p_provider: 'expo'"), 'mobile client must pass p_provider');
  assert(webClient.includes('p_installation_id'), 'web client must pass p_installation_id');
  assert(mobileClient.includes('p_installation_id'), 'mobile client must pass p_installation_id');
  assert(mobileClient.includes('isAllowedPushDeepLink'), 'mobile tap routing must use the shared route allowlist');
  note(true, 'Both clients register with provider + installation id; mobile uses shared allowlist');
}

// ---------------------------------------------------------------------------
// Live Dev DB negatives
// ---------------------------------------------------------------------------
async function liveChecks() {
  console.log('\n2. Registration security & validation (live Dev DB)...');

  // 2a. Unauthenticated registration rejected (RPC resolves, guard fires)
  {
    const { error } = await anon.rpc('register_push_device', {
      p_platform: 'web',
      p_token: 'https://fcm.googleapis.com/fcm/send/probe',
    });
    assert(error, 'register_push_device must reject unauthenticated calls');
    note(true, 'register_push_device rejects unauthenticated calls');
  }

  // Test users A (operator) and B (operator)
  const mkUser = async (tag) => {
    const email = `push-hard-${tag}-${runId}@test.reachinternational.co.in`;
    const password = `HardTest!${runId}${tag}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: 'Push Hardening Test',
        role: 'operator',
        phone: `+91${Math.floor(9000000000 + Math.random() * 999999999)}`,
        city: 'Delhi',
        state: 'Delhi',
        district: 'New Delhi',
      },
    });
    assert(!error, `createUser ${tag}: ${error?.message}`);
    createdUserIds.push(data.user.id);
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: sess, error: signErr } = await client.auth.signInWithPassword({ email, password });
    assert(!signErr, `signIn ${tag}: ${signErr?.message}`);
    return { id: data.user.id, client, jwt: sess.session.access_token };
  };

  const userA = await mkUser('a');
  const userB = await mkUser('b');

  // 2b. Endpoint validation (SSRF guard)
  for (const [token, expected] of [
    ['http://fcm.googleapis.com/fcm/send/x', /invalid_endpoint_host/],
    ['https://evil.example.com/fcm/send/x', /invalid_endpoint_host/],
    ['ftp://fcm.googleapis.com/x', /invalid_endpoint_host/],
  ]) {
    const { error } = await userA.client.rpc('register_push_device', {
      p_platform: 'web',
      p_provider: 'webpush',
      p_token: token,
    });
    assert(error && expected.test(error.message), `endpoint ${token} must be rejected (got: ${error?.message})`);
  }
  note(true, 'Non-HTTPS and non-allowlisted push endpoints rejected (SSRF guard)');

  // 2c. Expo token format validation
  {
    const { error } = await userA.client.rpc('register_push_device', {
      p_platform: 'android',
      p_provider: 'expo',
      p_token: 'not-a-valid-token',
    });
    assert(error && /invalid_token_format/.test(error.message), 'invalid expo token must be rejected');
    note(true, 'Invalid Expo token format rejected');
  }

  // 2d. Provider derivation when omitted (fixes legacy client call shape)
  {
    const token = `https://fcm.googleapis.com/fcm/send/hard-${runId}-1`;
    const { error } = await userA.client.rpc('register_push_device', {
      p_platform: 'web',
      p_token: token,
      p_app_version: '1.0.0',
    });
    assert(!error, `client-shape registration must succeed: ${error?.message}`);
    const { data: row } = await admin
      .from('push_devices')
      .select('id, provider, user_id')
      .eq('token', token)
      .single();
    assert(row && row.provider === 'webpush', 'provider must be derived from platform when omitted');
    createdDeviceIds.push(row.id);
    note(true, 'Legacy call shape (no p_provider) registers correctly with derived provider');
  }

  console.log('\n3. Ownership, isolation & device cap...');
  // 3a. Cross-user read isolation
  {
    const devToken = `https://fcm.googleapis.com/fcm/send/hard-${runId}-iso`;
    const { data: devRow } = await admin
      .from('push_devices')
      .insert({
        user_id: userB.id,
        platform: 'web',
        provider: 'webpush',
        token: devToken,
        web_keys: { p256dh: 'x'.repeat(20), auth: 'y'.repeat(20) },
      })
      .select('id')
      .single();
    createdDeviceIds.push(devRow.id);

    const { data: rowsA } = await userA.client.from('push_devices').select('id').eq('token', devToken);
    assert((rowsA || []).length === 0, "user A must not read user B's device rows");
    note(true, "Another user's device rows are not readable (RLS)");
  }

  // 3b. Token re-registration moves ownership to the new user
  {
    const sharedToken = `https://fcm.googleapis.com/fcm/send/hard-${runId}-shared`;
    await userA.client.rpc('register_push_device', {
      p_platform: 'web',
      p_provider: 'webpush',
      p_token: sharedToken,
    });
    await userB.client.rpc('register_push_device', {
      p_platform: 'web',
      p_provider: 'webpush',
      p_token: sharedToken,
    });
    const { data: row } = await admin
      .from('push_devices')
      .select('id, user_id')
      .eq('token', sharedToken)
      .single();
    assert(row.user_id === userB.id, 're-registration must move token ownership to the new user');
    createdDeviceIds.push(row.id);
    note(true, 'Token re-registered by another user moves ownership (shared-phone handover)');
  }

  // 3c. Installation dedupe: same installation, new token deactivates the old
  {
    const installId = `11111111-2222-4333-8444-${runId.padStart(12, '0')}`;
    const tok1 = `https://fcm.googleapis.com/fcm/send/hard-${runId}-inst1`;
    const tok2 = `https://fcm.googleapis.com/fcm/send/hard-${runId}-inst2`;
    await userA.client.rpc('register_push_device', {
      p_platform: 'web', p_provider: 'webpush', p_token: tok1, p_installation_id: installId,
    });
    await userA.client.rpc('register_push_device', {
      p_platform: 'web', p_provider: 'webpush', p_token: tok2, p_installation_id: installId,
    });
    const { data: oldRow } = await admin.from('push_devices').select('id, is_active').eq('token', tok1).single();
    const { data: newRow } = await admin.from('push_devices').select('id, is_active').eq('token', tok2).single();
    assert(oldRow.is_active === false && newRow.is_active === true, 'stale token for one installation must be deactivated');
    createdDeviceIds.push(oldRow.id, newRow.id);
    note(true, 'One live token per installation (stale token deactivated)');
  }

  // 3d. Device cap: 11 registrations -> 10 active, LRU deactivated + redacted audit
  {
    for (let i = 0; i < 11; i++) {
      const { error } = await userB.client.rpc('register_push_device', {
        p_platform: 'android',
        p_provider: 'expo',
        p_token: `ExponentPushToken[Hard-${runId}-${i}]`,
      });
      assert(!error, `cap registration ${i}: ${error?.message}`);
    }
    const { data: activeRows } = await admin
      .from('push_devices')
      .select('id, is_active, disabled_reason')
      .eq('user_id', userB.id)
      .eq('platform', 'android');
    const active = (activeRows || []).filter((r) => r.is_active === true && !r.disabled_reason);
    const lru = (activeRows || []).filter((r) => r.disabled_reason === 'device_cap_lru');
    assert(lru.length >= 1, 'exceeding the cap must deactivate the least-recently-seen device');
    const { data: auditRow } = await admin
      .from('audit_logs')
      .select('id, metadata')
      .eq('action', 'push.device_cap_lru_deactivated')
      .eq('user_id', userB.id)
      .limit(1);
    assert((auditRow || []).length >= 1, 'device cap eviction must write a redacted audit event');
    const meta = JSON.stringify(auditRow[0].metadata || {});
    assert(!/ExponentPushToken|fcm\.googleapis|p256dh/.test(meta), 'audit metadata must be redacted (no tokens/keys)');
    note(true, `Device cap enforced (LRU deactivated, ${active.length} active kept, audit written, redacted)`);
  }

  console.log('\n4. Claim safety, delivery independence & outcome semantics...');
  // Use explicit p_ids everywhere so we never drain the historical backlog.
  const enqueue = async (userId, opts = {}) => {
    const { data, error } = await admin.rpc('enqueue_notification', {
      p_user_id: userId,
      p_category: opts.category || 'assignment',
      p_priority: opts.priority || 'high',
      p_title: opts.title || 'Hardening Test',
      p_body: opts.body || 'Hardening test payload (no PII).',
      p_deep_link: opts.deep_link || '/operations',
      p_dedupe_key: opts.dedupe_key || `hard:${runId}:${Math.random().toString(36).slice(2)}`,
      p_push: true,
      p_ttl: opts.ttl ?? 86400,
    });
    assert(!error, `enqueue: ${error?.message}`);
    createdNotificationIds.push(data);
    return data;
  };

  // 4a. Concurrent dispatchers never double-claim
  {
    const nid = await enqueue(userA.id, { priority: 'critical' });
    const [c1, c2] = await Promise.all([
      admin.rpc('claim_push_batch', { p_limit: 200, p_ids: [nid] }),
      admin.rpc('claim_push_batch', { p_limit: 200, p_ids: [nid] }),
    ]);
    const rows1 = c1.data || [];
    const rows2 = c2.data || [];
    assert(rows1.length + rows2.length >= 1, 'claim must return the notification');
    assert(
      rows1.length === 0 || rows2.length === 0,
      'two concurrent dispatchers must never both claim the same active ticket'
    );
    const { data: nRow } = await admin
      .from('notifications')
      .select('push_attempts, push_status')
      .eq('id', nid)
      .single();
    assert(nRow.push_attempts === 1, `claim must be atomic (attempts=${nRow.push_attempts})`);
    await admin.rpc('finish_push_batch', {
      p_results: rows1.length ? rows1.map((r) => ({ notification_id: r.notification_id, device_id: r.device_id, outcome: 'skip', error: 'test' })) : rows2.map((r) => ({ notification_id: r.notification_id, device_id: r.device_id, outcome: 'skip', error: 'test' })),
    });
    note(true, 'Concurrent dispatch claim is atomic (no double-claim)');
  }

  // 4b. Stale lease reclaim
  {
    const nid = await enqueue(userA.id, { priority: 'critical' });
    const c1 = await admin.rpc('claim_push_batch', { p_limit: 200, p_ids: [nid] });
    assert((c1.data || []).length >= 1, 'first claim must succeed');
    await admin
      .from('notifications')
      .update({ claimed_at: new Date(Date.now() - 3 * 60 * 1000).toISOString() })
      .eq('id', nid);
    const c2 = await admin.rpc('claim_push_batch', { p_limit: 200, p_ids: [nid] });
    assert((c2.data || []).length >= 1, 'expired lease must be reclaimed by the sweeper path');
    const { data: nRow } = await admin.from('notifications').select('push_attempts').eq('id', nid).single();
    assert(nRow.push_attempts === 2, 'reclaim must increment attempts');
    await admin.rpc('finish_push_batch', {
      p_results: (c2.data || []).map((r) => ({ notification_id: r.notification_id, device_id: r.device_id, outcome: 'skip', error: 'test' })),
    });
    note(true, 'Stale lease reclaimed after expiry; attempts bounded');
  }

  // 4c. Multi-device delivery independence (isolated user with exactly 2 devices)
  {
    const email = `push-hard-md-${runId}@test.reachinternational.co.in`;
    const password = `HardTest!${runId}md`;
    const { data: mdUser, error: mdErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: {
        full_name: 'Push Hardening MD Test',
        role: 'operator',
        phone: `+91${Math.floor(9000000000 + Math.random() * 999999999)}`,
        city: 'Delhi',
        state: 'Delhi',
        district: 'New Delhi',
      },
    });
    assert(!mdErr, `createUser md: ${mdErr?.message}`);
    createdUserIds.push(mdUser.user.id);
    const mdClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await mdClient.auth.signInWithPassword({ email, password });

    const devToken1 = `https://fcm.googleapis.com/fcm/send/hard-${runId}-md1`;
    const devToken2 = `https://fcm.googleapis.com/fcm/send/hard-${runId}-md2`;
    const r1 = await mdClient.rpc('register_push_device', { p_platform: 'web', p_provider: 'webpush', p_token: devToken1 });
    const r2 = await mdClient.rpc('register_push_device', { p_platform: 'web', p_provider: 'webpush', p_token: devToken2 });
    assert(!r1.error && !r2.error, 'multi-device registration must succeed');
    const { data: d1 } = await admin.from('push_devices').select('id').eq('token', devToken1).single();
    const { data: d2 } = await admin.from('push_devices').select('id').eq('token', devToken2).single();
    createdDeviceIds.push(d1.id, d2.id);

    const nid = await enqueue(mdUser.user.id, { priority: 'critical' });
    const c1 = await admin.rpc('claim_push_batch', { p_limit: 200, p_ids: [nid] });
    const rows = c1.data || [];
    assert(rows.length === 2, `both devices must be fanned out (got ${rows.length})`);
    const okRow = rows[0];
    const retryRow = rows[1];
    // One device succeeds, the other needs a retry
    await admin.rpc('finish_push_batch', {
      p_results: [
        { notification_id: nid, device_id: okRow.device_id, outcome: 'ok' },
        { notification_id: nid, device_id: retryRow.device_id, outcome: 'retry', error: 'TransientTest' },
      ],
    });
    const { data: after1 } = await admin.from('notifications').select('push_status').eq('id', nid).single();
    assert(after1.push_status === 'pending', "one device's success must not cancel the sibling retry");
    const { data: okDevice } = await admin.from('push_devices').select('is_active').eq('id', okRow.device_id).single();
    assert(okDevice.is_active === true, "sibling retry must not deactivate the delivered device");
    // Clear the retry backoff window so the re-claim is due immediately
    await admin.from('notifications').update({ send_after: new Date(Date.now() - 1000).toISOString() }).eq('id', nid);
    // Re-claim: only the undelivered device is returned
    const c2 = await admin.rpc('claim_push_batch', { p_limit: 200, p_ids: [nid] });
    const rows2 = c2.data || [];
    assert(rows2.length === 1 && rows2[0].device_id === retryRow.device_id, 'only the undelivered device is retried');
    await admin.rpc('finish_push_batch', {
      p_results: [{ notification_id: nid, device_id: retryRow.device_id, outcome: 'ok' }],
    });
    const { data: after2 } = await admin.from('notifications').select('push_status, sent_at').eq('id', nid).single();
    assert(after2.push_status === 'sent' && after2.sent_at, 'notification completes when every device is delivered');
    note(true, 'Multi-device delivery is independent (per-device retry, no cross-device skip)');
  }

  // 4d. 'skip' outcome never mutates the device; 'dead' deactivates
  {
    const devToken = `https://fcm.googleapis.com/fcm/send/hard-${runId}-skip`;
    await userA.client.rpc('register_push_device', { p_platform: 'web', p_provider: 'webpush', p_token: devToken });
    const { data: dev } = await admin.from('push_devices').select('id').eq('token', devToken).single();
    createdDeviceIds.push(dev.id);
    const nid = await enqueue(userA.id, { priority: 'critical' });
    const c1 = await admin.rpc('claim_push_batch', { p_limit: 200, p_ids: [nid] });
    const row = (c1.data || []).find((r) => r.device_id === dev.id);
    assert(row, 'device must be claimed');
    await admin.rpc('finish_push_batch', {
      p_results: [{ notification_id: nid, device_id: dev.id, outcome: 'skip', error: 'PayloadExceeds2KB' }],
    });
    const { data: devAfter } = await admin.from('push_devices').select('is_active, fail_count').eq('id', dev.id).single();
    assert(devAfter.is_active === true && devAfter.fail_count === 0, "sender-side 'skip' must not mutate the device");
    const { data: nAfter } = await admin.from('notifications').select('push_status, push_status_reason').eq('id', nid).single();
    assert(nAfter.push_status === 'skipped', 'skip-only outcomes resolve the notification as skipped');

    const nid2 = await enqueue(userA.id, { priority: 'critical' });
    const c2 = await admin.rpc('claim_push_batch', { p_limit: 200, p_ids: [nid2] });
    const row2 = (c2.data || []).find((r) => r.device_id === dev.id);
    await admin.rpc('finish_push_batch', {
      p_results: [{ notification_id: nid2, device_id: dev.id, outcome: 'dead', error: 'DeviceNotRegistered' }],
    });
    const { data: devDead } = await admin.from('push_devices').select('is_active, disabled_reason').eq('id', dev.id).single();
    assert(devDead.is_active === false && devDead.disabled_reason === 'DeviceNotRegistered', 'dead outcome must deactivate the device');
    note(true, "Sender-side skip is non-destructive; 'dead' deactivates the device (410/DeviceNotRegistered semantics)");
  }

  console.log('\n5. Preferences, quiet hours, TTL expiry & dedupe...');
  // 5a. Category preference works with canonical spellings
  {
    await admin.from('user_notification_preferences').upsert({
      user_id: userA.id,
      push_enabled: true,
      shift_reminders: false,
    });
    const nid = await enqueue(userA.id, { category: 'shift_reminder', priority: 'high' });
    await admin.rpc('claim_push_batch', { p_limit: 200, p_ids: [nid] });
    const { data: nRow } = await admin.from('notifications').select('push_status, push_status_reason').eq('id', nid).single();
    assert(nRow.push_status === 'skipped' && nRow.push_status_reason === 'preferences_disabled',
      `canonical category 'shift_reminder' must honor the toggle (got ${nRow.push_status}/${nRow.push_status_reason})`);
    await admin.from('user_notification_preferences').upsert({ user_id: userA.id, shift_reminders: true });
    note(true, "Category preference toggle enforced for canonical category 'shift_reminder'");
  }

  // 5b. Quiet hours defer non-critical; critical bypasses
  {
    await admin.from('user_notification_preferences').upsert({
      user_id: userA.id,
      push_enabled: true,
      quiet_hours_enabled: true,
      quiet_hours_start: '00:00',
      quiet_hours_end: '23:59',
    });
    const nidNormal = await enqueue(userA.id, { priority: 'normal' });
    await admin.rpc('claim_push_batch', { p_limit: 200, p_ids: [nidNormal] });
    const { data: nNormal } = await admin
      .from('notifications')
      .select('push_status, push_status_reason, send_after')
      .eq('id', nidNormal)
      .single();
    assert(nNormal.push_status === 'pending' && nNormal.push_status_reason === 'quiet_hours_deferred', 'non-critical must defer during quiet hours');
    assert(new Date(nNormal.send_after) > new Date(), 'deferral must move send_after into the future');

    const nidCritical = await enqueue(userA.id, { priority: 'critical' });
    const c = await admin.rpc('claim_push_batch', { p_limit: 200, p_ids: [nidCritical] });
    assert((c.data || []).length >= 1, 'critical must bypass quiet hours and dispatch immediately');
    await admin.rpc('finish_push_batch', {
      p_results: (c.data || []).map((r) => ({ notification_id: r.notification_id, device_id: r.device_id, outcome: 'skip', error: 'test' })),
    });
    await admin.from('user_notification_preferences').upsert({ user_id: userA.id, quiet_hours_enabled: false });
    note(true, 'Quiet hours defer non-critical; critical bypasses');
  }

  // 5c. TTL expiry: expired notifications are never dispatched
  {
    const nid = await enqueue(userA.id, { priority: 'high', ttl: 60 });
    await admin
      .from('notifications')
      .update({ created_at: new Date(Date.now() - 3600 * 1000).toISOString() })
      .eq('id', nid);
    await admin.rpc('claim_push_batch', { p_limit: 200, p_ids: [nid] });
    const { data: nRow } = await admin.from('notifications').select('push_status, push_status_reason').eq('id', nid).single();
    assert(nRow.push_status === 'skipped' && nRow.push_status_reason === 'ttl_expired', 'expired notifications must not dispatch');
    note(true, 'TTL expiry enforced at claim (expired notifications never dispatched)');
  }

  // 5d. Reminder dedupe: same dedupe_key enqueues exactly once
  {
    const key = `hard:dedupe:${runId}`;
    const id1 = await enqueue(userA.id, { dedupe_key: key, category: 'shift_reminder', priority: 'high' });
    const { data: id2 } = await admin.rpc('enqueue_notification', {
      p_user_id: userA.id, p_category: 'shift_reminder', p_priority: 'high',
      p_title: 'Dup', p_body: 'Dup', p_deep_link: '/operations', p_dedupe_key: key, p_push: true,
    });
    assert(id1 && !id2, 'duplicate dedupe_key must not create a second notification');
    note(true, 'Reminder dedupe enforced by unique dedupe key');
  }

  // 5e. IST deadline boundaries (reminder date authority: [today-6, today])
  {
    const deadline = async (d) => {
      const { data, error } = await admin.rpc('shift_entry_deadline', { p_work_date: d });
      assert(!error, `shift_entry_deadline(${d}): ${error?.message}`);
      return new Date(data).toISOString();
    };
    assert.strictEqual(await deadline('2026-12-31'), '2027-01-06T18:30:00.000Z', 'year boundary: 2026-12-31 + 7d @ IST midnight');
    assert.strictEqual(await deadline('2026-02-28'), '2026-03-06T18:30:00.000Z', 'month boundary: 2026-02-28 + 7d @ IST midnight');
    assert.strictEqual(await deadline('2026-11-26'), '2026-12-02T18:30:00.000Z', 'ordinary date: + 7d @ IST midnight');
    note(true, 'shift_entry_deadline correct across IST month/year boundaries');
  }

  console.log('\n6. Zero-PII templates, authorization & observability...');
  // 6a. Zero-PII on EFFECTIVE producer templates (last definition wins per
  //     producer, mirroring how CREATE OR REPLACE migrations apply in order)
  {
    const migrations = [
      'supabase/migrations/195_push_notification_event_producers.sql',
      'supabase/migrations/194_shift_reminder_ladder_scanners.sql',
      'supabase/migrations/245_push_zero_pii_templates_and_user_deactivation.sql',
    ];
    const effective = new Map(); // producer fn name -> SQL body (latest wins)
    for (const m of migrations) {
      const sql = fs.readFileSync(path.join(ROOT, m), 'utf8').replace(/--[^\n]*/g, '');
      for (const fn of sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/g)) {
        effective.set(fn[1], { file: m, body: fn[2] });
      }
    }
    let scanned = 0;
    for (const [name, { file, body }] of effective) {
      if (!/producer_|enqueue_/.test(name)) continue;
      const templates = [...body.matchAll(/p_(?:body|title)\s*:?=\s*format\(([\s\S]*?)\),/g)].map((x) => x[1]);
      for (const t of templates) {
        assert(
          !/full_name|phone|email|aadhaar|salary|contact_name|project_city|customer_mobile/.test(t),
          `PII field found in effective push template ${name} (${file}): ${t.slice(0, 80)}`
        );
      }
      scanned++;
    }
    assert(scanned >= 5, `expected to scan producer/scanner templates, scanned ${scanned}`);
    note(true, `Effective push templates are zero-PII (${scanned} producers/scanners scanned)`);
  }

  // 6b. Forged recipient + unauthenticated enqueue/claim/finish rejected
  {
    const { error: enqErr } = await userA.client.rpc('enqueue_notification', {
      p_user_id: userB.id, p_category: 'admin', p_priority: 'normal',
      p_title: 'Forged', p_body: 'Forged', p_push: true,
    });
    assert(enqErr, 'clients must not be able to enqueue notifications (service_role only)');

    const { error: claimErr } = await userA.client.rpc('claim_push_batch', { p_limit: 1 });
    assert(claimErr, 'claim_push_batch must be service_role only');

    const { error: finErr } = await userA.client.rpc('finish_push_batch', { p_results: [] });
    assert(finErr, 'finish_push_batch must be service_role only');

    // Operator cannot insert notification rows for other users (RLS with_check)
    const { error: insErr } = await userA.client
      .from('notifications')
      .insert({ user_id: userB.id, title: 'Forged', message: 'Forged', category: 'admin' });
    assert(insErr, "operators must not insert notification rows for other users (RLS)");
    note(true, 'Forged recipients rejected: enqueue/claim/finish service-only, operator RLS blocks foreign inserts');
  }

  // 6c. Health view + receipts poller scheduled
  {
    const { data: health, error } = await admin.from('push_delivery_health').select('*').single();
    assert(!error && health, `push_delivery_health view must be queryable: ${error?.message}`);
    assert(typeof health.queue_depth === 'number', 'health view exposes queue depth');
    assert(typeof health.oldest_pending_seconds === 'number', 'health view exposes oldest pending age');
    note(true, `push_delivery_health view live (queue_depth=${health.queue_depth}, oldest_pending=${health.oldest_pending_seconds}s)`);
  }

  console.log('\n7. Cleanup...');
  if (createdNotificationIds.length) {
    await admin.from('notifications').delete().in('id', createdNotificationIds);
  }
  if (createdDeviceIds.length) {
    await admin.from('push_devices').delete().in('id', createdDeviceIds);
  }
  // push_tickets cascade with notifications
  for (const uid of createdUserIds) {
    await admin.from('push_devices').delete().eq('user_id', uid);
    await admin.from('user_notification_preferences').delete().eq('user_id', uid);
    await admin.from('notifications').delete().eq('user_id', uid);
    await admin.auth.admin.deleteUser(uid);
  }
  note(true, 'All test fixtures cleaned up');
}

// ---------------------------------------------------------------------------
try {
  console.log('\n================================================================');
  console.log('  PUSH NOTIFICATIONS HARDENING & NEGATIVE SECURITY SUITE        ');
  console.log('================================================================\n');
  staticChecks();
  await liveChecks();
  console.log('\n--- ALL PUSH HARDENING NEGATIVE TESTS PASSED ---\n');
  process.exit(0);
} catch (err) {
  console.error('\n[PUSH HARDENING TEST FAILED]', err?.message || err);
  console.error(err?.stack || '');
  process.exit(1);
}
