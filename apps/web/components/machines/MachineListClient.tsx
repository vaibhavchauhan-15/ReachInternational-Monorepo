"use client";

import { useState, useTransition, useMemo, useCallback, useDeferredValue, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
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
} from "@/components/ui/animated-icons";
import { MoreVertical, Download, FileSpreadsheet, FileText, Printer, Check, X, ChevronDown } from "lucide-react";
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
import { AnimatedCounter } from "@/components/ui/Motion";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { deleteMachine } from "@/app/actions/machines";
import { exportMachinesToExcel, exportMachinesToCSV } from "@/lib/utils/machines-export";
import type { Machine, User, UserRole } from "@/lib/types/database";

const MobileMachineCard = dynamic(
  () => import("./MobileMachineCard").then((mod) => mod.MobileMachineCard),
  { ssr: false }
);

const MachineModal = dynamic<React.ComponentProps<typeof import("./MachineModal").MachineModal>>(
  () => import("./MachineModal").then((mod) => mod.MachineModal),
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
}

// Reusable responsive filter selector dropdown with mobile edge clamping
function CustomFilterSelector({
  label,
  value,
  onChange,
  options,
  ariaLabel,
  align = "left",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { id: string; label: string; activeColor?: string; dotColor?: string }[];
  ariaLabel?: string;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      className={`relative w-full ${open ? "z-40" : "z-10"} ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={ariaLabel || label}
        className="w-full h-9 sm:h-9 px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-xs text-[var(--color-ink)] flex items-center justify-between gap-2 transition-all cursor-pointer select-none active:scale-[0.98] shadow-2xs"
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
        <ChevronDown
          className={`h-3.5 w-3.5 text-[var(--color-mute)] shrink-0 transition-transform duration-200 ${
            open ? "rotate-180 text-[var(--color-ink)]" : ""
          }`}
        />
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
                  className={`w-full min-h-[36px] flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-all cursor-pointer active:scale-[0.98] ${
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
}

// Contextual Row Actions Menu (⋮)
function RowActionsMenu({
  machine,
  canEdit,
  isAdmin,
  onEdit,
  onDelete,
}: {
  machine: Machine;
  canEdit: boolean;
  isAdmin: boolean;
  onEdit: (m: Machine) => void;
  onDelete: (m: Machine) => void;
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

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 176; // 11rem = 176px (w-44)
    const menuHeight = isAdmin ? 140 : 96;
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
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <TooltipWrapper content="More actions">
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
          aria-label="More actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </TooltipWrapper>

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
                  width: "176px",
                }}
                className="pointer-events-auto z-50 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-1 shadow-xl text-xs space-y-0.5"
              >
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onEdit(machine);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                  >
                    <AnimatedEdit size={14} className="text-amber-500" />
                    <span>Edit Machine</span>
                  </button>
                )}



                {isAdmin && (
                  <>
                    <div className="my-1 border-t border-[var(--color-hairline)]" />
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onDelete(machine);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <AnimatedTrash size={14} className="text-rose-500" />
                      <span>Delete Machine</span>
                    </button>
                  </>
                )}
              </motion.div>
            </div>
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

// Secondary Action Header Menu
function HeaderMoreMenu({
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
        aria-expanded={open}
        className="h-9 w-9 sm:w-auto p-0 sm:px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 shrink-0"
        title="More options"
      >
        <span className="font-bold text-sm leading-none">⋮</span>
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
}

const RENTAL_STATUS_OPTIONS = [
  { id: "all", label: "All Rental Status", activeColor: "text-[var(--color-ink)]", dotColor: "" },
  { id: "available", label: "Available", activeColor: "text-emerald-700 dark:text-emerald-400 font-semibold", dotColor: "bg-emerald-500" },
  { id: "rented", label: "Rented", activeColor: "text-sky-700 dark:text-sky-400 font-semibold", dotColor: "bg-sky-500" },
];

const HEALTH_STATUS_OPTIONS = [
  { id: "all", label: "All Health Status", activeColor: "text-[var(--color-ink)]", dotColor: "" },
  { id: "active", label: "Active", activeColor: "text-emerald-700 dark:text-emerald-400 font-semibold", dotColor: "bg-emerald-500" },
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
}: MachineListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(currentSearch);
  const deferredSearch = useDeferredValue(search);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [deletingMachine, setDeletingMachine] = useState<Machine | null>(null);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [viewMode, setViewMode] = useState<"auto" | "cards" | "table">("auto");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfSelectedIds, setPdfSelectedIds] = useState<(string | number)[]>([]);
  const [healthStatusFilter, setHealthStatusFilter] = useState<string>("all");
  const [supervisorFilter, setSupervisorFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("machine_id_asc");

  const canManage =
    userRole === "super_admin" ||
    userRole === "admin" ||
    userRole === "manager" ||
    userRole === "service_manager";
  const isAdmin = canManage;
  const canEdit = canManage || userRole === "supervisor";
  const canCreateMachine = canManage;
  const canDelete = canManage;

  const supervisorOptions = useMemo(() => {
    const map = new Map<string, string>();
    supervisors.forEach((s) => {
      if (s.id && s.full_name) map.set(s.id, s.full_name);
    });
    machines.forEach((m) => {
      if (m.current_supervisor?.full_name && m.current_supervisor_id) {
        map.set(m.current_supervisor_id, m.current_supervisor.full_name);
      }
    });
    const list = Array.from(map.entries()).map(([id, name]) => ({
      id,
      label: name,
    }));
    return [{ id: "all", label: "All Supervisors" }, ...list];
  }, [supervisors, machines]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (currentStatus !== "all") count++;
    if (healthStatusFilter !== "all") count++;
    if (supervisorFilter !== "all") count++;
    if (search.trim() !== "") count++;
    if (sortBy !== "machine_id_asc") count++;
    return count;
  }, [currentStatus, healthStatusFilter, supervisorFilter, search, sortBy]);

  const updateFilters = useCallback(
    (updates: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, val]) => {
        if (val === undefined || val === "" || val === "all" || (key === "page" && val === 1)) {
          params.delete(key);
        } else {
          params.set(key, String(val));
        }
      });
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: deferredSearch, page: 1 });
  };

  const handleResetAllFilters = () => {
    setSearch("");
    setHealthStatusFilter("all");
    setSupervisorFilter("all");
    setSortBy("machine_id_asc");
    startTransition(() => {
      router.push(pathname);
    });
  };

  const handleDeleteConfirm = useCallback(() => {
    if (!deletingMachine) return;
    startTransition(async () => {
      try {
        const res = await deleteMachine(deletingMachine.id);
        if (res?.error) {
          toast("error", "Failed to delete machine", res.error);
        } else {
          toast("success", `Machine ${deletingMachine.machine_id} deleted successfully`);
          setDeletingMachine(null);
          router.refresh();
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "An error occurred";
        toast("error", "Failed to delete machine", errorMsg);
      }
    });
  }, [deletingMachine, router, toast]);

  const handleExportExcel = useCallback(
    (ids: (string | number)[] = []) => {
      const targetMachines =
        ids.length > 0 ? machines.filter((m) => ids.includes(m.id)) : machines;
      if (targetMachines.length === 0) {
        toast("error", "No machines found to export");
        return;
      }
      const prefix = ids.length > 0 ? `Machines-Selected-${targetMachines.length}` : "Machine-Directory";
      exportMachinesToExcel(targetMachines, prefix);
      toast("success", `Exported ${targetMachines.length} machines to Excel (.xlsx)`);
    },
    [machines, toast]
  );

  const handleExportCSV = useCallback(
    (ids: (string | number)[] = []) => {
      const targetMachines =
        ids.length > 0 ? machines.filter((m) => ids.includes(m.id)) : machines;
      if (targetMachines.length === 0) {
        toast("error", "No machines found to export");
        return;
      }
      const prefix = ids.length > 0 ? `Machines-Selected-${targetMachines.length}` : "Machine-Directory";
      exportMachinesToCSV(targetMachines, prefix);
      toast("success", `Exported ${targetMachines.length} machines to CSV (.csv)`);
    },
    [machines, toast]
  );

  const handleOpenPDFModal = useCallback(
    (ids: (string | number)[] = []) => {
      setPdfSelectedIds(ids);
      setPdfModalOpen(true);
    },
    []
  );

  const statsSummary = useMemo(() => {
    let availableCount = 0;
    let rentedCount = 0;
    let breakdownCount = 0;
    let maintenanceCount = 0;

    machines.forEach((m) => {
      if (m.status === "rented") rentedCount++;
      else availableCount++;

      if (m.health_status === "breakdown") breakdownCount++;
      if (m.health_status === "under_maintenance") maintenanceCount++;
    });

    return { availableCount, rentedCount, breakdownCount, maintenanceCount };
  }, [machines]);

  // Client-side instant filter and sort pipeline
  const filteredAndSortedMachines = useMemo(() => {
    let list = [...machines];
    const q = deferredSearch.toLowerCase().trim();
    if (q) {
      list = list.filter((m) => {
        return (
          m.machine_id?.toLowerCase().includes(q) ||
          m.model?.toLowerCase().includes(q) ||
          m.serial_number?.toLowerCase().includes(q) ||
          m.manufacturer?.toLowerCase().includes(q) ||
          m.year_of_mfg?.toLowerCase().includes(q) ||
          m.current_supervisor?.full_name?.toLowerCase().includes(q) ||
          m.current_operator?.full_name?.toLowerCase().includes(q) ||
          m.client?.company_name?.toLowerCase().includes(q) ||
          m.client?.code?.toLowerCase().includes(q) ||
          m.customer_name?.toLowerCase().includes(q)
        );
      });
    }

    if (currentStatus !== "all") {
      list = list.filter((m) => m.status === currentStatus);
    }

    if (healthStatusFilter !== "all") {
      list = list.filter((m) => m.health_status === healthStatusFilter);
    }

    if (supervisorFilter !== "all") {
      list = list.filter(
        (m) =>
          m.current_supervisor_id === supervisorFilter ||
          m.current_supervisor?.full_name === supervisorFilter
      );
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === "machine_id_asc") return (a.machine_id || "").localeCompare(b.machine_id || "");
      if (sortBy === "machine_id_desc") return (b.machine_id || "").localeCompare(a.machine_id || "");
      if (sortBy === "model_asc") return (a.model || "").localeCompare(b.model || "");
      if (sortBy === "newest_yum") return (b.year_of_mfg || "").localeCompare(a.year_of_mfg || "");
      if (sortBy === "oldest_yum") return (a.year_of_mfg || "").localeCompare(b.year_of_mfg || "");
      if (sortBy === "highest_hmr") return (Number(b.hour_meter) || 0) - (Number(a.hour_meter) || 0);
      if (sortBy === "lowest_hmr") return (Number(a.hour_meter) || 0) - (Number(b.hour_meter) || 0);
      return 0;
    });

    return list;
  }, [machines, deferredSearch, currentStatus, healthStatusFilter, supervisorFilter, sortBy]);

  const handlePageChange = useCallback(
    (newPage: number) => updateFilters({ page: newPage }),
    [updateFilters]
  );

  const tableColumns = useMemo(
    () => [
      {
        id: "machine_id",
        header: "MACHINE ID",
        accessorKey: "machine_id" as const,
        sortable: true,
        width: "11%",
        cell: (row: Machine) => (
          <Link
            href={`/machines/${row.id}`}
            className="font-mono text-xs font-bold text-[var(--color-ink)] hover:text-sky-600 dark:hover:text-sky-400 hover:underline whitespace-nowrap"
          >
            {row.machine_id}
          </Link>
        ),
      },
      {
        id: "model",
        header: "MODEL",
        accessorKey: "model" as const,
        sortable: true,
        width: "10%",
        cell: (row: Machine) => (
          <span className="text-xs font-semibold text-[var(--color-ink)] whitespace-nowrap">
            {row.model || "—"}
          </span>
        ),
      },
      {
        id: "serial_no",
        header: "SERIAL NO.",
        accessorKey: "serial_number" as const,
        sortable: true,
        width: "11%",
        cell: (row: Machine) => (
          <span className="font-mono text-xs text-[var(--color-body)] font-medium whitespace-nowrap">
            {row.serial_number || "—"}
          </span>
        ),
      },
      {
        id: "yum",
        header: "YUM",
        accessorKey: "year_of_mfg" as const,
        sortable: true,
        width: "6%",
        cell: (row: Machine) => (
          <span className="text-xs text-[var(--color-mute)] font-medium whitespace-nowrap">
            {row.year_of_mfg || "—"}
          </span>
        ),
      },
      {
        id: "hours",
        header: "HMR (HRS)",
        accessorKey: "hour_meter" as const,
        sortable: true,
        width: "9%",
        cell: (row: Machine) => (
          <span className="font-mono text-xs font-bold text-[var(--color-ink)] whitespace-nowrap">
            {row.hour_meter || 0}
          </span>
        ),
      },
      {
        id: "client",
        header: "CLIENT",
        sortable: true,
        width: "13%",
        cell: (row: Machine) => {
          const clientName = row.client?.company_name || row.customer_name;
          const clientCode = row.client?.code;
          if (!clientName) {
            return (
              <span className="text-xs text-[var(--color-mute)] font-medium">—</span>
            );
          }
          return (
            <div className="flex flex-col min-w-0 max-w-[130px]">
              <span
                className="text-xs font-semibold text-[var(--color-ink)] truncate block"
                title={`${clientName}${clientCode ? ` (${clientCode})` : ""}`}
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
        cell: (row: Machine) => {
          const name = row.current_supervisor?.full_name || "Unassigned";
          return (
            <span
              className="text-xs font-medium text-[var(--color-body)] truncate block max-w-[110px]"
              title={name}
            >
              {name}
            </span>
          );
        },
      },
      {
        id: "operator",
        header: "OPERATOR",
        width: "12%",
        cell: (row: Machine) => {
          const name = row.current_operator?.full_name || "Unassigned";
          return (
            <span
              className="text-xs font-medium text-[var(--color-body)] truncate block max-w-[110px]"
              title={name}
            >
              {name}
            </span>
          );
        },
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
          <RowActionsMenu
            machine={row}
            canEdit={canEdit}
            isAdmin={isAdmin}
            onEdit={(m) => {
              setEditingMachine(m);
              setModalOpen(true);
            }}
            onDelete={(m) => setDeletingMachine(m)}
          />
        ),
      },
    ],
    [canEdit, isAdmin]
  );

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-6">
      {/* Canonical Page Header */}
      <PageHeader
        title="Machine Directory"
        breadcrumbs={[{ label: "Machines" }]}
            actions={
              <div className="flex items-center gap-2">
                <ExportButton
                  format="xlsx"
                  iconOnly
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
              <div className="text-[10px] sm:text-[11px] font-semibold text-[var(--color-mute)] uppercase tracking-wider">
                Total Machines
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-[var(--color-ink)] mt-1">
                <AnimatedCounter value={total} />
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
                Available Fleet
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
              onClick={() => setHealthStatusFilter(healthStatusFilter === "breakdown" ? "all" : "breakdown")}
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
            searchQuery={search}
            onSearchChange={setSearch}
            placeholder="Search Machine ID, Model, Serial Number..."
            activeFilterCount={activeFilterCount}
            onResetFilters={handleResetAllFilters}
            onSubmitSearch={handleSearchSubmit}
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
                    className={`h-full px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
                      viewMode === "cards"
                        ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-semibold shadow-xs border border-[var(--color-hairline)]"
                        : "text-[var(--color-mute)] hover:text-[var(--color-ink)] border border-transparent"
                    }`}
                    title="Cards view"
                  >
                    <AnimatedSlidersHorizontal size={13} />
                    <span>Cards</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`h-full px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
                      viewMode === "table"
                        ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-semibold shadow-xs border border-[var(--color-hairline)]"
                        : "text-[var(--color-mute)] hover:text-[var(--color-ink)] border border-transparent"
                    }`}
                    title="Table view"
                  >
                    <AnimatedFileText size={13} />
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
                    onChange={(val) => setHealthStatusFilter(val)}
                    options={HEALTH_STATUS_OPTIONS}
                    ariaLabel="Filter by health status"
                    align="right"
                  />
                </div>

                {/* 3. Supervisor Selector */}
                <div className="w-full sm:w-56 min-w-0">
                  <CustomFilterSelector
                    label="Supervisor"
                    value={supervisorFilter}
                    onChange={(val) => setSupervisorFilter(val)}
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
                    onChange={(val) => setSortBy(val)}
                    options={SORT_OPTIONS}
                    ariaLabel="Sort machines"
                    align="right"
                  />
                </div>
              </div>

              {/* Active Filter Badge Chips */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--color-hairline)] text-xs">
                  <span className="text-[11px] font-semibold text-[var(--color-mute)] mr-1">
                    Active Filters:
                  </span>
                  {search.trim() !== "" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)] font-medium">
                      <span>Search: &quot;{search}&quot;</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          updateFilters({ search: undefined, page: 1 });
                        }}
                        className="hover:text-rose-600 transition-colors cursor-pointer"
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
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-medium">
                      <span>Health: {healthStatusFilter.replace(/_/g, " ")}</span>
                      <button
                        type="button"
                        onClick={() => setHealthStatusFilter("all")}
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
                        onClick={() => setSupervisorFilter("all")}
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
                        onClick={() => setSortBy("machine_id_asc")}
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

          {/* Main Table / Grid Display */}
          {viewMode === "cards" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              <AnimatePresence mode="popLayout">
                {filteredAndSortedMachines.map((m) => (
                  <MobileMachineCard
                    key={m.id}
                    machine={m}
                    isAdmin={isAdmin}
                    onEdit={(mach: Machine) => {
                      setEditingMachine(mach);
                      setModalOpen(true);
                    }}
                    onDelete={(mach: Machine) => setDeletingMachine(mach)}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : viewMode === "table" ? (
            <>
              {/* Desktop Table View (hidden sm:block) */}
              <div className="hidden sm:block">
                <EnterpriseTable
                  columns={tableColumns}
                  data={filteredAndSortedMachines}
                  loading={isPending}
                  selectable={true}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  bulkActions={[
                    {
                      label: `Excel (${selectedIds.length})`,
                      icon: FileSpreadsheet,
                      onClick: (ids) => handleExportExcel(ids),
                    },
                    {
                      label: `CSV (${selectedIds.length})`,
                      icon: FileText,
                      onClick: (ids) => handleExportCSV(ids),
                    },
                    {
                      label: `PDF (${selectedIds.length})`,
                      icon: Printer,
                      onClick: (ids) => handleOpenPDFModal(ids),
                    },
                  ]}
                  emptyMessage="No machines match your criteria"
                  emptyDescription="Try adjusting filters or search terms."
                  onRowClick={(row) => router.push(`/machines/${row.id}`)}
                />
              </div>

              {/* Mobile Card Grid View for viewMode=table */}
              <div className="block sm:hidden space-y-3">
                <AnimatePresence mode="popLayout">
                  {filteredAndSortedMachines.map((m) => (
                    <MobileMachineCard
                      key={m.id}
                      machine={m}
                      isAdmin={isAdmin}
                      onEdit={(mach: Machine) => {
                        setEditingMachine(mach);
                        setModalOpen(true);
                      }}
                      onDelete={(mach: Machine) => setDeletingMachine(mach)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </>
          ) : (
            /* Auto Responsive View: Desktop Table, Mobile Touch Cards */
            <>
              <div className="hidden sm:block">
                <EnterpriseTable
                  columns={tableColumns}
                  data={filteredAndSortedMachines}
                  loading={isPending}
                  selectable={true}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  bulkActions={[
                    {
                      label: `Excel (${selectedIds.length})`,
                      icon: FileSpreadsheet,
                      onClick: (ids) => handleExportExcel(ids),
                    },
                    {
                      label: `CSV (${selectedIds.length})`,
                      icon: FileText,
                      onClick: (ids) => handleExportCSV(ids),
                    },
                    {
                      label: `PDF (${selectedIds.length})`,
                      icon: Printer,
                      onClick: (ids) => handleOpenPDFModal(ids),
                    },
                  ]}
                  emptyMessage="No machines match your criteria"
                  emptyDescription="Try adjusting filters or search terms."
                  onRowClick={(row) => router.push(`/machines/${row.id}`)}
                />
              </div>

              <div className="block sm:hidden space-y-3">
                <AnimatePresence mode="popLayout">
                  {filteredAndSortedMachines.map((m) => (
                    <MobileMachineCard
                      key={m.id}
                      machine={m}
                      isAdmin={isAdmin}
                      onEdit={(mach: Machine) => {
                        setEditingMachine(mach);
                        setModalOpen(true);
                      }}
                      onDelete={(mach: Machine) => setDeletingMachine(mach)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-1 sm:px-2 pt-2">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={handlePageChange}
              />
            </div>
          )}

      {/* Machine Create / Edit Modal */}
      {modalOpen && (
        <MachineModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingMachine(null);
          }}
          machine={editingMachine}
          supervisors={supervisors}
          operators={operators}
          clients={clients}
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
          machines={machines}
          selectedIds={pdfSelectedIds}
          title={
            pdfSelectedIds.length > 0
              ? `Selected Machines PDF Report (${pdfSelectedIds.length})`
              : "Machine Fleet Directory PDF Report"
          }
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

