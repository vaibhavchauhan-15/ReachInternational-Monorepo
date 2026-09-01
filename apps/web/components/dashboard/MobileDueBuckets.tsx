"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  AnimatedCalendarClock,
  AnimatedAlertTriangle,
  AnimatedArrowRight,
} from "@/components/ui/animated-icons";
import { ArrowRight } from "lucide-react";

import { Card, Badge, SegmentedToggle } from "@/components/ui";

interface MachineItem {
  id: string;
  machine_code: string;
  customer_name: string;
}

interface MobileDueBucketsProps {
  isAdmin: boolean;
  todayDue: MachineItem[];
  tomorrowDue: MachineItem[];
  overdueMachines: MachineItem[];
}

type TabType = "overdue" | "today" | "tomorrow";

export function MobileDueBuckets({
  isAdmin,
  todayDue,
  tomorrowDue,
  overdueMachines,
}: MobileDueBucketsProps) {
  // Default to overdue tab if overdue items exist, else today
  const [activeTab, setActiveTab] = useState<TabType>(
    overdueMachines.length > 0 ? "overdue" : "today"
  );
  const reduceMotion = useReducedMotion();

  const tabs: {
    id: TabType;
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
    colorClass: string;
    activePillClass: string;
    badgeVariant: "overdue" | "today" | "tomorrow";
    emptyText: string;
    linksTo: string;
    items: MachineItem[];
  }[] = useMemo(
    () => [
      {
        id: "overdue" as TabType,
        label: "Overdue",
        count: overdueMachines.length,
        icon: AnimatedAlertTriangle,
        colorClass: "text-[var(--color-error-deep)] dark:text-[var(--color-error)]",
        activePillClass: "bg-[var(--color-error)]/10 border-[var(--color-error)]/30 text-[var(--color-error-deep)] dark:text-[var(--color-error)]",
        badgeVariant: "overdue",
        emptyText: "No overdue machines 🎉",
        linksTo: isAdmin ? "/machines?bucket=overdue" : "/services",
        items: overdueMachines,
      },
      {
        id: "today" as TabType,
        label: "Due Today",
        count: todayDue.length,
        icon: AnimatedCalendarClock,
        colorClass: "text-[var(--color-warning-deep)] dark:text-[var(--color-warning)]",
        activePillClass: "bg-[var(--color-warning)]/10 border-[var(--color-warning)]/30 text-[var(--color-warning-deep)] dark:text-[var(--color-warning)]",
        badgeVariant: "today",
        emptyText: "No machines due today",
        linksTo: isAdmin ? "/machines?bucket=today" : "/services",
        items: todayDue,
      },
      {
        id: "tomorrow" as TabType,
        label: "Tomorrow",
        count: tomorrowDue.length,
        icon: AnimatedCalendarClock,
        colorClass: "text-[var(--color-link-deep)] dark:text-[var(--color-link)]",
        activePillClass: "bg-[var(--color-link-soft)] border-[var(--color-link)]/30 text-[var(--color-link-deep)] dark:text-[var(--color-link)]",
        badgeVariant: "tomorrow",
        emptyText: "No machines due tomorrow",
        linksTo: isAdmin ? "/machines?bucket=tomorrow" : "/services",
        items: tomorrowDue,
      },
    ],
    [todayDue, tomorrowDue, overdueMachines, isAdmin]
  );

  const currentTabData = tabs.find((t) => t.id === activeTab)!;

  const renderItemList = useCallback(
    (
      items: MachineItem[],
      emptyText: string,
      linksTo: string
    ) => (
    items.length === 0 ? (
      <p className="body-sm text-muted-foreground py-8 text-center text-xs font-medium">
        {emptyText}
      </p>
    ) : (
      <div className="flex flex-col gap-2">
        {items.slice(0, 5).map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: reduceMotion ? 0 : i * 0.04 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href={`/machines/${m.id}`}
              className="flex items-center justify-between gap-2 p-3 rounded-xl border border-border bg-card hover:border-muted-foreground/40 transition-all group shadow-2xs"
            >
              <div className="flex flex-col min-w-0">
                <span className="body-sm text-foreground font-semibold truncate group-hover:text-primary transition-colors">
                  {m.machine_code}
                </span>
                <span className="body-sm text-muted-foreground text-xs truncate">
                  {m.customer_name}
                </span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground group-hover:text-foreground">
                <span className="text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  View
                </span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
            </Link>
          </motion.div>
        ))}
        {items.length > 5 && (
          <Link
            href={linksTo}
            className="body-sm font-semibold text-xs text-[var(--color-link-deep)] dark:text-[var(--color-link)] hover:underline mt-2 inline-flex items-center gap-1 justify-center py-1"
          >
            View all {items.length} machines →
          </Link>
        )}
      </div>
    )
  ),
  [reduceMotion]
);

  return (
    <div>
      {/* Mobile Tabbed View (< lg screens) */}
      <div className="block lg:hidden space-y-3">
        {/* Segmented Control Header */}
        <SegmentedToggle<TabType>
          value={activeTab}
          onChange={setActiveTab}
          layoutIdPrefix="mobile-due-buckets"
          fullWidth
          items={tabs.map((tab) => {
            const Icon = tab.icon;
            return {
              id: tab.id,
              label: tab.label,
              icon: <Icon className={`h-3.5 w-3.5 ${activeTab === tab.id ? tab.colorClass : "text-muted-foreground"}`} />,
              count: tab.count,
            };
          })}
        />

        {/* Dynamic Animated Content Container */}
        <Card padding="md" className="shadow-xs border border-border bg-card">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <currentTabData.icon className={`h-4 w-4 ${currentTabData.colorClass}`} />
                  <h3 className="label-sm text-foreground font-bold">
                    {currentTabData.label} Schedule
                  </h3>
                </div>
                <Badge variant={currentTabData.badgeVariant} dot>
                  {currentTabData.count}
                </Badge>
              </div>

              {renderItemList(
                currentTabData.items,
                currentTabData.emptyText,
                currentTabData.linksTo
              )}
            </motion.div>
          </AnimatePresence>
        </Card>
      </div>

      {/* Desktop Grid View (>= lg screens) */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-4">
        {tabs.map((tab) => (
          <Card key={tab.id} padding="md" className="hover:shadow-xs transition-shadow bg-card border border-border">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <tab.icon className={`h-4 w-4 ${tab.colorClass}`} />
                <h3 className="label-sm text-foreground font-semibold">
                  {tab.id === "tomorrow" ? "Due Tomorrow" : tab.label}
                </h3>
              </div>
              <Badge variant={tab.badgeVariant} dot>
                {tab.count}
              </Badge>
            </div>
            {renderItemList(tab.items, tab.emptyText, tab.linksTo)}
          </Card>
        ))}
      </div>
    </div>
  );
}
