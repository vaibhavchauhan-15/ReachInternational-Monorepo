import React from "react";
import { getOperatorDashboard } from "@/lib/data/dashboard";
import type { DashboardAlert } from "@reachinternational/types";
import {
  DashboardHeader,
  StatusCard,
  AlertWidget,
} from "../shared";
import { Card } from "@/components/ui/Card";
import {
  Wrench,
  Building2,
  Gauge,
  Clock,
  MapPin,
} from "lucide-react";

interface OperatorDashboardViewProps {
  userId: string;
  userName: string;
}

export async function OperatorDashboardView({
  userId,
  userName,
}: OperatorDashboardViewProps) {
  const data = await getOperatorDashboard(userId);
  const isSubmitted = data?.today?.entryStatus === "submitted";

  // Build single consolidated operator alert: yellow warning before submission, light green success after submission
  const otherAlerts = (data?.alerts ?? []).filter(
    (a) => a.id !== "entry-pending" && a.id !== "entry-submitted"
  );
  const statusAlert: DashboardAlert = isSubmitted
    ? {
        id: "entry-submitted",
        severity: "success",
        title: "Today's Log Submitted",
        description:
          "Daily shift running hours are recorded. Click to view or update your log.",
        actionUrl: "/operations?tab=history",
      }
    : {
        id: "entry-pending",
        severity: "warning",
        title: "Today's Log Pending",
        description: "Daily running hours have not been submitted for today.",
        actionUrl: "/operations?tab=entry",
      };
  const alerts: DashboardAlert[] = [statusAlert, ...otherAlerts];

  return (
    <div className="space-y-6 sm:space-y-8">
      <DashboardHeader
        userName={userName}
        role="operator"
      />

      {/* Operator Alert (Single Consolidated Alert: Yellow when pending, Light Green when submitted) */}
      <AlertWidget alerts={alerts} />

      {/* Today's Status & Meter Readings */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-3">
          Today&apos;s Shift Status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <StatusCard
            title="Log Submission Status"
            status={isSubmitted ? "success" : "pending"}
            label={isSubmitted ? "Submitted Today" : "Pending Submission"}
            description={
              isSubmitted
                ? "Shift log for today is safely recorded in the fleet database."
                : "Remember to submit before the end of your shift."
            }
          />
          <Card
            padding="none"
            className="relative overflow-hidden p-3.5 sm:p-4 md:p-5 flex items-start justify-between gap-3 border border-[var(--color-hairline)] bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface)] to-[var(--color-canvas)] rounded-[var(--radius-md)]"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-slate-400/40 via-slate-400/20 to-transparent rounded-t-[var(--radius-md)]" />
            <div className="space-y-1.5">
              <p className="text-[11px] sm:text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider">
                Last Recorded Meter (HMR)
              </p>
              <div className="flex items-center gap-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/15 shrink-0">
                  <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--color-mute)]" />
                </div>
                <span className="text-base sm:text-lg md:text-xl font-bold font-mono text-[var(--color-ink)]">
                  {data?.today?.lastHmr != null ? `${data.today.lastHmr.toFixed(1)} hrs` : "No prior logs"}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[var(--color-mute)] mt-1">
                Use as starting meter for your next log
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Assigned Equipment & Client Worksite */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-3">
          Equipment & Worksite Assignment
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
          {/* Machine Card */}
          <Card
            padding="none"
            className="relative overflow-hidden p-3.5 sm:p-4 md:p-5 space-y-3 border border-[var(--color-hairline)] bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface)] to-[var(--color-canvas)] rounded-[var(--radius-md)]"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-slate-400/40 via-slate-400/20 to-transparent rounded-t-[var(--radius-md)]" />
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-hairline)]">
              <div className="p-1.5 rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/15 shrink-0">
                <Wrench className="w-3.5 h-3.5 text-[var(--color-mute)]" />
              </div>
              <span className="text-xs font-semibold text-[var(--color-ink)] uppercase tracking-wider">
                Assigned Machine
              </span>
            </div>
            {data.machine ? (
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-mute)]">Model:</span>
                  <span className="font-bold text-[var(--color-ink)]">{data.machine.model || "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-mute)]">Machine ID:</span>
                  <span className="font-mono font-medium text-[var(--color-ink)]">{data.machine.name || "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-mute)]">Serial Number:</span>
                  <span className="font-mono text-[var(--color-mute)]">{data.machine.serialNumber || "—"}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-mute)] py-2">
                No active machine assigned. Contact your site supervisor.
              </p>
            )}
          </Card>

          {/* Client & Worksite Card */}
          <Card
            padding="none"
            className="relative overflow-hidden p-3.5 sm:p-4 md:p-5 space-y-3 border border-[var(--color-hairline)] bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface)] to-[var(--color-canvas)] rounded-[var(--radius-md)]"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-slate-400/40 via-slate-400/20 to-transparent rounded-t-[var(--radius-md)]" />
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-hairline)]">
              <div className="p-1.5 rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/15 shrink-0">
                <Building2 className="w-3.5 h-3.5 text-[var(--color-mute)]" />
              </div>
              <span className="text-xs font-semibold text-[var(--color-ink)] uppercase tracking-wider">
                Client & Location
              </span>
            </div>
            {data.client ? (
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-mute)]">Client:</span>
                  <span className="font-bold text-[var(--color-ink)] truncate max-w-[200px]">{data.client.name || "—"}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[var(--color-mute)] shrink-0 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Site:
                  </span>
                  <span className="text-[var(--color-ink)] text-right font-medium">{data.client.site || "—"}</span>
                </div>
                {(data.shift.start || data.shift.end) && (
                  <div className="flex justify-between items-center pt-1 border-t border-[var(--color-hairline)]">
                    <span className="text-[var(--color-mute)] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Shift:
                    </span>
                    <span className="font-mono text-[var(--color-ink)]">
                      {data.shift.start} – {data.shift.end}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-mute)] py-2">
                Client site will be determined by machine deployment.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
