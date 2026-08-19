"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  AnimatedWrench,
  AnimatedCalendarClock,
  AnimatedArrowRight,
  AnimatedHistory,
  AnimatedSearch,
  AnimatedCheckCircle,
  AnimatedClock,
  AnimatedEye,
  AnimatedEdit,
  AnimatedFileText,
  AnimatedAlertTriangle,
} from "@/components/ui/animated-icons";
import { Edit } from "lucide-react";
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
} from "@/components/ui";
import { completeService } from "@/app/actions/services";
import type { MachineWithEngineer, ServiceRecordWithDetails } from "@/lib/types/database";
import type { EngineerServicesData } from "@/lib/queries/services";
import { useRouter } from "next/navigation";

function getDueDays(dueDateStr: string): number {
  if (!dueDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
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
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedMachineForService, setSelectedMachineForService] = useState<MachineWithEngineer | null>(null);

  // Filter assigned machines
  const filteredMachines = useMemo(() => {
    return data.assignedMachines.filter((m) => {
      const matchesSearch =
        searchQuery === "" ||
        m.machine_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.machine_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.serial_number && m.serial_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.model && m.model.toLowerCase().includes(searchQuery.toLowerCase())) ||
        m.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.city.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        categoryFilter === "all" || (m.category_name && m.category_name === categoryFilter);

      return matchesSearch && matchesCategory;
    });
  }, [data.assignedMachines, searchQuery, categoryFilter]);

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

  // Columns matching Screenshot 3
  const columns = [
    {
      id: "action",
      header: "ACTION",
      cell: (m: MachineWithEngineer) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedMachineForService(m);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white shadow-xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Edit className="h-3.5 w-3.5" />
            <span>Update Service</span>
          </button>
        </div>
      ),
    },
    {
      id: "serial_no",
      header: "MACHINE SERIAL NO",
      cell: (m: MachineWithEngineer) => (
        <span className="font-mono text-xs font-semibold text-[var(--color-ink)]">
          {m.serial_number || "—"}
        </span>
      ),
    },
    {
      id: "machine_number",
      header: "MACHINE NUMBER",
      cell: (m: MachineWithEngineer) => (
        <span className="font-mono text-xs font-bold text-[var(--color-link)]">
          {m.machine_code}
        </span>
      ),
    },
    {
      id: "model",
      header: "MACHINE MODEL",
      cell: (m: MachineWithEngineer) => (
        <span className="text-xs font-semibold text-[var(--color-ink)]">
          {m.model || "—"}
        </span>
      ),
    },
    {
      id: "category",
      header: "SERVICE CATEGORY",
      cell: (m: MachineWithEngineer) => (
        <span className="text-xs font-medium text-[var(--color-body)]">
          {m.category_name || "Engine Service"}
        </span>
      ),
    },
    {
      id: "service_status",
      header: "SERVICE STATUS",
      cell: (m: MachineWithEngineer) => {
        const days = getDueDays(m.next_service_due_date);
        if (m.status === "under_maintenance") {
          return <Badge variant="warning">Under Maintenance</Badge>;
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
      header: "SERVICE DUE DATE",
      cell: (m: MachineWithEngineer) => (
        <span className="font-mono text-xs font-semibold text-[var(--color-ink)]">
          {m.next_service_due_date || "—"}
        </span>
      ),
    },
    {
      id: "due_days",
      header: "SERVICE DUE DAYS",
      cell: (m: MachineWithEngineer) => {
        const days = getDueDays(m.next_service_due_date);
        return (
          <span
            className={`font-mono text-xs font-bold ${
              days < 0
                ? "text-red-600 dark:text-red-400"
                : days === 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-[var(--color-ink)]"
            }`}
          >
            {days < 0 ? `Overdue (${days} days)` : `${days} days`}
          </span>
        );
      },
    },
    {
      id: "completion_date",
      header: "SERVICE COMPLETION DATE",
      cell: (m: MachineWithEngineer) => (
        <span className="font-mono text-xs text-[var(--color-mute)]">
          {m.last_service_date || "—"}
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

      {/* Search & Filter Toolbar */}
      <FilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search Machine Serial No, Code, Model, Customer..."
        activeFilterCount={categoryFilter !== "all" ? 1 : 0}
        onResetFilters={() => {
          setSearchQuery("");
          setCategoryFilter("all");
        }}
      />

      {/* Machine Service Table matching Screenshot 3 */}
      <EnterpriseTable
        columns={columns}
        data={filteredMachines}
        loading={isPending}
        emptyMessage="No machine service records found"
        emptyDescription="Try adjusting your search criteria."
        onRowClick={(m) => router.push(`/machines/${m.id}`)}
      />

      {/* Update Service Modal */}
      {selectedMachineForService && (
        <Modal
          open={!!selectedMachineForService}
          onClose={() => setSelectedMachineForService(null)}
          title={`Update Service Log — ${selectedMachineForService.machine_code} (${selectedMachineForService.model || ""})`}
          size="lg"
        >
          <form onSubmit={handleUpdateServiceSubmit} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-hairline)]">
              <Button type="button" variant="secondary" onClick={() => setSelectedMachineForService(null)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isPending} className="bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white font-bold">
                Save & Complete Service
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
