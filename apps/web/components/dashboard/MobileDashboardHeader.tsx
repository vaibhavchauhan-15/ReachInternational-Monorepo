"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AnimatedWrench,
  AnimatedAlertTriangle,
  AnimatedCalendarClock,
  AnimatedArrowRight,
  AnimatedSparkles,
} from "@/components/ui/animated-icons";
import { motion } from "framer-motion";
import { CommandPalette } from "@/components/ui/CommandPalette";

import type { UserRole } from "@/lib/types/database";

interface MobileDashboardHeaderProps {
  userName: string;
  userRole: UserRole;
  todayDueCount: number;
  overdueCount: number;
}

export function MobileDashboardHeader({
  userName,
  userRole,
  todayDueCount,
  overdueCount,
}: MobileDashboardHeaderProps) {
  const [cmdOpen, setCmdOpen] = useState(false);

  // Time of day greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Good morning", icon: AnimatedSparkles, color: "text-amber-500" };
    if (hour < 18) return { text: "Good afternoon", icon: AnimatedSparkles, color: "text-amber-400" };
    return { text: "Good evening", icon: AnimatedSparkles, color: "text-indigo-400" };
  }, []);

  const GreetingIcon = greeting.icon;
  const firstName = userName.split(" ")[0] || "User";
  const isAdmin = userRole === "super_admin" || userRole === "admin";

  return (
    <>
      <div className="flex flex-col gap-3.5 mb-1">
        {/* Top greeting bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted border border-border shadow-xs">
              <GreetingIcon size={20} className={greeting.color} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-muted-foreground">
                  {greeting.text},
                </span>
                <span className="text-sm font-bold text-foreground">
                  {firstName}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-normal truncate max-w-[220px] xs:max-w-[280px]">
                {isAdmin
                  ? "Fleet performance & service dashboard"
                  : "Your assigned service schedule"}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Chips on Mobile */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
          {overdueCount > 0 && (
            <motion.div whileTap={{ scale: 0.95 }}>
              <Link
                href={isAdmin ? "/machines?bucket=overdue" : "/services"}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold whitespace-nowrap shadow-2xs hover:bg-rose-500/20 transition-all"
              >
                <AnimatedAlertTriangle size={16} animation="bounce" />
                <span>{overdueCount} Overdue</span>
                <AnimatedArrowRight size={14} className="opacity-70" />
              </Link>
            </motion.div>
          )}

          {todayDueCount > 0 && (
            <motion.div whileTap={{ scale: 0.95 }}>
              <Link
                href={isAdmin ? "/machines?bucket=today" : "/services"}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold whitespace-nowrap shadow-2xs hover:bg-amber-500/20 transition-all"
              >
                <AnimatedCalendarClock size={16} />
                <span>{todayDueCount} Due Today</span>
                <AnimatedArrowRight size={14} className="opacity-70" />
              </Link>
            </motion.div>
          )}

          <motion.div whileTap={{ scale: 0.95 }}>
            <Link
              href={isAdmin ? "/machines" : "/services"}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-muted border border-border text-foreground text-xs font-semibold whitespace-nowrap shadow-2xs hover:border-muted-foreground/40 transition-all"
            >
              <AnimatedWrench size={16} className="text-muted-foreground" />
              <span>{isAdmin ? "Manage Fleet" : "My Schedule"}</span>
            </Link>
          </motion.div>
        </div>
      </div>

      <CommandPalette
        isOpen={cmdOpen}
        onClose={() => setCmdOpen(false)}
        userRole={userRole}
      />
    </>
  );
}
