import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { User, ActiveOperatorOtherAssignment } from "@/lib/types/database";
import { getMachineScope } from "@reachinternational/permissions";

export interface MachineFilterOptions {
  supervisors: User[];
  operators: User[];
  statuses: Array<{ value: string; label: string }>;
  healthStatuses: Array<{ value: string; label: string }>;
}

export type { ActiveOperatorOtherAssignment };

/**
 * High-performance cached query returning ONLY users where role === 'supervisor'.
 * Excludes administrators, managers, and operators from supervisor assignment dropdowns.
 */
export const getActiveSupervisorsOnly = unstable_cache(
  async (): Promise<User[]> => {
    const supabase = createSupabaseAdminClient();

    const { data: usersData, error } = await supabase
      .from("users")
      .select("id, full_name, employee_id, phone, email, role, status, shift_start_time, shift_end_time")
      .eq("role", "supervisor")
      .neq("status", "inactive")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("[machine-filters] Error fetching active supervisors only:", error.message || error);
      return [];
    }

    return (usersData || []).map((u: any) => {
      const shiftTime =
        u.shift_start_time && u.shift_end_time
          ? `${String(u.shift_start_time).slice(0, 5)} - ${String(u.shift_end_time).slice(0, 5)}`
          : null;

      return {
        id: u.id,
        full_name: u.full_name || u.email || "Supervisor",
        employee_id: u.employee_id || null,
        phone: u.phone,
        email: u.email,
        role: "supervisor",
        shift_time: shiftTime,
        shift_start_time: u.shift_start_time,
        shift_end_time: u.shift_end_time,
        status: u.status || "active",
      } as User;
    });
  },
  ["active-supervisors-only-v1"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta, TAGS.users] }
);

export const getActiveSupervisors = unstable_cache(
  async (): Promise<User[]> => {
    const supabase = createSupabaseAdminClient();

    const { data: usersData, error } = await supabase
      .from("users")
      .select("id, full_name, employee_id, phone, email, role, status, shift_start_time, shift_end_time")
      .in("role", ["supervisor", "manager", "admin", "super_admin"])
      .neq("status", "inactive")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("[machine-filters] Error fetching active supervisors:", error.message || error);
      return [];
    }

    return (usersData || []).map((u: any) => {
      const shiftTime =
        u.shift_start_time && u.shift_end_time
          ? `${String(u.shift_start_time).slice(0, 5)} - ${String(u.shift_end_time).slice(0, 5)}`
          : null;

      return {
        id: u.id,
        full_name: u.full_name || u.email || "Supervisor",
        employee_id: u.employee_id || null,
        phone: u.phone,
        email: u.email,
        role: u.role,
        shift_time: shiftTime,
        shift_start_time: u.shift_start_time,
        shift_end_time: u.shift_end_time,
        status: u.status || "active",
      } as User;
    });
  },
  ["active-supervisors-v11"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta, TAGS.users] }
);

export const getActiveOperators = unstable_cache(
  async (): Promise<User[]> => {
    const supabase = createSupabaseAdminClient();

    const { data: usersData, error } = await supabase
      .from("users")
      .select("id, full_name, employee_id, phone, email, role, status, shift_start_time, shift_end_time")
      .eq("role", "operator")
      .neq("status", "inactive")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("[machine-filters] Error fetching active operators:", error.message || error);
      return [];
    }

    return (usersData || []).map((u: any) => {
      const shiftTime =
        u.shift_start_time && u.shift_end_time
          ? `${String(u.shift_start_time).slice(0, 5)} - ${String(u.shift_end_time).slice(0, 5)}`
          : null;

      return {
        id: u.id,
        full_name: u.full_name || u.email || "Operator",
        employee_id: u.employee_id || null,
        phone: u.phone,
        email: u.email,
        role: u.role,
        shift_time: shiftTime,
        shift_start_time: u.shift_start_time,
        shift_end_time: u.shift_end_time,
        status: u.status || "active",
      } as User;
    });
  },
  ["active-operators-v11"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta, TAGS.users] }
);

