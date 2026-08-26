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
} from "@/components/ui/animated-icons";
import { MoreVertical, Download } from "lucide-react";
import {
  Button,
  Pagination,
  useToast,
  SearchableSelect,
  EnterpriseTable,
  ConfirmationDialog,
  Badge,
  FilterToolbar,
  TooltipWrapper,
} from "@/components/ui";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { deleteMachine } from "@/app/actions/machines";
import type { Machine, User, UserRole, ComplaintWithDetails } from "@/lib/types/database";
import type { EngineerServicesData } from "@/lib/queries/services";

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

const ComplaintsClient = dynamic(
  () => import("@/components/complaints/ComplaintsClient").then((mod) => mod.ComplaintsClient),
  { ssr: false }
);

const ServicesClient = dynamic(
  () => import("@/components/services/ServicesClient").then((mod) => mod.ServicesClient),
  { ssr: false }
);

interface MachineListClientProps {
  machines: Machine[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  engineers?: User[];
  supervisors?: User[];
  operators?: User[];
  cities?: string[];
  complaints?: ComplaintWithDetails[];
  serviceData?: EngineerServicesData;
  userRole: UserRole;
  currentSearch?: string;
  currentStatus?: string;
  currentEngineerId?: string;
  currentBucket?: string;
  initialTab?: string;
}

// Contextual Row Actions Menu (⋮)
function RowActionsMenu({
  machine,
  canEdit,
  isAdmin,
  onEdit,
  onDelete,
  onNavigate,
}: {
  machine: Machine;
  canEdit: boolean;
  isAdmin: boolean;
  onEdit: (m: Machine) => void;
  onDelete: (m: Machine) => void;
  onNavigate: (tab: string) => void;
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
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                  >
                    <AnimatedEdit size={14} className="text-amber-500" />
                    <span>Edit Machine</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onNavigate("services");
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                >
                  <AnimatedClipboardList size={14} className="text-emerald-500" />
                  <span>Update Service</span>
                </button>

                {isAdmin && (
                  <>
                    <div className="my-1 border-t border-[var(--color-hairline)]" />
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onDelete(machine);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
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
  onExportCSV,
  onRefresh,
}: {
  isAdmin: boolean;
  onOpenImport: () => void;
  onExportCSV: () => void;
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
    const menuWidth = 192; // 12rem = 192px (w-48)
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
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className="flex items-center gap-1 px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors shadow-2xs cursor-pointer"
        title="More options"
      >
        <span>⋮ More</span>
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
                  width: "192px",
                }}
                className="pointer-events-auto z-50 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-1 shadow-xl text-xs space-y-0.5"
              >
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onOpenImport();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                  >
                    <AnimatedClipboardList size={16} className="text-sky-500" />
                    <span>Bulk Excel Import</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onExportCSV();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                >
                  <Download size={16} className="text-emerald-500" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onRefresh();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                >
                  <AnimatedRefresh size={16} className="text-amber-500" />
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

export function MachineListClient({
  machines,
  total,
  page,
  pageSize,
  totalPages,
  supervisors = [],
  operators = [],
  complaints = [],
  serviceData,
  userRole,
  currentSearch = "",
  currentStatus = "all",
  initialTab = "inventory",
}: MachineListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [isPending, startTransition] = useTransition();

  const activeTab = searchParams.get("tab") || initialTab;
  const [search, setSearch] = useState(currentSearch);
  const deferredSearch = useDeferredValue(search);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [deletingMachine, setDeletingMachine] = useState<Machine | null>(null);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [healthStatusFilter, setHealthStatusFilter] = useState<string>("all");

  const isAdmin = userRole === "super_admin" || userRole === "admin";
  const canEdit = isAdmin || userRole === "service_manager" || userRole === "rental_manager" || userRole === "supervisor";
  const canCreateMachine = isAdmin || userRole === "service_manager";

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (currentStatus !== "all") count++;
    if (healthStatusFilter !== "all") count++;
    if (search.trim() !== "") count++;
    return count;
  }, [currentStatus, healthStatusFilter, search]);

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

  const handleExportCSV = useCallback(
    (ids: (string | number)[] = []) => {
      const targetMachines =
        ids.length > 0 ? machines.filter((m) => ids.includes(m.id)) : machines;

      const headers = [
        "Machine ID",
        "Model",
        "Serial No",
        "Year of Mfg (YUM)",
        "Manufacturer",
        "Hour Meter Reading (HMR)",
        "Service Count",
        "Current Supervisor",
        "Current Operator",
        "Health Status",
        "Status",
      ].join(",");

      const rows = targetMachines.map((m) => {
        const supervisorName = m.current_supervisor?.full_name || "Unassigned";
        const operatorName = m.current_operator?.full_name || "Unassigned";
        return [
          `"${(m.machine_id || "").replace(/"/g, '""')}"`,
          `"${(m.model || "").replace(/"/g, '""')}"`,
          `"${(m.serial_number || "").replace(/"/g, '""')}"`,
          `"${(m.year_of_mfg || "").replace(/"/g, '""')}"`,
          `"${(m.manufacturer || "").replace(/"/g, '""')}"`,
          `"${m.hour_meter || 0}"`,
          `"${m.service_count || 0}"`,
          `"${supervisorName.replace(/"/g, '""')}"`,
          `"${operatorName.replace(/"/g, '""')}"`,
          `"${(m.health_status || "").replace(/"/g, '""')}"`,
          `"${(m.status || "").replace(/"/g, '""')}"`,
        ].join(",");
      });

      const csvContent =
        "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `machines_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast("success", `Exported ${targetMachines.length} machine details to CSV`);
    },
    [machines, toast]
  );

  const statsSummary = useMemo(() => {
    let availableCount = 0;
    let rentedCount = 0;
    let breakdownCount = 0;
    let maintenanceCount = 0;

    machines.forEach((m) => {
      if (m.status === "available") availableCount++;
      if (m.status === "rented") rentedCount++;
      if (m.health_status === "breakdown") breakdownCount++;
      if (m.health_status === "under_maintenance") maintenanceCount++;
    });

    return { availableCount, rentedCount, breakdownCount, maintenanceCount };
  }, [machines]);

  const statusOptions = useMemo(
    () => [
      { value: "all", label: "All Rental Status" },
      { value: "available", label: "Available" },
      { value: "rented", label: "Rented" },
    ],
    []
  );

  const healthStatusOptions = useMemo(
    () => [
      { value: "all", label: "All Health Status" },
      { value: "active", label: "Active" },
      { value: "under_maintenance", label: "Under Maintenance" },
      { value: "breakdown", label: "Breakdown" },
    ],
    []
  );

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
        id: "services_count",
        header: "SERVICES",
        accessorKey: "service_count" as const,
        sortable: true,
        width: "8%",
        cell: (row: Machine) => (
          <span className="font-mono text-xs font-bold text-[var(--color-ink)] whitespace-nowrap">
            {row.service_count || 0}
          </span>
        ),
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
            onNavigate={(tab) => updateFilters({ tab, page: 1 })}
          />
        ),
      },
    ],
    [canEdit, isAdmin, updateFilters]
  );

  return (
    <div className="flex flex-col gap-5 pb-20 md:pb-6">
      {/* Top Page Navigation Tabs — Mobile/Tablet Only (lg:hidden, as Desktop Sidebar already has sub-items) */}
      {/* Soft-removed unused sub-menu tabs per user request (Service Logs, Breakdown Complaints) */}
      {/*
      <div className="flex lg:hidden items-center justify-between border-b border-[var(--color-hairline)] pb-3 overflow-x-auto w-full max-w-full gap-2 no-scrollbar">
        <div className="flex items-center gap-1 bg-[var(--color-hairline-soft-surface)] p-1 rounded-xl border border-[var(--color-hairline)] shrink-0 w-full sm:w-auto overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => updateFilters({ tab: "inventory", page: 1 })}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[40px] ${
              activeTab === "inventory"
                ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-xs"
                : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
            }`}
          >
            <AnimatedWrench size={15} className={activeTab === "inventory" ? "text-sky-500" : ""} />
            <span>Machine Directory</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">
              {total}
            </span>
          </button>
        </div>
      </div>
      */}
      {/* TAB 2: Service Logs View */}
      {activeTab === "services" && serviceData && (
        <ServicesClient data={serviceData} />
      )}

      {/* TAB 3: Breakdown Complaints View */}
      {activeTab === "complaints" && (
        <ComplaintsClient
          complaints={complaints}
          total={complaints.length}
          machines={[]}
          engineers={[]}
          supervisors={supervisors}
          userRole={userRole}
        />
      )}

      {/* TAB 1: Equipment Inventory View */}
      {activeTab === "inventory" && (
        <>
          <div className="flex flex-row items-center justify-between gap-4">
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-ink)]">
              Machine Directory
            </h1>

            <div className="flex items-center gap-2">
              <HeaderMoreMenu
                isAdmin={isAdmin}
                onOpenImport={() => setImportModalOpen(true)}
                onExportCSV={() => handleExportCSV(selectedIds)}
                onRefresh={() => router.refresh()}
              />

              {canCreateMachine && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMachine(null);
                    setModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white shadow-sm transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <AnimatedPlus size={16} />
                  <span>Add Machine</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive KPI Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Card */}
            <div
              onClick={() => updateFilters({ status: "all", page: 1 })}
              className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                currentStatus === "all"
                  ? "bg-[var(--color-ink)] text-[var(--color-canvas)] border-[var(--color-ink)] shadow-md"
                  : "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]"
              }`}
            >
              <div className="text-[11px] font-semibold text-[var(--color-mute)] uppercase tracking-wider">
                Total Machines
              </div>
              <div className="text-2xl font-black mt-1">{total}</div>
            </div>

            {/* Available Card */}
            <div
              onClick={() => updateFilters({ status: "available", page: 1 })}
              className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                currentStatus === "available"
                  ? "bg-emerald-600 text-white border-emerald-700 shadow-md font-bold"
                  : "bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-900/60 hover:bg-emerald-500/20"
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider">Available Fleet</div>
              <div className="text-2xl font-black mt-1">{statsSummary.availableCount}</div>
            </div>

            {/* Rented Card */}
            <div
              onClick={() => updateFilters({ status: "rented", page: 1 })}
              className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                currentStatus === "rented"
                  ? "bg-sky-600 text-white border-sky-700 shadow-md font-bold"
                  : "bg-sky-500/10 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-900/60 hover:bg-sky-500/20"
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider">On Rent</div>
              <div className="text-2xl font-black mt-1">{statsSummary.rentedCount}</div>
            </div>

            {/* Breakdown Card */}
            <div
              onClick={() => setHealthStatusFilter(healthStatusFilter === "breakdown" ? "all" : "breakdown")}
              className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                healthStatusFilter === "breakdown"
                  ? "bg-rose-600 text-white border-rose-700 shadow-md font-bold"
                  : "bg-rose-500/10 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300/80 dark:border-rose-900/80 hover:bg-rose-500/20"
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider">Breakdown Events</div>
              <div className="text-2xl font-black mt-1">{statsSummary.breakdownCount}</div>
            </div>
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
                <div className="flex items-center gap-1 bg-[var(--color-hairline-soft-surface)] p-1 rounded-lg border border-[var(--color-hairline)] text-xs shrink-0">
                  <TooltipWrapper content="Switch to table view">
                    <button
                      type="button"
                      onClick={() => setViewMode("table")}
                      aria-label="Switch to table view"
                      className={`flex items-center gap-1 px-2.5 py-1 rounded font-semibold transition-all cursor-pointer ${
                        viewMode === "table"
                          ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-2xs"
                          : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                      }`}
                    >
                      <span className="hidden sm:inline">Table</span>
                    </button>
                  </TooltipWrapper>
                  <TooltipWrapper content="Switch to cards grid view">
                    <button
                      type="button"
                      onClick={() => setViewMode("cards")}
                      aria-label="Switch to cards grid view"
                      className={`flex items-center gap-1 px-2.5 py-1 rounded font-semibold transition-all cursor-pointer ${
                        viewMode === "cards"
                          ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-2xs"
                          : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                      }`}
                    >
                      <span className="hidden sm:inline">Cards</span>
                    </button>
                  </TooltipWrapper>
                </div>

                {isAdmin && selectedIds.length > 0 && (
                  <Button
                    variant="secondary"
                    onClick={() => handleExportCSV(selectedIds)}
                    className="text-xs justify-center shrink-0"
                  >
                    <Download size={14} className="mr-1" /> CSV ({selectedIds.length})
                  </Button>
                )}
              </div>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
              <SearchableSelect
                options={statusOptions}
                value={currentStatus}
                onChange={(val) => updateFilters({ status: val, page: 1 })}
                placeholder="Filter Rental Status"
              />

              <SearchableSelect
                options={healthStatusOptions}
                value={healthStatusFilter}
                onChange={(val) => setHealthStatusFilter(val)}
                placeholder="Filter Health Status"
              />
            </div>
          </FilterToolbar>

          {/* Main Table / Grid Display */}
          {viewMode === "cards" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {machines.map((m) => (
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
          ) : (
            <>
              {/* Desktop Table View (hidden sm:hidden md:block) */}
              <div className="hidden sm:block">
                <EnterpriseTable
                  columns={tableColumns}
                  data={machines}
                  loading={isPending}
                  selectable={true}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  bulkActions={[
                    {
                      label: "Export Selected CSV",
                      icon: Download,
                      onClick: handleExportCSV,
                    },
                  ]}
                  emptyMessage="No machines match your criteria"
                  emptyDescription="Try adjusting filters or search terms."
                  onRowClick={(row) => router.push(`/machines/${row.id}`)}
                />
              </div>

              {/* Mobile Card Grid View (block sm:hidden) */}
              <div className="block sm:hidden space-y-3">
                <AnimatePresence mode="popLayout">
                  {machines.map((m) => (
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
            <div className="px-2 pt-2">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
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
