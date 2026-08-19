"use client";

import { useState, useTransition, useMemo, useCallback, useDeferredValue } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AnimatedPlus,
  AnimatedCalendarClock,
  AnimatedAlertTriangle,
  AnimatedDownload,
  AnimatedEdit,
  AnimatedTrash,
  AnimatedSearch,
  AnimatedSlidersHorizontal,
  AnimatedX,
  AnimatedRotateCcw,
  AnimatedFileText,
  AnimatedRefresh,
  AnimatedClipboardList,
} from "@/components/ui/animated-icons";
import { MoreVertical, Download } from "lucide-react";
import {
  Button,
  Pagination,
  useToast,
  PageHeader,
  SearchableSelect,
  EnterpriseTable,
  ConfirmationDialog,
  Badge,
  EmptyState,
  RefreshButton,
  FilterToolbar,
  TooltipWrapper,
} from "@/components/ui";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { deleteMachine } from "@/app/actions/machines";
import type { MachineWithEngineer, User, UserRole } from "@/lib/types/database";
import type { ComplaintWithDetails } from "@/lib/types/database";
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
  machines: MachineWithEngineer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  engineers: User[];
  supervisors?: User[];
  cities: string[];
  complaints?: ComplaintWithDetails[];
  serviceData?: EngineerServicesData;
  userRole: UserRole;
  currentSearch?: string;
  currentStatus?: string;
  currentCity?: string;
  currentEngineerId?: string;
  currentBucket?: string;
  initialTab?: string;
}

