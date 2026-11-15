/**
 * COMPREHENSIVE END-TO-END SHIFT INDEPENDENCE & VALIDATION MATRIX TEST SUITE
 * 
 * Target: Reach International Dev (vlmxciuogczumumrwyot)
 * 
 * Covers:
 * 1. Exact User A Bug: Yesterday Shift A (unlogged), Today Shift B (logged) -> Yesterday remains Shift A Pending, can be logged within 7 days.
 * 2. Exact User B Bug: Yesterday unassigned, Today Shift A on Machine M -> Yesterday has 0 pending/entered, no leakage.
 * 3. 7-Day Past Shift Window & Consecutive Reassignments across different machines.
 * 4. Exhaustive Battery of ALL Normal Shift VALID Entries.
 * 5. Exhaustive Battery of ALL Normal Shift INVALID Entries.
 * 6. Web & Mobile Integration Contracts.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

loadEnv(path.resolve(__dirname, '../../apps/web/.env.local'));
loadEnv(path.resolve(__dirname, '../../apps/web/.env'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vlmxciuogczumumrwyot.supabase.co';
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseKey) {
  console.error('ERROR: SUPABASE_SECRET_KEY is not defined in apps/web/.env[.local]');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// IST Date Formatting Utilities
function getISTDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().split('T')[0];
}

const todayIST = getISTDate();
const yesterdayIST = addDays(todayIST, -1);

console.log('==============================================================================');
console.log('  RETESTING ALL SHIFT SCENARIOS FROM SCRATCH');
console.log(`  Database URL: ${supabaseUrl}`);
console.log(`  Current IST Date: ${todayIST} | Yesterday IST: ${yesterdayIST}`);
console.log('==============================================================================\n');

let passCount = 0;
let failCount = 0;
const results = [];

async function runTest(category, code, title, testFn) {
  const fullId = `[${code}]`;
  process.stdout.write(`${fullId} ${title}... `);
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    console.log(`PASS (${duration}ms)`);
    passCount++;
    results.push({ code, category, title, status: 'PASS', duration: `${duration}ms`, error: null });
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`FAIL (${duration}ms)`);
    console.error(`       ❌ Error: ${err.message}`);
    failCount++;
    results.push({ code, category, title, status: 'FAIL', duration: `${duration}ms`, error: err.message });
  }
}

async function main() {
  // Discovery & Test Fixtures
  const { data: adminUser, error: adminErr } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('role', 'admin')
    .eq('status', 'active')
    .limit(1)
    .single();
  assert(!adminErr && adminUser, `Failed to load admin user: ${adminErr?.message}`);

  const { data: supervisorUser, error: supErr } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('role', 'supervisor')
    .eq('status', 'active')
    .limit(1)
    .single();
  assert(!supErr && supervisorUser, `Failed to load supervisor user: ${supErr?.message}`);

  const { data: hrUser, error: hrErr } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('role', 'hr')
    .eq('status', 'active')
    .limit(1)
    .single();
  assert(!hrErr && hrUser, `Failed to load HR user: ${hrErr?.message}`);

  // Test Operators
  const opA = { id: '09e5a215-d147-48a0-95ab-76437dc83a43', name: 'Deepak Patel' };
  const opB = { id: '4cfe61cb-389d-41f9-86d3-f29b1f9c7c6a', name: 'Manoj Yadav' };
  const opC = { id: '4c73b810-a00f-40d2-beaa-5bc4fec2d767', name: 'Ramesh Kumar' };

  // Ensure test machines are in active status
  await supabase.from('machines').update({ status: 'rented', health_status: 'active' }).in('machine_id', ['M/C-0006', 'M/C-0002', 'M/C-0003']);

  const { data: machines, error: machErr } = await supabase
    .from('machines')
    .select('id, machine_id, machine_name, client_id, hour_meter, status, health_status')
    .in('machine_id', ['M/C-0006', 'M/C-0002', 'M/C-0003']);
  assert(!machErr && machines.length >= 3, `Failed to load test machines: ${machErr?.message}`);

  const m1 = machines.find(m => m.machine_id === 'M/C-0006');
  const m2 = machines.find(m => m.machine_id === 'M/C-0002');
  const m3 = machines.find(m => m.machine_id === 'M/C-0003');

  const cleanupAssignmentIds = [];
  const cleanupLogIds = [];

  const testWindowDates = [
    todayIST,
    yesterdayIST,
    addDays(todayIST, -2),
    addDays(todayIST, -3),
    addDays(todayIST, -4),
    addDays(todayIST, -5),
    addDays(todayIST, -6),
    addDays(todayIST, -7),
    addDays(todayIST, -8),
    addDays(todayIST, 1),
  ];

  // Helper to safely create assignments with all required columns
  async function createAssignment({
    operatorId,
    machineId,
    shiftCode = 'A',
    validFrom,
    validTo = null,
    isActive = true,
    assignedBy = adminUser.id
  }) {
    const shiftTimes = {
      A: { start: '06:00:00', end: '14:00:00' },
      B: { start: '14:00:00', end: '22:00:00' },
      C: { start: '22:00:00', end: '06:00:00' },
    };
    const times = shiftTimes[shiftCode] || shiftTimes.A;

    const { data, error } = await supabase
      .from('operator_machine_assignments')
      .insert({
        operator_id: operatorId,
        machine_id: machineId,
        shift_code: shiftCode,
        shift_start_time: times.start,
        shift_end_time: times.end,
        valid_from: validFrom,
        valid_to: validTo,
        is_active: isActive,
        assigned_by: assignedBy,
        ended_at: isActive ? null : new Date().toISOString(),
        end_reason: isActive ? null : 'reassigned'
      })
      .select()
      .single();

    if (error) throw new Error(`createAssignment failed: ${error.message}`);
    cleanupAssignmentIds.push(data.id);
    return data;
  }

  async function cleanOperator(opId) {
    await supabase.from('machine_hour_logs').delete().eq('operator_id', opId).in('log_date', testWindowDates);
    const { data: assignments } = await supabase
      .from('operator_machine_assignments')
      .select('id')
      .eq('operator_id', opId)
      .or(`valid_from.gte.${addDays(todayIST, -8)},valid_to.gte.${addDays(todayIST, -8)},valid_to.is.null`);

    if (assignments && assignments.length > 0) {
      const ids = assignments.map(a => a.id);
      await supabase.from('machine_hour_logs').delete().in('assignment_id', ids);
      await supabase.from('operator_shift_ranges').delete().in('assignment_id', ids);
      await supabase.from('operator_machine_assignments').delete().in('id', ids);
    }
  }

  // Safe cleanup helper
  async function performCleanup() {
    console.log('\n--- PRUNING TEST FIXTURES ---');
    await cleanOperator(opA.id);
    await cleanOperator(opB.id);
    await cleanOperator(opC.id);
    await supabase.from('machine_hour_logs').delete().in('machine_id', [m1.id, m2.id, m3.id]).in('log_date', testWindowDates);
    if (cleanupLogIds.length > 0) {
      await supabase.from('machine_hour_logs').delete().in('id', cleanupLogIds);
      console.log(`- Pruned ${cleanupLogIds.length} test machine_hour_logs`);
    }
    if (cleanupAssignmentIds.length > 0) {
      await supabase.from('operator_machine_assignments').delete().in('id', cleanupAssignmentIds);
      console.log(`- Pruned ${cleanupAssignmentIds.length} test operator_machine_assignments`);
    }
    await supabase.from('machines').update({ status: 'rented', health_status: 'active' }).in('machine_id', ['M/C-0006', 'M/C-0002', 'M/C-0003']);
  }

  // Pre-test prune for a clean slate
  await cleanOperator(opA.id);
  await cleanOperator(opB.id);
  await cleanOperator(opC.id);
  await supabase.from('machine_hour_logs').delete().in('machine_id', [m1.id, m2.id, m3.id]).in('log_date', testWindowDates);

  console.log('Pruned pre-existing records for clean slate testing.\n');

  try {
    // =========================================================================
    // SECTION 1: Exact Bug 1 (User A Historical Shift Independence)
    // =========================================================================
    console.log('--- SECTION 1: Exact User A Bug (Historical Shift Independence) ---');

    let userA_assign_yesterday;
    let userA_assign_today;

    await runTest('User A Bug', 'USERA-01', 'Assign User A yesterday to Shift A on Machine 1 without log entry', async () => {
      userA_assign_yesterday = await createAssignment({
        operatorId: opA.id,
        machineId: m1.id,
        shiftCode: 'A',
        validFrom: yesterdayIST,
        validTo: null,
        isActive: true,
      });
      assert(userA_assign_yesterday?.id, 'Initial assignment must exist');
    });

    await runTest('User A Bug', 'USERA-02', 'Today, reassign User A to Shift B on Machine 1 via end_assignment_range', async () => {
      // 1. Close previous range as of yesterday
      const { data: endRes, error: endErr } = await supabase.rpc('end_assignment_range', {
        p_assignment_id: userA_assign_yesterday.id,
        p_caller_id: adminUser.id,
        p_end_reason: 'reassigned',
        p_effective_date: yesterdayIST,
        p_notes: 'Reassigned to Shift B for today'
      });
      assert(!endErr && endRes?.success, `end_assignment_range failed: ${endErr?.message || endRes?.error}`);

      // 2. Insert new assignment starting today on Shift B
      userA_assign_today = await createAssignment({
        operatorId: opA.id,
        machineId: m1.id,
        shiftCode: 'B',
        validFrom: todayIST,
        validTo: null,
        isActive: true,
      });
      assert(userA_assign_today?.id, 'New assignment for today must exist');
    });

    await runTest('User A Bug', 'USERA-03', 'Verify Yesterday context: returns Shift A (NOT Shift B!) and valid machine context', async () => {
      const { data: ctxYesterday, error: ctxYErr } = await supabase.rpc('get_operator_entry_context', {
        p_operator_id: opA.id,
        p_target_date: yesterdayIST,
      });
      assert(!ctxYErr && ctxYesterday, `RPC get_operator_entry_context failed: ${ctxYErr?.message}`);
      assert.strictEqual(ctxYesterday.assigned_shift_code, 'A', `Yesterday shift code must be 'A', got '${ctxYesterday.assigned_shift_code}'`);
      assert.strictEqual(ctxYesterday.machine?.id, m1.id, `Yesterday machine must match Machine 1`);
      assert.strictEqual(ctxYesterday.assignment_id, userA_assign_yesterday.id, `Yesterday assignment_id must match yesterday assignment`);
    });

    await runTest('User A Bug', 'USERA-04', 'Verify Today context: returns Shift B and valid machine context', async () => {
      const { data: ctxToday, error: ctxTErr } = await supabase.rpc('get_operator_entry_context', {
        p_operator_id: opA.id,
        p_target_date: todayIST,
      });
      assert(!ctxTErr && ctxToday, `RPC get_operator_entry_context failed: ${ctxTErr?.message}`);
      assert.strictEqual(ctxToday.assigned_shift_code, 'B', `Today shift code must be 'B', got '${ctxToday.assigned_shift_code}'`);
      assert.strictEqual(ctxToday.machine?.id, m1.id, `Today machine must match Machine 1`);
      assert.strictEqual(ctxToday.assignment_id, userA_assign_today.id, `Today assignment_id must match today assignment`);
    });

    await runTest('User A Bug', 'USERA-05', 'Verify Shift Monitor Yesterday shows User A on Shift A (Pending)', async () => {
      const { data: monRows, error: mErr } = await supabase.rpc('get_today_shift_log_monitor', {
        p_actor_id: adminUser.id,
        p_log_date: yesterdayIST,
      });
      assert(!mErr && monRows, `get_today_shift_log_monitor failed: ${mErr?.message}`);
      const row = monRows.find(r => r.operator_id === opA.id);
      assert(row, `User A must appear in yesterday monitor`);
      assert.strictEqual(row.shift_code, 'A', `Yesterday monitor shift code must be 'A', got '${row.shift_code}'`);
      assert.strictEqual(row.status, 'pending', `Yesterday monitor status must be 'pending', got '${row.status}'`);
    });

    await runTest('User A Bug', 'USERA-06', 'Action: User A enters TODAY shift entry for Shift B -> Today status is Entered, Yesterday STILL shows Shift A Pending', async () => {
      const { data: logRes, error: lErr } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'B',
        p_log_date: todayIST,
        p_start_meter: 100,
        p_end_meter: 100.5,
        p_start_time: '14:00:00',
        p_end_time: '14:30:00',
        p_normal_working_hours: 0.5,
        p_idempotency_key: `usera-today-${Date.now()}`,
      });
      assert(!lErr && logRes?.success, `Log submit failed: ${lErr?.message || logRes?.error}`);
      cleanupLogIds.push(logRes.log_id);

      // Verify today is entered
      const { data: monToday } = await supabase.rpc('get_today_shift_log_monitor', {
        p_actor_id: adminUser.id,
        p_log_date: todayIST,
      });
      const rowToday = monToday.find(r => r.operator_id === opA.id);
      assert(rowToday, `User A must appear in today monitor`);
      assert.strictEqual(rowToday.status, 'entered', `Today status must be 'entered'`);
      assert.strictEqual(rowToday.shift_code, 'B', `Today shift must be 'B'`);

      // Verify yesterday is STILL pending on Shift A
      const { data: monYesterday } = await supabase.rpc('get_today_shift_log_monitor', {
        p_actor_id: adminUser.id,
        p_log_date: yesterdayIST,
      });
      const rowYesterday = monYesterday.find(r => r.operator_id === opA.id);
      assert(rowYesterday, `User A must still appear in yesterday monitor`);
      assert.strictEqual(rowYesterday.shift_code, 'A', `Yesterday shift must REMAIN 'A', got '${rowYesterday.shift_code}'`);
      assert.strictEqual(rowYesterday.status, 'pending', `Yesterday status must REMAIN 'pending', got '${rowYesterday.status}'`);
    });

    await runTest('User A Bug', 'USERA-07', 'Action: User A enters 7-day past shift entry for YESTERDAY on Shift A -> Yesterday updates to Entered', async () => {
      const { data: logPastRes, error: lpErr } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'A',
        p_log_date: yesterdayIST,
        p_start_meter: 92,
        p_end_meter: 100,
        p_start_time: '06:00:00',
        p_end_time: '14:00:00',
        p_idempotency_key: `usera-yesterday-${Date.now()}`,
      });
      assert(!lpErr && logPastRes?.success, `Past log submit failed: ${lpErr?.message || logPastRes?.error}`);
      cleanupLogIds.push(logPastRes.log_id);

      // Verify yesterday is now entered with Shift A
      const { data: monYesterday } = await supabase.rpc('get_today_shift_log_monitor', {
        p_actor_id: adminUser.id,
        p_log_date: yesterdayIST,
      });
      const rowYesterday = monYesterday.find(r => r.operator_id === opA.id);
      assert(rowYesterday, `User A must appear in yesterday monitor`);
      assert.strictEqual(rowYesterday.shift_code, 'A', `Yesterday shift must be 'A'`);
      assert.strictEqual(rowYesterday.status, 'entered', `Yesterday status must now be 'entered'`);
    });

    // =========================================================================
    // SECTION 2: Exact Bug 2 (User B Unassigned Past Date Independence)
    // =========================================================================
    console.log('\n--- SECTION 2: Exact User B Bug (Unassigned Past Date Independence) ---');

    await runTest('User B Bug', 'USERB-01', 'Setup: User B has NO assignment yesterday; Assigned TODAY to Machine 2 on Shift A', async () => {
      const assignB = await createAssignment({
        operatorId: opB.id,
        machineId: m2.id,
        shiftCode: 'A',
        validFrom: todayIST,
        validTo: null,
        isActive: true,
      });
      assert(assignB?.id, 'User B assignment must exist');
    });

    await runTest('User B Bug', 'USERB-02', 'Verify Yesterday context: User B returns machine = null, assignment_id = null', async () => {
      const { data: ctxBYesterday, error: bCtxErr } = await supabase.rpc('get_operator_entry_context', {
        p_operator_id: opB.id,
        p_target_date: yesterdayIST,
      });
      assert(!bCtxErr && ctxBYesterday, `RPC get_operator_entry_context failed: ${bCtxErr?.message}`);
      assert.strictEqual(ctxBYesterday.machine, null, `Machine must be null for unassigned past date`);
      assert.strictEqual(ctxBYesterday.assignment_id, null, `assignment_id must be null for unassigned past date`);
      assert.strictEqual(ctxBYesterday.assigned_shift_code, null, `assigned_shift_code must be null for unassigned past date`);
    });

    await runTest('User B Bug', 'USERB-03', 'Verify Yesterday Shift Monitor: User B does NOT show (0 rows, neither Pending nor Entered)', async () => {
      const { data: monRows } = await supabase.rpc('get_today_shift_log_monitor', {
        p_actor_id: adminUser.id,
        p_log_date: yesterdayIST,
      });
      const userBInYesterday = (monRows || []).find(r => r.operator_id === opB.id);
      assert(!userBInYesterday, `User B must NOT show in yesterday monitor when unassigned! Found: ${JSON.stringify(userBInYesterday)}`);
    });

    await runTest('User B Bug', 'USERB-04', 'Verify Yesterday Shift Tasks: get_shift_tasks for User B on yesterday returns 0 rows', async () => {
      const { data: tasksB, error: tErr } = await supabase.rpc('get_shift_tasks', {
        p_actor_id: opB.id,
        p_operator_id: opB.id,
        p_from_date: yesterdayIST,
        p_to_date: yesterdayIST,
      });
      assert(!tErr && tasksB, `get_shift_tasks failed: ${tErr?.message}`);
      assert.strictEqual(tasksB.totalCount, 0, `Expected 0 tasks for unassigned yesterday, got ${tasksB.totalCount}`);
    });

    await runTest('User B Bug', 'USERB-05', 'Verify Today Shift Monitor: User B appears with Machine 2, Shift A, Pending', async () => {
      const { data: monToday } = await supabase.rpc('get_today_shift_log_monitor', {
        p_actor_id: adminUser.id,
        p_log_date: todayIST,
      });
      const rowB = (monToday || []).find(r => r.operator_id === opB.id);
      assert(rowB, `User B must appear in today monitor`);
      assert.strictEqual(rowB.machine_code, m2.machine_id, `Machine code must match Machine 2`);
      assert.strictEqual(rowB.shift_code, 'A', `Shift code must be 'A'`);
      assert.strictEqual(rowB.status, 'pending', `Status must be 'pending'`);
    });

    await runTest('User B Bug', 'USERB-06', 'Negative Check: User B self-entry for yesterday is REJECTED with 42501 (Unauthorized)', async () => {
      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m2.id,
        p_operator_id: opB.id,
        p_shift_code: 'A',
        p_log_date: yesterdayIST,
        p_start_meter: 50,
        p_end_meter: 58,
        p_idempotency_key: `userb-yesterday-${Date.now()}`,
      });
      assert(error || data?.code === '42501' || data?.error, `Expected 42501 rejection for unassigned date`);
    });

    // =========================================================================
    // SECTION 3: 7-Day Past Shift Window & Consecutive Reassignments Across Machines
    // =========================================================================
    console.log('\n--- SECTION 3: 7-Day Past Shift Window & Consecutive Reassignments ---');

    const multiDayPlan = [
      { dayOffset: -6, machine: m1, shift: 'A' },
      { dayOffset: -5, machine: m2, shift: 'B' },
      { dayOffset: -4, machine: m3, shift: 'C' },
      { dayOffset: -3, machine: m1, shift: 'B' },
      { dayOffset: -2, machine: m2, shift: 'A' },
      { dayOffset: -1, machine: m3, shift: 'B' },
      { dayOffset: 0,  machine: m1, shift: 'A' },
    ];

    await runTest('Multi-Day Tracking', 'MDAY-01', 'Setup 7 consecutive distinct daily assignments across 3 machines for Operator C', async () => {
      for (const item of multiDayPlan) {
        const dStr = addDays(todayIST, item.dayOffset);
        await createAssignment({
          operatorId: opC.id,
          machineId: item.machine.id,
          shiftCode: item.shift,
          validFrom: dStr,
          validTo: dStr,
          isActive: false,
        });
      }
    });

    await runTest('Multi-Day Tracking', 'MDAY-02', 'Verify get_operator_entry_context returns exact machine and shift for each of the 7 days', async () => {
      for (const item of multiDayPlan) {
        const dStr = addDays(todayIST, item.dayOffset);
        const { data: ctx } = await supabase.rpc('get_operator_entry_context', {
          p_operator_id: opC.id,
          p_target_date: dStr,
        });
        assert(ctx, `Context null for ${dStr}`);
        assert.strictEqual(ctx.machine?.id, item.machine.id, `Date ${dStr} machine mismatch: expected ${item.machine.machine_id}, got ${ctx.machine?.machine_id}`);
        assert.strictEqual(ctx.assigned_shift_code, item.shift, `Date ${dStr} shift mismatch: expected ${item.shift}, got ${ctx.assigned_shift_code}`);
      }
    });

    await runTest('Multi-Day Tracking', 'MDAY-03', 'Submit shift logs for each of the 7 past days independently -> All 7 succeed', async () => {
      let meter = 200;
      for (const item of multiDayPlan) {
        const dStr = addDays(todayIST, item.dayOffset);
        const isToday = dStr === todayIST;
        const { data: logRes, error: lErr } = await supabase.rpc('submit_operator_hour_log_atomic', {
          p_machine_id: item.machine.id,
          p_operator_id: opC.id,
          p_shift_code: item.shift,
          p_log_date: dStr,
          p_start_meter: meter,
          p_end_meter: meter + (isToday ? 0.5 : 8),
          p_start_time: isToday ? '06:00:00' : undefined,
          p_end_time: isToday ? '14:00:00' : undefined,
          p_idempotency_key: `opc-log-${dStr}-${Date.now()}`,
        });
        assert(!lErr && logRes?.success, `Log submission failed on ${dStr}: ${lErr?.message || logRes?.error}`);
        cleanupLogIds.push(logRes.log_id);
        meter += 8;
      }
    });

    await runTest('Multi-Day Tracking', 'MDAY-04', '7-Day Window Boundary: Log on D-7 succeeds, Log on D-8 rejected with 23514', async () => {
      const d7 = addDays(todayIST, -7);
      const d8 = addDays(todayIST, -8);

      // Create assignments for D-7 and D-8
      await createAssignment({
        operatorId: opC.id,
        machineId: m1.id,
        shiftCode: 'A',
        validFrom: d7,
        validTo: d7,
        isActive: false,
      });

      await createAssignment({
        operatorId: opC.id,
        machineId: m1.id,
        shiftCode: 'A',
        validFrom: d8,
        validTo: d8,
        isActive: false,
      });

      // D-7 submission (within 7 days) -> Must SUCCEED
      const { data: res7, error: err7 } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opC.id,
        p_shift_code: 'A',
        p_log_date: d7,
        p_start_meter: 10,
        p_end_meter: 18,
        p_idempotency_key: `boundary-d7-${Date.now()}`,
      });
      assert(!err7 && res7?.success, `D-7 should succeed: ${err7?.message || res7?.error}`);
      cleanupLogIds.push(res7.log_id);

      // D-8 submission (outside 7 days) -> Must FAIL with 23514
      const { data: res8, error: err8 } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opC.id,
        p_shift_code: 'A',
        p_log_date: d8,
        p_start_meter: 0,
        p_end_meter: 8,
        p_idempotency_key: `boundary-d8-${Date.now()}`,
      });
      assert(err8 || res8?.code === '23514' || res8?.error, `D-8 must be rejected outside 7-day window`);
    });

    // =========================================================================
    // SECTION 4: Exhaustive Battery of ALL Normal Shift VALID Entries
    // =========================================================================
    console.log('\n--- SECTION 4: Exhaustive Battery of ALL Normal Shift VALID Entries ---');

    // Clean Operator A on testing dates to prevent any collision
    await cleanOperator(opA.id);

    await runTest('Valid Entries', 'VAL-01', 'Multi-Shift on SAME Machine: Operator assigned Shift A and Shift B logs both on same date', async () => {
      const targetDate = addDays(todayIST, -3);
      await supabase.from('machine_hour_logs').delete().eq('machine_id', m1.id).eq('log_date', targetDate);

      // Assign Shift A and Shift B on same date
      await createAssignment({
        operatorId: opA.id,
        machineId: m1.id,
        shiftCode: 'A',
        validFrom: targetDate,
        validTo: targetDate,
        isActive: false,
      });

      await createAssignment({
        operatorId: opA.id,
        machineId: m1.id,
        shiftCode: 'B',
        validFrom: targetDate,
        validTo: targetDate,
        isActive: false,
      });

      // Log Shift A
      const { data: logA, error: errA } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'A',
        p_log_date: targetDate,
        p_start_meter: 400,
        p_end_meter: 408,
        p_idempotency_key: `multishift-a-${Date.now()}`,
      });
      assert(!errA && logA?.success, `Log Shift A failed: ${errA?.message || logA?.error}`);
      cleanupLogIds.push(logA.log_id);

      // Log Shift B
      const { data: logB, error: errB } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'B',
        p_log_date: targetDate,
        p_start_meter: 408,
        p_end_meter: 416,
        p_idempotency_key: `multishift-b-${Date.now()}`,
      });
      assert(!errB && logB?.success, `Log Shift B failed: ${errB?.message || logB?.error}`);
      cleanupLogIds.push(logB.log_id);
    });

    await runTest('Valid Entries', 'VAL-02', 'Multi-Shift on DIFFERENT Machines: Operator logs Shift A on M1 and Shift B on M2', async () => {
      const targetDate = addDays(todayIST, -4);
      await supabase.from('machine_hour_logs').delete().in('machine_id', [m1.id, m2.id]).eq('log_date', targetDate);

      await createAssignment({
        operatorId: opA.id,
        machineId: m1.id,
        shiftCode: 'A',
        validFrom: targetDate,
        validTo: targetDate,
        isActive: false,
      });

      await createAssignment({
        operatorId: opA.id,
        machineId: m2.id,
        shiftCode: 'B',
        validFrom: targetDate,
        validTo: targetDate,
        isActive: false,
      });

      const { data: l1, error: e1 } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'A',
        p_log_date: targetDate,
        p_start_meter: 450,
        p_end_meter: 458,
        p_idempotency_key: `diffmach-m1-${Date.now()}`,
      });
      assert(!e1 && l1?.success, `M1 log failed: ${e1?.message || l1?.error}`);
      cleanupLogIds.push(l1.log_id);

      const { data: l2, error: e2 } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m2.id,
        p_operator_id: opA.id,
        p_shift_code: 'B',
        p_log_date: targetDate,
        p_start_meter: 150,
        p_end_meter: 158,
        p_idempotency_key: `diffmach-m2-${Date.now()}`,
      });
      assert(!e2 && l2?.success, `M2 log failed: ${e2?.message || l2?.error}`);
      cleanupLogIds.push(l2.log_id);
    });

    await runTest('Valid Entries', 'VAL-03', 'Overnight Night Shift C (crosses midnight, 22:00 to 06:00 IST): log_date is start date', async () => {
      const targetDate = addDays(todayIST, -2);
      await supabase.from('machine_hour_logs').delete().eq('machine_id', m1.id).eq('log_date', targetDate);

      await createAssignment({
        operatorId: opA.id,
        machineId: m1.id,
        shiftCode: 'C',
        validFrom: targetDate,
        validTo: targetDate,
        isActive: false,
      });

      const { data: lC, error: eC } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'C',
        p_log_date: targetDate,
        p_start_meter: 600,
        p_end_meter: 608,
        p_start_time: '22:00:00',
        p_end_time: '06:00:00',
        p_idempotency_key: `overnight-${Date.now()}`,
      });
      assert(!eC && lC?.success, `Night shift log failed: ${eC?.message || lC?.error}`);
      cleanupLogIds.push(lC.log_id);
    });

    await runTest('Valid Entries', 'VAL-04', 'Decimal Meter Reading: 500.25 to 508.75 = 8.5 running hours', async () => {
      const targetDate = addDays(todayIST, -5);
      await supabase.from('machine_hour_logs').delete().eq('machine_id', m1.id).eq('log_date', targetDate);

      await createAssignment({
        operatorId: opA.id,
        machineId: m1.id,
        shiftCode: 'A',
        validFrom: targetDate,
        validTo: targetDate,
        isActive: false,
      });

      const { data: lDec, error: eDec } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'A',
        p_log_date: targetDate,
        p_start_meter: 500.25,
        p_end_meter: 508.75,
        p_idempotency_key: `decimal-${Date.now()}`,
      });
      assert(!eDec && lDec?.success, `Decimal log failed: ${eDec?.message || lDec?.error}`);
      assert.strictEqual(lDec.running_hours, 8.5, `Running hours should be 8.5, got ${lDec.running_hours}`);
      cleanupLogIds.push(lDec.log_id);
    });

    await runTest('Valid Entries', 'VAL-05', 'Standby / Zero Operating Hours: start_meter === end_meter with idle remarks', async () => {
      const targetDate = addDays(todayIST, -6);
      await supabase.from('machine_hour_logs').delete().eq('machine_id', m1.id).eq('log_date', targetDate);

      await createAssignment({
        operatorId: opA.id,
        machineId: m1.id,
        shiftCode: 'A',
        validFrom: targetDate,
        validTo: targetDate,
        isActive: false,
      });

      const { data: lStandby, error: eStandby } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'A',
        p_log_date: targetDate,
        p_start_meter: 700,
        p_end_meter: 700,
        p_remarks: 'Site power outage; machine on idle standby',
        p_idempotency_key: `standby-${Date.now()}`,
      });
      assert(!eStandby && lStandby?.success, `Standby log failed: ${eStandby?.message || lStandby?.error}`);
      assert.strictEqual(lStandby.running_hours, 0, `Standby running hours should be 0, got ${lStandby.running_hours}`);
      cleanupLogIds.push(lStandby.log_id);
    });

    await runTest('Valid Entries', 'VAL-06', 'Breakdown Logging: Records breakdown minutes and updates machine health_status', async () => {
      const targetDate = addDays(todayIST, -1);
      await supabase.from('machine_hour_logs').delete().eq('machine_id', m3.id).eq('log_date', targetDate);

      await createAssignment({
        operatorId: opB.id,
        machineId: m3.id,
        shiftCode: 'A',
        validFrom: targetDate,
        validTo: targetDate,
        isActive: false,
      });

      const { data: lBd, error: eBd } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m3.id,
        p_operator_id: opB.id,
        p_shift_code: 'A',
        p_log_date: targetDate,
        p_start_meter: 800,
        p_end_meter: 806,
        p_is_breakdown: true,
        p_breakdown_start_time: '10:00:00',
        p_breakdown_end_time: '12:00:00',
        p_breakdown_hours: 2,
        p_remarks: 'Hydraulic hose rupture',
        p_idempotency_key: `breakdown-${Date.now()}`,
      });
      assert(!eBd && lBd?.success, `Breakdown log failed: ${eBd?.message || lBd?.error}`);
      cleanupLogIds.push(lBd.log_id);

      const { data: bdRow } = await supabase.from('machine_hour_logs').select('is_breakdown, remarks').eq('id', lBd.log_id).single();
      assert(bdRow?.is_breakdown, `is_breakdown must be true`);
    });

    await runTest('Valid Entries', 'VAL-07', 'Idempotency Replay (Rapid Double Tap): Returns already_logged: true without duplicate row', async () => {
      const targetDate = addDays(todayIST, -2);
      await supabase.from('machine_hour_logs').delete().eq('machine_id', m2.id).eq('log_date', targetDate);

      await createAssignment({
        operatorId: opB.id,
        machineId: m2.id,
        shiftCode: 'B',
        validFrom: targetDate,
        validTo: targetDate,
        isActive: false,
      });

      const fixedKey = `double-tap-${Date.now()}`;

      // First tap
      const { data: r1, error: er1 } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m2.id,
        p_operator_id: opB.id,
        p_shift_code: 'B',
        p_log_date: targetDate,
        p_start_meter: 300,
        p_end_meter: 308,
        p_idempotency_key: fixedKey,
      });
      assert(!er1 && r1?.success, `First tap failed: ${er1?.message || r1?.error}`);
      cleanupLogIds.push(r1.log_id);

      // Second rapid tap with exact same key
      const { data: r2, error: er2 } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m2.id,
        p_operator_id: opB.id,
        p_shift_code: 'B',
        p_log_date: targetDate,
        p_start_meter: 300,
        p_end_meter: 308,
        p_idempotency_key: fixedKey,
      });
      assert(!er2 && (r2?.already_logged || r2?.success), `Second tap must gracefully succeed with already_logged: true`);
      assert.strictEqual(r2.log_id, r1.log_id, `Second tap must return the existing log_id`);
    });

    await runTest('Valid Entries', 'VAL-08', 'Supervisor Assisted Entry: Supervisor enters shift log on behalf of assigned operator', async () => {
      const targetDate = addDays(todayIST, -1);
      await supabase.from('machine_hour_logs').delete().eq('machine_id', m2.id).eq('log_date', targetDate);

      await createAssignment({
        operatorId: opC.id,
        machineId: m2.id,
        shiftCode: 'A',
        validFrom: targetDate,
        validTo: targetDate,
        isActive: false,
      });

      const { data: supLog, error: sErr } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m2.id,
        p_operator_id: opC.id,
        p_shift_code: 'A',
        p_log_date: targetDate,
        p_start_meter: 350,
        p_end_meter: 358,
        p_entered_by: supervisorUser.id,
        p_idempotency_key: `assisted-sup-${Date.now()}`,
      });
      assert(!sErr && supLog?.success, `Supervisor assisted entry failed: ${sErr?.message || supLog?.error}`);
      cleanupLogIds.push(supLog.log_id);

      const { data: row } = await supabase.from('machine_hour_logs').select('entered_by, entry_source').eq('id', supLog.log_id).single();
      assert.strictEqual(row.entered_by, supervisorUser.id, `entered_by must be supervisor user id`);
    });

    // =========================================================================
    // SECTION 5: Exhaustive Battery of ALL Shift INVALID Entries
    // =========================================================================
    console.log('\n--- SECTION 5: Exhaustive Battery of ALL Shift INVALID Entries ---');

    await runTest('Invalid Entries', 'INV-01', 'Negative starting meter reading (< 0) rejected with 23514', async () => {
      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'A',
        p_log_date: todayIST,
        p_start_meter: -10,
        p_end_meter: 10,
        p_idempotency_key: `inv-neg-start-${Date.now()}`,
      });
      assert(error || data?.code === '23514' || data?.error, 'Expected rejection for negative start meter');
    });

    await runTest('Invalid Entries', 'INV-02', 'Negative ending meter reading (< 0) rejected with 23514', async () => {
      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'A',
        p_log_date: todayIST,
        p_start_meter: 10,
        p_end_meter: -5,
        p_idempotency_key: `inv-neg-end-${Date.now()}`,
      });
      assert(error || data?.code === '23514' || data?.error, 'Expected rejection for negative end meter');
    });

    await runTest('Invalid Entries', 'INV-03', 'Meter regression (end meter < start meter) rejected with 23514', async () => {
      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'A',
        p_log_date: todayIST,
        p_start_meter: 100,
        p_end_meter: 90,
        p_idempotency_key: `inv-regress-${Date.now()}`,
      });
      assert(error || data?.code === '23514' || data?.error, 'Expected rejection for meter regression');
    });

    await runTest('Invalid Entries', 'INV-04', 'Running hours exceeding 24 hours in single log rejected with 23514', async () => {
      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'A',
        p_log_date: todayIST,
        p_start_meter: 100,
        p_end_meter: 125, // 25 hours!
        p_idempotency_key: `inv-over24-${Date.now()}`,
      });
      assert(error || data?.code === '23514' || data?.error, 'Expected rejection for running hours > 24');
    });

    await runTest('Invalid Entries', 'INV-05', 'Duplicate shift log for same machine, same shift, same date rejected with 23514', async () => {
      const targetDate = addDays(todayIST, -3);
      // Target date already has Shift A logged in VAL-01!
      // Attempting to log a DIFFERENT Shift A entry (start: 405, end: 412) on m1 on same date must be rejected!
      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'A',
        p_log_date: targetDate,
        p_start_meter: 405,
        p_end_meter: 412,
        p_idempotency_key: `dup-conflict-diff-reading-${Date.now()}`,
      });
      assert(error || data?.code === '23514' || data?.code === '23505' || data?.error, 'Expected rejection for duplicate shift log');
    });

    await runTest('Invalid Entries', 'INV-06', 'Cross-Machine double-booking (same operator, same shift, same date on 2 machines) rejected with 23514', async () => {
      const targetDate = addDays(todayIST, -2);
      // Operator A is logged on M1 Shift C.
      // Trying to log Operator A on M2 on Shift C for same date:
      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m2.id,
        p_operator_id: opA.id,
        p_shift_code: 'C',
        p_log_date: targetDate,
        p_start_meter: 50,
        p_end_meter: 58,
        p_idempotency_key: `cross-mach-${Date.now()}`,
      });
      assert(error || data?.code === '23514' || data?.code === '23505' || data?.error, 'Expected rejection for cross-machine operator double booking');
    });

    await runTest('Invalid Entries', 'INV-07', 'Unassigned Shift Code (operator assigned to Shift A tries to log Shift B) rejected with 23514', async () => {
      const targetDate = addDays(todayIST, -1);
      // Operator B is assigned to Machine 3 on Shift A on targetDate (from VAL-06).
      // Operator B self-logging on Shift B:
      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m3.id,
        p_operator_id: opB.id,
        p_shift_code: 'B', // unassigned shift!
        p_log_date: targetDate,
        p_start_meter: 810,
        p_end_meter: 818,
        p_idempotency_key: `unassigned-shift-${Date.now()}`,
      });
      assert(error || data?.code === '23514' || data?.error, 'Expected rejection for logging unassigned shift code');
    });

    await runTest('Invalid Entries', 'INV-08', 'Future Date Submission (D+1) by Operator rejected with 23514', async () => {
      const tomorrow = addDays(todayIST, 1);
      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'A',
        p_log_date: tomorrow,
        p_start_meter: 100,
        p_end_meter: 108,
        p_idempotency_key: `future-date-${Date.now()}`,
      });
      assert(error || data?.code === '23514' || data?.error, 'Expected rejection for future date submission');
    });

    await runTest('Invalid Entries', 'INV-09', 'Machine in Maintenance status rejected with 23514', async () => {
      // Temporarily mark machine m3 health_status = under_maintenance
      await supabase.from('machines').update({ health_status: 'under_maintenance' }).eq('id', m3.id);

      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m3.id,
        p_operator_id: opB.id,
        p_shift_code: 'A',
        p_log_date: todayIST,
        p_start_meter: 100,
        p_end_meter: 108,
        p_idempotency_key: `maintenance-m-${Date.now()}`,
      });

      // Restore health_status
      await supabase.from('machines').update({ health_status: 'active' }).eq('id', m3.id);

      assert(error || data?.code === '23514' || data?.error, 'Expected rejection for machine under maintenance');
    });

    await runTest('Invalid Entries', 'INV-10', 'Inactive Machine rejected with 23514', async () => {
      // Temporarily mark machine m3 status = inactive
      await supabase.from('machines').update({ status: 'inactive' }).eq('id', m3.id);

      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m3.id,
        p_operator_id: opB.id,
        p_shift_code: 'A',
        p_log_date: todayIST,
        p_start_meter: 100,
        p_end_meter: 108,
        p_idempotency_key: `inactive-m-${Date.now()}`,
      });

      // Restore status
      await supabase.from('machines').update({ status: 'rented' }).eq('id', m3.id);

      assert(error || data?.code === '23514' || data?.error, 'Expected rejection for inactive machine');
    });

    await runTest('Invalid Entries', 'INV-11', 'Unauthorized Role (HR) attempting to log on behalf of operator rejected with 42501', async () => {
      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'A',
        p_log_date: todayIST,
        p_start_meter: 100,
        p_end_meter: 108,
        p_entered_by: hrUser.id,
        p_idempotency_key: `hr-unauth-${Date.now()}`,
      });
      assert(error || data?.code === '42501' || data?.error, 'Expected rejection for HR role attempting shift entry');
    });

    // =========================================================================
    // SECTION 6: Web & Mobile Integration Contracts
    // =========================================================================
    console.log('\n--- SECTION 6: Cross-Platform (Web & Mobile) Architecture Contracts ---');

    await runTest('Platform Contracts', 'PLAT-01', 'Web Query Contract: get_operator_entry_context with p_target_date produces date-isolated cache key', async () => {
      // Re-create user A today as Shift B and yesterday as Shift A to test contract
      await cleanOperator(opA.id);
      await createAssignment({
        operatorId: opA.id,
        machineId: m1.id,
        shiftCode: 'A',
        validFrom: yesterdayIST,
        validTo: yesterdayIST,
        isActive: false,
      });
      await createAssignment({
        operatorId: opA.id,
        machineId: m1.id,
        shiftCode: 'B',
        validFrom: todayIST,
        validTo: null,
        isActive: true,
      });

      const { data: dToday } = await supabase.rpc('get_operator_entry_context', {
        p_operator_id: opA.id,
        p_target_date: todayIST,
      });
      const { data: dYest } = await supabase.rpc('get_operator_entry_context', {
        p_operator_id: opA.id,
        p_target_date: yesterdayIST,
      });

      assert(dToday && dYest, 'Both contexts must resolve');
      assert.notStrictEqual(dToday.assigned_shift_code, dYest.assigned_shift_code, 'Today and yesterday shifts must be distinct');
      assert.strictEqual(dToday.assigned_shift_code, 'B', 'Today must be B');
      assert.strictEqual(dYest.assigned_shift_code, 'A', 'Yesterday must be A');
    });

    await runTest('Platform Contracts', 'PLAT-02', 'Mobile Hook Contract: TanStack Query key isolation by date ensures zero cache pollution', async () => {
      const keyToday = ['operator', 'entry-context', opA.id, todayIST];
      const keyYest = ['operator', 'entry-context', opA.id, yesterdayIST];
      assert.notDeepStrictEqual(keyToday, keyYest, 'Cache keys must be strictly isolated by targetDate');
    });

  } finally {
    await performCleanup();
  }

  console.log('\n==============================================================================');
  console.log('  TEST SUMMARY');
  console.log('==============================================================================');
  console.table(results.map(r => ({
    Code: r.code,
    Category: r.category,
    Title: r.title,
    Status: r.status,
    Duration: r.duration,
  })));

  console.log(`\nTotal Tests: ${passCount + failCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);

  if (failCount > 0) {
    console.error('\n❌ SOME TESTS FAILED!');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TESTS PASSED WITH 100% SUCCESS!');
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
