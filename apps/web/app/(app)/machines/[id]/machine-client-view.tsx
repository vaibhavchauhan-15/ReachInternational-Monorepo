"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AnimatedChevronLeft,
  AnimatedEdit,
  AnimatedClock,
  AnimatedBuilding2,
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
  const [copiedCode, setCopiedCode] = useState(false);
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

  const handleCopyCode = () => {
    navigator.clipboard.writeText(machine.machine_id || machine.machine_code || "");
    setCopiedCode(true);
    toast("success", "Copied!", `Machine ID ${machine.machine_id} copied to clipboard.`);
    setTimeout(() => setCopiedCode(false), 2000);
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
            <div className="flex items-start gap-3 sm:gap-4">
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
                        : machine.status}
                    </span>
                  </Badge>
                </div>

                {/* Machine ID, Model, Serial No & Manufacturer metadata */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-mute)]">
                  <div className="inline-flex items-center gap-1">
                    <span className="font-mono text-[11px] sm:text-xs text-[var(--color-mute)] font-semibold">ID:</span>
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={handleCopyCode}
                      title="Copy Unique Machine ID"
                      className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-mono bg-[var(--color-hairline-soft-surface)] hover:bg-[var(--color-hairline)] text-[var(--color-ink)] transition-all active:scale-95 border border-[var(--color-hairline)] cursor-pointer"
                    >
                      <span>{machine.machine_id}</span>
                      {copiedCode ? (
                        <AnimatedCheck size={11} className="text-emerald-600" />
                      ) : (
                        <AnimatedCopy size={11} className="text-[var(--color-mute)]" />
                      )}
                    </motion.button>
                  </div>
                  {machine.model && (
                    <>
                      <span className="text-[var(--color-hairline)]">•</span>
                      <span className="font-mono text-[11px] sm:text-xs text-[var(--color-mute)]">
                        Model: <span className="font-semibold text-[var(--color-ink)]">{machine.model}</span>
                      </span>
                    </>
                  )}
                  {machine.serial_number && (
                    <>
                      <span className="text-[var(--color-hairline)]">•</span>
                      <span className="font-mono text-[11px] sm:text-xs text-[var(--color-mute)]">
                        Sr: <span className="font-semibold text-[var(--color-ink)]">{machine.serial_number}</span>
                      </span>
                    </>
                  )}
                  {machine.manufacturer && (
                    <>
                      <span className="text-[var(--color-hairline)]">•</span>
                      <span className="text-[11px] sm:text-xs text-[var(--color-mute)]">
                        Mfg: <span className="font-medium text-[var(--color-ink)]">{machine.manufacturer}</span>
                      </span>
                    </>
                  )}
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

      {/* Segmented Toggle Navigation Bar */}
      <SegmentedToggle<"overview" | "running_hours">
        value={activeTab}
        onChange={handleTabChange}
        layoutIdPrefix="machine-view-tab"
        items={[
          {
            id: "overview",
            label: "Basic Info & Client",
            icon: <AnimatedBuilding2 size={15} className="shrink-0" />,
          },
          {
            id: "running_hours",
            label: "Hour Meter Running History",
            icon: <AnimatedClock size={15} className="shrink-0" />,
            badge: isLoadingLogs ? (
              <span className="inline-flex items-center ml-0.5 shrink-0">
                <AnimatedLoader isSpinning size={13} className="text-sky-500" />
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
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Machine ID</span>
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
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Supervisor</span>
                  <span className="font-bold text-[var(--color-ink)] text-xs sm:text-sm truncate">{machine.current_supervisor?.full_name || "—"}</span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Operator</span>
                  <span className="font-bold text-[var(--color-ink)] text-xs sm:text-sm truncate">{machine.current_operator?.full_name || "—"}</span>
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

            {/* Linked Client Details Section from public.clients table (Supabase) */}
            <Card padding="md" className="card-hover-system sm:p-6 border-sky-500/20 bg-gradient-to-b from-sky-500/[0.03] to-transparent">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--color-hairline)]">
                <div className="flex items-center gap-2">
                  <AnimatedBuilding2 size={18} className="text-sky-600 dark:text-sky-400" />
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
                <div className="flex flex-col gap-4 mt-4 text-xs sm:text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {/* Company / Client Name */}
                    <div className="flex flex-col p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] shadow-2xs">
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                        Client / Company Name
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
                        <span className="inline-block mt-1.5 font-mono text-[11px] text-sky-600 font-bold bg-sky-500/10 px-2 py-0.5 rounded self-start border border-sky-500/20">
                          Contract: {activeRental.contract_number}
                        </span>
                      )}
                    </div>

                    {/* Contact Person */}
                    <div className="flex flex-col p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] shadow-2xs">
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                        Contact Person
                      </span>
                      <p className="font-semibold text-[var(--color-ink)] text-xs sm:text-sm">
                        {clientContactPerson || "—"}
                      </p>
                    </div>

                    {/* Contact Phone */}
                    <div className="flex flex-col p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] shadow-2xs">
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
                      <div className="flex flex-col p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] shadow-2xs">
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

                    {/* City, District & State */}
                    <div className="flex flex-col p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] shadow-2xs">
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                        City & State
                      </span>
                      <p className="font-semibold text-[var(--color-ink)] text-xs sm:text-sm">
                        {clientLocation || "—"}
                      </p>
                    </div>

                    {/* GSTIN */}
                    {clientGstin && (
                      <div className="flex flex-col p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] shadow-2xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                            GSTIN
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyGstin}
                            className="text-[11px] text-[var(--color-mute)] hover:text-[var(--color-ink)] inline-flex items-center gap-1 cursor-pointer"
                          >
                            {copiedGstin ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            <span>{copiedGstin ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <p className="font-mono font-semibold text-[var(--color-ink)] text-xs sm:text-sm">
                          {clientGstin}
                        </p>
                      </div>
                    )}

                    {/* PAN Number */}
                    {clientPan && (
                      <div className="flex flex-col p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] shadow-2xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                            PAN Number
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyPan}
                            className="text-[11px] text-[var(--color-mute)] hover:text-[var(--color-ink)] inline-flex items-center gap-1 cursor-pointer"
                          >
                            {copiedPan ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            <span>{copiedPan ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <p className="font-mono font-semibold text-[var(--color-ink)] text-xs sm:text-sm">
                          {clientPan}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Primary Site Location / Deployment Address */}
                  <div className="flex flex-col p-3.5 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] shadow-2xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                        Site Location / Deployment Address
                      </span>
                      <button
                        type="button"
                        onClick={handleCopySiteAddress}
                        className="text-xs text-[var(--color-mute)] hover:text-[var(--color-ink)] inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {copiedAddress ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedAddress ? "Copied" : "Copy Address"}</span>
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
                    <div className="flex flex-col p-3.5 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] shadow-2xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                          Billing Address
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyBillingAddress}
                          className="text-xs text-[var(--color-mute)] hover:text-[var(--color-ink)] inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {copiedBillingAddress ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedBillingAddress ? "Copied" : "Copy Billing Address"}</span>
                        </button>
                      </div>
                      <p className="text-xs sm:text-sm text-[var(--color-ink)] leading-relaxed font-medium">
                        {fullBillingAddress || "—"}
                      </p>
                    </div>
                  )}

                  {/* Rental Contract Timeline & Rate if available */}
                  {activeRental && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] shadow-2xs">
                      <div>
                        <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block mb-0.5">Rental Start</span>
                        <span className="font-semibold text-xs sm:text-sm text-[var(--color-ink)]">{formatDate(activeRental.start_date)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block mb-0.5">Rental End</span>
                        <span className="font-semibold text-xs sm:text-sm text-[var(--color-ink)]">{formatDate(activeRental.end_date)}</span>
                      </div>
                      <div>
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

        {/* TAB 2: HOUR METER RUNNING HISTORY (Lazy Loaded on Demand) */}
        {activeTab === "running_hours" && (
          <motion.div
            key="running_hours"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Card padding="lg">
              <CardHeader
                title="Hour Meter Running Machine History"
                eyebrow="Operator Daily Logbook with Shift Timings & Running Hours"
                action={
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<RefreshCw size={13} className={isLoadingLogs ? "animate-spin" : ""} />}
                      onClick={loadHourMeterLogs}
                      disabled={isLoadingLogs}
                      title="Refresh Running Logs"
                    >
                      Refresh
                    </Button>
                    <Link href="/operations?tab=entry">
                      <Button variant="secondary" className="text-xs font-bold py-1.5 px-3">
                        + Add Meter Log Entry
                      </Button>
                    </Link>
                  </div>
                }
              />

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
                    <RefreshCw size={13} className="mr-1.5" />
                    Retry
                  </Button>
                </div>
              )}

              {/* Empty State */}
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

              {/* Data Table */}
              {!isLoadingLogs && !logsError && hourMeterLogs && hourMeterLogs.length > 0 && (
                <div className="mt-4 w-full overflow-x-auto rounded-xl border border-[var(--color-hairline)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Log Date</TableHead>
                        <TableHead>Client Company</TableHead>
                        <TableHead>Operator</TableHead>
                        <TableHead>Operating Hours</TableHead>
                        <TableHead>Meter Reading (Start → End)</TableHead>
                        <TableHead>Overtime</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hourMeterLogs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs font-bold whitespace-nowrap">
                            {formatDate(log.log_date)}
                          </TableCell>
                          <TableCell className="font-medium text-xs">
                            {log.client?.company_name || clientCompanyName || "—"}
                          </TableCell>
                          <TableCell className="text-xs font-semibold whitespace-nowrap">
                            {log.operator?.full_name || "Operator"}
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {log.start_time && log.end_time
                              ? formatShiftTimingRange(log.start_time, log.end_time)
                              : `${log.running_hours || 0} hrs`}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-sky-600 dark:text-sky-400 font-bold whitespace-nowrap">
                            {log.start_meter || 0} → {log.end_meter || 0} (+{log.running_hours || 0}h)
                          </TableCell>
                          <TableCell className="font-mono text-xs text-amber-600 dark:text-amber-400 font-semibold whitespace-nowrap">
                            {log.overtime_hours ? `+${log.overtime_hours} hrs` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-[var(--color-mute)] max-w-xs truncate">
                            {log.remarks || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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