// Contextual Row Actions Menu (⋮) — "View Details" removed per Feedback 5 (row click handles it directly!)
function RowActionsMenu({
  machine,
  canEdit,
  isAdmin,
  onEdit,
  onDelete,
  onNavigate,
}: {
  machine: MachineWithEngineer;
  canEdit: boolean;
  isAdmin: boolean;
  onEdit: (m: MachineWithEngineer) => void;
  onDelete: (m: MachineWithEngineer) => void;
  onNavigate: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <TooltipWrapper content="More actions">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
          aria-label="More actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </TooltipWrapper>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ type: "spring", stiffness: 450, damping: 30 }}
              className="absolute right-0 top-full mt-1 z-50 w-44 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-1 shadow-xl text-xs space-y-0.5"
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
                  onNavigate(`/machines?tab=services`);
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
                    <span>Deactivate</span>
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Secondary Action Header Menu (⋮ More)
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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors shadow-2xs cursor-pointer"
        title="More options"
      >
        <span className="hidden sm:inline">More</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ type: "spring", stiffness: 450, damping: 30 }}
              className="absolute right-0 top-full mt-1 z-50 w-48 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-1.5 shadow-xl text-xs space-y-0.5"
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
                  <AnimatedFileText size={16} className="text-emerald-500" />
                  <span>Import Excel</span>
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
                <AnimatedDownload size={16} className="text-sky-500" />
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
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MachineListClient({
  machines,
  total,
  page,
  pageSize,
  totalPages,
  engineers,
  supervisors = [],
  cities,
  complaints = [],
  serviceData,
  userRole,
  currentSearch = "",
  currentStatus = "all",
  currentCity = "all",
  currentEngineerId = "all",
  currentBucket = "all",
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
  const [editingMachine, setEditingMachine] = useState<MachineWithEngineer | null>(null);
  const [deletingMachine, setDeletingMachine] = useState<MachineWithEngineer | null>(null);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
  const [importModalOpen, setImportModalOpen] = useState(false);

  const isAdmin = userRole === "super_admin" || userRole === "admin";
  const canEdit = isAdmin || userRole === "branch_manager" || userRole === "service_manager" || userRole === "rental_manager" || userRole === "supervisor";
  const canCreateMachine = isAdmin || userRole === "branch_manager";

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (currentStatus !== "all") count++;
    if (currentCity !== "all") count++;
    if (currentEngineerId !== "all") count++;
    if (currentBucket !== "all") count++;
    if (search.trim() !== "") count++;
    return count;
  }, [currentStatus, currentCity, currentEngineerId, currentBucket, search]);

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
    startTransition(() => {
      router.push(pathname);
    });
  };

  const handleDeleteConfirm = useCallback(() => {
    if (!deletingMachine) return;
    startTransition(async () => {
      try {
        await deleteMachine(deletingMachine.id);
        toast("success", `Machine ${deletingMachine.machine_code} marked inactive`);
        setDeletingMachine(null);
        router.refresh();
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "An error occurred";
        toast("error", "Failed to deactivate machine", errorMsg);
      }
    });
  }, [deletingMachine, router, toast]);

  const handleExportCSV = useCallback(
    (ids: (string | number)[] = []) => {
      const targetMachines =
        ids.length > 0 ? machines.filter((m) => ids.includes(m.id)) : machines;

      const headers = [
        "Category",
        "Machine Code",
        "Machine Name",
        "Model",
        "Serial No",
        "Hour Meter",
        "Total Services",
        "Status",
        "Customer Name",
        "City",
        "State",
        "Assigned Engineer",
        "Assigned Operator",
        "Next Service Due",
      ].join(",");

      const rows = targetMachines.map((m) => {
        const engineerName = m.engineer?.full_name || "Unassigned";
        const operatorName = m.current_operator?.full_name || "Unassigned";
        return [
          `"${(m.category_name || "Forklift").replace(/"/g, '""')}"`,
          `"${(m.machine_code || "").replace(/"/g, '""')}"`,
          `"${(m.machine_name || "").replace(/"/g, '""')}"`,
          `"${(m.model || "").replace(/"/g, '""')}"`,
          `"${(m.serial_number || "").replace(/"/g, '""')}"`,
          `"${m.hour_meter || 0}"`,
          `"${m.service_count || 0}"`,
          `"${(m.status || "").replace(/"/g, '""')}"`,
          `"${(m.customer_name || "").replace(/"/g, '""')}"`,
          `"${(m.city || "").replace(/"/g, '""')}"`,
          `"${(m.state || "").replace(/"/g, '""')}"`,
          `"${engineerName.replace(/"/g, '""')}"`,
          `"${operatorName.replace(/"/g, '""')}"`,
          `"${m.next_service_due_date || ""}"`,
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

  const { today, tomorrow } = useMemo(() => {
    const d = new Date();
    const todayStr = d.toISOString().split("T")[0];
    const tomDate = new Date(d);
    tomDate.setDate(tomDate.getDate() + 1);
    const tomStr = tomDate.toISOString().split("T")[0];
    return { today: todayStr, tomorrow: tomStr };
  }, []);

  const statsSummary = useMemo(() => {
    let overdueCount = 0;
    let dueTodayCount = 0;
    let dueTomorrowCount = 0;
    let activeCount = 0;

    machines.forEach((m) => {
      if (m.status === "active") activeCount++;
      if (m.next_service_due_date < today) overdueCount++;
      else if (m.next_service_due_date === today) dueTodayCount++;
      else if (m.next_service_due_date === tomorrow) dueTomorrowCount++;
    });

    return { overdueCount, dueTodayCount, dueTomorrowCount, activeCount };
  }, [machines, today, tomorrow]);

  const cityOptions = useMemo(
    () => [
      { value: "all", label: "All Cities" },
      ...cities.map((c) => ({ value: c, label: c })),
    ],
    [cities]
  );

  const engineerOptions = useMemo(
    () => [
      { value: "all", label: "All Engineers" },
      ...engineers.map((e) => ({ value: e.id, label: e.full_name })),
    ],
    [engineers]
  );

  const statusOptions = useMemo(
    () => [
      { value: "all", label: "All Status" },
      { value: "on_rent", label: "On Rent" },
      { value: "active", label: "Active" },
      { value: "under_maintenance", label: "Under Maintenance" },
      { value: "inactive", label: "Inactive" },
    ],
    []
  );

  const bucketOptions = useMemo(
    () => [
      { value: "all", label: "All Service Due" },
      { value: "today", label: "Due Today" },
      { value: "tomorrow", label: "Due Tomorrow" },
      { value: "overdue", label: "Overdue" },
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
        id: "category",
        header: "CATEGORY",
        accessorKey: "category_name" as const,
        sortable: true,
        cell: (row: MachineWithEngineer) => (
          <span className="text-xs font-semibold text-[var(--color-ink)]">
            {row.category_name || "Forklift"}
          </span>
        ),
      },
      {
        id: "code",
        header: "MACHINE NO.",
        accessorKey: "machine_code" as const,
        sortable: true,
        cell: (row: MachineWithEngineer) => (
          <Link
            href={`/machines/${row.id}`}
            className="font-mono text-xs font-bold text-[var(--color-ink)] hover:text-sky-600 dark:hover:text-sky-400 hover:underline"
          >
            {row.machine_code}
          </Link>
        ),
      },
      {
        id: "model",
        header: "MODEL",
        accessorKey: "model" as const,
        sortable: true,
        cell: (row: MachineWithEngineer) => (
          <span className="text-xs font-medium text-[var(--color-body)]">
            {row.model || "—"}
          </span>
        ),
      },
      {
        id: "serial_no",
        header: "SERIAL NO.",
        accessorKey: "serial_number" as const,
        sortable: true,
        cell: (row: MachineWithEngineer) => (
          <span className="font-mono text-xs text-[var(--color-mute)]">
            {row.serial_number || "—"}
          </span>
        ),
      },
      {
        id: "hours",
        header: "HOURS",
        accessorKey: "hour_meter" as const,
        sortable: true,
        cell: (row: MachineWithEngineer) => (
          <span className="font-mono text-xs font-semibold text-[var(--color-ink)]">
            {row.hour_meter || 0}
          </span>
        ),
      },
      {
        id: "services_count",
        header: "SERVICES",
        accessorKey: "service_count" as const,
        sortable: true,
        cell: (row: MachineWithEngineer) => (
          <span className="font-mono text-xs font-bold text-[var(--color-ink)]">
            {row.service_count || 0}
          </span>
        ),
      },
      {
        id: "status",
        header: "STATUS",
        accessorKey: "status" as const,
        sortable: true,
        cell: (row: MachineWithEngineer) => {
          if (row.status === "on_rent") return <Badge variant="info">On Rent</Badge>;
          if (row.status === "under_maintenance") return <Badge variant="warning">Under Maintenance</Badge>;
          if (row.status === "active") return <Badge variant="active">Active</Badge>;
          return <Badge variant="inactive">Inactive</Badge>;
        },
      },
      {
        id: "actions",
        header: "",
        cell: (row: MachineWithEngineer) => (
          <RowActionsMenu
            machine={row}
            canEdit={canEdit}
            isAdmin={isAdmin}
            onEdit={(m) => {
              setEditingMachine(m);
              setModalOpen(true);
            }}
            onDelete={(m) => setDeletingMachine(m)}
            onNavigate={(path) => router.push(path)}
          />
        ),
      },
    ],
    [canEdit, isAdmin, router]
  );

  return (
    <div className="flex flex-col gap-5 pb-20 md:pb-6">
      {/* TAB 2: Service Logs View */}
      {activeTab === "services" && serviceData && (
        <ServicesClient data={serviceData} />
      )}

      {/* TAB 3: Breakdown Complaints View */}
      {activeTab === "complaints" && (
        <ComplaintsClient
          complaints={complaints}
          total={complaints.length}
          machines={machines}
          engineers={engineers}
          supervisors={supervisors}
          userRole={userRole}
        />
      )}

      {/* TAB 1: Equipment Inventory View */}
      {activeTab === "inventory" && (
        <>
          {/* LEVEL 3: Page Header (Subtitle removed per Feedback 4!) */}
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

          {/* Interactive KPI Cards Row — Linked 1:1 with status filter */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Card */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => updateFilters({ bucket: "all", page: 1 })}
              className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                currentBucket === "all"
                  ? "bg-[var(--color-ink)] text-[var(--color-canvas)] border-[var(--color-ink)] shadow-md"
                  : "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]"
              }`}
              title="Click to view total machines"
            >
              <div className="text-[11px] font-semibold text-[var(--color-mute)] uppercase tracking-wider">
                Total Machines
              </div>
              <div className="text-2xl font-black mt-1">{total}</div>
            </motion.div>

            {/* Due Today Card */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => updateFilters({ bucket: "today", page: 1 })}
              className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                currentBucket === "today"
                  ? "bg-amber-500 text-slate-950 border-amber-600 shadow-md font-bold"
                  : "bg-amber-500/10 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-900/60 hover:bg-amber-500/20"
              }`}
              title="Click to filter machines due today"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Due Today</span>
                <AnimatedCalendarClock size={16} />
              </div>
              <div className="text-2xl font-black mt-1">{statsSummary.dueTodayCount}</div>
            </motion.div>

            {/* Overdue Card — Distinct Red Alert Styling */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => updateFilters({ bucket: "overdue", page: 1 })}
              className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                currentBucket === "overdue"
                  ? "bg-rose-600 text-white border-rose-700 shadow-md font-bold ring-2 ring-rose-500/40"
                  : "bg-rose-500/10 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300/80 dark:border-rose-900/80 hover:bg-rose-500/20"
              }`}
              title="Click to filter overdue machines requiring immediate service"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider">Overdue</span>
                <AnimatedAlertTriangle size={16} className="text-rose-500 animate-pulse" />
              </div>
              <div className="text-2xl font-black mt-1">{statsSummary.overdueCount}</div>
            </motion.div>

            {/* Due Tomorrow Card */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => updateFilters({ bucket: "tomorrow", page: 1 })}
              className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                currentBucket === "tomorrow"
                  ? "bg-sky-600 text-white border-sky-700 shadow-md font-bold"
                  : "bg-sky-500/10 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-900/60 hover:bg-sky-500/20"
              }`}
              title="Click to filter machines due tomorrow"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Tomorrow</span>
                <AnimatedCalendarClock size={16} />
              </div>
              <div className="text-2xl font-black mt-1">{statsSummary.dueTomorrowCount}</div>
            </motion.div>
          </div>



          {/* Search Bar & Filter Toolbar — View Switcher (`[ Table ] [ Cards ]`) aligned in `actions` per Feedback 3! */}
          <FilterToolbar
            searchQuery={search}
            onSearchChange={setSearch}
            placeholder="Search machines, models, serial no, customer..."
            activeFilterCount={activeFilterCount}
            onResetFilters={handleResetAllFilters}
            onSubmitSearch={handleSearchSubmit}
            actions={
              <div className="flex items-center gap-2">
                {/* View Switcher Aligned with Table/Card Filter Controls */}
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
                    <AnimatedDownload size={14} className="mr-1" /> CSV ({selectedIds.length})
                  </Button>
                )}
              </div>
            }
          >
            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
              <SearchableSelect
                options={statusOptions}
                value={currentStatus}
                onChange={(val) => updateFilters({ status: val, page: 1 })}
                placeholder="Filter Status"
              />

              <SearchableSelect
                options={bucketOptions}
                value={currentBucket}
                onChange={(val) => updateFilters({ bucket: val, page: 1 })}
                placeholder="Filter Service Due"
              />

              <SearchableSelect
                options={cityOptions}
                value={currentCity}
                onChange={(val) => updateFilters({ city: val, page: 1 })}
                placeholder="Filter City"
              />

              {isAdmin && (
                <SearchableSelect
                  options={engineerOptions}
                  value={currentEngineerId}
                  onChange={(val) => updateFilters({ engineer_id: val, page: 1 })}
                  placeholder="Filter Engineer"
                />
              )}
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
                    today={today}
                    tomorrow={tomorrow}
                    onEdit={(mach: MachineWithEngineer) => {
                      setEditingMachine(mach);
                      setModalOpen(true);
                    }}
                    onDelete={(mach: MachineWithEngineer) => setDeletingMachine(mach)}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
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
          engineers={engineers}
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
          title={`Deactivate Machine ${deletingMachine.machine_code}?`}
          description={`Are you sure you want to deactivate ${deletingMachine.machine_name}? It can be restored later.`}
          confirmLabel="Deactivate Machine"
          variant="danger"
          loading={isPending}
        />
      )}
    </div>
  );
}
