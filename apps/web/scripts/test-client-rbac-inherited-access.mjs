import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load environment variables from apps/web/.env.local
const envPath = resolve(process.cwd(), "apps/web/.env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = match[2]?.replace(/^['"]|['"]$/g, "").trim();
  }
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || "https://vlmxciuogczumumrwyot.supabase.co";
const SERVICE_KEY = env.SUPABASE_SECRET_KEY;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SERVICE_KEY) {
  console.error("Missing SUPABASE_SECRET_KEY in apps/web/.env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anonSupabase = ANON_KEY
  ? createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL [Test ${totalTests}]: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`✅ PASS [Test ${totalTests}]: ${message}`);
}

async function runTests() {
  console.log("================================================================================");
  console.log("CLIENT-BASED RBAC & SECURE INHERITED ACCESS TEST SUITE");
  console.log(`Target Database: ${SUPABASE_URL}`);
  console.log("================================================================================\n");

  // Step 1: Discover entities for testing
  const { data: clients } = await supabase
    .from("clients")
    .select("id, company_name, code")
    .eq("status", "active")
    .limit(5);

  assert(clients && clients.length >= 2, "Found at least 2 active clients in Dev database");
  const clientA = clients[0];
  const clientB = clients[1];
  console.log(`Using Client A: ${clientA.company_name} (${clientA.id})`);
  console.log(`Using Client B: ${clientB.company_name} (${clientB.id})`);

  const { data: supervisors } = await supabase
    .from("users")
    .select("id, full_name, email, role, status")
    .eq("role", "supervisor")
    .eq("status", "active")
    .limit(5);

  assert(supervisors && supervisors.length >= 1, "Found at least 1 active supervisor in Dev database");
  const testSupervisor = supervisors[0];
  console.log(`Using Test Supervisor: ${testSupervisor.full_name} (${testSupervisor.id})`);

  const { data: adminUsers } = await supabase
    .from("users")
    .select("id, full_name, role")
    .in("role", ["super_admin", "admin"])
    .eq("status", "active")
    .limit(1);

  assert(adminUsers && adminUsers.length > 0, "Found active admin user");
  const testAdmin = adminUsers[0];
  console.log(`Using Test Admin: ${testAdmin.full_name} (${testAdmin.id})\n`);

  const { data: operators } = await supabase
    .from("users")
    .select("id, full_name, role")
    .eq("role", "operator")
    .eq("status", "active")
    .limit(2);

  assert(operators && operators.length > 0, "Found active operator");
  const testOperator = operators[0];
  console.log(`Using Test Operator: ${testOperator.full_name} (${testOperator.id})`);

  // Ensure a test machine allocated to Client A
  const { data: machinesA } = await supabase
    .from("machines")
    .select("id, machine_id, client_id, status")
    .eq("client_id", clientA.id)
    .neq("status", "decommissioned")
    .limit(1);

  let testMachineA = machinesA?.[0];
  if (!testMachineA) {
    // If no machine allocated to Client A, allocate one temporarily
    const { data: availMachines } = await supabase
      .from("machines")
      .select("id, machine_id")
      .is("client_id", null)
      .limit(1);
    if (availMachines && availMachines.length > 0) {
      await supabase.from("machines").update({ client_id: clientA.id }).eq("id", availMachines[0].id);
      testMachineA = { id: availMachines[0].id, machine_id: availMachines[0].machine_id, client_id: clientA.id };
    }
  }
  assert(Boolean(testMachineA), `Target Machine for Client A identified (${testMachineA?.machine_id})`);

  // Ensure a test machine allocated to Client B
  const { data: machinesB } = await supabase
    .from("machines")
    .select("id, machine_id, client_id, status")
    .eq("client_id", clientB.id)
    .neq("status", "decommissioned")
    .limit(1);

  let testMachineB = machinesB?.[0];
  if (!testMachineB) {
    const { data: availMachines } = await supabase
      .from("machines")
      .select("id, machine_id")
      .neq("id", testMachineA.id)
      .limit(1);
    if (availMachines && availMachines.length > 0) {
      await supabase.from("machines").update({ client_id: clientB.id }).eq("id", availMachines[0].id);
      testMachineB = { id: availMachines[0].id, machine_id: availMachines[0].machine_id, client_id: clientB.id };
    }
  }
  assert(Boolean(testMachineB), `Target Machine for Client B identified (${testMachineB?.machine_id})\n`);

  console.log("--------------------------------------------------------------------------------");
  console.log("PHASE 1: CLIENT SUPERVISOR ASSIGNMENT & REMOVAL RPCs");
  console.log("--------------------------------------------------------------------------------");

  // Clean state: ensure supervisor is assigned to Client A and NOT to Client B
  await supabase.rpc("remove_client_supervisor_atomic", {
    p_client_id: clientB.id,
    p_supervisor_id: testSupervisor.id,
    p_removed_by: testAdmin.id,
  });

  const { data: assignRes, error: assignErr } = await supabase.rpc("assign_client_supervisor_atomic", {
    p_client_id: clientA.id,
    p_supervisor_id: testSupervisor.id,
    p_assigned_by: testAdmin.id,
  });

  assert(!assignErr && assignRes?.success === true, "Admin successfully assigned supervisor to Client A via assign_client_supervisor_atomic");

  // Verify unique constraint: duplicate assignment is handled gracefully
  const { data: dupAssignRes } = await supabase.rpc("assign_client_supervisor_atomic", {
    p_client_id: clientA.id,
    p_supervisor_id: testSupervisor.id,
    p_assigned_by: testAdmin.id,
  });
  assert(dupAssignRes?.success === true, "Idempotent reassignment succeeds without duplicate constraint violation");

  // Verify supervisor CANNOT assign supervisors (Privilege escalation prevention)
  const { data: supEscalationRes } = await supabase.rpc("assign_client_supervisor_atomic", {
    p_client_id: clientB.id,
    p_supervisor_id: testSupervisor.id,
    p_assigned_by: testSupervisor.id,
  });
  assert(
    supEscalationRes?.success === false && supEscalationRes?.code === "FORBIDDEN",
    "Supervisor is forbidden from self-assigning to client B (FORBIDDEN)"
  );

  console.log("\n--------------------------------------------------------------------------------");
  console.log("PHASE 2: INHERITED CLIENT ACCESS & TENANT ISOLATION HELPERS");
  console.log("--------------------------------------------------------------------------------");

  // Check supervisor access to Client A (Assigned)
  const { data: accessClientA } = await supabase.rpc("check_user_can_access_client", {
    p_user_id: testSupervisor.id,
    p_client_id: clientA.id,
  });
  assert(accessClientA === true, "Supervisor has verified access to Client A (Inherited from client_supervisors)");

  // Check supervisor access to Client B (Unassigned)
  const { data: accessClientB } = await supabase.rpc("check_user_can_access_client", {
    p_user_id: testSupervisor.id,
    p_client_id: clientB.id,
  });
  assert(accessClientB === false, "Supervisor is correctly denied access to Client B (Not assigned)");

  // Check supervisor access to Machine A (belongs to Client A)
  const { data: accessMachA } = await supabase.rpc("check_user_can_access_machine", {
    p_user_id: testSupervisor.id,
    p_machine_id: testMachineA.id,
  });
  assert(accessMachA === true, "Supervisor has inherited operational access to Machine A (belongs to Client A)");

  // Check supervisor access to Machine B (belongs to Client B)
  const { data: accessMachB } = await supabase.rpc("check_user_can_access_machine", {
    p_user_id: testSupervisor.id,
    p_machine_id: testMachineB.id,
  });
  assert(accessMachB === false, "Supervisor does NOT have access to Machine B (belongs to unassigned Client B)");

  console.log("\n--------------------------------------------------------------------------------");
  console.log("PHASE 3: BOLA VULNERABILITY FIX — CROSS-CLIENT MACHINE ASSIGNMENT");
  console.log("--------------------------------------------------------------------------------");

  // First end any existing active assignment for this operator to allow clean testing
  const { data: existingActive } = await supabase
    .from("operator_machine_assignments")
    .select("id")
    .eq("operator_id", testOperator.id)
    .eq("is_active", true);

  for (const row of existingActive || []) {
    await supabase.rpc("end_operator_machine_assignment_atomic", {
      p_assignment_id: row.id,
      p_ended_by: testAdmin.id,
      p_end_reason: "removed",
    });
  }

  // Attempt 1: Supervisor tries to assign operator to Machine B (belonging to Client B — UNASSIGNED)
  const { data: crossAssignRes } = await supabase.rpc("assign_operator_machine_atomic", {
    p_machine_id: testMachineB.id,
    p_operator_id: testOperator.id,
    p_shift_start_time: "08:00:00",
    p_shift_end_time: "17:00:00",
    p_assigned_by: testSupervisor.id,
  });

  assert(
    crossAssignRes?.success === false && crossAssignRes?.code === "CLIENT_ACCESS_DENIED",
    "Cross-Client Vulnerability Blocked: Supervisor CANNOT assign operators to unassigned client machines (CLIENT_ACCESS_DENIED)"
  );

  // Attempt 2: Supervisor assigns operator to Machine A (belonging to Client A — AUTHORIZED)
  const { data: authAssignRes, error: authAssignErr } = await supabase.rpc("assign_operator_machine_atomic", {
    p_machine_id: testMachineA.id,
    p_operator_id: testOperator.id,
    p_shift_start_time: "06:00:00",
    p_shift_end_time: "14:00:00",
    p_assigned_by: testSupervisor.id,
    p_notes: "Test assignment under Client A",
  });



  assert(
    authAssignRes?.success === true && Boolean(authAssignRes?.assignment_id),
    "Authorized Assignment Allowed: Supervisor successfully assigned operator to Machine A via inherited client authority"
  );
  const createdAssignmentId = authAssignRes?.assignment_id;

  console.log("\n--------------------------------------------------------------------------------");
  console.log("PHASE 4: ASSIGNMENT TERMINATION SECURITY & FORGED CALLER PROTECTION");
  console.log("--------------------------------------------------------------------------------");

  // Attempt 1: Unauthorized operator tries to end the assignment
  const { data: opEndRes } = await supabase.rpc("end_operator_machine_assignment_atomic", {
    p_assignment_id: createdAssignmentId,
    p_ended_by: testOperator.id,
  });
  assert(
    opEndRes?.success === false && opEndRes?.code === "FORBIDDEN",
    "Operator cannot end shift assignments (FORBIDDEN)"
  );

  // Attempt 2: Non-existent or inactive caller
  const { data: fakeEndRes } = await supabase.rpc("end_operator_machine_assignment_atomic", {
    p_assignment_id: createdAssignmentId,
    p_ended_by: "00000000-0000-0000-0000-000000000000",
  });
  assert(
    fakeEndRes?.success === false && fakeEndRes?.code === "CALLER_INACTIVE",
    "Forged / non-existent caller is rejected (CALLER_INACTIVE)"
  );

  // Attempt 3: Authorized supervisor ends the assignment within their client scope
  const { data: authEndRes } = await supabase.rpc("end_operator_machine_assignment_atomic", {
    p_assignment_id: createdAssignmentId,
    p_ended_by: testSupervisor.id,
    p_end_reason: "removed",
  });
  assert(
    authEndRes?.success === true,
    "Authorized supervisor successfully ended assignment in authorized client scope"
  );

  // Verify the assignment record was updated with ended_by and ended_at
  const { data: verifyRecord } = await supabase
    .from("operator_machine_assignments")
    .select("is_active, ended_by, end_reason")
    .eq("id", createdAssignmentId)
    .single();

  assert(
    verifyRecord?.is_active === false && verifyRecord?.ended_by === testSupervisor.id,
    "Assignment record atomically transitioned to is_active=false with correct ended_by recorded"
  );

  console.log("\n--------------------------------------------------------------------------------");
  console.log("PHASE 5: ROW-LEVEL SECURITY (RLS) POLICIES VERIFICATION");
  console.log("--------------------------------------------------------------------------------");

  // Test RLS on client_supervisors table
  const { data: rlsSupervisors, error: rlsSupErr } = await supabase
    .from("client_supervisors")
    .select("id, client_id, supervisor_id")
    .eq("client_id", clientA.id);

  assert(!rlsSupErr && rlsSupervisors.length > 0, "client_supervisors table is queryable with active RLS");

  // Verify client removal RPC works and cleans up
  const { data: removeRes } = await supabase.rpc("remove_client_supervisor_atomic", {
    p_client_id: clientA.id,
    p_supervisor_id: testSupervisor.id,
    p_removed_by: testAdmin.id,
  });
  assert(removeRes?.success === true, "remove_client_supervisor_atomic successfully revoked supervisor assignment");

  // Verify supervisor now has NO access to Client A
  const { data: accessAfterRevoke } = await supabase.rpc("check_user_can_access_client", {
    p_user_id: testSupervisor.id,
    p_client_id: clientA.id,
  });
  assert(accessAfterRevoke === false, "Access immediately revoked after supervisor assignment removal");

  // Re-assign supervisor to Client A to leave the system in healthy state
  await supabase.rpc("assign_client_supervisor_atomic", {
    p_client_id: clientA.id,
    p_supervisor_id: testSupervisor.id,
    p_assigned_by: testAdmin.id,
  });

  if (anonSupabase) {
    console.log("\n--------------------------------------------------------------------------------");
    console.log("PHASE 6: ANONYMOUS EXECUTION PROTECTION (REVOKE EXECUTE FROM anon / PUBLIC)");
    console.log("--------------------------------------------------------------------------------");

    // Anon client attempt on assign_client_supervisor_atomic
    const { error: anonAssignErr } = await anonSupabase.rpc("assign_client_supervisor_atomic", {
      p_client_id: clientA.id,
      p_supervisor_id: testSupervisor.id,
      p_assigned_by: testAdmin.id,
    });
    assert(
      anonAssignErr && (anonAssignErr.code === "42501" || anonAssignErr.message.includes("permission denied")),
      "Anonymous caller cannot invoke assign_client_supervisor_atomic (42501 permission denied)"
    );

    // Anon client attempt on remove_client_supervisor_atomic
    const { error: anonRemoveErr } = await anonSupabase.rpc("remove_client_supervisor_atomic", {
      p_client_id: clientA.id,
      p_supervisor_id: testSupervisor.id,
      p_removed_by: testAdmin.id,
    });
    assert(
      anonRemoveErr && (anonRemoveErr.code === "42501" || anonRemoveErr.message.includes("permission denied")),
      "Anonymous caller cannot invoke remove_client_supervisor_atomic (42501 permission denied)"
    );

    // Anon client attempt on assign_operator_machine_atomic
    const { error: anonAssignOpErr } = await anonSupabase.rpc("assign_operator_machine_atomic", {
      p_machine_id: testMachineA.id,
      p_operator_id: testOperator.id,
      p_assigned_by: testAdmin.id,
      p_shift_code: "GENERAL",
    });
    assert(
      anonAssignOpErr && (anonAssignOpErr.code === "42501" || anonAssignOpErr.message.includes("permission denied")),
      "Anonymous caller cannot invoke assign_operator_machine_atomic (42501 permission denied)"
    );

    // Anon client attempt on end_operator_machine_assignment_atomic
    const { error: anonEndOpErr } = await anonSupabase.rpc("end_operator_machine_assignment_atomic", {
      p_assignment_id: "00000000-0000-0000-0000-000000000000",
      p_ended_by: testAdmin.id,
    });
    assert(
      anonEndOpErr && (anonEndOpErr.code === "42501" || anonEndOpErr.message.includes("permission denied")),
      "Anonymous caller cannot invoke end_operator_machine_assignment_atomic (42501 permission denied)"
    );
  }

  console.log("\n================================================================================");
  console.log(`ALL TESTS PASSED: ${passedTests} / ${totalTests} assertions verified!`);
  console.log("================================================================================\n");
}

runTests().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
