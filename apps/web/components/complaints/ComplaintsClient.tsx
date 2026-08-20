"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AnimatedAlertTriangle,
  AnimatedFileText,
  AnimatedWrench,
  AnimatedEye,
  AnimatedEdit,
  AnimatedTrash,
} from "@/components/ui/animated-icons";
import {
  Button,
  PageHeader,
  EnterpriseTable,
  Badge,
  RefreshButton,
  FilterToolbar,
  SearchableSelect,
  Modal,
  useToast,
  TooltipWrapper,
} from "@/components/ui";
import dynamic from "next/dynamic";
import { formatDisplayDate } from "@servicecentric/utils";
import { deleteComplaint } from "@/app/actions/complaints";
import type { ComplaintWithDetails, MachineWithEngineer, User, UserRole } from "@/lib/types/database";

const MachineComplaintModal = dynamic(
  () => import("./MachineComplaintModal").then((mod) => mod.MachineComplaintModal),
  { ssr: false }
);

const FieldServiceReportModal = dynamic(
  () => import("./FieldServiceReportModal").then((mod) => mod.FieldServiceReportModal),
  { ssr: false }
);

const ComplaintDetailModal = dynamic(
  () => import("./ComplaintDetailModal").then((mod) => mod.ComplaintDetailModal),
  { ssr: false }
);

interface ComplaintsClientProps {
  complaints: ComplaintWithDetails[];
  total: number;
  machines: MachineWithEngineer[];
  engineers: User[];
  supervisors: User[];
  userRole: UserRole;
}

