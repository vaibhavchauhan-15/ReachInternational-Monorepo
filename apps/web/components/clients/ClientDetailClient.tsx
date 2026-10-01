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
  SearchBox,
  useToast,
} from "@/components/ui";
import { ClientModal } from "@/components/clients/ClientModal";
import { ClientShiftCodesTab } from "./ClientShiftCodesTab";
import { SitesList } from "./SitesList";
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
  states = [],
  currentUserRole = "super_admin",
}: ClientDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [client, setClient] = useState<CRMClient>(initialClient);
  const [activeTab, setActiveTab] = useState<ClientDetailTabKey>("machines");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [tabSearch, setTabSearch] = useState("");

  useEffect(() => {
    setClient(initialClient);
  }, [initialClient]);

  const canManage = ["super_admin", "admin", "manager"].includes(currentUserRole);

  const handleCopy = useCallback((text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast("info", `${key} copied to clipboard`);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  }, [toast]);

  // Filtered Tab Items
  const filteredMachines = useMemo(() => {
    if (!tabSearch.trim()) return initialMachines;
    const q = tabSearch.toLowerCase().trim();
    return initialMachines.filter(
      (m) =>
        m.machine_id.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        (m.serial_number && m.serial_number.toLowerCase().includes(q)) ||
        m.status.toLowerCase().includes(q)
    );
  }, [initialMachines, tabSearch]);

  const filteredLogs = useMemo(() => {
    if (!tabSearch.trim()) return initialLogs;
    const q = tabSearch.toLowerCase().trim();
    return initialLogs.filter(
      (l) =>
        (l.machine_code && l.machine_code.toLowerCase().includes(q)) ||
        (l.operator_name && l.operator_name.toLowerCase().includes(q)) ||
        l.log_date.includes(q)
    );
  }, [initialLogs, tabSearch]);

  const filteredAssignments = useMemo(() => {
    if (!tabSearch.trim()) return initialAssignments;
    const q = tabSearch.toLowerCase().trim();
    return initialAssignments.filter(
      (a) =>
        a.operator_name.toLowerCase().includes(q) ||
        a.machine_code.toLowerCase().includes(q) ||
        (a.operator_phone && a.operator_phone.includes(q))
    );
  }, [initialAssignments, tabSearch]);

  const filteredShiftCodes = useMemo(() => {
    if (!tabSearch.trim()) return initialShiftCodes;
    const q = tabSearch.toLowerCase().trim();
    return initialShiftCodes.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        (s.name && s.name.toLowerCase().includes(q))
    );
  }, [initialShiftCodes, tabSearch]);

  const filteredHistory = useMemo(() => {
    if (!tabSearch.trim()) return initialHistory;
    const q = tabSearch.toLowerCase().trim();
    return initialHistory.filter(
      (h) =>
        h.title.toLowerCase().includes(q) ||
        h.description.toLowerCase().includes(q) ||
        (h.actor_name && h.actor_name.toLowerCase().includes(q))
    );
  }, [initialHistory, tabSearch]);

  const filteredAuditLogs = useMemo(() => {
    if (!tabSearch.trim()) return initialAuditLogs;
    const q = tabSearch.toLowerCase().trim();
    return initialAuditLogs.filter(
      (a) =>
        a.action.toLowerCase().includes(q) ||
        (a.actor_name && a.actor_name.toLowerCase().includes(q)) ||
        (a.actor_role && a.actor_role.toLowerCase().includes(q))
    );
  }, [initialAuditLogs, tabSearch]);

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

      {/* ─── 2. MASTER HERO BANNER CARD (Optimized for Mobile and Desktop) ─── */}
      <div className="rounded-xl sm:rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-5 md:p-6 shadow-2xs relative overflow-hidden transition-all">
        {/* Subtle top hairline gradient accent */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/50 to-transparent pointer-events-none" />

        {/* ── Mobile Layout (≤640px) ── */}
        <div className="flex flex-col gap-3 sm:hidden">
          {/* Row 1: Brand Icon + Title & ID copy */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
              <Building2 className="h-5 w-5" />
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <h1 className="text-base font-bold text-[var(--color-ink)] tracking-tight truncate leading-tight">
                {client.company_name || client.client_name}
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={() => handleCopy(clientIdentifier, "Client ID")}
                  className="inline-flex items-center gap-1 h-5 px-2 rounded bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400 cursor-pointer active:scale-95"
                  title="Click to copy Client ID"
                >
                  <span>{clientIdentifier}</span>
                  {copiedKey === "Client ID" ? (
                    <AnimatedCheck size={11} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AnimatedCopy size={11} className="text-[var(--color-mute)] shrink-0" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Status & Feature Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {client.deleted_at ? (
              <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-950/60 px-2.5 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/80">
                SOFT DELETED
              </span>
            ) : client.status === "active" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ACTIVE
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 text-[10px] font-bold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                INACTIVE
              </span>
            )}

            {hasMaintenanceAllowance(client.maintenance_allowance_minutes) ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Wrench size={10} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Maint: {formatAllowance(client.maintenance_allowance_minutes ?? 0)}/mo</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/60 px-2.5 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/80">
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

          {/* Row 3: Touch Action Buttons */}
          <div className="flex items-center gap-2 pt-0.5">
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsEditModalOpen(true)}
                className="flex-1 min-h-[40px] text-xs font-semibold rounded-md inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <AnimatedEdit size={14} />
                <span>Edit Profile</span>
              </Button>
            )}

            {cleanPhone && (
              <a
                href={`tel:${cleanPhone}`}
                className="flex-1 min-h-[40px] px-3 rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-semibold text-[var(--color-ink)] inline-flex items-center justify-center gap-1.5 active:bg-[var(--color-hairline-soft-surface)]"
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
                className="flex-1 min-h-[40px] px-3 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-xs font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center justify-center gap-1.5 active:bg-emerald-500/20"
                title="WhatsApp Client"
              >
                <span>WhatsApp</span>
              </a>
            )}
          </div>
        </div>

        {/* ── Desktop / Tablet Layout (>640px) ── */}
        <div className="hidden sm:flex sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
              <Building2 className="h-7 w-7" />
            </div>

            <div className="flex flex-col min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleCopy(clientIdentifier, "Client ID")}
                  className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md bg-[var(--color-hairline-soft-surface)] hover:bg-[var(--color-hairline)] border border-[var(--color-hairline)] text-xs font-mono font-bold text-sky-600 dark:text-sky-400 cursor-pointer transition-colors active:scale-95"
                  title="Click to copy Client ID"
                >
                  <span>{clientIdentifier}</span>
                  {copiedKey === "Client ID" ? (
                    <AnimatedCheck size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AnimatedCopy size={12} className="text-[var(--color-mute)] shrink-0" />
                  )}
                </button>

                {client.deleted_at ? (
                  <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-950/60 px-2.5 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/80">
                    SOFT DELETED
                  </span>
                ) : client.status === "active" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ACTIVE
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 text-[10px] font-bold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                    INACTIVE
                  </span>
                )}

                {hasMaintenanceAllowance(client.maintenance_allowance_minutes) ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <Wrench size={10} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Maint. Allowed: {formatAllowance(client.maintenance_allowance_minutes ?? 0)} / mo</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/60 px-2.5 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/80">
                    <AlertCircle size={10} className="text-red-600 dark:text-red-400 shrink-0" />
                    <span>Maintenance: Not Allowed</span>
                  </span>
                )}

                {client.is_billing_address_different && (
                  <span className="inline-flex items-center rounded-full bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Separate Billing
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--color-ink)] tracking-tight truncate leading-tight">
                {client.company_name || client.client_name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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

      {/* ─── 3. 4-CARD HIGH-DENSITY METADATA GRID (Constituent to User & Machine Pages) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Contact Person */}
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-2xs space-y-2.5 transition-all hover:border-[var(--color-link)]/40 hover:shadow-xs group"
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
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-2xs space-y-2.5 transition-all hover:border-[var(--color-link)]/40 hover:shadow-xs group"
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
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-2xs space-y-2.5 transition-all hover:border-[var(--color-link)]/40 hover:shadow-xs group"
        >
          <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
              <AnimatedMapPin size={16} className="text-emerald-500 shrink-0" />
              Operational Site
            </span>
            {siteAddress !== "—" && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] lowercase font-normal text-sky-600 hover:underline flex items-center gap-0.5"
                title="Open in Google Maps"
              >
                <ExternalLink size={10} />
                <span>maps</span>
              </a>
            )}
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
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-2xs space-y-2.5 transition-all hover:border-[var(--color-link)]/40 hover:shadow-xs group"
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Machinery */}
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-2xs space-y-1.5 transition-all hover:border-[var(--color-link)]/40 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
              Assigned Fleet
            </span>
            <AnimatedTruck size={16} className="text-sky-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--color-ink)]">
            {initialMachines.length}
          </div>
          <div className="text-[11px] text-[var(--color-mute)]">
            {activeMachinesCount === 1 ? "1 active unit" : `${activeMachinesCount} active equipment units`}
          </div>
        </div>

        {/* Metric 2: Running Hours */}
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-2xs space-y-1.5 transition-all hover:border-[var(--color-link)]/40 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
              Running Hours
            </span>
            <AnimatedClock size={16} className="text-emerald-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {totalRunningHours} <span className="text-xs font-normal font-sans text-[var(--color-mute)]">hrs</span>
          </div>
          <div className="text-[11px] text-[var(--color-mute)]">
            {initialLogs.length} logged machine shifts
          </div>
        </div>

        {/* Metric 3: Active Operators */}
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-2xs space-y-1.5 transition-all hover:border-[var(--color-link)]/40 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
              Operator Roster
            </span>
            <AnimatedUsers size={16} className="text-purple-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
            {activeAssignmentsCount}
          </div>
          <div className="text-[11px] text-[var(--color-mute)]">
            {initialAssignments.length} total shift allocations
          </div>
        </div>

        {/* Metric 4: Account Status */}
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-2xs space-y-1.5 transition-all hover:border-[var(--color-link)]/40 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
              Account Standing
            </span>
            <AnimatedShieldCheck size={16} className="text-indigo-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--color-ink)]">
            {client.status.toUpperCase()}
          </div>
          <div className="text-[11px] text-[var(--color-mute)]" suppressHydrationWarning>
            Member since {formatDate(client.created_at)}
          </div>
        </div>
      </div>

      {/* ─── 5. TAB STRIP & SEARCH TOOLBAR (Consistent with Users/Machines Page) ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--color-hairline)] pb-3">
        {/* Scrollable Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar flex-nowrap pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab("machines");
              setTabSearch("");
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "machines"
                ? "bg-[var(--color-ink)] text-[var(--color-on-primary)] shadow-xs"
                : "bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            Machines ({initialMachines.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("sites");
              setTabSearch("");
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "sites"
                ? "bg-[var(--color-ink)] text-[var(--color-on-primary)] shadow-xs"
                : "bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            Sites ({initialSites.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("logs");
              setTabSearch("");
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "logs"
                ? "bg-[var(--color-ink)] text-[var(--color-on-primary)] shadow-xs"
                : "bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            Running Logs ({initialLogs.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("assignments");
              setTabSearch("");
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "assignments"
                ? "bg-[var(--color-ink)] text-[var(--color-on-primary)] shadow-xs"
                : "bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            Assignments ({initialAssignments.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("shifts");
              setTabSearch("");
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "shifts"
                ? "bg-[var(--color-ink)] text-[var(--color-on-primary)] shadow-xs"
                : "bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            Shift Codes ({initialShiftCodes.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              setTabSearch("");
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-[var(--color-ink)] text-[var(--color-on-primary)] shadow-xs"
                : "bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            History ({initialHistory.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("audit");
              setTabSearch("");
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "audit"
                ? "bg-[var(--color-ink)] text-[var(--color-on-primary)] shadow-xs"
                : "bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            Audit Trail ({initialAuditLogs.length})
          </button>
        </div>

        {/* Search Bar - Reusing SearchBox primitive */}
        <div className="w-full sm:w-72">
          <SearchBox
            value={tabSearch}
            onChange={(val) => setTabSearch(val)}
            placeholder={`Filter ${
              activeTab === "machines"
                ? "machines"
                : activeTab === "logs"
                ? "logs"
                : activeTab === "assignments"
                ? "assignments"
                : activeTab === "shifts"
                ? "shifts"
                : activeTab === "history"
                ? "history"
                : "audit trail"
            }...`}
            size="sm"
          />
        </div>
      </div>

        {/* ─── 6. TAB CONTENT PANELS ─── */}
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-5 shadow-2xs min-h-[300px]">
          {/* TAB 1: MACHINES */}
          {activeTab === "machines" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-ink)]">
                    Deployed Fleet Equipment
                  </h3>
                  <p className="text-xs text-[var(--color-mute)]">
                    Machinery actively or historically deployed to this client
                  </p>
                </div>
                <span className="text-xs font-mono text-[var(--color-mute)]">
                  {filteredMachines.length} of {initialMachines.length} units
                </span>
              </div>

              {filteredMachines.length === 0 ? (
                <EmptyState
                  title="No Machinery Found"
                  description={
                    tabSearch
                      ? `No machines matching "${tabSearch}" were found for this client.`
                      : "No equipment units are currently allocated to this client account."
                  }
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
                                className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline inline-flex items-center gap-1"
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
                          <span className="font-mono font-bold text-sky-600">{m.machine_id}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                              m.status === "active" || m.status === "rented"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-neutral-100 text-neutral-600 border-neutral-200"
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-ink)]">
                    Shift Running Hours & HMR Logs
                  </h3>
                  <p className="text-xs text-[var(--color-mute)]">
                    Machine meter entries logged during operator shifts
                  </p>
                </div>
                <span className="text-xs font-mono text-[var(--color-mute)]">
                  {filteredLogs.length} entries
                </span>
              </div>

              {filteredLogs.length === 0 ? (
                <EmptyState
                  title="No Running Logs Recorded"
                  description={
                    tabSearch
                      ? `No shift logs matching "${tabSearch}" were found.`
                      : "No shift running hours have been logged for this client account yet."
                  }
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
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/60 px-2 py-0.5 text-[9px] font-bold text-red-700 dark:text-red-300 border border-red-200">
                                  <AlertCircle size={10} /> Breakdown
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200">
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

          {/* TAB 3: OPERATOR ASSIGNMENTS */}
          {activeTab === "assignments" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-ink)]">
                    Operator Machine Assignments
                  </h3>
                  <p className="text-xs text-[var(--color-mute)]">
                    Operators currently and historically allocated to machines under this client
                  </p>
                </div>
                <span className="text-xs font-mono text-[var(--color-mute)]">
                  {filteredAssignments.length} assignments
                </span>
              </div>

              {filteredAssignments.length === 0 ? (
                <EmptyState
                  title="No Operator Assignments"
                  description={
                    tabSearch
                      ? `No operators matching "${tabSearch}" were found.`
                      : "No operators are currently assigned to equipment allocated to this client."
                  }
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
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-neutral-100 text-neutral-600 border-neutral-200"
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-ink)]">
                    Client Account Timeline
                  </h3>
                  <p className="text-xs text-[var(--color-mute)]">
                    Historical registration, fleet deployment, and operational milestones
                  </p>
                </div>
                <span className="text-xs font-mono text-[var(--color-mute)]">
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-ink)]">
                    Append-Only Security Audit Trail
                  </h3>
                  <p className="text-xs text-[var(--color-mute)]">
                    Tamper-proof event logs tracking profile edits and administrative modifications
                  </p>
                </div>
                <span className="text-xs font-mono text-[var(--color-mute)]">
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
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                              a.severity === "critical"
                                ? "bg-red-50 text-red-700"
                                : a.severity === "warning"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-sky-50 text-sky-700"
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
    </div>
  );
}
