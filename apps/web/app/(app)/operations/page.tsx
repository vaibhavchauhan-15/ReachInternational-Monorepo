import { requirePermission, getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { getMachines } from "@/lib/queries/machines";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { OperationsClient } from "@/components/operations/OperationsClient";
import type { Machine, MachineWithEngineer } from "@/lib/types/database";
import type { OperatorHourLog } from "@/components/dashboard/OperatorDashboard";

export default async function OperationsPage(props: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  await requirePermission("machine.view");
  const user = await getCurrentUser();
  const searchParams = await props.searchParams;
  const tab = searchParams?.tab;

  if (user?.role === "operator" && tab !== "entry" && tab !== "history") {
    redirect("/operations?tab=entry");
  }

  if (user?.role !== "operator" && (tab === "entry" || tab === "history" || tab === "machines" || !tab || !["logs", "assignments", "site-movement", "operators"].includes(tab))) {
    redirect("/operations?tab=logs");
  }
  const supabase = createSupabaseAdminClient();

  let operatorLogsQuery = supabase
    .from("machine_hour_logs")
    .select("*, machine:machines(id, machine_id, model, serial_number)")
    .order("log_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (user?.role === "operator") {
    operatorLogsQuery = operatorLogsQuery.eq("operator_id", user.id);
  }

  const [
    machinesRes,
    { data: operators },
    { data: assignments },
    { data: hourLogs },
    { data: siteMovements },
    { data: operatorPayouts },
    assignedMachineRes,
    recentOperatorLogsRes,
    activeMachinesRes,
  ] = await Promise.all([
    getMachines(),
    supabase.from("users").select("*").in("role", ["operator", "mechanic", "supervisor", "service_engineer"]),
    supabase
      .from("machine_assignments")
      .select("*, machine:machines(id, machine_id, model, serial_number), operator:users!operator_id(id, full_name, phone, email), assigner:users!assigned_by(id, full_name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("machine_hour_logs")
      .select("*, machine:machines(id, machine_id, model, serial_number), operator:users!operator_id(id, full_name, phone, email)")
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("machine_site_movements")
      .select("*, machine:machines(id, machine_id, model), operator:users!operator_id(id, full_name)")
      .order("movement_date", { ascending: false })
      .limit(100),
    supabase
      .from("operator_payouts")
      .select("*, operator:users!operator_id(id, full_name, phone)")
      .order("created_at", { ascending: false })
      .limit(100),
    user?.role === "operator"
      ? supabase.from("machines").select("*").eq("current_operator_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    operatorLogsQuery,
    supabase.from("machines").select("*").order("machine_id", { ascending: true }).limit(100),
  ]);

  return (
    <div className="p-4 sm:p-6">
      <OperationsClient
        machines={machinesRes.machines}
        operators={operators || []}
        assignments={assignments || []}
        hourLogs={hourLogs || []}
        siteMovements={siteMovements || []}
        operatorPayouts={operatorPayouts || []}
        userRole={user?.role}
        user={user!}
        assignedMachine={(assignedMachineRes?.data as unknown as Machine) || null}
        recentLogs={(recentOperatorLogsRes?.data as unknown as OperatorHourLog[]) || []}
        allMachines={(activeMachinesRes?.data as unknown as MachineWithEngineer[]) || []}
        initialTab={tab}
      />
    </div>
  );
}


