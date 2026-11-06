import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 1. Load environment configuration
const envPath = path.resolve(process.cwd(), 'apps/web/.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
let url = '', key = '';
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    url = trimmed.split('=')[1].trim().replace(/^["']|["']$/g, '');
  }
  if (trimmed.startsWith('SUPABASE_SECRET_KEY=')) {
    key = trimmed.split('=')[1].trim().replace(/^["']|["']$/g, '');
  }
});

const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function runExhaustiveShiftEntryMatrix() {
  console.log('==============================================================================');
  console.log('  EXHAUSTIVE OPERATOR SHIFT ENTRY VALIDATION & RBAC TEST MATRIX');
  console.log('  Target Database: Reach International Dev (vlmxciuogczumumrwyot)');
  console.log('==============================================================================\n');

  let passed = 0;
  let failed = 0;
  const createdLogIds = [];

  function assert(condition, message, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message} ${details ? '--> ' + details : ''}`);
      failed++;
    }
  }

  // --- DISCOVERY & FIXTURES ---
  const rohitSinghId = 'b3400740-3e79-44c7-9aec-a0ec3ccd22ce'; // Assigned to M/C-0002 on Shift B
  const deepakPatelId = '09e5a215-d147-48a0-95ab-76437dc83a43'; // Assigned to M/C-0001 on Shift S1
  const manojYadavId = '4cfe61cb-389d-41f9-86d3-f29b1f9c7c6a'; // Assigned to M/C-0003 on Shift A
  const sureshSharmaId = 'a32d1f6f-aae0-4ca3-adc4-748f766c685b'; // Assigned to M/C-0005 on Shift A
  const vikramSinghId = '13841eaa-c894-448f-b60f-093b341605e7'; // Supervisor
  const unassignedSupId = '00000000-0000-0000-0000-000000000088'; // Unassigned Supervisor fixture
  const hrUserId = 'f6357912-8b65-4e80-aae7-64c16c7c0734'; // HR user (Priya Nair)
  const managerId = '38376f89-acbe-4b5c-a981-53ca5b2805c0'; // Manager (Sanjeev Kapoor)
  const adminId = 'cc2b0d0c-e06d-4500-98fe-69354b2bdc16'; // Admin

  const machine1Id = '8d0011dd-150e-4f71-b166-a8eb9e460480'; // M/C-0001
  const machine2Id = '41304c2b-e901-443e-a7a7-f8d67925b577'; // M/C-0002
  const machine3Id = 'd53d1311-e1e9-461c-a881-fa24f04d5984'; // M/C-0003
  const machine5Id = 'a813c416-bd89-4c53-8392-e44c1900f4c0'; // M/C-0005

  // Date generators
  const now = new Date();
  const getOffsetDateStr = (days) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const todayStr = getOffsetDateStr(0);
  const past2DaysStr = getOffsetDateStr(-2);
  const past3DaysStr = getOffsetDateStr(-3);
  const past4DaysStr = getOffsetDateStr(-4);
  const past5DaysStr = getOffsetDateStr(-5);
  const past6DaysStr = getOffsetDateStr(-6);
  const boundary7DaysStr = getOffsetDateStr(-7);
  const expired8DaysStr = getOffsetDateStr(-8);
  const futureDateStr = getOffsetDateStr(2);

  // Pre-test cleanup on test dates to avoid conflicts
  const testDates = [past2DaysStr, past3DaysStr, past4DaysStr, past5DaysStr, past6DaysStr, boundary7DaysStr];
  await client
    .from('machine_hour_logs')
    .delete()
    .in('machine_id', [machine1Id, machine2Id, machine3Id, machine5Id])
    .in('log_date', testDates);

  // 1. Deactivate existing active assignments on test machines first to avoid exclusion constraint conflicts
  await client
    .from('operator_machine_assignments')
    .update({ is_active: false, ended_at: new Date().toISOString(), end_reason: 'reassigned' })
    .in('machine_id', [machine1Id, machine2Id, machine3Id, machine5Id])
    .eq('is_active', true);

  // 2. Ensure all fixture assignments are active for the test suite
  await client
    .from('operator_machine_assignments')
    .update({ is_active: true, ended_at: null, end_reason: null })
    .in('id', [
      '48f3f1fa-3f74-43aa-bf49-b6d89704998c', // Rohit Singh -> M2 Shift B
      'ee4b6418-8b3f-4a8f-b69f-5fdc5bc31964', // Deepak Patel -> M1 Shift S1
      'cae28b97-afe3-4f53-8186-d65bac1962c1', // Manoj Yadav -> M3 Shift A
      'c11bd98e-864d-4fd8-b401-85ebbcdd29c2', // Suresh Sharma -> M5 Shift A
    ]);

  // 3. Ensure machines have correct current_operator_id and operator_ids
  await client.from('machines').update({ current_operator_id: deepakPatelId, operator_ids: [deepakPatelId] }).eq('id', machine1Id);
  await client.from('machines').update({ current_operator_id: rohitSinghId, operator_ids: [rohitSinghId] }).eq('id', machine2Id);
  await client.from('machines').update({ current_operator_id: manojYadavId, operator_ids: [manojYadavId] }).eq('id', machine3Id);
  await client.from('machines').update({ current_operator_id: sureshSharmaId, operator_ids: [sureshSharmaId] }).eq('id', machine5Id);

  console.log(`[Test Setup] Prepared fixtures, ensured active assignments, and cleaned test window logs (${testDates.join(', ')})\n`);

  try {
    // ========================================================================
    // CATEGORY A: Machine Assignment & Equipment Authorization (Database RBAC)
    // ========================================================================
    console.log('--- CATEGORY A: Machine Assignment & Equipment Authorization ---');

    // TC-A1: Operator assigned via operator_machine_assignments logs for equipment -> MUST PASS
    const { data: resA1, error: errA1 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine2Id,
      p_operator_id: rohitSinghId,
      p_shift_code: 'B',
      p_log_date: past3DaysStr,
      p_start_meter: 520,
      p_end_meter: 528,
      p_start_time: '14:00:00',
      p_end_time: '22:00:00',
      p_normal_working_hours: 8,
      p_entered_by: rohitSinghId
    });
    if (resA1?.id) createdLogIds.push(resA1.id);
    assert(!errA1 && resA1?.success === true, 'TC-A1: Operator assigned via operator_machine_assignments succeeds', errA1?.message);

    // TC-A2: Operator NOT assigned to equipment attempts to log -> MUST FAIL with 42501
    const { data: resA2, error: errA2 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine3Id, // Rohit is NOT assigned to machine 3
      p_operator_id: rohitSinghId,
      p_shift_code: 'A',
      p_log_date: past3DaysStr,
      p_start_meter: 950,
      p_end_meter: 958,
      p_entered_by: rohitSinghId
    });
    assert(
      errA2?.code === '42501' && errA2?.message.includes('not authorized to submit shift logs for this equipment'),
      'TC-A2: Unassigned operator entry rejected at database level with 42501',
      errA2?.message
    );

    // TC-A3: Machine Operator Handover (Machine operated by A, now operated by B) -> MUST PASS & UPDATE current_operator_id
    await client.from('machines').update({ current_operator_id: manojYadavId }).eq('id', machine2Id);
    const { data: resA3, error: errA3 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine2Id,
      p_operator_id: rohitSinghId,
      p_shift_code: 'B',
      p_log_date: past5DaysStr,
      p_start_meter: 512,
      p_end_meter: 520,
      p_start_time: '14:00:00',
      p_end_time: '22:00:00',
      p_entered_by: rohitSinghId
    });
    if (resA3?.id) createdLogIds.push(resA3.id);
    const { data: mchA3 } = await client.from('machines').select('current_operator_id, hour_meter').eq('id', machine2Id).single();
    assert(
      !errA3 && resA3?.success === true && mchA3?.current_operator_id === rohitSinghId,
      'TC-A3: Machine handover succeeds and current_operator_id updates cleanly to new operator',
      errA3?.message
    );

    // ========================================================================
    // CATEGORY B: Shift Code & Roster Alignment
    // ========================================================================
    console.log('\n--- CATEGORY B: Shift Code & Roster Alignment ---');

    // TC-B1: Operator assigned to Shift B attempts to log Shift A -> MUST FAIL with 23514
    const { data: resB1, error: errB1 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine2Id,
      p_operator_id: rohitSinghId,
      p_shift_code: 'A', // Assigned to B
      p_log_date: past3DaysStr,
      p_start_meter: 530,
      p_end_meter: 538,
      p_entered_by: rohitSinghId
    });
    assert(
      errB1?.code === '23514' && errB1?.message.includes('assigned to Shift B on this equipment, but attempted to log for Shift A'),
      'TC-B1: Wrong shift code rejected with 23514 alignment error',
      errB1?.message
    );

    // TC-B2: Shift code normalization ('shift S1' -> 'S1') -> MUST PASS
    const { data: resB2, error: errB2 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine1Id,
      p_operator_id: deepakPatelId,
      p_shift_code: 'shift S1',
      p_log_date: past5DaysStr,
      p_start_meter: 510,
      p_end_meter: 518,
      p_start_time: '08:00:00',
      p_end_time: '16:00:00',
      p_entered_by: deepakPatelId
    });
    if (resB2?.id) createdLogIds.push(resB2.id);
    assert(
      !errB2 && resB2?.shift_code === 'S1',
      `TC-B2: Shift code normalized properly ('shift S1' -> '${resB2?.shift_code}')`,
      errB2?.message
    );

    // ========================================================================
    // CATEGORY C: Date Window & Past/Future Boundaries
    // ========================================================================
    console.log('\n--- CATEGORY C: Date Window & Past/Future Boundaries ---');

    // TC-C1: Exactly 7 days in the past (Boundary condition) -> MUST PASS
    const { data: resC1, error: errC1 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine1Id,
      p_operator_id: deepakPatelId,
      p_shift_code: 'S1',
      p_log_date: boundary7DaysStr,
      p_start_meter: 502,
      p_end_meter: 510,
      p_start_time: '08:00:00',
      p_end_time: '16:00:00',
      p_entered_by: deepakPatelId
    });
    if (resC1?.id) createdLogIds.push(resC1.id);
    assert(!errC1 && resC1?.success === true, `TC-C1: Exactly 7 days past log accepted (${boundary7DaysStr})`, errC1?.message);

    // TC-C2: 8 days in the past (Expired window) -> MUST FAIL with 23514
    const { data: resC2, error: errC2 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine1Id,
      p_operator_id: deepakPatelId,
      p_shift_code: 'S1',
      p_log_date: expired8DaysStr,
      p_start_meter: 494,
      p_end_meter: 502,
      p_entered_by: deepakPatelId
    });
    assert(
      errC2?.code === '23514' && errC2?.message.includes('previous 7 days'),
      `TC-C2: Date older than 7 days correctly rejected with 23514 (${expired8DaysStr})`,
      errC2?.message
    );

    // TC-C3: Future log date -> MUST FAIL with 23514
    const { data: resC3, error: errC3 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine1Id,
      p_operator_id: deepakPatelId,
      p_shift_code: 'S1',
      p_log_date: futureDateStr,
      p_start_meter: 530,
      p_end_meter: 538,
      p_entered_by: deepakPatelId
    });
    assert(
      errC3?.code === '23514' && errC3?.message.includes('previous 7 days'),
      `TC-C3: Future date log rejected with 23514 (${futureDateStr})`,
      errC3?.message
    );

    // ========================================================================
    // CATEGORY D: Meter Readings & Operating Hour Bounds
    // ========================================================================
    console.log('\n--- CATEGORY D: Meter Readings & Operating Hour Bounds ---');

    // TC-D1: Meter Regression (End < Start) -> MUST FAIL with 23514
    const { data: resD1, error: errD1 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine2Id,
      p_operator_id: rohitSinghId,
      p_shift_code: 'B',
      p_log_date: past5DaysStr,
      p_start_meter: 600,
      p_end_meter: 590, // Less than start
      p_entered_by: rohitSinghId
    });
    assert(
      errD1?.code === '23514' && errD1?.message.includes('cannot be less than start meter reading'),
      'TC-D1: Meter regression (590 < 600) rejected with 23514',
      errD1?.message
    );

    // TC-D2: Negative Meter Reading -> MUST FAIL with 23514
    const { data: resD2, error: errD2 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine2Id,
      p_operator_id: rohitSinghId,
      p_shift_code: 'B',
      p_log_date: past5DaysStr,
      p_start_meter: -10,
      p_end_meter: 500,
      p_entered_by: rohitSinghId
    });
    assert(
      errD2?.code === '23514' && (errD2?.message.includes('negative') || errD2?.message.includes('chk_machine_hour_logs_start_meter_positive')),
      'TC-D2: Negative meter reading (-10) rejected with 23514',
      errD2?.message
    );

    // TC-D3: Operating Hours > 24 Hours -> MUST FAIL with 23514
    const { data: resD3, error: errD3 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine2Id,
      p_operator_id: rohitSinghId,
      p_shift_code: 'B',
      p_log_date: past5DaysStr,
      p_start_meter: 500,
      p_end_meter: 525, // 25 hours
      p_entered_by: rohitSinghId
    });
    assert(
      errD3?.code === '23514' && errD3?.message.includes('cannot exceed 24 hours'),
      'TC-D3: Running hours > 24h (25h) rejected with 23514',
      errD3?.message
    );

    // TC-D4: Zero Operating Hours (Idle Shift: end == start) -> MUST PASS
    const { data: resD4, error: errD4 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine3Id,
      p_operator_id: manojYadavId,
      p_shift_code: 'A',
      p_log_date: past6DaysStr,
      p_start_meter: 960,
      p_end_meter: 960, // Exactly 0 hours
      p_start_time: '06:00:00',
      p_end_time: '14:00:00',
      p_entered_by: manojYadavId
    });
    if (resD4?.id) createdLogIds.push(resD4.id);
    assert(!errD4 && resD4?.running_hours === 0, 'TC-D4: Zero operating hours (idle standby shift) accepted cleanly', errD4?.message);

    // ========================================================================
    // CATEGORY E: Breakdown & Machinery Health Transition
    // ========================================================================
    console.log('\n--- CATEGORY E: Breakdown & Machinery Health Transition ---');

    // TC-E1: Machine Breakdown Reporting -> MUST PASS & set health_status = 'breakdown'
    const { data: resE1, error: errE1 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine3Id,
      p_operator_id: manojYadavId,
      p_shift_code: 'A',
      p_log_date: past5DaysStr,
      p_start_meter: 960,
      p_end_meter: 966,
      p_is_breakdown: true,
      p_breakdown_hours: 2,
      p_breakdown_start_time: '10:00:00',
      p_breakdown_end_time: '12:00:00',
      p_machine_condition: 'breakdown',
      p_remarks: 'Hydraulic hose leak detected',
      p_entered_by: manojYadavId
    });
    if (resE1?.id) createdLogIds.push(resE1.id);
    const { data: mchE1 } = await client.from('machines').select('health_status').eq('id', machine3Id).single();
    assert(
      !errE1 && resE1?.breakdown_minutes === 120 && mchE1?.health_status === 'breakdown',
      'TC-E1: Breakdown shift records 120 breakdown minutes and updates machine health_status to breakdown',
      errE1?.message
    );

    // TC-E2: Normal Shift Recovery -> MUST PASS & restore health_status = 'active'
    const { data: resE2, error: errE2 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine3Id,
      p_operator_id: manojYadavId,
      p_shift_code: 'A',
      p_log_date: past4DaysStr,
      p_start_meter: 966,
      p_end_meter: 974,
      p_is_breakdown: false,
      p_machine_condition: 'good',
      p_entered_by: manojYadavId
    });
    if (resE2?.id) createdLogIds.push(resE2.id);
    const { data: mchE2 } = await client.from('machines').select('health_status').eq('id', machine3Id).single();
    assert(
      !errE2 && mchE2?.health_status === 'active',
      'TC-E2: Subsequent normal shift restores machine health_status to active',
      errE2?.message
    );

    // ========================================================================
    // CATEGORY F: Overlap, Duplicate & Cross-Machine Conflicts
    // ========================================================================
    console.log('\n--- CATEGORY F: Overlap, Duplicate & Cross-Machine Conflicts ---');

    // TC-F1: Duplicate Machine Shift (Different meter readings) -> MUST FAIL with 23514
    const { data: resF1, error: errF1 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine2Id,
      p_operator_id: rohitSinghId,
      p_shift_code: 'B',
      p_log_date: past3DaysStr,
      p_start_meter: 528,
      p_end_meter: 536, // Conflict with resA1 (520-528)
      p_entered_by: rohitSinghId
    });
    assert(
      errF1?.code === '23514' && errF1?.message.includes('already been recorded for this equipment'),
      'TC-F1: Duplicate machine shift entry rejected with 23514',
      errF1?.message
    );

    // TC-F2: Idempotent Replay (Identical meters & payload) -> MUST PASS idempotently
    const { data: resF2, error: errF2 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine2Id,
      p_operator_id: rohitSinghId,
      p_shift_code: 'B',
      p_log_date: past3DaysStr,
      p_start_meter: 520,
      p_end_meter: 528, // Exact match to resA1
      p_entered_by: rohitSinghId
    });
    assert(
      !errF2 && resF2?.already_logged === true && resF2?.id === resA1?.id,
      'TC-F2: Exact replay returns already_logged: true idempotently without duplicate row',
      errF2?.message
    );

    // TC-F3: Cross-Machine Operator Conflict (Same operator logging 2 machines on same date & shift) -> MUST FAIL with 23514
    // Supervisor Vikram Singh attempts assisted entry for Rohit on Machine 1 for Shift B on past3DaysStr (where Rohit already logged Machine 2)
    const { data: resF3, error: errF3 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine1Id,
      p_operator_id: rohitSinghId,
      p_shift_code: 'B',
      p_log_date: past3DaysStr, // Rohit already has a log on Machine 2 for past3DaysStr on Shift B
      p_start_meter: 530,
      p_end_meter: 538,
      p_start_time: '14:00:00',
      p_end_time: '22:00:00',
      p_entered_by: vikramSinghId
    });
    assert(
      errF3?.code === '23514' && errF3?.message.includes('cannot operate two machines during the same shift'),
      'TC-F3: Cross-machine dual shift logging rejected with 23514',
      errF3?.message
    );

    // ========================================================================
    // CATEGORY G: Supervisory & Management Assisted Entry RBAC
    // ========================================================================
    console.log('\n--- CATEGORY G: Supervisory & Management Assisted Entry RBAC ---');

    // TC-G1: Supervisor Assisted Entry for Supervised Equipment -> MUST PASS (entry_source = 'supervisor')
    const { data: resG1, error: errG1 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine1Id,
      p_operator_id: deepakPatelId,
      p_shift_code: 'S1',
      p_log_date: past2DaysStr,
      p_start_meter: 518,
      p_end_meter: 526,
      p_start_time: '08:00:00',
      p_end_time: '16:00:00',
      p_entered_by: vikramSinghId // Authorized Supervisor
    });
    if (resG1?.id) createdLogIds.push(resG1.id);
    assert(
      !errG1 && resG1?.entry_source === 'supervisor',
      'TC-G1: Authorized supervisor assisted entry succeeds with entry_source="supervisor"',
      errG1?.message
    );

    // TC-G2: Supervisor Emergency Shift Override -> MUST PASS with is_assisted_override = true
    const { data: resG2, error: errG2 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine1Id,
      p_operator_id: deepakPatelId, // Assigned to S1, supervisor records Shift C for emergency coverage
      p_shift_code: 'C',
      p_log_date: past4DaysStr,
      p_start_meter: 526,
      p_end_meter: 534,
      p_start_time: '22:00:00',
      p_end_time: '06:00:00',
      p_entered_by: vikramSinghId
    });
    if (resG2?.id) createdLogIds.push(resG2.id);
    assert(
      !errG2 && resG2?.is_assisted_override === true,
      'TC-G2: Supervisor emergency shift override permitted with is_assisted_override=true',
      errG2?.message
    );

    // TC-G3: Supervisor Unsupervised Equipment Scope Guard -> MUST FAIL with 42501
    const { data: resG3, error: errG3 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine1Id,
      p_operator_id: deepakPatelId,
      p_shift_code: 'S1',
      p_log_date: past6DaysStr,
      p_start_meter: 534,
      p_end_meter: 542,
      p_entered_by: unassignedSupId // Unassigned supervisor
    });
    assert(
      errG3?.code === '42501' && errG3?.message.includes('Supervisors can only fill shift entries for operators or machinery assigned under their supervision'),
      'TC-G3: Unassigned supervisor assisted entry rejected with 42501 supervisory scope error',
      errG3?.message
    );

    // TC-G4: Manager Monorepo-Wide Assisted Entry -> MUST PASS (entry_source = 'manager')
    const { data: resG4, error: errG4 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine5Id,
      p_operator_id: sureshSharmaId, // Suresh Sharma
      p_shift_code: 'A',
      p_log_date: past2DaysStr,
      p_start_meter: 3300,
      p_end_meter: 3308,
      p_start_time: '06:00:00',
      p_end_time: '14:00:00',
      p_entered_by: managerId
    });
    if (resG4?.id) createdLogIds.push(resG4.id);
    assert(
      !errG4 && resG4?.entry_source === 'manager',
      'TC-G4: Manager global fleet assisted entry succeeds with entry_source="manager"',
      errG4?.message
    );

    // TC-G5: Administrator Monorepo-Wide Assisted Entry -> MUST PASS (entry_source = 'admin')
    const { data: resG5, error: errG5 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine5Id,
      p_operator_id: sureshSharmaId, // Suresh Sharma
      p_shift_code: 'A',
      p_log_date: past4DaysStr,
      p_start_meter: 3308,
      p_end_meter: 3316,
      p_start_time: '06:00:00',
      p_end_time: '14:00:00',
      p_entered_by: adminId
    });
    if (resG5?.id) createdLogIds.push(resG5.id);
    assert(
      !errG5 && resG5?.entry_source === 'admin',
      'TC-G5: Administrator fleet assisted entry succeeds with entry_source="admin"',
      errG5?.message
    );

    // TC-G6: Unauthorized Role Assisted Entry (HR user Priya Nair) -> MUST FAIL with 42501
    const { data: resG6, error: errG6 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine1Id,
      p_operator_id: deepakPatelId,
      p_shift_code: 'S1',
      p_log_date: past6DaysStr,
      p_start_meter: 540,
      p_end_meter: 548,
      p_entered_by: hrUserId
    });
    assert(
      errG6?.code === '42501' && errG6?.message.includes('Not authorized to enter shift logs on behalf of operators'),
      'TC-G6: Non-supervisor role (HR) assisted entry rejected with 42501 unauthorized',
      errG6?.message
    );

    // ========================================================================
    // CATEGORY H: Machine Status & Maintenance Invariants
    // ========================================================================
    console.log('\n--- CATEGORY H: Machine Status & Maintenance Invariants ---');

    // TC-H1: Machine marked 'under_maintenance' cannot be logged -> MUST FAIL with 23514
    await client.from('machines').update({ health_status: 'under_maintenance' }).eq('id', machine2Id);
    const { data: resH1, error: errH1 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine2Id,
      p_operator_id: rohitSinghId,
      p_shift_code: 'B',
      p_log_date: past6DaysStr,
      p_start_meter: 540,
      p_end_meter: 548,
      p_entered_by: rohitSinghId
    });
    assert(
      errH1?.code === '23514' && errH1?.message.includes('currently in maintenance or inactive status'),
      'TC-H1: Machine under maintenance rejected with 23514 status invariant',
      errH1?.message
    );
    // Restore health_status to active
    await client.from('machines').update({ health_status: 'active' }).eq('id', machine2Id);

    // TC-H2: Machine marked status = 'inactive' cannot be logged -> MUST FAIL with 23514
    await client.from('machines').update({ status: 'inactive' }).eq('id', machine2Id);
    const { data: resH2, error: errH2 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine2Id,
      p_operator_id: rohitSinghId,
      p_shift_code: 'B',
      p_log_date: past6DaysStr,
      p_start_meter: 540,
      p_end_meter: 548,
      p_entered_by: rohitSinghId
    });
    assert(
      errH2?.code === '23514' && errH2?.message.includes('currently in maintenance or inactive status'),
      'TC-H2: Inactive equipment log rejected with 23514 status invariant',
      errH2?.message
    );
    // Restore status to available
    await client.from('machines').update({ status: 'available' }).eq('id', machine2Id);

  } finally {
    // --- TEARDOWN & REVERT FIXTURES ---
    console.log('\n--- TEARDOWN: Cleaning Created Test Shift Logs ---');
    if (createdLogIds.length > 0) {
      await client.from('machine_hour_logs').delete().in('id', createdLogIds);
      console.log(`Cleaned ${createdLogIds.length} generated test shift logs.`);
    }
  }

  // --- SUMMARY REPORT ---
  console.log('\n==============================================================================');
  console.log(`  EXHAUSTIVE MATRIX SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==============================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runExhaustiveShiftEntryMatrix().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
