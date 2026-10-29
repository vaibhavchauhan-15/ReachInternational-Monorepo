"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  ShieldAlert,
  AlertCircle,
  Clock,
  ArrowRight,
  Search,
  Wrench,
  UserPlus,
  Trash2,
  ShieldCheck,
  UserCheck,
  Loader2,
} from "lucide-react";
import { formatAllowance, hasMaintenanceAllowance, formatDate, formatExactTimestamp } from "@reachinternational/utils";
import {
  AnimatedBuilding2,
  AnimatedTruck,
  AnimatedClock,
  AnimatedUsers,
  AnimatedUserCheck,
  AnimatedShieldCheck,
  AnimatedMapPin,
  AnimatedReceipt,
  AnimatedFileText,
  AnimatedChevronLeft,
  AnimatedCopy,
  AnimatedCheck,
  AnimatedEdit,
  AnimatedCalendar,
  AnimatedHistory,
  AnimatedUserPlus,
  AnimatedPower,
  AnimatedTrash2,
} from "@/components/ui/animated-icons";
import {
  Button,
  TooltipWrapper,
  EmptyState,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  useToast,
  KPICard,
  KPIGrid,
} from "@/components/ui";
import { ClientModal } from "@/components/clients/ClientModal";
import { ClientSupervisorModal } from "./ClientSupervisorModal";
import { ClientShiftCodesTab } from "./ClientShiftCodesTab";
import { SitesList } from "./SitesList";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { getUserInitials } from "@reachinternational/utils";
import { removeClientSupervisorAction } from "@/app/actions/client-supervisors";
import { toggleClientStatusAction, deleteClientAction } from "@/app/actions/clients";
import { useRegisterPageActions } from "@/components/layout/PageActionContext";
import type { CRMClient } from "@/lib/types/database";
import type { ClientShiftCode } from "@reachinternational/types";
import type {
  ClientLocationData,
  ClientSummaryData,
  ClientMachineItem,
  ClientRunningLogItem,
  ClientAssignmentItem,
  ClientHistoryItem,
  ClientAuditItem,
  ClientSite,
  ClientSupervisorItem,
} from "@/lib/data/clients";
import type { AddressState } from "./AddressFields";

export interface ClientDetailClientProps {
  client: CRMClient;
  locationData: ClientLocationData | null;
  summaryData: ClientSummaryData | null;
  initialMachines: ClientMachineItem[];
  initialLogs: ClientRunningLogItem[];
  initialAssignments: ClientAssignmentItem[];
  initialHistory: ClientHistoryItem[];
  initialAuditLogs: ClientAuditItem[];
  initialShiftCodes?: ClientShiftCode[];
  initialSites?: ClientSite[];
  initialSupervisors?: ClientSupervisorItem[];
  states?: AddressState[];
  currentUserRole?: string;
}

export type ClientDetailTabKey = "machines" | "sites" | "logs" | "assignments" | "shifts" | "history" | "audit";

