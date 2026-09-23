import React from "react";
import { getManagerDashboard } from "@/lib/data/dashboard";
import {
  DashboardHeader,
  KPIGrid,
  KPICard,
  AlertWidget,
  PrimaryAction,
} from "../shared";
import {
  Wrench,
  Gauge,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  FileSpreadsheet,
} from "lucide-react";

interface ManagerDashboardViewProps {
  userId: string;
  userName: string;
}

export async function ManagerDashboardView({
  userId,
  userName,
}: ManagerDashboardViewProps) {
  const data = await getManagerDashboard(userId);
  const totalFleet = data?.machineUtilization?.total ?? 0;
  const rentedFleet = data?.machineUtilization?.rented ?? 0;
  const spareFleet = data?.machineUtilization?.spare ?? 0;
  const breakdownFleet = data?.machineUtilization?.breakdown ?? 0;
  const activeAssignments = data?.activeAssignments ?? 0;
  const todayLogs = data?.operationsToday?.totalLogs ?? 0;
  const todayHours = data?.operationsToday?.totalHours ?? 0;
  const alerts = data?.alerts ?? [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <DashboardHeader
        userName={userName}
        role="manager"
      />

      {/* Critical & Operational Alerts */}
      <AlertWidget alerts={alerts} />

      {/* Fleet Utilization KPIs */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-3">
          Fleet Utilization Breakdown
        </h2>
        <KPIGrid columns={5}>
          <KPICard
            label="Total Fleet"
            value={totalFleet}
            icon={Wrench}
            href="/machines"
            variant="default"
          />
          <KPICard
            label="On Commercial Rent"
            value={rentedFleet}
            icon={CheckCircle2}
            href="/machines"
            variant="success"
            subtitle="Generating site revenue"
          />
          <KPICard
            label="Active Shifts"
            value={activeAssignments}
            icon={Layers}
            href="/operations"
            variant="info"
            subtitle="Operators assigned"
          />
          <KPICard
            label="Spare / Idle"
            value={spareFleet}
            icon={Clock}
            href="/machines"
            variant="warning"
            subtitle="Available for deployment"
          />
          <KPICard
            label="Breakdowns"
            value={breakdownFleet}
            icon={AlertTriangle}
            href="/machines"
            variant={breakdownFleet > 0 ? "error" : "default"}
            subtitle={breakdownFleet > 0 ? "Needs repair" : "None"}
          />
        </KPIGrid>
      </div>

      {/* Today's Operational Running Hours */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-3">
          Today&apos;s Production &amp; Running Meter
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
          <KPICard
            label="Total Logs Submitted Today"
            value={todayLogs}
            icon={FileSpreadsheet}
            href="/operations"
            variant="default"
            subtitle="Daily running log reports received"
          />
          <KPICard
            label="Total Running Hours Today"
            value={`${todayHours.toFixed(1)} hrs`}
            icon={Gauge}
            href="/operations"
            variant="info"
            subtitle="Aggregated engine runtime today"
          />
        </div>
      </div>

      {/* Primary Management Actions */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-3">
          Operations Management
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
          <PrimaryAction
            title="Daily Operations Review"
            description="Examine shift logs, running hours, and site location records"
            href="/operations"
            icon={FileSpreadsheet}
            variant="primary"
          />
          <PrimaryAction
            title="Machinery Fleet Roster"
            description="Reassign equipment, update rental status, and track maintenance"
            href="/machines"
            icon={Wrench}
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
}