/**
 * Resolves active operators reporting to or managed by a specific supervisor.
 * Includes operators directly reporting via users.supervisor_id, junction table user_supervisors,
 * active machine assignments on equipment supervised by this supervisor, or deployed at clients supervised by this supervisor.
 */
export const getSupervisorScopedOperators = (supervisorId: string) =>
  unstable_cache(
    async (): Promise<User[]> => {
      const supabase = createSupabaseAdminClient();
      const todayDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

      // Run parallel lookups for all operator pathways under this supervisor
      const [directUsersRes, junctionUsersRes, supervisedMachinesRes, clientSupervisedRes] = await Promise.all([
        // Pathway 1: Direct supervisor_id in users
        supabase
          .from("users")
          .select("id, full_name, employee_id, phone, email, role, status, shift_start_time, shift_end_time")
          .eq("supervisor_id", supervisorId)
          .eq("role", "operator")
          .neq("status", "inactive")
          .order("full_name", { ascending: true }),
        // Pathway 2: user_supervisors junction table
        supabase
          .from("user_supervisors")
          .select("user_id")
          .eq("supervisor_id", supervisorId),
        // Pathway 3: Machines supervised by this supervisor (current or array)
        supabase
          .from("machines")
          .select("id, current_operator_id, operator_ids")
          .or(`current_supervisor_id.eq.${supervisorId},supervisor_ids.cs.{${supervisorId}}`),
        // Pathway 4: Clients supervised by this supervisor
        supabase
          .from("client_supervisors")
          .select("client_id")
          .eq("supervisor_id", supervisorId),
      ]);

      const operatorIdSet = new Set<string>();

      // Collect from direct users
      (directUsersRes.data || []).forEach((u) => operatorIdSet.add(u.id));

      // Collect from junction table
      const junctionIds = (junctionUsersRes.data || []).map((j: any) => j.user_id).filter(Boolean);
      junctionIds.forEach((id: string) => operatorIdSet.add(id));

      // Collect from supervised machines current operator / operator_ids
      const supervisedMachineIds: string[] = [];
      (supervisedMachinesRes.data || []).forEach((m: any) => {
        if (m.id) supervisedMachineIds.push(m.id);
        if (m.current_operator_id) operatorIdSet.add(m.current_operator_id);
        if (Array.isArray(m.operator_ids)) {
          m.operator_ids.forEach((id: string) => operatorIdSet.add(id));
        }
      });

      // Also collect active assignment operators on these machines
      if (supervisedMachineIds.length > 0) {
        const { data: assignments } = await supabase
          .from("operator_machine_assignments")
          .select("operator_id")
          .in("machine_id", supervisedMachineIds)
          .eq("is_active", true)
          .lte("valid_from", todayDate)
          .or(`valid_to.is.null,valid_to.gte.${todayDate}`);

        (assignments || []).forEach((a: any) => {
          if (a.operator_id) operatorIdSet.add(a.operator_id);
        });
      }

      // Collect from client supervised machines
      const clientIds = (clientSupervisedRes.data || []).map((c: any) => c.client_id).filter(Boolean);
      if (clientIds.length > 0) {
        const { data: clientMachines } = await supabase
          .from("machines")
          .select("id, current_operator_id, operator_ids")
          .in("client_id", clientIds);

        const clientMachineIds: string[] = [];
        (clientMachines || []).forEach((m: any) => {
          if (m.id) clientMachineIds.push(m.id);
          if (m.current_operator_id) operatorIdSet.add(m.current_operator_id);
          if (Array.isArray(m.operator_ids)) {
            m.operator_ids.forEach((id: string) => operatorIdSet.add(id));
          }
        });

        if (clientMachineIds.length > 0) {
          const { data: clientAssignments } = await supabase
            .from("operator_machine_assignments")
            .select("operator_id")
            .in("machine_id", clientMachineIds)
            .eq("is_active", true)
            .lte("valid_from", todayDate)
            .or(`valid_to.is.null,valid_to.gte.${todayDate}`);

          (clientAssignments || []).forEach((a: any) => {
            if (a.operator_id) operatorIdSet.add(a.operator_id);
          });
        }
      }

      if (operatorIdSet.size === 0) {
        return [];
      }

      // Fetch full operator user profiles for these IDs
      const { data: operators, error: opError } = await supabase
        .from("users")
        .select("id, full_name, employee_id, phone, email, role, status, shift_start_time, shift_end_time")
        .in("id", Array.from(operatorIdSet))
        .eq("role", "operator")
        .neq("status", "inactive")
        .order("full_name", { ascending: true });

      if (opError) {
        console.error("[machine-filters] Error fetching supervisor scoped operators:", opError);
        return (directUsersRes.data as User[]) || [];
      }

      return (operators || []).map((u: any) => {
        const shiftTime =
          u.shift_start_time && u.shift_end_time
            ? `${String(u.shift_start_time).slice(0, 5)} - ${String(u.shift_end_time).slice(0, 5)}`
            : null;

        return {
          id: u.id,
          full_name: u.full_name || u.email || "Operator",
          employee_id: u.employee_id || null,
          phone: u.phone,
          email: u.email,
          role: u.role,
          shift_time: shiftTime,
          shift_start_time: u.shift_start_time,
          shift_end_time: u.shift_end_time,
          status: u.status || "active",
        } as User;
      });
    },
    [`supervisor-operators-${supervisorId}`],
    { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta, TAGS.users, TAGS.assignments] }
  )();

