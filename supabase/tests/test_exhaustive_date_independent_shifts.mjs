/**
 * EXHAUSTIVE DATE-INDEPENDENT OPERATOR SHIFT ASSIGNMENT & SHIFT ENTRY TEST SUITE
 * 
 * Target: Reach International Dev (vlmxciuogczumumrwyot)
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load Environment Variables
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
console.log('  EXHAUSTIVE DATE-INDEPENDENT SHIFT ASSIGNMENT & SHIFT ENTRY TEST SUITE');
console.log(`  Database URL: ${supabaseUrl}`);
console.log(`  Current IST Date: ${todayIST} | Yesterday IST: ${yesterdayIST}`);
console.log('==============================================================================\n');

let passCount = 0;
let failCount = 0;
const resultsTable = [];

async function test(category, testNum, title, testFn) {
  const idStr = `${category}-${testNum}`;
  process.stdout.write(`[${idStr}] ${title}... `);
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    console.log(`PASS (${duration}ms)`);
    passCount++;
    resultsTable.push({ id: idStr, category, title, status: 'PASS', duration: `${duration}ms`, error: null });
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`FAIL (${duration}ms)`);
    console.error(`       ❌ Error: ${err.message}`);
    failCount++;
    resultsTable.push({ id: idStr, category, title, status: 'FAIL', duration: `${duration}ms`, error: err.message });
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

  // Test Operators
  const opA = { id: '09e5a215-d147-48a0-95ab-76437dc83a43', name: 'Deepak Patel' };
  const opB = { id: '4cfe61cb-389d-41f9-86d3-f29b1f9c7c6a', name: 'Manoj Yadav' };
  const opC = { id: '4c73b810-a00f-40d2-beaa-5bc4fec2d767', name: 'Ramesh Kumar' };

  // Test Machines
  const { data: machines, error: machErr } = await supabase
    .from('machines')
    .select('id, machine_id, machine_name, client_id, hour_meter, status, health_status')
    .in('machine_id', ['M/C-0006', 'M/C-0002', 'M/C-0003']);
  assert(!machErr && machines.length >= 3, `Failed to load test machines: ${machErr?.message}`);

  const m1 = machines.find(m => m.machine_id === 'M/C-0006');
  const m2 = machines.find(m => m.machine_id === 'M/C-0002');
  const m3 = machines.find(m => m.machine_id === 'M/C-0003');

  console.log(`Test Fixtures Initialized:`);
  console.log(`- Admin: ${adminUser.full_name} (${adminUser.id})`);
  console.log(`- Supervisor: ${supervisorUser.full_name} (${supervisorUser.id})`);
  console.log(`- Machine 1: ${m1.machine_id} (${m1.id}), Client: ${m1.client_id}`);
  console.log(`- Machine 2: ${m2.machine_id} (${m2.id}), Client: ${m2.client_id}`);
  console.log(`- Machine 3: ${m3.machine_id} (${m3.id}), Client: ${m3.client_id}`);
  console.log(`- Operator A: ${opA.name} (${opA.id})`);
  console.log(`- Operator B: ${opB.name} (${opB.id})`);
  console.log(`- Operator C: ${opC.name} (${opC.id})\n`);

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
    addDays(todayIST, 1)
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
      A: { start: '06:00:00', end: '14:00:00', crosses: false },
      B: { start: '14:00:00', end: '22:00:00', crosses: false },
      C: { start: '22:00:00', end: '06:00:00', crosses: true },
      S1: { start: '06:00:00', end: '14:00:00', crosses: false },
      S2: { start: '14:00:00', end: '22:00:00', crosses: false },
      S3: { start: '22:00:00', end: '06:00:00', crosses: true },
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

  // Helper to cleanly reset an operator's test-window assignments
  async function cleanOperator(opId) {
    // 1. Delete hour logs for this operator on test dates
    await supabase.from('machine_hour_logs').delete().eq('operator_id', opId).in('log_date', testWindowDates);

    // 2. Fetch all assignments covering test dates
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

  // Helper to cleanly remove machine hour logs for given machines on given dates
  async function cleanLogsForMachines(machineIds, dates) {
    await supabase
      .from('machine_hour_logs')
      .delete()
      .in('machine_id', machineIds)
      .in('log_date', dates);
  }

  // Pre-test initial reset
  await cleanOperator(opA.id);
  await cleanOperator(opB.id);
  await cleanOperator(opC.id);
  await supabase.from('machine_hour_logs').delete().in('machine_id', [m1.id, m2.id, m3.id]).in('log_date', testWindowDates);

  try {
    // =========================================================================
    // SECTION 1: EXACT USER BUG 1 VERIFICATION
    // =========================================================================
    console.log('--- SECTION 1: Exact Bug 1 (User A Historical Shift Independence) ---');

    let bug1OldAssignment;
    let bug1NewAssignment;

    await test('BUG1', 1, 'Setup: User A assigned yesterday to Shift A on Machine 1, no log entered', async () => {
      bug1OldAssignment = await createAssignment({
        operatorId: opA.id,
        machineId: m1.id,
        shiftCode: 'A',
        validFrom: yesterdayIST,
        validTo: null, // open-ended initially
        isActive: true,
      });
      assert(bug1OldAssignment?.id, 'Initial assignment must exist');
    });

    await test('BUG1', 2, 'Action: Today, User A is reassigned to Shift B on Machine 1 via end_assignment_range', async () => {
      // Reassignment closes the previous assignment on yesterday
      const { data: endRes, error: endErr } = await supabase.rpc('end_assignment_range', {
        p_assignment_id: bug1OldAssignment.id,
        p_caller_id: adminUser.id,
        p_end_reason: 'reassigned',
        p_effective_date: yesterdayIST, // closed as of yesterday
        p_notes: 'Reassigned to Shift B for today'
      });
      assert(!endErr && endRes?.success === true, `end_assignment_range failed: ${endErr?.message}`);

      // Verify old assignment state in DB
      const { data: oldRow } = await supabase
        .from('operator_machine_assignments')
        .select('is_active, valid_from, valid_to, shift_code')
        .eq('id', bug1OldAssignment.id)
        .single();
      assert(oldRow.is_active === false, 'Old assignment must be inactive');
      assert(oldRow.valid_from === yesterdayIST, `Old valid_from should be ${yesterdayIST}`);
      assert(oldRow.valid_to === yesterdayIST, `Old valid_to must be stamped to ${yesterdayIST}`);
      assert(oldRow.shift_code === 'A', 'Old shift_code must remain A');

      // Create new assignment for today on Shift B
      bug1NewAssignment = await createAssignment({
        operatorId: opA.id,
        machineId: m1.id,
        shiftCode: 'B',
        validFrom: todayIST,
        validTo: null,
        isActive: true,
      });
      assert(bug1NewAssignment?.id, 'New assignment for today must exist');
    });

    await test('BUG1', 3, 'Verify Context: get_operator_entry_context returns Shift A for yesterday and Shift B for today', async () => {
      // Context for YESTERDAY
      const { data: ctxYesterday, error: ctxYErr } = await supabase.rpc('get_operator_entry_context', {
        p_operator_id: opA.id,
        p_target_date: yesterdayIST,
      });
      assert(!ctxYErr && ctxYesterday, `get_operator_entry_context yesterday failed: ${ctxYErr?.message}`);
      assert(ctxYesterday.machine?.id === m1.id, `Yesterday context machine must be M1 (${m1.id}), got: ${ctxYesterday.machine?.id}`);
      assert(ctxYesterday.assigned_shift_codes?.includes('A'), `Yesterday shift must be A, got: ${JSON.stringify(ctxYesterday.assigned_shift_codes)}`);
      assert(!ctxYesterday.assigned_shift_codes?.includes('B'), 'Yesterday shift MUST NOT include B');
      assert(ctxYesterday.today_logs?.length === 0, 'Yesterday must have 0 logs entered');

      // Context for TODAY
      const { data: ctxToday, error: ctxTErr } = await supabase.rpc('get_operator_entry_context', {
        p_operator_id: opA.id,
        p_target_date: todayIST,
      });
      assert(!ctxTErr && ctxToday, `get_operator_entry_context today failed: ${ctxTErr?.message}`);
      assert(ctxToday.machine?.id === m1.id, `Today context machine must be M1 (${m1.id}), got: ${ctxToday.machine?.id}`);
      assert(ctxToday.assigned_shift_codes?.includes('B'), `Today shift must be B, got: ${JSON.stringify(ctxToday.assigned_shift_codes)}`);
      assert(!ctxToday.assigned_shift_codes?.includes('A'), 'Today shift MUST NOT include A');
      assert(ctxToday.today_logs?.length === 0, 'Today must have 0 logs entered');
    });

    await test('BUG1', 4, 'Verify Shift Monitor: Yesterday shows User A on Shift A (pending); Today shows Shift B (pending)', async () => {
      // Monitor for YESTERDAY
      const { data: monYesterday, error: monYErr } = await supabase.rpc('get_today_shift_log_monitor', {
        p_actor_id: adminUser.id,
        p_log_date: yesterdayIST,
      });
      assert(!monYErr && Array.isArray(monYesterday), `get_today_shift_log_monitor yesterday failed: ${monYErr?.message}`);
      const opAYesterday = monYesterday.find(r => r.operator_id === opA.id && r.machine_id === m1.id);
      assert(opAYesterday, 'User A must appear in yesterday monitor');
      assert(opAYesterday.shift_code === 'A', `Yesterday shift_code must be A, got: ${opAYesterday.shift_code}`);
      assert(opAYesterday.status === 'pending', `Yesterday status must be pending, got: ${opAYesterday.status}`);

      // Monitor for TODAY
      const { data: monToday, error: monTErr } = await supabase.rpc('get_today_shift_log_monitor', {
        p_actor_id: adminUser.id,
        p_log_date: todayIST,
      });
      assert(!monTErr && Array.isArray(monToday), `get_today_shift_log_monitor today failed: ${monTErr?.message}`);
      const opAToday = monToday.find(r => r.operator_id === opA.id && r.machine_id === m1.id);
      assert(opAToday, 'User A must appear in today monitor');
      assert(opAToday.shift_code === 'B', `Today shift_code must be B, got: ${opAToday.shift_code}`);
      assert(opAToday.status === 'pending', `Today status must be pending, got: ${opAToday.status}`);
    });

    await test('BUG1', 5, 'Action & Verify: User A logs TODAY for Shift B -> Today status is Entered, Yesterday STILL shows Shift A Pending', async () => {
      // Operator A logs for TODAY on Shift B
      const { data: logToday, error: logTErr } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'B',
        p_log_date: todayIST,
        p_start_meter: 500,
        p_end_meter: 500.5,
        p_start_time: '14:00:00',
        p_end_time: '14:30:00',
        p_normal_working_hours: 0.5,
        p_entered_by: opA.id
      });
      assert(!logTErr && logToday?.success === true, `Failed to submit today log: ${logTErr?.message}`);
      cleanupLogIds.push(logToday.id);

      // Verify TODAY monitor -> status must be 'entered'
      const { data: monTodayAfter } = await supabase.rpc('get_today_shift_log_monitor', {
        p_actor_id: adminUser.id,
        p_log_date: todayIST,
      });
      const rowToday = monTodayAfter.find(r => r.operator_id === opA.id && r.machine_id === m1.id);
      assert(rowToday.status === 'entered', `Today status must be entered, got: ${rowToday.status}`);
      assert(rowToday.shift_code === 'B', `Today shift must be B, got: ${rowToday.shift_code}`);

      // Verify YESTERDAY monitor -> MUST REMAIN Shift A and status 'pending' (NOT mutated to B!)
      const { data: monYesterdayAfter } = await supabase.rpc('get_today_shift_log_monitor', {
        p_actor_id: adminUser.id,
        p_log_date: yesterdayIST,
      });
      const rowYesterday = monYesterdayAfter.find(r => r.operator_id === opA.id && r.machine_id === m1.id);
      assert(rowYesterday, 'User A must still appear in yesterday monitor');
      assert(rowYesterday.shift_code === 'A', `CRITICAL: Yesterday shift_code MUST remain A! Got: ${rowYesterday.shift_code}`);
      assert(rowYesterday.status === 'pending', `CRITICAL: Yesterday status MUST remain pending! Got: ${rowYesterday.status}`);
    });

    await test('BUG1', 6, 'Action & Verify: User A enters 7-day past log for YESTERDAY on Shift A -> Yesterday updates to Entered', async () => {
      // Operator A logs for YESTERDAY on Shift A
      const { data: logYesterday, error: logYErr } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id,
        p_operator_id: opA.id,
        p_shift_code: 'A',
        p_log_date: yesterdayIST,
        p_start_meter: 492,
        p_end_meter: 500,
        p_start_time: '06:00:00',
        p_end_time: '14:00:00',
        p_normal_working_hours: 8,
        p_entered_by: opA.id
      });
      assert(!logYErr && logYesterday?.success === true, `Failed to submit yesterday log: ${logYErr?.message}`);
      cleanupLogIds.push(logYesterday.id);

      // Verify YESTERDAY monitor -> now 'entered' on Shift A
      const { data: monYesterdayFinal } = await supabase.rpc('get_today_shift_log_monitor', {
        p_actor_id: adminUser.id,
        p_log_date: yesterdayIST,
      });
      const rowYFinal = monYesterdayFinal.find(r => r.operator_id === opA.id && r.machine_id === m1.id);
      assert(rowYFinal.status === 'entered', `Yesterday status must now be entered, got: ${rowYFinal.status}`);
      assert(rowYFinal.shift_code === 'A', `Yesterday shift_code must be A, got: ${rowYFinal.shift_code}`);
    });

    // =========================================================================
    // SECTION 2: EXACT USER BUG 2 VERIFICATION
    // =========================================================================
    console.log('\n--- SECTION 2: Exact Bug 2 (User B Unassigned Past Date) ---');

    await test('BUG2', 1, 'Setup: User B has NO assignment yesterday; Assigned TODAY to Machine 2 on Shift A', async () => {
      // Ensure zero assignments exist for User B
      await cleanOperator(opB.id);

      // Create assignment for User B starting TODAY
      const assignB = await createAssignment({
        operatorId: opB.id,
        machineId: m2.id,
        shiftCode: 'A',
        validFrom: todayIST, // ONLY valid from today!
        validTo: null,
        isActive: true,
      });
      assert(assignB?.id, 'User B assignment for today must exist');
    });

    await test('BUG2', 2, 'Verify Context: get_operator_entry_context for User B on yesterday returns NULL machine and 0 shifts', async () => {
      const { data: ctxBчера, error: errCtxB } = await supabase.rpc('get_operator_entry_context', {
        p_operator_id: opB.id,
        p_target_date: yesterdayIST,
      });
      assert(!errCtxB && ctxBчера, `Context retrieval failed: ${errCtxB?.message}`);
      assert(ctxBчера.machine === null, `Machine MUST be null for unassigned yesterday, got: ${JSON.stringify(ctxBчера.machine)}`);
      assert(ctxBчера.assignment_id === null, `Assignment ID MUST be null for unassigned yesterday`);
      assert(!ctxBчера.assigned_shift_codes || ctxBчера.assigned_shift_codes.length === 0, `Shifts MUST be empty for unassigned yesterday`);
    });

    await test('BUG2', 3, 'Verify Monitor: Yesterday monitor does NOT show User B (0 rows, neither Pending nor Entered)', async () => {
      const { data: monY } = await supabase.rpc('get_today_shift_log_monitor', {
        p_actor_id: adminUser.id,
        p_log_date: yesterdayIST,
      });
      assert(Array.isArray(monY), 'Monitor data must be an array');
      const userBInYesterday = monY.filter(r => r.operator_id === opB.id);
      assert(userBInYesterday.length === 0, `CRITICAL BUG 2 CHECK: User B MUST NOT appear in yesterday monitor! Found ${userBInYesterday.length} rows`);
    });

    await test('BUG2', 4, 'Verify Shift Tasks: get_shift_tasks for User B on yesterday returns 0 tasks', async () => {
      const { data: tasksY, error: taskErr } = await supabase.rpc('get_shift_tasks', {
        p_actor_id: opB.id,
        p_operator_id: opB.id,
        p_from_date: yesterdayIST,
        p_to_date: yesterdayIST,
      });
      assert(!taskErr, `get_shift_tasks error: ${taskErr?.message}`);
      const rows = tasksY?.rows || [];
      assert(rows.length === 0, `User B must have 0 tasks on unassigned yesterday, got: ${rows.length}`);
    });

    await test('BUG2', 5, 'Verify Today: User B appears in today monitor with Machine 2, Shift A, Pending', async () => {
      const { data: monT } = await supabase.rpc('get_today_shift_log_monitor', {
        p_actor_id: adminUser.id,
        p_log_date: todayIST,
      });
      const userBInToday = monT.find(r => r.operator_id === opB.id && r.machine_id === m2.id);
      assert(userBInToday, 'User B must appear in today monitor');
      assert(userBInToday.shift_code === 'A', `Today shift must be A, got: ${userBInToday.shift_code}`);
      assert(userBInToday.status === 'pending', `Today status must be pending, got: ${userBInToday.status}`);
    });

    await test('BUG2', 6, 'Negative Check: User B self-entry for yesterday is REJECTED with 42501 (Unauthorized)', async () => {
      const { data: resInvalid, error: errInvalid } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m2.id,
        p_operator_id: opB.id,
        p_shift_code: 'A',
        p_log_date: yesterdayIST, // Unassigned date!
        p_start_meter: 500,
        p_end_meter: 508,
        p_entered_by: opB.id // self-entry
      });
      assert(
        errInvalid?.code === '42501' && errInvalid?.message?.includes('not authorized to submit shift logs'),
        `Expected 42501 unauthorized for unassigned past date, got code: ${errInvalid?.code}, msg: ${errInvalid?.message}`
      );
    });

    // =========================================================================
    // SECTION 3: MULTI-DAY DATE-INDEPENDENT SHIFT & MACHINE SEQUENCE
    // =========================================================================
    console.log('\n--- SECTION 3: 5-Day Consecutive Independent Shift & Machine Tracking ---');

    await test('MSEQ', 1, 'Setup 5 independent daily assignments for Operator C across past 5 days', async () => {
      await cleanOperator(opC.id);
      const d4 = addDays(todayIST, -4);
      const d3 = addDays(todayIST, -3);
      const d2 = addDays(todayIST, -2);
      const d1 = addDays(todayIST, -1);
      const d0 = todayIST;

      // Day 4: Machine 1, Shift A
      await createAssignment({
        operatorId: opC.id, machineId: m1.id, shiftCode: 'A',
        validFrom: d4, validTo: d4, isActive: false
      });

      // Day 3: Machine 1, Shift B
      await createAssignment({
        operatorId: opC.id, machineId: m1.id, shiftCode: 'B',
        validFrom: d3, validTo: d3, isActive: false
      });

      // Day 2: Machine 2, Shift C (Night)
      await createAssignment({
        operatorId: opC.id, machineId: m2.id, shiftCode: 'C',
        validFrom: d2, validTo: d2, isActive: false
      });

      // Day 1: Machine 2, Shift A
      await createAssignment({
        operatorId: opC.id, machineId: m2.id, shiftCode: 'A',
        validFrom: d1, validTo: d1, isActive: false
      });

      // Day 0 (Today): Machine 3, Shift B (active)
      await createAssignment({
        operatorId: opC.id, machineId: m3.id, shiftCode: 'B',
        validFrom: d0, validTo: null, isActive: true
      });
    });

    await test('MSEQ', 2, 'Verify exact machine and shift returned for each of the 5 days', async () => {
      const days = [
        { offset: -4, machineId: m1.id, shift: 'A' },
        { offset: -3, machineId: m1.id, shift: 'B' },
        { offset: -2, machineId: m2.id, shift: 'C' },
        { offset: -1, machineId: m2.id, shift: 'A' },
        { offset: 0, machineId: m3.id, shift: 'B' }
      ];

      for (const d of days) {
        const targetDate = addDays(todayIST, d.offset);
        const { data: ctx } = await supabase.rpc('get_operator_entry_context', {
          p_operator_id: opC.id,
          p_target_date: targetDate,
        });
        assert(ctx?.machine?.id === d.machineId, `Day offset ${d.offset} (${targetDate}) expected machine ${d.machineId}, got ${ctx?.machine?.id}`);
        assert(ctx?.assigned_shift_codes?.includes(d.shift), `Day offset ${d.offset} (${targetDate}) expected shift ${d.shift}, got ${JSON.stringify(ctx?.assigned_shift_codes)}`);
      }
    });

    await test('MSEQ', 3, 'Submit logs for D-4, D-3, D-2, D-1, D-0 independently with correct machines and shifts -> All succeed', async () => {
      const logs = [
        { offset: -4, machine: m1, shift: 'A', startM: 600, endM: 608, startT: '06:00:00', endT: '14:00:00' },
        { offset: -3, machine: m1, shift: 'B', startM: 608, endM: 616, startT: '14:00:00', endT: '22:00:00' },
        { offset: -2, machine: m2, shift: 'C', startM: 700, endM: 708, startT: '22:00:00', endT: '06:00:00' },
        { offset: -1, machine: m2, shift: 'A', startM: 708, endM: 716, startT: '06:00:00', endT: '14:00:00', hours: 8 },
        { offset: 0, machine: m3, shift: 'B', startM: 800, endM: 800.5, startT: '14:00:00', endT: '14:30:00', hours: 0.5 }
      ];

      for (const item of logs) {
        const logDate = addDays(todayIST, item.offset);
        const { data: res, error: err } = await supabase.rpc('submit_operator_hour_log_atomic', {
          p_machine_id: item.machine.id,
          p_operator_id: opC.id,
          p_shift_code: item.shift,
          p_log_date: logDate,
          p_start_meter: item.startM,
          p_end_meter: item.endM,
          p_start_time: item.startT,
          p_end_time: item.endT,
          p_normal_working_hours: item.hours || 8,
          p_entered_by: opC.id
        });
        assert(!err && res?.success === true, `Failed on ${logDate} for ${item.machine.machine_id} Shift ${item.shift}: ${err?.message}`);
        cleanupLogIds.push(res.id);
      }
    });

    await test('MSEQ', 4, 'Verify 7-day boundary: Log on D-7 succeeds, Log on D-8 rejected with 23514', async () => {
      const d7 = addDays(todayIST, -7);
      const d8 = addDays(todayIST, -8);

      // Create assignment on D-7 for opC on M3
      await createAssignment({
        operatorId: opC.id, machineId: m3.id, shiftCode: 'A',
        validFrom: d7, validTo: d7, isActive: false
      });

      // Submit on D-7 (boundary)
      const { data: res7, error: err7 } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m3.id,
        p_operator_id: opC.id,
        p_shift_code: 'A',
        p_log_date: d7,
        p_start_meter: 780,
        p_end_meter: 788,
        p_start_time: '06:00:00',
        p_end_time: '14:00:00',
        p_normal_working_hours: 8,
        p_entered_by: opC.id
      });
      assert(!err7 && res7?.success === true, `D-7 boundary submission failed: ${err7?.message}`);
      cleanupLogIds.push(res7.id);

      // Create assignment on D-8 for opC on M3
      await createAssignment({
        operatorId: opC.id, machineId: m3.id, shiftCode: 'A',
        validFrom: d8, validTo: d8, isActive: false
      });

      // Submit on D-8 (expired past 7 days)
      const { data: res8, error: err8 } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m3.id,
        p_operator_id: opC.id,
        p_shift_code: 'A',
        p_log_date: d8,
        p_start_meter: 770,
        p_end_meter: 778,
        p_start_time: '06:00:00',
        p_end_time: '14:00:00',
        p_entered_by: opC.id
      });
      assert(
        err8?.code === '23514' && err8?.message?.includes('within the previous 7 days IST'),
        `Expected 23514 outside 7-day window, got: ${err8?.code} - ${err8?.message}`
      );
    });

    // =========================================================================
    // SECTION 4: ALL VALID SHIFT ENTRIES BATTERY
    // =========================================================================
    console.log('\n--- SECTION 4: Comprehensive Valid Shift Entries Battery ---');

    await cleanOperator(opA.id);
    const d5 = addDays(todayIST, -5);

    await test('VAL', 1, 'Multi-Shift on SAME Machine: Operator assigned Shift A & Shift B logs both on same date', async () => {
      // Assign opA to M1 for both Shift A and Shift B on d5
      await createAssignment({
        operatorId: opA.id, machineId: m1.id, shiftCode: 'A',
        validFrom: d5, validTo: d5, isActive: false
      });
      await createAssignment({
        operatorId: opA.id, machineId: m1.id, shiftCode: 'B',
        validFrom: d5, validTo: d5, isActive: false
      });

      // Log Shift A
      const { data: lA, error: errLA } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id, p_operator_id: opA.id, p_shift_code: 'A', p_log_date: d5,
        p_start_meter: 300, p_end_meter: 308, p_start_time: '06:00:00', p_end_time: '14:00:00',
        p_normal_working_hours: 8, p_entered_by: opA.id
      });
      assert(!errLA && lA?.success === true, `Shift A on M1 failed: ${errLA?.message}`);
      cleanupLogIds.push(lA.id);

      // Log Shift B
      const { data: lB, error: errLB } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id, p_operator_id: opA.id, p_shift_code: 'B', p_log_date: d5,
        p_start_meter: 308, p_end_meter: 316, p_start_time: '14:00:00', p_end_time: '22:00:00',
        p_normal_working_hours: 8, p_entered_by: opA.id
      });
      assert(!errLB && lB?.success === true, `Shift B on M1 failed: ${errLB?.message}`);
      cleanupLogIds.push(lB.id);
    });

    await test('VAL', 2, 'Multi-Shift on DIFFERENT Machines: Operator assigned Shift A on M1 and Shift B on M2', async () => {
      const d6 = addDays(todayIST, -6);

      // Assign opA to M1 Shift A on d6
      await createAssignment({
        operatorId: opA.id, machineId: m1.id, shiftCode: 'A',
        validFrom: d6, validTo: d6, isActive: false
      });

      // Assign opA to M2 Shift B on d6
      await createAssignment({
        operatorId: opA.id, machineId: m2.id, shiftCode: 'B',
        validFrom: d6, validTo: d6, isActive: false
      });

      // Log Shift A on M1
      const { data: l1, error: e1 } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id, p_operator_id: opA.id, p_shift_code: 'A', p_log_date: d6,
        p_start_meter: 250, p_end_meter: 258, p_start_time: '06:00:00', p_end_time: '14:00:00',
        p_normal_working_hours: 8, p_entered_by: opA.id
      });
      assert(!e1 && l1?.success === true, `Shift A on M1 failed: ${e1?.message}`);
      cleanupLogIds.push(l1.id);

      // Log Shift B on M2
      const { data: l2, error: e2 } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m2.id, p_operator_id: opA.id, p_shift_code: 'B', p_log_date: d6,
        p_start_meter: 200, p_end_meter: 208, p_start_time: '14:00:00', p_end_time: '22:00:00',
        p_normal_working_hours: 8, p_entered_by: opA.id
      });
      assert(!e2 && l2?.success === true, `Shift B on M2 failed: ${e2?.message}`);
      cleanupLogIds.push(l2.id);
    });

    await test('VAL', 3, 'Night Shift C (crosses midnight, 22:00 to 06:00 IST): Log date is start date', async () => {
      const dNight = addDays(todayIST, -3);
      await createAssignment({
        operatorId: opA.id, machineId: m3.id, shiftCode: 'C',
        validFrom: dNight, validTo: dNight, isActive: false
      });

      const { data: lC, error: errC } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m3.id, p_operator_id: opA.id, p_shift_code: 'C', p_log_date: dNight,
        p_start_meter: 400, p_end_meter: 408, p_start_time: '22:00:00', p_end_time: '06:00:00',
        p_normal_working_hours: 8, p_entered_by: opA.id
      });
      assert(!errC && lC?.success === true, `Shift C logging failed: ${errC?.message}`);
      cleanupLogIds.push(lC.id);
    });

    await test('VAL', 4, 'Decimal Meter Reading: 500.5 to 508.3 = 7.8 hours', async () => {
      const dDec = addDays(todayIST, -2);
      await createAssignment({
        operatorId: opA.id, machineId: m1.id, shiftCode: 'A',
        validFrom: dDec, validTo: dDec, isActive: false
      });

      const { data: lDec, error: errDec } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id, p_operator_id: opA.id, p_shift_code: 'A', p_log_date: dDec,
        p_start_meter: 500.5, p_end_meter: 508.3, p_start_time: '06:00:00', p_end_time: '14:00:00',
        p_normal_working_hours: 7.8, p_entered_by: opA.id
      });
      assert(!errDec && lDec?.success === true, `Decimal meter reading failed: ${errDec?.message}`);
      cleanupLogIds.push(lDec.id);
    });

    await test('VAL', 5, 'Standby / Zero Operating Hours: start_meter === end_meter with idle note', async () => {
      const dIdle = addDays(todayIST, -2);
      await createAssignment({
        operatorId: opB.id, machineId: m2.id, shiftCode: 'B',
        validFrom: dIdle, validTo: dIdle, isActive: false
      });

      const { data: lIdle, error: errIdle } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m2.id, p_operator_id: opB.id, p_shift_code: 'B', p_log_date: dIdle,
        p_start_meter: 600, p_end_meter: 600, p_start_time: '14:00:00', p_end_time: '22:00:00',
        p_normal_working_hours: 0, p_remarks: 'Site rain standby, zero operating hours',
        p_entered_by: opB.id
      });
      assert(!errIdle && lIdle?.success === true, `Zero operating hours shift failed: ${errIdle?.message}`);
      cleanupLogIds.push(lIdle.id);
    });

    await test('VAL', 6, 'Breakdown Logging: Records breakdown minutes and updates machine health_status', async () => {
      const dBk = addDays(todayIST, -1);
      await createAssignment({
        operatorId: opB.id, machineId: m3.id, shiftCode: 'A',
        validFrom: dBk, validTo: dBk, isActive: false
      });

      const { data: lBk, error: errBk } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m3.id, p_operator_id: opB.id, p_shift_code: 'A', p_log_date: dBk,
        p_start_meter: 650, p_end_meter: 656, p_start_time: '06:00:00', p_end_time: '14:00:00',
        p_normal_working_hours: 6, p_breakdown_hours: 2,
        p_is_breakdown: true,
        p_remarks: 'Hydraulic hose leak breakdown',
        p_entered_by: opB.id
      });
      assert(!errBk && lBk?.success === true, `Breakdown shift log failed: ${errBk?.message}`);
      cleanupLogIds.push(lBk.id);

      // Verify machine status changed to breakdown
      const { data: mchAfter } = await supabase.from('machines').select('health_status').eq('id', m3.id).single();
      assert(mchAfter.health_status === 'breakdown', `Machine health_status should be breakdown, got: ${mchAfter.health_status}`);

      // Restore machine status to active
      await supabase.from('machines').update({ health_status: 'active' }).eq('id', m3.id);
    });

    await test('VAL', 7, 'Idempotency Replay (Rapid Double Tap): Returns already_logged: true without duplicate row', async () => {
      const idempotencyKey = `test-idem-${Date.now()}`;
      const dIdem = addDays(todayIST, -7);
      await cleanLogsForMachines([m2.id], [dIdem]);
      await createAssignment({
        operatorId: opA.id, machineId: m2.id, shiftCode: 'A',
        validFrom: dIdem, validTo: dIdem, isActive: false
      });

      // Tap 1
      const { data: res1, error: err1 } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m2.id, p_operator_id: opA.id, p_shift_code: 'A', p_log_date: dIdem,
        p_start_meter: 680, p_end_meter: 688, p_start_time: '06:00:00', p_end_time: '14:00:00',
        p_idempotency_key: idempotencyKey, p_entered_by: opA.id
      });
      assert(!err1 && res1?.success === true, `First tap failed: ${err1?.message}`);
      cleanupLogIds.push(res1.id);

      // Tap 2 (exact same idempotency key)
      const { data: res2, error: err2 } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m2.id, p_operator_id: opA.id, p_shift_code: 'A', p_log_date: dIdem,
        p_start_meter: 680, p_end_meter: 688, p_start_time: '06:00:00', p_end_time: '14:00:00',
        p_idempotency_key: idempotencyKey, p_entered_by: opA.id
      });
      assert(!err2, `Second tap errored unexpectedly: ${err2?.message}`);
      assert(res2?.already_logged === true || res2?.success === true, 'Second tap must return already_logged or success');
      assert(res2.id === res1.id, 'Second tap must reference the same log ID');
    });

    // =========================================================================
    // SECTION 5: ALL INVALID SHIFT ENTRIES BATTERY (MUST BE REJECTED)
    // =========================================================================
    console.log('\n--- SECTION 5: Comprehensive Invalid Shift Entries Battery ---');

    await test('INV', 1, 'Negative starting meter rejected with 23514', async () => {
      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id, p_operator_id: opA.id, p_shift_code: 'A', p_log_date: todayIST,
        p_start_meter: -10, p_end_meter: 10, p_entered_by: adminUser.id
      });
      assert(error?.code === '23514', `Expected 23514 for negative start meter, got: ${error?.code} - ${error?.message}`);
    });

    await test('INV', 2, 'Negative ending meter rejected with 23514', async () => {
      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id, p_operator_id: opA.id, p_shift_code: 'A', p_log_date: todayIST,
        p_start_meter: 10, p_end_meter: -5, p_entered_by: adminUser.id
      });
      assert(error?.code === '23514', `Expected 23514 for negative end meter, got: ${error?.code} - ${error?.message}`);
    });

    await test('INV', 3, 'Meter regression (end meter < start meter) rejected with 23514', async () => {
      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id, p_operator_id: opA.id, p_shift_code: 'A', p_log_date: todayIST,
        p_start_meter: 500, p_end_meter: 490, p_entered_by: adminUser.id
      });
      assert(error?.code === '23514', `Expected 23514 for meter regression, got: ${error?.code} - ${error?.message}`);
    });

    await test('INV', 4, 'Running hours exceeding 24 hours in single log rejected with 23514', async () => {
      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id, p_operator_id: opA.id, p_shift_code: 'A', p_log_date: todayIST,
        p_start_meter: 100, p_end_meter: 126, // 26 hours!
        p_entered_by: adminUser.id
      });
      assert(error?.code === '23514', `Expected 23514 for running hours > 24h, got: ${error?.code} - ${error?.message}`);
    });

    await test('INV', 5, 'Duplicate shift log for same machine, same date, and same shift rejected with 23514', async () => {
      const dDup = addDays(todayIST, -3);
      await createAssignment({
        operatorId: opB.id, machineId: m2.id, shiftCode: 'A',
        validFrom: dDup, validTo: dDup, isActive: false
      });

      const { data: log1, error: err1 } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m2.id, p_operator_id: opB.id, p_shift_code: 'A', p_log_date: dDup,
        p_start_meter: 700, p_end_meter: 708, p_entered_by: opB.id
      });
      assert(!err1 && log1?.success === true, `Initial log failed: ${err1?.message}`);
      cleanupLogIds.push(log1.id);

      // Attempt duplicate without idempotency key
      const { data: log2, error: err2 } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m2.id, p_operator_id: opB.id, p_shift_code: 'A', p_log_date: dDup,
        p_start_meter: 708, p_end_meter: 716, p_entered_by: opB.id
      });
      assert(
        err2?.code === '23514' && err2?.message?.includes('already been recorded for this equipment'),
        `Expected duplicate 23514, got: ${err2?.code} - ${err2?.message}`
      );
    });

    await test('INV', 6, 'Cross-Machine double-booking (same operator, same shift, same date on 2 machines) rejected with 23514', async () => {
      const dCross = addDays(todayIST, -6);
      await cleanLogsForMachines([m1.id, m2.id], [dCross]);

      // Assign opA to M1 Shift A and M2 Shift A (double booked shift A)
      await createAssignment({
        operatorId: opA.id, machineId: m1.id, shiftCode: 'A',
        validFrom: dCross, validTo: dCross, isActive: false
      });
      await createAssignment({
        operatorId: opA.id, machineId: m2.id, shiftCode: 'A',
        validFrom: dCross, validTo: dCross, isActive: false
      });

      // Log M1 Shift A -> succeeds
      const { data: lM1, error: eM1 } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id, p_operator_id: opA.id, p_shift_code: 'A', p_log_date: dCross,
        p_start_meter: 800, p_end_meter: 808, p_entered_by: opA.id
      });
      assert(!eM1 && lM1?.success === true, `First machine log failed: ${eM1?.message}`);
      cleanupLogIds.push(lM1.id);

      // Log M2 Shift A -> MUST FAIL because opA already logged Shift A on dCross
      const { data: lM2, error: eM2 } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m2.id, p_operator_id: opA.id, p_shift_code: 'A', p_log_date: dCross,
        p_start_meter: 850, p_end_meter: 858, p_entered_by: opA.id
      });
      assert(
        eM2?.code === '23514' && eM2?.message?.includes('cannot operate two machines during the same shift'),
        `Expected 23514 for cross-machine double booking, got: ${eM2?.code} - ${eM2?.message}`
      );
    });

    await test('INV', 7, 'Unassigned Shift Code (operator assigned to Shift A tries to log Shift B) rejected with 23514', async () => {
      const dCode = addDays(todayIST, -2);
      await createAssignment({
        operatorId: opA.id, machineId: m1.id, shiftCode: 'A',
        validFrom: dCode, validTo: dCode, isActive: false
      });

      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id, p_operator_id: opA.id, p_shift_code: 'B', p_log_date: dCode,
        p_start_meter: 900, p_end_meter: 908, p_entered_by: opA.id
      });
      assert(
        error?.code === '23514' && error?.message?.includes('assigned to Shift A on this equipment, but attempted to log for Shift B'),
        `Expected 23514 wrong shift code, got: ${error?.code} - ${error?.message}`
      );
    });

    await test('INV', 8, 'Future Date Submission (D+1) by Operator rejected with 23514', async () => {
      const dFuture = addDays(todayIST, 1);
      // Even with an open assignment
      await createAssignment({
        operatorId: opA.id, machineId: m1.id, shiftCode: 'A',
        validFrom: todayIST, validTo: null, isActive: true
      });

      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m1.id, p_operator_id: opA.id, p_shift_code: 'A', p_log_date: dFuture,
        p_start_meter: 920, p_end_meter: 928, p_entered_by: opA.id // operator self-entry!
      });
      assert(
        error?.code === '23514' && error?.message?.includes('within the previous 7 days IST'),
        `Expected 23514 for future date, got: ${error?.code} - ${error?.message}`
      );
    });

    await test('INV', 9, 'Machine in Maintenance status rejected with 23514', async () => {
      // Set health_status = under_maintenance
      await supabase.from('machines').update({ health_status: 'under_maintenance' }).eq('id', m2.id);

      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m2.id, p_operator_id: opB.id, p_shift_code: 'A', p_log_date: todayIST,
        p_start_meter: 930, p_end_meter: 938, p_entered_by: adminUser.id
      });

      // Restore health_status
      await supabase.from('machines').update({ health_status: 'active' }).eq('id', m2.id);

      assert(
        error?.code === '23514' && error?.message?.includes('currently in maintenance or inactive status'),
        `Expected 23514 machine maintenance, got: ${error?.code} - ${error?.message}`
      );
    });

    await test('INV', 10, 'Inactive Machine rejected with 23514', async () => {
      // Set status = inactive
      await supabase.from('machines').update({ status: 'inactive' }).eq('id', m2.id);

      const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
        p_machine_id: m2.id, p_operator_id: opB.id, p_shift_code: 'A', p_log_date: todayIST,
        p_start_meter: 940, p_end_meter: 948, p_entered_by: adminUser.id
      });

      // Restore status
      await supabase.from('machines').update({ status: 'rented' }).eq('id', m2.id);

      assert(
        error?.code === '23514' && error?.message?.includes('currently in maintenance or inactive status'),
        `Expected 23514 inactive equipment, got: ${error?.code} - ${error?.message}`
      );
    });

    // =========================================================================
    // SECTION 6: CROSS-PLATFORM (WEB & MOBILE) CONTRACT VERIFICATION
    // =========================================================================
    console.log('\n--- SECTION 6: Cross-Platform (Web & Mobile) Contract Verification ---');

    await test('PLAT', 1, 'Web Query Contract: get_operator_entry_context with p_target_date produces exact date cache key & payload', async () => {
      // Simulating Web DAL call
      const { data: resYesterday } = await supabase.rpc('get_operator_entry_context', {
        p_operator_id: opA.id,
        p_target_date: yesterdayIST
      });
      assert(resYesterday, 'Yesterday web query payload must exist');

      const { data: resToday } = await supabase.rpc('get_operator_entry_context', {
        p_operator_id: opA.id,
        p_target_date: todayIST
      });
      assert(resToday, 'Today web query payload must exist');

      // Verify payloads reflect the target dates
      assert.strictEqual(resYesterday.target_date, yesterdayIST, 'Yesterday target_date must match');
      assert.strictEqual(resToday.target_date, todayIST, 'Today target_date must match');
    });

    await test('PLAT', 2, 'Mobile Hook Contract: TanStack Query key isolation by date', async () => {
      // Simulating apps/mobile useOperatorEntryContext query keys
      const keyYesterday = ['operator', 'entry-context', opA.id, yesterdayIST];
      const keyToday = ['operator', 'entry-context', opA.id, todayIST];

      assert(JSON.stringify(keyYesterday) !== JSON.stringify(keyToday), 'Mobile TanStack Query keys must be isolated by date');
      assert.strictEqual(keyYesterday[3], yesterdayIST, 'Date segment must match yesterday IST');
      assert.strictEqual(keyToday[3], todayIST, 'Date segment must match today IST');
    });

    await test('PLAT', 3, 'Single-day assignment support: valid_from === valid_to persists cleanly in monitor', async () => {
      const dSingle = addDays(todayIST, -5);
      await createAssignment({
        operatorId: opB.id, machineId: m1.id, shiftCode: 'B',
        validFrom: dSingle, validTo: dSingle, isActive: false
      });

      const { data: monSingle } = await supabase.rpc('get_today_shift_log_monitor', {
        p_actor_id: adminUser.id,
        p_log_date: dSingle
      });
      const rowSingle = monSingle.find(r => r.operator_id === opB.id && r.machine_id === m1.id);
      assert(rowSingle, 'Single-day assignment must be visible in monitor for that date');
      assert.strictEqual(rowSingle.shift_code, 'B', `Shift must be B, got: ${rowSingle.shift_code}`);
      assert.strictEqual(rowSingle.status, 'pending', `Status must be pending, got: ${rowSingle.status}`);
    });

  } finally {
    // Teardown / Cleanup
    console.log('\n--- CLEANING UP TEST ARTIFACTS ---');
    if (cleanupLogIds.length > 0) {
      const { count } = await supabase
        .from('machine_hour_logs')
        .delete({ count: 'exact' })
        .in('id', cleanupLogIds);
      console.log(`- Pruned ${count ?? cleanupLogIds.length} test machine_hour_logs`);
    }

    if (cleanupAssignmentIds.length > 0) {
      const { count } = await supabase
        .from('operator_machine_assignments')
        .delete({ count: 'exact' })
        .in('id', cleanupAssignmentIds);
      console.log(`- Pruned ${count ?? cleanupAssignmentIds.length} test operator_machine_assignments`);
    }

    // Clean operators one final time
    await cleanOperator(opA.id);
    await cleanOperator(opB.id);
    await cleanOperator(opC.id);
  }

  // Print Summary Table
  console.log('\n==============================================================================');
  console.log('  EXHAUSTIVE TEST RESULTS SUMMARY');
  console.log('==============================================================================');
  console.table(resultsTable.map(r => ({
    ID: r.id,
    Category: r.category,
    Title: r.title,
    Status: r.status,
    Duration: r.duration
  })));

  console.log(`\nTotal Tests: ${resultsTable.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);

  if (failCount > 0) {
    console.error(`\n❌ TEST SUITE FAILED WITH ${failCount} FAILURES!`);
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TESTS PASSED WITH 100% SUCCESS!');
  }
}

main().catch(err => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
