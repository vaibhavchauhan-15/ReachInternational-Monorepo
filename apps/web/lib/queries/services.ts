import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import { CACHE_TAGS } from "@/lib/cache";
import type {
  MachineWithEngineer,
  ServiceRecordWithDetails,
} from "@/lib/types/database";

export interface EngineerServicesData {
  assignedMachines: MachineWithEngineer[];
  serviceHistory: ServiceRecordWithDetails[];
  totalMachines: number;
  activeMachines: number;
  todayDue: number;
  tomorrowDue: number;
  overdue: number;
  completedToday: number;
}

const getCachedEngineerServicesData = unstable_cache(
  async (userId: string, role: string): Promise<EngineerServicesData> => {
    const supabase = createSupabaseAdminClient();

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    let machinesQuery = supabase
      .from("machines")
      .select(
        `
        id,
        machine_code,
        machine_name,
        model,
        serial_number,
        category_id,
        category_name,
        hour_meter,
        service_count,
        customer_name,
        customer_mobile,
        city,
        state,
        engineer_id,
        last_service_date,
        next_service_due_date,
        service_interval_days,
        status,
        engineer:users!machines_engineer_id_fkey(id, full_name, phone)
      `,
        { count: "estimated" }
      )
      .order("next_service_due_date", { ascending: true });

    if (role === "engineer" || role === "service_engineer" || role === "mechanic") {
      machinesQuery = machinesQuery.eq("engineer_id", userId);
    } else if (role === "operator") {
      machinesQuery = machinesQuery.eq("current_operator_id", userId);
    }

    const { data: machines, count: totalMachines } = await machinesQuery;
    const assigned = (machines as unknown as MachineWithEngineer[]) ?? [];

    let historyQuery = supabase
      .from("service_records")
      .select(
        `
        id,
        machine_id,
        engineer_id,
        supervisor_id,
        service_date,
        service_category,
        service_status,
        service_due_date,
        service_completion_date,
        hour_meter,
        location,
        pdf_report_url,
        notes,
        next_service_due_date,
        machine:machines!service_records_machine_id_fkey(id, machine_code, machine_name, model, serial_number, customer_name, city, state),
        engineer:users!service_records_engineer_id_fkey(id, full_name, phone, email),
        supervisor:users!service_records_supervisor_id_fkey(id, full_name, phone, email)
      `
      )
      .order("service_date", { ascending: false })
      .limit(100);

    if (role === "engineer" || role === "service_engineer" || role === "mechanic") {
      historyQuery = historyQuery.eq("engineer_id", userId);
    } else if (role === "operator" && assigned.length > 0) {
      historyQuery = historyQuery.in("machine_id", assigned.map((m) => m.id));
    }

    const { data: serviceHistory } = await historyQuery;

    const activeMachines = assigned.filter((m) => m.status === "active" || m.status === "on_rent").length;
    const todayDue = assigned.filter(
      (m) => m.next_service_due_date === today
    ).length;
    const tomorrowDue = assigned.filter(
      (m) => m.next_service_due_date === tomorrow
    ).length;
    const overdue = assigned.filter(
      (m) => m.next_service_due_date ? m.next_service_due_date < today : false
    ).length;

    let completedTodayQuery = supabase
      .from("service_records")
      .select("id", { count: "exact", head: true })
      .eq("service_date", today);

    if (role === "engineer" || role === "service_engineer" || role === "mechanic") {
      completedTodayQuery = completedTodayQuery.eq("engineer_id", userId);
    } else if (role === "operator" && assigned.length > 0) {
      completedTodayQuery = completedTodayQuery.in("machine_id", assigned.map((m) => m.id));
    }

    const { count: completedToday } = await completedTodayQuery;

    return {
      assignedMachines: assigned,
      serviceHistory: (serviceHistory as unknown as ServiceRecordWithDetails[]) ?? [],
      totalMachines: totalMachines ?? 0,
      activeMachines,
      todayDue,
      tomorrowDue,
      overdue,
      completedToday: completedToday ?? 0,
    };
  },
  ["engineer-services-data-v2"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.services],
  }
);

export const getEngineerServicesData = cache(async (): Promise<EngineerServicesData> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return getCachedEngineerServicesData(user.id, user.role);
});