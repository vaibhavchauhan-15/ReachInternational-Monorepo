"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AnimatedPlus,
  AnimatedAlertTriangle,
  AnimatedFileText,
  AnimatedWrench,
  AnimatedCheckCircle,
  AnimatedEye,
  AnimatedSearch,
  AnimatedClock,
  AnimatedSlidersHorizontal,
  AnimatedUserCheck,
  AnimatedBuilding2,
} from "@/components/ui/animated-icons";
import {
  Button,
  PageHeader,
  EnterpriseTable,
  Badge,
  EmptyState,
  RefreshButton,
  FilterToolbar,
  SearchableSelect,
} from "@/components/ui";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import type { ComplaintWithDetails, MachineWithEngineer, User, UserRole } from "@/lib/types/database";

const MachineComplaintModal = dynamic(
  () => import("./MachineComplaintModal").then((mod) => mod.MachineComplaintModal),
  { ssr: false }
);

const FieldServiceReportModal = dynamic(
  () => import("./FieldServiceReportModal").then((mod) => mod.FieldServiceReportModal),
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
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [fsrModalOpen, setFsrModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintWithDetails | null>(null);

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

  useEffect(() => {
    if (actionParam === "create_complaint" && canRaiseComplaint) {
      setSelectedComplaint(null);
      setComplaintModalOpen(true);
    }
  }, [actionParam, canRaiseComplaint]);

  const filteredComplaints = complaints.filter((c) => {
    const matchesSearch =
      !search ||
      c.complaint_no.toLowerCase().includes(search.toLowerCase()) ||
      c.complaint.toLowerCase().includes(search.toLowerCase()) ||
      c.machine?.machine_code?.toLowerCase().includes(search.toLowerCase()) ||
      c.machine?.model?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
          <span className="text-[10px] text-[var(--color-mute)]">{row.complaint_date}</span>
        </div>
      ),
    },
    {
      id: "machine",
      header: "Machine & Model",
      cell: (row: ComplaintWithDetails) => (
        <div className="flex flex-col">
          <span className="font-bold text-xs text-[var(--color-ink)]">
            {row.machine?.machine_name || row.machine?.machine_code || "Unknown"}
          </span>
          <div className="flex items-center gap-2 text-[11px] text-[var(--color-mute)] font-mono">
            <span>Code: {row.machine?.machine_code}</span>
            <span>Model: {row.machine?.model || "N/A"}</span>
          </div>
        </div>
      ),
    },
    {
      id: "complaint",
      header: "Malfunction Issue",
      cell: (row: ComplaintWithDetails) => (
        <div className="flex flex-col max-w-xs">
          <span className="text-xs font-semibold text-[var(--color-ink)] line-clamp-2">
            {row.complaint}
          </span>
          {row.required_part && (
            <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
              Part Req: {row.required_part} (Qty: {row.part_quantity})
            </span>
          )}
        </div>
      ),
    },
    {
      id: "assigned",
      header: "Supervisor & Engineer",
      cell: (row: ComplaintWithDetails) => (
        <div className="flex flex-col text-xs">
          <div className="flex items-center gap-1 text-[var(--color-ink)] font-medium">
            <span className="text-[10px] text-[var(--color-mute)]">Raised:</span>
            {row.supervisor?.full_name || "Supervisor"}
          </div>
          <div className="flex items-center gap-1 text-[var(--color-link)] font-semibold text-[11px]">
            <span className="text-[10px] text-[var(--color-mute)]">Eng:</span>
            {row.engineer?.full_name || "Unassigned"}
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
          <div className="flex items-center gap-1.5 justify-end">
            <Button
              variant="ghost-sm"
              onClick={() => {
                setSelectedComplaint(row);
                setComplaintModalOpen(true);
              }}
              title="Edit Complaint"
            >
              Edit
            </Button>

            {isResolved ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedComplaint(row);
                  setFsrModalOpen(true);
                }}
                className="text-xs bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 hover:bg-emerald-600/20 font-semibold"
              >
                <AnimatedFileText size={14} className="mr-1" /> View FSR Report
              </Button>
            ) : userRole === "supervisor" ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedComplaint(row);
                  setFsrModalOpen(true);
                }}
                className="text-xs bg-slate-600/10 text-slate-700 dark:text-slate-300 border-slate-300 hover:bg-slate-600/20 font-semibold"
              >
                <AnimatedEye size={14} className="mr-1" /> View Details
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedComplaint(row);
                  setFsrModalOpen(true);
                }}
                className="text-xs bg-sky-600/10 text-sky-700 dark:text-sky-300 border-sky-300 hover:bg-sky-600/20 font-semibold"
              >
                <AnimatedWrench size={14} className="mr-1" /> Resolve (Fill FSR)
              </Button>
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

      {/* Filter Toolbar */}
      <FilterToolbar
        searchQuery={search}
        onSearchChange={setSearch}
        placeholder="Search complaint code, issue, machine..."
        activeFilterCount={statusFilter !== "all" ? 1 : 0}
        onResetFilters={() => setStatusFilter("all")}
      >
        <div className="flex items-center gap-2 pt-1">
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
        </div>
      </FilterToolbar>

      {/* Complaints Table */}
      <EnterpriseTable
        columns={columns}
        data={filteredComplaints}
        loading={isPending}
        emptyMessage="No machine complaints recorded"
        emptyDescription="All machines are running smoothly without active malfunction reports."
      />

      {/* Modals */}
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
    </div>
  );
}
