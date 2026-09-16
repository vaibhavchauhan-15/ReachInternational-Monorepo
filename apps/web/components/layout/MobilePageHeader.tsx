"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  AnimatedArrowLeft,
  AnimatedSearch,
  AnimatedMoreVertical,
  AnimatedPlus,
  AnimatedEdit,
  AnimatedCheck,
  AnimatedUserCheck,
  AnimatedUserPlus,
  AnimatedFileSpreadsheet,
  AnimatedFileText,
  AnimatedPrinter,
} from "@/components/ui/animated-icons";

const CommandPalette = dynamic(
  () => import("@/components/ui/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false }
);

import { ScrollCloud } from "@/components/ui/ScrollCloud";
import { recordAppNavigation, popPreviousAppRoute } from "@/lib/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/logs": "Dashboard Logs",
  "/machines": "Machines",
  "/operations": "Operations",
  "/users": "Users",
  "/clients": "Clients",
  "/audit": "Audit Trail",
  "/audit-logs": "Audit Logs",
  "/branches": "Branches",
  "/challans": "Challans",
  "/documents": "Documents",
  "/purchase-orders": "Purchase Orders",
  "/reports": "Reports",
  "/settings": "Settings",
  "/vendors": "Vendors",
  "/administration": "Administration",
};

const DETAIL_TITLES: Record<string, string> = {
  machines: "Machine Details",
  vendors: "Vendor Details",
  "purchase-orders": "Purchase Order",
  audit: "Audit Details",
};

const ROOT_PAGES = new Set(["/dashboard"]);


function resolveTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && DETAIL_TITLES[segments[0]]) return DETAIL_TITLES[segments[0]];
  if (segments[0]) {
    return segments[0].charAt(0).toUpperCase() + segments[0].slice(1).replace(/-/g, " ");
  }
  return "Dashboard";
}

/**
 * Standard solid mobile top header on every page:
 * Flush edge-to-edge layout: Back arrow + page title + quick search + contextual add + 3-dot More menu.
 * Non-floating, zero-mist, adhering strictly to Geist design tokens.
 */
