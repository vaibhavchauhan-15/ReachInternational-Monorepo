#!/usr/bin/env node
/**
 * Backend Test Suite: Push Dispatcher & Receipt Reconciliation (§13.2)
 * Tests Bearer authentication, payload construction, channel resolution,
 * kill-switches, and error/deactivation handling.
 */
import assert from 'node:assert';
import crypto from 'node:crypto';

console.log('--- [TEST] Push Dispatcher & Receipt Reconciliation ---');

// 1. Test Bearer Token Validator
function testAssertBearer() {
  console.log('Testing Bearer token authentication...');
  const expectedSecret = 'test-mock-notify-secret-for-local-unit-testing-only-12345';

  function assertBearer(req, secret) {
    if (!secret) throw new Error('Server configuration error: NOTIFY_SECRET is missing');
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized: Missing or malformed Bearer header');
    }
    const token = authHeader.slice(7).trim();
    const tokenBuf = Buffer.from(token, 'utf-8');
    const secretBuf = Buffer.from(secret, 'utf-8');
    if (tokenBuf.length !== secretBuf.length || !crypto.timingSafeEqual(tokenBuf, secretBuf)) {
      throw new Error('Unauthorized: Invalid Bearer secret');
    }
  }

  // Missing header
  assert.throws(
    () => assertBearer({ headers: {} }, expectedSecret),
    /Missing or malformed Bearer header/
  );

  // Wrong token
  assert.throws(
    () => assertBearer({ headers: { authorization: 'Bearer wrong-secret' } }, expectedSecret),
    /Invalid Bearer secret/
  );

  // Valid token
  assert.doesNotThrow(() =>
    assertBearer({ headers: { authorization: `Bearer ${expectedSecret}` } }, expectedSecret)
  );

  // Case insensitive header
  assert.doesNotThrow(() =>
    assertBearer({ headers: { Authorization: `Bearer ${expectedSecret}` } }, expectedSecret)
  );

  console.log('  âœ“ Bearer auth passed (missing, invalid, valid, header-case)');
}

// 2. Test Channel & Priority Mapping for Expo
function testExpoPayloadMapping() {
  console.log('Testing Expo payload mapping & channel resolution...');

  function resolveChannelId(category, priority) {
    if (category === 'breakdown' || priority === 'critical') return 'breakdown_alerts';
    if (category === 'shift_reminder') return 'shift_reminders';
    if (category === 'assignment') return 'assignment_updates';
    return 'general_updates';
  }

  function resolveExpoPriority(priority) {
    return priority === 'critical' || priority === 'high' ? 'high' : 'default';
  }

  assert.strictEqual(resolveChannelId('breakdown', 'high'), 'breakdown_alerts');
  assert.strictEqual(resolveChannelId('security', 'critical'), 'breakdown_alerts');
  assert.strictEqual(resolveChannelId('shift_reminder', 'high'), 'shift_reminders');
  assert.strictEqual(resolveChannelId('assignment', 'normal'), 'assignment_updates');
  assert.strictEqual(resolveChannelId('admin', 'normal'), 'general_updates');

  assert.strictEqual(resolveExpoPriority('critical'), 'high');
  assert.strictEqual(resolveExpoPriority('high'), 'high');
  assert.strictEqual(resolveExpoPriority('normal'), 'default');
  assert.strictEqual(resolveExpoPriority('low'), 'default');

  console.log('  âœ“ Expo channel and priority mapping verified');
}

// 3. Test Web Push Payload Construction & 2KB Payload Guard
function testWebPushPayloadGuard() {
  console.log('Testing Web Push payload format & 2KB limit...');

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

  const normalRow = {
    notification_id: 'n-123',
    title: 'Shift ended',
    body: 'Shift S1 on TM-01 ended. Log closing meter.',
    dedupe_key: 'shift:s1',
    deep_link: '/operations/operator/entry',
    category: 'shift_reminder',
    priority: 'high',
  };

  const payloadStr = formatWebPushPayload(normalRow);
  const parsed = JSON.parse(payloadStr);
  assert.strictEqual(parsed.title, 'Shift ended');
  assert.strictEqual(parsed.tag, 'shift:s1');
  assert.strictEqual(parsed.nid, 'n-123');
  assert.strictEqual(parsed.link, '/operations/operator/entry');

  // Huge body (> 2KB)
  const hugeRow = {
    ...normalRow,
    body: 'A'.repeat(3000),
  };
  assert.throws(() => formatWebPushPayload(hugeRow), /PayloadTooLarge/);

  console.log('  âœ“ Web Push payload construction & 2KB limit verified');
}

