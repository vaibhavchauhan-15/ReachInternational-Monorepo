import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import { getMachines } from "@/lib/queries/machines";
import { getClients } from "@/lib/queries/clients";
import type { Machine, MachineWithEngineer, User } from "@/lib/types/database";
import type { OperatorHourLog } from "@/components/dashboard/OperatorDashboard";

const HOUR_LOG_PROJECTION = `
  id,
  machine_id,
  operator_id,
  supervisor_id,
  client_id,
  log_date,
  start_meter,
  end_meter,
  start_time,
  end_time,
  overtime_hours,
  operating_hours,
  breakdown_hours,
  breakdown_reason,
  is_breakdown,
  start_fuel_level,
  fuel_consumed,
  shift,
  machine_condition,
  site_location,
  location,
  remarks,
  status,
  created_at,
  updated_at,
  machine:machines(id, machine_id, machine_code, model, serial_number, hour_meter, status),
  client:clients(id, code, client_name),
  operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone, email),
  supervisor:users!machine_hour_logs_supervisor_id_fkey(id, full_name, phone)
`;

const ASSIGNMENT_PROJECTION = `
  id,
  machine_id,
  operator_id,
  assigned_by,
  status,
  site_location,
  start_date,
  end_date,
  created_at,
  machine:machines(id, machine_id, machine_code, model, serial_number, hour_meter, status),
  operator:users!operator_id(id, full_name, phone, email),
  assigner:users!assigned_by(id, full_name)
`;

/**
 * High-performance, tab-aware operations hub data loader.
 * Replaces direct inline database queries in operations/page.tsx.
 */
export async function getOperationsHubData(user: User, tab: string = "logs") {
  const supabase = createSupabaseAdminClient();

  // 1. Operator Entry Tab: Only fetch operator assignment + recent logs
  if (user.role === "operator" || tab === "entry" || tab === "history") {
    const [assignedMachineRes, recentLogsRes, clientsList] = await Promise.all([
      supabase
        .from("machines")
        .select("id, machine_id, machine_code, model, serial_number, hour_meter, status")
        .eq("current_operator_id", user.id)
        .maybeSingle(),
      supabase
        .from("machine_hour_logs")
        .select(HOUR_LOG_PROJECTION)
        .eq("operator_id", user.id)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50),
      getClients(undefined, true),
    ]);

    const formattedAssignedMachine = assignedMachineRes.data
      ? (() => {
          const m = assignedMachineRes.data as any;
          const code = m.machine_id || m.machine_code || m.id;
          return {
            ...m,
            machine_id: code,
            machine_code: code,
            machine_name: m.model ? `${code} (${m.model})` : code,
          };
        })()
      : null;

    return {
      machines: [],
      dbClients: clientsList,
      operators: [],
      assignments: [],
      hourLogs: (recentLogsRes.data || []) as any[],
      siteMovements: [],
      operatorPayouts: [],
      assignedMachine: (formattedAssignedMachine as unknown as Machine) || null,
      recentLogs: (recentLogsRes.data || []) as unknown as OperatorHourLog[],
      allMachines: [],
    };
  }

  // 2. Supervisor / Management Hub: Fetch active tab datasets in parallel
  const [
    machinesRes,
    clientsList,
    operatorsRes,
    assignmentsRes,
    hourLogsRes,
    siteMovementsRes,
    payoutsRes,
  ] = await Promise.all([
    getMachines(),
    getClients(undefined, true),
    supabase
      .from("users")
      .select("id, full_name, email, phone, role, status")
      .in("role", ["operator", "mechanic", "supervisor", "service_engineer"])
      .neq("status", "inactive"),
    supabase
      .from("machine_assignments")
      .select(ASSIGNMENT_PROJECTION)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("machine_hour_logs")
      .select(HOUR_LOG_PROJECTION)
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("machine_site_movements")
      .select("id, machine_id, movement_date, from_site, to_site, remarks, created_at, machine:machines(id, machine_code, model), operator:users!operator_id(id, full_name)")
      .order("movement_date", { ascending: false })
      .limit(50),
    supabase
      .from("operator_payouts")
      .select("id, operator_id, amount, status, period_start, period_end, created_at, operator:users!operator_id(id, full_name, phone)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    machines: machinesRes.machines,
    dbClients: clientsList,
    operators: (operatorsRes.data || []) as User[],
    assignments: (assignmentsRes.data || []) as any[],
    hourLogs: (hourLogsRes.data || []) as any[],
    siteMovements: (siteMovementsRes.data || []) as any[],
    operatorPayouts: (payoutsRes.data || []) as any[],
    assignedMachine: null,
    recentLogs: [],
    allMachines: machinesRes.machines as unknown as MachineWithEngineer[],
  };
}

export async function getOperatorEntryContext(operatorId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: machine } = await supabase
    .from("machines")
    .select("id, machine_id, machine_code, model, serial_number, hour_meter, status")
    .eq("current_operator_id", operatorId)
    .maybeSingle();

  return { assignedMachine: machine };
}
