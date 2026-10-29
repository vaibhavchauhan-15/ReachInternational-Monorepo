import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Checks whether an operator comes under a supervisor's authority across all 6 canonical pathways:
 * 1. Direct assignment in users table (users.supervisor_id === supervisorId)
 * 2. Multi-supervisor array (users.supervisor_ids contains supervisorId)
 * 3. Junction table (user_supervisors contains supervisorId and operatorId)
 * 4. Client supervisor inheritance (supervisor assigned to client, operator assigned to active machine deployed at client)
 * 5. Direct machine supervision (machine assigned to supervisor, operator assigned to that machine)
 * 6. Direct machine current operator fallback
 */
export async function isOperatorUnderSupervisor(
  supervisorId: string,
  operatorId: string
): Promise<boolean> {
  if (!supervisorId || !operatorId) return false;

  const supabase = createSupabaseAdminClient();

  // 1. Try atomic PostgreSQL RPC first
  try {
    const { data, error } = await supabase.rpc("is_operator_under_supervisor", {
      p_supervisor_id: supervisorId,
      p_operator_id: operatorId,
    });

    if (!error && typeof data === "boolean") {
      return data;
    }
  } catch {
    // Non-blocking fallback to direct resilient table queries
  }

  // 2. Resilient Fallback: Direct table queries
  try {
    // Pathway A & B: users table direct supervisor_id or supervisor_ids array
    const { data: userRow } = await supabase
      .from("users")
      .select("supervisor_id, supervisor_ids")
      .eq("id", operatorId)
      .maybeSingle();

    if (userRow) {
      if (userRow.supervisor_id === supervisorId) return true;
      if (Array.isArray(userRow.supervisor_ids) && userRow.supervisor_ids.includes(supervisorId)) {
        return true;
      }
    }

    // Pathway C: user_supervisors junction table
    const { data: junctionRow } = await supabase
      .from("user_supervisors")
      .select("id")
      .eq("supervisor_id", supervisorId)
      .eq("user_id", operatorId)
      .maybeSingle();

    if (junctionRow) return true;

    // Pathway D: Client supervisor inheritance via deployed active machinery
    const { data: clientSupervised } = await supabase
      .from("client_supervisors")
      .select("client_id")
      .eq("supervisor_id", supervisorId);

    if (clientSupervised && clientSupervised.length > 0) {
      const clientIds = clientSupervised.map((cs) => cs.client_id).filter(Boolean);
      if (clientIds.length > 0) {
        const { data: machineAssignment } = await supabase
          .from("operator_machine_assignments")
          .select("id, machines!inner(client_id)")
          .eq("operator_id", operatorId)
          .eq("is_active", true)
          .in("machines.client_id", clientIds)
          .limit(1);

        if (machineAssignment && machineAssignment.length > 0) return true;
      }
    }

    // Pathway E: Direct machine supervision via active operator assignment
    const { data: activeAssignments } = await supabase
      .from("operator_machine_assignments")
      .select("machine_id, machines!inner(current_supervisor_id, supervisor_ids)")
      .eq("operator_id", operatorId)
      .eq("is_active", true);

    if (activeAssignments && activeAssignments.length > 0) {
      const isSupervisedMachine = activeAssignments.some((a: any) => {
        const m = a.machines;
        if (!m) return false;
        if (m.current_supervisor_id === supervisorId) return true;
        if (Array.isArray(m.supervisor_ids) && m.supervisor_ids.includes(supervisorId)) return true;
        return false;
      });
      if (isSupervisedMachine) return true;
    }

    return false;
  } catch (err) {
    console.warn("Error in resilient fallback isOperatorUnderSupervisor:", err);
    return false;
  }
}