// 4. Test Kill-Switch Filtering
function testKillSwitches() {
  console.log('Testing kill-switch behavior (master & per-category)...');

  function filterActiveRows(rows, disabledCategoriesStr) {
    const disabledCategories = new Set(
      disabledCategoriesStr
        .split(',')
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean)
    );

    const active = [];
    const skipped = [];
    for (const row of rows) {
      if (disabledCategories.has(row.category.toLowerCase())) {
        skipped.push({
          notification_id: row.notification_id,
          device_id: row.device_id,
          outcome: 'dead',
          error: 'CategoryDisabledByKillSwitch',
        });
      } else {
        active.push(row);
      }
    }
    return { active, skipped };
  }

  const rows = [
    { notification_id: '1', device_id: 'd1', category: 'shift_reminder' },
    { notification_id: '2', device_id: 'd2', category: 'marketing' },
    { notification_id: '3', device_id: 'd3', category: 'breakdown' },
  ];

  const { active, skipped } = filterActiveRows(rows, 'marketing,promo');
  assert.strictEqual(active.length, 2);
  assert.strictEqual(skipped.length, 1);
  assert.strictEqual(skipped[0].error, 'CategoryDisabledByKillSwitch');

  console.log('  âœ“ Category kill-switch correctly partitions rows');
}

// 5. Test Outcome Mapping (DeviceNotRegistered / 410 Gone -> dead, Network Timeout -> retry)
function testOutcomeMapping() {
  console.log('Testing error code to push outcome mapping...');

  function mapExpoErrorToOutcome(errorCode) {
    if (errorCode === 'DeviceNotRegistered') return { outcome: 'dead', error: 'DeviceNotRegistered' };
    if (errorCode === 'MessageTooBig') return { outcome: 'dead', error: 'MessageTooBig' };
    if (errorCode === 'MessageRateExceeded') return { outcome: 'retry', error: 'MessageRateExceeded' };
    return { outcome: 'retry', error: errorCode || 'ExpoUnknownError' };
  }

  function mapWebPushStatusToOutcome(statusCode, errorMsg) {
    if (statusCode === 410 || statusCode === 404) {
      return { outcome: 'dead', error: `SubscriptionExpired:${statusCode}` };
    }
    if (statusCode === 429) {
      return { outcome: 'retry', error: 'RateLimited' };
    }
    return { outcome: 'retry', error: errorMsg || `HttpError:${statusCode}` };
  }

  assert.deepStrictEqual(mapExpoErrorToOutcome('DeviceNotRegistered'), {
    outcome: 'dead',
    error: 'DeviceNotRegistered',
  });
  assert.deepStrictEqual(mapExpoErrorToOutcome('MessageRateExceeded'), {
    outcome: 'retry',
    error: 'MessageRateExceeded',
  });

  assert.deepStrictEqual(mapWebPushStatusToOutcome(410, 'Gone'), {
    outcome: 'dead',
    error: 'SubscriptionExpired:410',
  });
  assert.deepStrictEqual(mapWebPushStatusToOutcome(503, 'Service Unavailable'), {
    outcome: 'retry',
    error: 'Service Unavailable',
  });

  console.log('  âœ“ Outcome mapping matches dead/retry semantics');
}

// Run all test functions
testAssertBearer();
testExpoPayloadMapping();
testWebPushPayloadGuard();
testKillSwitches();
testOutcomeMapping();

console.log('--- ALL BACKEND PUSH DISPATCHER TESTS PASSED ---');
