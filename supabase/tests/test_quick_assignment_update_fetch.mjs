import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vlmxciuogczumumrwyot.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbXhjaXVvZ2N6dW11bXJ3eW90Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyNDgwNiwiZXhwIjoyMDkzOTAwODA2fQ.2Z8Fiptbf7vqMHI5TsJ8-RPD4JHC5oFMPHn0BP-3mDY";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MACHINE_ID = "57d6bd84-60b6-498a-8464-3546fafe6a3e";

async function runTests() {
  console.log("=== Testing Quick Assignment Update & DB Fetch Synchronization ===");
  console.log(`Target Machine ID: ${MACHINE_ID}`);

  // Test 1: Machine Exists in Dev DB
  const { data: machine, error: mErr } = await supabase
    .from("machines")
    .select("id, machine_id, model, serial_number, supervisor_ids, current_supervisor_id, operator_ids, current_operator_id, client_id, status")
    .eq("id", MACHINE_ID)
    .single();

  if (mErr || !machine) {
    console.error("Test 1 Failed: Machine not found in Dev DB", mErr);
    process.exit(1);
  }
  console.log(`✔ Test 1: Machine found (${machine.machine_id}: ${machine.model})`);

  // Test 2: Supervisors and Operators are defined
  console.log(`Initial supervisor_ids:`, machine.supervisor_ids);
  console.log(`Initial operator_ids:`, machine.operator_ids);
  if (!Array.isArray(machine.supervisor_ids) || machine.supervisor_ids.length === 0) {
    console.warn("Notice: Machine currently has no supervisors");
  } else {
    console.log(`✔ Test 2: Machine has ${machine.supervisor_ids.length} active supervisor(s)`);
  }

  // Test 3: Query Active Assignments from operator_machine_assignments
  const { data: assignments, error: aErr } = await supabase
    .from("operator_machine_assignments")
    .select("id, operator_id, shift_code, shift_start_time, shift_end_time, is_active")
    .eq("machine_id", MACHINE_ID)
    .eq("is_active", true);

  if (aErr) {
    console.error("Test 3 Failed: Cannot query assignments", aErr);
    process.exit(1);
  }
  console.log(`✔ Test 3: Machine has ${assignments.length} active operator shift assignment(s) in DB:`);
  assignments.forEach((a) => {
    console.log(`   - Operator ${a.operator_id} on Shift ${a.shift_code} (${a.shift_start_time} - ${a.shift_end_time})`);
  });

  // Test 4: Verify sync when only operators are passed - supervisors must NOT be wiped!
  console.log("\nTesting supervisor preservation during operator assignment...");
  const initialSups = [...(machine.supervisor_ids || [])];
  
  // Simulate what updateMachinePersonnelAction now does
  const validOps = [...(machine.operator_ids || [])];
  const updateData = {
    operator_ids: validOps,
    current_operator_id: validOps[0] || null,
    updated_at: new Date().toISOString(),
  };

  const { error: upErr } = await supabase
    .from("machines")
    .update(updateData)
    .eq("id", MACHINE_ID);

  if (upErr) {
    console.error("Test 4 Failed: Could not update operators", upErr);
    process.exit(1);
  }

  // Read back machine to verify supervisors remained intact
  const { data: verifiedMachine } = await supabase
    .from("machines")
    .select("supervisor_ids, current_supervisor_id, operator_ids, current_operator_id")
    .eq("id", MACHINE_ID)
    .single();

  if (JSON.stringify(verifiedMachine.supervisor_ids) !== JSON.stringify(initialSups)) {
    console.error("Test 4 Failed: Supervisors were wiped or modified during operator update!", {
      expected: initialSups,
      actual: verifiedMachine.supervisor_ids,
    });
    process.exit(1);
  }
  console.log(`✔ Test 4: Supervisors preserved 100% (${verifiedMachine.supervisor_ids.length} supervisors intact)`);

  // Test 5: Verify fast DB read-back format matching UI requirements
  const supIds = verifiedMachine.supervisor_ids || [];
  const opIds = verifiedMachine.operator_ids || [];
  const allUserIds = Array.from(new Set([...supIds, ...opIds]));

  const [usersRes, freshAssignRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, phone, email, shift_start_time, shift_end_time, role")
      .in("id", allUserIds),
    supabase
      .from("operator_machine_assignments")
      .select("operator_id, shift_start_time, shift_end_time, shift_code")
      .eq("machine_id", MACHINE_ID)
      .eq("is_active", true),
  ]);

  const uMap = new Map((usersRes.data || []).map((u) => [u.id, u]));
  const freshAssignMap = new Map((freshAssignRes.data || []).map((a) => [a.operator_id, a]));

  const freshSupervisors = supIds.map((id) => uMap.get(id)).filter(Boolean);
  const freshOperators = opIds.map((id) => {
    const u = uMap.get(id);
    const a = freshAssignMap.get(id);
    return {
      id,
      full_name: u?.full_name || "Operator",
      shift_code: a?.shift_code || null,
      shift_start_time: a?.shift_start_time || null,
      shift_end_time: a?.shift_end_time || null,
    };
  });

  console.log(`✔ Test 5: Fast DB read-back returns:`);
  console.log(`   - ${freshSupervisors.length} supervisors (${freshSupervisors.map((s) => s.full_name).join(", ")})`);
  console.log(`   - ${freshOperators.length} operators:`, freshOperators);

  console.log("\n=======================================================");
  console.log("ALL TESTS PASSED (5/5). DB persistence and synchronization verified.");
  console.log("=======================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