/**
 * High-level RBAC-aware operator resolver.
 * For supervisors: returns ONLY operators under that supervisor's authority.
 * For admins/managers/super_admins/HR: returns all active operators.
 */
export async function getActiveOperatorsForUser(userId?: string, userRole?: string): Promise<User[]> {
  if (userRole === "supervisor" && userId) {
    return getSupervisorScopedOperators(userId);
  }
  return getActiveOperators();
}

export const getActiveOperatorMachineAssignments = unstable_cache(
  async (targetDate?: string | null, scopeUserId?: string | null, scopeRole?: string | null): Promise<ActiveOperatorOtherAssignment[]> => {
    const supabase = createSupabaseAdminClient();
    const scope = getMachineScope(scopeRole ?? null);
    // Never return fleet-wide assignment data to a scoped caller. Managers pass null scope;
    // supervisors are limited to supervised clients/direct machines, operators to their own rows.
    if (scope === "supervised" || scope === "assigned") {
      if (!scopeUserId) return [];
    } else if (scope === "none") {
      return [];
    }
    const todayIst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const dateFilter =
      targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
        ? targetDate
        : todayIst;
    // Past dates are resolved by RANGE only: the legacy sync trigger force-deactivates every
    // row whose valid_to < today, so filtering is_active would hide all historical coverage.
    const isPastDate = dateFilter < todayIst;
    const baseQuery = supabase
      .from("operator_machine_assignments")
      .select(`
          operator_id,
          machine_id,
          shift_code,
          shift_start_time,
          shift_end_time,
          machines!inner(id, machine_id, client_id),
          users!operator_machine_assignments_operator_id_fkey(id, full_name)
        `)
      .lte("valid_from", dateFilter)
      .or(`valid_to.is.null,valid_to.gte.${dateFilter}`);
    let scopedQuery = isPastDate ? baseQuery : baseQuery.eq("is_active", true);

    if (scope === "assigned") {
      scopedQuery = scopedQuery.eq("operator_id", scopeUserId);
    } else if (scope === "supervised") {
      const { data: supervisedClients } = await supabase
        .from("client_supervisors")
        .select("client_id")
        .eq("supervisor_id", scopeUserId);
      const clientIds = (supervisedClients || [])
        .map((row: { client_id: string | null }) => row.client_id)
        .filter((id): id is string => Boolean(id));
      const machineFilters = [
        `current_supervisor_id.eq.${scopeUserId}`,
        `supervisor_ids.cs.{${scopeUserId}}`,
        clientIds.length > 0 ? `client_id.in.(${clientIds.join(",")})` : null,
      ].filter(Boolean) as string[];
      scopedQuery = scopedQuery.or(machineFilters.join(","), { foreignTable: "machines" });
    }

    const [{ data, error }, { data: shiftCodes }] = await Promise.all([
      scopedQuery,
      supabase
        .from("client_shift_codes")
        .select("client_id, code, name, start_time, end_time")
        .eq("is_active", true),
    ]);

    if (error || !data) {
      console.error("[machine-filters] Error fetching active operator assignments:", error?.message || error);
      return [];
    }

    const shiftMap = new Map<string, { name: string; start_time: string; end_time: string }>();
    (shiftCodes || []).forEach((sc: any) => {
      if (sc.client_id && sc.code) {
        shiftMap.set(`${sc.client_id}:${sc.code.trim().toUpperCase()}`, {
          name: sc.name || `Shift ${sc.code}`,
          start_time: sc.start_time,
          end_time: sc.end_time,
        });
      }
    });

    return data
      .filter((row: any) => row.operator_id && row.machine_id)
      .map((row: any) => {
        const clientShift = row.machines?.client_id && row.shift_code
          ? shiftMap.get(`${row.machines.client_id}:${row.shift_code.trim().toUpperCase()}`)
          : null;

        const rawStart = clientShift?.start_time || row.shift_start_time || "06:00:00";
        const rawEnd = clientShift?.end_time || row.shift_end_time || "14:00:00";

        return {
          operatorId: row.operator_id,
          operatorName: row.users?.full_name || "Operator",
          machineId: row.machine_id,
          machineCode: row.machines?.machine_id || "Machine",
          shiftCode: row.shift_code || null,
          shiftName: (clientShift as any)?.name || (row.shift_code ? `Shift ${row.shift_code}` : null),
          shiftStartTime: String(rawStart).slice(0, 8),
          shiftEndTime: String(rawEnd).slice(0, 8),
        };
      });
  },
  ["active-operator-machine-assignments-v4"],
  { revalidate: CACHE_TIERS.CLASS_B_FLEET, tags: [TAGS.machines, TAGS.users, TAGS.clients] }
);


