"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatedPlus,
  AnimatedUsers,
  AnimatedWrench,
  AnimatedAlertTriangle,
  AnimatedClipboardList,
  AnimatedFileText,
  AnimatedPackage,
  AnimatedX,
} from "@/components/ui/animated-icons";
import { motion, AnimatePresence } from "framer-motion";
import type { UserRole } from "@/lib/types/database";

interface GlobalCreateModalProps {
  userRole: UserRole;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  href: string;
  roles?: UserRole[];
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "client",
    title: "New Client",
    description: "Register a new client profile & billing contact",
    icon: AnimatedUsers,
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    href: "/crm?action=create_client",
    roles: ["super_admin", "admin", "branch_manager", "sales_executive"],
  },
  {
    id: "machine",
    title: "New Machine",
    description: "Add equipment unit to inventory directory",
    icon: AnimatedWrench,
    color: "text-sky-500 bg-sky-500/10 border-sky-500/20",
    href: "/machines?action=create",
    roles: ["super_admin", "admin", "branch_manager", "rental_manager"],
  },
  {
    id: "complaint",
    title: "Report Breakdown",
    description: "Log machine malfunction complaint",
    icon: AnimatedAlertTriangle,
    color: "text-red-500 bg-red-500/10 border-red-500/20",
    href: "/service?tab=complaints&action=create_complaint",
    roles: ["super_admin", "admin", "branch_manager", "service_engineer", "supervisor", "mechanic"],
  },
  {
    id: "service",
    title: "Service Job",
    description: "Schedule maintenance or field inspection",
    icon: AnimatedClipboardList,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    href: "/service?action=create_service",
    roles: ["super_admin", "admin", "branch_manager", "service_engineer"],
  },
  {
    id: "po",
    title: "Purchase Order",
    description: "Generate PO for spare parts or vendor supplies",
    icon: AnimatedFileText,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    href: "/purchase-orders?action=create_po",
    roles: ["super_admin", "admin", "branch_manager", "store_manager", "finance_manager"],
  },
  {
    id: "challan",
    title: "Delivery Challan",
    description: "Issue dispatch document for machine or parts",
    icon: AnimatedPackage,
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    href: "/challans?action=create_challan",
    roles: ["super_admin", "admin", "branch_manager", "store_manager"],
  },
  {
    id: "inventory",
    title: "Stock Transaction",
    description: "Record stock in, stock issue, or transfer",
    icon: AnimatedPackage,
    color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
    href: "/inventory?action=create_transaction",
    roles: ["super_admin", "admin", "branch_manager", "store_manager"],
  },
  {
    id: "document",
    title: "Upload Document",
    description: "Attach insurance, certificate, or invoice",
    icon: AnimatedFileText,
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    href: "/documents?action=upload",
    roles: ["super_admin", "admin", "branch_manager", "hr_manager", "service_engineer", "store_manager"],
  },
];

export function GlobalCreateModal({ userRole }: GlobalCreateModalProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const availableActions = QUICK_ACTIONS.filter(
    (action) => !action.roles || action.roles.includes(userRole)
  );

  if (availableActions.length === 0) {
    return null;
  }

  const handleSelectAction = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
      >
        <AnimatedPlus size={16} className="shrink-0" />
        <span className="hidden sm:inline">Create</span>
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
              className="relative z-10 w-full max-w-xl rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-5 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-3 mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[var(--color-ink)]">
                    Create New Resource
                  </h3>
                  <p className="text-xs text-[var(--color-mute)] mt-0.5">
                    Select a primary action to initiate work
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                >
                  <AnimatedX size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[65vh] overflow-y-auto pr-1 no-scrollbar">
                {availableActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleSelectAction(action.href)}
                      className="flex items-start gap-3 p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-sky-500/40 hover:bg-sky-500/5 transition-all text-left group cursor-pointer"
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${action.color} transition-transform group-hover:scale-105`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[var(--color-ink)] group-hover:text-sky-600 dark:group-hover:text-sky-400 truncate">
                          {action.title}
                        </p>
                        <p className="text-[11px] text-[var(--color-mute)] leading-tight mt-0.5 line-clamp-2">
                          {action.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
