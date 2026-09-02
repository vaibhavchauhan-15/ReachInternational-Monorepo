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
  end_date,
  start_datetime,
  end_datetime,
  start_meter,
  end_meter,
  running_hours,
  start_time,
  end_time,
  overtime_hours,
  normal_working_hours,
  is_breakdown,
  shift,
  machine_condition,
  location,
  remarks,
  idempotency_key,
  created_at,
  machine:machines!machine_hour_logs_machine_id_fkey(id, machine_id, model, serial_number, hour_meter, status, manufacturer),
  client:clients!machine_hour_logs_client_id_fkey(id, code, company_name, address, city, state, phone),
  operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone, email),
  supervisor:users!machine_hour_logs_supervisor_id_fkey(id, full_name, phone, email)
`;

function formatHourLogsData(rawLogs: any[]): any[] {
  return (rawLogs || []).map((log) => {
    const m = log.machine;
    const code = m?.machine_id || m?.id || "";
    const startMtr = log.start_meter !== undefined && log.start_meter !== null ? Number(log.start_meter) : 0;
    const endMtr = log.end_meter !== undefined && log.end_meter !== null ? Number(log.end_meter) : startMtr;
    const running = log.running_hours !== undefined && log.running_hours !== null
      ? Number(log.running_hours)
      : Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
    const ot = log.overtime_hours !== undefined && log.overtime_hours !== null ? Number(log.overtime_hours) : 0;
    
    // Normal working hours calculation: if stored, use it; otherwise compute from shift duration - ot - 1h break
    let normalWorking = log.normal_working_hours !== undefined && log.normal_working_hours !== null ? Number(log.normal_working_hours) : null;
    if (normalWorking === null && log.start_time && log.end_time) {
      const parseMins = (t: string) => {
        const match = t.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
        if (!match) return null;
        let h = parseInt(match[1], 10);
        const mins = parseInt(match[2], 10);
        if (match[3] === "PM" && h < 12) h += 12;
        if (match[3] === "AM" && h === 12) h = 0;
        return h * 60 + mins;
      };
      const s = parseMins(log.start_time);
      const e = parseMins(log.end_time);
      if (s !== null && e !== null) {
        let diff = e - s;
        if (diff < 0) diff += 24 * 60;
        const dur = Math.round((diff / 60) * 10) / 10;
        normalWorking = Math.max(0, Math.round((dur - ot - 1.0) * 10) / 10);
      }
    }

    const c = log.client;
    const formattedClient = c
      ? {
          ...c,
          client_name: c.company_name || c.client_name || "",
        }
      : null;

    return {
      ...log,
      start_meter: startMtr,
      end_meter: endMtr,
      running_hours: running,
      overtime_hours: ot,
      normal_working_hours: normalWorking ?? 8,
      client: formattedClient,
      machine: m
        ? {
            ...m,
            machine_id: code,
            machine_code: code,
            machine_name: m.model ? `${code} (${m.model})` : code,
          }
        : null,
    };
  });
}

function deriveAssignmentsFromMachines(machines: Machine[], operatorsList: User[] = []): any[] {
  return (machines || [])
    .filter((m: any) => m.current_operator_id || m.current_supervisor_id)
    .map((m: any) => {
      const code = m.machine_id || m.machine_code || m.id || "";
      const matchedOperator = m.current_operator || (m.current_operator_id ? operatorsList.find((u: any) => u.id === m.current_operator_id) : null) || null;
      return {
        id: `assign-${m.id}`,
        machine_id: m.id,
        operator_id: m.current_operator_id,
        supervisor_id: m.current_supervisor_id,
        assigned_by: m.current_supervisor_id,
        status: "active",
        assigned_at: m.updated_at || m.created_at || new Date().toISOString(),
        created_at: m.created_at || new Date().toISOString(),
        machine: {
          id: m.id,
          machine_id: code,
          machine_code: code,
          machine_name: m.model ? `${code} (${m.model})` : code,
          model: m.model,
          serial_number: m.serial_number,
          hour_meter: m.hour_meter,
          status: m.status,
        },
        operator: matchedOperator,
        assigner: m.current_supervisor || null,
      };
    });
}

/**
 * High-performance, tab-aware operations hub data loader.
 * Replaces direct inline database queries in operations/page.tsx.
 */
export const getOperationsHubData = cache(async (user: User, tab: string = "logs") => {
  const supabase = createSupabaseAdminClient();

  // 1. Operator Entry Tab: Only fetch operator assignment + recent logs
  if (user.role === "operator" || tab === "entry" || tab === "history") {
    const [assignedMachineRes, recentLogsRes, clientsList, allMachinesRes] = await Promise.all([
      supabase
        .from("machines")
        .select("id, machine_id, model, serial_number, hour_meter, status, manufacturer, client_id, current_operator_id, operator_ids, current_supervisor_id, supervisor_ids, client:clients(id, code, company_name, address, city, state, phone)")
        .or(`current_operator_id.eq.${user.id},operator_ids.cs.{${user.id}}`)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("machine_hour_logs")
        .select(HOUR_LOG_PROJECTION)
        .eq("operator_id", user.id)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      getClients(undefined, true),
      getMachines({ pageSize: 1000 }),
    ]);

    if (recentLogsRes.error) {
      console.error("Error fetching operator recent logs:", recentLogsRes.error);
    }

    const formattedAssignedMachine = assignedMachineRes.data
      ? (() => {
          const m = assignedMachineRes.data as any;
          const code = m.machine_id || m.id;
          return {
            ...m,
            machine_id: code,
            machine_code: code,
            machine_name: m.model ? `${code} (${m.model})` : code,
          };
        })()
      : null;

    const formattedLogs = formatHourLogsData(recentLogsRes.data || []);

    return {
      machines: allMachinesRes.machines,
      dbClients: clientsList,
      operators: [],
      assignments: [],
      hourLogs: formattedLogs,
      siteMovements: [],
      operatorPayouts: [],
      assignedMachine: (formattedAssignedMachine as unknown as Machine) || null,
      recentLogs: formattedLogs as unknown as OperatorHourLog[],
      allMachines: allMachinesRes.machines as unknown as MachineWithEngineer[],
    };
  }

  // 2. Supervisor / Management Hub: Fetch active tab datasets in parallel
  const [
    machinesRes,
    clientsList,
    operatorsRes,
    hourLogsRes,
  ] = await Promise.all([
    getMachines({ pageSize: 1000 }),
    getClients(undefined, true),
    supabase
      .from("users")
      .select("id, full_name, email, phone, role, status")
      .eq("role", "operator")
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("machine_hour_logs")
      .select(HOUR_LOG_PROJECTION)
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (hourLogsRes.error) {
    console.error("Error fetching supervisor hour logs:", hourLogsRes.error);
  }

  const operatorsList = (operatorsRes.data || []) as User[];
  const formattedLogs = formatHourLogsData(hourLogsRes.data || []);
  const derivedAssignments = deriveAssignmentsFromMachines(machinesRes.machines, operatorsList);

  return {
    machines: machinesRes.machines,
    dbClients: clientsList,
    operators: operatorsList,
    assignments: derivedAssignments,
    hourLogs: formattedLogs,
    siteMovements: [],
    operatorPayouts: [],
    assignedMachine: null,
    recentLogs: [],
    allMachines: machinesRes.machines as unknown as MachineWithEngineer[],
  };
});

export const getOperatorEntryContext = cache(async (operatorId: string) => {
  const supabase = createSupabaseAdminClient();
  const { data: machine } = await supabase
    .from("machines")
    .select("id, machine_id, model, serial_number, hour_meter, status, manufacturer, client_id, current_operator_id, operator_ids, current_supervisor_id, supervisor_ids, client:clients(id, code, company_name, address, city, state, phone)")
    .or(`current_operator_id.eq.${operatorId},operator_ids.cs.{${operatorId}}`)
    .limit(1)
    .maybeSingle();

  return { assignedMachine: machine };
});