export const getMachineCities = unstable_cache(
  async (): Promise<string[]> => {
    return [];
  },
  ["machine-cities-v4"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta] }
);

export const getMachineOptions = unstable_cache(
  async (): Promise<{ id: string; label: string; model?: string }[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("machines")
      .select("id, machine_id, model")
      .order("machine_id", { ascending: true });

    if (error || !data) return [];

    return data.map((m: any) => {
      const code = m.machine_id || m.id;
      return {
        id: m.id,
        label: m.model ? `${code} (${m.model})` : code,
        model: m.model || undefined,
      };
    });
  },
  ["machine-options-v3"],
  { revalidate: CACHE_TIERS.CLASS_B_FLEET, tags: [TAGS.machines] }
);

const getCachedMachineFilterOptions = unstable_cache(
  async (): Promise<MachineFilterOptions> => {
    const [supervisors, operators] = await Promise.all([
      getActiveSupervisors(),
      getActiveOperators(),
    ]);

    return {
      supervisors,
      operators,
      statuses: [
        { value: "all", label: "All Statuses" },
        { value: "available", label: "Available" },
        { value: "rented", label: "On Rent" },
      ],
      healthStatuses: [
        { value: "all", label: "All Health" },
        { value: "active", label: "Active" },
        { value: "spare", label: "Spare" },
        { value: "under_maintenance", label: "Under Maintenance" },
        { value: "breakdown", label: "Breakdown" },
      ],
    };
  },
  ["machine-filter-options-master-v3"],
  {
    revalidate: CACHE_TIERS.CLASS_B_DIRECTORY,
    tags: [TAGS.machinesMeta, TAGS.machines, TAGS.users],
  }
);

/**
 * Aggregated master filter options for Machine Directory toolbars.
 * Deduplicated per-request via React cache() and cached across requests via unstable_cache().
 */
export const getMachineFilterOptions = cache(async (): Promise<MachineFilterOptions> => {
  return getCachedMachineFilterOptions();
});

