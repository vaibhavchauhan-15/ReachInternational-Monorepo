import React from "react";
import { getSupervisorDashboard } from "@/lib/data/dashboard";
import {
  DashboardHeader,
  KPIGrid,
  KPICard,
  StatusCard,
  AlertWidget,
  PrimaryAction,
} from "../shared";
import {
  Wrench,
  Users,
  CheckCircle2,
  Clock,
  Timer,
  FileSpreadsheet,
} from "lucide-react";

interface SupervisorDashboardViewProps {
  userId: string;
  userName: string;
}

export async function SupervisorDashboardView({
  userId,
  userName,
}: SupervisorDashboardViewProps) {
  const data = await getSupervisorDashboard(userId);
  const submitted = data?.todayLogs?.submitted ?? 0;
  const pending = data?.todayLogs?.pending ?? 0;
  const assignedMachines = data?.assignedMachines ?? 0;
  const assignedOperators = data?.assignedOperators ?? 0;
  const breakdowns = data?.breakdowns ?? 0;
  const overtimeEntries = data?.overtimeEntries ?? 0;
  const alerts = data?.alerts ?? [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <DashboardHeader
        userName={userName}
        role="supervisor"
      />

      {/* Critical & Team Alerts */}
      <AlertWidget alerts={alerts} />

      {/* Team Scope & Shift Submissions */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-3">
          My Supervised Fleet & Team
        </h2>
        <KPIGrid columns={4}>
          <KPICard
            label="Supervised Machines"
            value={assignedMachines}
            icon={Wrench}
            href="/machines"
            variant="default"
          />
          <KPICard
            label="Field Operators"
            value={assignedOperators}
            icon={Users}
            href="/operations"
            variant="info"
          />
          <KPICard
            label="Logs Submitted Today"
            value={submitted}
            icon={CheckCircle2}
            href="/operations"
            variant="success"
            subtitle={`${submitted} of ${assignedOperators} received`}
          />
          <KPICard
            label="Submissions Pending"
            value={pending}
            icon={Clock}
            href="/operations"
            variant={pending > 0 ? "warning" : "default"}
            subtitle={pending > 0 ? "Awaiting operator entry" : "All logs submitted"}
          />
        </KPIGrid>
      </div>

      {/* Daily Field Exceptions */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-3">
          Field Exceptions & Shift Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
          <StatusCard
            title="Breakdown Incidents"
            status={breakdowns > 0 ? "warning" : "success"}
            label={breakdowns > 0 ? `${breakdowns} Breakdown Reported` : "Zero Breakdowns"}
            description={
              breakdowns > 0
                ? "Machinery downtime reported on site today. Review logs for repair details."
                : "All supervised machinery operating normally on site."
            }
          />
          <KPICard
            label="Overtime Shifts"
            value={overtimeEntries}
            icon={Timer}
            href="/operations"
            variant={overtimeEntries > 0 ? "info" : "default"}
            subtitle="Operators logging extended work hours"
          />
        </div>
      </div>

      {/* Supervisor Actions */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-3">
          Supervisor Field Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
          <PrimaryAction
            title="Review Daily Shift Logs"
            description="Examine operator entries, verify start/end meter readings, and approve logs"
            href="/operations"
            icon={FileSpreadsheet}
            variant="primary"
          />
          <PrimaryAction
            title="Supervised Machine Status"
            description="Check current machine health, worksite locations, and meter records"
            href="/machines"
            icon={Wrench}
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
}
