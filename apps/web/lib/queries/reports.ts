import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, requireRole } from "@/lib/dal";
import type { User } from "@/lib/types/database";

export interface ReportFilterParams {
  startDate: string;
  endDate: string;
  machineId?: string;
  clientId?: string;
  operatorId?: string;
  status?: string;
}

export interface MachineReportRow {
  id: string;
  logDate: string;
  machineCode: string;
  machineModel: string;
  clientName: string;
  operatorName: string;
  startMeter: number;
  endMeter: number;
  runningHours: number;
  overtimeHours: number;
  normalWorkingHours: number;
  isBreakdown: boolean;
  status: string;
}

/**
 * Dedicated server-only report DAL loader.
 * Completely decoupled from interactive UI queries with strict date bounds and explicit projections.
 */
export async function getOperationsReportData(
  user: User,
  filters: ReportFilterParams
): Promise<{ rows: MachineReportRow[]; totalHours: number; totalOvertime: number; error?: string }> {
  // 1. Authorization: Only authenticated staff can generate reports
  if (!["admin", "super_admin", "supervisor", "service_manager"].includes(user.role)) {
    return { rows: [], totalHours: 0, totalOvertime: 0, error: "Unauthorized for report generation" };
  }

  // 2. Validate date boundaries (Max 365 days to prevent database memory exhaustion)
  const start = new Date(filters.startDate);
  const end = new Date(filters.endDate);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (isNaN(diffDays) || diffDays < 0) {
    return { rows: [], totalHours: 0, totalOvertime: 0, error: "Invalid date range" };
  }

  if (diffDays > 366) {
    return { rows: [], totalHours: 0, totalOvertime: 0, error: "Report date range cannot exceed 12 months" };
  }

  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("machine_hour_logs")
    .select(`
      id,
      log_date,
      start_meter,
      end_meter,
      running_hours,
      overtime_hours,
      normal_working_hours,
      is_breakdown,
      machine:machines!machine_hour_logs_machine_id_fkey(id, machine_id, model, serial_number),
      client:clients!machine_hour_logs_client_id_fkey(id, client_name),
      operator:users!machine_hour_logs_operator_id_fkey(id, full_name)
    `)
    .gte("log_date", filters.startDate)
    .lte("log_date", filters.endDate)
    .order("log_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(10000);

  if (filters.machineId && filters.machineId !== "all") {
    query = query.eq("machine_id", filters.machineId);
  }
  if (filters.clientId && filters.clientId !== "all") {
    query = query.eq("client_id", filters.clientId);
  }
  if (filters.operatorId && filters.operatorId !== "all") {
    query = query.eq("operator_id", filters.operatorId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Error retrieving operations report data:", error);
    return { rows: [], totalHours: 0, totalOvertime: 0, error: "Failed to generate report data" };
  }

  let totalHours = 0;
  let totalOvertime = 0;

  const rows: MachineReportRow[] = data.map((item: any) => {
    const startM = Number(item.start_meter) || 0;
    const endM = Number(item.end_meter) || startM;
    const running = item.running_hours !== undefined && item.running_hours !== null
      ? Number(item.running_hours)
      : Math.max(0, endM - startM);
    const ot = Number(item.overtime_hours) || 0;
    const normal = item.normal_working_hours !== undefined && item.normal_working_hours !== null
      ? Number(item.normal_working_hours)
      : Math.max(0, running - ot - 1.0);

    totalHours += running;
    totalOvertime += ot;

    const mCode = item.machine?.machine_id || item.machine?.id || "—";

    return {
      id: item.id,
      logDate: item.log_date,
      machineCode: mCode,
      machineModel: item.machine?.model || "—",
      clientName: item.client?.client_name || "Unassigned Client",
      operatorName: item.operator?.full_name || "Unassigned Operator",
      startMeter: startM,
      endMeter: endM,
      runningHours: running,
      overtimeHours: ot,
      normalWorkingHours: normal,
      isBreakdown: item.is_breakdown || false,
      status: item.status || "submitted",
    };
  });

  return {
    rows,
    totalHours: Math.round(totalHours * 10) / 10,
    totalOvertime: Math.round(totalOvertime * 10) / 10,
  };
}
