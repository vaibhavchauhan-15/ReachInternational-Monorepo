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
  FileSpreadsheet,
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
  const alerts = data?.alerts ?? [];

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-7">
      <DashboardHeader
        userName={userName}
        role="admin"
      />

      {/* Critical & Operational Alerts */}
      <AlertWidget alerts={alerts} />

      {/* Core Fleet & Organization KPIs */}
      <div>
        <h2 className="text-xs font-semibold font-mono text-[var(--color-mute)] uppercase tracking-wider mb-2.5 sm:mb-3">
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

      {/* Quick Action Navigation */}
      <div>
        <h2 className="text-xs font-semibold font-mono text-[var(--color-mute)] uppercase tracking-wider mb-2.5 sm:mb-3">
          Quick Management
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5 lg:gap-4">
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
