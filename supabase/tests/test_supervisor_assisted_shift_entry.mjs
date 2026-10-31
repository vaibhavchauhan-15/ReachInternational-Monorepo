import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 1. Load env
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

async function runTests() {
  console.log('--- RUNNING INTEGRATION TESTS FOR SUPERVISOR ASSISTED SHIFT ENTRY ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Test 1: Fetch a supervisor from dev database
  const { data: supervisors, error: supErr } = await client
    .from('users')
    .select('id, full_name, email, role')
    .eq('role', 'supervisor')
    .limit(5);

  assert(!supErr && supervisors && supervisors.length > 0, `Found ${supervisors?.length || 0} supervisors in database`);

  if (!supervisors || supervisors.length === 0) {
    console.log('No supervisors found to test dynamic relationships.');
    return;
  }

  const supervisor = supervisors[0];
  console.log(`Testing with supervisor: ${supervisor.full_name} (${supervisor.id})`);

  // Test 2: Check operators under this supervisor via client_supervisors or users
  const { data: clientSupervisors } = await client
    .from('client_supervisors')
    .select('client_id')
    .eq('supervisor_id', supervisor.id);

  const clientIds = (clientSupervisors || []).map(cs => cs.client_id);
  console.log(`Supervisor is assigned to ${clientIds.length} clients`);

  // Find operators assigned to these machines / clients
  let assignedOperatorId = null;
  if (clientIds.length > 0) {
    const { data: machines } = await client
      .from('machines')
      .select('id, client_id, operator_machine_assignments(operator_id, is_active)')
      .in('client_id', clientIds);

    for (const m of (machines || [])) {
      const activeAssignments = (m.operator_machine_assignments || []).filter(a => a.is_active);
      if (activeAssignments.length > 0) {
        assignedOperatorId = activeAssignments[0].operator_id;
        break;
      }
    }
  }

  // If none found via client, check users.supervisor_id
  if (!assignedOperatorId) {
    const { data: directOp } = await client
      .from('users')
      .select('id')
      .eq('role', 'operator')
      .eq('supervisor_id', supervisor.id)
      .limit(1)
      .maybeSingle();

    if (directOp) {
      assignedOperatorId = directOp.id;
    }
  }

  // Find an unassigned operator (one NOT under this supervisor)
  const { data: allOperators } = await client
    .from('users')
    .select('id, full_name, supervisor_id')
    .eq('role', 'operator')
    .limit(20);

  console.log(`Operators found: ${(allOperators || []).length}`);
  const unassignedOperator = (allOperators || []).find(op => op.id !== assignedOperatorId);
  console.log('Unassigned operator chosen:', unassignedOperator?.full_name);

  // Test 3: Test direct query logic matching supervisor-operators.ts
  const isOperatorUnderSupervisorQuery = async (supId, opId) => {
    // 1. Direct assignment
    const { data: userRecord } = await client
      .from('users')
      .select('supervisor_id, supervisor_ids')
      .eq('id', opId)
      .single();

    if (
      userRecord?.supervisor_id === supId ||
      (Array.isArray(userRecord?.supervisor_ids) && userRecord.supervisor_ids.includes(supId))
    ) {
      return true;
    }

    // 2. Junction table
    const { count: junctionCount } = await client
      .from('user_supervisors')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', opId)
      .eq('supervisor_id', supId);

    if (junctionCount && junctionCount > 0) return true;

    // 3. Client supervisor
    const { data: opAssignments } = await client
      .from('operator_machine_assignments')
      .select('machine_id, machines!inner(client_id)')
      .eq('operator_id', opId)
      .eq('is_active', true);

    const clientIds = (opAssignments || [])
      .map(a => a.machines?.client_id)
      .filter(Boolean);

    if (clientIds.length > 0) {
      const { count: csCount } = await client
        .from('client_supervisors')
        .select('id', { count: 'exact', head: true })
        .eq('supervisor_id', supId)
        .in('client_id', clientIds);

      if (csCount && csCount > 0) return true;
    }

    // 4. Machine supervisor
    const machineIds = (opAssignments || [])
      .map(a => a.machine_id)
      .filter(Boolean);

    if (machineIds.length > 0) {
      const { data: machineRecords } = await client
        .from('machines')
        .select('current_supervisor_id, supervisor_ids')
        .in('id', machineIds);

      const isMachineSup = (machineRecords || []).some(m =>
        m.current_supervisor_id === supId ||
        (Array.isArray(m.supervisor_ids) && m.supervisor_ids.includes(supId))
      );
      if (isMachineSup) return true;
    }

    return false;
  };

  if (assignedOperatorId) {
    const isUnder = await isOperatorUnderSupervisorQuery(supervisor.id, assignedOperatorId);
    assert(isUnder === true, `Assigned operator (${assignedOperatorId}) is recognized as under supervisor`);
  } else {
    console.log('  ℹ No assigned operator currently configured for supervisor in dev DB; skipping positive assignment test');
  }

  const randomUnsupervisedOpId = '00000000-0000-0000-0000-000000000099';
  const isRandomUnder = await isOperatorUnderSupervisorQuery(supervisor.id, randomUnsupervisedOpId);
  assert(isRandomUnder === false, 'Non-existent / unsupervised operator is NOT recognized as under supervisor');

  // Test 4: Verify permissions matrix
  const { isSupervisorOrAbove } = await import('../../packages/permissions/src/roles.ts');
  assert(isSupervisorOrAbove('supervisor') === true, 'isSupervisorOrAbove permits supervisor');
  assert(isSupervisorOrAbove('manager') === true, 'isSupervisorOrAbove permits manager');
  assert(isSupervisorOrAbove('admin') === true, 'isSupervisorOrAbove permits admin');
  assert(isSupervisorOrAbove('super_admin') === true, 'isSupervisorOrAbove permits super_admin');
  assert(isSupervisorOrAbove('operator') === false, 'isSupervisorOrAbove rejects operator');
  assert(isSupervisorOrAbove(null) === false, 'isSupervisorOrAbove handles null safely');

  // Test 5: Verify submit_operator_hour_log_atomic allows supervisor for supervised operator
  const { data: testMachine } = await client.from('machines').select('id, machine_id, hour_meter').limit(1).single();
  if (testMachine && assignedOperatorId) {
    const testMeter = Math.max(Number(testMachine.hour_meter) || 0, 500) + 1;
    const testDate = '2026-05-15';
    await client.from('machine_hour_logs').delete().eq('machine_id', testMachine.id).eq('log_date', testDate);
    const { data: rpcRes, error: rpcErr } = await client.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: testMachine.id,
      p_operator_id: assignedOperatorId,
      p_entered_by: supervisor.id,
      p_log_date: testDate,
      p_start_datetime: `${testDate}T06:00:00+05:30`,
      p_end_datetime: `${testDate}T14:00:00+05:30`,
      p_start_meter: testMeter,
      p_end_meter: testMeter + 4,
      p_start_time: '06:00:00',
      p_end_time: '14:00:00',
      p_shift_code: 'S1',
      p_idempotency_key: 'test_sup_verify_' + Date.now(),
    });

    assert(!rpcErr && rpcRes && rpcRes.success === true, `submit_operator_hour_log_atomic permits supervisor assisted entry: ${rpcErr?.message || 'Success'}`);
    assert(rpcRes?.entry_source === 'supervisor', `submit_operator_hour_log_atomic sets entry_source: 'supervisor' (actual: ${rpcRes?.entry_source})`);

    if (rpcRes?.log_id) {
      await client.from('machine_hour_logs').delete().eq('id', rpcRes.log_id);
    }
  }

  // Test 6: Verify submit_operator_hour_log_atomic rejects supervisor for completely unassociated operator/machine
  const dummyOpId = '00000000-0000-0000-0000-000000000099';
  const dummyMachineId = '00000000-0000-0000-0000-000000000088';
  const { error: unauthErr } = await client.rpc('submit_operator_hour_log_atomic', {
    p_machine_id: dummyMachineId,
    p_operator_id: dummyOpId,
    p_entered_by: supervisor.id,
    p_start_meter: 10,
    p_end_meter: 15,
  });
  assert(unauthErr && (unauthErr.code === '42501' || unauthErr.message?.includes('Supervisors can only fill shift entries')), `submit_operator_hour_log_atomic rejects unassociated operator with code 42501`);

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
