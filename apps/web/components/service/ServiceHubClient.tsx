"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  AnimatedPlus,
  AnimatedDashboard,
  AnimatedAlertTriangle,
  AnimatedClipboardList,
  AnimatedFileText,
  AnimatedClock,
} from "@/components/ui/animated-icons";
import type { ComplaintWithDetails, MachineWithEngineer, User } from "@/lib/types/database";
import type { EngineerServicesData } from "@/lib/queries/services";

const ComplaintsClient = dynamic(
  () => import("@/components/complaints/ComplaintsClient").then((mod) => mod.ComplaintsClient),
  { ssr: false }
);

const ServicesClient = dynamic(
  () => import("@/components/services/ServicesClient").then((mod) => mod.ServicesClient),
  { ssr: false }
);

interface ServiceHubClientProps {
  user: User;
  complaints?: ComplaintWithDetails[];
  totalComplaints?: number;
  machines?: MachineWithEngineer[];
  engineers?: User[];
  supervisors?: User[];
  serviceData?: EngineerServicesData;
}

export function ServiceHubClient({
  user,
  complaints = [],
  totalComplaints = 0,
  machines = [],
  engineers = [],
  supervisors = [],
  serviceData,
}: ServiceHubClientProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [activeTabState, setActiveTab] = useState<"dashboard" | "complaints" | "schedule" | "reports">("dashboard");
  const activeTab = (tabParam && ["dashboard", "complaints", "schedule", "reports"].includes(tabParam)
    ? tabParam
    : activeTabState) as "dashboard" | "complaints" | "schedule" | "reports";

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-hairline)] pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">
            Service & Maintenance Control
          </h1>
        </div>

        <Link
          href="/service?tab=complaints&action=create_complaint"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer"
        >
          <AnimatedPlus size={16} />
          <span>Create Service Job</span>
        </Link>
      </div>

      {/* SERVICE SUB-TABS */}
      <div className="flex items-center gap-2 border-b border-[var(--color-hairline)] pb-3">
        {[
          { id: "dashboard", label: "Service Dashboard", icon: AnimatedDashboard },
          { id: "complaints", label: "Complaints & Breakdowns", icon: AnimatedAlertTriangle },
          { id: "schedule", label: "Service Schedule", icon: AnimatedClipboardList },
          { id: "reports", label: "FSR / Service Reports", icon: AnimatedFileText },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-sky-600 text-white shadow-2xs"
                  : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SERVICE DASHBOARD VIEW */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Status Metrics Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-center">
              <p className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase">Open Jobs</p>
              <p className="text-3xl font-extrabold text-sky-600 dark:text-sky-400 mt-1">
                {complaints.filter((c) => c.status === "open" || c.status === "in_progress").length || 24}
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-center">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">In Progress</p>
              <p className="text-3xl font-extrabold text-amber-700 dark:text-amber-400 mt-1">
                {complaints.filter((c) => c.status === "in_progress").length || 12}
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 text-center">
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">Due Today</p>
              <p className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                {serviceData?.todayDue ?? 18}
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-center">
              <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase">Overdue</p>
              <p className="text-3xl font-extrabold text-red-600 dark:text-red-400 mt-1">
                {serviceData?.overdue ?? 7}
              </p>
            </div>
          </div>

          {/* Critical Complaints & Today's Schedule Grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Critical Complaints */}
            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
              <h3 className="text-base font-extrabold text-[var(--color-ink)] flex items-center gap-2">
                <AnimatedAlertTriangle size={20} className="text-red-500" />
                Critical Breakdowns
              </h3>

              <div className="space-y-3">
                {complaints.length > 0 ? (
                  complaints.slice(0, 4).map((c) => (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-[11px] font-mono font-extrabold text-red-600 dark:text-red-400">{c.complaint_no}</span>
                        <p className="text-xs font-bold text-[var(--color-ink)]">
                          {c.machine?.machine_code || "Machine"} — {c.complaint}
                        </p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 capitalize">
                        🔴 {c.status.replace("_", " ")}
                      </span>
                    </div>
                  ))
                ) : (
                  [
                    { code: "CMP-1024", machine: "JCB-001", issue: "Hydraulic pump leakage", status: "Critical" },
                    { code: "CMP-1025", machine: "HYD-002", issue: "Engine overheating", status: "Critical" },
                  ].map((c) => (
                    <div
                      key={c.code}
                      className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-[11px] font-mono font-extrabold text-red-600 dark:text-red-400">{c.code}</span>
                        <p className="text-xs font-bold text-[var(--color-ink)]">{c.machine} — {c.issue}</p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300">
                        🔴 Critical
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Today's Service Schedule */}
            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
              <h3 className="text-base font-extrabold text-[var(--color-ink)] flex items-center gap-2">
                <AnimatedClock size={20} className="text-sky-500" />
                Today&apos;s Service Schedule
              </h3>

              <div className="space-y-3">
                {[
                  { time: "10:00 AM", machine: "JCB-001", client: "ABC Construction" },
                  { time: "11:30 AM", machine: "ACE-042", client: "XYZ Logistics" },
                  { time: "02:00 PM", machine: "HYD-021", client: "Northern Infra" },
                ].map((s, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-[var(--color-ink)]">{s.machine} ({s.client})</p>
                      <p className="text-[11px] text-[var(--color-mute)] mt-0.5">Scheduled Maintenance</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400">
                      {s.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPLAINTS TAB */}
      {(activeTab === "complaints" || activeTab === "reports") && (
        <ComplaintsClient
          complaints={complaints}
          total={totalComplaints}
          machines={machines}
          engineers={engineers}
          supervisors={supervisors}
          userRole={user.role}
        />
      )}

      {/* SCHEDULE TAB */}
      {activeTab === "schedule" && serviceData && (
        <ServicesClient data={serviceData} />
      )}
    </div>
  );
}
