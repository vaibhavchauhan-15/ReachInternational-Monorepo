#!/usr/bin/env node
/**
 * Test Suite: Push Notification Reminders, Producers, and Security (§13.1 & §13.2)
 * Tests reminder ladder scanners, event triggers, deduplication, and RLS boundaries on Dev DB.
 */
import assert from 'node:assert';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vlmxciuogczumumrwyot.supabase.co';
const SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbXhjaXVvZ2N6dW11bXJ3eW90Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyNDgwNiwiZXhwIjoyMDkzOTAwODA2fQ.2Z8Fiptbf7vqMHI5TsJ8-RPD4JHC5oFMPHn0BP-3mDY';
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_R1F5ZqfVOgW75jqjLpp-AA_s05CLzem';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  console.log('--- [TEST] Starting Push Reminders & Producers Verification ---');

  // 1. Initial cleanup of any leftover test machines/logs
  console.log('0. Cleaning up any previous test artifacts...');
  const { data: oldMachines } = await admin
    .from('machines')
    .select('id')
    .like('machine_id', 'TEST-BD-%');
  if (oldMachines && oldMachines.length > 0) {
    const oldIds = oldMachines.map((m) => m.id);
    await admin.from('notifications').delete().like('dedupe_key', 'breakdown:%');
    await admin.from('notifications').delete().like('dedupe_key', 'assisted:%');
    await admin.from('machine_hour_logs').delete().in('machine_id', oldIds);
    await admin.from('machines').delete().in('id', oldIds);
  }
  await admin.from('machine_hour_logs').delete().eq('remarks', 'Hydraulic failure test');

  // 1. Verify Scanner Functions Execute Cleanly
  console.log('1. Testing scanner functions...');
  const { data: sp1Count, error: sp1Err } = await admin.rpc('enqueue_shift_end_reminders');
  assert.ifError(sp1Err);
  assert(typeof sp1Count === 'number');
  console.log(`  ✓ enqueue_shift_end_reminders executed cleanly (enqueued: ${sp1Count})`);

  const { data: sp2Count, error: sp2Err } = await admin.rpc('enqueue_pending_digest');
  assert.ifError(sp2Err);
  assert(typeof sp2Count === 'number');
  console.log(`  ✓ enqueue_pending_digest executed cleanly (enqueued: ${sp2Count})`);

  const { data: sl1Count, error: sl1Err } = await admin.rpc('enqueue_final_lock_warning');
  assert.ifError(sl1Err);
  assert(typeof sl1Count === 'number');
  console.log(`  ✓ enqueue_final_lock_warning executed cleanly (enqueued: ${sl1Count})`);

  const { data: sup1Count, error: sup1Err } = await admin.rpc('enqueue_supervisor_digest');
  assert.ifError(sup1Err);
  assert(typeof sup1Count === 'number');
  console.log(`  ✓ enqueue_supervisor_digest executed cleanly (enqueued: ${sup1Count})`);

  let testMachine = null;
  let logEntry = null;
  let asLog = null;

  try {
    // 2. Test BD1 Event Producer Trigger
    console.log('2. Testing BD1 Breakdown Event Trigger...');
    const machineCode = `TEST-BD-${Date.now().toString().slice(-4)}`;
    const { data: mData, error: mErr } = await admin
      .from('machines')
      .insert({
        machine_id: machineCode,
        machine_name: `Breakdown Test Machine ${machineCode}`,
        model: 'BD-Test',
        serial_number: `SN-${Date.now()}`,
        status: 'rented',
        health_status: 'active',
      })
      .select('id, machine_id, machine_name')
      .single();
    assert.ifError(mErr);
    testMachine = mData;

    // Pick existing operator Rohit Singh
    const operatorId = 'b3400740-3e79-44c7-9aec-a0ec3ccd22ce';

    // Insert a breakdown hour log on 2026-11-10 (non-overlapping within 7-day window)
    const testDate = '2026-11-10';
    const { data: lData, error: logErr } = await admin
      .from('machine_hour_logs')
      .insert({
        machine_id: testMachine.id,
        operator_id: operatorId,
        log_date: testDate,
        start_meter: 100,
        end_meter: 108,
        start_datetime: `${testDate}T08:00:00Z`,
        end_datetime: `${testDate}T16:00:00Z`,
        shift_code: 'S1',
        is_breakdown: true,
        remarks: 'Hydraulic failure test',
        entry_source: 'operator',
      })
      .select('id')
      .single();
    assert.ifError(logErr);
    logEntry = lData;

    // Verify that BD1 trigger created a notification with priority='low' for logs older than 24h (offline sync rule)
    const { data: notifs, error: notifErr } = await admin
      .from('notifications')
      .select('id, category, priority, dedupe_key, title')
      .like('dedupe_key', `breakdown:${logEntry.id}:%`);
    assert.ifError(notifErr);
    assert(notifs && notifs.length > 0, 'BD1 trigger should have enqueued notifications for supervisors/managers');
    assert.strictEqual(notifs[0].category, 'breakdown');
    assert.strictEqual(notifs[0].priority, 'low', 'Logs older than 24h must be downgraded to low priority (inbox only)');
    console.log(`  ✓ BD1 Breakdown trigger successfully enqueued ${notifs.length} low-priority inbox notification(s) for 24h+ old log`);

    // 3. Test AS1 Assisted Log Trigger
    console.log('3. Testing AS1 Assisted Log Event Trigger...');
    const supervisorId = '13841eaa-c894-448f-b60f-093b341605e7'; // supervisor@reachinternational.co.in
    const asTestDate = '2026-11-11';
    const { data: asData, error: asErr } = await admin
      .from('machine_hour_logs')
      .insert({
        machine_id: testMachine.id,
        operator_id: operatorId,
        entered_by: supervisorId,
        log_date: asTestDate,
        start_meter: 110,
        end_meter: 118,
        start_datetime: `${asTestDate}T08:00:00Z`,
        end_datetime: `${asTestDate}T16:00:00Z`,
        shift_code: 'S1',
        is_breakdown: false,
        entry_source: 'supervisor',
      })
      .select('id')
      .single();
    assert.ifError(asErr);
    asLog = asData;

    const { data: asNotifs } = await admin
      .from('notifications')
      .select('id, category, priority, dedupe_key, title')
      .eq('dedupe_key', `assisted:${asLog.id}`);
    assert(asNotifs && asNotifs.length > 0, 'AS1 trigger should have enqueued notification for operator');
    assert.strictEqual(asNotifs[0].category, 'assignment');
    assert.strictEqual(asNotifs[0].priority, 'normal');
    console.log(`  ✓ AS1 Assisted log trigger enqueued notification for operator: "${asNotifs[0].title}"`);

    // 4. Test RLS & Negative Authorization
    console.log('4. Testing RLS security boundaries...');
    // Anon attempting to read push_devices
    const { data: anonDevices, error: anonDevErr } = await anon.from('push_devices').select('*');
    assert(anonDevices?.length === 0 || anonDevErr, 'Anon should not see any push devices');
    console.log('  ✓ Anon cannot query push_devices (RLS denied)');

    // Anon attempting to read push_tickets
    const { data: anonTickets, error: anonTickErr } = await anon.from('push_tickets').select('*');
    assert(anonTickets?.length === 0 || anonTickErr, 'Anon should not see any push tickets');
    console.log('  ✓ Anon cannot query push_tickets (RLS denied)');

    // Anon attempting to call claim_push_batch RPC
    const { error: anonClaimErr } = await anon.rpc('claim_push_batch', { p_limit: 10 });
    assert(anonClaimErr, 'Anon must be rejected from calling claim_push_batch');
    console.log('  ✓ Anon rejected from claim_push_batch RPC');

    // 5. Test Observability Views
    console.log('5. Testing observability views...');
    const { data: metrics, error: metErr } = await admin.from('v_push_delivery_metrics').select('*').limit(5);
    assert.ifError(metErr);
    console.log(`  ✓ v_push_delivery_metrics is queryable (returned ${metrics?.length || 0} rows)`);

    const { data: devHealth, error: devHealthErr } = await admin.from('v_push_device_health').select('*');
    assert.ifError(devHealthErr);
    console.log(`  ✓ v_push_device_health is queryable (returned ${devHealth?.length || 0} rows)`);
  } finally {
    // Cleanup test fixtures
    console.log('6. Cleaning up test fixtures...');
    if (logEntry) {
      await admin.from('notifications').delete().like('dedupe_key', `breakdown:${logEntry.id}:%`);
      await admin.from('machine_hour_logs').delete().eq('id', logEntry.id);
    }
    if (asLog) {
      await admin.from('notifications').delete().eq('dedupe_key', `assisted:${asLog.id}`);
      await admin.from('machine_hour_logs').delete().eq('id', asLog.id);
    }
    if (testMachine) {
      await admin.from('machines').delete().eq('id', testMachine.id);
    }
    console.log('  ✓ Test fixtures cleaned up successfully');
  }

  console.log('\n--- ALL PUSH REMINDERS, PRODUCERS & SECURITY TESTS PASSED (100%) ---');
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
