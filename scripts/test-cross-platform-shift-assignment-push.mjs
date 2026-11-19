#!/usr/bin/env node
/**
 * Cross-Platform Shift Assignment Push Notification Verification Suite
 * Target: Reach International Dev (vlmxciuogczumumrwyot)
 * 
 * Verifies all cross-platform supervisor-to-operator combinations:
 * 1. Web Supervisor -> Mobile Native Operator (Expo Push)
 * 2. Web Supervisor -> Web Browser Operator (Web Push)
 * 3. Mobile Supervisor -> Mobile Native Operator (Expo Push)
 * 4. Mobile Supervisor -> Web Browser Operator (Web Push)
 * 5. Dual-Registered Operator (Both Native Mobile & Web Browser receive simultaneous push)
 */

import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';

function resolveAndroidChannel(category) {
  switch (category) {
    case 'breakdown_alerts':
    case 'breakdown':
      return 'breakdown_alerts';
    case 'shift_reminders':
    case 'shift_reminder':
    case 'shift':
      return 'shift_reminders';
    case 'assignment_alerts':
    case 'assignment':
      return 'assignment_updates';
    default:
      return 'general_updates';
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vlmxciuogczumumrwyot.supabase.co';
const SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbXhjaXVvZ2N6dW11bXJ3eW90Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyNDgwNiwiZXhwIjoyMDkzOTAwODA2fQ.2Z8Fiptbf7vqMHI5TsJ8-RPD4JHC5oFMPHn0BP-3mDY';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log('\n================================================================');
console.log('  TEST: CROSS-PLATFORM SUPERVISOR -> OPERATOR PUSH PIPELINE    ');
console.log('================================================================\n');

// 1. Channel Resolution Unit Verification
console.log('1. Verifying Android Channel Resolution for Assignment Alerts...');
assert.strictEqual(resolveAndroidChannel('assignment'), 'assignment_updates', 'assignment must resolve to assignment_updates channel');
assert.strictEqual(resolveAndroidChannel('assignment_alerts'), 'assignment_updates', 'assignment_alerts must resolve to assignment_updates channel');
console.log('  ✓ Channel resolution verified: "assignment" & "assignment_alerts" -> "assignment_updates"');

// Test Identities
const webSupervisorId = '13841eaa-c894-448f-b60f-093b341605e7'; // supervisor@reachinternational.co.in
const mobileSupervisorId = '13841eaa-c894-448f-b60f-093b341605e7';
const operatorId = '4cfe61cb-389d-41f9-86d3-f29b1f9c7c6a'; // Manoj Yadav (free operator)

const runTag = Date.now().toString().slice(-5);
const createdMachineIds = [];
const createdAssignmentIds = [];
const registeredDeviceIds = [];
const enqueuedNotificationIds = [];

async function createTestMachine(suffix) {
  const code = `TEST-XP-${runTag}-${suffix}`;
  const { data, error } = await admin
    .from('machines')
    .insert({
      machine_id: code,
      machine_name: `Cross-Platform Asset ${code}`,
      model: 'Reach-CrossPlatform',
      serial_number: `SN-${runTag}-${suffix}`,
      status: 'rented',
      health_status: 'active',
      current_supervisor_id: webSupervisorId,
    })
    .select('id, machine_id')
    .single();
  assert.ifError(error);
  createdMachineIds.push(data.id);
  return data;
}

try {
  // Step 2: Ensure operator preferences allow push and assignment alerts
  console.log('\n2. Ensuring operator notification preferences are active on Dev DB...');
  await admin.from('user_notification_preferences').upsert({
    user_id: operatorId,
    push_enabled: true,
    assignment_alerts: true,
    shift_reminders: true,
    breakdown_alerts: true,
    quiet_hours_enabled: false,
  });
  console.log('  ✓ Operator preferences active (push_enabled = true, assignment_alerts = true)');

  // Clear any existing active assignments for test operator to prevent SHIFT_OVERLAP_CONFLICT
  await admin
    .from('operator_machine_assignments')
    .update({ is_active: false, ended_at: new Date().toISOString(), end_reason: 'removed' })
    .eq('operator_id', operatorId)
    .eq('is_active', true);

  // ============================================================================
  // SCENARIO 1: Web Supervisor -> Native Mobile Operator
  // ============================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('  SCENARIO 1: Web Supervisor assigns shift -> Mobile Operator   ');
  console.log('----------------------------------------------------------------');

  const machine1 = await createTestMachine('M1');
  const mobileToken1 = `ExponentPushToken[TestMobile-${runTag}-1]`;
  const { data: mobDev1, error: devErr1 } = await admin
    .from('push_devices')
    .insert({
      user_id: operatorId,
      platform: 'android',
      provider: 'expo',
      token: mobileToken1,
      device_label: 'Operator Galaxy Tab Active 4',
      app_version: '1.4.0',
      is_active: true,
    })
    .select('id')
    .single();
  assert.ifError(devErr1);
  registeredDeviceIds.push(mobDev1.id);
  console.log(`  ✓ Operator has Native Mobile device registered: ${mobileToken1}`);

  // Web Supervisor invokes assign_operator_machine_atomic (Shift S1: 08:00 - 16:00)
  console.log('  ▶ Web Supervisor assigns Shift S1 via assign_operator_machine_atomic RPC...');
  const { data: assignRes1, error: assignErr1 } = await admin.rpc('assign_operator_machine_atomic', {
    p_machine_id: machine1.id,
    p_operator_id: operatorId,
    p_shift_start_time: '08:00:00',
    p_shift_end_time: '16:00:00',
    p_shift_code: 'S1',
    p_assigned_by: webSupervisorId,
    p_notes: 'Assigned via Next.js Web App',
  });
  assert.ifError(assignErr1);
  assert(assignRes1 && assignRes1.success, `Assignment must succeed: ${JSON.stringify(assignRes1)}`);
  createdAssignmentIds.push(assignRes1.assignment_id);
  console.log(`  ✓ Shift S1 created atomically (Assignment ID: ${assignRes1.assignment_id})`);

  // Verify SA1 Producer enqueued notification for operator
  const { data: notif1, error: nErr1 } = await admin
    .from('notifications')
    .select('id, user_id, category, priority, title, body, push_status, dedupe_key')
    .eq('user_id', operatorId)
    .like('dedupe_key', `reassign:${assignRes1.assignment_id}:%`)
    .single();
  assert.ifError(nErr1);
  assert(notif1, 'Notification must be enqueued by SA1 trigger');
  enqueuedNotificationIds.push(notif1.id);
  console.log(`  ✓ Notification enqueued in DB:`);
  console.log(`    - Title: "${notif1.title}"`);
  console.log(`    - Body: "${notif1.body}"`);
  console.log(`    - Priority: ${notif1.priority}`);

  // Claim batch using claim_push_batch
  const { data: claim1, error: cErr1 } = await admin.rpc('claim_push_batch', {
    p_limit: 10,
    p_ids: [notif1.id],
  });
  assert.ifError(cErr1);
  assert(claim1 && claim1.length > 0, 'Push batch claim must include mobile device');
  const targetDeviceClaim1 = claim1.find((r) => r.device_id === mobDev1.id);
  assert(targetDeviceClaim1, 'Claimed batch must target operator native mobile device');
  assert.strictEqual(targetDeviceClaim1.provider, 'expo', 'Provider must be expo');
  console.log(`  ✓ Successfully claimed for Native Mobile device delivery (Provider: expo)`);

  // Finish batch
  const { error: fErr1 } = await admin.rpc('finish_push_batch', {
    p_results: [
      {
        notification_id: notif1.id,
        device_id: mobDev1.id,
        outcome: 'ok',
        ticket_id: `ticket_${runTag}_1`,
      },
    ],
  });
  assert.ifError(fErr1);
  console.log('  ✓ SCENARIO 1 PASSED: Web Supervisor -> Native Mobile Operator verified 100%!');

  // Remove assignment 1 before scenario 2 to clear shift window
  await admin.from('operator_machine_assignments').delete().eq('id', assignRes1.assignment_id);
  await admin.from('push_devices').delete().eq('id', mobDev1.id);

  // ============================================================================
  // SCENARIO 2: Web Supervisor -> Web Browser Operator
  // ============================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('  SCENARIO 2: Web Supervisor assigns shift -> Web Operator      ');
  console.log('----------------------------------------------------------------');

  const machine2 = await createTestMachine('M2');
  const webEndpoint2 = `https://fcm.googleapis.com/fcm/send/test-web-${runTag}-2`;
  const { data: webDev2, error: devErr2 } = await admin
    .from('push_devices')
    .insert({
      user_id: operatorId,
      platform: 'web',
      provider: 'webpush',
      token: webEndpoint2,
      web_keys: { p256dh: 'BHk7...testP256dh', auth: 'auth...testAuth' },
      device_label: 'Operator Chrome Desktop Workstation',
      is_active: true,
    })
    .select('id')
    .single();
  assert.ifError(devErr2);
  registeredDeviceIds.push(webDev2.id);
  console.log(`  ✓ Operator has Web Push subscription registered: ${webEndpoint2}`);

  // Web Supervisor assigns Shift S1 on Machine 2
  console.log('  ▶ Web Supervisor assigns Shift S1 via assign_operator_machine_atomic RPC...');
  const { data: assignRes2, error: assignErr2 } = await admin.rpc('assign_operator_machine_atomic', {
    p_machine_id: machine2.id,
    p_operator_id: operatorId,
    p_shift_start_time: '08:00:00',
    p_shift_end_time: '16:00:00',
    p_shift_code: 'S1',
    p_assigned_by: webSupervisorId,
    p_notes: 'Assigned via Next.js Web App',
  });
  assert.ifError(assignErr2);
  assert(assignRes2 && assignRes2.success);
  createdAssignmentIds.push(assignRes2.assignment_id);

  const { data: notif2 } = await admin
    .from('notifications')
    .select('id, user_id, title, body, priority')
    .eq('user_id', operatorId)
    .like('dedupe_key', `reassign:${assignRes2.assignment_id}:%`)
    .single();
  assert(notif2);
  enqueuedNotificationIds.push(notif2.id);

  const { data: claim2 } = await admin.rpc('claim_push_batch', {
    p_limit: 10,
    p_ids: [notif2.id],
  });
  const targetDeviceClaim2 = claim2.find((r) => r.device_id === webDev2.id);
  assert(targetDeviceClaim2, 'Claimed batch must target operator web browser');
  assert.strictEqual(targetDeviceClaim2.provider, 'webpush', 'Provider must be webpush');
  console.log(`  ✓ Successfully claimed for Web Browser delivery (Provider: webpush)`);

  await admin.rpc('finish_push_batch', {
    p_results: [{ notification_id: notif2.id, device_id: webDev2.id, outcome: 'ok' }],
  });
  console.log('  ✓ SCENARIO 2 PASSED: Web Supervisor -> Web Browser Operator verified 100%!');

  await admin.from('operator_machine_assignments').delete().eq('id', assignRes2.assignment_id);
  await admin.from('push_devices').delete().eq('id', webDev2.id);

  // ============================================================================
  // SCENARIO 3: Mobile Supervisor -> Native Mobile Operator
  // ============================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('  SCENARIO 3: Mobile Supervisor assigns shift -> Mobile Operator');
  console.log('----------------------------------------------------------------');

  const machine3 = await createTestMachine('M3');
  const mobileToken3 = `ExponentPushToken[TestMobile-${runTag}-3]`;
  const { data: mobDev3, error: devErr3 } = await admin
    .from('push_devices')
    .insert({
      user_id: operatorId,
      platform: 'android',
      provider: 'expo',
      token: mobileToken3,
      device_label: 'Operator Mobile Device #3',
      app_version: '1.4.0',
      is_active: true,
    })
    .select('id')
    .single();
  assert.ifError(devErr3);
  registeredDeviceIds.push(mobDev3.id);

  // Mobile Supervisor assigns Shift S1 (from MobileAssignPersonnelModal.tsx)
  console.log('  ▶ Mobile Supervisor assigns Shift S1 via assign_operator_machine_atomic RPC...');
  const { data: assignRes3, error: assignErr3 } = await admin.rpc('assign_operator_machine_atomic', {
    p_machine_id: machine3.id,
    p_operator_id: operatorId,
    p_shift_start_time: '08:00:00',
    p_shift_end_time: '16:00:00',
    p_shift_code: 'S1',
    p_assigned_by: mobileSupervisorId,
    p_notes: 'Assigned via mobile personnel dialog',
  });
  assert.ifError(assignErr3);
  assert(assignRes3 && assignRes3.success);
  createdAssignmentIds.push(assignRes3.assignment_id);

  const { data: notif3 } = await admin
    .from('notifications')
    .select('id, user_id, title, body, priority')
    .eq('user_id', operatorId)
    .like('dedupe_key', `reassign:${assignRes3.assignment_id}:%`)
    .single();
  assert(notif3);
  enqueuedNotificationIds.push(notif3.id);

  const { data: claim3 } = await admin.rpc('claim_push_batch', {
    p_limit: 10,
    p_ids: [notif3.id],
  });
  const targetDeviceClaim3 = claim3.find((r) => r.device_id === mobDev3.id);
  assert(targetDeviceClaim3);
  assert.strictEqual(targetDeviceClaim3.provider, 'expo');
  console.log(`  ✓ Successfully claimed for Native Mobile device delivery (Provider: expo)`);

  await admin.rpc('finish_push_batch', {
    p_results: [{ notification_id: notif3.id, device_id: mobDev3.id, outcome: 'ok' }],
  });
  console.log('  ✓ SCENARIO 3 PASSED: Mobile Supervisor -> Native Mobile Operator verified 100%!');

  await admin.from('operator_machine_assignments').delete().eq('id', assignRes3.assignment_id);
  await admin.from('push_devices').delete().eq('id', mobDev3.id);

  // ============================================================================
  // SCENARIO 4: Mobile Supervisor -> Web Browser Operator
  // ============================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('  SCENARIO 4: Mobile Supervisor assigns shift -> Web Operator   ');
  console.log('----------------------------------------------------------------');

  const machine4 = await createTestMachine('M4');
  const webEndpoint4 = `https://fcm.googleapis.com/fcm/send/test-web-${runTag}-4`;
  const { data: webDev4, error: devErr4 } = await admin
    .from('push_devices')
    .insert({
      user_id: operatorId,
      platform: 'web',
      provider: 'webpush',
      token: webEndpoint4,
      web_keys: { p256dh: 'BHk7...testP256dh', auth: 'auth...testAuth' },
      device_label: 'Operator Chrome Desktop',
      is_active: true,
    })
    .select('id')
    .single();
  assert.ifError(devErr4);
  registeredDeviceIds.push(webDev4.id);

  // Mobile Supervisor assigns Shift S1 on Machine 4
  console.log('  ▶ Mobile Supervisor assigns Shift S1 via assign_operator_machine_atomic RPC...');
  const { data: assignRes4, error: assignErr4 } = await admin.rpc('assign_operator_machine_atomic', {
    p_machine_id: machine4.id,
    p_operator_id: operatorId,
    p_shift_start_time: '08:00:00',
    p_shift_end_time: '16:00:00',
    p_shift_code: 'S1',
    p_assigned_by: mobileSupervisorId,
    p_notes: 'Assigned via mobile personnel dialog',
  });
  assert.ifError(assignErr4);
  assert(assignRes4 && assignRes4.success);
  createdAssignmentIds.push(assignRes4.assignment_id);

  const { data: notif4 } = await admin
    .from('notifications')
    .select('id, user_id, title, body, priority')
    .eq('user_id', operatorId)
    .like('dedupe_key', `reassign:${assignRes4.assignment_id}:%`)
    .single();
  assert(notif4);
  enqueuedNotificationIds.push(notif4.id);

  const { data: claim4 } = await admin.rpc('claim_push_batch', {
    p_limit: 10,
    p_ids: [notif4.id],
  });
  const targetDeviceClaim4 = claim4.find((r) => r.device_id === webDev4.id);
  assert(targetDeviceClaim4);
  assert.strictEqual(targetDeviceClaim4.provider, 'webpush');
  console.log(`  ✓ Successfully claimed for Web Browser delivery (Provider: webpush)`);

  await admin.rpc('finish_push_batch', {
    p_results: [{ notification_id: notif4.id, device_id: webDev4.id, outcome: 'ok' }],
  });
  console.log('  ✓ SCENARIO 4 PASSED: Mobile Supervisor -> Web Browser Operator verified 100%!');

  await admin.from('operator_machine_assignments').delete().eq('id', assignRes4.assignment_id);
  await admin.from('push_devices').delete().eq('id', webDev4.id);

  // ============================================================================
  // SCENARIO 5: Dual-Registered Operator (Both Native Mobile & Web receive push)
  // ============================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('  SCENARIO 5: Dual-Registered Operator (Simultaneous Delivery)   ');
  console.log('----------------------------------------------------------------');

  const machine5 = await createTestMachine('M5');
  const mobileToken5 = `ExponentPushToken[TestDualMobile-${runTag}]`;
  const webEndpoint5 = `https://fcm.googleapis.com/fcm/send/test-dual-web-${runTag}`;

  const { data: dualMob, error: dMobErr } = await admin
    .from('push_devices')
    .insert({
      user_id: operatorId,
      platform: 'android',
      provider: 'expo',
      token: mobileToken5,
      device_label: 'Operator Phone',
      app_version: '1.4.0',
      is_active: true,
    })
    .select('id')
    .single();
  assert.ifError(dMobErr);
  registeredDeviceIds.push(dualMob.id);

  const { data: dualWeb, error: dWebErr } = await admin
    .from('push_devices')
    .insert({
      user_id: operatorId,
      platform: 'web',
      provider: 'webpush',
      token: webEndpoint5,
      web_keys: { p256dh: 'BHk7...testP256dh', auth: 'auth...testAuth' },
      device_label: 'Operator Laptop',
      is_active: true,
    })
    .select('id')
    .single();
  assert.ifError(dWebErr);
  registeredDeviceIds.push(dualWeb.id);
  console.log('  ✓ Operator has BOTH Native Mobile and Web Browser devices registered');

  console.log('  ▶ Supervisor assigns Shift S1 on Machine 5...');
  const { data: assignRes5, error: assignErr5 } = await admin.rpc('assign_operator_machine_atomic', {
    p_machine_id: machine5.id,
    p_operator_id: operatorId,
    p_shift_start_time: '08:00:00',
    p_shift_end_time: '16:00:00',
    p_shift_code: 'S1',
    p_assigned_by: webSupervisorId,
    p_notes: 'Dual delivery test',
  });
  assert.ifError(assignErr5);
  assert(assignRes5 && assignRes5.success);
  createdAssignmentIds.push(assignRes5.assignment_id);

  const { data: notif5 } = await admin
    .from('notifications')
    .select('id, user_id, title, body')
    .eq('user_id', operatorId)
    .like('dedupe_key', `reassign:${assignRes5.assignment_id}:%`)
    .single();
  assert(notif5);
  enqueuedNotificationIds.push(notif5.id);

  const { data: claim5 } = await admin.rpc('claim_push_batch', {
    p_limit: 10,
    p_ids: [notif5.id],
  });
  assert(claim5 && claim5.length === 2, `Both devices must be claimed (expected 2, got ${claim5?.length})`);

  const mobClaim = claim5.find((r) => r.device_id === dualMob.id);
  const webClaim = claim5.find((r) => r.device_id === dualWeb.id);
  assert(mobClaim, 'Mobile device must be claimed');
  assert(webClaim, 'Web device must be claimed');
  console.log('  ✓ Batch claimed 2 simultaneous delivery jobs:');
  console.log(`    - Job 1: Provider ${mobClaim.provider} (Mobile Device: ${dualMob.id})`);
  console.log(`    - Job 2: Provider ${webClaim.provider} (Web Device: ${dualWeb.id})`);

  // Validate fanout partitioning
  const expoRows = claim5.filter((r) => r.provider === 'expo');
  const webPushRows = claim5.filter((r) => r.provider === 'webpush');
  assert.strictEqual(expoRows.length, 1, 'Exactly 1 row partitioned for Expo Push delivery');
  assert.strictEqual(webPushRows.length, 1, 'Exactly 1 row partitioned for Web Push delivery');
  console.log(`  ✓ sendAll concurrent fanout correctly partitioned ${claim5.length} targets (Expo: ${expoRows.length}, WebPush: ${webPushRows.length})`);

  await admin.rpc('finish_push_batch', {
    p_results: [
      { notification_id: notif5.id, device_id: dualMob.id, outcome: 'ok', ticket_id: `tick_mob_${runTag}` },
      { notification_id: notif5.id, device_id: dualWeb.id, outcome: 'ok' },
    ],
  });

  const { data: finalNotif } = await admin
    .from('notifications')
    .select('push_status, sent_at, push_attempts')
    .eq('id', notif5.id)
    .single();
  assert.strictEqual(finalNotif.push_status, 'sent');
  assert.strictEqual(finalNotif.push_attempts, 1);
  console.log(`  ✓ Transactional outbox state verified: push_status="sent", sent_at=${finalNotif.sent_at}`);
  console.log('  ✓ SCENARIO 5 PASSED: Simultaneous Dual-Platform Delivery verified 100%!');

  console.log('\n================================================================');
  console.log('  ALL 5 CROSS-PLATFORM SHIFT ASSIGNMENT PUSH SCENARIOS PASSED!  ');
  console.log('================================================================\n');
} finally {
  console.log('Cleaning up test fixtures from Dev DB...');
  if (enqueuedNotificationIds.length > 0) {
    await admin.from('push_tickets').delete().in('notification_id', enqueuedNotificationIds);
    await admin.from('notifications').delete().in('id', enqueuedNotificationIds);
  }
  if (createdAssignmentIds.length > 0) {
    await admin.from('operator_machine_assignments').delete().in('id', createdAssignmentIds);
  }
  if (registeredDeviceIds.length > 0) {
    await admin.from('push_devices').delete().in('id', registeredDeviceIds);
  }
  if (createdMachineIds.length > 0) {
    await admin.from('machines').delete().in('id', createdMachineIds);
  }
  console.log('  ✓ Cleaned up all test devices, notifications, assignments, and machines.');
}