export function ComplaintsClient({
  complaints,
  total,
  machines,
  engineers,
  supervisors,
  userRole,
}: ComplaintsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [machineFilter, setMachineFilter] = useState("all");
  const [engineerFilter, setEngineerFilter] = useState("all");
  const [partsFilter, setPartsFilter] = useState("all");

  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [fsrModalOpen, setFsrModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintWithDetails | null>(null);
  const [deletingComplaint, setDeletingComplaint] = useState<ComplaintWithDetails | null>(null);

  const searchParams = useSearchParams();
  const actionParam = searchParams.get("action");

  const canRaiseComplaint =
    userRole === "super_admin" ||
    userRole === "admin" ||
    userRole === "branch_manager" ||
    userRole === "service_manager" ||
    userRole === "supervisor" ||
    userRole === "mechanic" ||
    userRole === "service_engineer" ||
    userRole === "engineer" ||
    userRole === "operator";

  const canDeleteComplaint =
    userRole === "super_admin" ||
    userRole === "admin" ||
    userRole === "service_manager" ||
    userRole === "branch_manager" ||
    userRole === "supervisor";

  useEffect(() => {
    if (actionParam === "create_complaint" && canRaiseComplaint) {
      setSelectedComplaint(null);
      setComplaintModalOpen(true);
    }
  }, [actionParam, canRaiseComplaint]);

  // Options for filter selects
  const machineFilterOptions = [
    { value: "all", label: "All Machines" },
    ...machines.map((m) => ({
      value: m.id,
      label: `${m.machine_code} (${m.model || m.machine_name})`,
    })),
  ];

  const engineerFilterOptions = [
    { value: "all", label: "All Engineers" },
    { value: "assigned", label: "Assigned" },
    { value: "unassigned", label: "Unassigned" },
    ...engineers.map((e) => ({
      value: e.id,
      label: e.full_name,
    })),
  ];

  const partsFilterOptions = [
    { value: "all", label: "All Parts Status" },
    { value: "required", label: "Spare Part Required" },
    { value: "none", label: "No Parts Needed" },
  ];

  // Active filter counter
  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (machineFilter !== "all" ? 1 : 0) +
    (engineerFilter !== "all" ? 1 : 0) +
    (partsFilter !== "all" ? 1 : 0);

  const handleResetFilters = () => {
    setStatusFilter("all");
    setMachineFilter("all");
    setEngineerFilter("all");
    setPartsFilter("all");
    setSearch("");
  };

  const filteredComplaints = complaints.filter((c) => {
    const matchesSearch =
      !search ||
      c.complaint_no.toLowerCase().includes(search.toLowerCase()) ||
      c.complaint.toLowerCase().includes(search.toLowerCase()) ||
      c.machine?.machine_code?.toLowerCase().includes(search.toLowerCase()) ||
      c.machine?.model?.toLowerCase().includes(search.toLowerCase()) ||
      c.location?.toLowerCase().includes(search.toLowerCase()) ||
      c.supervisor?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.engineer?.full_name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesMachine = machineFilter === "all" || c.machine_id === machineFilter;
    
    let matchesEngineer = true;
    if (engineerFilter === "assigned") matchesEngineer = !!c.engineer_id;
    else if (engineerFilter === "unassigned") matchesEngineer = !c.engineer_id;
    else if (engineerFilter !== "all") matchesEngineer = c.engineer_id === engineerFilter;

    let matchesParts = true;
    if (partsFilter === "required") matchesParts = !!c.required_part;
    else if (partsFilter === "none") matchesParts = !c.required_part;

    return matchesSearch && matchesStatus && matchesMachine && matchesEngineer && matchesParts;
  });

  const handleDeleteExecute = () => {
    if (!deletingComplaint) return;
    startTransition(async () => {
      const res = await deleteComplaint(deletingComplaint.id);
      if (res?.error) {
        toast("error", "Failed to delete complaint", res.error);
      } else {
        toast("success", `Complaint ${deletingComplaint.complaint_no} deleted successfully.`);
        setDeleteConfirmOpen(false);
        setDeletingComplaint(null);
        if (selectedComplaint?.id === deletingComplaint.id) {
          setSelectedComplaint(null);
          setDetailModalOpen(false);
        }
        router.refresh();
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="overdue">Open Malfunction</Badge>;
      case "in_progress":
        return <Badge variant="today">In Progress</Badge>;
      case "pending_parts":
        return <Badge variant="tomorrow">Pending Parts</Badge>;
      case "resolved":
        return <Badge variant="active">Resolved</Badge>;
      case "closed":
        return <Badge variant="inactive">Closed (FSR)</Badge>;
      default:
        return <Badge variant="inactive">{status}</Badge>;
    }
  };

  const columns = [
    {
      id: "complaint_no",
      header: "Complaint No",
      cell: (row: ComplaintWithDetails) => (
        <div className="flex flex-col">
          <span className="font-mono font-bold text-xs text-[var(--color-link)]">
            {row.complaint_no}
          </span>
          <span className="text-[10px] text-[var(--color-mute)] font-medium">
            {row.complaint_date ? formatDisplayDate(row.complaint_date) : "—"}
          </span>
        </div>
      ),
    },
    {
      id: "machine",
      header: "Machine & Model",
      cell: (row: ComplaintWithDetails) => (
        <div className="flex flex-col">
          <span className="font-mono font-bold text-xs text-[var(--color-ink)]">
            {row.machine?.machine_code || "—"}
          </span>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="font-medium text-[var(--color-ink)]">{row.machine?.machine_name || row.machine?.model || "Machine"}</span>
            {row.machine?.model && (
              <span className="text-[10px] text-[var(--color-mute)] font-mono">({row.machine.model})</span>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "complaint",
      header: "Malfunction Issue",
      cell: (row: ComplaintWithDetails) => (
        <div className="flex flex-col max-w-xs gap-1">
          <span className="text-xs font-semibold text-[var(--color-ink)] line-clamp-2">
            {row.complaint}
          </span>
          <div className="flex items-center gap-2">
            {row.required_part && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold border border-amber-300/40">
                Part: {row.required_part} ({row.part_quantity || 1})
              </span>
            )}
            {row.hour_meter > 0 && (
              <span className="text-[10px] text-[var(--color-mute)] font-mono">
                {row.hour_meter} hrs
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "assigned",
      header: "Personnel",
      cell: (row: ComplaintWithDetails) => (
        <div className="flex flex-col text-xs gap-0.5">
          <div className="flex items-center gap-1 text-[var(--color-ink)] font-medium">
            <span className="text-[10px] text-[var(--color-mute)] font-normal">By:</span>
            <span className="truncate">{row.supervisor?.full_name || "Supervisor"}</span>
          </div>
          <div className="flex items-center gap-1 text-[var(--color-link)] font-semibold text-[11px]">
            <span className="text-[10px] text-[var(--color-mute)] font-normal">Eng:</span>
            <span className="truncate">{row.engineer?.full_name || "Unassigned"}</span>
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row: ComplaintWithDetails) => getStatusBadge(row.status),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row: ComplaintWithDetails) => {
        const isResolved = row.status === "resolved" || row.status === "closed";
        return (
          <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
            {/* View FSR or View Details Icon Button */}
            {isResolved ? (
              <TooltipWrapper content="View FSR Report" side="top">
                <Button
                  variant="ghost-sm"
                  onClick={() => {
                    setSelectedComplaint(row);
                    setFsrModalOpen(true);
                  }}
                  className="p-1.5 h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400 cursor-pointer rounded-lg"
                  aria-label="View FSR Report"
                >
                  <AnimatedFileText size={16} />
                </Button>
              </TooltipWrapper>
            ) : (
              <TooltipWrapper content={userRole === "supervisor" ? "View Details" : "Resolve (Fill FSR)"} side="top">
                <Button
                  variant="ghost-sm"
                  onClick={() => {
                    setSelectedComplaint(row);
                    setFsrModalOpen(true);
                  }}
                  className="p-1.5 h-8 w-8 text-sky-600 hover:text-sky-700 hover:bg-sky-500/10 dark:text-sky-400 cursor-pointer rounded-lg"
                  aria-label={userRole === "supervisor" ? "View Details" : "Resolve (Fill FSR)"}
                >
                  {userRole === "supervisor" ? <AnimatedEye size={16} /> : <AnimatedWrench size={16} />}
                </Button>
              </TooltipWrapper>
            )}

            {/* Edit Icon Button */}
            <TooltipWrapper content="Edit Complaint" side="top">
              <Button
                variant="ghost-sm"
                onClick={() => {
                  setSelectedComplaint(row);
                  setComplaintModalOpen(true);
                }}
                className="p-1.5 h-8 w-8 text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] cursor-pointer rounded-lg"
                aria-label="Edit Complaint"
              >
                <AnimatedEdit size={16} />
              </Button>
            </TooltipWrapper>

            {/* Delete Icon Button */}
            {canDeleteComplaint && (
              <TooltipWrapper content="Delete Complaint" side="top">
                <Button
                  variant="ghost-sm"
                  onClick={() => {
                    setDeletingComplaint(row);
                    setDeleteConfirmOpen(true);
                  }}
                  className="p-1.5 h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10 cursor-pointer rounded-lg"
                  aria-label="Delete Complaint"
                >
                  <AnimatedTrash size={16} />
                </Button>
              </TooltipWrapper>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-5 pb-28 md:pb-6">
      <PageHeader
        title="Machine Complaints & FSR Log"
        breadcrumbs={[{ label: "Machines", href: "/machines" }, { label: "Complaints" }]}
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton path="/complaints" tag="complaints" />
            {canRaiseComplaint && (
              <Button
                variant="primary"
                onClick={() => {
                  setSelectedComplaint(null);
                  setComplaintModalOpen(true);
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm"
              >
                <AnimatedAlertTriangle size={16} className="mr-1.5" /> Raise Complaint
              </Button>
            )}
          </div>
        }
      />

      {/* Multi-Option Filter Toolbar */}
      <FilterToolbar
        searchQuery={search}
        onSearchChange={setSearch}
        placeholder="Search complaint code, issue, machine, engineer, supervisor..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Status Filter */}
          <SearchableSelect
            options={[
              { value: "all", label: "All Statuses" },
              { value: "open", label: "Open" },
              { value: "in_progress", label: "In Progress" },
              { value: "pending_parts", label: "Pending Parts" },
              { value: "resolved", label: "Resolved" },
              { value: "closed", label: "Closed (FSR)" },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Filter Status"
          />

          {/* Machine Filter */}
          <SearchableSelect
            options={machineFilterOptions}
            value={machineFilter}
            onChange={setMachineFilter}
            placeholder="Filter Machine"
          />

          {/* Assigned Engineer Filter */}
          <SearchableSelect
            options={engineerFilterOptions}
            value={engineerFilter}
            onChange={setEngineerFilter}
            placeholder="Filter Engineer"
          />

          {/* Parts Filter */}
          <SearchableSelect
            options={partsFilterOptions}
            value={partsFilter}
            onChange={setPartsFilter}
            placeholder="Filter Spare Parts"
          />
        </div>
      </FilterToolbar>

      {/* Complaints Table with Row Click */}
      <EnterpriseTable
        columns={columns}
        data={filteredComplaints}
        loading={isPending}
        onRowClick={(row) => {
          setSelectedComplaint(row);
          setDetailModalOpen(true);
        }}
        emptyMessage="No machine complaints recorded"
        emptyDescription="All machines are running smoothly without active malfunction reports matching your filters."
      />

      {/* Detail Modal (Triggered by Clicking Any Row) */}
      {detailModalOpen && selectedComplaint && (
        <ComplaintDetailModal
          open={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedComplaint(null);
          }}
          complaint={selectedComplaint}
          userRole={userRole}
          onEdit={() => {
            setDetailModalOpen(false);
            setComplaintModalOpen(true);
          }}
          onResolveFSR={() => {
            setDetailModalOpen(false);
            setFsrModalOpen(true);
          }}
          onDelete={
            canDeleteComplaint
              ? () => {
                  setDeletingComplaint(selectedComplaint);
                  setDeleteConfirmOpen(true);
                }
              : undefined
          }
        />
      )}

      {/* Edit / Create Complaint Modal */}
      {complaintModalOpen && (
        <MachineComplaintModal
          open={complaintModalOpen}
          onClose={() => {
            setComplaintModalOpen(false);
            setSelectedComplaint(null);
          }}
          complaint={selectedComplaint}
          machines={machines}
          engineers={engineers}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* FSR Modal */}
      {fsrModalOpen && selectedComplaint && (
        <FieldServiceReportModal
          open={fsrModalOpen}
          onClose={() => {
            setFsrModalOpen(false);
            setSelectedComplaint(null);
          }}
          complaint={selectedComplaint}
          userRole={userRole}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && deletingComplaint && (
        <Modal
          open={deleteConfirmOpen}
          onClose={() => {
            setDeleteConfirmOpen(false);
            setDeletingComplaint(null);
          }}
          title={`Delete Complaint ${deletingComplaint.complaint_no}?`}
          size="sm"
        >
          <div className="flex flex-col gap-4 p-1">
            <p className="text-xs text-[var(--color-mute)] leading-relaxed">
              Are you sure you want to permanently delete complaint record{" "}
              <strong className="text-[var(--color-ink)]">{deletingComplaint.complaint_no}</strong> for machine{" "}
              <strong className="font-mono text-[var(--color-link)]">{deletingComplaint.machine?.machine_code}</strong>?
              This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-hairline)]">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeletingComplaint(null);
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleDeleteExecute}
                loading={isPending}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                Delete Complaint
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
