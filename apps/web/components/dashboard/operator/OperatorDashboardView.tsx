import React from "react";
import Link from "next/link";
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
  ArrowRight,
  Layers,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const isPartial = data?.today?.entryStatus === "partial";
  const submittedCount = data?.today?.submittedCount ?? 0;
  const totalAssignedCount = data?.today?.totalAssignedCount ?? (data?.assigned_shifts?.length || 1);
  const totalRunningHoursToday = data?.today?.totalRunningHoursToday ?? 0;

  // Build operator alert: yellow warning before submission, light green success after all shifts submitted
  const alerts = data?.alerts && data.alerts.length > 0
    ? data.alerts
    : [
        isSubmitted
          ? {
              id: "entry-submitted",
              severity: "success" as const,
              title: "Today's Shift Logs Submitted",
              description: `All assigned shifts (${totalRunningHoursToday}h total) are recorded for today.`,
              actionUrl: "/operations?tab=history",
            }
          : isPartial
          ? {
              id: "entry-partial",
              severity: "warning" as const,
              title: `${submittedCount} of ${totalAssignedCount} Shifts Logged`,
              description: `Recorded ${totalRunningHoursToday}h so far. Remember to submit remaining assigned shift(s).`,
              actionUrl: "/operations",
            }
          : {
              id: "entry-pending",
              severity: "warning" as const,
              title: "Today's Log Pending",
              description: "Daily running hours have not been submitted for today.",
              actionUrl: "/operations",
            },
      ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <DashboardHeader
        userName={userName}
        role="operator"
      />

      {/* Operator Alert (Yellow when pending/partial, Light Green when fully submitted) */}
      <AlertWidget alerts={alerts} />

      {/* Today's Status & Meter Readings */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-3">
          Today&apos;s Shift Status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <StatusCard
            title="Log Submission Status"
            status={isSubmitted ? "success" : isPartial ? "warning" : "pending"}
            label={
              isSubmitted
                ? totalAssignedCount > 1
                  ? `All ${totalAssignedCount} Shifts Submitted`
                  : "Submitted Today"
                : isPartial
                ? `${submittedCount}/${totalAssignedCount} Shifts Logged`
                : "Pending Submission"
            }
            description={
              isSubmitted
                ? `${totalRunningHoursToday}h recorded across assigned shift(s) today.`
                : isPartial
                ? `${submittedCount} of ${totalAssignedCount} shifts recorded (${totalRunningHoursToday}h). Ready to log remaining shift.`
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

      {/* Continuous Shift Coverage Tracker (Up to 3 Shifts / 24h) */}
      {data?.assigned_shifts && data.assigned_shifts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[var(--color-mute)]" />
              Shift Coverage ({submittedCount}/{totalAssignedCount})
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.assigned_shifts.map((s) => {
              const isLogged = s.is_logged_today;
              const shiftClean = s.code.replace(/^shift\s*/i, "").trim();
              const shiftCodeName = shiftClean ? `Shift ${shiftClean}` : s.code;

              return (
                <div
                  key={s.code}
                  className={cn(
                    "relative overflow-hidden rounded-[var(--radius-md)] border p-3.5 sm:p-4 flex flex-col justify-between transition-all",
                    isLogged
                      ? "bg-emerald-500/[0.03] border-emerald-500/25 dark:border-emerald-500/20"
                      : "bg-[var(--color-surface)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]/30"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs font-mono px-2 py-0.5 rounded bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                        {shiftCodeName}
                      </span>
                    </div>
                    {!isLogged && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono shrink-0">
                        Ready to Log
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 my-2 text-xs">
                    <div className="flex items-center justify-between text-[var(--color-mute)]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Timings:
                      </span>
                      <span className="font-mono text-[var(--color-ink)] font-medium">
                        {s.start_time} – {s.end_time} {s.crosses_midnight ? "🌙" : ""}
                      </span>
                    </div>
                    {isLogged && (
                      <div className="flex items-center justify-between text-[var(--color-mute)]">
                        <span className="flex items-center gap-1">
                          <Timer className="w-3 h-3" /> Machine RT :
                        </span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {s.running_hours_today != null
                            ? `${Number(s.running_hours_today.toFixed(1))}h`
                            : "0h"}
                        </span>
                      </div>
                    )}
                    {isLogged && s.end_meter_today != null && (
                      <div className="flex items-center justify-between text-[var(--color-mute)]">
                        <span className="flex items-center gap-1">
                          <Gauge className="w-3 h-3" /> End Meter:
                        </span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {s.end_meter_today.toFixed(1)} hrs
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[var(--color-hairline)]/50 mt-1">
                    {isLogged ? (
                      <Link
                        href={`/operations?tab=history&shift=${s.code}`}
                        className="text-xs font-semibold text-[var(--color-link)] hover:underline inline-flex items-center gap-1 min-h-[36px]"
                      >
                        View Shift Log <ArrowRight className="w-3 h-3" />
                      </Link>
                    ) : (
                      <Link
                        href={`/operations?shift=${s.code}`}
                        className="w-full text-center text-xs font-semibold px-3 py-2 rounded-lg bg-[var(--color-ink)] text-white hover:bg-[var(--color-ink)]/90 inline-flex items-center justify-center gap-1 min-h-[40px] transition-colors"
                      >
                        Log {shiftCodeName} <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