export function MobilePageHeader({ userRole }: { userRole?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const title = resolveTitle(pathname);
  const showBack = !ROOT_PAGES.has(pathname);
  const canAddMachine = pathname === "/machines" && userRole !== "supervisor" && userRole !== "operator";
  const canCreateUser = userRole !== "supervisor" && userRole !== "operator" && userRole !== "client";
  const canAddClient = pathname === "/clients" && canCreateUser;
  const isMachineDetail = pathname.startsWith("/machines/") && pathname.split("/").filter(Boolean).length === 2;
  const canEditMachine = isMachineDetail && userRole !== "operator" && userRole !== "client";

  useEffect(() => {
    setMoreOpen(false);
    const search = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    recordAppNavigation(pathname, search);
  }, [pathname]);

  const handleBack = () => {
    const prev = popPreviousAppRoute(pathname);
    router.push(prev);
  };

  const handleAdd = () => {
    if (pathname === "/machines") {
      window.dispatchEvent(new CustomEvent("reach:quick-add"));
    }
  };

  const handleAddUser = () => {
    window.dispatchEvent(new CustomEvent("reach:quick-add-user"));
    router.push("/users?action=create");
  };

  const handleAddClient = () => {
    window.dispatchEvent(new CustomEvent("reach:quick-add-client"));
    window.dispatchEvent(new CustomEvent("reach:quick-add"));
  };

  const handleAssign = () => {
    setMoreOpen(false);
    window.dispatchEvent(new CustomEvent("reach:quick-assign"));
  };

  const handleExport = (format: "excel" | "csv") => {
    setMoreOpen(false);
    if (format === "excel") {
      window.dispatchEvent(new CustomEvent("reach:quick-export-excel", { cancelable: true }));
      window.dispatchEvent(
        new CustomEvent("reach:quick-export", { cancelable: true, detail: { format: "excel" } })
      );
    } else {
      window.dispatchEvent(new CustomEvent("reach:quick-export-csv", { cancelable: true }));
      window.dispatchEvent(
        new CustomEvent("reach:quick-export", { cancelable: true, detail: { format: "csv" } })
      );
    }
  };

  const handlePrint = () => {
    setMoreOpen(false);
    const event = new CustomEvent("reach:quick-print", { cancelable: true });
    window.dispatchEvent(event);
    if (!event.defaultPrevented) {
      window.print();
    }
  };

  return (
    <>
      {/* Standard Solid Flush Mobile Header with Company Standard ScrollCloud Dissolve */}
      <div className="sticky top-0 z-40 md:hidden w-full print:hidden">
        <header className="relative z-10 w-full h-12 bg-[var(--color-canvas)]/90 backdrop-blur-md border-b border-[var(--color-hairline)] shadow-xs flex items-center px-3 gap-1.5 select-none transition-colors">
          {showBack ? (
            <button
              type="button"
              aria-label="Go back to previous page"
              title="Go back to previous page"
              onClick={handleBack}
              className="flex items-center justify-center h-8.5 w-8.5 rounded-lg text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)] active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <AnimatedArrowLeft size={18} />
            </button>
          ) : null}

          <h1 className="flex-1 min-w-0 truncate text-[15px] font-bold text-[var(--color-ink)] tracking-tight px-1">
            {title}
          </h1>

          <button
            type="button"
            aria-label="Quick Search"
            onClick={() => setCmdOpen(true)}
            className="flex items-center justify-center h-8.5 w-8.5 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)] active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <AnimatedSearch size={16} />
          </button>

          <button
            type="button"
            aria-label="More options"
            onClick={() => setMoreOpen((prev) => !prev)}
            className={`flex items-center justify-center h-8.5 w-8.5 rounded-lg transition-all cursor-pointer shrink-0 ${
              moreOpen
                ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)]"
                : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)]"
            } active:scale-95`}
          >
            <AnimatedMoreVertical size={16} />
          </button>
        </header>

        {/* Company Standard ScrollCloud Dissolve Effect */}
        <ScrollCloud height={24} intensity="subtle" />
      </div>

      {/* 3-Dot More Menu Backdrop */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setMoreOpen(false)} aria-hidden />
      )}

      {/* 3-Dot More Menu Dropdown Card */}
      {moreOpen && (
        <div className="md:hidden fixed right-3 top-[52px] z-50 w-52 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xl overflow-hidden py-1 divide-y divide-[var(--color-hairline)]">
          {/* Contextual Action */}
          {(canAddMachine || canAddClient || (pathname === "/users" && canCreateUser) || (pathname === "/operations" && userRole !== "operator")) && (
            <div className="py-0.5">
              {pathname === "/operations" && userRole !== "operator" && (
                <button
                  type="button"
                  onClick={handleAssign}
                  className="w-full flex items-center gap-2.5 px-3.5 h-10 text-[13px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer"
                >
                  <AnimatedUserCheck size={15} className="text-sky-500" />
                  <span>Assign Operator</span>
                </button>
              )}

              {canAddMachine && (
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    handleAdd();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 h-10 text-[13px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer"
                >
                  <AnimatedPlus size={15} className="text-emerald-500" />
                  <span>Add Machine</span>
                </button>
              )}

              {canAddClient && (
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    handleAddClient();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 h-10 text-[13px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer"
                >
                  <AnimatedUserPlus size={15} className="text-emerald-500" />
                  <span>Add Client</span>
                </button>
              )}

              {pathname === "/users" && canCreateUser && (
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    handleAddUser();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 h-10 text-[13px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer"
                >
                  <AnimatedUserPlus size={15} className="text-emerald-500" />
                  <span>Add User</span>
                </button>
              )}
            </div>
          )}

          {/* Machine Detail Dedicated Separate Edit Actions for Mobile Users */}
          {canEditMachine && (
            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  window.dispatchEvent(new CustomEvent("reach:edit-machine-info"));
                }}
                className="w-full flex items-center gap-2.5 px-3.5 h-10 text-[13px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer"
              >
                <AnimatedEdit size={15} className="text-amber-500 shrink-0" />
                <span>Edit Machine Info</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  window.dispatchEvent(new CustomEvent("reach:edit-machine-personnel"));
                }}
                className="w-full flex items-center gap-2.5 px-3.5 h-10 text-[13px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer"
              >
                <AnimatedUserCheck size={15} className="text-teal-600 dark:text-teal-400 shrink-0" />
                <span>Edit Shift Personnel</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  window.dispatchEvent(new CustomEvent("reach:edit-machine-client"));
                }}
                className="w-full flex items-center gap-2.5 px-3.5 h-10 text-[13px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer"
              >
                <AnimatedCheck size={15} className="text-sky-500 shrink-0" />
                <span>Edit Client Assignment</span>
              </button>
            </div>
          )}

          {/* Export Actions */}
          <div className="py-0.5">
            <button
              type="button"
              onClick={() => handleExport("excel")}
              className="w-full flex items-center gap-2.5 px-3.5 h-10 text-[13px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer"
            >
              <AnimatedFileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={() => handleExport("csv")}
              className="w-full flex items-center gap-2.5 px-3.5 h-10 text-[13px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer"
            >
              <AnimatedFileText size={15} className="text-sky-600 dark:text-sky-400 shrink-0" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Print / Report Action */}
          <div className="py-0.5">
            <button
              type="button"
              onClick={handlePrint}
              className="w-full flex items-center gap-2.5 px-3.5 h-10 text-[13px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer"
            >
              <AnimatedPrinter size={15} className="text-purple-600 dark:text-purple-400 shrink-0" />
              <span>Print / PDF Report</span>
            </button>
          </div>
        </div>
      )}

      {/* Global Mobile Quick Access Search Modal */}
      {cmdOpen && (
        <CommandPalette
          isOpen={cmdOpen}
          onClose={() => setCmdOpen(false)}
          userRole={userRole}
        />
      )}
    </>
  );
}

