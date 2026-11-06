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

async function runAuthorizationMatrixTests() {
  console.log('==============================================================================');
  console.log('  OPERATOR SHIFT ENTRY DATABASE AUTHORIZATION & RBAC MATRIX TEST SUITE');
  console.log('  Target Database: Reach International Dev (vlmxciuogczumumrwyot)');
  console.log('==============================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Test setup variables
  const rohitSinghId = 'b3400740-3e79-44c7-9aec-a0ec3ccd22ce'; // Operator assigned to M/C-0002 on Shift B
  const manojYadavId = '4cfe61cb-389d-41f9-86d3-f29b1f9c7c6a'; // Operator assigned to M/C-0003
  const vikramSinghId = '13841eaa-c894-448f-b60f-093b341605e7'; // Authorized Supervisor
  const unassignedSupId = '00000000-0000-0000-0000-000000000088'; // Supervisor with NO machines/operators
  const hrUserId = 'f6357912-8b65-4e80-aae7-64c16c7c0734'; // HR user (Priya Nair)
  const machine2Id = '41304c2b-e901-443e-a7a7-f8d67925b577'; // M/C-0002 (Assigned to Rohit on Shift B)
  const machine3Id = 'd53d1311-e1e9-461c-a881-fa24f04d5984'; // M/C-0003 (Unassigned for Rohit Singh)

  // Use a past date within 7-day window to avoid future shift restrictions and duplicate conflicts
  const testDate = new Date();
  testDate.setDate(testDate.getDate() - 3);
  const testDateStr = testDate.toISOString().split('T')[0];

  // Clean any existing test logs for this test date on both machines
  await client
    .from('machine_hour_logs')
    .delete()
    .in('machine_id', [machine2Id, machine3Id])
    .eq('log_date', testDateStr);

  console.log(`[Test Setup] Cleaned previous logs for date: ${testDateStr}\n`);

  // --------------------------------------------------------------------------
  // TEST 1: Unassigned Machine Shift Entry (MUST FAIL with 42501)
  // Rohit Singh attempts to log shift on M/C-0003 (where he is NOT assigned)
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Unassigned Machine Shift Entry (Database Rejection) ---');
  try {
    const { data: res1, error: err1 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine3Id,
      p_operator_id: rohitSinghId,
      p_shift_code: 'A',
      p_log_date: testDateStr,
      p_start_meter: 950,
      p_end_meter: 958,
      p_start_time: '06:00:00',
      p_end_time: '14:00:00',
      p_entered_by: rohitSinghId
    });

    if (err1) {
      assert(
        err1.code === '42501' && err1.message.includes('not authorized to submit shift logs for this equipment'),
        `Unassigned machine correctly rejected with 42501: "${err1.message}"`
      );
    } else {
      assert(false, `Expected 42501 error but unassigned machine submission succeeded: ${JSON.stringify(res1)}`);
    }
  } catch (ex) {
    assert(ex.code === '42501', `Threw 42501 exception: ${ex.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Assigned Machine, Wrong Shift (MUST FAIL with 23514)
  // Rohit Singh is assigned to Shift B on M/C-0002, but attempts to log Shift A
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Assigned Machine, Wrong Shift (Database Rejection) ---');
  try {
    const { data: res2, error: err2 } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: machine2Id,
      p_operator_id: rohitSinghId,
      p_shift_code: 'A',
      p_log_date: testDateStr,
      p_start_meter: 510,
      p_end_meter: 518,
      p_start_time: '06:00:00',
      p_end_time: '14:00:00',
      p_entered_by: rohitSinghId
    });

    if (err2) {
      assert(
        err2.code === '23514' && err2.message.includes('assigned to Shift B'),
        `Wrong shift correctly rejected with 23514: "${err2.message}"`
      );
    } else {
      assert(false, `Expected 23514 error but wrong shift submission succeeded: ${JSON.stringify(res2)}`);
    }
  } catch (ex) {
    assert(ex.code === '23514', `Threw 23514 exception: ${ex.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Assigned Machine, Assigned Shift (MUST PASS & HANDOVER OPERATOR)
  // Rohit Singh submits for M/C-0002 on Shift B.
  // Machine M/C-0002 currently has current_operator_id set to someone else.
  // This verifies that trigger enforce_supervisor_machine_update_restrictions
  // allows current_operator_id to update to Rohit Singh.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Assigned Machine, Assigned Shift (Valid Entry & Handover) ---');
  // First ensure machine has another operator as current_operator_id to test handover
  await client
    .from('machines')
    .update({ current_operator_id: manojYadavId })
    .eq('id', machine2Id);

  const { data: res3, error: err3 } = await client.rpc('submit_operator_hour_log_atomic', {
    p_machine_id: machine2Id,
    p_operator_id: rohitSinghId,
    p_shift_code: 'B',
    p_log_date: testDateStr,
    p_start_meter: 520,
    p_end_meter: 528,
    p_start_time: '14:00:00',
    p_end_time: '22:00:00',
    p_normal_working_hours: 8,
    p_entered_by: rohitSinghId
  });

  assert(!err3 && res3?.success === true, `Assigned machine and assigned shift succeeded cleanly: logId=${res3?.id}`);

  // Verify machine current_operator_id was successfully updated to Rohit Singh
  const { data: updatedMch } = await client
    .from('machines')
    .select('current_operator_id, hour_meter')
    .eq('id', machine2Id)
    .single();

  assert(
    updatedMch?.current_operator_id === rohitSinghId && Number(updatedMch?.hour_meter) === 528,
    `Machine hour_meter updated to 528 and current_operator_id successfully handed over to Rohit Singh (${updatedMch?.current_operator_id})`
  );

  // --------------------------------------------------------------------------
  // TEST 4: Duplicate Shift Entry Prevention (MUST FAIL with 23514)
  // Submitting another entry for M/C-0002 on the same date and Shift B with different meters
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Duplicate Shift Entry Prevention ---');
  const { data: res4, error: err4 } = await client.rpc('submit_operator_hour_log_atomic', {
    p_machine_id: machine2Id,
    p_operator_id: rohitSinghId,
    p_shift_code: 'B',
    p_log_date: testDateStr,
    p_start_meter: 528,
    p_end_meter: 536,
    p_start_time: '14:00:00',
    p_end_time: '22:00:00',
    p_entered_by: rohitSinghId
  });

  assert(
    err4?.code === '23514' && err4?.message.includes('already been recorded for this equipment'),
    `Duplicate shift entry correctly prevented with 23514: "${err4?.message}"`
  );

  // --------------------------------------------------------------------------
  // TEST 5: Meter Regression Guard (MUST FAIL with 23514)
  // End meter < Start meter
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Meter Regression Guard (End < Start) ---');
  const { data: res5, error: err5 } = await client.rpc('submit_operator_hour_log_atomic', {
    p_machine_id: machine2Id,
    p_operator_id: rohitSinghId,
    p_shift_code: 'B',
    p_log_date: testDateStr,
    p_start_meter: 600,
    p_end_meter: 550, // Less than start meter
    p_start_time: '14:00:00',
    p_end_time: '22:00:00',
    p_entered_by: rohitSinghId
  });

  assert(
    err5?.code === '23514' && err5?.message.includes('cannot be less than start meter reading'),
    `Meter regression correctly rejected with 23514: "${err5?.message}"`
  );

  // --------------------------------------------------------------------------
  // TEST 6: Running Hours Exceed 24h Guard (MUST FAIL with 23514)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Maximum Running Hours Guard (>24h) ---');
  const { data: res6, error: err6 } = await client.rpc('submit_operator_hour_log_atomic', {
    p_machine_id: machine2Id,
    p_operator_id: rohitSinghId,
    p_shift_code: 'B',
    p_log_date: testDateStr,
    p_start_meter: 500,
    p_end_meter: 526, // 26 hours
    p_start_time: '14:00:00',
    p_end_time: '22:00:00',
    p_entered_by: rohitSinghId
  });

  assert(
    err6?.code === '23514' && err6?.message.includes('cannot exceed 24 hours'),
    `Running hours > 24h correctly rejected with 23514: "${err6?.message}"`
  );

  // --------------------------------------------------------------------------
  // TEST 7: Supervisor Assisted Entry for Supervised Equipment (MUST PASS)
  // Supervisor Vikram Singh submits for M/C-0003 with Manoj Yadav on Shift A
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Supervisor Assisted Entry (Supervised Equipment) ---');
  const { data: res7, error: err7 } = await client.rpc('submit_operator_hour_log_atomic', {
    p_machine_id: machine3Id,
    p_operator_id: manojYadavId,
    p_shift_code: 'A',
    p_log_date: testDateStr,
    p_start_meter: 950,
    p_end_meter: 958,
    p_start_time: '06:00:00',
    p_end_time: '14:00:00',
    p_entered_by: vikramSinghId
  });

  assert(
    !err7 && res7?.success === true && res7?.entry_source === 'supervisor',
    `Supervisor assisted entry succeeded with entry_source='supervisor': logId=${res7?.id}`
  );

  // --------------------------------------------------------------------------
  // TEST 8: Supervisor Assisted Entry for Unsupervised Equipment (MUST FAIL with 42501)
  // Unassigned Supervisor (00000000-0000-0000-0000-000000000088) attempts to submit
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: Supervisor Assisted Entry (Unsupervised Equipment / Scope Guard) ---');
  const { data: res8, error: err8 } = await client.rpc('submit_operator_hour_log_atomic', {
    p_machine_id: machine3Id,
    p_operator_id: manojYadavId,
    p_shift_code: 'A',
    p_log_date: testDateStr,
    p_start_meter: 960,
    p_end_meter: 968,
    p_entered_by: unassignedSupId
  });

  assert(
    err8?.code === '42501' && err8?.message.includes('Supervisors can only fill shift entries for operators or machinery assigned under their supervision'),
    `Unsupervised equipment entry correctly rejected with 42501: "${err8?.message}"`
  );

  // --------------------------------------------------------------------------
  // TEST 9: Non-Supervisor / Unauthorized Role Assisted Entry (MUST FAIL with 42501)
  // HR user (Priya Nair) attempts to submit on behalf of an operator
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 9: Unauthorized Role Assisted Entry Guard (HR User) ---');
  const { data: res9, error: err9 } = await client.rpc('submit_operator_hour_log_atomic', {
    p_machine_id: machine3Id,
    p_operator_id: manojYadavId,
    p_shift_code: 'A',
    p_log_date: testDateStr,
    p_start_meter: 960,
    p_end_meter: 968,
    p_entered_by: hrUserId
  });

  assert(
    err9?.code === '42501' && err9?.message.includes('Not authorized to enter shift logs on behalf of operators'),
    `Non-supervisor assisted entry correctly rejected with 42501: "${err9?.message}"`
  );

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n==============================================================================');
  console.log(`  MATRIX TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==============================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthorizationMatrixTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
