"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AnimatedChevronLeft,
  AnimatedEdit,
  AnimatedCheck,
  AnimatedCopy,
  AnimatedMessageSquare,
  AnimatedTrash,
  AnimatedLoader,
} from "@/components/ui/animated-icons";
import { ScissorLiftLogoIcon } from "@/components/branding/ScissorLiftLogoIcon";
import {
  Phone,
  Mail,
  Check,
  Copy,
  MapPin,
  Building2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Clock,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  SlidersHorizontal,
  Calendar,
  Users,
  UserCheck,
  Shield,
  Wrench,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardHeader,
  Badge,
  Button,
  EmptyState,
  FadeIn,
  useToast,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Pagination,
  ConfirmationDialog,
  SegmentedToggle,
} from "@/components/ui";
import type { MachineWithEngineer } from "@/lib/types/database";
import { formatDate, formatShiftTimingRange } from "@reachinternational/utils";
import { deleteMachine, getMachineHourLogsAction } from "@/app/actions/machines";

interface MachineClientViewProps {
  machine: MachineWithEngineer;
  activeRental?: any;
  isAdmin: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  isAssignedEngineer: boolean;
  currentUserId: string;
}

export function MachineClientView({
  machine,
  activeRental = null,
  isAdmin,
  canEdit,
  canDelete,
}: MachineClientViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedBillingAddress, setCopiedBillingAddress] = useState(false);
  const [copiedGstin, setCopiedGstin] = useState(false);
  const [copiedPan, setCopiedPan] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "running_hours">("overview");

  // Lazy loading state for machine hour meter running logs
  const [hourMeterLogs, setHourMeterLogs] = useState<any[] | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [hasLoadedLogs, setHasLoadedLogs] = useState(false);

  // Hour meter logs filtering, searching, sorting & pagination state
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logDateFilter, setLogDateFilter] = useState<"all" | "7d" | "30d" | "month">("all");
  const [logOperatorFilter, setLogOperatorFilter] = useState<string>("all");
  const [logSortBy, setLogSortBy] = useState<"date" | "running_hours" | "start_meter" | "end_meter">("date");
  const [logSortOrder, setLogSortOrder] = useState<"asc" | "desc">("desc");
  const [showFilterSort, setShowFilterSort] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);

  const allowEdit = canEdit ?? isAdmin;
  const allowDelete = canDelete ?? isAdmin;

  // Title formatting: Machine Model - Serial no (with graceful fallbacks)
  const machineTitle =
    [machine.model, machine.serial_number].filter(Boolean).join(" - ") ||
    machine.machine_id ||
    "Machine Details";

  const loadHourMeterLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    setLogsError(null);
    try {
      const res = await getMachineHourLogsAction(machine.id);
      if (res.success && res.logs) {
        setHourMeterLogs(res.logs);
        setHasLoadedLogs(true);
      } else {
        setLogsError(res.error || "Failed to load hour meter running logs.");
        setHourMeterLogs([]);
        setHasLoadedLogs(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected network error occurred.";
      setLogsError(msg);
      setHourMeterLogs([]);
      setHasLoadedLogs(true);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [machine.id]);

  const handleTabChange = (tabId: "overview" | "running_hours") => {
    setActiveTab(tabId);
    if (tabId === "running_hours" && !hasLoadedLogs && !isLoadingLogs) {
      loadHourMeterLogs();
    }
  };

  const handleDeleteMachine = () => {
    startDeleteTransition(async () => {
      const res = await deleteMachine(machine.id);
      if (res?.error) {
        toast("error", "Failed to delete machine", res.error);
        setDeleteConfirmOpen(false);
      } else {
        toast("success", "Machine deleted", `${machine.machine_id} has been permanently deleted.`);
        setDeleteConfirmOpen(false);
        router.push("/machines");
      }
    });
  };

  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(machine.machine_id || machine.machine_code || "");
    setCopiedId(true);
    toast("success", "Copied!", `Machine ID ${machine.machine_id} copied to clipboard.`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const assignedSupervisors = useMemo(() => {
    if (Array.isArray(machine.supervisors) && machine.supervisors.length > 0) {
      return machine.supervisors;
    }
    if (machine.current_supervisor) {
      return [machine.current_supervisor];
    }
    return [];
  }, [machine.supervisors, machine.current_supervisor]);

  const assignedOperators = useMemo(() => {
    if (Array.isArray(machine.operators) && machine.operators.length > 0) {
      return machine.operators;
    }
    if (machine.current_operator) {
      return [machine.current_operator];
    }
    return [];
  }, [machine.operators, machine.current_operator]);

  // Derived unique operators list for filter dropdown
  const availableOperators = useMemo(() => {
    if (!hourMeterLogs) return [];
    const opsMap = new Map<string, string>();
    hourMeterLogs.forEach((log: any) => {
      const id = log.operator_id || log.operator?.id;
      const name = log.operator?.full_name || log.operator_name;
      if (id && name) opsMap.set(id, name);
      else if (name) opsMap.set(name, name);
    });
    return Array.from(opsMap.entries()).map(([id, name]) => ({ id, name }));
  }, [hourMeterLogs]);

  // High-performance filter & sort pipeline
  const filteredAndSortedLogs = useMemo(() => {
    if (!hourMeterLogs || hourMeterLogs.length === 0) return [];
    let list = [...hourMeterLogs];

    // 1. Text Search (operator, remarks, date, meter)
    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase().trim();
      list = list.filter((log: any) => {
        const opName = (log.operator?.full_name || log.operator_name || "").toLowerCase();
        const remarks = (log.remarks || "").toLowerCase();
        const dateStr = log.log_date ? formatDate(log.log_date).toLowerCase() : "";
        const startM = String(log.start_meter ?? "");
        const endM = String(log.end_meter ?? "");
        return (
          opName.includes(q) ||
          remarks.includes(q) ||
          dateStr.includes(q) ||
          startM.includes(q) ||
          endM.includes(q)
        );
      });
    }

    // 2. Date Preset Filter
    if (logDateFilter !== "all") {
      const now = new Date();
      list = list.filter((log: any) => {
        if (!log.log_date) return false;
        const logD = new Date(log.log_date);
        if (isNaN(logD.getTime())) return true;
        if (logDateFilter === "7d") {
          const past7 = new Date(now);
          past7.setDate(past7.getDate() - 7);
          return logD >= past7;
        }
        if (logDateFilter === "30d") {
          const past30 = new Date(now);
          past30.setDate(past30.getDate() - 30);
          return logD >= past30;
        }
        if (logDateFilter === "month") {
          return logD.getMonth() === now.getMonth() && logD.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }

    // 3. Operator Filter
    if (logOperatorFilter !== "all") {
      list = list.filter((log: any) => {
        const opId = log.operator_id || log.operator?.id;
        const opName = log.operator?.full_name || log.operator_name;
        return opId === logOperatorFilter || opName === logOperatorFilter;
      });
    }

    // 4. Sorting
    list.sort((a: any, b: any) => {
      let comparison = 0;
      if (logSortBy === "date") {
        const dateA = new Date(a.log_date || 0).getTime();
        const dateB = new Date(b.log_date || 0).getTime();
        comparison = dateA - dateB;
      } else if (logSortBy === "running_hours") {
        comparison = (Number(a.running_hours) || 0) - (Number(b.running_hours) || 0);
      } else if (logSortBy === "start_meter") {
        comparison = (Number(a.start_meter) || 0) - (Number(b.start_meter) || 0);
      } else if (logSortBy === "end_meter") {
        comparison = (Number(a.end_meter) || 0) - (Number(b.end_meter) || 0);
      }
      return logSortOrder === "asc" ? comparison : -comparison;
    });

    return list;
  }, [hourMeterLogs, logSearchQuery, logDateFilter, logOperatorFilter, logSortBy, logSortOrder]);

  // Active filter count for badge indicator
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (logDateFilter !== "all") count++;
    if (logOperatorFilter !== "all") count++;
    if (logSortBy !== "date" || logSortOrder !== "desc") count++;
    return count;
  }, [logDateFilter, logOperatorFilter, logSortBy, logSortOrder]);

  // Overall and filtered KPI stats
  const logStats = useMemo(() => {
    const totalHours = filteredAndSortedLogs.reduce((acc, log: any) => acc + (Number(log.running_hours) || 0), 0);
    return {
      count: filteredAndSortedLogs.length,
      totalHours: Number(totalHours.toFixed(1)),
    };
  }, [filteredAndSortedLogs]);

  // Paginated records
  const paginatedLogs = useMemo(() => {
    const start = (logPage - 1) * logPageSize;
    return filteredAndSortedLogs.slice(start, start + logPageSize);
  }, [filteredAndSortedLogs, logPage, logPageSize]);

  const isAnyFilterActive =
    Boolean(logSearchQuery.trim()) ||
    logDateFilter !== "all" ||
    logOperatorFilter !== "all" ||
    logSortBy !== "date" ||
    logSortOrder !== "desc";

  const handleResetFilters = () => {
    setLogSearchQuery("");
    setLogDateFilter("all");
    setLogOperatorFilter("all");
    setLogSortBy("date");
    setLogSortOrder("desc");
    setLogPage(1);
  };

  const handleSort = (column: "date" | "running_hours" | "start_meter" | "end_meter") => {
    if (logSortBy === column) {
      setLogSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setLogSortBy(column);
      setLogSortOrder("desc");
    }
  };

  // Linked Client Data from public.clients table (Supabase) via machine.client or activeRental.client
  const client = machine.client || activeRental?.client || null;
  const clientCompanyName = client?.company_name || machine.customer_name || "";
  const clientCode = client?.code || "";
  const clientContactPerson = client?.contact_person || "";
  const clientPhone = client?.phone || machine.customer_mobile || "";
  const clientEmail = (client as any)?.email || machine.customer_email || "";
  const clientGstin = client?.gstin || "";
  const clientPan = client?.pan_number || "";
  const clientAddress = client?.address || machine.customer_address || "";
  const clientCity = client?.city || machine.city || "";
  const clientDistrict = client?.district || "";
  const clientState = client?.state || machine.state || "";
  const clientPincode = client?.pincode || "";
  const isBillingAddressDifferent = Boolean(client?.is_billing_address_different);
  const billingAddress = client?.billing_address || "";
  const billingCity = client?.billing_city || "";
  const billingDistrict = client?.billing_district || "";
  const billingState = client?.billing_state || "";
  const billingPincode = client?.billing_pincode || "";

  const clientLocationParts = [clientCity, clientDistrict, clientState].filter(Boolean);
  const clientLocation = clientLocationParts.length > 0 ? Array.from(new Set(clientLocationParts)).join(", ") : "";
  const hasLinkedClient = Boolean(clientCompanyName || clientAddress || clientPhone || client?.id);

  const fullSiteAddress = [clientAddress, clientLocation, clientPincode ? `PIN: ${clientPincode}` : ""]
    .filter(Boolean)
    .join(", ");

  const fullBillingAddress = [
    billingAddress,
    [billingCity, billingDistrict, billingState].filter(Boolean).join(", "),
    billingPincode ? `PIN: ${billingPincode}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const handleCopySiteAddress = () => {
    navigator.clipboard.writeText(fullSiteAddress || "—");
    setCopiedAddress(true);
    toast("info", "Address Copied!", "Site location address copied to clipboard.");
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleCopyBillingAddress = () => {
    navigator.clipboard.writeText(fullBillingAddress || "—");
    setCopiedBillingAddress(true);
    toast("info", "Billing Address Copied!", "Billing address copied to clipboard.");
    setTimeout(() => setCopiedBillingAddress(false), 2000);
  };

  const handleCopyGstin = () => {
    if (!clientGstin) return;
    navigator.clipboard.writeText(clientGstin);
    setCopiedGstin(true);
    toast("info", "GSTIN Copied!", `${clientGstin} copied to clipboard.`);
    setTimeout(() => setCopiedGstin(false), 2000);
  };

  const handleCopyPan = () => {
    if (!clientPan) return;
    navigator.clipboard.writeText(clientPan);
    setCopiedPan(true);
    toast("info", "PAN Copied!", `${clientPan} copied to clipboard.`);
    setTimeout(() => setCopiedPan(false), 2000);
  };

  const cleanPhone = clientPhone ? clientPhone.replace(/[^0-9+]/g, "") : "";
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `Hello ${clientContactPerson || clientCompanyName || "Client"}, regarding machine ${machine.model ? `${machine.model} (${machine.machine_id})` : machine.machine_id}.`
  )}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${clientCompanyName} ${clientAddress} ${clientLocation}`.trim()
  )}`;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-20 md:pb-8 max-w-7xl mx-auto px-2 sm:px-4 md:px-6 w-full">
      {/* Top Breadcrumb Navigation */}
      <FadeIn className="flex items-center justify-between">
        <Link
          href="/machines"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors group py-1"
        >
          <motion.div whileTap={{ scale: 0.85 }} className="flex items-center">
            <AnimatedChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Machines</span>
          </motion.div>
        </Link>
      </FadeIn>

      {/* Hero Machine Banner Card */}
      <FadeIn delay={0.05}>
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-5 md:p-6 shadow-2xs transition-all">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-[var(--color-link)]/10 blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 relative z-10">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <motion.div
                whileHover={{ scale: 1.05, rotate: 2 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-11 w-11 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-md border border-neutral-800"
              >
                <ScissorLiftLogoIcon size={24} className="text-sky-400" />
              </motion.div>

              <div className="flex flex-col gap-1 min-w-0 flex-1">
                {/* Title: Machine Model - Serial no */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h1 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">
                    {machineTitle}
                  </h1>

                  {/* Health Status Badge */}
                  <Badge
                    variant={
                      machine.health_status === "breakdown"
                        ? "overdue"
                        : machine.health_status === "under_maintenance"
                        ? "warning"
                        : "success"
                    }
                    dot
                  >
                    <span className="capitalize font-semibold text-[11px] sm:text-xs">
                      {machine.health_status === "breakdown"
                        ? "Breakdown"
                        : machine.health_status === "under_maintenance"
                        ? "Under Maintenance"
                        : "Active"}
                    </span>
                  </Badge>

                  {/* Rental Fleet Status Badge */}
                  <Badge
                    variant={
                      machine.status === "on_rent" || machine.status === "rented"
                        ? "info"
                        : machine.status === "active"
                        ? "success"
                        : machine.status === "under_maintenance"
                        ? "warning"
                        : "neutral"
                    }
                  >
                    <span className="capitalize font-semibold text-[11px] sm:text-xs">
                      {machine.status === "on_rent" || machine.status === "rented"
                        ? "On Rent"
                        : machine.status === "under_maintenance"
                        ? "Under Maintenance"
                        : machine.status === "available"
                        ? "Available"
                        : machine.status}
                    </span>
                  </Badge>
                </div>
              </div>
            </div>

            {/* Header Action Buttons (Icon-only on mobile, full labeled on desktop) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-end sm:self-center">
              {allowEdit && (
                <Button
                  variant="secondary"
                  icon={<AnimatedEdit size={15} className="text-[var(--color-ink)]" />}
                  responsive
                  mobileIconOnly
                  title="Edit Machine Details"
                  href={`/machines/${machine.id}/edit`}
                >
                  Edit Machine
                </Button>
              )}
              {allowDelete && (
                <Button
                  variant="destructive"
                  icon={<AnimatedTrash size={15} />}
                  responsive
                  mobileIconOnly
                  title="Delete Machine"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={isDeleting}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Segmented Toggle Navigation Bar (Optimized for Mobile & Desktop) */}
      <SegmentedToggle<"overview" | "running_hours">
        value={activeTab}
        onChange={handleTabChange}
        layoutIdPrefix="machine-view-tab"
        items={[
          {
            id: "overview",
            label: (
              <span>
                <span className="sm:hidden">Basic Info</span>
                <span className="hidden sm:inline">Basic Info & Client</span>
              </span>
            ),
          },
          {
            id: "running_hours",
            label: (
              <span>
                <span className="sm:hidden">Running Logs</span>
                <span className="hidden sm:inline">Hours Meter Logs</span>
              </span>
            ),
            badge: isLoadingLogs ? (
              <span className="inline-flex items-center ml-0.5 shrink-0">
                <AnimatedLoader isSpinning size={12} className="text-sky-500" />
              </span>
            ) : null,
            count: hasLoadedLogs && hourMeterLogs !== null ? hourMeterLogs.length : undefined,
          },
        ]}
      />

      {/* Main Tab Content Panels */}
      <AnimatePresence mode="wait">
        {/* TAB 1: BASIC INFO & CLIENT */}
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-4 sm:gap-6"
          >
            {/* Basic Info Card */}
            <Card padding="md" className="card-hover-system sm:p-6">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--color-hairline)]">
                <h3 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
                  Basic Info
                </h3>
                <Badge variant={machine.status === "rented" || machine.status === "on_rent" ? "info" : "neutral"} dot>
                  <span className="font-semibold uppercase tracking-wider text-[10px] sm:text-xs">
                    {machine.status === "rented" || machine.status === "on_rent" ? "On Rent" : "Available"}
                  </span>
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5 mt-3.5 text-xs sm:text-sm">
                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Machine ID</span>
                    <button
                      type="button"
                      onClick={handleCopyMachineId}
                      title="Copy Unique Machine ID"
                      className="text-[10px] text-[var(--color-mute)] hover:text-[var(--color-ink)] inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      {copiedId ? (
                        <AnimatedCheck size={10} className="text-emerald-600" />
                      ) : (
                        <AnimatedCopy size={10} className="text-[var(--color-mute)]" />
                      )}
                    </button>
                  </div>
                  <span className="font-bold text-[var(--color-ink)] font-mono text-xs sm:text-sm">{machine.machine_id}</span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Model</span>
                  <span className="font-bold text-[var(--color-ink)] text-xs sm:text-sm">{machine.model || "—"}</span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Serial No</span>
                  <span className="font-bold text-[var(--color-ink)] font-mono text-xs sm:text-sm">{machine.serial_number || "—"}</span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Year Of Mfg (YUM)</span>
                  <span className="font-bold text-[var(--color-ink)] text-xs sm:text-sm">{machine.year_of_mfg || "—"}</span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Manufacturer</span>
                  <span className="font-bold text-[var(--color-ink)] text-xs sm:text-sm">{machine.manufacturer || "—"}</span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Hour Meter (HMR)</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 font-mono text-xs sm:text-sm">{machine.hour_meter ?? 0} hrs</span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Supervisors</span>
                    {assignedSupervisors.length > 0 && (
                      <span className="text-[10px] font-mono text-teal-600 dark:text-teal-400 font-bold">
                        {assignedSupervisors.length}
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-[var(--color-ink)] text-xs sm:text-sm truncate">
                    {assignedSupervisors.length === 0
                      ? "—"
                      : assignedSupervisors.length === 1
                      ? assignedSupervisors[0].full_name
                      : `${assignedSupervisors[0].full_name} +${assignedSupervisors.length - 1} more`}
                  </span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Operators</span>
                    {assignedOperators.length > 0 && (
                      <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                        {assignedOperators.length} (24h)
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-[var(--color-ink)] text-xs sm:text-sm truncate">
                    {assignedOperators.length === 0
                      ? "—"
                      : assignedOperators.length === 1
                      ? assignedOperators[0].full_name
                      : `${assignedOperators[0].full_name} +${assignedOperators.length - 1} more`}
                  </span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Health Status</span>
                  <span className="font-bold text-xs sm:text-sm capitalize text-[var(--color-ink)]">
                    {machine.health_status === "breakdown" ? "Breakdown" : machine.health_status === "under_maintenance" ? "Under Maintenance" : "Active"}
                  </span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Rental Fleet Status</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 text-xs sm:text-sm capitalize">
                    {machine.status === "rented" || machine.status === "on_rent" ? "On Rent" : "Available"}
                  </span>
                </div>
              </div>
            </Card>

            {/* Assigned Shift Personnel Card (24h Multi-Shift Coverage) */}
            <Card padding="md" className="card-hover-system sm:p-6 border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--color-hairline)]">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
                    Assigned Shift Personnel (24h Fleet Coverage)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-mute)] bg-[var(--color-hairline-soft-surface)] px-2 py-0.5 rounded-md border border-[var(--color-hairline)]">
                    <Clock size={11} className="text-sky-500" />
                    8-Hour Shifts
                  </span>
                  <Link
                    href={`/machines/${machine.id}/edit`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-link)] hover:underline"
                  >
                    <AnimatedEdit size={12} />
                    <span>Manage Staff</span>
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                {/* 1. Supervisors Panel */}
                <div className="flex flex-col gap-2.5 p-3 sm:p-4 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)]">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                      <span className="text-xs font-bold text-[var(--color-ink)]">
                        Supervisors ({assignedSupervisors.length})
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20">
                      Oversight & Verification
                    </span>
                  </div>

                  {assignedSupervisors.length === 0 ? (
                    <div className="py-4 text-center text-xs text-[var(--color-mute)] italic">
                      No supervisors assigned to this machine.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {assignedSupervisors.map((sup, idx) => (
                        <div
                          key={sup.id || idx}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-hairline-soft-surface)]/50 border border-[var(--color-hairline)] text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[var(--color-ink)] truncate">
                                {sup.full_name}
                              </span>
                              <span className="text-[10px] font-mono text-[var(--color-mute)]">
                                Shift {idx + 1}
                              </span>
                            </div>
                            {sup.shift_time && (
                              <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                                <Clock size={10} />
                                <span>{sup.shift_time}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {sup.phone && (
                              <a
                                href={`tel:${sup.phone}`}
                                title={`Call ${sup.full_name}`}
                                className="p-1.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-mute)] hover:text-sky-600 hover:border-sky-500/40 transition-colors"
                              >
                                <Phone size={12} />
                              </a>
                            )}
                            {sup.email && (
                              <a
                                href={`mailto:${sup.email}`}
                                title={`Email ${sup.full_name}`}
                                className="p-1.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-mute)] hover:text-sky-600 hover:border-sky-500/40 transition-colors"
                              >
                                <Mail size={12} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Operators Panel */}
                <div className="flex flex-col gap-2.5 p-3 sm:p-4 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)]">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-bold text-[var(--color-ink)]">
                        Operators ({assignedOperators.length})
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      Hour Logging & Operations
                    </span>
                  </div>

                  {assignedOperators.length === 0 ? (
                    <div className="py-4 text-center text-xs text-[var(--color-mute)] italic">
                      No operators assigned. Assign operators to enable 24h shift logging.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {assignedOperators.map((op, idx) => (
                        <div
                          key={op.id || idx}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-hairline-soft-surface)]/50 border border-[var(--color-hairline)] text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[var(--color-ink)] truncate">
                                {op.full_name}
                              </span>
                              <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.2 rounded">
                                Shift {idx + 1}
                              </span>
                            </div>
                            {op.shift_time && (
                              <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                                <Clock size={10} />
                                <span>{op.shift_time}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {op.phone && (
                              <a
                                href={`tel:${op.phone}`}
                                title={`Call ${op.full_name}`}
                                className="p-1.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-mute)] hover:text-amber-600 hover:border-amber-500/40 transition-colors"
                              >
                                <Phone size={12} />
                              </a>
                            )}
                            {op.email && (
                              <a
                                href={`mailto:${op.email}`}
                                title={`Email ${op.full_name}`}
                                className="p-1.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-mute)] hover:text-amber-600 hover:border-amber-500/40 transition-colors"
                              >
                                <Mail size={12} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Linked Client Details Section from public.clients table (Supabase) */}
            <Card padding="md" className="card-hover-system sm:p-6 border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--color-hairline)]">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
                    Assigned Client Details
                  </h3>
                  {clientCode && (
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      {clientCode}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={machine.status === "on_rent" || machine.status === "rented" ? "info" : "neutral"}>
                    <span className="text-[10px] sm:text-xs font-semibold">
                      {machine.status === "on_rent" || machine.status === "rented" ? "On Rent Active" : "Site Deployed"}
                    </span>
                  </Badge>
                  {client?.id && (
                    <Link
                      href={`/clients?tab=all`}
                      className="hidden sm:inline-flex items-center gap-1 text-xs text-[var(--color-link)] hover:underline ml-1 font-medium"
                    >
                      <span>View Directory</span>
                      <ExternalLink size={12} />
                    </Link>
                  )}
                </div>
              </div>

              {hasLinkedClient ? (
                <div className="flex flex-col gap-3.5 sm:gap-4 mt-3.5 sm:mt-4 text-xs sm:text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
                    {/* CLIENT NAME (Feedback #2) */}
                    <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                        CLIENT NAME
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-[var(--color-ink)] text-sm sm:text-base">
                          {clientCompanyName}
                        </p>
                        {clientCode && (
                          <span className="inline-flex sm:hidden items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                            {clientCode}
                          </span>
                        )}
                      </div>
                      {activeRental?.contract_number && (
                        <span className="inline-block mt-1.5 font-mono text-[11px] text-sky-600 dark:text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded self-start border border-sky-500/20">
                          Contract: {activeRental.contract_number}
                        </span>
                      )}
                    </div>

                    {/* Contact Person */}
                    <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                        Contact Person
                      </span>
                      <p className="font-semibold text-[var(--color-ink)] text-xs sm:text-sm">
                        {clientContactPerson || "—"}
                      </p>
                    </div>

                    {/* Contact Mobile */}
                    <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                        Contact Mobile
                      </span>
                      {clientPhone ? (
                        <a
                          href={`tel:${clientPhone}`}
                          className="font-semibold text-[var(--color-link)] hover:underline inline-flex items-center gap-1.5 text-xs sm:text-sm font-mono"
                        >
                          <Phone className="h-3.5 w-3.5 shrink-0" /> {clientPhone}
                        </a>
                      ) : (
                        <p className="text-[var(--color-mute)]">—</p>
                      )}
                    </div>

                    {/* Contact Email */}
                    {clientEmail && (
                      <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                        <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                          Contact Email
                        </span>
                        <a
                          href={`mailto:${clientEmail}`}
                          className="font-medium text-[var(--color-link)] hover:underline inline-flex items-center gap-1.5 break-all text-xs sm:text-sm"
                        >
                          <Mail className="h-3.5 w-3.5 shrink-0" /> {clientEmail}
                        </a>
                      </div>
                    )}

                    {/* City & State */}
                    <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                        City & State
                      </span>
                      <p className="font-semibold text-[var(--color-ink)] text-xs sm:text-sm">
                        {clientLocation || "—"}
                      </p>
                    </div>

                    {/* GSTIN */}
                    {clientGstin && (
                      <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                            GSTIN
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyGstin}
                            title={copiedGstin ? "Copied!" : "Copy GSTIN"}
                            aria-label="Copy GSTIN"
                            className="p-1 -mr-1 -mt-0.5 rounded-md text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] inline-flex items-center justify-center cursor-pointer transition-colors"
                          >
                            {copiedGstin ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        <p className="font-mono font-semibold text-[var(--color-ink)] text-xs sm:text-sm">
                          {clientGstin}
                        </p>
                      </div>
                    )}

                    {/* PAN Number */}
                    {clientPan && (
                      <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                            PAN Number
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyPan}
                            title={copiedPan ? "Copied!" : "Copy PAN Number"}
                            aria-label="Copy PAN Number"
                            className="p-1 -mr-1 -mt-0.5 rounded-md text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] inline-flex items-center justify-center cursor-pointer transition-colors"
                          >
                            {copiedPan ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        <p className="font-mono font-semibold text-[var(--color-ink)] text-xs sm:text-sm">
                          {clientPan}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* SITE LOCATION */}
                  <div className="flex flex-col p-3 sm:p-3.5 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                        SITE LOCATION
                      </span>
                      <button
                        type="button"
                        onClick={handleCopySiteAddress}
                        title={copiedAddress ? "Copied!" : "Copy Site Address"}
                        aria-label="Copy Site Address"
                        className="p-1 -mr-1 -mt-0.5 rounded-md text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] inline-flex items-center justify-center cursor-pointer transition-colors"
                      >
                        {copiedAddress ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-[var(--color-ink)] leading-relaxed font-medium">
                      {clientAddress || "—"}
                      {clientLocation && !clientAddress.includes(clientLocation) ? `, ${clientLocation}` : ""}
                      {clientPincode ? ` - ${clientPincode}` : ""}
                    </p>
                  </div>

                  {/* Billing Address (if separate) */}
                  {isBillingAddressDifferent && (billingAddress || billingCity) && (
                    <div className="flex flex-col p-3 sm:p-3.5 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                          Billing Address
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyBillingAddress}
                          title={copiedBillingAddress ? "Copied!" : "Copy Billing Address"}
                          aria-label="Copy Billing Address"
                          className="p-1 -mr-1 -mt-0.5 rounded-md text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] inline-flex items-center justify-center cursor-pointer transition-colors"
                        >
                          {copiedBillingAddress ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <p className="text-xs sm:text-sm text-[var(--color-ink)] leading-relaxed font-medium">
                        {fullBillingAddress || "—"}
                      </p>
                    </div>
                  )}

                  {/* Rental Contract Timeline & Rate if available */}
                  {activeRental && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                      <div>
                        <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block mb-0.5">Rental Start</span>
                        <span className="font-semibold text-xs sm:text-sm text-[var(--color-ink)]">{formatDate(activeRental.start_date)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block mb-0.5">Rental End</span>
                        <span className="font-semibold text-xs sm:text-sm text-[var(--color-ink)]">{formatDate(activeRental.end_date)}</span>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block mb-0.5">Rental Rate</span>
                        <span className="font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                          ₹{(activeRental.monthly_rate || activeRental.rental_rate || 0).toLocaleString("en-IN")} / {activeRental.rate_unit || "month"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Quick Action Touch Buttons */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {clientPhone ? (
                      <motion.a
                        whileTap={{ scale: 0.96 }}
                        href={`tel:${clientPhone}`}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 transition-all text-center font-semibold text-xs min-h-[44px]"
                      >
                        <Phone className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="truncate">Call</span>
                      </motion.a>
                    ) : null}

                    {clientPhone ? (
                      <motion.a
                        whileTap={{ scale: 0.96 }}
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/20 transition-all text-center font-semibold text-xs min-h-[44px]"
                      >
                        <AnimatedMessageSquare size={16} className="shrink-0 text-green-600 dark:text-green-400" />
                        <span className="truncate">WhatsApp</span>
                      </motion.a>
                    ) : null}

                    <motion.a
                      whileTap={{ scale: 0.96 }}
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-500/20 transition-all text-center font-semibold text-xs min-h-[44px]"
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                      <span className="truncate">Map Location</span>
                    </motion.a>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center bg-[var(--color-hairline-soft-surface)]/30 rounded-xl border border-dashed border-[var(--color-hairline)] mt-3 p-4">
                  <Building2 className="h-8 w-8 text-[var(--color-mute)] mx-auto mb-2 opacity-50" />
                  <p className="font-bold text-[var(--color-ink)] text-xs sm:text-sm">No Client Assigned</p>
                  <p className="text-xs text-[var(--color-mute)] mt-1 max-w-sm mx-auto">
                    This machine is currently available in the fleet inventory and has not been linked to a client account in the CRM.
                  </p>
                  {allowEdit && (
                    <div className="mt-4">
                      <Button href={`/machines/${machine.id}/edit`} variant="secondary" size="sm">
                        Assign Client
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* TAB 2: HOURS METER LOGS (Lazy Loaded on Demand & 3-Tier Responsive) */}
        {activeTab === "running_hours" && (
          <motion.div
            key="running_hours"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Card padding="md" className="sm:p-6">
              {/* Header: Title on Left, Total Hours Run Badge at Top-Right Corner */}
              <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-[var(--color-hairline)]">
                <h3 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
                  Hours Meter Logs
                </h3>

                {hasLoadedLogs && hourMeterLogs && hourMeterLogs.length > 0 && (
                  <Badge variant="info" className="font-mono text-xs">
                    <span className="font-bold">+{logStats.totalHours}</span> hrs Run
                  </Badge>
                )}
              </div>

              {/* Loading Skeleton */}
              {isLoadingLogs && (
                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                    <div className="flex items-center gap-2">
                      <AnimatedLoader isSpinning size={16} className="text-sky-500" />
                      <span className="text-xs font-medium text-[var(--color-ink)]">
                        Loading running meter history...
                      </span>
                    </div>
                  </div>
                  <div className="w-full rounded-xl border border-[var(--color-hairline)] overflow-hidden">
                    <div className="h-10 bg-[var(--color-hairline-soft-surface)]" />
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-12 border-t border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] animate-pulse flex items-center px-4 gap-4">
                        <div className="h-4 w-20 bg-[var(--color-hairline)] rounded" />
                        <div className="h-4 w-28 bg-[var(--color-hairline)] rounded" />
                        <div className="h-4 w-24 bg-[var(--color-hairline)] rounded" />
                        <div className="h-4 w-20 bg-[var(--color-hairline)] rounded ml-auto" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error State */}
              {!isLoadingLogs && logsError && (
                <div className="mt-4 p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-medium">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{logsError}</span>
                  </div>
                  <Button size="sm" variant="secondary" onClick={loadHourMeterLogs}>
                    Retry
                  </Button>
                </div>
              )}

              {/* Initial Empty State (No logs ever recorded) */}
              {!isLoadingLogs && !logsError && hasLoadedLogs && (!hourMeterLogs || hourMeterLogs.length === 0) && (
                <div className="py-10 text-center">
                  <EmptyState
                    title="No Running Meter Logs Logged"
                    description="Daily hour meter logbook entries recorded by machine operators for this machine will appear here."
                    action={
                      <Link href="/operations?tab=entry">
                        <Button variant="secondary" size="sm">
                          + Add First Meter Log
                        </Button>
                      </Link>
                    }
                  />
                </div>
              )}

              {/* Filter & Sort Controls + Data Presentation */}
              {!isLoadingLogs && !logsError && hourMeterLogs && hourMeterLogs.length > 0 && (
                <div className="mt-4 space-y-4">
                  {/* Collapsible Search & Filter Toolbar */}
                  <div className="flex flex-col gap-2 p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/50 border border-[var(--color-hairline)]">
                    {/* Main Row: Search Input + Filter Toggle Icon */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 min-w-0">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)] pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search logs by operator, date, meter, remarks..."
                          value={logSearchQuery}
                          onChange={(e) => {
                            setLogSearchQuery(e.target.value);
                            setLogPage(1);
                          }}
                          className="w-full h-9 pl-9 pr-8 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] placeholder:text-[var(--color-mute)] focus:outline-none focus:border-sky-500 transition-colors"
                        />
                        {logSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setLogSearchQuery("");
                              setLogPage(1);
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-mute)] hover:text-[var(--color-ink)] p-0.5 rounded cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowFilterSort((prev) => !prev)}
                        title={showFilterSort ? "Hide filter and sorting options" : "Show filter and sorting options"}
                        aria-label="Toggle filter and sorting options"
                        className={`h-9 px-2.5 sm:px-3 rounded-lg text-xs font-semibold shrink-0 border transition-all cursor-pointer flex items-center gap-1.5 ${
                          showFilterSort || activeFilterCount > 0
                            ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
                            : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] hover:text-[var(--color-ink)] border-[var(--color-hairline)]"
                        }`}
                      >
                        <SlidersHorizontal size={14} className={showFilterSort || activeFilterCount > 0 ? "text-sky-500" : ""} />
                        <span className="hidden sm:inline">Filter & Sort</span>
                        {activeFilterCount > 0 && (
                          <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold bg-sky-500 text-white leading-none">
                            {activeFilterCount}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Expandable Filter & Sort Row (Single Row) */}
                    <AnimatePresence>
                      {showFilterSort && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap pt-1">
                            {/* Date Preset Filter */}
                            <select
                              value={logDateFilter}
                              onChange={(e) => {
                                setLogDateFilter(e.target.value as any);
                                setLogPage(1);
                              }}
                              className="h-9 px-2.5 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] focus:outline-none focus:border-sky-500 cursor-pointer shrink-0 font-medium flex-1 sm:flex-initial"
                            >
                              <option value="all">All Dates</option>
                              <option value="7d">Last 7 Days</option>
                              <option value="30d">Last 30 Days</option>
                              <option value="month">This Month</option>
                            </select>

                            {/* Operator Filter (if multiple) */}
                            {availableOperators.length > 1 && (
                              <select
                                value={logOperatorFilter}
                                onChange={(e) => {
                                  setLogOperatorFilter(e.target.value);
                                  setLogPage(1);
                                }}
                                className="h-9 px-2.5 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] focus:outline-none focus:border-sky-500 cursor-pointer shrink-0 font-medium max-w-[150px] truncate flex-1 sm:flex-initial"
                              >
                                <option value="all">All Operators</option>
                                {availableOperators.map((op) => (
                                  <option key={op.id} value={op.id}>
                                    {op.name}
                                  </option>
                                ))}
                              </select>
                            )}

                            {/* Multi-Criteria Sort Selector */}
                            <select
                              value={`${logSortBy}-${logSortOrder}`}
                              onChange={(e) => {
                                const [by, order] = e.target.value.split("-") as [any, any];
                                setLogSortBy(by);
                                setLogSortOrder(order);
                                setLogPage(1);
                              }}
                              className="h-9 px-2.5 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] focus:outline-none focus:border-sky-500 cursor-pointer shrink-0 font-medium flex-1 sm:flex-initial"
                            >
                              <option value="date-desc">Date: Newest First</option>
                              <option value="date-asc">Date: Oldest First</option>
                              <option value="running_hours-desc">Hours: High to Low</option>
                              <option value="running_hours-asc">Hours: Low to High</option>
                              <option value="start_meter-desc">Start Meter: High to Low</option>
                              <option value="start_meter-asc">Start Meter: Low to High</option>
                            </select>

                            {/* Clear/Reset Action Button */}
                            {isAnyFilterActive && (
                              <button
                                type="button"
                                onClick={handleResetFilters}
                                className="h-9 px-2.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 shrink-0 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <X size={12} />
                                <span>Reset</span>
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Filtered Empty State (No logs matched current filters) */}
                  {filteredAndSortedLogs.length === 0 && (
                    <div className="py-10 text-center border border-dashed border-[var(--color-hairline)] rounded-xl bg-[var(--color-hairline-soft-surface)]/20 p-6">
                      <Search className="h-8 w-8 text-[var(--color-mute)] mx-auto mb-2 opacity-50" />
                      <p className="font-bold text-xs sm:text-sm text-[var(--color-ink)]">No logs match your filter criteria</p>
                      <p className="text-xs text-[var(--color-mute)] mt-1 max-w-sm mx-auto">
                        Try adjusting your search terms, date range, or clear all filters.
                      </p>
                      <div className="mt-4">
                        <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                          Clear All Filters
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Desktop High-Density Table View with Interactive Sortable Columns (hidden on mobile, visible md+) */}
                  {filteredAndSortedLogs.length > 0 && (
                    <>
                      <div className="hidden md:block w-full overflow-x-auto rounded-xl border border-[var(--color-hairline)]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead
                                className="cursor-pointer select-none hover:text-[var(--color-ink)] transition-colors"
                                onClick={() => handleSort("date")}
                              >
                                <div className="flex items-center gap-1">
                                  <span>Log Date</span>
                                  {logSortBy === "date" ? (
                                    logSortOrder === "asc" ? (
                                      <ChevronUp size={13} className="text-sky-500" />
                                    ) : (
                                      <ChevronDown size={13} className="text-sky-500" />
                                    )
                                  ) : (
                                    <ArrowUpDown size={11} className="opacity-30" />
                                  )}
                                </div>
                              </TableHead>

                              <TableHead>Operator</TableHead>

                              <TableHead
                                className="cursor-pointer select-none hover:text-[var(--color-ink)] transition-colors"
                                onClick={() => handleSort("running_hours")}
                              >
                                <div className="flex items-center gap-1">
                                  <span>Operating Hours</span>
                                  {logSortBy === "running_hours" ? (
                                    logSortOrder === "asc" ? (
                                      <ChevronUp size={13} className="text-sky-500" />
                                    ) : (
                                      <ChevronDown size={13} className="text-sky-500" />
                                    )
                                  ) : (
                                    <ArrowUpDown size={11} className="opacity-30" />
                                  )}
                                </div>
                              </TableHead>

                              <TableHead
                                className="cursor-pointer select-none hover:text-[var(--color-ink)] transition-colors"
                                onClick={() => handleSort("start_meter")}
                              >
                                <div className="flex items-center gap-1">
                                  <span>Meter Reading (Start → End)</span>
                                  {logSortBy === "start_meter" || logSortBy === "end_meter" ? (
                                    logSortOrder === "asc" ? (
                                      <ChevronUp size={13} className="text-sky-500" />
                                    ) : (
                                      <ChevronDown size={13} className="text-sky-500" />
                                    )
                                  ) : (
                                    <ArrowUpDown size={11} className="opacity-30" />
                                  )}
                                </div>
                              </TableHead>

                              <TableHead>Remarks</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedLogs.map((log: any) => (
                              <TableRow key={log.id}>
                                <TableCell className="font-mono text-xs font-bold whitespace-nowrap">
                                  {formatDate(log.log_date)}
                                </TableCell>
                                <TableCell className="text-xs font-semibold whitespace-nowrap">
                                  {log.operator?.full_name || log.operator_name || "Operator"}
                                </TableCell>
                                <TableCell className="font-mono text-xs whitespace-nowrap">
                                  {log.start_time && log.end_time
                                    ? formatShiftTimingRange(log.start_time, log.end_time)
                                    : `${log.running_hours || 0} hrs`}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-sky-600 dark:text-sky-400 font-bold whitespace-nowrap">
                                  {log.start_meter || 0} → {log.end_meter || 0} (+{log.running_hours || 0}h)
                                </TableCell>
                                <TableCell className="text-xs text-[var(--color-mute)] max-w-xs truncate">
                                  {log.remarks || "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile & Tablet Card View (visible on mobile < md, hidden on md+) */}
                      <div className="block md:hidden flex flex-col gap-2.5">
                        {paginatedLogs.map((log: any) => (
                          <div
                            key={log.id}
                            className="p-3 sm:p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/50 flex flex-col gap-2 shadow-2xs"
                          >
                            {/* Top Row: Date & Operator */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-bold text-[var(--color-ink)]">
                                {formatDate(log.log_date)}
                              </span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] text-[var(--color-ink)] truncate max-w-[140px]">
                                {log.operator?.full_name || log.operator_name || "Operator"}
                              </span>
                            </div>

                            {/* Meter Reading Highlight */}
                            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)]">
                              <div className="flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-[var(--color-mute)] tracking-wider">Meter Reading</span>
                                <span className="font-mono text-xs font-bold text-[var(--color-ink)]">
                                  {log.start_meter || 0} → {log.end_meter || 0}
                                </span>
                              </div>
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                +{log.running_hours || 0} hrs
                              </span>
                            </div>

                            {/* Shift Timing */}
                            <div className="flex items-center justify-between text-xs text-[var(--color-mute)]">
                              <div className="flex items-center gap-1 font-mono">
                                <Clock size={12} className="shrink-0 text-[var(--color-mute)]" />
                                <span>
                                  {log.start_time && log.end_time
                                    ? formatShiftTimingRange(log.start_time, log.end_time)
                                    : `${log.running_hours || 0} hrs shift`}
                                </span>
                              </div>
                            </div>

                            {/* Remarks if available */}
                            {log.remarks && (
                              <div className="pt-1 border-t border-[var(--color-hairline)]/80 text-[11px]">
                                <span className="text-[var(--color-mute)] italic line-clamp-2">
                                  &ldquo;{log.remarks}&rdquo;
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Pagination Control (Desktop & Mobile) */}
                      {filteredAndSortedLogs.length > logPageSize && (
                        <div className="pt-2">
                          <Pagination
                            page={logPage}
                            pageSize={logPageSize}
                            total={filteredAndSortedLogs.length}
                            onPageChange={(p) => setLogPage(p)}
                            pageSizeOptions={[10, 25, 50]}
                            onPageSizeChange={(sz) => {
                              setLogPageSize(sz);
                              setLogPage(1);
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteMachine}
        title="Delete Machine"
        description={`Are you sure you want to permanently delete machine ${machine.machine_id} (${machine.model || "Unknown Model"})? This action cannot be undone and will remove related logs.`}
        confirmLabel="Delete Machine"
        cancelLabel="Keep Machine"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}