export function ClientDetailClient({
  client: initialClient,
  locationData,
  summaryData,
  initialMachines = [],
  initialLogs = [],
  initialAssignments = [],
  initialHistory = [],
  initialAuditLogs = [],
  initialShiftCodes = [],
  initialSites = [],
  initialSupervisors = [],
  states = [],
  currentUserRole = "super_admin",
}: ClientDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [prevInitialClient, setPrevInitialClient] = useState(initialClient);
  const [client, setClient] = useState<CRMClient>(initialClient);

  if (initialClient !== prevInitialClient) {
    setPrevInitialClient(initialClient);
    setClient(initialClient);
  }

  const [activeTab, setActiveTab] = useState<ClientDetailTabKey>("machines");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false);
  const [supervisors, setSupervisors] = useState<ClientSupervisorItem[]>(initialSupervisors);
  const [removingSupervisorId, setRemovingSupervisorId] = useState<string | null>(null);
  const [supervisorToDelete, setSupervisorToDelete] = useState<{ id: string; name: string } | null>(null);
  const [confirmToggleStatusOpen, setConfirmToggleStatusOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [tabSearch, setTabSearch] = useState("");

  const canManage = ["super_admin", "admin", "manager"].includes(currentUserRole);
  const isSuperAdmin = currentUserRole === "super_admin";

  // Toggle client status (active <-> inactive)
  const handleToggleStatus = useCallback(async () => {
    setIsTogglingStatus(true);
    try {
      const res = await toggleClientStatusAction(client.id);
      if (res.error) {
        toast("error", "Failed to update status", res.error);
      } else {
        const nextStatus = res.newStatus || (client.status === "active" ? "inactive" : "active");
        setClient((prev) => ({
          ...prev,
          status: nextStatus,
          deleted_at: nextStatus === "inactive" ? new Date().toISOString() : null,
        }));
        toast("success", "Client Status Updated", `Account marked as ${nextStatus}.`);
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to toggle status";
      toast("error", "Status update failed", msg);
    } finally {
      setIsTogglingStatus(false);
      setConfirmToggleStatusOpen(false);
    }
  }, [client.id, client.status, toast, router]);

  // Delete client
  const handleDeleteClient = useCallback(async () => {
    setIsDeletingClient(true);
    try {
      const res = await deleteClientAction(client.id);
      if (res.error) {
        toast("error", "Failed to delete client", res.error);
        setIsDeletingClient(false);
        setConfirmDeleteOpen(false);
      } else {
        toast("success", "Client Deleted", `${client.company_name || "Client"} has been removed.`);
        router.push("/clients");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete client";
      toast("error", "Delete failed", msg);
      setIsDeletingClient(false);
      setConfirmDeleteOpen(false);
    }
  }, [client.id, client.company_name, toast, router]);

  // Register mobile header contextual actions
  useRegisterPageActions(
    useMemo(
      () => ({
        customActions: [
          ...(canManage
            ? [
                {
                  id: "edit-client",
                  label: "Edit Profile",
                  icon: <AnimatedEdit size={16} className="text-sky-500 shrink-0" />,
                  run: () => setIsEditModalOpen(true),
                },
                {
                  id: "assign-supervisor",
                  label: "Assign Supervisor",
                  icon: <AnimatedUserPlus size={16} className="text-teal-600 dark:text-teal-400 shrink-0" />,
                  run: () => setIsSupervisorModalOpen(true),
                },
                {
                  id: "toggle-status",
                  label: client.status === "active" ? "Deactivate Client" : "Activate Client",
                  icon: (
                    <AnimatedPower
                      size={16}
                      className={client.status === "active" ? "text-amber-500 shrink-0" : "text-emerald-500 shrink-0"}
                    />
                  ),
                  run: () => setConfirmToggleStatusOpen(true),
                },
              ]
            : []),
          ...(isSuperAdmin
            ? [
                {
                  id: "delete-client",
                  label: "Delete Client",
                  icon: <AnimatedTrash2 size={16} className="text-red-600 shrink-0" />,
                  run: () => setConfirmDeleteOpen(true),
                  variant: "danger" as const,
                },
              ]
            : []),
        ],
      }),
      [canManage, isSuperAdmin, client.status]
    )
  );

  // Dual-binding event listeners for MobilePageHeader
  useEffect(() => {
    const handleEditEvent = () => setIsEditModalOpen(true);
    const handleAssignEvent = () => setIsSupervisorModalOpen(true);
    const handleToggleEvent = () => setConfirmToggleStatusOpen(true);
    const handleDeleteEvent = () => setConfirmDeleteOpen(true);

    window.addEventListener("reach:client-edit", handleEditEvent);
    window.addEventListener("reach:client-assign-supervisor", handleAssignEvent);
    window.addEventListener("reach:client-toggle-status", handleToggleEvent);
    window.addEventListener("reach:client-delete", handleDeleteEvent);

    return () => {
      window.removeEventListener("reach:client-edit", handleEditEvent);
      window.removeEventListener("reach:client-assign-supervisor", handleAssignEvent);
      window.removeEventListener("reach:client-toggle-status", handleToggleEvent);
      window.removeEventListener("reach:client-delete", handleDeleteEvent);
    };
  }, []);

  const handleRequestRemoveSupervisor = useCallback((supervisorId: string, supervisorName: string) => {
    setSupervisorToDelete({ id: supervisorId, name: supervisorName });
  }, []);

  const handleConfirmRemoveSupervisor = useCallback(async () => {
    if (!supervisorToDelete) return;
    const { id: supervisorId, name: supervisorName } = supervisorToDelete;
    setRemovingSupervisorId(supervisorId);
    setSupervisorToDelete(null);

    // Snapshot previous state for rollback
    const previousSupervisors = [...supervisors];

    // Safe optimistic removal
    setSupervisors((prev) => prev.filter((s) => s.supervisor_id !== supervisorId));

    try {
      const res = await removeClientSupervisorAction({
        clientId: client.id,
        supervisorId,
      });
      if (res.error) {
        // Rollback on mutation error
        setSupervisors(previousSupervisors);
        toast("error", "Removal failed", res.error);
      } else {
        toast("success", `Removed ${supervisorName} from client supervisors`);
        router.refresh();
      }
    } catch (err: unknown) {
      // Rollback on unexpected failure
      setSupervisors(previousSupervisors);
      const msg = err instanceof Error ? err.message : "Failed to remove supervisor";
      toast("error", "Removal failed", msg);
    } finally {
      setRemovingSupervisorId(null);
    }
  }, [supervisorToDelete, supervisors, client.id, toast, router]);

  const handleCopy = useCallback((text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast("info", `${key} copied to clipboard`);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  }, [toast]);

  // Tab items (direct projection without redundant search input)
  const filteredSupervisors = supervisors;
  const filteredMachines = initialMachines;
  const filteredLogs = initialLogs;
  const filteredAssignments = initialAssignments;
  const filteredShiftCodes = initialShiftCodes;
  const filteredHistory = initialHistory;
  const filteredAuditLogs = initialAuditLogs;

  // Derived aggregates
  const totalRunningHours = useMemo(() => {
    return initialLogs.reduce((acc, log) => acc + (log.running_hours || 0), 0).toFixed(1);
  }, [initialLogs]);

  const activeAssignmentsCount = useMemo(() => {
    return initialAssignments.filter((a) => a.is_active).length;
  }, [initialAssignments]);

  const activeMachinesCount = useMemo(() => {
    return initialMachines.filter((m) => m.status === "active" || m.status === "rented").length;
  }, [initialMachines]);

  // Addresses and location helpers
  const siteAddress =
    locationData?.site_address ||
    [client.street, client.city, client.district, client.state, client.pincode]
      .filter(Boolean)
      .join(", ") ||
    "—";

  const billingAddress =
    locationData?.formatted_billing_address ||
    (client.is_billing_address_different && client.billing_address
      ? [
          client.billing_address,
          client.billing_city,
          client.billing_district,
          client.billing_state,
          client.billing_pincode,
        ]
          .filter(Boolean)
          .join(", ")
      : siteAddress);

  const clientIdentifier = client.client_id || client.code;

  const cleanPhone = (client.phone || "").replace(/[^0-9+]/g, "");
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.replace("+", "")}?text=${encodeURIComponent(
        `Hello ${client.contact_person || client.company_name || "Client"}, ReachInternational regarding your account ${clientIdentifier}.`
      )}`
    : "";

  const mapsQuery = encodeURIComponent(
    `${client.company_name} ${siteAddress !== "—" ? siteAddress : ""}`.trim()
  );
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-20 md:pb-8 max-w-7xl mx-auto px-2 sm:px-4 md:px-6 w-full">
      {/* ─── 1. TOP BREADCRUMB & BACK NAVIGATION (Hidden on mobile, single left breadcrumb on desktop) ─── */}
      <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--color-mute)]">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 font-medium hover:text-[var(--color-ink)] transition-colors group py-1 mr-1 text-[var(--color-mute)] hover:text-[var(--color-ink)]"
        >
          <AnimatedChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Clients</span>
        </Link>
        <span>/</span>
        <Link href="/dashboard" className="hover:text-[var(--color-ink)] transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link href="/clients" className="hover:text-[var(--color-ink)] transition-colors">
          Clients
        </Link>
        <span>/</span>
        <span className="text-[var(--color-ink)] font-semibold truncate max-w-[280px]">
          {client.company_name || client.client_name}
        </span>
      </nav>

      {/* ─── 2. MASTER HERO BANNER CARD (Unified Responsive Design) ─── */}
      <div className="rounded-xl sm:rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 sm:p-5 md:p-6 shadow-2xs relative overflow-hidden transition-all">
        {/* Subtle top hairline gradient accent */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/50 to-transparent pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
              <Building2 className="h-5 w-5 sm:h-7 sm:w-7" />
            </div>

            <div className="flex flex-col min-w-0 space-y-1">
              {/* Badges Row */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleCopy(clientIdentifier, "Client ID")}
                  className="inline-flex items-center gap-1 h-5 sm:h-6 px-2 sm:px-2.5 rounded sm:rounded-md bg-[var(--color-hairline-soft-surface)] hover:bg-[var(--color-hairline)] border border-[var(--color-hairline)] text-[11px] sm:text-xs font-mono font-bold text-sky-600 dark:text-sky-400 cursor-pointer transition-colors active:scale-95"
                  title="Click to copy Client ID"
                >
                  <span>{clientIdentifier}</span>
                  {copiedKey === "Client ID" ? (
                    <AnimatedCheck size={11} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AnimatedCopy size={11} className="text-[var(--color-mute)] shrink-0" />
                  )}
                </button>

                {client.deleted_at ? (
                  <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-950/60 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/80">
                    SOFT DELETED
                  </span>
                ) : client.status === "active" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ACTIVE
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-bold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                    INACTIVE
                  </span>
                )}

                {hasMaintenanceAllowance(client.maintenance_allowance_minutes) ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <Wrench size={10} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Maint: {formatAllowance(client.maintenance_allowance_minutes ?? 0)}/mo</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/60 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/80">
                    <AlertCircle size={10} className="text-red-600 dark:text-red-400 shrink-0" />
                    <span>Maint: None</span>
                  </span>
                )}

                {client.is_billing_address_different && (
                  <span className="inline-flex items-center rounded-full bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Separate Billing
                  </span>
                )}
              </div>

              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-[var(--color-ink)] tracking-tight truncate leading-tight">
                {client.company_name || client.client_name}
              </h1>
            </div>
          </div>

          {/* Desktop Right Action Bar (On mobile, actions are cleanly in the top header 3-dot menu per Feedback #8) */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsEditModalOpen(true)}
                className="h-9 px-3.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <AnimatedEdit size={14} />
                <span>Edit Profile</span>
              </Button>
            )}

            {cleanPhone && (
              <a
                href={`tel:${cleanPhone}`}
                className="h-9 px-3 rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] text-xs font-semibold text-[var(--color-ink)] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Call Client"
              >
                <Phone size={14} className="text-[var(--color-mute)]" />
                <span>Call</span>
              </a>
            )}

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3 rounded-md border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                title="WhatsApp Client"
              >
                <span>WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. 4-CARD HIGH-DENSITY METADATA STRIP (Mobile Smooth Snap-Scroll, Desktop Grid) ─── */}
      <div className="flex overflow-x-auto snap-x snap-mandatory pb-1 sm:pb-0 sm:grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4 no-scrollbar sm:overflow-visible touch-pan-x -mx-1 px-1 sm:mx-0 sm:px-0">
        {/* Card 1: Contact Person */}
        <div
          data-hover-parent
          className="w-[84vw] max-w-[320px] shrink-0 snap-start sm:w-auto sm:shrink rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 sm:p-4 shadow-2xs space-y-2 sm:space-y-2.5 transition-all hover:border-[var(--color-link)]/40 hover:shadow-xs group"
        >
          <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
              <AnimatedUserCheck size={16} className="text-sky-500 shrink-0" />
              Contact Person
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[var(--color-mute)]">Representative</span>
              <span className="font-semibold text-[var(--color-ink)] truncate max-w-[150px]" title={client.contact_person || undefined}>
                {client.contact_person || "—"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[var(--color-mute)]">Phone</span>
              <div className="flex items-center gap-1">
                <span className="font-semibold font-mono text-[var(--color-ink)]">
                  {client.phone || "—"}
                </span>
                {client.phone && (
                  <button
                    type="button"
                    onClick={() => handleCopy(client.phone || "", "Phone")}
                    className="p-1 hover:bg-[var(--color-hairline)] rounded text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                    title="Copy phone"
                  >
                    {copiedKey === "Phone" ? (
                      <AnimatedCheck size={12} className="text-emerald-500" />
                    ) : (
                      <AnimatedCopy size={12} />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              <span className="text-[var(--color-mute)]">WhatsApp</span>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <span>Chat Direct</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-[var(--color-mute)]">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Tax & Statutory Compliance */}
        <div
          data-hover-parent
          className="w-[84vw] max-w-[320px] shrink-0 snap-start sm:w-auto sm:shrink rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 sm:p-4 shadow-2xs space-y-2 sm:space-y-2.5 transition-all hover:border-[var(--color-link)]/40 hover:shadow-xs group"
        >
          <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
              <AnimatedReceipt size={16} className="text-purple-500 shrink-0" />
              Tax & Statutory
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[var(--color-mute)]">GSTIN</span>
              <div className="flex items-center gap-1">
                <span className="font-semibold font-mono text-[var(--color-ink)]">
                  {client.gstin || "Unregistered"}
                </span>
                {client.gstin && (
                  <button
                    type="button"
                    onClick={() => handleCopy(client.gstin || "", "GSTIN")}
                    className="p-1 hover:bg-[var(--color-hairline)] rounded text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                    title="Copy GSTIN"
                  >
                    {copiedKey === "GSTIN" ? (
                      <AnimatedCheck size={12} className="text-emerald-500" />
                    ) : (
                      <AnimatedCopy size={12} />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[var(--color-mute)]">PAN</span>
              <div className="flex items-center gap-1">
                <span className="font-semibold font-mono text-[var(--color-ink)]">
                  {client.pan_number || "—"}
                </span>
                {client.pan_number && (
                  <button
                    type="button"
                    onClick={() => handleCopy(client.pan_number || "", "PAN")}
                    className="p-1 hover:bg-[var(--color-hairline)] rounded text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                    title="Copy PAN"
                  >
                    {copiedKey === "PAN" ? (
                      <AnimatedCheck size={12} className="text-emerald-500" />
                    ) : (
                      <AnimatedCopy size={12} />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              <span className="text-[var(--color-mute)]">Tax Status</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {client.gstin ? "Verified Commercial" : "Standard"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Operational Site Address */}
        <div
          data-hover-parent
          className="w-[84vw] max-w-[320px] shrink-0 snap-start sm:w-auto sm:shrink rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 sm:p-4 shadow-2xs space-y-2 sm:space-y-2.5 transition-all hover:border-[var(--color-link)]/40 hover:shadow-xs group"
        >
          <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
              <AnimatedMapPin size={16} className="text-emerald-500 shrink-0" />
              Operational Sites
            </span>
            <div className="flex items-center gap-1.5">
              {initialSites && initialSites.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("sites")}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800 hover:underline cursor-pointer transition-colors"
                  title="Click to view all saved sites"
                >
                  <span>{initialSites.length} {initialSites.length === 1 ? "Site" : "Sites"}</span>
                  <ArrowRight size={10} />
                </button>
              )}
              {siteAddress !== "—" && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] lowercase font-normal text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5"
                  title="Open in Google Maps"
                >
                  <ExternalLink size={10} />
                  <span>maps</span>
                </a>
              )}
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-mute)]">City / State</span>
              <span className="font-semibold text-[var(--color-ink)] truncate max-w-[150px]">
                {[client.city, client.state].filter(Boolean).join(", ") || "—"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--color-mute)]">Pincode</span>
              <span className="font-semibold font-mono text-[var(--color-ink)]">
                {client.pincode || "—"}
              </span>
            </div>

            <div className="flex flex-col gap-0.5 pt-0.5">
              <span className="text-[var(--color-mute)] text-[11px]">Site Address:</span>
              <p className="text-xs text-[var(--color-ink)] leading-relaxed line-clamp-2" title={siteAddress}>
                {siteAddress}
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: Registered Billing Address */}
        <div
          data-hover-parent
          className="w-[84vw] max-w-[320px] shrink-0 snap-start sm:w-auto sm:shrink rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 sm:p-4 shadow-2xs space-y-2 sm:space-y-2.5 transition-all hover:border-[var(--color-link)]/40 hover:shadow-xs group"
        >
          <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
              <AnimatedFileText size={16} className="text-amber-500 shrink-0" />
              Billing Address
            </span>
            <span className="text-[10px] font-bold text-[var(--color-mute)]">
              {client.is_billing_address_different ? "Separate" : "Same"}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-mute)]">Billing City</span>
              <span className="font-semibold text-[var(--color-ink)] truncate max-w-[150px]">
                {client.is_billing_address_different ? client.billing_city || "—" : client.city || "—"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--color-mute)]">Billing PIN</span>
              <span className="font-semibold font-mono text-[var(--color-ink)]">
                {client.is_billing_address_different ? client.billing_pincode || "—" : client.pincode || "—"}
              </span>
            </div>

            <div className="flex flex-col gap-0.5 pt-0.5">
              <span className="text-[var(--color-mute)] text-[11px]">Billing Address:</span>
              <p className="text-xs text-[var(--color-ink)] leading-relaxed line-clamp-2" title={billingAddress}>
                {billingAddress}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4. 4-CARD KPI METRICS STRIP (Balanced 4-col layout, zero empty space) ─── */}
      <KPIGrid columns={4}>
        <KPICard
          label="Assigned Fleet"
          value={initialMachines.length}
          icon="machines"
          variant="default"
          subtitle={activeMachinesCount === 1 ? "1 active unit" : `${activeMachinesCount} active equipment units`}
        />
        <KPICard
          label="Running Hours"
          value={`${totalRunningHours} hrs`}
          icon="hours"
          variant="success"
          subtitle={`${initialLogs.length} logged machine shifts`}
        />
        <KPICard
          label="Operator Roster"
          value={activeAssignmentsCount}
          icon="users"
          variant="purple"
          subtitle={`${initialAssignments.length} total shift allocations`}
        />
        <KPICard
          label="Account Standing"
          value={client.status.toUpperCase()}
          icon="shield"
          variant={client.status === "active" ? "info" : "default"}
          subtitle={`Member since ${formatDate(client.created_at)}`}
        />
      </KPIGrid>

      {/* ─── 5. TAB STRIP TOOLBAR ─── */}
      <div className="border-b border-[var(--color-hairline)] pb-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-nowrap touch-pan-x -mx-1 px-1 sm:mx-0 sm:px-0">
          {(
            [
              { key: "machines" as const, label: "Machines", count: initialMachines.length },
              { key: "sites" as const, label: "Sites", count: initialSites.length },
              { key: "logs" as const, label: "Running Logs", count: initialLogs.length },
              {
                key: "assignments" as const,
                label: "Assignments",
                count: supervisors.length + initialAssignments.length,
              },
              { key: "shifts" as const, label: "Shift Codes", count: initialShiftCodes.length },
              { key: "history" as const, label: "History", count: initialHistory.length },
              { key: "audit" as const, label: "Audit Trail", count: initialAuditLogs.length },
            ]
          ).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 select-none ${
                  isActive
                    ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-xs font-bold"
                    : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] hover:text-[var(--color-ink)] border border-[var(--color-hairline)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-98"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono transition-colors ${
                    isActive
                      ? "bg-[var(--color-canvas)] text-[var(--color-ink)]"
                      : "bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)]"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 6. TAB CONTENT PANELS ─── */}
      <div className="rounded-xl sm:rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 sm:p-5 shadow-2xs min-h-[260px] overflow-hidden">
        {/* TAB 1: MACHINES */}
        {activeTab === "machines" && (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--color-hairline)]/60">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-[var(--color-ink)] truncate">
                  Deployed Fleet Equipment
                </h3>
                <span className="hidden sm:inline text-xs text-[var(--color-mute)]">
                  • Machinery actively or historically deployed to this client
                </span>
              </div>
              <span className="text-[11px] sm:text-xs font-mono text-[var(--color-mute)] shrink-0 font-medium">
                {initialMachines.length} {initialMachines.length === 1 ? "unit" : "units"}
              </span>
            </div>

            {filteredMachines.length === 0 ? (
              <EmptyState
                title="No Machinery Found"
                description="No equipment units are currently allocated to this client account."
              />
            ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto rounded-xl border border-[var(--color-hairline)]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/50 select-none">
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Machine Code</TableHead>
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Model & Manufacturer</TableHead>
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Serial Number</TableHead>
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Hour Meter</TableHead>
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Status</TableHead>
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMachines.map((m) => (
                          <TableRow
                            key={m.id}
                            className="border-b border-[var(--color-hairline)] hover:bg-[var(--color-hairline-soft-surface)]/50 transition-colors group"
                          >
                            <TableCell className="py-3 px-3 font-mono font-bold text-sky-600 dark:text-sky-400">
                              <Link
                                href={`/machines/${m.id}`}
                                className="hover:underline inline-flex items-center gap-1"
                              >
                                <span>{m.machine_id}</span>
                                <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              </Link>
                            </TableCell>
                            <TableCell className="py-3 px-3 font-medium text-[var(--color-ink)]">
                              <div>{m.model}</div>
                              {m.manufacturer && (
                                <div className="text-[10px] text-[var(--color-mute)]">{m.manufacturer}</div>
                              )}
                            </TableCell>
                            <TableCell className="py-3 px-3 font-mono text-[var(--color-body)]">
                              {m.serial_number || "—"}
                            </TableCell>
                            <TableCell className="py-3 px-3 font-mono font-bold text-[var(--color-ink)]">
                              {m.hour_meter !== null ? `${m.hour_meter} hrs` : "—"}
                            </TableCell>
                            <TableCell className="py-3 px-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                  m.status === "active" || m.status === "rented"
                                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700"
                                }`}
                              >
                                {m.status.toUpperCase()}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 px-3 text-right">
                              <Link
                                href={`/machines/${m.id}`}
                                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline inline-flex items-center gap-1"
                              >
                                <span>Inspect</span>
                                <ArrowRight size={12} />
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Touch Cards View */}
                  <div className="grid grid-cols-1 gap-2.5 sm:hidden">
                    {filteredMachines.map((m) => (
                      <Link
                        key={m.id}
                        href={`/machines/${m.id}`}
                        className="p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2 block hover:border-sky-500/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{m.machine_id}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                              m.status === "active" || m.status === "rented"
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700"
                            }`}
                          >
                            {m.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-[var(--color-ink)]">
                          {m.model} {m.manufacturer && `• ${m.manufacturer}`}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--color-mute)] font-mono">
                          <span>S/N: {m.serial_number || "—"}</span>
                          <span>Meter: {m.hour_meter ?? "—"} hrs</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB: SITES */}
          {activeTab === "sites" && (
            <SitesList
              sites={initialSites}
              clientId={client.id}
              states={states}
              currentUserRole={currentUserRole}
            />
          )}

          {/* TAB 2: RUNNING LOGS */}
          {activeTab === "logs" && (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--color-hairline)]/60">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-[var(--color-ink)] truncate">
                    Shift Running Hours & HMR Logs
                  </h3>
                  <span className="hidden sm:inline text-xs text-[var(--color-mute)]">
                    • Machine meter entries logged during operator shifts
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs font-mono text-[var(--color-mute)] shrink-0 font-medium">
                  {filteredLogs.length} entries
                </span>
              </div>

              {filteredLogs.length === 0 ? (
                <EmptyState
                  title="No Running Logs Recorded"
                  description="No shift running hours have been logged for this client account yet."
                />
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto rounded-xl border border-[var(--color-hairline)]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/50 select-none">
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Date</TableHead>
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Machine</TableHead>
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Operator</TableHead>
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Shift</TableHead>
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Meter Readings</TableHead>
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Running Hours</TableHead>
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLogs.map((log) => (
                          <TableRow
                            key={log.id}
                            className="border-b border-[var(--color-hairline)] hover:bg-[var(--color-hairline-soft-surface)]/50 transition-colors"
                          >
                            <TableCell className="py-3 px-3 font-mono font-medium text-[var(--color-ink)]">
                              {log.log_date}
                            </TableCell>
                            <TableCell className="py-3 px-3 font-mono font-bold text-sky-600 dark:text-sky-400">
                              {log.machine_code || "—"}
                            </TableCell>
                            <TableCell className="py-3 px-3 font-medium text-[var(--color-body)]">
                              {log.operator_name || "—"}
                            </TableCell>
                            <TableCell className="py-3 px-3 capitalize text-[var(--color-mute)]">
                              {log.shift || "Regular"}
                            </TableCell>
                            <TableCell className="py-3 px-3 font-mono text-[var(--color-body)]">
                              {log.start_meter ?? "—"} → {log.end_meter ?? "—"}
                            </TableCell>
                            <TableCell className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {log.running_hours} hrs
                            </TableCell>
                            <TableCell className="py-3 px-3 text-right">
                              {log.is_breakdown ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/60 px-2 py-0.5 text-[9px] font-bold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                                  <AlertCircle size={10} /> Breakdown
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  Normal
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Touch Cards View */}
                  <div className="grid grid-cols-1 gap-2.5 sm:hidden">
                    {filteredLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sky-600">{log.machine_code}</span>
                          <span className="font-mono font-bold text-emerald-600">
                            {log.running_hours} hrs
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--color-ink)]">
                          <span>{log.operator_name || "Operator"}</span>
                          <span className="font-mono text-[var(--color-mute)]">{log.log_date}</span>
                        </div>
                        <div className="text-[10px] font-mono text-[var(--color-mute)] pt-0.5 flex items-center justify-between">
                          <span>
                            Meter: {log.start_meter ?? "—"} → {log.end_meter ?? "—"}
                          </span>
                          {log.is_breakdown && (
                            <span className="text-red-600 font-bold">Breakdown</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: ASSIGNMENTS (CLIENT SUPERVISORS + OPERATORS) */}
          {activeTab === "assignments" && (
            <div className="space-y-8">
              {/* SECTION A: CLIENT SUPERVISORS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--color-hairline)]/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                    <h3 className="text-xs sm:text-sm font-bold text-[var(--color-ink)] truncate">
                      Assigned Client Supervisors
                    </h3>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shrink-0">
                      {supervisors.length}
                    </span>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setIsSupervisorModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Assign Supervisor</span>
                      <span className="sm:hidden">Assign</span>
                    </button>
                  )}
                </div>

                {filteredSupervisors.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--color-hairline)] p-4 sm:p-6 text-center bg-[var(--color-canvas)] space-y-2">
                    <UserCheck className="h-7 w-7 text-[var(--color-mute)] mx-auto opacity-50" />
                    <p className="text-xs font-semibold text-[var(--color-ink)]">
                      No Supervisors Assigned to This Client
                    </p>
                    <p className="text-[11px] text-[var(--color-mute)] max-w-md mx-auto">
                      Assigning a supervisor grants them inherited operational access over all machines and operator logs deployed under this client account.
                    </p>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setIsSupervisorModalOpen(true)}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-ink)] text-[var(--color-canvas)] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Assign First Supervisor</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-x-auto rounded-xl border border-[var(--color-hairline)]">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/50 select-none">
                            <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Supervisor Name</TableHead>
                            <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Contact Phone</TableHead>
                            <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Email</TableHead>
                            <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Assigned Date</TableHead>
                            <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Operational Scope</TableHead>
                            {canManage && (
                              <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider text-right">Action</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSupervisors.map((s) => (
                            <TableRow
                              key={s.id}
                              className="border-b border-[var(--color-hairline)] hover:bg-[var(--color-hairline-soft-surface)]/50 transition-colors"
                            >
                              <TableCell className="py-3 px-3 font-semibold text-[var(--color-ink)]">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-lg bg-[var(--color-ink)] text-white dark:bg-white dark:text-[#171717] border border-[var(--color-hairline)] flex items-center justify-center text-xs font-mono font-bold shadow-2xs">
                                    {getUserInitials(s.supervisor_name)}
                                  </div>
                                  <span>{s.supervisor_name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-3 px-3 font-mono text-[var(--color-body)]">
                                {s.supervisor_phone || "—"}
                              </TableCell>
                              <TableCell className="py-3 px-3 font-mono text-xs text-[var(--color-mute)]">
                                {s.supervisor_email || "—"}
                              </TableCell>
                              <TableCell className="py-3 px-3 text-xs text-[var(--color-mute)]">
                                <span suppressHydrationWarning>{s.assigned_at ? formatDate(s.assigned_at) : "—"}</span>
                              </TableCell>
                              <TableCell className="py-3 px-3">
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold border bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800">
                                  <ShieldCheck className="h-2.5 w-2.5" />
                                  INHERITED
                                </span>
                              </TableCell>
                              {canManage && (
                                <TableCell className="py-3 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRequestRemoveSupervisor(s.supervisor_id, s.supervisor_name)}
                                    disabled={removingSupervisorId === s.supervisor_id}
                                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors disabled:opacity-50 cursor-pointer"
                                    title="Remove supervisor assignment"
                                    aria-label={`Remove supervisor ${s.supervisor_name}`}
                                  >
                                    {removingSupervisorId === s.supervisor_id ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Touch Cards View */}
                    <div className="grid grid-cols-1 gap-2.5 sm:hidden">
                      {filteredSupervisors.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-lg bg-[var(--color-ink)] text-white dark:bg-white dark:text-[#171717] border border-[var(--color-hairline)] flex items-center justify-center text-xs font-mono font-bold shadow-2xs">
                                {getUserInitials(s.supervisor_name)}
                              </div>
                              <span className="font-semibold text-xs text-[var(--color-ink)]">
                                {s.supervisor_name}
                              </span>
                            </div>
                            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold border bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800">
                              INHERITED
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--color-mute)] space-y-0.5 font-mono">
                            {s.supervisor_phone && <div>Phone: {s.supervisor_phone}</div>}
                            {s.supervisor_email && <div className="truncate">Email: {s.supervisor_email}</div>}
                          </div>
                          {canManage && (
                            <div className="flex justify-end pt-1 border-t border-[var(--color-hairline)]">
                              <button
                                type="button"
                                onClick={() => handleRequestRemoveSupervisor(s.supervisor_id, s.supervisor_name)}
                                disabled={removingSupervisorId === s.supervisor_id}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:underline cursor-pointer"
                                aria-label={`Remove supervisor ${s.supervisor_name}`}
                              >
                                {removingSupervisorId === s.supervisor_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                                <span>Remove</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* SECTION B: OPERATOR MACHINE ASSIGNMENTS */}
              <div className="space-y-3 sm:space-y-4 pt-3 border-t border-[var(--color-hairline)]">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--color-hairline)]/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-[var(--color-ink)] truncate">
                      Operator Machine Assignments
                    </h3>
                    <span className="hidden sm:inline text-xs text-[var(--color-mute)]">
                      • Operators allocated to machines
                    </span>
                  </div>
                  <span className="text-[11px] sm:text-xs font-mono text-[var(--color-mute)] shrink-0 font-medium">
                    {filteredAssignments.length} {filteredAssignments.length === 1 ? "assignment" : "assignments"}
                  </span>
                </div>

                {filteredAssignments.length === 0 ? (
                  <EmptyState
                    title="No Operator Assignments"
                    description="No operators are currently assigned to equipment allocated to this client."
                  />
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-x-auto rounded-xl border border-[var(--color-hairline)]">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/50 select-none">
                            <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Operator Name</TableHead>
                            <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Contact</TableHead>
                            <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Machine Code</TableHead>
                            <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Shift Schedule</TableHead>
                            <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Assigned Date</TableHead>
                            <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAssignments.map((a) => (
                            <TableRow
                              key={a.id}
                              className="border-b border-[var(--color-hairline)] hover:bg-[var(--color-hairline-soft-surface)]/50 transition-colors"
                            >
                              <TableCell className="py-3 px-3 font-semibold text-[var(--color-ink)]">
                                {a.operator_name}
                              </TableCell>
                              <TableCell className="py-3 px-3 font-mono text-[var(--color-body)]">
                                {a.operator_phone || "—"}
                              </TableCell>
                              <TableCell className="py-3 px-3 font-mono font-bold text-sky-600 dark:text-sky-400">
                                {a.machine_code}
                              </TableCell>
                              <TableCell className="py-3 px-3 font-mono text-[var(--color-mute)]">
                                {a.shift_start_time?.slice(0, 5)} – {a.shift_end_time?.slice(0, 5)}
                              </TableCell>
                              <TableCell className="py-3 px-3 text-[var(--color-mute)]">
                                <span suppressHydrationWarning>{a.assigned_at ? formatDate(a.assigned_at) : "—"}</span>
                              </TableCell>
                              <TableCell className="py-3 px-3 text-right">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                                    a.is_active
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                                      : "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
                                  }`}
                                >
                                  {a.is_active ? "ACTIVE" : "ENDED"}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Touch Cards View */}
                    <div className="grid grid-cols-1 gap-2.5 sm:hidden">
                      {filteredAssignments.map((a) => (
                        <div
                          key={a.id}
                          className="p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-[var(--color-ink)]">
                              {a.operator_name}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                                a.is_active
                                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700"
                              }`}
                            >
                              {a.is_active ? "ACTIVE" : "ENDED"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[var(--color-mute)]">
                            <span className="font-mono text-sky-600">{a.machine_code}</span>
                            <span className="font-mono">
                              {a.shift_start_time?.slice(0, 5)} – {a.shift_end_time?.slice(0, 5)}
                            </span>
                          </div>
                          {a.operator_phone && (
                            <div className="text-[10px] font-mono text-[var(--color-mute)]">
                              Phone: {a.operator_phone}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CLIENT SHIFT CODES */}
          {activeTab === "shifts" && (
            <ClientShiftCodesTab
              clientId={client.id}
              clientName={client.company_name || client.client_name || ""}
              initialShiftCodes={filteredShiftCodes}
              canManage={canManage}
            />
          )}

          {/* TAB 5: ACCOUNT TIMELINE HISTORY */}
          {activeTab === "history" && (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--color-hairline)]/60">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-[var(--color-ink)] truncate">
                    Client Account Timeline
                  </h3>
                  <span className="hidden sm:inline text-xs text-[var(--color-mute)]">
                    • Operational milestones
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs font-mono text-[var(--color-mute)] shrink-0 font-medium">
                  {filteredHistory.length} milestones
                </span>
              </div>

              {filteredHistory.length === 0 ? (
                <EmptyState
                  title="No Timeline Milestones"
                  description="No historical milestones recorded for this client account yet."
                />
              ) : (
                <div className="relative pl-6 space-y-4 border-l-2 border-[var(--color-hairline)] ml-3 pt-1">
                  {filteredHistory.map((h) => (
                    <div key={h.id} className="relative group">
                      <div className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-[var(--color-canvas)] bg-sky-600 ring-2 ring-sky-500/20" />
                      <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-1 hover:border-sky-500/40 transition-colors shadow-2xs">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="font-bold text-xs text-[var(--color-ink)]">
                            {h.title}
                          </span>
                          <span className="text-[10px] font-mono text-[var(--color-mute)]" suppressHydrationWarning>
                            {formatDate(h.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-body)] leading-relaxed">
                          {h.description}
                        </p>
                        {h.actor_name && (
                          <div className="text-[10px] text-[var(--color-mute)] pt-1 flex items-center gap-1">
                            <span>Recorded by:</span>
                            <span className="font-semibold text-[var(--color-ink)]">{h.actor_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: SECURITY AUDIT TRAIL */}
          {activeTab === "audit" && (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--color-hairline)]/60">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-[var(--color-ink)] truncate">
                    Security Audit Trail
                  </h3>
                  <span className="hidden sm:inline text-xs text-[var(--color-mute)]">
                    • Tamper-proof event logs
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs font-mono text-[var(--color-mute)] shrink-0 font-medium">
                  {filteredAuditLogs.length} events
                </span>
              </div>

              {filteredAuditLogs.length === 0 ? (
                <EmptyState
                  title="No Audit Entries"
                  description="Zero elevated mutations or administrative changes logged for this record."
                />
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto rounded-xl border border-[var(--color-hairline)]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/50 select-none">
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Timestamp</TableHead>
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Action</TableHead>
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Actor & Role</TableHead>
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Severity</TableHead>
                          <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider text-right">Category</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAuditLogs.map((a) => (
                          <TableRow
                            key={a.id}
                            className="border-b border-[var(--color-hairline)] hover:bg-[var(--color-hairline-soft-surface)]/50 transition-colors"
                          >
                            <TableCell className="py-3 px-3 font-mono text-xs text-[var(--color-mute)] whitespace-nowrap">
                              <span suppressHydrationWarning>{formatExactTimestamp(a.created_at, false)}</span>
                            </TableCell>
                            <TableCell className="py-3 px-3 font-mono font-bold text-sky-600 dark:text-sky-400">
                              {a.action}
                            </TableCell>
                            <TableCell className="py-3 px-3 font-medium text-[var(--color-ink)]">
                              <div>{a.actor_name || "System"}</div>
                              <div className="text-[10px] text-[var(--color-mute)] capitalize">
                                {a.actor_role || "automated"}
                              </div>
                            </TableCell>
                            <TableCell className="py-3 px-3">
                              <span
                                className={`inline-flex items-center rounded px-2 py-0.5 text-[9px] font-bold uppercase ${
                                  a.severity === "critical"
                                    ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                                    : a.severity === "warning"
                                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                    : "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                                }`}
                              >
                                {a.severity}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 px-3 text-right text-[var(--color-mute)] capitalize">
                              {a.category || "General"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Touch Cards View */}
                  <div className="grid grid-cols-1 gap-2.5 sm:hidden">
                    {filteredAuditLogs.map((a) => (
                      <div
                        key={a.id}
                        className="p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sky-600">{a.action}</span>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase border ${
                              a.severity === "critical"
                                ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800"
                                : a.severity === "warning"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                : "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                            }`}
                          >
                            {a.severity}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--color-mute)]">
                          <span>
                            {a.actor_name || "Unknown"} ({a.actor_role || "—"})
                          </span>
                          <span className="font-mono" suppressHydrationWarning>{formatDate(a.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      {/* ─── 7. EDIT CLIENT MODAL INTEGRATION ─── */}
      {isEditModalOpen && (
        <ClientModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          client={client}
          onSuccess={(updatedClient) => {
            if (updatedClient) {
              setClient(updatedClient);
              toast("success", "Client Profile Updated", `${updatedClient.company_name || updatedClient.client_name || "Client"} details updated successfully.`);
            }
            setIsEditModalOpen(false);
            router.refresh();
          }}
        />
      )}

      {/* ─── 8. ASSIGN CLIENT SUPERVISOR MODAL ─── */}
      <ClientSupervisorModal
        isOpen={isSupervisorModalOpen}
        onClose={() => setIsSupervisorModalOpen(false)}
        clientId={client.id}
        clientName={client.company_name || client.client_name || "Client"}
        clientCode={clientIdentifier}
        initialSites={initialSites}
        onSuccess={(newSupervisor) => {
          setSupervisors((prev) => [newSupervisor, ...prev]);
          router.refresh();
        }}
        onError={(err) => {
          toast("error", err);
        }}
      />

      {/* ─── 9. REMOVE CLIENT SUPERVISOR CONFIRMATION DIALOG ─── */}
      <ConfirmationDialog
        isOpen={Boolean(supervisorToDelete)}
        onClose={() => setSupervisorToDelete(null)}
        onConfirm={handleConfirmRemoveSupervisor}
        title="Remove Client Supervisor"
        description={
          supervisorToDelete
            ? `Are you sure you want to remove supervisor "${supervisorToDelete.name}" from ${client.company_name || "this client"}? They will lose inherited operational access to all equipment and operator shifts under this client.`
            : ""
        }
        confirmLabel="Remove Supervisor"
        cancelLabel="Cancel"
        variant="danger"
        loading={Boolean(removingSupervisorId)}
      />

      {/* ─── 10. TOGGLE CLIENT STATUS CONFIRMATION DIALOG ─── */}
      <ConfirmationDialog
        isOpen={confirmToggleStatusOpen}
        onClose={() => setConfirmToggleStatusOpen(false)}
        onConfirm={handleToggleStatus}
        title={client.status === "active" ? "Deactivate Client" : "Activate Client"}
        description={
          client.status === "active"
            ? `Are you sure you want to deactivate "${client.company_name || client.client_name || "this client"}"? Active assignments and equipment allocations will be paused.`
            : `Are you sure you want to reactivate "${client.company_name || client.client_name || "this client"}"?`
        }
        confirmLabel={client.status === "active" ? "Deactivate" : "Activate"}
        cancelLabel="Cancel"
        variant={client.status === "active" ? "warning" : "info"}
        loading={isTogglingStatus}
      />

      {/* ─── 11. DELETE CLIENT CONFIRMATION DIALOG ─── */}
      <ConfirmationDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteClient}
        title="Delete Client"
        description={`Are you sure you want to permanently remove "${client.company_name || client.client_name || "this client"}"? All assigned supervisors and active allocations will be archived.`}
        confirmLabel="Delete Client"
        cancelLabel="Cancel"
        variant="danger"
        loading={isDeletingClient}
      />
    </div>
  );
}
