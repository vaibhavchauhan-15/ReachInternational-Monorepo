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

loadEnv(path.resolve(__dirname, '../../apps/web/.env'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vlmxciuogczumumrwyot.supabase.co';
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runDetailedSimulation() {
  console.log('--- DETAILED SIMULATION OF USER BUGS ---');

  const { data: adminUser } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('role', 'admin')
    .limit(1)
    .single();

  // Find machines that are active or rented
  const { data: machines } = await supabase
    .from('machines')
    .select('id, machine_id, model, client_id, status')
    .in('status', ['active', 'rented', 'available']);

  const { data: activeAssignments } = await supabase
    .from('operator_machine_assignments')
    .select('id, operator_id, machine_id, shift_code, shift_start_time, shift_end_time, is_active')
    .eq('is_active', true);

  const machineAssignmentCounts = {};
  for (const m of machines) {
    machineAssignmentCounts[m.id] = (activeAssignments || []).filter(a => a.machine_id === m.id);
  }

  // Find a machine with least assignments or 0
  machines.sort((a, b) => (machineAssignmentCounts[a.id]?.length || 0) - (machineAssignmentCounts[b.id]?.length || 0));
  const testMachine = machines[0];

  console.log(`Using Machine: ${testMachine.machine_id} (Current assignments: ${(machineAssignmentCounts[testMachine.id] || []).length})`);

  // Find unassigned operator to act as User B
  const { data: allOps } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('role', 'operator')
    .eq('status', 'active');

  const assignedOpIds = new Set((activeAssignments || []).map(a => a.operator_id));
  const unassignedOps = allOps.filter(o => !assignedOpIds.has(o.id));

  console.log(`Unassigned Operators count: ${unassignedOps.length}`);
  const userB = unassignedOps[0];
  const userA = unassignedOps[1] || allOps[0];

  console.log(`Selected User B: ${userB.full_name} (${userB.id})`);
  console.log(`Selected User A: ${userA.full_name} (${userA.id})`);

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  console.log(`Dates: Yesterday = ${yesterday}, Today = ${today}`);

  // Check yesterday monitor before assigning User B
  const { data: beforeRows } = await supabase.rpc('get_today_shift_log_monitor', {
    p_actor_id: adminUser.id,
    p_log_date: yesterday
  });

  const bInYesterdayBefore = beforeRows?.some(r => r.operator_id === userB.id);
  console.log(`Before assignment today: Is User B in yesterday monitor (${yesterday})?`, bInYesterdayBefore ? 'YES' : 'NO');

  // Assign User B TODAY to testMachine on Shift C (22:00 to 06:00 to avoid overlap if any)
  console.log(`\nAssigning User B (${userB.full_name}) TODAY on Shift C...`);
  const { data: assignBRes, error: aErr } = await supabase.rpc('assign_operator_machine_atomic', {
    p_machine_id: testMachine.id,
    p_operator_id: userB.id,
    p_assigned_by: adminUser.id,
    p_shift_code: 'C',
    p_shift_start_time: '22:00:00',
    p_shift_end_time: '06:00:00'
  });

  if (aErr || !assignBRes?.success) {
    console.error('Assignment error:', aErr || assignBRes?.error);
    return;
  }
  console.log('User B assigned successfully. Assignment ID:', assignBRes.assignment_id);

  try {
    // Check yesterday monitor AFTER assigning User B today:
    const { data: afterRows } = await supabase.rpc('get_today_shift_log_monitor', {
      p_actor_id: adminUser.id,
      p_log_date: yesterday
    });

    const userBInYesterday = afterRows?.find(r => r.operator_id === userB.id);
    console.log(`\n================================================================`);
    console.log(`>>> BUG 2 VERIFICATION RESULT:`);
    if (userBInYesterday) {
      console.log(`❌ BUG 2 CONFIRMED! User B shows in YESTERDAY'S (${yesterday}) monitor:`);
      console.log(`   Operator: ${userBInYesterday.operator_name}`);
      console.log(`   Machine: ${userBInYesterday.machine_code}`);
      console.log(`   Shift: ${userBInYesterday.shift_code}`);
      console.log(`   Status: ${userBInYesterday.status.toUpperCase()}!`);
      console.log(`   (Why: RPC only filters 'WHERE oma.is_active = true', so today's active assignment leaks into past days and shows PENDING!)`);
    } else {
      console.log(`User B does NOT show in yesterday monitor.`);
    }
    console.log(`================================================================\n`);

    // Clean up User B assignment
    await supabase.rpc('end_operator_machine_assignment_atomic', {
      p_assignment_id: assignBRes.assignment_id,
      p_ended_by: adminUser.id,
      p_end_reason: 'removed'
    });

    // NOW TEST BUG 1: Operator reassigned from Shift A to Shift B
    console.log('\n--- TESTING BUG 1: User A reassigned from Shift A to Shift B ---');

    // Step 1: Assign User A to Shift A
    const { data: assignA1, error: a1Err } = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: testMachine.id,
      p_operator_id: userA.id,
      p_assigned_by: adminUser.id,
      p_shift_code: 'A',
      p_shift_start_time: '06:00:00',
      p_shift_end_time: '14:00:00'
    });
    if (!assignA1?.success) {
      console.error('Assign A1 error:', assignA1?.error || a1Err);
      return;
    }
    console.log(`Assigned User A to Shift A. ID: ${assignA1.assignment_id}`);

    // End assignment A (simulating ending yesterday's shift)
    await supabase.rpc('end_operator_machine_assignment_atomic', {
      p_assignment_id: assignA1.assignment_id,
      p_ended_by: adminUser.id,
      p_end_reason: 'shift_changed'
    });
    console.log(`Ended User A Shift A assignment (simulating shift change).`);

    // Assign User A to Shift B (simulating today's new shift)
    const { data: assignA2, error: a2Err } = await supabase.rpc('assign_operator_machine_atomic', {
      p_machine_id: testMachine.id,
      p_operator_id: userA.id,
      p_assigned_by: adminUser.id,
      p_shift_code: 'B',
      p_shift_start_time: '14:00:00',
      p_shift_end_time: '22:00:00'
    });
    if (!assignA2?.success) {
      console.error('Assign A2 error:', assignA2?.error || a2Err);
      return;
    }
    console.log(`Assigned User A to Shift B. ID: ${assignA2.assignment_id}`);

    // Query yesterday monitor for User A
    const { data: yesterdayMonitorA } = await supabase.rpc('get_today_shift_log_monitor', {
      p_actor_id: adminUser.id,
      p_log_date: yesterday
    });

    const opAInYesterday = yesterdayMonitorA?.find(r => r.operator_id === userA.id);
    console.log(`\n================================================================`);
    console.log(`>>> BUG 1 VERIFICATION RESULT:`);
    if (opAInYesterday) {
      console.log(`❌ BUG 1 CONFIRMED! Yesterday monitor shows User A on:`);
      console.log(`   Shift: ${opAInYesterday.shift_code} (User was on Shift A yesterday, but monitor shows Shift ${opAInYesterday.shift_code}!)`);
      console.log(`   Status: ${opAInYesterday.status.toUpperCase()}`);
    } else {
      console.log(`User A not found in yesterday monitor.`);
    }

    // Now check if User A can enter yesterday's log for Shift A:
    console.log(`\nAttempting submit_operator_hour_log_atomic for Yesterday on Shift A...`);
    const { data: submitRes, error: submitErr } = await supabase.rpc('submit_operator_hour_log_atomic', {
      p_operator_id: userA.id,
      p_machine_id: testMachine.id,
      p_log_date: yesterday,
      p_shift_code: 'A',
      p_shift: 'Shift A',
      p_start_time: '06:00:00',
      p_end_time: '14:00:00',
      p_start_meter: 100,
      p_end_meter: 108,
      p_entered_by: userA.id
    });

    if (submitErr) {
      console.log(`❌ SUBMISSION BLOCKED! Error: ${submitErr.message} (Code: ${submitErr.code})`);
      console.log(`   (Why: submit_operator_hour_log_atomic validates against 'WHERE oma.is_active = true', which is Shift B, so it rejects yesterday's Shift A!)`);
    } else {
      console.log(`Submission succeeded?`, submitRes);
    }
    console.log(`================================================================\n`);

    // Cleanup: end assignment A2
    if (assignA2?.assignment_id) {
      await supabase.rpc('end_operator_machine_assignment_atomic', {
        p_assignment_id: assignA2.assignment_id,
        p_ended_by: adminUser.id,
        p_end_reason: 'removed'
      });
      console.log('Cleaned up test assignment A2.');
    }

  } catch (err) {
    console.error('Error during test:', err);
  }

  // Restore machine operator_ids and current_operator_id
  await supabase
    .from('machines')
    .update({ operator_ids: [], current_operator_id: null })
    .eq('id', testMachine.id);

  console.log('Restored machine state. Done.');
}

runDetailedSimulation().catch(console.error);
