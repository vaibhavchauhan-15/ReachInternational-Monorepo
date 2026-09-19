import React from "react";
import { getHRDashboard } from "@/lib/data/dashboard";
import {
  DashboardHeader,
  KPIGrid,
  KPICard,
  AlertWidget,
  PrimaryAction,
} from "../shared";
import {
  Users,
  UserCheck,
  FileEdit,
  Clock,
  UserPlus,
} from "lucide-react";

interface HRDashboardViewProps {
  userId: string;
  userName: string;
}

export async function HRDashboardView({
  userId,
  userName,
}: HRDashboardViewProps) {
  const data = await getHRDashboard(userId);
  const totalEmployees = data?.totalEmployees ?? 0;
  const activeOperators = data?.activeOperators ?? 0;
  const pendingProfileChanges = data?.pendingProfileChanges ?? 0;
  const todayLogsCount = data?.todayLogsCount ?? 0;
  const alerts = data?.alerts ?? [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <DashboardHeader
        userName={userName}
        role="hr"
      />

      {/* Profile Change & HR Alerts */}
      <AlertWidget alerts={alerts} />

      {/* Personnel Overview */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-3">
          Personnel & Operations Roster
        </h2>
        <KPIGrid columns={4}>
          <KPICard
            label="Total Active Staff"
            value={totalEmployees}
            icon={Users}
            href="/users"
            variant="default"
          />
          <KPICard
            label="Active Field Operators"
            value={activeOperators}
            icon={UserCheck}
            href="/users"
            variant="info"
            subtitle="Personnel deployed on site"
          />
          <KPICard
            label="Pending Profile Changes"
            value={pendingProfileChanges}
            icon={FileEdit}
            href="/users"
            variant={pendingProfileChanges > 0 ? "warning" : "default"}
            subtitle={
              pendingProfileChanges > 0
                ? "Awaiting HR verification"
                : "No pending requests"
            }
          />
          <KPICard
            label="Logs Recorded Today"
            value={todayLogsCount}
            icon={Clock}
            href="/operations?tab=logs"
            variant={todayLogsCount > 0 ? "success" : "default"}
            subtitle="Daily attendance indicator"
          />
        </KPIGrid>
      </div>

      {/* HR Actions */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-3">
          Personnel Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
          <PrimaryAction
            title="Profile Change Requests"
            description="Review and approve operator contact details, banking info, and document updates"
            href="/users"
            icon={FileEdit}
            variant={pendingProfileChanges > 0 ? "warning" : "primary"}
            badgeText={pendingProfileChanges > 0 ? `${pendingProfileChanges} Pending` : undefined}
          />
          <PrimaryAction
            title="Employee Directory"
            description="Manage employee profiles, shift schedules, and supervisor assignments"
            href="/users"
            icon={UserPlus}
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
}
