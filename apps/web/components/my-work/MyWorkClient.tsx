"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AnimatedCheckCircle,
  AnimatedClock,
  AnimatedFileText,
  AnimatedGauge,
  AnimatedArrowRight,
  AnimatedShieldAlert,
  AnimatedCalendarClock,
  AnimatedWrench,
  AnimatedCheck,
} from "@/components/ui/animated-icons";
import { AlertTriangle, HardHat, Info } from "lucide-react";
import { motion } from "framer-motion";
import type { User } from "@/lib/types/database";
import type { MyWorkData, TaskItem } from "@/lib/queries/my-work";
import { roleHasPermission, PERMISSIONS } from "@/lib/auth/rbac";

interface MyWorkClientProps {
  user: User;
  initialData: MyWorkData;
}

export function MyWorkClient({ user, initialData }: MyWorkClientProps) {
  const isOperator = user.role === "operator";
  const isFieldStaff =
    user.role === "engineer" ||
    user.role === "service_engineer" ||
    user.role === "mechanic" ||
    user.role === "operator";

  const [meterInput, setMeterInput] = useState("");
  const [meterSuccess, setMeterSuccess] = useState(false);

  const canReportProblem = roleHasPermission(user.role, PERMISSIONS.COMPLAINT_CREATE);

  const tasks = initialData?.tasks ?? [];
  const assignedMachines = initialData?.assignedMachines ?? [];
  const primaryMachine = assignedMachines.length > 0 ? assignedMachines[0] : null;
  const metrics = initialData?.metrics ?? {
    urgentCount: 0,
    pendingCount: 0,
    dueTodayCount: 0,
    completedCount: 0,
  };

  const handleMeterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meterInput) return;
    setMeterSuccess(true);
    setTimeout(() => {
      setMeterSuccess(false);
      setMeterInput("");
    }, 3000);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* MORNING GREETING HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-hairline)] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
            Daily Operations Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">
            Good Morning, {user.full_name.split(" ")[0]} 👋
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-1">
            Here is your daily action queue for {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </p>
        </div>

        {/* Permission-Gated Action Button */}
        {canReportProblem && (
          <Link
            href="/service?tab=complaints&action=create_complaint"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer"
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Report Problem</span>
          </Link>
        )}
      </div>

      {/* URGENCY SCORECARD SUMMARY */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-300 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Urgent</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-red-600 dark:text-red-400 mt-1">{metrics.urgentCount}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <AnimatedShieldAlert size={20} className="text-red-600 dark:text-red-400" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Pending</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-700 dark:text-amber-400 mt-1">{metrics.pendingCount}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <AnimatedClock size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-700 dark:text-sky-300 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Due Today</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-sky-600 dark:text-sky-400 mt-1">{metrics.dueTodayCount}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20">
            <AnimatedCalendarClock size={20} className="text-sky-600 dark:text-sky-400" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Completed</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{metrics.completedCount}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <AnimatedCheckCircle size={20} className="text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
      </div>

      {/* FIELD STAFF ASSIGNED MACHINE VIEW */}
      {isFieldStaff && (
        <div className="p-5 sm:p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4 shadow-sm">
          {primaryMachine ? (
            <>
              <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-3">
                <div>
                  <h2 className="text-base font-extrabold text-[var(--color-ink)] flex items-center gap-2">
                    <AnimatedGauge size={20} className="text-sky-500" />
                    Assigned Machine Status
                  </h2>
                  <p className="text-xs text-[var(--color-mute)] mt-0.5">
                    {primaryMachine.machine_name || "Equipment"} • Code: {primaryMachine.machine_code} • Serial: {primaryMachine.serial_number || "N/A"}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                  primaryMachine.status === "active"
                    ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300"
                    : primaryMachine.status === "under_maintenance"
                    ? "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300"
                    : "bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300"
                }`}>
                  {primaryMachine.status === "active" ? "🟢 Operational" : primaryMachine.status === "under_maintenance" ? "⚠️ Under Maintenance" : primaryMachine.status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
                  <p className="text-xs font-medium text-[var(--color-mute)]">Current Meter Reading</p>
                  <p className="text-2xl font-extrabold text-[var(--color-ink)] mt-1">
                    {primaryMachine.hour_meter.toLocaleString("en-IN")} hrs
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
                  <p className="text-xs font-medium text-[var(--color-mute)]">Location & Customer</p>
                  <p className="text-sm font-extrabold text-sky-600 dark:text-sky-400 mt-1 truncate">
                    {primaryMachine.customer_name || "Company Yard"}
                  </p>
                  <p className="text-xs text-[var(--color-mute)] mt-0.5">
                    {primaryMachine.city || primaryMachine.state || "Site Yard"}
                  </p>
                </div>

                {isOperator ? (
                  <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
                    <form onSubmit={handleMeterSubmit} className="space-y-2">
                      <label className="text-xs font-bold text-[var(--color-ink)] block">Enter Today&apos;s Reading</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          placeholder={`e.g. ${(primaryMachine.hour_meter + 8).toFixed(1)}`}
                          value={meterInput}
                          onChange={(e) => setMeterInput(e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all cursor-pointer"
                        >
                          Submit
                        </button>
                      </div>
                      {meterSuccess && (
                        <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          ✓ Logged successfully!
                        </p>
                      )}
                    </form>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
                    <p className="text-xs font-medium text-[var(--color-mute)]">Next Service Due</p>
                    <p className="text-sm font-extrabold text-[var(--color-ink)] mt-1">
                      {primaryMachine.next_service_due_date || "Not Scheduled"}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 flex items-center gap-3">
              <Info className="h-5 w-5 text-sky-600 shrink-0" />
              <div>
                <p className="text-xs font-extrabold text-[var(--color-ink)]">No Specific Machine Assigned</p>
                <p className="text-xs text-[var(--color-mute)] mt-0.5">
                  You do not currently have a machine directly assigned to you. Contact your Service Manager for equipment allocation.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TODAY'S ACTIONABLE TASKS QUEUE */}
      <div className="p-5 sm:p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-3">
          <div>
            <h2 className="text-base font-extrabold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedFileText size={20} className="text-sky-500" />
              Actionable Work Items Today
            </h2>
            <p className="text-xs text-[var(--color-mute)] mt-0.5">
              Items requiring your direct action today
            </p>
          </div>
        </div>

        {tasks.length > 0 ? (
          <div className="space-y-3">
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                whileHover={{ x: 2 }}
                className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-sky-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {task.urgency === "urgent" && (
                    <span className="h-3 w-3 rounded-full bg-red-500 shrink-0 mt-1" title="Urgent" />
                  )}
                  {task.urgency === "pending" && (
                    <span className="h-3 w-3 rounded-full bg-amber-500 shrink-0 mt-1" title="Pending" />
                  )}
                  {task.urgency === "due_today" && (
                    <span className="h-3 w-3 rounded-full bg-sky-500 shrink-0 mt-1" title="Due Today" />
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono font-extrabold text-[var(--color-mute)] uppercase">
                        {task.code}
                      </span>
                      <span className="text-xs font-extrabold text-[var(--color-ink)] truncate">
                        {task.title}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-mute)] mt-0.5 truncate">
                      {task.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--color-hairline)]">
                  <span className="text-xs font-semibold text-[var(--color-mute)]">
                    {task.dueText}
                  </span>

                  <Link
                    href={task.actionHref}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    <span>{task.actionText}</span>
                    <AnimatedArrowRight size={14} />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] text-center space-y-2">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <AnimatedCheck size={20} />
            </div>
            <p className="text-sm font-extrabold text-[var(--color-ink)]">No Assigned Work Items Today</p>
            <p className="text-xs text-[var(--color-mute)] max-w-md mx-auto">
              All tasks, breakdown complaints, and maintenance schedules assigned to you are up to date.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
