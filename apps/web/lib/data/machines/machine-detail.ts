import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/dal";
import { MACHINE_CAPABILITIES, hasMachineCapability } from "@reachinternational/permissions";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { Machine, OperatorMachineAssignment } from "@/lib/types/database";

const MACHINE_DETAIL_COLUMNS = `
  id,
  machine_id,
  model,
  serial_number,
  year_of_mfg,
  manufacturer,
  current_supervisor_id,
  supervisor_ids,
  hour_meter,
  current_operator_id,
  operator_ids,
  client_id,
  site_id,
  health_status,
  status,
  created_at,
  updated_at,
  current_operator:users!machines_current_operator_id_fkey(id, full_name, phone, email, shift_start_time, shift_end_time),
  current_supervisor:users!machines_current_supervisor_id_fkey(id, full_name, phone, email, shift_start_time, shift_end_time),
  client:clients!machines_client_id_fkey(
    id, code, company_name, city, district, state, pincode, phone,
    contact_person, street, gstin, pan_number, is_billing_address_different,
    billing_address, billing_city, billing_district, billing_state, billing_pincode, status
  )
`;

async function hydrateMachinePersonnelSingle(machine: any, supabase: any): Promise<any> {
  if (!machine) return null;

  // 1. Fetch active assignments from operator_machine_assignments
  const todayDate = (new Date()).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const { data: assignmentsData } = await supabase
    .from("operator_machine_assignments")
    .select(`
      id,
      machine_id,
      operator_id,
      shift_start_time,
      shift_end_time,
      shift_code,
      crosses_midnight,
      is_active,
      assigned_by,
      assigned_at,
      ended_at,
      ended_by,
      end_reason,
      created_at,
      updated_at
    `)
    .eq("machine_id", machine.id)
    .eq("is_active", true)
    .lte("valid_from", todayDate)
    .or(`valid_to.is.null,valid_to.gte.${todayDate}`)
    .order("shift_start_time", { ascending: true });

  const activeAssignmentsRaw = assignmentsData || [];

  // 2. Gather ALL user IDs from machine record and active assignments
  const allUserIds = new Set<string>();
  if (Array.isArray(machine.supervisor_ids)) {
    machine.supervisor_ids.forEach((id: string) => id && allUserIds.add(id));
  }
  if (machine.current_supervisor_id) allUserIds.add(machine.current_supervisor_id);

  if (Array.isArray(machine.operator_ids)) {
    machine.operator_ids.forEach((id: string) => id && allUserIds.add(id));
  }
  if (machine.current_operator_id) allUserIds.add(machine.current_operator_id);

  activeAssignmentsRaw.forEach((a: any) => {
    if (a.operator_id) allUserIds.add(a.operator_id);
  });

  // 3. Fetch all user records
  const usersRes =
    allUserIds.size > 0
      ? await supabase
          .from("users")
          .select("id, full_name, phone, email, shift_start_time, shift_end_time, role")
          .in("id", Array.from(allUserIds))
      : { data: [] };

  const usersMap = new Map<string, any>();
  (usersRes.data || []).forEach((u: any) => {
    usersMap.set(u.id, u);
  });

  const activeAssignments = activeAssignmentsRaw.map((a: any) => ({
    ...a,
    operator: usersMap.get(a.operator_id) || null,
  }));

  // Build complete supervisor IDs set and list
  const supIdSet = new Set<string>();
  if (Array.isArray(machine.supervisor_ids)) {
    machine.supervisor_ids.forEach((id: string) => id && supIdSet.add(id));
  } else if (machine.current_supervisor_id) {
    supIdSet.add(machine.current_supervisor_id);
  }

  const seenSupIds = new Set<string>();
  const supervisorsList = Array.from(supIdSet)
    .map((id: string) => usersMap.get(id) || (machine.current_supervisor?.id === id ? machine.current_supervisor : null))
    .filter((s: any) => {
      if (!s?.id) return false;
      if (seenSupIds.has(s.id)) return false;
      seenSupIds.add(s.id);
      return true;
    });

  // Build complete operator IDs set and list:
  // If machine.operator_ids is an array, it is authoritative.
  // Never resurrect removed operators or default operators when operator_ids is defined.
  const opIdSet = new Set<string>();
  if (Array.isArray(machine.operator_ids)) {
    machine.operator_ids.forEach((id: string) => id && opIdSet.add(id));
  } else if (machine.current_operator_id) {
    opIdSet.add(machine.current_operator_id);
  } else {
    activeAssignmentsRaw.forEach((a: any) => {
      if (a.operator_id) opIdSet.add(a.operator_id);
    });
  }

  // 3. Fetch Client Shift Codes if machine is assigned to a client
  let clientShifts: any[] = [];
  if (machine.client_id) {
    const { data: cShifts } = await supabase
      .from("client_shift_codes")
      .select("id, client_id, code, name, start_time, end_time, scheduled_minutes, normal_minutes, crosses_midnight, display_order, is_active")
      .eq("client_id", machine.client_id)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("code", { ascending: true });
    if (cShifts && cShifts.length > 0) {
      clientShifts = cShifts;
    }
  }
  const clientShiftMap = new Map(
    clientShifts.map((cs: any) => [String(cs.code || "").trim().toUpperCase(), cs])
  );

  // 4. Construct Operators List
  let operatorsList: any[] = [];
  if (activeAssignmentsRaw.length > 0) {
    const seenAssignmentKeys = new Set<string>();
    const dedupedAssignments = activeAssignmentsRaw.filter((a: any) => {
      if (!a.operator_id || !opIdSet.has(a.operator_id)) return false;
      const key = `${a.operator_id}:${String(a.shift_code || "").trim().toUpperCase()}`;
      if (seenAssignmentKeys.has(key)) return false;
      seenAssignmentKeys.add(key);
      return true;
    });

    operatorsList = dedupedAssignments.map((assign: any) => {
      const user = usersMap.get(assign.operator_id) || (machine.current_operator?.id === assign.operator_id ? machine.current_operator : null);
      const sc = assign.shift_code ? clientShiftMap.get(String(assign.shift_code).trim().toUpperCase()) : null;
      const shift_name = sc?.name || (assign.shift_code ? `Shift ${assign.shift_code}` : null);
      const start = assign.shift_start_time || sc?.start_time || user?.shift_start_time;
      const end = assign.shift_end_time || sc?.end_time || user?.shift_end_time;
      const shift_time =
        start && end
          ? `${String(start).slice(0, 5)} - ${String(end).slice(0, 5)}`
          : user?.shift_time || "08:00 AM - 04:00 PM";
      return {
        ...(user || {}),
        id: assign.operator_id,
        assignment_id: assign.id,
        full_name: user?.full_name || "Operator",
        phone: user?.phone || null,
        email: user?.email || null,
        shift_time,
        shift_code: assign.shift_code || null,
        shift_name,
        shift_start_time: start || null,
        shift_end_time: end || null,
        role: "operator",
      };
    });

    // Also include any operators from opIdSet who don't have an active assignment row
    const assignedOpIds = new Set(dedupedAssignments.map((a: any) => a.operator_id));
    opIdSet.forEach((id: string) => {
      if (assignedOpIds.has(id)) return;
      const user = usersMap.get(id) || (machine.current_operator?.id === id ? machine.current_operator : null);
      if (!user) return;
      const sc = user.shift_code ? clientShiftMap.get(String(user.shift_code).trim().toUpperCase()) : null;
      const shift_name = sc?.name || (user.shift_code ? `Shift ${user.shift_code}` : null);
      const start = user.shift_start_time || sc?.start_time;
      const end = user.shift_end_time || sc?.end_time;
      const shift_time =
        start && end
          ? `${String(start).slice(0, 5)} - ${String(end).slice(0, 5)}`
          : user.shift_time || null;
      operatorsList.push({
        ...user,
        shift_time,
        shift_code: user.shift_code || null,
        shift_name,
        shift_start_time: start || null,
        shift_end_time: end || null,
      });
    });
  } else {
    operatorsList = Array.from(opIdSet)
      .map((id: string) => {
        const user = usersMap.get(id) || (machine.current_operator?.id === id ? machine.current_operator : null);
        if (!user) return null;
        const sc = user.shift_code ? clientShiftMap.get(String(user.shift_code).trim().toUpperCase()) : null;
        const shift_name = sc?.name || (user.shift_code ? `Shift ${user.shift_code}` : null);
        const start = user.shift_start_time || sc?.start_time;
        const end = user.shift_end_time || sc?.end_time;
        const shift_time =
          start && end
            ? `${String(start).slice(0, 5)} - ${String(end).slice(0, 5)}`
            : user.shift_time || null;
        return {
          ...user,
          shift_time,
          shift_code: user.shift_code || null,
          shift_name,
          shift_start_time: start || null,
          shift_end_time: end || null,
        };
      })
      .filter(Boolean);
  }

  const cleanSupIds = Array.from(new Set(supervisorsList.map((s: any) => s.id)));
  const cleanOpIds = Array.from(new Set(operatorsList.map((o: any) => o.id)));

  const code = machine.machine_id || machine.id;

  return {
    ...machine,
    machine_id: code,
    machine_code: code,
    machine_name: machine.model ? `${code} (${machine.model})` : code,
    supervisor_ids: cleanSupIds,
    operator_ids: cleanOpIds,
    supervisors: supervisorsList,
    operators: operatorsList,
    client_shifts: clientShifts,
    active_assignments: activeAssignmentsRaw
      .filter((a: any) => opIdSet.has(a.operator_id))
      .map((a: any) => {
        const sc = a.shift_code ? clientShiftMap.get(String(a.shift_code).trim().toUpperCase()) : null;
        return {
          ...a,
          shift_name: sc?.name || (a.shift_code ? `Shift ${a.shift_code}` : null),
        };
      }),
    current_supervisor: supervisorsList[0] || null,
    current_operator: operatorsList[0] || null,
    client: machine.client
      ? {
          ...machine.client,
          address: machine.client.street || (machine.client as any).address || "",
        }
      : null,
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Resolves a machine identifier string (UUID or M/C-XXXX code) to canonical database UUID.
 */
export async function resolveMachineId(idOrCode: string): Promise<string | null> {
  if (!idOrCode || typeof idOrCode !== "string") return null;
  const trimmed = idOrCode.trim();
  if (isValidUuid(trimmed)) return trimmed;

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("machines")
    .select("id")
    .or(`machine_id.ilike.${trimmed}`)
    .maybeSingle();

  return data?.id || null;
}

/**
 * Fetch detailed machine record by UUID or M/C-XXXX machine ID.
 * Deduplicates in-flight calls via React cache() and caches cross-request with targeted tag TAGS.machineDetail(id).
 */
// Operator projection: no GSTIN/PAN/billing compliance fields, no rates.
const OPERATOR_MACHINE_DETAIL_COLUMNS = MACHINE_DETAIL_COLUMNS.replace(
  /client:clients!machines_client_id_fkey\([\s\S]*?\)\n`/,
  `client:clients!machines_client_id_fkey(id, code, company_name, city, state)\n`
);

export const getMachineById = cache(async (
  idOrCode: string,
  options?: { includeClientCompliance?: boolean }
): Promise<Machine | null> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const targetId = isValidUuid(idOrCode) ? idOrCode : await resolveMachineId(idOrCode);
  if (!targetId) return null;

  const includeCompliance = options?.includeClientCompliance !== false;
  const columns = includeCompliance
    ? MACHINE_DETAIL_COLUMNS
    : OPERATOR_MACHINE_DETAIL_COLUMNS;

  const fetchCached = unstable_cache(
    async (): Promise<Machine | null> => {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("machines")
        .select(columns)
        .eq("id", targetId)
        .maybeSingle();

      if (error || !data) {
        if (error) console.error("Error fetching machine by id:", error.message || error);
        return null;
      }

      const hydrated = await hydrateMachinePersonnelSingle(data, supabase);
      return hydrated as unknown as Machine;
    },
    [`machines-detail-${targetId}-${includeCompliance ? "full" : "operator"}`],
    {
      revalidate: CACHE_TIERS.CLASS_B_FLEET, // 60 seconds SWR
      tags: [TAGS.machineDetail(targetId), TAGS.machines],
    }
  );

  return fetchCached();
});

/**
 * Fetch all operator assignments for a specific machine.
 * Deduplicated per-request and cached across requests with 15s operational SWR.
 */
export const getMachineAssignments = cache(async (machineId: string): Promise<OperatorMachineAssignment[]> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const fetchCached = unstable_cache(
    async (): Promise<OperatorMachineAssignment[]> => {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("operator_machine_assignments")
        .select(`
          id,
          machine_id,
          operator_id,
          shift_start_time,
          shift_end_time,
          crosses_midnight,
          is_active,
          assigned_by,
          assigned_at,
          ended_at,
          ended_by,
          end_reason,
          created_at,
          updated_at,
          operator:users!operator_machine_assignments_operator_id_fkey(id, full_name, phone, email, shift_start_time, shift_end_time)
        `)
        .eq("machine_id", machineId)
        .order("is_active", { ascending: false })
        .order("shift_start_time", { ascending: true });

      if (error) {
        console.error("Error fetching machine assignments:", error.message || error);
        return [];
      }

      return (data || []) as unknown as OperatorMachineAssignment[];
    },
    [`machines-assignments-${machineId}`],
    {
      revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL, // 15 seconds SWR
      tags: [TAGS.machineDetail(machineId), TAGS.assignments, TAGS.machines],
    }
  );

  return fetchCached();
});

/**
 * Fetch the assigned machine for a specific operator.
 * Resolves active operator_machine_assignments first, then falls back to machines table direct assignment.
 */
export const getOperatorAssignedMachine = cache(async (operatorId: string): Promise<Machine | null> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const fetchCached = unstable_cache(
    async (): Promise<Machine | null> => {
      const supabase = createSupabaseAdminClient();

      // Priority 1: Active record in operator_machine_assignments
      const todayDate = (new Date()).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const { data: omaData } = await supabase
        .from("operator_machine_assignments")
        .select("machine_id")
        .eq("operator_id", operatorId)
        .eq("is_active", true)
        .lte("valid_from", todayDate)
        .or(`valid_to.is.null,valid_to.gte.${todayDate}`)
        .order("valid_from", { ascending: false })
        .limit(1)
        .maybeSingle();

      let targetMachineId = omaData?.machine_id;

      // Priority 2: Fallback to machines table direct assignment
      if (!targetMachineId) {
        const { data: mData } = await supabase
          .from("machines")
          .select("id")
          .or(`current_operator_id.eq.${operatorId},operator_ids.cs.{${operatorId}}`)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        targetMachineId = mData?.id;
      }

      if (!targetMachineId) return null;

      const { data: machineData, error: mError } = await supabase
        .from("machines")
        .select(OPERATOR_MACHINE_DETAIL_COLUMNS)
        .eq("id", targetMachineId)
        .maybeSingle();

      if (mError || !machineData) return null;

      const hydrated = await hydrateMachinePersonnelSingle(machineData, supabase);
      return hydrated as unknown as Machine;
    },
    [`operator-assigned-machine-${operatorId}`],
    {
      revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL,
      tags: [TAGS.machines, `operator-machine:${operatorId}`],
    }
  );

  return fetchCached();
});

/**
 * Fetch active rental contract metadata for a machine.
 * Deduplicated per-request and cached with 60s SWR under targeted machine detail tag.
 */
export const getMachineActiveRental = cache(async (idOrCode: string, options?: { includeRate?: boolean }) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const targetId = isValidUuid(idOrCode) ? idOrCode : await resolveMachineId(idOrCode);
  if (!targetId) return null;

  // Commercial rates are only projected for roles with machine.rental_rates_view.
  const includeRate = options?.includeRate === true;
  const rentalColumns = `
    id,
    contract_number,
    client_id,
    start_date,
    end_date,
    ${includeRate ? "monthly_rate," : ""}
    status,
    client:clients(
      id, code, company_name, city, district, state, pincode, phone,
      contact_person, street, gstin, pan_number, is_billing_address_different,
      billing_address, billing_city, billing_district, billing_state, billing_pincode, status
    )
  `;

  const fetchCached = unstable_cache(
    async () => {
      const supabase = createSupabaseAdminClient();
      const { data } = await supabase
        .from("rental_contracts")
        .select(rentalColumns)
        .eq("machine_id", targetId)
        .eq("status", "active")
        .maybeSingle();

      return data || null;
    },
    [`machines-active-rental-${targetId}-${includeRate ? "rate" : "no-rate"}`],
    {
      revalidate: CACHE_TIERS.CLASS_B_FLEET, // 60 seconds SWR
      tags: [TAGS.machineDetail(targetId), TAGS.machines],
    }
  );

  return fetchCached();
});

export interface GetPaginatedMachineHourLogsParams {
  machineId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  condition?: "all" | "breakdown" | "normal";
  datePreset?: "all" | "7d" | "30d" | "month";
  operatorId?: string;
  sortBy?: "date" | "running_hours" | "start_meter" | "end_meter";
  sortOrder?: "asc" | "desc";
}

export interface PaginatedMachineHourLogsResult {
  logs: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalHoursRun: number;
  availableOperators: { id: string; name: string }[];
}

/**
 * Fetch paginated running hour meter logs for a machine with server-side slicing,
 * filtering, and sorting (load-by-page lazy architecture).
 */
export async function getPaginatedMachineHourMeterLogs(
  params: GetPaginatedMachineHourLogsParams
): Promise<PaginatedMachineHourLogsResult> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const {
    machineId,
    page = 1,
    pageSize = 10,
    search = "",
    condition = "all",
    datePreset = "all",
    operatorId = "all",
    sortBy = "date",
    sortOrder = "desc",
  } = params;

  const supabase = createSupabaseAdminClient();

  // 1. Build Base Paginated Query
  let query = supabase
    .from("machine_hour_logs")
    .select(
      `
      id,
      machine_id,
      operator_id,
      supervisor_id,
      client_id,
      log_date,
      start_meter,
      end_meter,
      running_hours,
      start_time,
      end_time,
      overtime_hours,
      normal_working_hours,
      is_breakdown,
      breakdown_hours,
      shift,
      machine_condition,
      location,
      remarks,
      idempotency_key,
      created_at,
      operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone, email)
    `,
      { count: "exact" }
    )
    .eq("machine_id", machineId);

  // 2. Condition Filter
  if (condition === "breakdown") {
    query = query.or("is_breakdown.eq.true,breakdown_hours.gt.0");
  } else if (condition === "normal") {
    query = query.or("is_breakdown.eq.false,is_breakdown.is.null").or("breakdown_hours.eq.0,breakdown_hours.is.null");
  }

  // 3. Operator Filter
  if (operatorId && operatorId !== "all") {
    query = query.eq("operator_id", operatorId);
  }

  // 4. Date Preset Filter
  if (datePreset && datePreset !== "all") {
    const now = new Date();
    if (datePreset === "7d") {
      const past7 = new Date(now);
      past7.setDate(past7.getDate() - 7);
      query = query.gte("log_date", past7.toISOString().split("T")[0]);
    } else if (datePreset === "30d") {
      const past30 = new Date(now);
      past30.setDate(past30.getDate() - 30);
      query = query.gte("log_date", past30.toISOString().split("T")[0]);
    } else if (datePreset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      query = query.gte("log_date", firstDay.toISOString().split("T")[0]);
    }
  }

  // 5. Search Filter (Remarks + Operator Name)
  if (search && search.trim()) {
    const trimmed = search.trim();
    const { data: matchingUsers } = await supabase
      .from("users")
      .select("id")
      .ilike("full_name", `%${trimmed}%`);
    const userIds = (matchingUsers || []).map((u) => u.id);
    if (userIds.length > 0) {
      query = query.or(`remarks.ilike.%${trimmed}%,operator_id.in.(${userIds.join(",")})`);
    } else {
      query = query.ilike("remarks", `%${trimmed}%`);
    }
  }

  // 6. Sorting
  const ascending = sortOrder === "asc";
  if (sortBy === "running_hours") {
    query = query.order("running_hours", { ascending }).order("log_date", { ascending: false });
  } else if (sortBy === "start_meter") {
    query = query.order("start_meter", { ascending }).order("log_date", { ascending: false });
  } else if (sortBy === "end_meter") {
    query = query.order("end_meter", { ascending }).order("log_date", { ascending: false });
  } else {
    // Default sort by date
    query = query.order("log_date", { ascending }).order("start_time", { ascending });
  }

  // 7. Range Slicing (Load only data visible on screen!)
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  // 8. Execute in parallel with the bounded operator/hours aggregate RPC
  //    (previously this downloaded every log row for the machine on every page).
  const sessionClient = await createSupabaseServerClient();
  const [dataResult, metadataResult] = await Promise.all([
    query,
    sessionClient.rpc("get_machine_hour_log_summary", { p_machine_id: machineId }),
  ]);

  const { data, count, error } = dataResult;
  if (error) {
    console.error("Error fetching paginated machine hour logs:", error.message || error);
  }

  // Aggregate summary is computed inside PostgreSQL (single indexed aggregate).
  const summary = (metadataResult.data || {}) as {
    total_hours?: number;
    operators?: Array<{ id: string; name: string }>;
  };
  const totalHoursRun = Number(summary.total_hours || 0);
  const availableOperators = (summary.operators || []).filter((op) => op?.id && op?.name);

  const total = count || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    logs: data || [],
    total,
    page,
    pageSize,
    totalPages,
    totalHoursRun: Number(totalHoursRun.toFixed(1)),
    availableOperators,
  };
}

/**
 * Fetch running hour meter logs for a machine (lazy-loaded on tab click).
 */
export async function getMachineHourMeterLogs(machineId: string, limit = 50) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("machine_hour_logs")
    .select(`
      id,
      machine_id,
      operator_id,
      supervisor_id,
      client_id,
      log_date,
      start_meter,
      end_meter,
      running_hours,
      start_time,
      end_time,
      overtime_hours,
      normal_working_hours,
      is_breakdown,
      breakdown_hours,
      shift,
      machine_condition,
      location,
      remarks,
      idempotency_key,
      created_at,
      operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone, email)
    `)
    .eq("machine_id", machineId)
    .order("log_date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching machine hour logs:", error.message || error);
    return [];
  }

  return data || [];
}

/**
 * Fetch machine audit history. Visibility derives from the shared capability
 * matrix (manager tier + supervisor), not a hardcoded role list.
 */
export const getMachineAuditLogs = cache(async (machineId: string, limit = 50) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  if (!hasMachineCapability(user.role, MACHINE_CAPABILITIES.AUDIT_VIEW)) {
    return { unauthorized: true, data: [] };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select(`
      id,
      user_id,
      action,
      entity_type,
      entity_id,
      category,
      severity,
      actor_name,
      actor_role,
      metadata,
      details,
      before_state,
      after_state,
      created_at,
      user:users(id, full_name, role)
    `)
    .eq("entity_type", "machine")
    .eq("entity_id", machineId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { unauthorized: false, data: [] };
  return { unauthorized: false, data: data || [] };
});

