import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { DashboardShell } from "@/components/dashboard/shared";
import { SuperAdminDashboardView } from "@/components/dashboard/super-admin/SuperAdminDashboardView";
import { AdminDashboardView } from "@/components/dashboard/admin/AdminDashboardView";
import { ManagerDashboardView } from "@/components/dashboard/manager/ManagerDashboardView";
import { SupervisorDashboardView } from "@/components/dashboard/supervisor/SupervisorDashboardView";
import { HRDashboardView } from "@/components/dashboard/hr/HRDashboardView";
import { OperatorDashboardView } from "@/components/dashboard/operator/OperatorDashboardView";
import type { DashboardRole } from "@reachinternational/types";

export const metadata: Metadata = {
  title: "Dashboard | ReachInternational",
  description: "Role-specific operational dashboard and machinery telemetry.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.status && user.status !== "active") {
    redirect("/login?reason=inactive");
  }

  const role = (user.role?.toLowerCase() || "operator") as DashboardRole;

  return (
    <DashboardShell>
      {role === "super_admin" && (
        <SuperAdminDashboardView userId={user.id} userName={user.full_name} />
      )}
      {role === "admin" && (
        <AdminDashboardView userId={user.id} userName={user.full_name} />
      )}
      {role === "manager" && (
        <ManagerDashboardView userId={user.id} userName={user.full_name} />
      )}
      {role === "supervisor" && (
        <SupervisorDashboardView userId={user.id} userName={user.full_name} />
      )}
      {role === "hr" && (
        <HRDashboardView userId={user.id} userName={user.full_name} />
      )}
      {role === "operator" && (
        <OperatorDashboardView userId={user.id} userName={user.full_name} />
      )}
      {!["super_admin", "admin", "manager", "supervisor", "hr", "operator"].includes(role) && (
        <OperatorDashboardView userId={user.id} userName={user.full_name} />
      )}
    </DashboardShell>
  );
}