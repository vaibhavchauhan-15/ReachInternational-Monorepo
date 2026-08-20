"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  AnimatedWrench,
  AnimatedCalendarClock,
  AnimatedCheckCircle,
  AnimatedAlertTriangle,
  AnimatedSearch,
  AnimatedSlidersHorizontal,
} from "@/components/ui/animated-icons";
import { Edit, Trash2, Wrench, Calendar, Clock, Filter, ArrowUpDown } from "lucide-react";
import {
  Badge,
  PageHeader,
  MetricCard,
  EnterpriseTable,
  CopyCell,
  RefreshButton,
  FilterToolbar,
  Modal,
  Input,
  Select,
  Textarea,
  Button,
  useToast,
  TooltipWrapper,
} from "@/components/ui";
import { completeService, deleteServiceRecord } from "@/app/actions/services";
import type { MachineWithEngineer } from "@/lib/types/database";
import type { EngineerServicesData } from "@/lib/queries/services";
import { useRouter } from "next/navigation";
import { formatDisplayDate } from "@reachinternational/utils";

function getDueDays(dueDateStr: string | null | undefined): number {
  if (!dueDateStr) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  if (isNaN(due.getTime())) return 999;
  due.setHours(0, 0, 0, 0);
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

interface ServicesClientProps {
  data: EngineerServicesData;
}

export function ServicesClient({ data }: ServicesClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dueDateFilter, setDueDateFilter] = useState<string>("all");
  const [selectedMachineForService, setSelectedMachineForService] = useState<MachineWithEngineer | null>(null);
  const [machineToDelete, setMachineToDelete] = useState<MachineWithEngineer | null>(null);


  // Extract unique category names for filter dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    data.assignedMachines.forEach((m) => {
      if (m.category_name) set.add(m.category_name);
    });
    return Array.from(set);
  }, [data.assignedMachines]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (categoryFilter !== "all") count++;
    if (dueDateFilter !== "all") count++;
    return count;
  }, [statusFilter, categoryFilter, dueDateFilter]);

  // Filter assigned machines
  const filteredMachines = useMemo(() => {
    return data.assignedMachines.filter((m) => {
      const days = getDueDays(m.next_service_due_date);

      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        m.machine_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.machine_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.serial_number && m.serial_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.model && m.model.toLowerCase().includes(searchQuery.toLowerCase())) ||
        m.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.city.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      let matchesStatus = true;
      if (statusFilter === "overdue") {
        matchesStatus = days < 0 && m.status !== "under_maintenance";
      } else if (statusFilter === "under_maintenance") {
        matchesStatus = m.status === "under_maintenance";
      } else if (statusFilter === "due_soon") {
        matchesStatus = days >= 0 && days <= 7 && m.status !== "under_maintenance";
      } else if (statusFilter === "scheduled") {
        matchesStatus = days > 7 && m.status !== "under_maintenance";
      } else if (statusFilter === "completed") {
        matchesStatus = !m.next_service_due_date || !!m.last_service_date;
      }

      // Category filter
      const matchesCategory =
        categoryFilter === "all" || (m.category_name && m.category_name === categoryFilter);

      // Due date urgency filter
      let matchesDueDate = true;
      if (dueDateFilter === "overdue") {
        matchesDueDate = days < 0;
      } else if (dueDateFilter === "today") {
        matchesDueDate = days === 0;
      } else if (dueDateFilter === "next_7") {
        matchesDueDate = days >= 0 && days <= 7;
      } else if (dueDateFilter === "next_30") {
        matchesDueDate = days >= 0 && days <= 30;
      }

      return matchesSearch && matchesStatus && matchesCategory && matchesDueDate;
    });
  }, [data.assignedMachines, searchQuery, statusFilter, categoryFilter, dueDateFilter]);

  const handleUpdateServiceSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedMachineForService) return;

    const formData = new FormData(e.currentTarget);
    formData.append("machine_id", selectedMachineForService.id);

    startTransition(async () => {
      try {
        await completeService(formData);
        toast("success", `Service log updated for machine ${selectedMachineForService.machine_code}`);
        setSelectedMachineForService(null);
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to update service";
        toast("error", msg);
      }
    });
  };

  const handleDeleteServiceConfirm = () => {
    if (!machineToDelete) return;
    startTransition(async () => {
      try {
        await deleteServiceRecord(machineToDelete.id);
        toast("success", `Service log deleted for machine ${machineToDelete.machine_code}`);
        setMachineToDelete(null);
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to delete service log";
        toast("error", msg);
      }
    });
  };

  // Columns definition meeting all 22 prompt specifications
  const columns = [
    {
      id: "action",
      header: "Action",
      width: "80px",
      sortable: false,
      cell: (m: MachineWithEngineer) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <TooltipWrapper content="Update Service Log" side="top">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMachineForService(m);
              }}
              className="p-1.5 rounded-md text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-300 transition-all active:scale-95 cursor-pointer"
              aria-label="Update Service Log"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="Delete Service Log" side="top">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMachineToDelete(m);
              }}
              className="p-1.5 rounded-md text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 transition-all active:scale-95 cursor-pointer"
              aria-label="Delete Service Log"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </TooltipWrapper>
        </div>
      ),
    },
    {
      id: "machine_number",
      header: "Machine Number",
      accessorKey: "machine_code" as keyof MachineWithEngineer,
      sortable: true,
      cell: (m: MachineWithEngineer) => (
        <span className="font-mono text-xs font-bold text-[var(--color-link)] hover:underline">
          {m.machine_code}
        </span>
      ),
    },
    {
      id: "model",
      header: "Model",
      accessorKey: "model" as keyof MachineWithEngineer,
      sortable: true,
      cell: (m: MachineWithEngineer) => (
        <span className="text-xs font-medium text-[var(--color-ink)]">
          {m.model || <span className="text-[var(--color-mute)] opacity-40 font-normal">—</span>}
        </span>
      ),
    },
    {
      id: "category",
      header: "Category",
      accessorKey: "category_name" as keyof MachineWithEngineer,
      sortable: true,
      cell: (m: MachineWithEngineer) => (
        <span className="text-xs font-normal text-[var(--color-body)]">
          {m.category_name || "Engine Service"}
        </span>
      ),
    },
    {
      id: "service_status",
      header: "Service Status",
      sortable: true,
      sortFn: (a: MachineWithEngineer, b: MachineWithEngineer) => {
        const daysA = getDueDays(a.next_service_due_date);
        const daysB = getDueDays(b.next_service_due_date);
        return daysA - daysB;
      },
      cell: (m: MachineWithEngineer) => {
        const days = getDueDays(m.next_service_due_date);
        if (m.status === "under_maintenance") {
          return <Badge variant="warning">Under Maintenance</Badge>;
        }
        if (!m.next_service_due_date) {
          return <Badge variant="neutral">Completed</Badge>;
        }
        if (days < 0) {
          return <Badge variant="error">Overdue</Badge>;
        }
        if (days === 0) {
          return <Badge variant="warning">Due Today</Badge>;
        }
        if (days > 0 && days <= 7) {
          return <Badge variant="info">Due Soon</Badge>;
        }
        return <Badge variant="active">Scheduled</Badge>;
      },
    },
    {
      id: "due_date",
      header: "Service Due Date",
      accessorKey: "next_service_due_date" as keyof MachineWithEngineer,
      sortable: true,
      cell: (m: MachineWithEngineer) => (
        <span className="text-xs font-medium text-[var(--color-ink)]">
          {m.next_service_due_date ? (
            formatDisplayDate(m.next_service_due_date)
          ) : (
            <span className="text-[var(--color-mute)] opacity-40 font-normal">—</span>
          )}
        </span>
      ),
    },
    {
      id: "due_days",
      header: "Days",
      sortable: true,
      sortFn: (a: MachineWithEngineer, b: MachineWithEngineer) => {
        return getDueDays(a.next_service_due_date) - getDueDays(b.next_service_due_date);
      },
      cell: (m: MachineWithEngineer) => {
        const days = getDueDays(m.next_service_due_date);
        if (days === 999) {
          return <span className="text-[var(--color-mute)] opacity-40 font-normal text-xs">—</span>;
        }
        if (days < 0) {
          const absDays = Math.abs(days);
          return (
            <div className="inline-flex items-center gap-1 text-xs">
              <span className="font-bold text-red-600 dark:text-red-400">{absDays} {absDays === 1 ? "day" : "days"}</span>
              <span className="text-red-600/80 dark:text-red-400/80 font-normal">overdue</span>
            </div>
          );
        }
        if (days === 0) {
          return <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Due today</span>;
        }
        if (days === 1) {
          return (
            <div className="inline-flex items-center gap-1 text-xs">
              <span className="font-bold text-amber-600 dark:text-amber-400">1 day</span>
              <span className="text-[var(--color-mute)] font-normal">left</span>
            </div>
          );
        }
        return (
          <div className="inline-flex items-center gap-1 text-xs">
            <span className="font-bold text-[var(--color-ink)]">{days} days</span>
            <span className="text-[var(--color-mute)] font-normal">left</span>
          </div>
        );
      },
    },
    {
      id: "completion_date",
      header: "Completion Date",
      accessorKey: "last_service_date" as keyof MachineWithEngineer,
      sortable: true,
      cell: (m: MachineWithEngineer) => (
        <span className="text-xs text-[var(--color-body)]">
          {m.last_service_date ? (
            formatDisplayDate(m.last_service_date)
          ) : (
            <span className="text-[var(--color-mute)] opacity-40 font-normal">—</span>
          )}
        </span>
      ),
    },
    {
      id: "serial_no",
      header: "Serial No.",
      accessorKey: "serial_number" as keyof MachineWithEngineer,
      sortable: true,
      cell: (m: MachineWithEngineer) => (
        <span className="font-mono text-xs text-[var(--color-ink)]">
          {m.serial_number || <span className="text-[var(--color-mute)] opacity-40 font-normal">—</span>}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto pb-16 sm:pb-8 w-full">
      {/* Page Header */}
      <PageHeader
        title="Machine Service & Maintenance Logs"
        breadcrumbs={[{ label: "Machines", href: "/machines" }, { label: "Services" }]}
        actions={<RefreshButton path="/services" tag="services" />}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Total Serviced Fleet" value={data.totalMachines} icon="Wrench" />
        <MetricCard label="Active Fleet" value={data.activeMachines} icon="CheckCircle" variant="success" />
        <MetricCard label="Due Today" value={data.todayDue} icon="CalendarClock" variant={data.todayDue > 0 ? "warning" : "default"} />
        <MetricCard label="Overdue Services" value={data.overdue} icon="AlertTriangle" variant={data.overdue > 0 ? "error" : "default"} />
      </div>

      {/* Search & Multi-Dimensional Filter Toolbar */}
      <FilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search machine number, serial no., model, customer..."
        activeFilterCount={activeFilterCount}
        onResetFilters={() => {
          setSearchQuery("");
          setStatusFilter("all");
          setCategoryFilter("all");
          setDueDateFilter("all");
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-1">
          {/* Status Filter */}
          <Select
            label="Status Filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "overdue", label: "🔴 Overdue" },
              { value: "under_maintenance", label: "🟠 Under Maintenance" },
              { value: "due_soon", label: "🟡 Due Soon" },
              { value: "scheduled", label: "🟢 Scheduled" },
              { value: "completed", label: "⚪ Completed" },
            ]}
          />

          {/* Category Filter */}
          <Select
            label="Category Filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={[
              { value: "all", label: "All Categories" },
              ...categories.map((cat) => ({ value: cat, label: cat })),
            ]}
          />

          {/* Due Date Filter */}
          <Select
            label="Due Date Filter"
            value={dueDateFilter}
            onChange={(e) => setDueDateFilter(e.target.value)}
            options={[
              { value: "all", label: "All Urgencies" },
              { value: "overdue", label: "Overdue" },
              { value: "today", label: "Due Today" },
              { value: "next_7", label: "Next 7 Days" },
              { value: "next_30", label: "Next 30 Days" },
            ]}
          />
        </div>
      </FilterToolbar>

      {/* Machine Service Enterprise Table */}
      <EnterpriseTable
        columns={columns}
        data={filteredMachines}
        loading={isPending}
        defaultHiddenColumns={["serial_no"]}
        defaultSortColumn="due_days"
        defaultSortDirection="asc"
        emptyMessage="No machine service records found"
        emptyDescription="Try adjusting your search query or filter selection."
        onRowClick={(m) => router.push(`/machines/${m.id}`)}
      />

      {/* Update Service Modal */}
      {selectedMachineForService && (
        <Modal
          open={!!selectedMachineForService}
          onClose={() => setSelectedMachineForService(null)}
          title={
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center shrink-0 w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shadow-xs">
                <Wrench className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-base tracking-tight text-[var(--color-ink)]">
                  Update Service Log
                </span>
                <div className="flex items-center flex-wrap gap-2 text-xs font-normal text-[var(--color-body)]">
                  <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                    {selectedMachineForService.machine_code}
                  </span>
                  {selectedMachineForService.model && (
                    <span>• {selectedMachineForService.model}</span>
                  )}
                  {selectedMachineForService.category_name && (
                    <span className="text-[var(--color-mute)]">({selectedMachineForService.category_name})</span>
                  )}
                </div>
              </div>
            </div>
          }
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSelectedMachineForService(null)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="update-service-form"
                variant="primary"
                loading={isPending}
                className="bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white font-bold px-5"
              >
                Save
              </Button>
            </div>
          }
          size="lg"
        >
          <form id="update-service-form" onSubmit={handleUpdateServiceSubmit} className="space-y-4">
            <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5 shadow-xs">
              <Input
                name="service_date"
                type="date"
                label="Service Date"
                defaultValue={new Date().toISOString().split("T")[0]}
                required
                disabled={isPending}
              />

              <Select
                name="service_category"
                label="Service Category"
                options={[
                  { value: "Engine Service", label: "Engine Service" },
                  { value: "Hydraulic Service", label: "Hydraulic Service" },
                  { value: "Periodic Maintenance", label: "Periodic Maintenance (250h/500h)" },
                  { value: "General Checkup", label: "General Checkup & Inspection" },
                ]}
                defaultValue="Engine Service"
                disabled={isPending}
              />

              <Select
                name="service_status"
                label="Service Status"
                options={[
                  { value: "completed", label: "Completed" },
                  { value: "in_progress", label: "In Progress" },
                  { value: "scheduled", label: "Scheduled" },
                ]}
                defaultValue="completed"
                disabled={isPending}
              />

              <Input
                name="hour_meter"
                type="number"
                step="0.1"
                label="Hour Meter Reading"
                placeholder="e.g. 2337"
                defaultValue={selectedMachineForService.hour_meter?.toString() || "0"}
                disabled={isPending}
              />
            </div>

            <Textarea
              name="notes"
              label="Service Remarks & Corrections Taken"
              placeholder="Enter service remarks, parts replaced, oil changes..."
              rows={3}
              disabled={isPending}
            />
          </form>
        </Modal>
      )}

      {/* Delete Service Confirmation Modal */}
      {machineToDelete && (
        <Modal
          open={!!machineToDelete}
          onClose={() => setMachineToDelete(null)}
          title="Delete Service Log"
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMachineToDelete(null)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={isPending}
                onClick={handleDeleteServiceConfirm}
              >
                Delete Service Log
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <p className="text-xs text-[var(--color-body)] leading-relaxed">
              Are you sure you want to delete the service log for machine{" "}
              <strong className="font-mono font-bold text-[var(--color-ink)]">{machineToDelete.machine_code}</strong>? This action will remove the latest service log record.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}


