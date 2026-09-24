"use client";

import React, { useState, useTransition, useMemo, useCallback, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import {
  AnimatedPlus,
  AnimatedEdit,
  AnimatedTrash,
  AnimatedRefresh,
  AnimatedClipboardList,
  AnimatedWrench,
  AnimatedAlertTriangle,
  AnimatedSlidersHorizontal,
  AnimatedFileText,
  AnimatedChevronDown,
  AnimatedArrowUpDown,
  AnimatedMoreVertical,
} from "@/components/ui/animated-icons";
import { MoreVertical, Download, FileSpreadsheet, FileText, Printer, Check, X, History, Users, Search, RotateCcw } from "lucide-react";
import {
  Button,
  Pagination,
  useToast,
  EnterpriseTable,
  ConfirmationDialog,
  Badge,
  FilterToolbar,
  TooltipWrapper,
  PageHeader,
  ExportButton,
} from "@/components/ui";
import { Highlight } from "@/components/ui/Highlight";
import { AnimatedCounter } from "@/components/ui/Motion";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { deleteMachine, getMachineExportDataAction, searchMachinesServerAction, getMachineModalOptionsAction, getPaginatedMachinesAction } from "@/app/actions/machines";
import { MachineRowActionsMenu } from "./MachineRowActionsMenu";
import type { Machine, User, UserRole } from "@/lib/types/database";

const MobileMachineCard = dynamic(
  () => import("./MobileMachineCard").then((mod) => mod.MobileMachineCard),
  { ssr: false }
);

const MachineModal = dynamic<React.ComponentProps<typeof import("./MachineModal").MachineModal>>(
  () => import("./MachineModal").then((mod) => mod.MachineModal),
  { ssr: false }
);

const MachineInfoModal = dynamic<React.ComponentProps<typeof import("./MachineEditModals").MachineInfoModal>>(
  () => import("./MachineEditModals").then((mod) => mod.MachineInfoModal),
  { ssr: false }
);

const MachinePersonnelModal = dynamic<React.ComponentProps<typeof import("./MachineEditModals").MachinePersonnelModal>>(
  () => import("./MachineEditModals").then((mod) => mod.MachinePersonnelModal),
  { ssr: false }
);

const MachineClientModal = dynamic<React.ComponentProps<typeof import("./MachineEditModals").MachineClientModal>>(
  () => import("./MachineEditModals").then((mod) => mod.MachineClientModal),
  { ssr: false }
);

const MachineImportModal = dynamic(
  () => import("./MachineImportModal").then((mod) => mod.MachineImportModal),
  { ssr: false }
);

const PrintableMachineDirectoryModal = dynamic(
  () => import("./PrintableMachineDirectoryModal").then((mod) => mod.PrintableMachineDirectoryModal),
  { ssr: false }
);

const MachineAssignmentsQuickModal = dynamic(
  () => import("./MachineAssignmentsQuickModal").then((mod) => mod.MachineAssignmentsQuickModal),
  { ssr: false }
);

const MachineHistoryQuickModal = dynamic(
  () => import("./MachineHistoryQuickModal").then((mod) => mod.MachineHistoryQuickModal),
  { ssr: false }
);


interface MachineListClientProps {
  machines: Machine[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  supervisors?: User[];
  operators?: User[];
  clients?: any[];
  userRole: UserRole;
  currentSearch?: string;
  currentStatus?: string;
  currentHealthStatus?: string;
  currentSupervisor?: string;
  currentClientId?: string;
  currentSort?: string;
  initialKpis?: {
    total: number;
    available: number;
    rented: number;
    breakdown: number;
    maintenance: number;
    spare: number;
    active: number;
  };
}

// Dynamic multi-personnel cell renderer with scalable typography (1 name -> 12px, 2 names -> 11px, 3+ names -> 10px)
const PersonnelCell = memo(function PersonnelCell({
  users,
  fallbackUser,
  badgeVariant = "teal",
  onClick,
}: {
  users?: Array<Pick<User, "id" | "phone" | "full_name" | "email" | "shift_time"> | User> | null;
  fallbackUser?: Pick<User, "id" | "phone" | "full_name" | "email" | "shift_time"> | User | null;
  badgeVariant?: "teal" | "amber";
  onClick?: () => void;
}) {
  const personnel = useMemo(() => {
    if (Array.isArray(users) && users.length > 0) {
      return users.filter((u) => Boolean(u?.full_name));
    }
    if (fallbackUser?.full_name) {
      return [fallbackUser];
    }
    return [];
  }, [users, fallbackUser]);

  if (personnel.length === 0) {
    return <span className="text-xs text-[var(--color-mute)] italic">Unassigned</span>;
  }

  const count = personnel.length;
  const visible = personnel.slice(0, 3);
  const remainingCount = count > 3 ? count - 3 : 0;
  const allNames = personnel.map((p) => p.full_name).join(", ");

  // Dynamic typography sizing:
  // 1 person   -> text-xs font-medium (12px standard)
  // 2 persons  -> text-[11px] leading-tight font-medium
  // 3+ persons -> text-[10px] leading-[1.25] font-medium
  const textSizeClass =
    count === 1
      ? "text-xs font-medium"
      : count === 2
      ? "text-[11px] leading-tight font-medium"
      : "text-[10px] leading-[1.25] font-medium";

  const badgeColorClass =
    badgeVariant === "teal"
      ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20"
      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

  return (
    <div
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      className={`flex flex-col gap-0.5 min-w-0 py-0.5 justify-center ${onClick ? "cursor-pointer group hover:opacity-80 transition-opacity" : ""}`}
      title={onClick ? `${allNames} (Click to inspect shift coverage)` : allNames}
    >
      {visible.map((p, idx) => {
        const isLastVisible = idx === visible.length - 1;
        return (
          <div key={p.id || idx} className="flex items-center gap-1 min-w-0">
            <span
              className={`${textSizeClass} text-[var(--color-body)] truncate block ${
                remainingCount > 0 && isLastVisible ? "max-w-[85px]" : "max-w-[120px]"
              }`}
            >
              {p.full_name}
            </span>
            {isLastVisible && remainingCount > 0 && (
              <span
                className={`text-[9px] font-bold px-1 py-0.2 rounded border shrink-0 ${badgeColorClass}`}
                title={`+${remainingCount} more: ${personnel.slice(3).map((u) => u.full_name).join(", ")}`}
              >
                +{remainingCount}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
});

// Reusable responsive filter selector dropdown with mobile edge clamping
const CustomFilterSelector = memo(function CustomFilterSelector({
  label,
  value,
  onChange,
  options,
  ariaLabel,
  align = "left",
  className = "",
  icon,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { id: string; label: string; activeColor?: string; dotColor?: string }[];
  ariaLabel?: string;
  align?: "left" | "right";
  className?: string;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<any>(null);

  const selectedOption = options.find((opt) => opt.id === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full group ${open ? "z-40" : "z-10"} ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={() => iconRef.current?.startAnimation?.()}
        onMouseLeave={() => iconRef.current?.stopAnimation?.()}
        aria-expanded={open}
        aria-label={ariaLabel || label}
        className="w-full h-11 sm:h-9 px-3.5 sm:px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-xs text-[var(--color-ink)] flex items-center justify-between gap-2 transition-all cursor-pointer select-none active:scale-[0.98] shadow-2xs"
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <span className="text-[var(--color-mute)] font-medium shrink-0">{label}:</span>
          {selectedOption?.dotColor && (
            <span className={`h-2 w-2 rounded-full shrink-0 ${selectedOption.dotColor}`} />
          )}
          <span
            className={`truncate font-semibold ${
              selectedOption?.id !== "all"
                ? selectedOption?.activeColor || "text-[var(--color-ink)]"
                : "text-[var(--color-ink)]"
            }`}
          >
            {selectedOption?.label}
          </span>
        </div>
        {icon ? (
          React.isValidElement(icon) ? (
            React.cloneElement(icon as React.ReactElement<any>, {
              ref: (node: any) => {
                iconRef.current = node;
                const orig = (icon as any).ref;
                if (typeof orig === "function") orig(node);
                else if (orig && typeof orig === "object") orig.current = node;
              },
              size: (icon as any).props?.size ?? 14,
              className: `shrink-0 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              } ${(icon as any).props?.className || ""}`,
            })
          ) : (
            icon
          )
        ) : (
          <AnimatedChevronDown
            ref={iconRef as any}
            size={14}
            className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 group-hover:text-[var(--color-ink)] ${
              open ? "rotate-180 text-[var(--color-ink)]" : ""
            }`}
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="listbox"
            aria-label={ariaLabel}
            className={`absolute top-full mt-1.5 z-50 min-w-full max-h-60 overflow-y-auto rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-1 shadow-xl pointer-events-auto ${
              align === "right"
                ? "right-0 left-auto sm:left-0 sm:right-auto sm:min-w-[200px]"
                : "left-0 right-auto sm:left-0 sm:min-w-[220px]"
            }`}
          >
            {options.map((opt) => {
              const isSelected = opt.id === value;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className={`w-full min-h-[44px] sm:min-h-[36px] flex items-center justify-between px-3 sm:px-2.5 py-2.5 sm:py-2 rounded-lg text-xs font-medium text-left transition-all cursor-pointer active:scale-[0.98] ${
                    isSelected
                      ? "bg-[var(--color-ink)] text-[var(--color-canvas)] font-semibold shadow-xs"
                      : "text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:bg-[var(--color-hairline-soft-surface)]"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.dotColor && (
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isSelected ? "bg-white" : opt.dotColor
                        }`}
                      />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// Contextual Row Actions Menu (⋮) has been extracted to MachineRowActionsMenu.tsx for zero data fetching on menu open and unified desktop/mobile reusability.


// Secondary Action Header Menu
const HeaderMoreMenu = memo(function HeaderMoreMenu({
  isAdmin,
  onOpenImport,
  onExportExcel,
  onExportCSV,
  onExportPDF,
  onRefresh,
}: {
  isAdmin: boolean;
  onOpenImport: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openUpwards: boolean }>({
    top: 0,
    left: 0,
    openUpwards: false,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreIconRef = useRef<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 208; // 13rem = 208px
    const menuHeight = isAdmin ? 210 : 170;
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldOpenUpwards = spaceBelow < menuHeight + 16;

    let leftPos = rect.right - menuWidth;
    if (leftPos < 12) leftPos = 12;
    if (leftPos + menuWidth > window.innerWidth - 12) {
      leftPos = window.innerWidth - menuWidth - 12;
    }

    let topPos = shouldOpenUpwards ? rect.top - menuHeight - 4 : rect.bottom + 4;
    if (topPos < 12) topPos = 12;

    setCoords({
      top: topPos,
      left: leftPos,
      openUpwards: shouldOpenUpwards,
    });
  }, [isAdmin]);

  const toggleOpen = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (!open) {
        updatePosition();
      }
      setOpen((prev) => !prev);
    },
    [open, updatePosition]
  );

  useEffect(() => {
    if (!open) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open, updatePosition]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        onMouseEnter={() => moreIconRef.current?.startAnimation?.()}
        onMouseLeave={() => moreIconRef.current?.stopAnimation?.()}
        aria-expanded={open}
        className="h-9 w-9 sm:w-auto p-0 sm:px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-all shadow-xs inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
        title="More options"
      >
        <AnimatedMoreVertical ref={moreIconRef as any} size={15} className="shrink-0" />
        <span className="hidden sm:inline">More</span>
      </button>

      {mounted &&
        open &&
        createPortal(
          <AnimatePresence>
            <div className="fixed inset-0 z-50 pointer-events-none">
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.95, y: coords.openUpwards ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: coords.openUpwards ? 4 : -4 }}
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
                style={{
                  position: "fixed",
                  top: `${coords.top}px`,
                  left: `${coords.left}px`,
                  width: "208px",
                }}
                className="pointer-events-auto z-50 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-1.5 shadow-xl text-xs space-y-0.5"
              >
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onOpenImport();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                    >
                      <AnimatedClipboardList size={15} className="text-sky-500" />
                      <span>Bulk Excel Import</span>
                    </button>
                    <div className="my-1 border-t border-[var(--color-hairline)]" />
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onExportExcel();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                >
                  <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Export Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onExportCSV();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                >
                  <FileText size={15} className="text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>Export CSV (.csv)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onExportPDF();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                >
                  <Printer size={15} className="text-purple-600 dark:text-purple-400 shrink-0" />
                  <span>PDF Report / Print</span>
                </button>

                <div className="my-1 border-t border-[var(--color-hairline)]" />

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onRefresh();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                >
                  <AnimatedRefresh size={15} className="text-amber-500 shrink-0" />
                  <span>Refresh Data</span>
                </button>
              </motion.div>
            </div>
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
});

const RENTAL_STATUS_OPTIONS = [
  { id: "all", label: "All Rental Status", activeColor: "text-[var(--color-ink)]", dotColor: "" },
  { id: "available", label: "Available", activeColor: "text-emerald-700 dark:text-emerald-400 font-semibold", dotColor: "bg-emerald-500" },
  { id: "rented", label: "Rented", activeColor: "text-sky-700 dark:text-sky-400 font-semibold", dotColor: "bg-sky-500" },
];

const HEALTH_STATUS_OPTIONS = [
  { id: "all", label: "All Health Status", activeColor: "text-[var(--color-ink)]", dotColor: "" },
  { id: "active", label: "Active", activeColor: "text-emerald-700 dark:text-emerald-400 font-semibold", dotColor: "bg-emerald-500" },
  { id: "spare", label: "Spare", activeColor: "text-cyan-700 dark:text-cyan-400 font-semibold", dotColor: "bg-cyan-500" },
  { id: "under_maintenance", label: "Under Maintenance", activeColor: "text-amber-700 dark:text-amber-400 font-semibold", dotColor: "bg-amber-500" },
  { id: "breakdown", label: "Breakdown", activeColor: "text-rose-700 dark:text-rose-400 font-semibold", dotColor: "bg-rose-500" },
];

const SORT_OPTIONS = [
  { id: "machine_id_asc", label: "Machine ID (A → Z)" },
  { id: "machine_id_desc", label: "Machine ID (Z → A)" },
  { id: "model_asc", label: "Model (A → Z)" },
  { id: "newest_yum", label: "Newest Mfg Year" },
  { id: "oldest_yum", label: "Oldest Mfg Year" },
  { id: "highest_hmr", label: "Highest HMR" },
  { id: "lowest_hmr", label: "Lowest HMR" },
];

const MobileMachineCardSkeletonList = memo(function MobileMachineCardSkeletonList({
  count = 4,
}: {
  count?: number;
}) {
  return (
    <div className="space-y-3" aria-label="Loading machine assets...">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-2xl border border-[var(--color-hairline)] border-l-[3px] border-l-neutral-300 dark:border-l-neutral-700 bg-[var(--color-canvas-elevated)] shadow-xs animate-pulse flex flex-col gap-3"
        >
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="h-6 w-20 rounded bg-[var(--color-hairline)] shrink-0" />
              <div className="h-4 w-16 rounded bg-[var(--color-hairline)]/70" />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="h-5 w-14 rounded-full bg-[var(--color-hairline)]" />
              <div className="h-5 w-14 rounded-full bg-[var(--color-hairline)]" />
            </div>
          </div>

          {/* Sub Metadata Row */}
          <div className="h-3 w-44 rounded bg-[var(--color-hairline)]/60" />

          {/* Inset Specs Well */}
          <div className="p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="h-2.5 w-16 rounded bg-[var(--color-hairline)]/70" />
                <div className="h-4 w-14 rounded bg-[var(--color-hairline)]" />
              </div>
              <div className="space-y-1">
                <div className="h-2.5 w-20 rounded bg-[var(--color-hairline)]/70" />
                <div className="h-3.5 w-24 rounded bg-[var(--color-hairline)]" />
              </div>
            </div>
            <div className="h-px bg-[var(--color-hairline)]" />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="h-2.5 w-14 rounded bg-[var(--color-hairline)]/70" />
                <div className="h-3 w-20 rounded bg-[var(--color-hairline)]" />
              </div>
              <div className="space-y-1">
                <div className="h-2.5 w-16 rounded bg-[var(--color-hairline)]/70" />
                <div className="h-3 w-20 rounded bg-[var(--color-hairline)]" />
              </div>
            </div>
          </div>

          {/* Footer Row */}
          <div className="pt-2 border-t border-[var(--color-hairline)] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="h-7 w-14 rounded bg-[var(--color-hairline)]" />
              <div className="h-7 w-16 rounded bg-[var(--color-hairline)]" />
            </div>
            <div className="h-7 w-20 rounded bg-[var(--color-hairline)]" />
          </div>
        </div>
      ))}
    </div>
  );
});

export function MachineListClient({

  machines,
  total,
  page,
  pageSize,
  totalPages,
  supervisors = [],
  operators = [],
  clients = [],
  userRole,
  currentSearch = "",
  currentStatus = "all",
  currentHealthStatus = "all",
  currentSupervisor = "all",
  currentClientId = "all",
  currentSort = "machine_id_asc",
  initialKpis,
}: MachineListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [isPending, startTransition] = useTransition();

  // ── Pure High-Scale Server-Side Search Engine (Engineered for 100,000+ Machines)
  // Queries PostgreSQL via GIN Trigram indexes on (machine_id, model, serial_number only)
  // Never downloads 100,000 rows to client RAM. Ultra-lean ~15KB network responses.
  const initialSearchParam = searchParams?.get("search") || currentSearch || "";
  const [localSearchTerm, setLocalSearchTerm] = useState(initialSearchParam);
  const [searchResults, setSearchResults] = useState<Machine[] | null>(null);
  const [searchTotalCount, setSearchTotalCount] = useState<number>(0);
  const [searchTotalPages, setSearchTotalPages] = useState<number>(0);
  const [searchPage, setSearchPage] = useState<number>(1);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cardsIconRef = useRef<any>(null);
  const tableIconRef = useRef<any>(null);

  const isSearchActive = localSearchTerm.trim().length > 0;
  const activeMachines = isSearchActive ? (searchResults ?? []) : machines;
  const activeTotal = isSearchActive ? searchTotalCount : total;
  const activeTotalPages = isSearchActive ? searchTotalPages : totalPages;
  const activeCurrentPage = isSearchActive ? searchPage : page;
  const activePageSize = isSearchActive ? 50 : pageSize;

  // Mobile Infinite Scroll State for Cards View (Chunk-by-chunk lazy loading)
  const [mobileMachinesList, setMobileMachinesList] = useState<Machine[]>(machines);
  const [mobilePage, setMobilePage] = useState<number>(page);
  const [mobileHasMore, setMobileHasMore] = useState<boolean>(page < totalPages);
  const [isLoadingMoreMobile, setIsLoadingMoreMobile] = useState<boolean>(false);
  const [loadMoreMobileError, setLoadMoreMobileError] = useState<string | null>(null);
  const mobileSentinelRef = useRef<HTMLDivElement>(null);
  const isFetchingMobileRef = useRef<boolean>(false);

  useEffect(() => {
    setMobileMachinesList(machines);
    setMobilePage(page);
    setMobileHasMore(page < totalPages);
    setLoadMoreMobileError(null);
  }, [machines, page, totalPages]);

  // Clean up search timers and in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (searchAbortRef.current) searchAbortRef.current.abort();
    };
  }, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);

  // Dedicated separate 3-modal edit states
  const [editInfoModalOpen, setEditInfoModalOpen] = useState(false);
  const [editInfoMachine, setEditInfoMachine] = useState<any | null>(null);

  const [editPersonnelModalOpen, setEditPersonnelModalOpen] = useState(false);
  const [editPersonnelMachine, setEditPersonnelMachine] = useState<any | null>(null);

  const [editClientModalOpen, setEditClientModalOpen] = useState(false);
  const [editClientMachine, setEditClientMachine] = useState<any | null>(null);

  const [lazySupervisors, setLazySupervisors] = useState<User[]>(supervisors);
  const [lazyOperators, setLazyOperators] = useState<User[]>(operators);
  const [lazyClients, setLazyClients] = useState<any[]>(clients);
  const [hasLoadedModalOptions, setHasLoadedModalOptions] = useState(false);

  useEffect(() => {
    if (supervisors.length > 0) {
      setLazySupervisors(supervisors);
    }
  }, [supervisors]);

  // Quick-add trigger from the reusable MobilePageHeader (+ icon)
  useEffect(() => {
    const handleQuickAdd = () => {
      setEditingMachine(null);
      setModalOpen(true);
    };
    window.addEventListener("reach:quick-add", handleQuickAdd);
    return () => window.removeEventListener("reach:quick-add", handleQuickAdd);
  }, []);

  // Strip legacy tab parameter (e.g. ?tab=inventory or ?tab=assigned) to normalize URL to clean /machines
  useEffect(() => {
    if (searchParams?.has("tab")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      const newQuery = params.toString();
      router.replace(newQuery ? `/machines?${newQuery}` : "/machines", { scroll: false });
    }
  }, [searchParams, router]);

  const [deletingMachine, setDeletingMachine] = useState<Machine | null>(null);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [activeAssignmentMachine, setActiveAssignmentMachine] = useState<Machine | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [activeHistoryMachine, setActiveHistoryMachine] = useState<Machine | null>(null);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [viewMode, setViewMode] = useState<"auto" | "cards" | "table">("auto");
  const isDesktop = useMediaQuery("(min-width: 641px)");

  // Strict mutually exclusive presentation mode:
  // - "table": renders Table only (never cards)
  // - "cards": renders Cards only (never table)
  // - "auto": dynamically renders Table on desktop (>=641px) or Cards on mobile (<=640px)
  const effectiveView: "table" | "cards" = useMemo(() => {
    if (viewMode === "table") return "table";
    if (viewMode === "cards") return "cards";
    return isDesktop ? "table" : "cards";
  }, [viewMode, isDesktop]);

  const displayedCardsMachines = useMemo(() => {
    if (isSearchActive) return searchResults ?? [];
    if (isDesktop && viewMode === "cards") return machines;
    return mobileMachinesList;
  }, [isSearchActive, searchResults, isDesktop, viewMode, machines, mobileMachinesList]);

  const handleOpenEdit = useCallback((m: Machine) => {
    setEditingMachine(m);
    setModalOpen(true);
  }, []);

  const ensureModalOptionsLoaded = useCallback(async () => {
    if (hasLoadedModalOptions && lazySupervisors.length > 0 && lazyOperators.length > 0 && lazyClients.length > 0) return;
    try {
      const data = await getMachineModalOptionsAction();
      if (data.supervisors?.length) setLazySupervisors(data.supervisors);
      if (data.operators?.length) setLazyOperators(data.operators);
      if (data.clients?.length) setLazyClients(data.clients);
      setHasLoadedModalOptions(true);
    } catch {
      // fallback
    }
  }, [hasLoadedModalOptions, lazySupervisors.length, lazyOperators.length, lazyClients.length]);

  const handleOpenEditMachine = useCallback((m: Machine) => {
    setEditInfoMachine(m);
    setEditInfoModalOpen(true);
  }, []);

  const handleOpenEditPersonnel = useCallback((m: Machine) => {
    ensureModalOptionsLoaded();
    setEditPersonnelMachine(m);
    setEditPersonnelModalOpen(true);
  }, [ensureModalOptionsLoaded]);

  const handleOpenEditClient = useCallback((m: Machine) => {
    ensureModalOptionsLoaded();
    setEditClientMachine(m);
    setEditClientModalOpen(true);
  }, [ensureModalOptionsLoaded]);

  const handleViewAudit = useCallback(
    (m: Machine) => {
      router.push(`/machines/${m.id}?tab=audit_trail`);
    },
    [router]
  );

  const handleViewLogs = useCallback(
    (m: Machine) => {
      router.push(`/machines/${m.id}?tab=running_hours`);
    },
    [router]
  );

  const handleMachineUpdatedFromModal = useCallback((updatedFields: Partial<Machine>) => {
    setSearchResults((prev) =>
      prev
        ? prev.map((m) =>
            m.id === (updatedFields as any).id || m.machine_id === updatedFields.machine_id
              ? { ...m, ...updatedFields }
              : m
          )
        : null
    );
    setMobileMachinesList((prev) =>
      prev.map((m) =>
        m.id === (updatedFields as any).id || m.machine_id === updatedFields.machine_id
          ? { ...m, ...updatedFields }
          : m
      )
    );
    router.refresh();
  }, [router]);

  const handleOpenDelete = useCallback((m: Machine) => {
    setDeletingMachine(m);
  }, []);

  const handleOpenDetail = useCallback(
    (machineOrId: Machine | string) => {
      const id = typeof machineOrId === "string" ? machineOrId : machineOrId.id;
      router.push(`/machines/${id}`);
    },
    [router]
  );

  const handleRowClick = useCallback(
    (row: Machine) => {
      handleOpenDetail(row);
    },
    [handleOpenDetail]
  );
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfSelectedIds, setPdfSelectedIds] = useState<(string | number)[]>([]);
  const [pdfMachines, setPdfMachines] = useState<Machine[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const exportCacheRef = useRef<Map<string, Machine[]>>(new Map());
  const [healthStatusFilter, setHealthStatusFilter] = useState<string>(currentHealthStatus);
  const [supervisorFilter, setSupervisorFilter] = useState<string>(currentSupervisor);
  const [sortBy, setSortBy] = useState<string>(currentSort);

  useEffect(() => {
    setHealthStatusFilter(currentHealthStatus);
  }, [currentHealthStatus]);

  useEffect(() => {
    setSupervisorFilter(currentSupervisor);
  }, [currentSupervisor]);

  useEffect(() => {
    setSortBy(currentSort);
  }, [currentSort]);

  const canManage =
    userRole === "super_admin" ||
    userRole === "admin" ||
    userRole === "manager";
  const isSupervisor = userRole === "supervisor";
  const isAdmin = canManage;
  const canEdit = canManage;
  const canCreateMachine = canManage;
  const canDelete = canManage;


  // Lazy-load complete supervisor directory in the background without blocking initial paint
  const loadSupervisors = useCallback(() => {
    if (lazySupervisors.length > 0) return;
    import("@/app/actions/machines").then(({ getSupervisorFilterOptionsAction }) => {
      getSupervisorFilterOptionsAction()
        .then((sups) => {
          if (sups && sups.length > 0) {
            setLazySupervisors(sups);
          }
        })
        .catch(() => {});
    });
  }, [lazySupervisors.length]);


  // Seed initial supervisors once if not provided by server
  useEffect(() => {
    if (lazySupervisors.length === 0 && machines.length > 0) {
      const initialMap = new Map<string, User>();
      machines.forEach((m) => {
        if (m.current_supervisor?.full_name && m.current_supervisor_id) {
          initialMap.set(m.current_supervisor_id, {
            id: m.current_supervisor_id,
            full_name: m.current_supervisor.full_name,
            role: "supervisor",
          } as User);
        }
      });
      if (initialMap.size > 0) {
        setLazySupervisors((prev) => (prev.length === 0 ? Array.from(initialMap.values()) : prev));
      }
    }
  }, []); // Run ONCE on mount only

  const supervisorOptions = useMemo(() => {
    const map = new Map<string, string>();
    lazySupervisors.forEach((s) => {
      if (s.id && s.full_name) map.set(s.id, s.full_name);
    });
    const list = Array.from(map.entries()).map(([id, name]) => ({
      id,
      label: name,
    }));
    return [{ id: "all", label: "All Supervisors" }, ...list];
  }, [lazySupervisors]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (currentStatus !== "all") count++;
    if (healthStatusFilter !== "all") count++;
    if (supervisorFilter !== "all") count++;
    if (currentClientId !== "all") count++;
    if (localSearchTerm.trim() !== "") count++;
    if (sortBy !== "machine_id_asc") count++;
    return count;
  }, [currentStatus, healthStatusFilter, supervisorFilter, currentClientId, localSearchTerm, sortBy]);

  const updateFilters = useCallback(
    (updates: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : searchParams.toString());
      Object.entries(updates).forEach(([key, val]) => {
        if (val === undefined || val === "" || val === "all" || (key === "page" && val === 1)) {
          params.delete(key);
        } else {
          params.set(key, String(val));
        }
      });
      // Retain active search query parameter if non-empty
      if (localSearchTerm.trim()) {
        params.set("search", localSearchTerm.trim());
      } else {
        params.delete("search");
      }
      const nextQuery = params.toString();
      const currentQuery = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : searchParams.toString();
      if (nextQuery === currentQuery) return; // Deduplicate identical requests

      startTransition(() => {
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams, localSearchTerm]
  );

  // ── Pure High-Scale Server-Side Search Engine (Engineered for 100,000+ Machines)
  // • Queries PostgreSQL via GIN Trigram indexes on (machine_id, model, serial_number only)
  // • Debounced 180ms with AbortController to cancel stale in-flight requests.
  // • Never downloads 100,000 rows to client RAM. Ultra-lean ~15KB network responses.
  const executeServerSearch = useCallback(
    (query: string, pageNum: number = 1) => {
      const trimmed = query.trim();

      if (!trimmed) {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (searchAbortRef.current) searchAbortRef.current.abort();
        setSearchResults(null);
        setSearchTotalCount(0);
        setSearchTotalPages(0);
        setSearchPage(1);
        setIsSearchLoading(false);

        // Update URL to remove search parameter
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          params.delete("search");
          if (params.get("page") === "1") params.delete("page");
          const qs = params.toString();
          window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
        }
        return;
      }

      // Abort preceding in-flight server query to eliminate race conditions
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setIsSearchLoading(true);

      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(async () => {
        try {
          const res = await searchMachinesServerAction(trimmed, {
            status: currentStatus !== "all" ? currentStatus : undefined,
            health_status: healthStatusFilter !== "all" ? healthStatusFilter : undefined,
            current_supervisor_id: supervisorFilter !== "all" ? supervisorFilter : undefined,
            client_id: currentClientId !== "all" ? currentClientId : undefined,
            page: pageNum,
            pageSize: 50,
          });

          if (!controller.signal.aborted) {
            setSearchResults(res.machines);
            setSearchTotalCount(res.total);
            setSearchTotalPages(res.totalPages);
            setSearchPage(pageNum);
            setIsSearchLoading(false);

            // Synchronize search and page in browser URL without full RSC tree refetch
            if (typeof window !== "undefined") {
              const params = new URLSearchParams(window.location.search);
              if (trimmed) {
                params.set("search", trimmed);
              } else {
                params.delete("search");
              }
              if (pageNum > 1) {
                params.set("page", String(pageNum));
              } else {
                params.delete("page");
              }
              const qs = params.toString();
              window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
            }
          }
        } catch (err: any) {
          if (!controller.signal.aborted) {
            console.error("[Search] Machine server query error:", err);
            setIsSearchLoading(false);
          }
        }
      }, 180);
    },
    [currentStatus, healthStatusFilter, supervisorFilter, currentClientId, pathname]
  );

  // Initial mount: execute server search if search parameter is present in URL
  useEffect(() => {
    const searchFromUrl = searchParams?.get("search");
    if (searchFromUrl && searchFromUrl.trim()) {
      executeServerSearch(searchFromUrl, page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen to popstate (browser back/forward button navigation)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const urlSearch = params.get("search") || "";
      const urlPage = parseInt(params.get("page") || "1", 10) || 1;
      setLocalSearchTerm(urlSearch);
      if (urlSearch.trim()) {
        executeServerSearch(urlSearch, urlPage);
      } else {
        setSearchResults(null);
        setSearchPage(1);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [executeServerSearch]);

  const handleSearchChange = useCallback(
    (newSearch: string) => {
      setLocalSearchTerm(newSearch);
      if (newSearch.trim()) {
        setIsSearchLoading(true);
      }
      executeServerSearch(newSearch, 1);
    },
    [executeServerSearch]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (isSearchActive) {
        executeServerSearch(localSearchTerm, newPage);
        return;
      }
      updateFilters({ page: newPage });
    },
    [isSearchActive, localSearchTerm, executeServerSearch, updateFilters]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleResetAllFilters = () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (searchAbortRef.current) searchAbortRef.current.abort();
    setLocalSearchTerm("");
    setSearchResults(null);
    setSearchTotalCount(0);
    setSearchTotalPages(0);
    setSearchPage(1);
    setIsSearchLoading(false);
    setHealthStatusFilter("all");
    setSupervisorFilter("all");
    setSortBy("machine_id_asc");
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", pathname);
    }
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  // If active filters change while searching, refresh the search results with new filters
  useEffect(() => {
    if (localSearchTerm.trim()) {
      executeServerSearch(localSearchTerm, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStatus, healthStatusFilter, supervisorFilter, currentClientId]);

  const handleDeleteConfirm = useCallback(() => {
    if (!deletingMachine) return;
    startTransition(async () => {
      try {
        const res = await deleteMachine(deletingMachine.id);
        if (res?.error) {
          toast("error", "Failed to delete machine", res.error);
        } else {
          toast("success", `Machine ${deletingMachine.machine_id} deleted successfully`);
          setMobileMachinesList((prev) => prev.filter((m) => m.id !== deletingMachine.id));
          setDeletingMachine(null);
          router.refresh();
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "An error occurred";
        toast("error", "Failed to delete machine", errorMsg);
      }
    });
  }, [deletingMachine, router, toast]);

  const handleOpenAssignments = useCallback((machine: Machine) => {
    setActiveAssignmentMachine(machine);
    setAssignmentModalOpen(true);
  }, []);

  const handleOpenHistory = useCallback((machine: Machine) => {
    setActiveHistoryMachine(machine);
    setHistoryModalOpen(true);
  }, []);

  // On-demand progressive export dataset retrieval with client cache
  const fetchExportDataset = useCallback(
    async (ids: (string | number)[] = []): Promise<Machine[]> => {
      if (ids.length > 0) {
        const source = isSearchActive ? (searchResults ?? machines) : machines;
        const selected = source.filter((m) => ids.includes(m.id));
        if (selected.length > 0) return selected;
      }
      const trimmedSearch = localSearchTerm.trim();
      const cacheKey = `${trimmedSearch}|${currentStatus}|${healthStatusFilter}|${supervisorFilter}|${sortBy}`;
      if (exportCacheRef.current.has(cacheKey)) {
        return exportCacheRef.current.get(cacheKey)!;
      }
      const res = await getMachineExportDataAction({
        search: trimmedSearch || undefined,
        status: currentStatus !== "all" ? currentStatus : undefined,
        health_status: healthStatusFilter !== "all" ? healthStatusFilter : undefined,
        supervisor_id: supervisorFilter !== "all" ? supervisorFilter : undefined,
        sort: sortBy,
      });
      const dataset = (res.data || []) as Machine[];
      if (dataset.length > 0) {
        exportCacheRef.current.set(cacheKey, dataset);
      }
      return dataset.length > 0 ? dataset : machines;
    },
    [machines, localSearchTerm, currentStatus, healthStatusFilter, supervisorFilter, sortBy]
  );

  const handleExportExcel = useCallback(
    async (ids: (string | number)[] = []) => {
      try {
        setIsExporting(true);
        const targetMachines = await fetchExportDataset(ids);
        if (!targetMachines || targetMachines.length === 0) {
          toast("error", "No machines found to export");
          return;
        }
        const { exportMachinesToExcel } = await import("@/lib/utils/machines-export");
        const prefix = ids.length > 0 ? `Machines-Selected-${targetMachines.length}` : "Machine-Directory";
        exportMachinesToExcel(targetMachines, prefix);
        toast("success", `Exported ${targetMachines.length} machines to Excel (.xlsx)`);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Export failed";
        toast("error", "Failed to export Excel", errorMsg);
      } finally {
        setIsExporting(false);
      }
    },
    [fetchExportDataset, toast]
  );

  const handleExportCSV = useCallback(
    async (ids: (string | number)[] = []) => {
      try {
        setIsExporting(true);
        const targetMachines = await fetchExportDataset(ids);
        if (!targetMachines || targetMachines.length === 0) {
          toast("error", "No machines found to export");
          return;
        }
        const { exportMachinesToCSV } = await import("@/lib/utils/machines-export");
        const prefix = ids.length > 0 ? `Machines-Selected-${targetMachines.length}` : "Machine-Directory";
        exportMachinesToCSV(targetMachines, prefix);
        toast("success", `Exported ${targetMachines.length} machines to CSV (.csv)`);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Export failed";
        toast("error", "Failed to export CSV", errorMsg);
      } finally {
        setIsExporting(false);
      }
    },
    [fetchExportDataset, toast]
  );

  const handleOpenPDFModal = useCallback(
    async (ids: (string | number)[] = []) => {
      setPdfSelectedIds(ids);
      try {
        setIsExporting(true);
        const dataset = await fetchExportDataset(ids);
        setPdfMachines(dataset);
        setPdfModalOpen(true);
      } catch {
        setPdfMachines(machines);
        setPdfModalOpen(true);
      } finally {
        setIsExporting(false);
      }
    },
    [fetchExportDataset, machines]
  );

  // Mobile Chunk-by-Chunk Infinite Scroll Handler
  const handleLoadMoreMobile = useCallback(async () => {
    if (isFetchingMobileRef.current || !mobileHasMore || isLoadingMoreMobile || isPending) return;
    isFetchingMobileRef.current = true;
    setIsLoadingMoreMobile(true);
    setLoadMoreMobileError(null);

    try {
      const nextPage = mobilePage + 1;
      const res = await getPaginatedMachinesAction({
        status: currentStatus !== "all" ? currentStatus : undefined,
        health_status: healthStatusFilter !== "all" ? healthStatusFilter : undefined,
        current_supervisor_id: supervisorFilter !== "all" ? supervisorFilter : undefined,
        client_id: currentClientId !== "all" ? currentClientId : undefined,
        sortField: sortBy.includes("_") ? sortBy.slice(0, sortBy.lastIndexOf("_")) : sortBy,
        sortOrder: sortBy.endsWith("_desc") ? "desc" : "asc",
        page: nextPage,
        pageSize: 25,
      });

      if (res.error) {
        setLoadMoreMobileError(res.error);
      } else {
        setMobileMachinesList((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const fresh = res.machines.filter((m) => !existingIds.has(m.id));
          return [...prev, ...fresh];
        });
        setMobilePage(nextPage);
        setMobileHasMore(nextPage < res.totalPages);
      }
    } catch (err: any) {
      setLoadMoreMobileError(err?.message || "Failed to load more machines.");
    } finally {
      setIsLoadingMoreMobile(false);
      isFetchingMobileRef.current = false;
    }
  }, [
    mobileHasMore,
    isLoadingMoreMobile,
    isPending,
    mobilePage,
    currentStatus,
    healthStatusFilter,
    supervisorFilter,
    currentClientId,
    sortBy,
  ]);

  useEffect(() => {
    const sentinel = mobileSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting) {
          handleLoadMoreMobile();
        }
      },
      { root: null, rootMargin: "350px", threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMoreMobile]);

  const handleMobileRetry = useCallback(() => {
    setLoadMoreMobileError(null);
    handleLoadMoreMobile();
  }, [handleLoadMoreMobile]);

  // Mobile Header quick actions (export & print)
  useEffect(() => {
    const handleQuickExportExcel = () => {
      handleExportExcel(selectedIds);
    };
    const handleQuickExportCSV = () => {
      handleExportCSV(selectedIds);
    };
    const handleQuickPrint = (e: Event) => {
      e.preventDefault();
      handleOpenPDFModal(selectedIds);
    };

    window.addEventListener("reach:quick-export-excel", handleQuickExportExcel);
    window.addEventListener("reach:quick-export-csv", handleQuickExportCSV);
    window.addEventListener("reach:quick-print", handleQuickPrint);

    return () => {
      window.removeEventListener("reach:quick-export-excel", handleQuickExportExcel);
      window.removeEventListener("reach:quick-export-csv", handleQuickExportCSV);
      window.removeEventListener("reach:quick-print", handleQuickPrint);
    };
  }, [handleExportExcel, handleExportCSV, handleOpenPDFModal, selectedIds]);

  const tableBulkActions = useMemo(
    () => [
      {
        label: `Excel (${selectedIds.length})`,
        icon: FileSpreadsheet,
        onClick: (ids: (string | number)[]) => handleExportExcel(ids),
      },
      {
        label: `CSV (${selectedIds.length})`,
        icon: FileText,
        onClick: (ids: (string | number)[]) => handleExportCSV(ids),
      },
      {
        label: `PDF (${selectedIds.length})`,
        icon: Printer,
        onClick: (ids: (string | number)[]) => handleOpenPDFModal(ids),
      },
    ],
    [selectedIds.length, handleExportExcel, handleExportCSV, handleOpenPDFModal]
  );

  const statsSummary = useMemo(() => {
    if (initialKpis && (initialKpis.total > 0 || machines.length === 0)) {
      return {
        totalCount: initialKpis.total,
        availableCount: initialKpis.available,
        rentedCount: initialKpis.rented,
        breakdownCount: initialKpis.breakdown,
        maintenanceCount: initialKpis.maintenance,
        spareCount: initialKpis.spare,
      };
    }

    let availableCount = 0;
    let rentedCount = 0;
    let breakdownCount = 0;
    let maintenanceCount = 0;
    let spareCount = 0;

    machines.forEach((m) => {
      if (m.status === "rented") rentedCount++;
      else availableCount++;

      if (m.health_status === "breakdown") breakdownCount++;
      if (m.health_status === "under_maintenance") maintenanceCount++;
      if (m.health_status === "spare") spareCount++;
    });

    return {
      totalCount: total > 0 ? total : machines.length,
      availableCount,
      rentedCount,
      breakdownCount,
      maintenanceCount,
      spareCount,
    };
  }, [machines, initialKpis, total]);

  // Full unified columns mapping for high density table
  const tableColumns = useMemo(
    () => [
      {
        id: "machine_id",
        header: "MACHINE ID",
        accessorKey: "machine_id" as const,
        sortable: true,
        width: "11%",
        cell: (row: Machine) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDetail(row);
            }}
            className="font-bold text-[var(--color-ink)] hover:text-sky-600 dark:hover:text-sky-400 transition-colors font-mono text-xs hover:underline whitespace-nowrap cursor-pointer text-left"
            title="Open Machine Details"
          >
            <Highlight text={row.machine_id || row.machine_code || "—"} query={localSearchTerm} />
          </button>
        ),
      },
      {
        id: "model",
        header: "MODEL",
        accessorKey: "model" as const,
        sortable: true,
        width: "12%",
        cell: (row: Machine) => (
          <span className="font-semibold text-[var(--color-ink)] text-xs truncate block max-w-[120px]" title={row.model || ""}>
            <Highlight text={row.model || "—"} query={localSearchTerm} />
          </span>
        ),
      },
      {
        id: "serial_number",
        header: "SERIAL NO",
        accessorKey: "serial_number" as const,
        width: "12%",
        cell: (row: Machine) => (
          <span className="font-mono text-[var(--color-mute)] text-xs truncate block max-w-[120px]" title={row.serial_number || ""}>
            <Highlight text={row.serial_number || "—"} query={localSearchTerm} />
          </span>
        ),
      },
      {
        id: "year_of_mfg",
        header: "YUM",
        accessorKey: "year_of_mfg" as const,
        width: "6%",
        cell: (row: Machine) => (
          <span className="text-[var(--color-body)] text-xs font-mono">
            {row.year_of_mfg || "—"}
          </span>
        ),
      },
      {
        id: "manufacturer",
        header: "MFR",
        accessorKey: "manufacturer" as const,
        width: "9%",
        cell: (row: Machine) => (
          <span className="text-[var(--color-body)] text-xs truncate block max-w-[90px]" title={row.manufacturer || ""}>
            {row.manufacturer || "—"}
          </span>
        ),
      },
      {
        id: "hour_meter",
        header: "HMR",
        accessorKey: "hour_meter" as const,
        sortable: true,
        width: "7%",
        cell: (row: Machine) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenHistory(row);
            }}
            title="Click to view running logs on demand"
            className="font-mono font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline text-xs text-left cursor-pointer transition-colors"
          >
            {row.hour_meter ?? 0}
          </button>
        ),
      },
      {
        id: "client",
        header: "ASSIGNED CLIENT",
        width: "14%",
        cell: (row: Machine) => {
          const clientName = row.client?.company_name || row.customer_name;
          const clientCode = row.client?.code;
          if (!clientName) {
            return (
              <span className="text-xs text-[var(--color-mute)] italic">
                Unassigned
              </span>
            );
          }
          return (
            <div className="flex flex-col min-w-0 pr-1">
              <span
                className="text-xs font-bold text-[var(--color-ink)] truncate max-w-[130px]"
                title={clientName}
              >
                {clientName}
              </span>
              {clientCode && (
                <span className="text-[10px] font-mono text-[var(--color-mute)] truncate">
                  {clientCode}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "supervisor",
        header: "SUPERVISOR",
        width: "12%",
        cell: (row: Machine) => (
          <PersonnelCell
            users={row.supervisors}
            fallbackUser={row.current_supervisor}
            badgeVariant="teal"
            onClick={() => handleOpenAssignments(row)}
          />
        ),
      },
      {
        id: "operator",
        header: "OPERATOR (24H)",
        width: "12%",
        cell: (row: Machine) => (
          <PersonnelCell
            users={row.operators}
            fallbackUser={row.current_operator}
            badgeVariant="amber"
            onClick={() => handleOpenAssignments(row)}
          />
        ),
      },
      {
        id: "health_status",
        header: "HEALTH",
        accessorKey: "health_status" as const,
        sortable: true,
        width: "9%",
        cell: (row: Machine) => {
          if (row.health_status === "breakdown") return <Badge variant="overdue" dot className="whitespace-nowrap">Breakdown</Badge>;
          if (row.health_status === "under_maintenance") return <Badge variant="warning" dot className="whitespace-nowrap">Maintenance</Badge>;
          if (row.health_status === "spare") return <Badge variant="spare" dot className="whitespace-nowrap">Spare</Badge>;
          return <Badge variant="success" dot className="whitespace-nowrap">Active</Badge>;
        },
      },
      {
        id: "status",
        header: "STATUS",
        accessorKey: "status" as const,
        sortable: true,
        width: "8%",
        cell: (row: Machine) => {
          if (row.status === "rented") return <Badge variant="info" dot className="whitespace-nowrap">Rented</Badge>;
          return <Badge variant="neutral" className="whitespace-nowrap">Available</Badge>;
        },
      },
      {
        id: "actions",
        header: "",
        width: "4%",
        cell: (row: Machine) => (
          <MachineRowActionsMenu
            machine={row}
            canEdit={canEdit}
            isSupervisor={isSupervisor}
            isAdmin={isAdmin}
            onEditMachine={handleOpenEditMachine}
            onEditPersonnel={handleOpenEditPersonnel}
            onEditClient={handleOpenEditClient}
            onViewAudit={handleViewAudit}
            onViewLogs={handleViewLogs}
            onDelete={handleOpenDelete}
            onEdit={handleOpenEditMachine}
            onViewAssignments={handleOpenAssignments}
            onViewHistory={handleOpenHistory}
            onViewDetails={handleOpenDetail}
          />
        ),
      },
    ],
    [canEdit, isSupervisor, isAdmin, handleOpenEditMachine, handleOpenEditPersonnel, handleOpenEditClient, handleViewAudit, handleViewLogs, handleOpenDelete, handleOpenAssignments, handleOpenHistory, handleOpenDetail, localSearchTerm]
  );

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-6">
      {/* Canonical Page Header */}
      <PageHeader
        title={userRole === "operator" ? "Assigned Equipment" : "Machine Directory"}
        breadcrumbs={[{ label: "Machines" }]}
        actions={
          userRole === "operator" ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.refresh()}
                className="h-9 px-3 text-xs font-semibold gap-1.5"
              >
                <AnimatedRefresh size={14} className="text-muted-foreground" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ExportButton
                format="xlsx"
                iconOnly
                loading={isExporting}
                onClick={() => handleExportExcel(selectedIds)}
                tooltip="Export machine directory to Excel (.xlsx)"
              />

              <HeaderMoreMenu
                isAdmin={isAdmin}
                onOpenImport={() => setImportModalOpen(true)}
                onExportExcel={() => handleExportExcel(selectedIds)}
                onExportCSV={() => handleExportCSV(selectedIds)}
                onExportPDF={() => handleOpenPDFModal(selectedIds)}
                onRefresh={() => router.refresh()}
              />

              {canCreateMachine && (
                <Button
                  variant="primary"
                  icon={<AnimatedPlus size={15} />}
                  responsive
                  onClick={() => {
                    setEditingMachine(null);
                    setModalOpen(true);
                  }}
                  className="h-9 px-3.5 sm:px-4 text-xs font-semibold whitespace-nowrap"
                >
                  Add Machine
                </Button>
              )}
            </div>
          )
        }
      />

      {/* Interactive KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Total Card */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => updateFilters({ status: "all", page: 1 })}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
            currentStatus === "all"
              ? "bg-[var(--color-canvas-elevated)] border-[var(--color-ink)] shadow-xs ring-1 ring-[var(--color-ink)]/10"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]/30"
          }`}
        >
          <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[var(--color-mute)]">
            {userRole === "operator" ? "Assigned Fleet" : "Total Fleet"}
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[var(--color-ink)] mt-1">
            <AnimatedCounter value={statsSummary.totalCount} />
          </div>
        </motion.div>

        {/* Available Card */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => updateFilters({ status: "available", page: 1 })}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
            currentStatus === "available"
              ? "bg-emerald-50/40 border-emerald-500 shadow-xs ring-1 ring-emerald-500/20 dark:bg-emerald-950/20"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-emerald-500/40"
          }`}
        >
          <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Available
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
            <AnimatedCounter value={statsSummary.availableCount} />
          </div>
        </motion.div>

        {/* Rented Card */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => updateFilters({ status: "rented", page: 1 })}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
            currentStatus === "rented"
              ? "bg-sky-50/40 border-sky-500 shadow-xs ring-1 ring-sky-500/20 dark:bg-sky-950/20"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-sky-500/40"
          }`}
        >
          <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            On Rent
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-sky-700 dark:text-sky-300 mt-1">
            <AnimatedCounter value={statsSummary.rentedCount} />
          </div>
        </motion.div>

        {/* Breakdown Card */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            const next = healthStatusFilter === "breakdown" ? "all" : "breakdown";
            setHealthStatusFilter(next);
            updateFilters({ health_status: next, page: 1 });
          }}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
            healthStatusFilter === "breakdown"
              ? "bg-rose-50/40 border-rose-500 shadow-xs ring-1 ring-rose-500/20 dark:bg-rose-950/20"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-rose-500/40"
          }`}
        >
          <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Breakdown Events
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-rose-700 dark:text-rose-300 mt-1">
            <AnimatedCounter value={statsSummary.breakdownCount} />
          </div>
        </motion.div>
      </div>

      {/* Search Bar & Filter Toolbar */}
      <FilterToolbar
            searchQuery={localSearchTerm}
            onSearchChange={handleSearchChange}
            placeholder="Search Machine ID, Model, Serial Number..."
            activeFilterCount={activeFilterCount}
            onResetFilters={handleResetAllFilters}
            onSubmitSearch={handleSearchSubmit}
            isLoading={isPending || isSearchLoading}
            actions={

              <div className="flex items-center gap-2">
                {/* View Switcher is strictly hidden on mobile viewports (≤640px) per feedback #1 */}
                <div className="hidden sm:flex items-center bg-[var(--color-hairline-soft-surface)] p-0.5 rounded-lg border border-[var(--color-hairline)] text-xs h-9 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode("auto")}
                    className={`h-full px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
                      viewMode === "auto"
                        ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-semibold shadow-xs border border-[var(--color-hairline)]"
                        : "text-[var(--color-mute)] hover:text-[var(--color-ink)] border border-transparent"
                    }`}
                    title="Auto responsive view"
                  >
                    Auto View
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("cards")}
                    onMouseEnter={() => cardsIconRef.current?.startAnimation?.()}
                    onMouseLeave={() => cardsIconRef.current?.stopAnimation?.()}
                    className={`h-full px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
                      viewMode === "cards"
                        ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-semibold shadow-xs border border-[var(--color-hairline)]"
                        : "text-[var(--color-mute)] hover:text-[var(--color-ink)] border border-transparent"
                    }`}
                    title="Cards view"
                  >
                    <AnimatedSlidersHorizontal ref={cardsIconRef as any} size={14} className="shrink-0" />
                    <span>Cards</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    onMouseEnter={() => tableIconRef.current?.startAnimation?.()}
                    onMouseLeave={() => tableIconRef.current?.stopAnimation?.()}
                    className={`h-full px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
                      viewMode === "table"
                        ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-semibold shadow-xs border border-[var(--color-hairline)]"
                        : "text-[var(--color-mute)] hover:text-[var(--color-ink)] border border-transparent"
                    }`}
                    title="Table view"
                  >
                    <AnimatedFileText ref={tableIconRef as any} size={14} className="shrink-0" />
                    <span>Table</span>
                  </button>
                </div>
              </div>
            }
          >
            <div className="flex flex-col gap-3 w-full">
              {/* Responsive Custom Dropdown Filter Selectors for Status, Health, Supervisor & Sort */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full">
                {/* 1. Rental Status Selector */}
                <div className="w-full sm:w-48 min-w-0">
                  <CustomFilterSelector
                    label="Rental"
                    value={currentStatus}
                    onChange={(val) => updateFilters({ status: val, page: 1 })}
                    options={RENTAL_STATUS_OPTIONS}
                    ariaLabel="Filter by rental status"
                    align="left"
                  />
                </div>

                {/* 2. Health Status Selector */}
                <div className="w-full sm:w-52 min-w-0">
                  <CustomFilterSelector
                    label="Health"
                    value={healthStatusFilter}
                    onChange={(val) => {
                      setHealthStatusFilter(val);
                      updateFilters({ health_status: val, page: 1 });
                    }}
                    options={HEALTH_STATUS_OPTIONS}
                    ariaLabel="Filter by health status"
                    align="right"
                  />
                </div>

                {/* 3. Supervisor Selector */}
                <div className="w-full sm:w-56 min-w-0" onMouseEnter={loadSupervisors} onFocus={loadSupervisors}>
                  <CustomFilterSelector
                    label="Supervisor"
                    value={supervisorFilter}
                    onChange={(val) => {
                      setSupervisorFilter(val);
                      updateFilters({ supervisor: val, page: 1 });
                    }}
                    options={supervisorOptions}
                    ariaLabel="Filter by supervisor"
                    align="left"
                  />
                </div>

                {/* 4. Sort By Selector */}
                <div className="w-full sm:w-52 min-w-0">
                  <CustomFilterSelector
                    label="Sort"
                    value={sortBy}
                    onChange={(val) => {
                      setSortBy(val);
                      updateFilters({ sort: val, page: 1 });
                    }}
                    options={SORT_OPTIONS}
                    ariaLabel="Sort machines"
                    align="right"
                    icon={
                      <AnimatedArrowUpDown
                        size={14}
                        className="text-[var(--color-mute)] shrink-0 group-hover:text-[var(--color-ink)]"
                      />
                    }
                  />
                </div>
              </div>

              {/* Active Filter Badge Chips */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--color-hairline)] text-xs">
                  <span className="text-[11px] font-semibold text-[var(--color-mute)] mr-1">
                    Active Filters:
                  </span>
                  {localSearchTerm.trim() !== "" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)] font-medium">
                      <span>Search: &quot;{localSearchTerm}&quot;</span>
                      <button
                        type="button"
                        onClick={() => handleSearchChange("")}
                        className="hover:text-rose-600 transition-colors cursor-pointer"
                        title="Clear search"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {currentStatus !== "all" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 font-medium">
                      <span>Rental: {currentStatus === "available" ? "Available" : "Rented"}</span>
                      <button
                        type="button"
                        onClick={() => updateFilters({ status: "all", page: 1 })}
                        className="hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {healthStatusFilter !== "all" && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border font-medium ${
                        healthStatusFilter === "spare"
                          ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20"
                          : healthStatusFilter === "breakdown"
                          ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                      }`}
                    >
                      <span>Health: {healthStatusFilter.replace(/_/g, " ")}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setHealthStatusFilter("all");
                          updateFilters({ health_status: "all", page: 1 });
                        }}
                        className="hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {supervisorFilter !== "all" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-medium">
                      <span>
                        Supervisor:{" "}
                        {supervisorOptions.find((s) => s.id === supervisorFilter)?.label || supervisorFilter}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSupervisorFilter("all");
                          updateFilters({ supervisor: "all", page: 1 });
                        }}
                        className="hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {sortBy !== "machine_id_asc" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)] font-medium">
                      <span>Sort: {SORT_OPTIONS.find((s) => s.id === sortBy)?.label || sortBy}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy("machine_id_asc");
                          updateFilters({ sort: "machine_id_asc", page: 1 });
                        }}
                        className="hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleResetAllFilters}
                    className="text-[11px] font-bold text-[var(--color-link)] hover:underline ml-1 cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>
          </FilterToolbar>

          {/* Main Table / Grid Display — Mutually Exclusive View Rendering (M6) */}
          {effectiveView === "table" ? (
            /* Table Only View: mounts solely EnterpriseTable (Cards are completely unmounted) */
            <div className="w-full">
              <EnterpriseTable
                columns={tableColumns}
                data={activeMachines}
                loading={isPending || isSearchLoading}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                bulkActions={tableBulkActions}
                emptyMessage={
                  isSearchActive
                    ? `No machines found matching "${localSearchTerm}"`
                    : "No machines match your criteria"
                }
                emptyDescription={
                  isSearchActive
                    ? "No records matched Machine ID, Model, or Serial Number. Check for typos or clear your search to view all machines."
                    : "Try adjusting filters or search terms."
                }
                emptyAction={
                  isSearchActive ? (
                    <Button variant="secondary" size="sm" onClick={() => handleSearchChange("")}>
                      Clear Search
                    </Button>
                  ) : undefined
                }
                onRowClick={handleRowClick}
              />
            </div>
          ) : (
            /* Cards Only View: mounts solely Touch Cards (Table is completely unmounted) */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {isPending || isSearchLoading ? (
                <MobileMachineCardSkeletonList />
              ) : activeMachines.length === 0 ? (
                userRole === "operator" ? (
                  <div className="col-span-full max-w-md mx-auto py-12 px-4 text-center rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex flex-col items-center justify-center gap-3 w-full shadow-xs">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--color-hairline-soft-surface)] flex items-center justify-center text-[var(--color-mute)] border border-[var(--color-hairline)] mb-1">
                      <AnimatedWrench className="w-6 h-6 text-[var(--color-mute)]" />
                    </div>
                    <div className="text-base font-bold text-[var(--color-ink)]">
                      {isSearchActive ? `No machines found matching "${localSearchTerm}"` : "No Machine Assigned"}
                    </div>
                    <p className="text-xs text-[var(--color-mute)] max-w-sm leading-relaxed">
                      {isSearchActive
                        ? "No assigned equipment matched your search or filters. Try adjusting your query or resetting filters."
                        : "You do not currently have a machine assigned to your account. Please reach out to your site supervisor to be assigned to active equipment."}
                    </p>
                    {isSearchActive ? (
                      <Button variant="secondary" size="sm" onClick={() => handleSearchChange("")} className="mt-1">
                        Clear Search
                      </Button>
                    ) : (
                      <Link href="/operations" className="mt-2">
                        <Button variant="primary" size="sm" className="min-h-[40px]">
                          Go to Operations Hub
                        </Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="col-span-full py-12 px-4 text-center rounded-2xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-hairline-soft-surface)] flex items-center justify-center text-[var(--color-mute)]">
                      <Search className="w-5 h-5" />
                    </div>
                    <div className="text-sm font-semibold text-[var(--color-ink)]">
                      {isSearchActive
                        ? `No machines found matching "${localSearchTerm}"`
                        : "No machines match your criteria"}
                    </div>
                    <p className="text-xs text-[var(--color-mute)] max-w-sm">
                      {isSearchActive
                        ? "No records matched Machine ID, Model, or Serial Number. Check for typos or clear your search to view all machines."
                        : "Try adjusting filters or search terms."}
                    </p>
                    {isSearchActive && (
                      <Button variant="secondary" size="sm" onClick={() => handleSearchChange("")} className="mt-1">
                        Clear Search
                      </Button>
                    )}
                  </div>
                )
              ) : (
                <>
                  <AnimatePresence mode="popLayout">
                    {displayedCardsMachines.map((m) => (
                      <MobileMachineCard
                        key={m.id}
                        machine={m}
                        isAdmin={isAdmin}
                        isSupervisor={isSupervisor}
                        searchTerm={localSearchTerm}
                        onEditMachine={handleOpenEditMachine}
                        onEditPersonnel={handleOpenEditPersonnel}
                        onEditClient={handleOpenEditClient}
                        onViewAudit={handleViewAudit}
                        onViewLogs={handleViewLogs}
                        onDelete={handleOpenDelete}
                        onEdit={handleOpenEditMachine}
                        onViewAssignments={handleOpenAssignments}
                        onViewHistory={handleOpenHistory}
                        onViewDetails={handleOpenDetail}
                      />
                    ))}
                  </AnimatePresence>

                  {/* Skeletons while loading more machines chunk-by-chunk on mobile */}
                  {isLoadingMoreMobile && (
                    <MobileMachineCardSkeletonList count={2} />
                  )}
                </>
              )}
            </div>
          )}

          {/* Infinite Scroll Sentinel for Mobile */}
          {!isDesktop && !isSearchActive && mobileHasMore && !loadMoreMobileError && !isPending && (
            <div ref={mobileSentinelRef} className="h-6 w-full pointer-events-none" />
          )}

          {/* Mobile Load More Error with Retry */}
          {!isDesktop && !isSearchActive && loadMoreMobileError && (
            <div className="p-3 my-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center justify-between gap-3 text-xs shadow-xs">
              <span className="text-[var(--color-error)] font-medium">{loadMoreMobileError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMobileRetry}
                className="h-7 px-3 text-xs font-semibold rounded-md border-[var(--color-hairline)] hover:bg-[var(--color-hairline-soft-surface)] flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                Retry
              </Button>
            </div>
          )}

          {/* End-of-List Indicator on Mobile */}
          {!isDesktop && !isSearchActive && !mobileHasMore && mobileMachinesList.length > 0 && !isPending && (
            <div className="py-6 flex items-center justify-center gap-3 text-xs text-[var(--color-mute)] select-none">
              <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
              <span className="font-medium text-[var(--color-mute)]">All machines have been displayed</span>
              <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
            </div>
          )}

          {/* Pagination */}
          {activeTotalPages > 1 && (
            <div className="px-1 sm:px-2 pt-2 hidden sm:block">
              <Pagination
                page={activeCurrentPage}
                pageSize={activePageSize}
                total={activeTotal}
                onPageChange={handlePageChange}
              />
            </div>
          )}

      {/* 1. Dedicated Machine Info Modal (Specs, HMR, Health) */}
      {editInfoModalOpen && editInfoMachine && (
        <MachineInfoModal
          isOpen={editInfoModalOpen}
          onClose={() => {
            setEditInfoModalOpen(false);
            setEditInfoMachine(null);
          }}
          machine={editInfoMachine}
          onMachineUpdated={handleMachineUpdatedFromModal}
        />
      )}

      {/* 2. Dedicated Machine Personnel Modal (Supervisor & Operator) */}
      {editPersonnelModalOpen && editPersonnelMachine && (
        <MachinePersonnelModal
          isOpen={editPersonnelModalOpen}
          onClose={() => {
            setEditPersonnelModalOpen(false);
            setEditPersonnelMachine(null);
          }}
          machine={editPersonnelMachine}
          supervisors={lazySupervisors}
          operators={lazyOperators}
          userRole={userRole}
          onMachineUpdated={handleMachineUpdatedFromModal}
        />
      )}

      {/* 3. Dedicated Machine Client Modal (Client Assignment & Deployment) */}
      {editClientModalOpen && editClientMachine && (
        <MachineClientModal
          isOpen={editClientModalOpen}
          onClose={() => {
            setEditClientModalOpen(false);
            setEditClientMachine(null);
          }}
          machine={editClientMachine}
          clients={lazyClients}
          onMachineUpdated={handleMachineUpdatedFromModal}
        />
      )}

      {/* Machine Create Modal */}
      {modalOpen && (
        <MachineModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingMachine(null);
          }}
          machine={editingMachine}
          supervisors={lazySupervisors.length > 0 ? lazySupervisors : undefined}
          operators={lazyOperators.length > 0 ? lazyOperators : undefined}
          clients={lazyClients.length > 0 ? lazyClients : undefined}
          userRole={userRole}
          onSuccess={() => {
            setModalOpen(false);
            setEditingMachine(null);
            router.refresh();
          }}
        />
      )}

      {/* Machine Bulk Excel Import Modal */}
      {importModalOpen && (
        <MachineImportModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onSuccess={() => {
            setImportModalOpen(false);
            router.refresh();
          }}
        />
      )}

      {/* Machine Directory PDF & Printable Report Modal */}
      {pdfModalOpen && (
        <PrintableMachineDirectoryModal
          open={pdfModalOpen}
          onClose={() => {
            setPdfModalOpen(false);
            setPdfSelectedIds([]);
          }}
          machines={pdfMachines.length > 0 ? pdfMachines : machines}
          selectedIds={pdfSelectedIds}
          title={
            pdfSelectedIds.length > 0
              ? `Selected Machines PDF Report (${pdfSelectedIds.length})`
              : "Machine Fleet Directory PDF Report"
          }
        />
      )}

      {/* On-Demand Progressive Shift Coverage Modal */}
      {assignmentModalOpen && activeAssignmentMachine && (
        <MachineAssignmentsQuickModal
          machine={activeAssignmentMachine}
          open={assignmentModalOpen}
          onClose={() => {
            setAssignmentModalOpen(false);
            setActiveAssignmentMachine(null);
          }}
        />
      )}

      {/* On-Demand Progressive Running History Logs Modal */}
      {historyModalOpen && activeHistoryMachine && (
        <MachineHistoryQuickModal
          machine={activeHistoryMachine}
          open={historyModalOpen}
          onClose={() => {
            setHistoryModalOpen(false);
            setActiveHistoryMachine(null);
          }}
        />
      )}


      {/* Delete Confirmation Dialog */}
      {deletingMachine && (
        <ConfirmationDialog
          isOpen={!!deletingMachine}
          onClose={() => setDeletingMachine(null)}
          onConfirm={handleDeleteConfirm}
          title={`Delete Machine ${deletingMachine.machine_id}?`}
          description={`Are you sure you want to delete machine ${deletingMachine.machine_id}? This action cannot be undone.`}
          confirmLabel="Delete Machine"
          variant="danger"
          loading={isPending}
        />
      )}
    </div>
  );
}

