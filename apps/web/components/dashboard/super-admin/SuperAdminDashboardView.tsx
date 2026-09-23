import React from "react";
import { getSuperAdminDashboard } from "@/lib/data/dashboard";
import {
  DashboardHeader,
  KPIGrid,
  KPICard,
  AlertWidget,
  PrimaryAction,
} from "../shared";
import {
  Users,
  Wrench,
  Building2,
  CalendarCheck,
  Clock,
  ShieldCheck,
  Shield,
  SlidersHorizontal,
} from "lucide-react";

interface SuperAdminDashboardViewProps {
  userId: string;
  userName: string;
}

export async function SuperAdminDashboardView({
  userId,
  userName,
}: SuperAdminDashboardViewProps) {
  const data = await getSuperAdminDashboard(userId);
  const totalUsers = data?.totalUsers ?? 0;
  const activeMachines = data?.activeMachines ?? 0;
  const totalClients = data?.totalClients ?? 0;
  const activeAssignments = data?.activeAssignments ?? 0;
  const todayLogs = data?.todayLogs ?? 0;
  const recentAuditActions = data?.recentAuditActions ?? 0;
  const alerts = data?.alerts ?? [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <DashboardHeader
        userName={userName}
        role="super_admin"
      />

      {/* Critical & Informational Alerts */}
      <AlertWidget alerts={alerts} />

      {/* Primary KPI Grid (6 metrics) */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-3">
          Platform Fleet & Identity Metrics
        </h2>
        <KPIGrid columns={6}>
          <KPICard
            label="Total Staff"
            value={totalUsers}
            icon={Users}
            href="/users"
            variant="default"
          />
          <KPICard
            label="Active Fleet"
            value={activeMachines}
            icon={Wrench}
            href="/machines"
            variant="info"
          />
          <KPICard
            label="Active Clients"
            value={totalClients}
            icon={Building2}
            href="/clients"
            variant="default"
          />
          <KPICard
            label="Active Shifts"
            value={activeAssignments}
            icon={CalendarCheck}
            href="/operations"
            variant="warning"
          />
          <KPICard
            label="Logs Today"
            value={todayLogs}
            icon={Clock}
            href="/operations"
            variant={todayLogs > 0 ? "success" : "default"}
          />
          <KPICard
            label="Audit Events"
            value={recentAuditActions}
            icon={ShieldCheck}
            href="/audit"
            variant="default"
          />
        </KPIGrid>
      </div>

      {/* Quick Governance Actions */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-3">
          Governance & System Controls
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
          <PrimaryAction
            title="System Audit Trail"
            description="Inspect recent administrative mutations and security events"
            href="/audit"
            icon={Shield}
            variant="primary"
          />
          <PrimaryAction
            title="User & Access Directory"
            description="Manage administrative roles, supervisor scopes, and operators"
            href="/users"
            icon={Users}
            variant="secondary"
          />
          <PrimaryAction
            title="Machinery Fleet Registry"
            description="Global view of all equipment, client sites, and telemetry"
            href="/machines"
            icon={SlidersHorizontal}
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
}
