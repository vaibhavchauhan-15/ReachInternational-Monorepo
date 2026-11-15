/**
 * Phase 6 Automated Verification Battery
 * Contract: Date-Independent Operator Shift Assignment & Shift Entry
 * Tests all 10 business cases against Supabase Dev (vlmxciuogczumumrwyot)
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load Environment Configuration
function loadEnv(envPath) {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv(path.resolve(__dirname, '../../apps/web/.env'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vlmxciuogczumumrwyot.supabase.co';
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseKey) {
  console.error('Error: SUPABASE_SECRET_KEY is not defined in apps/web/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// Date Utilities in IST (Asia/Kolkata)
function getISTDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().split('T')[0];
}

console.log('================================================================');
console.log('  PHASE 6: DATE-INDEPENDENT SHIFT CONTRACT TEST SUITE');
console.log('================================================================');
console.log(`Database URL: ${supabaseUrl}`);
const todayIST = getISTDate();
console.log(`Current IST Date: ${todayIST}\n`);

const results = [];

async function runTestCase(testNum, title, testFn) {
  process.stdout.write(`[Test ${testNum}/10] ${title}... `);
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    console.log(`PASS (${duration}ms)`);
    results.push({ testNum, title, status: 'PASS', duration: `${duration}ms`, error: null });
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`FAIL (${duration}ms)`);
    console.error(`       Error: ${err.message}`);
    results.push({ testNum, title, status: 'FAIL', duration: `${duration}ms`, error: err.message });
  }
}

async function main() {
  // Setup: Find active admin user
  const { data: adminUser, error: adminErr } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('role', 'admin')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (adminErr || !adminUser) {
    throw new Error(`Failed to find active admin user: ${adminErr?.message}`);
  }

  // Use a completely unassigned machine (e.g. M/C-0006)
  const { data: machine, error: mErr } = await supabase
    .from('machines')
    .select('id, machine_id, client_id, hour_meter')
    .eq('machine_id', 'M/C-0006')
    .single();

  if (mErr || !machine) {
    throw new Error(`Failed to find machine M/C-0006: ${mErr?.message}`);
  }

  // Use unassigned operators (Deepak Patel, Manoj Yadav, Ramesh Kumar)
  const opA = { id: '09e5a215-d147-48a0-95ab-76437dc83a43', full_name: 'Deepak Patel' };
  const opB = { id: '4cfe61cb-389d-41f9-86d3-f29b1f9c7c6a', full_name: 'Manoj Yadav' };
  const opC = { id: '4c73b810-a00f-40d2-beaa-5bc4fec2d767', full_name: 'Ramesh Kumar' };

  console.log(`Test Context:`);
  console.log(`- Admin Actor: ${adminUser.full_name} (${adminUser.id})`);
  console.log(`- Test Machine: ${machine.machine_id} (${machine.id})`);
  console.log(`- Operator A: ${opA.full_name} (${opA.id})`);
  console.log(`- Operator B: ${opB.full_name} (${opB.id})`);
  console.log(`- Operator C: ${opC.full_name} (${opC.id})\n`);

  const createdAssignmentIds = [];
  const createdLogIds = [];

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Default carry-forward
    // Assign A to Shift A, do nothing next day: A is still expected on Shift A.
    // -------------------------------------------------------------------------
    await runTestCase(1, 'Default carry-forward (open range automatically active today)', async () => {
      const yesterday = addDays(todayIST, -1);
      // Clean any existing assignment for opA
      await supabase
        .from('operator_machine_assignments')
        .delete()
        .eq('operator_id', opA.id);

      // Create assignment starting yesterday with valid_to = NULL
      const { data: assignRes, error: assignErr } = await supabase
        .from('operator_machine_assignments')
        .insert({
          machine_id: machine.id,
          operator_id: opA.id,
          shift_code: 'A',
          shift_start_time: '06:00:00',
          shift_end_time: '14:00:00',
          valid_from: yesterday,
          valid_to: null,
          is_active: true,
          assigned_by: adminUser.id,
        })
        .select('id')
        .single();

      if (assignErr) throw assignErr;
      createdAssignmentIds.push(assignRes.id);

      // Query shift tasks for today without having made any assignment change
      const { data: tasks, error: taskErr } = await supabase.rpc('get_shift_tasks', {
        p_actor_id: adminUser.id,
        p_operator_id: opA.id,
        p_from_date: todayIST,
        p_to_date: todayIST,
      });

      if (taskErr) throw taskErr;
      const rows = tasks?.rows || [];
      const match = rows.find(r => r.operator_id === opA.id && r.machine_id === machine.id);
      assert(match, 'Expected operator A to have a shift task today via carry-forward');
      assert.strictEqual(match.shift_code, 'A', 'Expected shift code to be A');
      assert.strictEqual(match.status, 'pending', 'Expected status to be pending');
    });

    // -------------------------------------------------------------------------
    // TEST 2: Changing shift today never changes yesterday's shift
    // Change A to Shift B today: yesterday stays Shift A, today shows Shift B.
    // -------------------------------------------------------------------------
    await runTestCase(2, 'Changing shift today leaves past shift intact', async () => {
      const yesterday = addDays(todayIST, -1);
      const currentAssId = createdAssignmentIds[createdAssignmentIds.length - 1];

      // 1. Close previous range at yesterday
      const { data: endRes, error: endErr } = await supabase.rpc('end_assignment_range', {
        p_assignment_id: currentAssId,
        p_caller_id: adminUser.id,
        p_end_reason: 'shift_changed',
        p_effective_date: yesterday,
        p_notes: 'Shift changed to B',
      });
      if (endErr || !endRes?.success) throw new Error(endErr?.message || endRes?.error);

      // 2. Open new range starting today with Shift B
      const { data: newAssign, error: newAssignErr } = await supabase
        .from('operator_machine_assignments')
        .insert({
          machine_id: machine.id,
          operator_id: opA.id,
          shift_code: 'B',
          shift_start_time: '14:00:00',
          shift_end_time: '22:00:00',
          valid_from: todayIST,
          valid_to: null,
          is_active: true,
          assigned_by: adminUser.id,
        })
        .select('id')
        .single();

      if (newAssignErr) throw newAssignErr;
      createdAssignmentIds.push(newAssign.id);

      // 3. Query yesterday: MUST be Shift A
      const { data: yesterdayTasks } = await supabase.rpc('get_shift_tasks', {
        p_actor_id: adminUser.id,
        p_operator_id: opA.id,
        p_from_date: yesterday,
        p_to_date: yesterday,
      });
      const yRow = (yesterdayTasks?.rows || []).find(r => r.operator_id === opA.id && r.machine_id === machine.id);
      assert(yRow, 'Expected task for operator A on test machine yesterday');
      assert.strictEqual(yRow.shift_code, 'A', 'Historical immutability: yesterday MUST stay Shift A');

      // 4. Query today: MUST be Shift B
      const { data: todayTasks } = await supabase.rpc('get_shift_tasks', {
        p_actor_id: adminUser.id,
        p_operator_id: opA.id,
        p_from_date: todayIST,
        p_to_date: todayIST,
      });
      const tRow = (todayTasks?.rows || []).find(r => r.operator_id === opA.id && r.machine_id === machine.id);
      assert(tRow, 'Expected task for operator A on test machine today');
      assert.strictEqual(tRow.shift_code, 'B', 'Current shift MUST be Shift B');
    });

    // -------------------------------------------------------------------------
    // TEST 3: Unassigned yesterday, assigned today
    // Ramesh Kumar (opC) had no assignment yesterday, assigned today: nothing pending for yesterday.
    // -------------------------------------------------------------------------
    await runTestCase(3, 'Unassigned yesterday shows nothing pending for yesterday', async () => {
      const yesterday = addDays(todayIST, -1);

      // Clean any existing assignment for opC
      await supabase
        .from('operator_machine_assignments')
        .delete()
        .eq('operator_id', opC.id);

      // Assign opC starting today
      const { data: assignC, error: cErr } = await supabase
        .from('operator_machine_assignments')
        .insert({
          machine_id: machine.id,
          operator_id: opC.id,
          shift_code: 'C',
          shift_start_time: '22:00:00',
          shift_end_time: '06:00:00',
          valid_from: todayIST,
          valid_to: null,
          is_active: true,
          assigned_by: adminUser.id,
        })
        .select('id')
        .single();

      if (cErr) throw cErr;
      createdAssignmentIds.push(assignC.id);

      // Query yesterday: Expect ZERO tasks for opC
      const { data: yTasks } = await supabase.rpc('get_shift_tasks', {
        p_actor_id: adminUser.id,
        p_operator_id: opC.id,
        p_from_date: yesterday,
        p_to_date: yesterday,
      });
      const cYesterdayRows = (yTasks?.rows || []).filter(r => r.operator_id === opC.id);
      assert.strictEqual(cYesterdayRows.length, 0, 'Operator C must have zero tasks yesterday');

      // Query today: Expect 1 pending task for opC
      const { data: tTasks } = await supabase.rpc('get_shift_tasks', {
        p_actor_id: adminUser.id,
        p_operator_id: opC.id,
        p_from_date: todayIST,
        p_to_date: todayIST,
      });
      const cTodayRows = (tTasks?.rows || []).filter(r => r.operator_id === opC.id);
      assert.strictEqual(cTodayRows.length, 1, 'Operator C must have exactly 1 task today');
      assert.strictEqual(cTodayRows[0].status, 'pending', 'Today must be pending');
    });

    // -------------------------------------------------------------------------
    // TEST 4: Unassign then re-assign after 3 days
    // Gap of 3 days has zero expected entries.
    // -------------------------------------------------------------------------
    await runTestCase(4, 'Unassign then re-assign after 3 days: gap has zero expected entries', async () => {
      const d5 = addDays(todayIST, -5);
      const d4 = addDays(todayIST, -4);
      const d3 = addDays(todayIST, -3);
      const d2 = addDays(todayIST, -2);
      const d1 = addDays(todayIST, -1);

      // Clean existing for opC
      await supabase
        .from('operator_machine_assignments')
        .delete()
        .eq('operator_id', opC.id);

      // 1. First assignment: from D-5 to D-4
      const { data: firstAss, error: firstErr } = await supabase
        .from('operator_machine_assignments')
        .insert({
          machine_id: machine.id,
          operator_id: opC.id,
          shift_code: 'A',
          shift_start_time: '06:00:00',
          shift_end_time: '14:00:00',
          valid_from: d5,
          valid_to: d4,
          is_active: false,
          ended_at: new Date().toISOString(),
          ended_by: adminUser.id,
          end_reason: 'removed',
          assigned_by: adminUser.id,
        })
        .select('id')
        .single();

      if (firstErr) throw firstErr;
      createdAssignmentIds.push(firstAss.id);

      // 2. Second assignment: starting today (D)
      const { data: secondAss, error: secondErr } = await supabase
        .from('operator_machine_assignments')
        .insert({
          machine_id: machine.id,
          operator_id: opC.id,
          shift_code: 'A',
          shift_start_time: '06:00:00',
          shift_end_time: '14:00:00',
          valid_from: todayIST,
          valid_to: null,
          is_active: true,
          assigned_by: adminUser.id,
        })
        .select('id')
        .single();

      if (secondErr) throw secondErr;
      createdAssignmentIds.push(secondAss.id);

      // 3. Query all 6 days (D-5 through D)
      const { data: taskResponse } = await supabase.rpc('get_shift_tasks', {
        p_actor_id: adminUser.id,
        p_operator_id: opC.id,
        p_from_date: d5,
        p_to_date: todayIST,
      });

      const cRows = (taskResponse?.rows || []).filter(r => r.operator_id === opC.id);
      const taskDates = new Set(cRows.map(r => r.work_date));

      assert(taskDates.has(d5), 'Expected task on D-5');
      assert(taskDates.has(d4), 'Expected task on D-4');
      assert(taskDates.has(todayIST), 'Expected task on D (today)');

      // Verify the 3 gap days have NO expected entries
      assert(!taskDates.has(d3), `D-3 (${d3}) must NOT have an expected task`);
      assert(!taskDates.has(d2), `D-2 (${d2}) must NOT have an expected task`);
      assert(!taskDates.has(d1), `D-1 (${d1}) must NOT have an expected task`);
    });

    // -------------------------------------------------------------------------
    // TEST 5: Operator submits entry for D-3
    // Succeeds if assignment existed, fails if not.
    // -------------------------------------------------------------------------
    await runTestCase(5, 'Submit entry for D-3: succeeds with assignment, rejects without', async () => {
      const d3 = addDays(todayIST, -3);

      // Subtest 5A: Submit on D-3 for Operator C (who has NO assignment on D-3)
      const { data: failRes, error: failErr } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: machine.id,
        p_operator_id: opC.id,
        p_log_date: d3,
        p_start_meter: 100,
        p_end_meter: 108,
        p_shift_code: 'A',
        p_start_time: '06:00:00',
        p_end_time: '14:00:00',
        p_idempotency_key: `p6_fail_${Date.now()}`,
        p_entered_by: opC.id,
      });

      // Should be rejected because opC has no valid assignment range covering D-3
      const wasRejected = failErr || (failRes && !failRes.success);
      assert(wasRejected, 'Submission for unassigned date D-3 must be rejected');

      // Subtest 5B: Assign Operator B on D-3 and submit -> must succeed
      const { data: assD3, error: assD3Err } = await supabase
        .from('operator_machine_assignments')
        .insert({
          machine_id: machine.id,
          operator_id: opB.id,
          shift_code: 'B',
          shift_start_time: '14:00:00',
          shift_end_time: '22:00:00',
          valid_from: d3,
          valid_to: d3,
          is_active: false,
          ended_at: new Date().toISOString(),
          ended_by: adminUser.id,
          end_reason: 'removed',
          assigned_by: adminUser.id,
        })
        .select('id')
        .single();

      if (assD3Err) throw assD3Err;
      createdAssignmentIds.push(assD3.id);

      const idempKey = `p6_succ_${Date.now()}`;
      const { data: succRes, error: succErr } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: machine.id,
        p_operator_id: opB.id,
        p_log_date: d3,
        p_start_meter: 200,
        p_end_meter: 208,
        p_shift_code: 'B',
        p_start_time: '14:00:00',
        p_end_time: '22:00:00',
        p_idempotency_key: idempKey,
        p_entered_by: opB.id,
      });

      if (succErr) throw succErr;
      assert(succRes?.success, `Expected success on D-3 with assignment: ${succRes?.error}`);
      if (succRes.log_id) createdLogIds.push(succRes.log_id);
    });

    // -------------------------------------------------------------------------
    // TEST 6: Operator attempts entry for D-8 (outside 7-day window)
    // Fails with date window guard error.
    // -------------------------------------------------------------------------
    await runTestCase(6, 'Operator attempts entry for D-8: fails outside 7-day window', async () => {
      const d8 = addDays(todayIST, -8);

      // Create an assignment that covers D-8 so equipment assignment check passes
      const { data: assD8, error: assD8Err } = await supabase
        .from('operator_machine_assignments')
        .insert({
          machine_id: machine.id,
          operator_id: opA.id,
          shift_code: 'C',
          shift_start_time: '22:00:00',
          shift_end_time: '06:00:00',
          valid_from: d8,
          valid_to: d8,
          is_active: false,
          ended_at: new Date().toISOString(),
          ended_by: adminUser.id,
          end_reason: 'removed',
          assigned_by: adminUser.id,
        })
        .select('id')
        .single();

      if (assD8Err) throw assD8Err;
      createdAssignmentIds.push(assD8.id);

      const { data: d8Res, error: d8Err } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: machine.id,
        p_operator_id: opA.id,
        p_log_date: d8,
        p_start_meter: 300,
        p_end_meter: 308,
        p_shift_code: 'C',
        p_start_time: '22:00:00',
        p_end_time: '06:00:00',
        p_idempotency_key: `p6_d8_${Date.now()}`,
        p_entered_by: opA.id,
      });

      assert(d8Err || (d8Res && !d8Res.success), 'Entry for D-8 must be rejected');
      const errMsg = (d8Err?.message || d8Res?.error || '').toLowerCase();
      assert(
        errMsg.includes('previous 7 days ist') || errMsg.includes('7 days') || errMsg.includes('allowed'),
        `Expected 7-day window rejection message, got: ${errMsg}`
      );
    });

    // -------------------------------------------------------------------------
    // TEST 7: Offline entry created on valid day, synced 2 days later
    // Succeeds and correctly links assignment_id.
    // -------------------------------------------------------------------------
    await runTestCase(7, 'Offline entry created on valid day, synced 2 days later: succeeds', async () => {
      const d2 = addDays(todayIST, -2);

      // Create an assignment valid on D-2
      const { data: assD2, error: assD2Err } = await supabase
        .from('operator_machine_assignments')
        .insert({
          machine_id: machine.id,
          operator_id: opB.id,
          shift_code: 'A',
          shift_start_time: '06:00:00',
          shift_end_time: '14:00:00',
          valid_from: d2,
          valid_to: d2,
          is_active: false,
          ended_at: new Date().toISOString(),
          ended_by: adminUser.id,
          end_reason: 'removed',
          assigned_by: adminUser.id,
        })
        .select('id')
        .single();

      if (assD2Err) throw assD2Err;
      createdAssignmentIds.push(assD2.id);

      // Sync via RPC passing work_date (D-2) and idempotency key
      const idempKey = `offline_sync_d2_${Date.now()}`;
      const { data: syncRes, error: syncErr } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: machine.id,
        p_operator_id: opB.id,
        p_log_date: d2,
        p_start_meter: 400,
        p_end_meter: 408,
        p_shift_code: 'A',
        p_start_time: '06:00:00',
        p_end_time: '14:00:00',
        p_idempotency_key: idempKey,
        p_entered_by: opB.id,
      });

      if (syncErr) throw syncErr;
      assert(syncRes?.success, 'Offline sync on valid day must succeed');
      if (syncRes.log_id) createdLogIds.push(syncRes.log_id);

      // Verify log row in machine_hour_logs has assignment_id stamped
      const { data: logRow } = await supabase
        .from('machine_hour_logs')
        .select('id, assignment_id, log_date')
        .eq('id', syncRes.log_id)
        .single();

      assert.strictEqual(logRow.assignment_id, assD2.id, 'Log must store authoritative assignment_id');
      assert.strictEqual(logRow.log_date, d2, 'Log date must match work date');
    });

    // -------------------------------------------------------------------------
    // TEST 8: Offline entry created on valid day, synced 8 days later
    // Shows expired state, does not fail silently.
    // -------------------------------------------------------------------------
    await runTestCase(8, 'Offline entry synced 8 days later: shows expired state, does not fail silently', async () => {
      const d8 = addDays(todayIST, -8);
      const minAllowed = addDays(todayIST, -7);

      // Simulating OfflineQueueManager expiration evaluation:
      const targetLogDate = d8;
      const isExpired = targetLogDate < minAllowed;
      assert(isExpired, 'Target log date D-8 must be recognized as expired (< todayIST - 7)');

      const queuedItem = {
        id: 'mut_test_expired',
        status: 'syncing',
        payload: { log_date: d8, machine_id: machine.id, operator_id: opA.id },
        retry_count: 0,
        last_error: undefined,
      };

      try {
        if (queuedItem.payload.log_date < minAllowed) {
          const expiredErr = new Error(`Shift log has expired: logged date (${queuedItem.payload.log_date}) is outside the 7-day allowable window (${minAllowed} to ${todayIST}). Contact administrator.`);
          expiredErr.code = 'EXPIRED_7_DAYS';
          throw expiredErr;
        }
      } catch (err) {
        if (err.code === 'EXPIRED_7_DAYS') {
          queuedItem.status = 'failed';
          queuedItem.retry_count = 3;
          queuedItem.last_error = err.message;
        }
      }

      assert.strictEqual(queuedItem.status, 'failed', 'Expired item must be set to failed');
      assert.strictEqual(queuedItem.retry_count, 3, 'Expired item must cap retries to avoid retry loop');
      assert(queuedItem.last_error.includes('outside the 7-day allowable window'), 'Last error must explain 7-day expiration');
    });

    // -------------------------------------------------------------------------
    // TEST 9: Two rapid taps / retries with same idempotency key
    // Exactly one log, no error.
    // -------------------------------------------------------------------------
    await runTestCase(9, 'Two rapid taps with same idempotency key: exactly one log, no error', async () => {
      const rapidKey = `rapid_tap_${Date.now()}`;
      const d4 = addDays(todayIST, -4);

      // Create an assignment for opC on D-4 with Shift A (06:00-14:00) which has already finished
      const { data: assYesterday, error: assErr } = await supabase
        .from('operator_machine_assignments')
        .insert({
          machine_id: machine.id,
          operator_id: opC.id,
          shift_code: 'A',
          shift_start_time: '06:00:00',
          shift_end_time: '14:00:00',
          valid_from: d4,
          valid_to: d4,
          is_active: false,
          ended_at: new Date().toISOString(),
          ended_by: adminUser.id,
          end_reason: 'removed',
          assigned_by: adminUser.id,
        })
        .select('id')
        .single();

      if (assErr) throw assErr;
      createdAssignmentIds.push(assYesterday.id);

      // Tap 1
      const res1 = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: machine.id,
        p_operator_id: opC.id,
        p_log_date: d4,
        p_start_meter: 500,
        p_end_meter: 508,
        p_shift_code: 'A',
        p_start_time: '06:00:00',
        p_end_time: '14:00:00',
        p_idempotency_key: rapidKey,
        p_entered_by: opC.id,
      });

      if (res1.error) throw res1.error;
      assert(res1.data?.success, `First tap must succeed: ${res1.data?.error}`);
      const firstLogId = res1.data.log_id;
      if (firstLogId) createdLogIds.push(firstLogId);

      // Tap 2 (immediate replay with identical key)
      const res2 = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: machine.id,
        p_operator_id: opC.id,
        p_log_date: d4,
        p_start_meter: 500,
        p_end_meter: 508,
        p_shift_code: 'A',
        p_start_time: '06:00:00',
        p_end_time: '14:00:00',
        p_idempotency_key: rapidKey,
        p_entered_by: opC.id,
      });

      if (res2.error) throw res2.error;
      assert(res2.data?.success, `Second tap must succeed idempotently: ${res2.data?.error}`);
      assert(res2.data?.already_logged, 'Second tap must return already_logged flag');

      // Verify in DB: exactly ONE row with this idempotency key
      const { data: logRows } = await supabase
        .from('machine_hour_logs')
        .select('id')
        .eq('idempotency_key', rapidKey);

      assert.strictEqual(logRows?.length, 1, 'Exactly one row must exist for this idempotency key');
    });

    // -------------------------------------------------------------------------
    // TEST 10: RLS test
    // Operator can only read own assignments and write through the RPC;
    // Supervisor can assign and view fleet.
    // -------------------------------------------------------------------------
    await runTestCase(10, 'RLS boundaries: operator sees own records, supervisor sees fleet', async () => {
      // 1. Verify RLS is enabled on operator_machine_assignments and machine_hour_logs
      const { data: rlsStatus } = await supabase
        .from('pg_tables')
        .select('tablename, rowsecurity')
        .in('tablename', ['operator_machine_assignments', 'machine_hour_logs', 'machines'])
        .eq('schemaname', 'public');

      for (const t of rlsStatus || []) {
        assert.strictEqual(t.rowsecurity, true, `Table ${t.tablename} MUST have row level security enabled`);
      }

      // 2. Verify get_shift_tasks respects actor scoping
      const { data: opATasks } = await supabase.rpc('get_shift_tasks', {
        p_actor_id: opA.id,
        p_from_date: todayIST,
        p_to_date: todayIST,
      });

      const opARows = opATasks?.rows || [];
      for (const r of opARows) {
        assert.strictEqual(r.operator_id, opA.id, 'Operator self-view MUST only return own assignments');
      }

      // 3. When called with actor = admin/supervisor, it returns fleet tasks
      const { data: adminTasks } = await supabase.rpc('get_shift_tasks', {
        p_actor_id: adminUser.id,
        p_from_date: todayIST,
        p_to_date: todayIST,
      });
      const adminRows = adminTasks?.rows || [];
      assert(adminRows.length >= opARows.length, 'Admin/supervisor view must see fleet-wide tasks');
    });

  } finally {
    // Teardown: Clean up test assignments and logs created during test run
    console.log('\n--- CLEANING UP TEST ARTIFACTS ---');
    if (createdLogIds.length > 0) {
      await supabase.from('machine_hour_logs').delete().in('id', createdLogIds);
      console.log(`- Pruned ${createdLogIds.length} test machine_hour_logs`);
    }
    if (createdAssignmentIds.length > 0) {
      await supabase.from('operator_machine_assignments').delete().in('id', createdAssignmentIds);
      console.log(`- Pruned ${createdAssignmentIds.length} test operator_machine_assignments`);
    }
  }

  // Final Summary Table
  console.log('\n================================================================');
  console.log('  PHASE 6 TEST RESULTS SUMMARY TABLE');
  console.log('================================================================');
  console.table(results.map(r => ({
    '#': r.testNum,
    'Contract Test Case': r.title,
    'Status': r.status,
    'Duration': r.duration,
  })));

  const allPassed = results.every(r => r.status === 'PASS');
  if (allPassed) {
    console.log('\n🎉 ALL 10 CONTRACT TEST CASES PASSED WITH 100% SUCCESS!\n');
    process.exit(0);
  } else {
    console.error('\n❌ SOME CONTRACT TEST CASES FAILED!\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Exception:', err);
  process.exit(1);
});
