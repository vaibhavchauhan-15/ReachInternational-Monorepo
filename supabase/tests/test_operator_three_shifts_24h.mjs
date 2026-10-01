import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load env
function loadEnv(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
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
        process.env[key] = val;
      }
    }
  }
}

loadEnv(path.resolve(__dirname, '../../apps/web/.env.local'));

const DEV_PROJECT_ID = 'vlmxciuogczumumrwyot';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseUrl.includes(DEV_PROJECT_ID)) {
  console.error(`❌ Target must be Dev project (${DEV_PROJECT_ID}). Found: ${supabaseUrl}`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('🚀 Running Three-Shifts (24h) Operator Assignment Verification Tests on Dev DB...');

  // 1. Get an active operator
  const { data: operators, error: opErr } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('role', 'operator')
    .eq('status', 'active')
    .limit(1);

  if (opErr || !operators || operators.length === 0) {
    throw new Error('No active operator found for test: ' + JSON.stringify(opErr));
  }
  const testOperator = operators[0];
  console.log(`✅ Using test operator: ${testOperator.full_name} (${testOperator.id})`);

  // 2. Get 2 active machines
  const { data: machines, error: machErr } = await supabase
    .from('machines')
    .select('id, machine_id')
    .limit(2);

  if (machErr || !machines || machines.length < 2) {
    throw new Error('Need at least 2 machines for test: ' + JSON.stringify(machErr));
  }
  const machine1 = machines[0];
  const machine2 = machines[1];
  console.log(`✅ Using machine 1: ${machine1.machine_id} (${machine1.id})`);
  console.log(`✅ Using machine 2: ${machine2.machine_id} (${machine2.id})`);

  // 3. Clear existing active assignments for test operator
  await supabase
    .from('operator_machine_assignments')
    .update({ is_active: false, ended_at: new Date().toISOString(), end_reason: 'removed' })
    .eq('operator_id', testOperator.id)
    .eq('is_active', true);

  // Also clear active assignments on test machines for predictable capacity
  await supabase
    .from('operator_machine_assignments')
    .update({ is_active: false, ended_at: new Date().toISOString(), end_reason: 'removed' })
    .in('machine_id', [machine1.id, machine2.id])
    .eq('is_active', true);

  console.log('✅ Cleaned up pre-existing assignments for test scope.');

  let assign1Id = null;
  let assign2Id = null;
  let assign3Id = null;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Assign operator to Machine 1, Shift S1 (06:00 AM - 02:00 PM) -> SUCCESS (1st shift)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Assign 1st shift on Machine 1 (S1: 06:00 AM - 02:00 PM) ---');
    const { data: res1, error: err1 } = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: machine1.id,
      p_operator_id: testOperator.id,
      p_shift_start_time: '06:00 AM',
      p_shift_end_time: '02:00 PM',
      p_shift_code: 'S1',
      p_notes: 'Test Shift 1',
    });

    if (err1 || !res1?.success) {
      throw new Error(`TEST 1 Failed: ${err1?.message || res1?.error}`);
    }
    assign1Id = res1.assignment_id;
    console.log(`✅ TEST 1 PASSED: 1st shift assigned successfully (ID: ${assign1Id})`);

    const { count: count1 } = await supabase
      .from('operator_machine_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('operator_id', testOperator.id)
      .eq('is_active', true);
    console.log(`   Active shifts for operator: ${count1} (Expected: 1)`);
    if (count1 !== 1) throw new Error(`Expected 1 active shift, got ${count1}`);

    // -------------------------------------------------------------------------
    // TEST 2: Assign SAME operator to Machine 1, Shift S2 (02:00 PM - 10:00 PM) -> SUCCESS (2nd shift on same machine)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Assign 2nd shift on SAME Machine 1 (S2: 02:00 PM - 10:00 PM) ---');
    const { data: res2, error: err2 } = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: machine1.id,
      p_operator_id: testOperator.id,
      p_shift_start_time: '02:00 PM',
      p_shift_end_time: '10:00 PM',
      p_shift_code: 'S2',
      p_notes: 'Test Shift 2 (Double shift on same machine)',
    });

    if (err2 || !res2?.success) {
      throw new Error(`TEST 2 Failed: ${err2?.message || res2?.error}`);
    }
    assign2Id = res2.assignment_id;
    console.log(`✅ TEST 2 PASSED: 2nd shift assigned on same machine! (ID: ${assign2Id})`);

    const { count: count2 } = await supabase
      .from('operator_machine_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('operator_id', testOperator.id)
      .eq('is_active', true);
    console.log(`   Active shifts for operator: ${count2} (Expected: 2)`);
    if (count2 !== 2) throw new Error(`Expected 2 active shifts, got ${count2}`);

    // -------------------------------------------------------------------------
    // TEST 3: Assign SAME operator to Machine 1, Shift S3 (10:00 PM - 06:00 AM) -> SUCCESS (3rd shift = Full 24h coverage on machine by 1 operator!)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Assign 3rd shift on SAME Machine 1 (S3: 10:00 PM - 06:00 AM) -> Full 24h by 1 operator ---');
    const { data: res3, error: err3 } = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: machine1.id,
      p_operator_id: testOperator.id,
      p_shift_start_time: '10:00 PM',
      p_shift_end_time: '06:00 AM',
      p_shift_code: 'S3',
      p_notes: 'Test Shift 3 (Triple shift - Full 24h on machine)',
    });

    if (err3 || !res3?.success) {
      throw new Error(`TEST 3 Failed: ${err3?.message || res3?.error}`);
    }
    assign3Id = res3.assignment_id;
    console.log(`✅ TEST 3 PASSED: 3rd shift assigned on same machine! Full 24h coverage by 1 operator. (ID: ${assign3Id})`);

    const { count: count3 } = await supabase
      .from('operator_machine_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('operator_id', testOperator.id)
      .eq('is_active', true);
    console.log(`   Active shifts for operator: ${count3} (Expected: 3)`);
    if (count3 !== 3) throw new Error(`Expected 3 active shifts, got ${count3}`);

    // Verify machine operator_ids has unique IDs (deduplicated)
    const { data: m1Data } = await supabase
      .from('machines')
      .select('operator_ids')
      .eq('id', machine1.id)
      .single();
    const opOccurrences = (m1Data?.operator_ids || []).filter((id) => id === testOperator.id).length;
    console.log(`   Operator occurrences in machines.operator_ids: ${opOccurrences} (Expected: 1 deduplicated)`);
    if (opOccurrences !== 1) throw new Error(`machines.operator_ids contains duplicate entries for operator: ${opOccurrences}`);

    // -------------------------------------------------------------------------
    // TEST 4: Attempt to assign a 4th shift to the operator -> FAILURE (Max 3 shifts / 24h limit)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Attempt to assign 4th shift -> Expect P0002 / MAX_OPERATOR_SHIFTS_REACHED rejection ---');
    const { data: res4, error: err4 } = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: machine2.id,
      p_operator_id: testOperator.id,
      p_shift_start_time: '08:00 AM',
      p_shift_end_time: '04:00 PM',
      p_shift_code: 'DAY',
      p_notes: 'Test Shift 4 (Must be blocked)',
    });

    const isRejected4 =
      (err4 && (err4.code === 'P0002' || err4.message.includes('MAX_OPERATOR_SHIFTS_REACHED') || err4.message.includes('3 shifts') || err4.message.includes('24h'))) ||
      (res4 && res4.success === false && (res4.code === 'P0002' || res4.code === 'MAX_OPERATOR_SHIFTS_REACHED' || res4.error?.includes('3 shifts') || res4.error?.includes('24h')));

    if (isRejected4) {
      console.log(`✅ TEST 4 PASSED: 4th shift correctly REJECTED! Error: ${err4?.message || res4?.error}`);
    } else {
      throw new Error(`TEST 4 FAILED: 4th shift was NOT rejected! Result: ${JSON.stringify(res4)}, Error: ${JSON.stringify(err4)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Relieve 1st shift (S1) -> SUCCESS, operator now has 2 active shifts
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Relieve 1st shift (S1) via atomic end RPC ---');
    const { data: res5, error: err5 } = await supabase.rpc('end_operator_machine_assignment_atomic', {
      p_assignment_id: assign1Id,
      p_ended_by: testOperator.id,
      p_end_reason: 'removed',
    });

    if (err5 || !res5?.success) {
      throw new Error(`TEST 5 Failed: ${err5?.message || res5?.error}`);
    }
    console.log('✅ TEST 5 PASSED: 1st shift relieved.');

    const { count: count5 } = await supabase
      .from('operator_machine_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('operator_id', testOperator.id)
      .eq('is_active', true);
    console.log(`   Active shifts for operator: ${count5} (Expected: 2)`);
    if (count5 !== 2) throw new Error(`Expected 2 active shifts after relief, got ${count5}`);

    // -------------------------------------------------------------------------
    // TEST 6: Assign operator to 2nd machine (Machine 2, S1: 06:00 AM - 02:00 PM) -> SUCCESS (Multi-machine 3-shifts)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Assign operator to Machine 2, Shift S1 (Cross-machine 3rd shift) ---');
    const { data: res6, error: err6 } = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: machine2.id,
      p_operator_id: testOperator.id,
      p_shift_start_time: '06:00 AM',
      p_shift_end_time: '02:00 PM',
      p_shift_code: 'S1',
      p_notes: 'Test Cross-machine 3rd Shift',
    });

    if (err6 || !res6?.success) {
      throw new Error(`TEST 6 Failed: ${err6?.message || res6?.error}`);
    }
    console.log(`✅ TEST 6 PASSED: Cross-machine assignment successful! (ID: ${res6.assignment_id})`);

    const { count: count6 } = await supabase
      .from('operator_machine_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('operator_id', testOperator.id)
      .eq('is_active', true);
    console.log(`   Active shifts across fleet: ${count6} (Expected: 3)`);
    if (count6 !== 3) throw new Error(`Expected 3 active shifts across fleet, got ${count6}`);

    // -------------------------------------------------------------------------
    // TEST 7: Attempt shift window overlap -> Rejection
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Attempt overlapping shift time (overlaps with existing shifts) ---');
    const { data: res7, error: err7 } = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: machine2.id,
      p_operator_id: testOperator.id,
      p_shift_start_time: '01:00 PM',
      p_shift_end_time: '09:00 PM',
      p_shift_code: 'S2',
      p_notes: 'Overlapping shift test',
    });

    const isOverlapRejected =
      (err7 && (err7.message.includes('overlap') || err7.message.includes('active shifts') || err7.code === 'P0002' || err7.code === '23P01')) ||
      (res7 && res7.success === false);

    if (isOverlapRejected) {
      console.log(`✅ TEST 7 PASSED: Overlapping shift was correctly rejected! Message: ${err7?.message || res7?.error}`);
    } else {
      throw new Error('TEST 7 FAILED: Overlapping shift was not rejected!');
    }

    console.log('\n🎉 ALL 7/7 TESTS PASSED FLAWLESSLY ON DEV DATABASE!');
  } finally {
    // Cleanup
    await supabase
      .from('operator_machine_assignments')
      .update({ is_active: false, ended_at: new Date().toISOString(), end_reason: 'removed' })
      .eq('operator_id', testOperator.id)
      .eq('is_active', true);
    console.log('🧹 Cleaned up test assignments.');
  }
}

runTests().catch((err) => {
  console.error('❌ Test run failed:', err);
  process.exit(1);
});
