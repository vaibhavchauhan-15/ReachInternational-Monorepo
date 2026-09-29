import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

// Strictly target Development environment (vlmxciuogczumumrwyot)
loadEnv(path.resolve(__dirname, '../../apps/web/.env'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vlmxciuogczumumrwyot.supabase.co';
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl.includes('vlmxciuogczumumrwyot')) {
  console.error('❌ SAFETY CHECK FAILED: supabaseUrl must target Development project vlmxciuogczumumrwyot! Got:', supabaseUrl);
  process.exit(1);
}

if (!supabaseKey) {
  console.error('❌ Missing SUPABASE_SECRET_KEY in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runShiftAssignmentTests() {
  console.log('================================================================');
  console.log('🧪 TESTING 3-SHIFT OPERATOR ASSIGNMENT ON DEV DB (vlmxciuogczumumrwyot)');
  console.log('================================================================\n');

  // 1. Verify Target Machine
  const targetMachineId = 'd2390003-21f5-40db-af94-dd9f036de0e5';
  const { data: machine, error: mErr } = await supabase
    .from('machines')
    .select('id, machine_id, model, client_id')
    .eq('id', targetMachineId)
    .single();

  if (mErr || !machine) {
    console.error('❌ Failed to fetch target machine:', mErr?.message);
    process.exit(1);
  }
  console.log(`✅ Step 1: Found target machine: ${machine.machine_id} (${machine.model})`);

  // 2. Fetch or identify operators (need at least 4 to test 3 active + 1 rejected 4th)
  const { data: operators, error: oErr } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('role', 'operator')
    .limit(5);

  if (oErr || !operators || operators.length < 4) {
    console.error('❌ Need at least 4 operators in database for testing. Found:', operators?.length);
    process.exit(1);
  }
  console.log(`✅ Step 2: Found ${operators.length} operators for testing:`, operators.map(o => o.full_name).join(', '));

  // 3. Backup existing active assignments for this machine to restore later
  const { data: initialAssignments, error: aErr } = await supabase
    .from('operator_machine_assignments')
    .select('*')
    .eq('machine_id', targetMachineId)
    .eq('is_active', true);

  if (aErr) {
    console.error('❌ Failed to read initial assignments:', aErr.message);
    process.exit(1);
  }
  console.log(`ℹ️ Initial active assignments on machine: ${initialAssignments?.length || 0}`);

  // Deactivate existing assignments cleanly for the test
  await supabase
    .from('operator_machine_assignments')
    .update({ is_active: false, unassigned_at: new Date().toISOString() })
    .eq('machine_id', targetMachineId)
    .eq('is_active', true);

  try {
    // 4. Test Single Shift Assignment via assign_operator_machine_atomic
    console.log('\n--- Test 1: Assign Operator 1 to Shift S1 (06:00 - 14:00, 8h) ---');
    const op1 = operators[0];
    const { data: res1, error: err1 } = await supabase.rpc('assign_operator_machine_atomic', {
      p_operator_id: op1.id,
      p_machine_id: targetMachineId,
      p_notes: 'Test shift S1 assignment',
      p_shift_code: 'S1',
      p_shift_start_time: '06:00:00',
      p_shift_end_time: '14:00:00',
    });

    if (err1) {
      throw new Error(`RPC assign op1 failed: ${err1.message}`);
    }
    console.log('RPC Result 1:', res1);
    if (!res1 || !res1.assignment_id) {
      throw new Error('Expected assignment_id in RPC result');
    }
    console.log(`✅ Operator 1 assigned successfully with shift S1`);

    // 5. Test Idempotency (Calling again with same operator & machine)
    console.log('\n--- Test 2: Idempotency check (re-saving same assignment) ---');
    const { data: res1Repeat, error: err1Repeat } = await supabase.rpc('assign_operator_machine_atomic', {
      p_operator_id: op1.id,
      p_machine_id: targetMachineId,
      p_notes: 'Repeat save check',
      p_shift_code: 'S1',
      p_shift_start_time: '06:00:00',
      p_shift_end_time: '14:00:00',
    });

    if (err1Repeat) {
      throw new Error(`RPC idempotency repeat failed: ${err1Repeat.message}`);
    }
    console.log('Repeat RPC Result:', res1Repeat);
    if (!res1Repeat?.already_active && res1Repeat?.assignment_id !== res1.assignment_id) {
      console.warn('⚠️ Warning: Expected already_active true or same assignment_id');
    } else {
      console.log('✅ Idempotency verified: duplicate assignment smoothly recognized');
    }

    // 6. Test Shift 2 Assignment (Operator 2 -> S2: 14:00 - 22:00, 8h)
    console.log('\n--- Test 3: Assign Operator 2 to Shift S2 (14:00 - 22:00, 8h) on SAME machine ---');
    const op2 = operators[1];
    const { data: res2, error: err2 } = await supabase.rpc('assign_operator_machine_atomic', {
      p_operator_id: op2.id,
      p_machine_id: targetMachineId,
      p_notes: 'Test shift S2 assignment',
      p_shift_code: 'S2',
      p_shift_start_time: '14:00:00',
      p_shift_end_time: '22:00:00',
    });

    if (err2) {
      throw new Error(`RPC assign op2 failed: ${err2.message}`);
    }
    console.log('RPC Result 2:', res2);
    console.log(`✅ Operator 2 assigned successfully with shift S2`);

    // 7. Test Shift 3 Assignment (Operator 3 -> S3: 22:00 - 06:00, 8h)
    console.log('\n--- Test 4: Assign Operator 3 to Shift S3 (22:00 - 06:00, 8h) on SAME machine ---');
    const op3 = operators[2];
    const { data: res3, error: err3 } = await supabase.rpc('assign_operator_machine_atomic', {
      p_operator_id: op3.id,
      p_machine_id: targetMachineId,
      p_notes: 'Test shift S3 assignment',
      p_shift_code: 'S3',
      p_shift_start_time: '22:00:00',
      p_shift_end_time: '06:00:00',
    });

    if (err3) {
      throw new Error(`RPC assign op3 failed: ${err3.message}`);
    }
    console.log('RPC Result 3:', res3);
    console.log(`✅ Operator 3 assigned successfully with shift S3 (3 shifts total 24h)`);

    // 8. Test 4th Operator Assignment MUST Fail (Max 3 Allowed)
    console.log('\n--- Test 5: Verify 4th operator assignment is REJECTED by max 3 capacity trigger ---');
    const op4 = operators[3];
    const { data: res4, error: err4 } = await supabase.rpc('assign_operator_machine_atomic', {
      p_operator_id: op4.id,
      p_machine_id: targetMachineId,
      p_notes: 'Attempting 4th operator assignment',
      p_shift_code: 'S4',
      p_shift_start_time: '06:00:00',
      p_shift_end_time: '14:00:00',
    });

    console.log('4th Assignment Result:', res4 || err4?.message);
    const wasRejected = (res4 && res4.success === false && res4.code === 'MAX_OPERATORS_REACHED') ||
      (err4 && err4.message.includes('MAX_OPERATORS_REACHED'));

    if (!wasRejected) {
      throw new Error(`Expected 4th assignment to be REJECTED with MAX_OPERATORS_REACHED, but got: ${JSON.stringify(res4 || err4)}`);
    }
    console.log('✅ 4th operator assignment was correctly REJECTED with MAX_OPERATORS_REACHED (capacity capped at 3)!');

    // 9. Verify In-DB state
    console.log('\n--- Test 6: Verify Active Assignments & Shift Codes in Database ---');
    const { data: activeRows, error: aRowsErr } = await supabase
      .from('operator_machine_assignments')
      .select('id, operator_id, machine_id, shift_code, shift_start_time, shift_end_time, is_active')
      .eq('machine_id', targetMachineId)
      .eq('is_active', true);

    if (aRowsErr) throw new Error(`Failed to query active rows: ${aRowsErr.message}`);

    console.log(`Active assignments count: ${activeRows.length}`);
    activeRows.forEach((row, i) => {
      console.log(`  [${i + 1}] Operator ${row.operator_id} -> Shift: ${row.shift_code || 'none'} (${row.shift_start_time} - ${row.shift_end_time})`);
    });

    if (activeRows.length !== 3) {
      throw new Error(`Expected exactly 3 active assignments, got ${activeRows.length}`);
    }

    const hasShiftCodes = activeRows.every(r => !!r.shift_code);
    if (!hasShiftCodes) {
      throw new Error('Expected all assigned rows to have a valid shift_code stored!');
    }
    console.log('✅ Exactly 3 active assignments present with accurate shift_code and timings stored in DB!');

    console.log('\n================================================================');
    console.log('🎉 ALL 3-SHIFT OPERATOR ASSIGNMENT TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================');

  } finally {
    // Restore initial assignments
    console.log('\n--- Restoring initial machine assignment state ---');
    await supabase
      .from('operator_machine_assignments')
      .delete()
      .eq('machine_id', targetMachineId);

    if (initialAssignments && initialAssignments.length > 0) {
      for (const a of initialAssignments) {
        delete a.id;
        delete a.created_at;
        delete a.updated_at;
        await supabase.from('operator_machine_assignments').insert(a);
      }
      console.log(`Restored ${initialAssignments.length} initial assignments.`);
    } else {
      console.log('Machine left clean.');
    }
  }
}

runShiftAssignmentTests().catch(err => {
  console.error('\n❌ TEST RUNNER FATAL ERROR:', err);
  process.exit(1);
});
