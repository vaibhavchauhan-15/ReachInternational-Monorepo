"use client";

import { useMemo } from "react";
import {
  AnimatedActivity,
  AnimatedWrench,
  AnimatedUsers,
  AnimatedShieldAlert,
} from "@/components/ui/animated-icons";
import type { AuditLogWithUser } from "@/lib/types/database";
import type { AuditTabCounts } from "@/lib/queries/audit-logs";

interface AuditKpisProps {
  logs: AuditLogWithUser[];
  totalCount: number;
  tabCounts?: AuditTabCounts;
  activeTab?: string;
  activeSeverity?: string;
  onSelectTab?: (tab: string) => void;
  onFilterSeverity?: (severity: string) => void;
}

export function AuditKpis({
  logs,
  totalCount,
  tabCounts,
  activeTab,
  activeSeverity,
  onSelectTab,
  onFilterSeverity,
}: AuditKpisProps) {
  const metrics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let todayCount = 0;
    let machineCount = tabCounts?.machine ?? 0;
    let employeeCount = (tabCounts?.employees ?? 0) + (tabCounts?.auth ?? 0);
    let securityCount = 0;

    for (const log of logs) {
      const createdTime = new Date(log.created_at).getTime();
      if (createdTime >= todayStart) {
        todayCount++;
      }

      const sev = (log.severity || "").toLowerCase();
      const cat = (log.category || "").toLowerCase();
      const action = (log.action || "").toLowerCase();

      if (
        sev === "critical" ||
        cat === "security" ||
        action.startsWith("security.") ||
        action.includes("unauthorized") ||
        action.includes("violation")
      ) {
        securityCount++;
      }
    }

    return {
      todayCount,
      machineCount: tabCounts ? tabCounts.machine + tabCounts.assignments + tabCounts.rentals : machineCount,
      employeeCount: tabCounts ? tabCounts.employees + tabCounts.auth : employeeCount,
      securityCount,
    };
  }, [logs, tabCounts]);

  const cards = [
    {
      id: "all",
      label: "Total Logged Events",
      sublabel: `${metrics.todayCount} recorded today`,
      value: tabCounts?.all ?? totalCount,
      icon: AnimatedActivity,
      color: "var(--color-primary)",
      active: activeTab === "all",
      onClick: () => onSelectTab?.("all"),
    },
    {
      id: "machine",
      label: "Machine & Fleet Ops",
      sublabel: "Add, edit, status & hour meters",
      value: tabCounts?.machine ?? metrics.machineCount,
      icon: AnimatedWrench,
      color: "#059669",
      active: activeTab === "machine",
      onClick: () => onSelectTab?.("machine"),
    },
    {
      id: "assignments",
      label: "Operator & Supervisor Shifts",
      sublabel: "Assignments & supervisor links",
      value: tabCounts?.assignments ?? 0,
      icon: AnimatedUsers,
      color: "#0891b2",
      active: activeTab === "assignments",
      onClick: () => onSelectTab?.("assignments"),
    },
    {
      id: "employees",
      label: "Employees & Access",
      sublabel: "Approvals, roles & accounts",
      value: tabCounts?.employees ?? metrics.employeeCount,
      icon: AnimatedUsers,
      color: "#2563eb",
      active: activeTab === "employees",
      onClick: () => onSelectTab?.("employees"),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <button
            key={card.id}
            type="button"
            onClick={card.onClick}
            className={`flex flex-col text-left p-3.5 sm:p-4 rounded-[var(--radius-md)] border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
              card.active
                ? "bg-[var(--color-canvas-elevated)] border-[var(--color-primary)] shadow-sm ring-1 ring-[var(--color-primary)]"
                : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-canvas-subtle)]"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-xs font-medium text-[var(--color-subtle)] truncate">
                {card.label}
              </span>
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${card.color}14`, color: card.color }}
              >
                <IconComponent className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[var(--color-ink)]">
                {card.value.toLocaleString()}
              </span>
            </div>
            <span className="text-[11px] text-[var(--color-mute)] mt-1 truncate">
              {card.sublabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
