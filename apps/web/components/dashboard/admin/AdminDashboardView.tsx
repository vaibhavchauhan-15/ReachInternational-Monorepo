import React from "react";
import { getAdminDashboard } from "@/lib/data/dashboard";
import {
  DashboardHeader,
  KPIGrid,
  KPICard,
  AlertWidget,
  PrimaryAction,
} from "../shared";
import {
  Wrench,
  Users,
  Building2,
  CalendarCheck,
  Clock,
  AlertTriangle,
  Timer,
  FileSpreadsheet,
  Layers,
} from "lucide-react";

interface AdminDashboardViewProps {
  userId: string;
  userName: string;
}

export async function AdminDashboardView({
  userId,
  userName,
}: AdminDashboardViewProps) {
  const data = await getAdminDashboard(userId);
  const totalMachines = data?.totalMachines ?? 0;
  const activeUsers = data?.activeUsers ?? 0;
  const totalClients = data?.totalClients ?? 0;
  const activeAssignments = data?.activeAssignments ?? 0;
  const todayLogs = data?.todayLogs ?? 0;
  const breakdowns = data?.operationalKpis?.breakdowns ?? 0;
  const overtime = data?.operationalKpis?.overtimeEntries ?? 0;
  const overlappingLogs = data?.operationalKpis?.overlappingLogs ?? 0;
  const alerts = data?.alerts ?? [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <DashboardHeader
        userName={userName}
        role="admin"
      />

      {/* Critical & Operational Alerts */}
      <AlertWidget alerts={alerts} />

      {/* Core Fleet & Organization KPIs */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-3">
          Fleet & Personnel Summary
        </h2>
        <KPIGrid columns={5}>
          <KPICard
            label="Total Machines"
            value={totalMachines}
            icon={Wrench}
            href="/machines"
            variant="info"
          />
          <KPICard
            label="Active Users"
            value={activeUsers}
            icon={Users}
            href="/users"
            variant="default"
          />
          <KPICard
            label="Clients"
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
        </KPIGrid>
      </div>

      {/* Operational Telemetry & Exceptions */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-3">
          Today&apos;s Operational Exceptions
        </h2>
        <KPIGrid columns={3}>
          <KPICard
            label="Breakdowns Reported"
            value={breakdowns}
            icon={AlertTriangle}
            href="/operations"
            variant={breakdowns > 0 ? "error" : "default"}
            subtitle={breakdowns > 0 ? "Immediate inspection required" : "Zero breakdown events"}
          />
          <KPICard
            label="Overtime Entries"
            value={overtime}
            icon={Timer}
            href="/operations"
            variant={overtime > 0 ? "warning" : "default"}
            subtitle="Shifts exceeding standard hours"
          />
          <KPICard
            label="Shift Schedule Conflicts"
            value={overlappingLogs}
            icon={Layers}
            href="/operations"
            variant={overlappingLogs > 0 ? "error" : "default"}
            subtitle="Timeline overlap flags"
          />
        </KPIGrid>
      </div>

      {/* Quick Action Navigation */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-3">
          Quick Management
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
          <PrimaryAction
            title="Operations Hub & Running Logs"
            description="Review daily operator submissions, meter readings, and client worksites"
            href="/operations"
            icon={FileSpreadsheet}
            variant="primary"
          />
          <PrimaryAction
            title="Machinery Fleet & Maintenance"
            description="Configure machine assignments, track hours, and update equipment status"
            href="/machines"
            icon={Wrench}
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
}
