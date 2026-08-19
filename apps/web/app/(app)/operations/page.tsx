import { requirePermission, getCurrentUser } from "@/lib/dal";
import { getMachines } from "@/lib/queries/machines";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { OperationsClient } from "@/components/operations/OperationsClient";

export default async function OperationsPage() {
  await requirePermission("machine.view");
  const user = await getCurrentUser();
  const supabase = createSupabaseAdminClient();

  const [
    machinesRes,
    { data: operators },
    { data: assignments },
    { data: hourLogs },
    { data: siteMovements },
    { data: operatorPayouts },
  ] = await Promise.all([
    getMachines(),
    supabase.from("users").select("*").in("role", ["operator", "mechanic", "supervisor", "service_engineer"]),
    supabase
      .from("machine_assignments")
      .select("*, machine:machines(id, machine_name, machine_code, model, serial_number), operator:users!operator_id(id, full_name, phone, email), assigner:users!assigned_by(id, full_name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("machine_hour_logs")
      .select("*, machine:machines(id, machine_name, machine_code), operator:users!operator_id(id, full_name)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("machine_site_movements")
      .select("*, machine:machines(id, machine_name, machine_code), operator:users!operator_id(id, full_name)")
      .order("movement_date", { ascending: false })
      .limit(100),
    supabase
      .from("operator_payouts")
      .select("*, operator:users!operator_id(id, full_name, phone)")
      .order("created_at", { ascending: false })
      .limit(100),
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
      />
    </div>
  );
}

