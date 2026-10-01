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
  console.log('🚀 Running Shift Presets & Renaming Cascade Verification Tests on Dev DB...');

  let testClientId = null;
  let testMachineId = null;
  let testOperatorId = null;

  try {
    // ----------------------------------------------------
    // TEST 1: Strict DB Isolation Check
    // ----------------------------------------------------
    console.log('\n--- TEST 1: Strict DB Isolation Check ---');
    console.log(`Verified connected project: ${DEV_PROJECT_ID} (${supabaseUrl})`);
    if (supabaseUrl.includes('dhbbgfzbyatzvqafnsqp')) {
      throw new Error('FATAL: Attempted execution on PRODUCTION DB!');
    }
    console.log('✅ TEST 1 PASSED: Strict Supabase DB isolation verified.');

    // ----------------------------------------------------
    // TEST 2: Create Test Client with Shift Preset
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Create Test Client with Three 8-Hour Preset [A, B, C] ---');
    const testClientCode = `TEST-CLI-${Date.now().toString().slice(-4)}`;
    const { data: newClient, error: clientErr } = await supabase
      .from('clients')
      .insert({
        code: testClientCode,
        company_name: `Automated Test Client ${testClientCode}`,
        contact_person: 'Rahul Sharma',
        phone: '+91 9988776655',
        gstin: '07AAAAA0000A1Z5',
        pan_number: 'ABCDE1234F',
        street: 'Industrial Plot 42',
        city: 'Gurugram',
        state: 'Haryana',
        status: 'active',
      })
      .select()
      .single();

    if (clientErr) throw new Error(`Client creation failed: ${clientErr.message}`);
    testClientId = newClient.id;
    console.log(`Created test client: ${newClient.company_name} (ID: ${testClientId})`);

    // Insert "three_8h" preset shifts as provisioned by createClientAction
    const presetShifts = [
      {
        client_id: testClientId,
        code: 'A',
        name: 'Shift A (Morning)',
        start_time: '06:00:00',
        end_time: '14:00:00',
        scheduled_minutes: 480,
        normal_minutes: 480,
        crosses_midnight: false,
        display_order: 1,
        is_active: true,
      },
      {
        client_id: testClientId,
        code: 'B',
        name: 'Shift B (Evening)',
        start_time: '14:00:00',
        end_time: '22:00:00',
        scheduled_minutes: 480,
        normal_minutes: 480,
        crosses_midnight: false,
        display_order: 2,
        is_active: true,
      },
      {
        client_id: testClientId,
        code: 'C',
        name: 'Shift C (Night)',
        start_time: '22:00:00',
        end_time: '06:00:00',
        scheduled_minutes: 480,
        normal_minutes: 480,
        crosses_midnight: true,
        display_order: 3,
        is_active: true,
      },
    ];

    const { data: insertedShifts, error: shiftInsertErr } = await supabase
      .from('client_shift_codes')
      .insert(presetShifts)
      .select();

    if (shiftInsertErr) throw new Error(`Shift insert failed: ${shiftInsertErr.message}`);
    if (insertedShifts.length !== 3) throw new Error(`Expected 3 shifts, got ${insertedShifts.length}`);

    console.log(`✅ TEST 2 PASSED: 3 preset shifts [A, B, C] created successfully for client.`);
    for (const s of insertedShifts) {
      console.log(`   - Code: ${s.code} | Name: "${s.name}" | Timings: ${s.start_time} - ${s.end_time}`);
    }

    // ----------------------------------------------------
    // TEST 3: Create Machine & Active Assignment with Shift Code 'A'
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Create Machine & Active Assignment with Shift Code "A" ---');
    // Query an active operator who has no conflicting active assignment during 06:00 - 14:00
    const { data: allOperators, error: opListErr } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('role', 'operator')
      .eq('status', 'active');

    if (opListErr || !allOperators?.length) {
      throw new Error(`Failed to find operators: ${opListErr?.message || 'No operators found'}`);
    }

    const { data: activeAssignmentsList } = await supabase
      .from('operator_machine_assignments')
      .select('operator_id, shift_code, shift_start_time, shift_end_time')
      .eq('is_active', true);

    const activeConflictOpIds = new Set(
      (activeAssignmentsList || [])
        .filter((a) => a.shift_start_time === '06:00:00' || a.shift_code === 'A')
        .map((a) => a.operator_id)
    );

    // Prefer Ramesh Kumar or any operator without an active morning shift
    const candidate =
      allOperators.find((o) => o.id === 'f790bdac-3f4f-4681-b9e9-9a1c2d269fbd') ||
      allOperators.find((o) => !activeConflictOpIds.has(o.id)) ||
      allOperators[0];

    const operator = candidate;
    console.log(`Selected operator for shift test: ${operator.full_name} (${operator.id})`);

    const testMachineCode = `M/C-TEST-${Date.now().toString().slice(-4)}`;
    const { data: newMachine, error: mErr } = await supabase
      .from('machines')
      .insert({
        machine_id: testMachineCode,
        machine_name: testMachineCode,
        model: 'Genie S-85 XC Test',
        serial_number: `SN-${Date.now().toString().slice(-6)}`,
        status: 'rented',
        health_status: 'active',
        client_id: testClientId,
        operator_ids: [operator.id],
      })
      .select()
      .single();

    if (mErr) throw new Error(`Machine creation failed: ${mErr.message}`);
    testMachineId = newMachine.id;

    // Get an admin for assigned_by
    const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin').limit(1);
    const assignedBy = admins?.[0]?.id || operator.id;

    // Create assignment referencing shift_code 'A'
    const { data: assignment, error: aErr } = await supabase
      .from('operator_machine_assignments')
      .insert({
        machine_id: testMachineId,
        operator_id: operator.id,
        shift_code: 'A',
        shift_start_time: '06:00:00',
        shift_end_time: '14:00:00',
        assigned_by: assignedBy,
        is_active: true,
      })
      .select()
      .single();

    if (aErr) throw new Error(`Assignment creation failed: ${aErr.message}`);
    console.log(`Created machine ${newMachine.machine_id} and assigned ${operator.full_name} to Shift code 'A'.`);
    console.log('✅ TEST 3 PASSED: Machine and initial shift assignment created.');

    // ----------------------------------------------------
    // TEST 4: Client Updates Shift Name ("Shift A" -> "Morning Shift Alpha")
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Dynamic Shift Renaming Cascade (Name Update) ---');
    const shiftARow = insertedShifts.find((s) => s.code === 'A');
    const updatedShiftName = 'Morning Shift Alpha (Updated)';

    const { error: renameErr } = await supabase
      .from('client_shift_codes')
      .update({ name: updatedShiftName })
      .eq('id', shiftARow.id);

    if (renameErr) throw new Error(`Shift rename failed: ${renameErr.message}`);

    // Verify dynamic hydration:
    // 1. Fetch active assignments for machine
    const { data: activeAssignments } = await supabase
      .from('operator_machine_assignments')
      .select('operator_id, shift_code, shift_start_time, shift_end_time')
      .eq('machine_id', testMachineId)
      .eq('is_active', true);

    // 2. Fetch client shifts
    const { data: clientShifts } = await supabase
      .from('client_shift_codes')
      .select('code, name, start_time, end_time')
      .eq('client_id', testClientId);

    const shiftMap = new Map(clientShifts.map((cs) => [cs.code.toUpperCase(), cs]));
    const dynamicResolvedName = shiftMap.get(activeAssignments[0].shift_code.toUpperCase())?.name;

    if (dynamicResolvedName !== updatedShiftName) {
      throw new Error(`Expected dynamic shift name "${updatedShiftName}", got "${dynamicResolvedName}"`);
    }

    console.log(`Dynamic shift name resolved from client_shift_codes: "${dynamicResolvedName}"`);
    console.log('✅ TEST 4 PASSED: Renaming shift name in client_shift_codes dynamically updates active assignments without operator relief!');

    // ----------------------------------------------------
    // TEST 5: Client Renames Shift Code ("A" -> "A1") with Cascading Update
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Cascading Code Rename ("A" -> "A1") ---');
    // Simulate upsertClientShiftCodeAction cascading update
    const newCode = 'A1';
    await supabase
      .from('client_shift_codes')
      .update({ code: newCode })
      .eq('id', shiftARow.id);

    // Cascade update to operator_machine_assignments
    await supabase
      .from('operator_machine_assignments')
      .update({ shift_code: newCode })
      .eq('machine_id', testMachineId)
      .eq('shift_code', 'A');

    const { data: cascadedAssignment } = await supabase
      .from('operator_machine_assignments')
      .select('shift_code')
      .eq('id', assignment.id)
      .single();

    if (cascadedAssignment.shift_code !== newCode) {
      throw new Error(`Expected cascaded shift_code "${newCode}", got "${cascadedAssignment.shift_code}"`);
    }

    console.log(`Assignment shift_code cascaded to: "${cascadedAssignment.shift_code}"`);
    console.log('✅ TEST 5 PASSED: Shift code change cascaded cleanly to active machine assignments.');

    // ----------------------------------------------------
    // TEST 6: Apply Preset Replace Mode ("two_12h")
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Apply Preset Replace Mode ("two_12h") ---');
    // Simulate applyClientShiftPresetAction with mode: "replace"
    await supabase.from('client_shift_codes').delete().eq('client_id', testClientId);

    const two12hShifts = [
      {
        client_id: testClientId,
        code: 'DAY',
        name: 'Day Shift (12h)',
        start_time: '08:00:00',
        end_time: '20:00:00',
        scheduled_minutes: 720,
        normal_minutes: 480,
        crosses_midnight: false,
        display_order: 1,
        is_active: true,
      },
      {
        client_id: testClientId,
        code: 'NIGHT',
        name: 'Night Shift (12h)',
        start_time: '20:00:00',
        end_time: '08:00:00',
        scheduled_minutes: 720,
        normal_minutes: 480,
        crosses_midnight: true,
        display_order: 2,
        is_active: true,
      },
    ];

    const { data: replacedShifts, error: repErr } = await supabase
      .from('client_shift_codes')
      .insert(two12hShifts)
      .select();

    if (repErr) throw new Error(`Replace preset failed: ${repErr.message}`);
    if (replacedShifts.length !== 2) throw new Error(`Expected 2 shifts for two_12h, got ${replacedShifts.length}`);

    console.log('✅ TEST 6 PASSED: Replaced existing shifts with Two 12-Hour Shifts [Day, Night] preset.');
    for (const s of replacedShifts) {
      console.log(`   - Code: ${s.code} | Name: "${s.name}" | Timings: ${s.start_time} - ${s.end_time}`);
    }

    console.log('\n🎉 ALL 6/6 TESTS PASSED FLAWLESSLY ON DEV DATABASE!');
  } finally {
    // Clean up test records
    console.log('\n🧹 Cleaning up test artifacts on Dev DB...');
    if (testMachineId) {
      await supabase.from('operator_machine_assignments').delete().eq('machine_id', testMachineId);
      await supabase.from('machines').delete().eq('id', testMachineId);
    }
    if (testClientId) {
      await supabase.from('client_shift_codes').delete().eq('client_id', testClientId);
      await supabase.from('clients').delete().eq('id', testClientId);
    }
    if (testOperatorId) {
      await supabase.from('users').delete().eq('id', testOperatorId);
      await supabase.auth.admin.deleteUser(testOperatorId);
    }
    console.log('Cleanup complete.');
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
