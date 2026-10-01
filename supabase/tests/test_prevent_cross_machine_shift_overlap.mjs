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
  console.log('🚀 Running Cross-Machine Shift Overlap & Assignment Verification Tests on Dev DB...');

  // 1. Get an active test operator
  const { data: operators, error: opErr } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('role', 'operator')
    .eq('status', 'active')
    .limit(5);

  if (opErr || !operators || operators.length === 0) {
    throw new Error('No active operator found for test: ' + JSON.stringify(opErr));
  }
  const testOperator = operators[0];
  console.log(`✅ Using test operator: ${testOperator.full_name} (${testOperator.id})`);

  // 2. Fetch machines specifically for NCC Limited and Tata Projects Limited (the exact user issue)
  const { data: nccMachines } = await supabase
    .from('machines')
    .select('id, machine_id, client_id, client:clients(id, company_name)')
    .eq('client_id', 'ea0dbad0-6ce8-4965-9fdd-2d6287b3063c') // NCC Limited (Shift A: 06:00-18:00, Shift B: 18:00-06:00)
    .limit(1);

  const { data: tataMachines } = await supabase
    .from('machines')
    .select('id, machine_id, client_id, client:clients(id, company_name)')
    .eq('client_id', '479f9a08-7242-4417-959c-4611c7c0361b') // Tata Projects (Shift A: 06:00-14:00, Shift B: 14:00-22:00, Shift C: 22:00-06:00)
    .limit(1);

  const { data: ltMachines } = await supabase
    .from('machines')
    .select('id, machine_id, client_id, client:clients(id, company_name)')
    .eq('client_id', '7a2f76de-3b7f-465a-95f2-cff5dd29db06') // L&T
    .limit(2);

  const nccMachine = nccMachines?.[0];
  const tataMachine = tataMachines?.[0];
  const ltMachine1 = ltMachines?.[0];
  const ltMachine2 = ltMachines?.[1] || ltMachine1;

  if (!nccMachine || !tataMachine) {
    throw new Error('Could not find NCC and Tata Projects machines to reproduce real scenario.');
  }

  console.log(`✅ Machine 1 (NCC Limited - 12h shifts): ${nccMachine.machine_id}`);
  console.log(`✅ Machine 2 (Tata Projects - 8h shifts): ${tataMachine.machine_id}`);

  // Backup existing active assignments for this operator to restore later
  const { data: originalAssignments, error: origErr } = await supabase
    .from('operator_machine_assignments')
    .select('*')
    .eq('operator_id', testOperator.id)
    .eq('is_active', true);

  if (origErr) {
    console.warn('Warning fetching original assignments:', origErr);
  }

  // Deactivate existing assignments for clean test isolation
  await supabase
    .from('operator_machine_assignments')
    .update({ is_active: false, ended_at: new Date().toISOString(), end_reason: 'reassigned' })
    .eq('operator_id', testOperator.id)
    .eq('is_active', true);

  // Also deactivate assignments on test machines to prevent machine capacity collisions
  await supabase
    .from('operator_machine_assignments')
    .update({ is_active: false, ended_at: new Date().toISOString(), end_reason: 'reassigned' })
    .in('machine_id', [nccMachine.id, tataMachine.id, ltMachine1?.id, ltMachine2?.id].filter(Boolean))
    .eq('is_active', true);

  let passedAll = true;

  try {
    // =========================================================================
    // SCENARIO 1: Exact User Bug Reproduction & Fix Verification
    // Operator is assigned to NCC Limited (Shift A: 06:00 - 18:00)
    // Then user tries to assign operator to Tata Projects (Shift B: 14:00 - 22:00)
    // There is a 4-hour overlap (14:00 - 18:00) -> MUST BE REJECTED with SHIFT_OVERLAP_CONFLICT!
    // =========================================================================
    console.log('\n--- SCENARIO 1: Overlapping Shifts Across NCC (06:00-18:00) and Tata Projects (14:00-22:00) ---');
    const { data: assign1, error: err1 } = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: nccMachine.id,
      p_operator_id: testOperator.id,
      p_shift_start_time: '06:00:00',
      p_shift_end_time: '18:00:00',
      p_shift_code: 'A',
      p_notes: 'NCC Shift A assignment',
    });

    if (err1 || (assign1 && !assign1.success)) {
      throw new Error(`Failed to assign NCC Shift A: ${err1?.message || assign1?.error}`);
    }
    console.log(`✅ Machine ${nccMachine.machine_id} Shift A (06:00-18:00) assigned successfully.`);

    // Now attempt to assign overlapping Shift B (14:00-22:00) on Tata Projects Machine
    const { data: assign2, error: err2 } = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: tataMachine.id,
      p_operator_id: testOperator.id,
      p_shift_start_time: '14:00:00',
      p_shift_end_time: '22:00:00',
      p_shift_code: 'B',
      p_notes: 'Tata Projects Shift B overlapping attempt',
    });

    const isConflict =
      (err2 && (err2.message.includes('SHIFT_OVERLAP_CONFLICT') || err2.code === 'P0003')) ||
      (assign2 && !assign2.success && (assign2.error?.includes('SHIFT_OVERLAP_CONFLICT') || assign2.error?.includes('overlaps with')));

    if (isConflict) {
      console.log('✅ PASSED: RPC correctly rejected cross-machine overlapping shift (06:00-18:00 vs 14:00-22:00).');
      console.log(`   Conflict message: ${err2?.message || assign2?.error}`);
    } else {
      console.error('❌ FAILED: RPC allowed cross-machine overlapping shift! Response:', assign2);
      passedAll = false;
    }

    // =========================================================================
    // SCENARIO 2: Valid Non-Overlapping Shift Across Machines
    // Operator has NCC Limited Shift A (06:00 - 18:00).
    // Now assign to Tata Projects Shift C (22:00 - 06:00) [crosses midnight].
    // [22:00, 06:00) does NOT overlap [06:00, 18:00). -> MUST SUCCEED!
    // =========================================================================
    console.log('\n--- SCENARIO 2: Non-Overlapping Midnight-Crossing Shift Across Machines ---');
    const { data: assign2Valid, error: err2Valid } = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: tataMachine.id,
      p_operator_id: testOperator.id,
      p_shift_start_time: '22:00:00',
      p_shift_end_time: '06:00:00',
      p_shift_code: 'C',
      p_notes: 'Tata Projects Shift C night shift',
    });

    if (!err2Valid && assign2Valid && assign2Valid.success) {
      console.log(`✅ PASSED: RPC allowed non-overlapping midnight shift (22:00-06:00) alongside (06:00-18:00) across ${nccMachine.machine_id} and ${tataMachine.machine_id}.`);
    } else {
      console.error(`❌ FAILED: Non-overlapping night shift rejected: ${err2Valid?.message || assign2Valid?.error}`);
      passedAll = false;
    }

    // Clean up test operator assignments for Scenario 3
    await supabase
      .from('operator_machine_assignments')
      .update({ is_active: false, ended_at: new Date().toISOString(), end_reason: 'reassigned' })
      .eq('operator_id', testOperator.id)
      .eq('is_active', true);

    // =========================================================================
    // SCENARIO 3: Three Consecutive 8h Shifts (24h) Across Machines
    // Tata Projects: Shift A (06:00-14:00)
    // Tata Projects / LT: Shift B (14:00-22:00)
    // Tata Projects / LT: Shift C (22:00-06:00)
    // All 3 non-overlapping -> MUST ALL SUCCEED!
    // =========================================================================
    console.log('\n--- SCENARIO 3: Three Consecutive 8h Shifts (24h) Across Machines ---');
    const resS1 = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: tataMachine.id,
      p_operator_id: testOperator.id,
      p_shift_start_time: '06:00:00',
      p_shift_end_time: '14:00:00',
      p_shift_code: 'A',
    });
    const resS2 = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: ltMachine1.id,
      p_operator_id: testOperator.id,
      p_shift_start_time: '14:00:00',
      p_shift_end_time: '22:00:00',
      p_shift_code: 'B',
    });
    const resS3 = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: ltMachine2.id,
      p_operator_id: testOperator.id,
      p_shift_start_time: '22:00:00',
      p_shift_end_time: '06:00:00',
      p_shift_code: 'C',
    });

    const s1Ok = !resS1.error && resS1.data?.success;
    const s2Ok = !resS2.error && resS2.data?.success;
    const s3Ok = !resS3.error && resS3.data?.success;

    if (s1Ok && s2Ok && s3Ok) {
      console.log('✅ PASSED: All 3 consecutive non-overlapping shifts (24h) assigned successfully.');
    } else {
      console.error('❌ FAILED: 3 shifts could not be assigned:', {
        resS1: resS1.error || resS1.data,
        resS2: resS2.error || resS2.data,
        resS3: resS3.error || resS3.data,
      });
      passedAll = false;
    }

    // =========================================================================
    // SCENARIO 4: 4th Shift Assignment Rejection (Max 3 shifts / 24h standard)
    // Operator already has 3 active shifts (24h full coverage).
    // Attempting a 4th shift MUST FAIL with MAX_OPERATOR_SHIFTS_REACHED.
    // =========================================================================
    console.log('\n--- SCENARIO 4: 4th Shift Assignment Rejection ---');
    const resS4 = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: nccMachine.id,
      p_operator_id: testOperator.id,
      p_shift_start_time: '10:00:00',
      p_shift_end_time: '12:00:00',
      p_shift_code: 'A',
    });

    const isMaxReached =
      (resS4.error && (resS4.error.message.includes('MAX_OPERATOR_SHIFTS_REACHED') || resS4.error.code === 'P0002')) ||
      (resS4.data && !resS4.data.success && (
        resS4.data.code === 'MAX_OPERATOR_SHIFTS_REACHED' ||
        resS4.data.error?.includes('3 shifts') ||
        resS4.data.error?.includes('MAX_OPERATOR_SHIFTS_REACHED')
      ));

    if (isMaxReached) {
      console.log('✅ PASSED: RPC correctly rejected 4th shift (operator already has 3 active shifts).');
      console.log(`   Rejection message: ${resS4.error?.message || resS4.data?.error}`);
    } else {
      console.error('❌ FAILED: 4th shift was not blocked by MAX_OPERATOR_SHIFTS_REACHED:', resS4);
      passedAll = false;
    }

    // Clean up test assignments for Scenario 5
    await supabase
      .from('operator_machine_assignments')
      .update({ is_active: false, ended_at: new Date().toISOString(), end_reason: 'reassigned' })
      .eq('operator_id', testOperator.id)
      .eq('is_active', true);

    // =========================================================================
    // SCENARIO 5: Trigger trg_sync_client_shift_codes_to_assignments
    // When a client's shift code is updated, active assignments on its machines
    // must automatically sync to the new timings.
    // =========================================================================
    console.log('\n--- SCENARIO 5: Client Shift Code Cascading Trigger ---');
    const { data: clientShifts } = await supabase
      .from('client_shift_codes')
      .select('*')
      .eq('client_id', tataMachine.client_id)
      .eq('is_active', true)
      .limit(1);

    if (clientShifts && clientShifts.length > 0) {
      const targetShift = clientShifts[0];
      const originalStart = targetShift.start_time;
      const originalEnd = targetShift.end_time;
      const tempStart = '07:30:00';
      const tempEnd = '15:30:00';

      // Assign operator to tataMachine with targetShift.code
      const assignRes = await supabase.rpc('assign_operator_machine_atomic', {
        p_machine_id: tataMachine.id,
        p_operator_id: testOperator.id,
        p_shift_start_time: originalStart,
        p_shift_end_time: originalEnd,
        p_shift_code: targetShift.code,
      });

      if (assignRes.error || (assignRes.data && !assignRes.data.success)) {
        console.error('Scenario 5 prep assignment failed:', assignRes);
        passedAll = false;
      } else {
        // Update client shift code to new temp times
        const { error: updErr } = await supabase
          .from('client_shift_codes')
          .update({ start_time: tempStart, end_time: tempEnd })
          .eq('id', targetShift.id);

        if (updErr) {
          console.error('Failed to update client_shift_codes:', updErr);
          passedAll = false;
        } else {
          // Check if active assignment was automatically updated by trigger
          const { data: updatedAss } = await supabase
            .from('operator_machine_assignments')
            .select('shift_start_time, shift_end_time')
            .eq('operator_id', testOperator.id)
            .eq('machine_id', tataMachine.id)
            .eq('is_active', true)
            .single();

          const syncedStart = updatedAss?.shift_start_time?.slice(0, 8);
          const syncedEnd = updatedAss?.shift_end_time?.slice(0, 8);

          if (syncedStart === tempStart && syncedEnd === tempEnd) {
            console.log(`✅ PASSED: Trigger trg_sync_client_shift_codes_to_assignments successfully synced shift times to assignment: ${syncedStart} - ${syncedEnd}`);
          } else {
            console.error(`❌ FAILED: Assignment timings not synced by trigger. Expected: ${tempStart}-${tempEnd}, Found: ${syncedStart}-${syncedEnd}`);
            passedAll = false;
          }

          // Restore original client shift code timings
          await supabase
            .from('client_shift_codes')
            .update({ start_time: originalStart, end_time: originalEnd })
            .eq('id', targetShift.id);
          console.log('✅ Restored client shift code to original timings.');
        }
      }
    }

  } finally {
    // =========================================================================
    // CLEANUP: Clean up test assignments and restore original state
    // =========================================================================
    console.log('\n--- CLEANUP ---');
    await supabase
      .from('operator_machine_assignments')
      .update({ is_active: false, ended_at: new Date().toISOString(), end_reason: 'reassigned' })
      .eq('operator_id', testOperator.id)
      .eq('is_active', true);

    // Restore original operator assignments if any
    if (originalAssignments && originalAssignments.length > 0) {
      for (const orig of originalAssignments) {
        await supabase
          .from('operator_machine_assignments')
          .update({ is_active: true, ended_at: null, end_reason: null })
          .eq('id', orig.id);
      }
      console.log(`✅ Restored ${originalAssignments.length} original assignments for operator.`);
    }

    console.log(passedAll ? '\n🎉 ALL 5 SCENARIOS PASSED VERIFICATION!' : '\n⚠️ SOME SCENARIOS FAILED!');
  }

  if (!passedAll) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
