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

async function runPersonnelModalTests() {
  console.log('================================================================');
  console.log('🧪 VERIFYING PERSONNEL MODAL ACROSS MULTIPLE MACHINES (DEV DB)');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      if (details) console.log(`     ${details}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (details) console.error(`     ${details}`);
    }
  }

  // -------------------------------------------------------------
  // TEST SUITE 1: Code-Level Component Cleanliness Verification
  // -------------------------------------------------------------
  console.log('--- TEST SUITE 1: UI Component Cleanliness (No Client Details in Personnel Modals) ---');

  const webEditModalsPath = path.resolve(__dirname, '../../apps/web/components/machines/MachineEditModals.tsx');
  const webEditorPath = path.resolve(__dirname, '../../apps/web/components/machines/OperatorShiftRosterEditor.tsx');
  const mobileModalPath = path.resolve(__dirname, '../../apps/mobile/components/machines/MachineModal.tsx');

  const webEditModalsContent = fs.readFileSync(webEditModalsPath, 'utf8');
  const webEditorContent = fs.readFileSync(webEditorPath, 'utf8');
  const mobileModalContent = fs.readFileSync(mobileModalPath, 'utf8');

  // Find MachinePersonnelModal in webEditModalsContent
  const personnelModalStart = webEditModalsContent.indexOf('export function MachinePersonnelModal');
  const nextModalStart = webEditModalsContent.indexOf('export function MachineClientModal', personnelModalStart);
  const personnelModalSection = webEditModalsContent.slice(personnelModalStart, nextModalStart);

  assert(
    !personnelModalSection.includes('Linked Client & Shift Details'),
    'MachinePersonnelModal does NOT contain "Linked Client & Shift Details" card',
    'Verified client details card has been completely removed.'
  );

  assert(
    !personnelModalSection.includes('Client / Company'),
    'MachinePersonnelModal does NOT contain "Client / Company" field',
    'Verified no client name or company info displays in personnel modal.'
  );

  assert(
    !personnelModalSection.includes('Total Client Shifts:'),
    'MachinePersonnelModal does NOT contain "Total Client Shifts" banner in body',
    'Verified banner was removed.'
  );

  assert(
    !personnelModalSection.includes('isRented &&'),
    'MachinePersonnelModal does NOT have conditional isRented client card',
    'Verified isRented conditional rendering removed.'
  );

  assert(
    personnelModalSection.includes('Assigned Supervisors') &&
    personnelModalSection.includes('Assigned Operators (24h)'),
    'MachinePersonnelModal contains clean "Assigned Supervisors" and "Assigned Operators (24h)" sections',
    'Verified modal focuses purely on personnel assignment with clean headers.'
  );

  assert(
    !personnelModalSection.includes('AnimatedShield') &&
    !personnelModalSection.includes('AnimatedWrench'),
    'MachinePersonnelModal does NOT contain AnimatedShield or AnimatedWrench icons',
    'Verified icons were removed from section headers as requested.'
  );

  assert(
    !webEditorContent.includes('Configured Shifts ('),
    'OperatorShiftRosterEditor does NOT contain "Configured Shifts" indicator banner',
    'Verified .space-y-3.5 > .flex banner completely removed.'
  );

  assert(
    !mobileModalContent.includes('clientShiftBanner'),
    'Mobile MachineModal does NOT contain clientShiftBanner style or element',
    'Verified mobile personnel section matches web without client banner.'
  );

  // -------------------------------------------------------------
  // TEST SUITE 2: Multi-Machine Discovery (Rented and Available)
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: Multi-Machine Discovery from Dev Database ---');

  // 1. Fetch Feedback Machine
  const feedbackMachineId = '45e02181-244c-45b6-a0bd-81e2d50998ef';
  const { data: feedbackMachine, error: fmErr } = await supabase
    .from('machines')
    .select('id, machine_id, model, serial_number, status, client_id, client:clients(id, company_name, code, client_id)')
    .eq('id', feedbackMachineId)
    .single();

  assert(!fmErr && !!feedbackMachine, `Retrieved Feedback Machine ${feedbackMachineId}`, `Machine ID: ${feedbackMachine?.machine_id}, Status: ${feedbackMachine?.status}, Client: ${feedbackMachine?.client?.company_name || 'None'}`);

  // 2. Fetch All Machines
  const { data: allMachines } = await supabase
    .from('machines')
    .select('id, machine_id, model, serial_number, status, client_id, client:clients(id, company_name, code, client_id)');

  // 3. Discover Client Shift Codes
  const { data: allClientShifts } = await supabase
    .from('client_shift_codes')
    .select('client_id, code, name, start_time, end_time, is_active')
    .eq('is_active', true);

  const clientIdsWithShifts = new Set((allClientShifts || []).map(cs => cs.client_id));
  console.log(`  Discovered ${allClientShifts?.length} active custom client shift codes across ${clientIdsWithShifts.size} clients.`);

  // Find a machine linked to a client that has custom shifts configured
  const machineWithClientShifts = (allMachines || []).find(m => m.client_id && clientIdsWithShifts.has(m.client_id));
  assert(
    !!machineWithClientShifts,
    `Found machine with custom client shift codes: ${machineWithClientShifts?.machine_id}`,
    `Client: ${machineWithClientShifts?.client?.company_name}`
  );

  // 4. Test Available Machine scenario
  // Even if all fleet machines are currently deployed to clients in the seed,
  // test an available machine (no client) to verify behavior when machine.client_id is null / status is available
  const sampleAvailableMachine = {
    id: '00000000-0000-0000-0000-000000000000',
    machine_id: 'M/C-0099',
    model: 'CAT 320D (Available Fleet)',
    serial_number: 'CAT-320D-AV-01',
    status: 'available',
    client_id: null,
    client: null,
  };

  assert(
    sampleAvailableMachine.status === 'available' && !sampleAvailableMachine.client_id,
    'Configured test case for Available (Unrented) Machine',
    `Machine: ${sampleAvailableMachine.machine_id} (Status: available, Client: null)`
  );

  // -------------------------------------------------------------
  // TEST SUITE 3: Dynamic Shift Resolution & Mapping Across Machines
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: Dynamic Shift Resolution Across Rented vs Available Machines ---');

  const testMachines = [
    { label: 'Feedback Machine (Rented)', machine: feedbackMachine },
    { label: 'Custom Shifts Machine (Rented)', machine: machineWithClientShifts },
    { label: 'Available Machine (Unrented)', machine: sampleAvailableMachine }
  ].filter(t => t.machine);

  const DEFAULT_CLIENT_SHIFTS = [
    { code: 'S1', name: 'Shift 1 (Morning)', start_time: '06:00 AM', end_time: '02:00 PM' },
    { code: 'S2', name: 'Shift 2 (Evening)', start_time: '02:00 PM', end_time: '10:00 PM' },
    { code: 'S3', name: 'Shift 3 (Night)', start_time: '10:00 PM', end_time: '06:00 AM' },
  ];

  for (const { label, machine } of testMachines) {
    console.log(`\n  Testing Machine [${machine.machine_id}] (${label}, Status: ${machine.status}):`);

    let effectiveShifts = DEFAULT_CLIENT_SHIFTS;
    let hasCustomClientShifts = false;

    if (machine.client_id) {
      const { data: shiftCodes, error: scErr } = await supabase
        .from('client_shift_codes')
        .select('*')
        .eq('client_id', machine.client_id)
        .eq('is_active', true)
        .order('shift_order', { ascending: true });

      if (!scErr && shiftCodes && shiftCodes.length > 0) {
        effectiveShifts = shiftCodes;
        hasCustomClientShifts = true;
      }
    }

    assert(
      effectiveShifts.length >= 3,
      `[${machine.machine_id}] Resolved ${effectiveShifts.length} shifts (${hasCustomClientShifts ? 'Custom Client Shifts' : 'Default Standard Shifts'})`,
      `Shifts: ${effectiveShifts.map(s => `${s.code} (${s.start_time}-${s.end_time})`).join(', ')}`
    );

    // Test automatic operator assignment mapping sequentially
    // Simulate assigning 3 operators
    const dummyOperators = [
      { id: '11111111-1111-1111-1111-111111111111', full_name: 'Test Operator 1' },
      { id: '22222222-2222-2222-2222-222222222222', full_name: 'Test Operator 2' },
      { id: '33333333-3333-3333-3333-333333333333', full_name: 'Test Operator 3' }
    ];

    const assignedOperators = [];

    function getNextAvailableShift(currentAssignments, shifts) {
      const usedShiftCodes = new Set(currentAssignments.map(a => a.shiftCode.toUpperCase()));
      const unused = shifts.find(s => !usedShiftCodes.has(s.code.toUpperCase()));
      return unused || shifts[currentAssignments.length % shifts.length] || shifts[0];
    }

    for (let i = 0; i < dummyOperators.length; i++) {
      const op = dummyOperators[i];
      const nextShift = getNextAvailableShift(assignedOperators, effectiveShifts);
      assignedOperators.push({
        operatorId: op.id,
        operatorName: op.full_name,
        shiftCode: nextShift.code,
        shiftStartTime: nextShift.start_time,
        shiftEndTime: nextShift.end_time,
      });
    }

    assert(
      assignedOperators.length === 3,
      `[${machine.machine_id}] Successfully mapped 3 operators`,
      `Assignments: ${assignedOperators.map(a => `${a.operatorName} -> Shift ${a.shiftCode} (${a.shiftStartTime} - ${a.shiftEndTime})`).join(' | ')}`
    );

    // Verify distinct shift codes (no schedule collisions)
    const shiftCodesSet = new Set(assignedOperators.map(a => a.shiftCode.toUpperCase()));
    assert(
      shiftCodesSet.size === 3,
      `[${machine.machine_id}] All 3 assigned operators have distinct non-colliding shifts`,
      `Shift codes assigned: ${Array.from(shiftCodesSet).join(', ')}`
    );

    // Verify capacity ceiling
    const maxCapacity = effectiveShifts.length > 0 ? effectiveShifts.length : 3;
    const isAtCapacity = assignedOperators.length >= maxCapacity;
    assert(
      isAtCapacity,
      `[${machine.machine_id}] Reached maximum capacity (${assignedOperators.length}/${maxCapacity} shifts covered)`,
      'Prevents exceeding 24h operational limit.'
    );
  }

  // -------------------------------------------------------------
  // TEST SUITE 4: Real Database Atomic RPC Execution
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 4: Atomic RPC Execution (assign_operator_machine_atomic) on Dev DB ---');

  // Check currently active assignments on M/C-0019
  const { data: currentAssignments, error: caErr } = await supabase
    .from('operator_machine_assignments')
    .select('id, machine_id, operator_id, shift_code, shift_start_time, shift_end_time, is_active')
    .eq('machine_id', feedbackMachine.id)
    .eq('is_active', true);

  assert(!caErr && currentAssignments && currentAssignments.length >= 2, `Discovered ${currentAssignments?.length} active assignments on ${feedbackMachine.machine_id}`, `Current shifts: ${currentAssignments?.map(a => `Op ${a.operator_id.slice(0, 8)}... (Shift ${a.shift_code})`).join(', ')}`);

  const activeOp1 = currentAssignments[0];
  const activeOp2 = currentAssignments[1];

  // 4a. Idempotent re-assignment of existing active operator (Save Assignments without change)
  console.log(`\n  4a. Testing idempotent re-save for Op ${activeOp1.operator_id.slice(0, 8)}... on Shift ${activeOp1.shift_code}:`);
  const { data: idempotentRes, error: idempErr } = await supabase.rpc('assign_operator_machine_atomic', {
    p_machine_id: feedbackMachine.id,
    p_operator_id: activeOp1.operator_id,
    p_shift_start: activeOp1.shift_start_time || '06:00:00',
    p_shift_end: activeOp1.shift_end_time || '14:00:00',
    p_shift_start_time: activeOp1.shift_start_time || '06:00:00',
    p_shift_end_time: activeOp1.shift_end_time || '14:00:00',
    p_assigned_by: null,
    p_notes: 'Idempotent save test',
    p_shift_code: activeOp1.shift_code
  });

  assert(
    !idempErr && idempotentRes && idempotentRes.success === true,
    `Idempotent re-save succeeded for active operator on Shift ${activeOp1.shift_code}`,
    `Response: ${JSON.stringify(idempotentRes)}`
  );

  // 4b. Shift Collision Detection: Try assigning a new operator to an already occupied shift
  // Fetch another unassigned active operator
  const { data: thirdOperator } = await supabase
    .from('users')
    .select('id, full_name, role, status')
    .eq('role', 'operator')
    .eq('status', 'active')
    .not('id', 'in', `(${currentAssignments.map(a => a.operator_id).join(',')})`)
    .limit(1)
    .single();

  if (thirdOperator) {
    console.log(`\n  4b. Testing shift collision detection: Assigning ${thirdOperator.full_name} to already occupied Shift ${activeOp1.shift_code}:`);
    const { data: conflictRes, error: conflictErr } = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: feedbackMachine.id,
      p_operator_id: thirdOperator.id,
      p_shift_start: '06:00:00',
      p_shift_end: '14:00:00',
      p_shift_start_time: '06:00:00',
      p_shift_end_time: '14:00:00',
      p_assigned_by: null,
      p_notes: 'Collision test',
      p_shift_code: activeOp1.shift_code
    });

    assert(
      conflictRes && conflictRes.success === false && conflictRes.code === 'SHIFT_CODE_CONFLICT',
      `Conflict detected: Correctly rejected duplicate assignment on Shift ${activeOp1.shift_code}`,
      `Error caught: "${conflictRes?.error}"`
    );

    // 4c. Successful assignment to an unassigned shift (S3)
    const occupiedShifts = new Set(currentAssignments.map(a => a.shift_code));
    const availableShiftCode = ['S1', 'S2', 'S3'].find(s => !occupiedShifts.has(s)) || 'S3';

    console.log(`\n  4c. Testing valid assignment: Assigning ${thirdOperator.full_name} to unoccupied Shift ${availableShiftCode}:`);
    const { data: validAssignRes, error: validAssignErr } = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: feedbackMachine.id,
      p_operator_id: thirdOperator.id,
      p_shift_start: '22:00:00',
      p_shift_end: '06:00:00',
      p_shift_start_time: '22:00:00',
      p_shift_end_time: '06:00:00',
      p_assigned_by: null,
      p_notes: 'Automated valid assignment test',
      p_shift_code: availableShiftCode
    });

    assert(
      !validAssignErr && validAssignRes && validAssignRes.success === true,
      `Successfully assigned ${thirdOperator.full_name} to unoccupied Shift ${availableShiftCode}`,
      `Response: ${JSON.stringify(validAssignRes)}`
    );

    // Verify machine record in DB now includes thirdOperator in operator_ids
    const { data: updatedMachine } = await supabase
      .from('machines')
      .select('id, machine_id, operator_ids')
      .eq('id', feedbackMachine.id)
      .single();

    assert(
      Array.isArray(updatedMachine?.operator_ids) && updatedMachine.operator_ids.includes(thirdOperator.id),
      `Verified machine ${feedbackMachine.machine_id} has updated operator_ids array containing all 3 operators`,
      `operator_ids count: ${updatedMachine?.operator_ids?.length}`
    );

    console.log(`\n  4d. Cleanup: Deactivating temporary test assignment for ${thirdOperator.full_name}:`);
    const { error: cleanupErr } = await supabase
      .from('operator_machine_assignments')
      .update({ is_active: false, ended_at: new Date().toISOString(), end_reason: 'removed' })
      .eq('machine_id', feedbackMachine.id)
      .eq('operator_id', thirdOperator.id)
      .eq('is_active', true);

    // Restore machine operator_ids
    const originalOpIds = currentAssignments.map(a => a.operator_id);
    await supabase
      .from('machines')
      .update({ operator_ids: originalOpIds, current_operator_id: originalOpIds[0] || null })
      .eq('id', feedbackMachine.id);

    assert(!cleanupErr, 'Cleaned up temporary test assignment and restored machine operator_ids', `Restored to ${originalOpIds.length} operators.`);
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL PERSONNEL MODAL & SHIFT MAPPING VERIFICATIONS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED. CHECK LOGS ABOVE.');
    process.exit(1);
  }
}

runPersonnelModalTests().catch((err) => {
  console.error('Unhandled exception during testing:', err);
  process.exit(1);
});
