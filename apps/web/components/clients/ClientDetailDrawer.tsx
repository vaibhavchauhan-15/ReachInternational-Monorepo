"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Building2,
  Phone,
  MapPin,
  Receipt,
  Truck,
  ShieldCheck,
  Clock,
  UserCheck,
  History,
  FileText,
  Loader2,
  Edit2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { CRMClient } from "@/lib/types/database";
import {
  getClientLocationAction,
  getClientMachinesAction,
  getClientRunningLogsAction,
  getClientAssignmentsAction,
  getClientHistoryAction,
  getClientAuditLogsAction,
} from "@/app/actions/client-detail";
import type {
  ClientLocationData,
  ClientMachineItem,
  ClientRunningLogItem,
  ClientAssignmentItem,
  ClientHistoryItem,
  ClientAuditItem,
} from "@/lib/data/clients";

interface ClientDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  client: CRMClient | null;
  onOpenEdit?: (client: CRMClient) => void;
}

type DetailTab = "machines" | "logs" | "assignments" | "history" | "audit";

interface SectionCache {
  location?: ClientLocationData | null;
  machines?: ClientMachineItem[];
  logs?: ClientRunningLogItem[];
  assignments?: ClientAssignmentItem[];
  history?: ClientHistoryItem[];
  audit?: ClientAuditItem[];
}

export function ClientDetailDrawer({
  isOpen,
  onClose,
  client,
  onOpenEdit,
}: ClientDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<DetailTab | null>(null);
  const [isLocationExpanded, setIsLocationExpanded] = useState<boolean>(false);
  const [loadingLocation, setLoadingLocation] = useState<boolean>(false);
  const [locationData, setLocationData] = useState<ClientLocationData | null>(null);

  // Tab data states
  const [loadingTab, setLoadingTab] = useState<DetailTab | null>(null);
  const [machines, setMachines] = useState<ClientMachineItem[]>([]);
  const [runningLogs, setRunningLogs] = useState<ClientRunningLogItem[]>([]);
  const [assignments, setAssignments] = useState<ClientAssignmentItem[]>([]);
  const [history, setHistory] = useState<ClientHistoryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<ClientAuditItem[]>([]);

  // In-memory per-client session cache: tab -> data
  const cacheRef = useRef<Map<string, SectionCache>>(new Map());

  // Reset or initialize state when client changes
  useEffect(() => {
    if (!isOpen || !client?.id) {
      setActiveTab(null);
      setIsLocationExpanded(false);
      setLocationData(null);
      setMachines([]);
      setRunningLogs([]);
      setAssignments([]);
      setHistory([]);
      setAuditLogs([]);
      setLoadingTab(null);
      return;
    }

    // Check if client cache exists
    const clientCache = cacheRef.current.get(client.id);
    if (clientCache) {
      if (clientCache.location) setLocationData(clientCache.location);
      if (clientCache.machines) setMachines(clientCache.machines);
      if (clientCache.logs) setRunningLogs(clientCache.logs);
      if (clientCache.assignments) setAssignments(clientCache.assignments);
      if (clientCache.history) setHistory(clientCache.history);
      if (clientCache.audit) setAuditLogs(clientCache.audit);
    }
  }, [isOpen, client?.id]);

  // On-demand Location loader
  const handleToggleLocation = useCallback(async () => {
    if (!client?.id) return;
    const nextState = !isLocationExpanded;
    setIsLocationExpanded(nextState);

    if (nextState && !locationData) {
      const clientCache = cacheRef.current.get(client.id);
      if (clientCache?.location) {
        setLocationData(clientCache.location);
        return;
      }

      try {
        setLoadingLocation(true);
        const data = await getClientLocationAction(client.id);
        setLocationData(data);
        const existing = cacheRef.current.get(client.id) || {};
        cacheRef.current.set(client.id, { ...existing, location: data });
      } catch (err) {
        console.error("Failed to load client location:", err);
      } finally {
        setLoadingLocation(false);
      }
    }
  }, [client?.id, isLocationExpanded, locationData]);

  // On-tab loader
  const handleTabChange = useCallback(
    async (tab: DetailTab) => {
      setActiveTab(tab);
      if (!client?.id) return;

      const clientCache = cacheRef.current.get(client.id) || {};

      switch (tab) {
        case "machines": {
          if (clientCache.machines) {
            setMachines(clientCache.machines);
            return;
          }
          try {
            setLoadingTab("machines");
            const data = await getClientMachinesAction(client.id);
            setMachines(data);
            cacheRef.current.set(client.id, { ...clientCache, machines: data });
          } catch (err) {
            console.error("Failed to load client machines:", err);
          } finally {
            setLoadingTab(null);
          }
          break;
        }
        case "logs": {
          if (clientCache.logs) {
            setRunningLogs(clientCache.logs);
            return;
          }
          try {
            setLoadingTab("logs");
            const data = await getClientRunningLogsAction(client.id, 25);
            setRunningLogs(data);
            cacheRef.current.set(client.id, { ...clientCache, logs: data });
          } catch (err) {
            console.error("Failed to load client running logs:", err);
          } finally {
            setLoadingTab(null);
          }
          break;
        }
        case "assignments": {
          if (clientCache.assignments) {
            setAssignments(clientCache.assignments);
            return;
          }
          try {
            setLoadingTab("assignments");
            const data = await getClientAssignmentsAction(client.id);
            setAssignments(data);
            cacheRef.current.set(client.id, { ...clientCache, assignments: data });
          } catch (err) {
            console.error("Failed to load client assignments:", err);
          } finally {
            setLoadingTab(null);
          }
          break;
        }
        case "history": {
          if (clientCache.history) {
            setHistory(clientCache.history);
            return;
          }
          try {
            setLoadingTab("history");
            const data = await getClientHistoryAction(client.id);
            setHistory(data);
            cacheRef.current.set(client.id, { ...clientCache, history: data });
          } catch (err) {
            console.error("Failed to load client history:", err);
          } finally {
            setLoadingTab(null);
          }
          break;
        }
        case "audit": {
          if (clientCache.audit) {
            setAuditLogs(clientCache.audit);
            return;
          }
          try {
            setLoadingTab("audit");
            const data = await getClientAuditLogsAction(client.id, 30);
            setAuditLogs(data);
            cacheRef.current.set(client.id, { ...clientCache, audit: data });
          } catch (err) {
            console.error("Failed to load client audit logs:", err);
          } finally {
            setLoadingTab(null);
          }
          break;
        }
      }
    },
    [client?.id]
  );

  if (!isOpen || !client) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        />

        {/* Slide-over Drawer Panel */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xl"
        >
          {/* ─── 1. Summary Header (Immediate) ─── */}
          <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-5 py-3.5 bg-[var(--color-canvas-elevated)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                    {client.code}
                  </span>
                  {client.deleted_at ? (
                    <span className="rounded-full bg-red-50 dark:bg-red-950/60 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/80">
                      SOFT DELETED
                    </span>
                  ) : client.status === "active" ? (
                    <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-bold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                      INACTIVE
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-[var(--color-ink)] truncate max-w-[320px]">
                  {client.company_name || client.client_name}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* ─── 2. Persistent Top Section: Contact, Tax (Immediate) & Location (On Demand) ─── */}
          <div className="border-b border-[var(--color-hairline)] p-4 bg-[var(--color-canvas)] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Contact Person Card (Immediate / Summary) */}
              <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 space-y-1 shadow-2xs">
                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1">
                  <UserCheck className="h-3 w-3" /> Contact Person
                </span>
                <p className="font-semibold text-xs text-[var(--color-ink)] truncate">
                  {client.contact_person || "—"}
                </p>
                {client.phone ? (
                  <a
                    href={`tel:${client.phone}`}
                    className="font-mono text-[11px] text-[var(--color-mute)] hover:text-sky-600 flex items-center gap-1 transition-colors"
                  >
                    <Phone className="h-3 w-3 text-[var(--color-mute)]" />
                    <span>{client.phone}</span>
                  </a>
                ) : (
                  <span className="text-[10px] text-[var(--color-mute)] block">No phone registered</span>
                )}
              </div>

              {/* Tax & Statutory Identifiers (Immediate / Summary) */}
              <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 space-y-1 shadow-2xs">
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1">
                  <Receipt className="h-3 w-3" /> Tax Identifiers
                </span>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[10px] text-[var(--color-mute)]">GSTIN:</span>
                  <span className="font-mono font-semibold text-[var(--color-ink)]">
                    {client.gstin || "Unregistered"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[10px] text-[var(--color-mute)]">PAN:</span>
                  <span className="font-mono font-semibold text-[var(--color-ink)]">
                    {client.pan_number || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Location Section (On Demand) */}
            <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={handleToggleLocation}
                className="w-full flex items-center justify-between p-2.5 text-left font-bold text-[var(--color-ink)] text-xs hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs shrink-0">Location</span>
                  <span className="text-[10px] font-normal text-[var(--color-mute)] truncate">
                    — {[client.city, client.state].filter(Boolean).join(", ") || "Site coordinates"}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-medium text-sky-600 dark:text-sky-400 shrink-0">
                  <span>{isLocationExpanded ? "Hide" : "Load On Demand"}</span>
                  {isLocationExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </div>
              </button>

              {isLocationExpanded && (
                <div className="border-t border-[var(--color-hairline)] p-3 space-y-2.5 bg-[var(--color-canvas)] text-xs">
                  {loadingLocation ? (
                    <div className="py-2 flex items-center justify-center gap-2 text-xs text-[var(--color-mute)]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                      <span>Fetching location on demand...</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] font-semibold text-[var(--color-mute)] uppercase tracking-wider block">
                          Operational Site Address
                        </span>
                        <p className="text-[var(--color-body)] text-xs pt-0.5 leading-relaxed">
                          {locationData?.site_address ||
                            [client.street, client.city, client.district, client.state, client.pincode]
                              .filter(Boolean)
                              .join(", ") ||
                            "—"}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-[var(--color-hairline)]">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-[var(--color-mute)] uppercase tracking-wider block">
                            Registered Billing Address
                          </span>
                          {client.is_billing_address_different ? (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                              Separate Billing
                            </span>
                          ) : (
                            <span className="text-[9px] text-[var(--color-mute)]">Same as Site</span>
                          )}
                        </div>
                        <p className="text-[var(--color-body)] text-xs pt-0.5 leading-relaxed">
                          {locationData?.formatted_billing_address || "Same as Operational Site Address"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ─── 3. Navigation Tabs Strip (5 Operational Tabs) ─── */}
          <div className="flex items-center gap-1 border-b border-[var(--color-hairline)] px-4 bg-[var(--color-canvas-elevated)] overflow-x-auto text-xs scrollbar-none">
            <button
              type="button"
              onClick={() => handleTabChange("machines")}
              className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === "machines"
                  ? "border-sky-600 text-sky-600 dark:text-sky-400 font-semibold"
                  : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              <Truck className="h-3.5 w-3.5" />
              <span>Machines</span>
              {machines.length > 0 && (
                <span className="rounded-full bg-sky-100 dark:bg-sky-950 px-1.5 py-0.2 text-[9px] font-bold text-sky-700 dark:text-sky-300">
                  {machines.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("logs")}
              className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === "logs"
                  ? "border-sky-600 text-sky-600 dark:text-sky-400 font-semibold"
                  : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Running Logs</span>
              {runningLogs.length > 0 && (
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                  {runningLogs.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("assignments")}
              className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === "assignments"
                  ? "border-sky-600 text-sky-600 dark:text-sky-400 font-semibold"
                  : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Assignments</span>
              {assignments.length > 0 && (
                <span className="rounded-full bg-purple-100 dark:bg-purple-950 px-1.5 py-0.2 text-[9px] font-bold text-purple-700 dark:text-purple-300">
                  {assignments.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("history")}
              className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === "history"
                  ? "border-sky-600 text-sky-600 dark:text-sky-400 font-semibold"
                  : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>History</span>
              {history.length > 0 && (
                <span className="rounded-full bg-amber-100 dark:bg-amber-950 px-1.5 py-0.2 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                  {history.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("audit")}
              className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === "audit"
                  ? "border-sky-600 text-sky-600 dark:text-sky-400 font-semibold"
                  : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Audit</span>
              {auditLogs.length > 0 && (
                <span className="rounded-full bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.2 text-[9px] font-bold text-neutral-700 dark:text-neutral-300">
                  {auditLogs.length}
                </span>
              )}
            </button>
          </div>

          {/* ─── 4. Scrollable Tab Content (Loads On Tab) ─── */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            {activeTab === null && (
              <div className="rounded-lg border border-dashed border-[var(--color-hairline)] p-5 text-center text-[var(--color-mute)] space-y-3 bg-[var(--color-canvas)]">
                <p className="font-semibold text-xs text-[var(--color-ink)]">
                  Operational Records (On Demand)
                </p>
                <p className="text-[11px] text-[var(--color-mute)] max-w-xs mx-auto">
                  Select an operational tab to load live records on demand with zero upfront latency:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-left">
                  <button
                    type="button"
                    onClick={() => handleTabChange("machines")}
                    className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:border-sky-500/50 hover:bg-sky-500/5 transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-xs text-[var(--color-ink)] flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-sky-600" /> Machines
                    </span>
                    <span className="text-[10px] text-[var(--color-mute)] block pt-0.5">Fleet equipment</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange("logs")}
                    className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-xs text-[var(--color-ink)] flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-emerald-600" /> Logs
                    </span>
                    <span className="text-[10px] text-[var(--color-mute)] block pt-0.5">Shift meter hours</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange("assignments")}
                    className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:border-purple-500/50 hover:bg-purple-500/5 transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-xs text-[var(--color-ink)] flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-purple-600" /> Assignments
                    </span>
                    <span className="text-[10px] text-[var(--color-mute)] block pt-0.5">Operator roster</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange("history")}
                    className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-xs text-[var(--color-ink)] flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5 text-amber-600" /> History
                    </span>
                    <span className="text-[10px] text-[var(--color-mute)] block pt-0.5">Account timeline</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange("audit")}
                    className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:border-sky-500/50 hover:bg-sky-500/5 transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-xs text-[var(--color-ink)] flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-sky-600" /> Audit
                    </span>
                    <span className="text-[10px] text-[var(--color-mute)] block pt-0.5">Security audit trail</span>
                  </button>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* TAB: MACHINES (On Tab)                                          */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === "machines" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[var(--color-ink)] text-xs flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-sky-600" /> Deployed Fleet Equipment
                  </h4>
                  <span className="text-[10px] font-mono text-[var(--color-mute)]">
                    {loadingTab === "machines" ? "Checking..." : `${machines.length} units`}
                  </span>
                </div>

                {loadingTab === "machines" ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--color-mute)]">
                    <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
                    <span>Loading deployed machines...</span>
                  </div>
                ) : machines.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--color-hairline)] p-6 text-center text-[var(--color-mute)] space-y-1">
                    <Truck className="h-6 w-6 mx-auto text-[var(--color-mute)] opacity-50" />
                    <p className="font-semibold text-xs text-[var(--color-ink)]">No Machinery Assigned</p>
                    <p className="text-[11px]">No equipment is currently deployed under this client account.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {machines.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 text-xs flex items-center justify-between hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                              {m.machine_id}
                            </span>
                            <span className="text-[10px] text-[var(--color-mute)]">
                              {m.manufacturer || ""} {m.model}
                            </span>
                          </div>
                          <div className="text-[10px] text-[var(--color-mute)] pt-0.5 flex items-center gap-2">
                            {m.serial_number && <span>S/N: {m.serial_number}</span>}
                            {m.hour_meter !== null && <span>Meter: {m.hour_meter} hrs</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                              m.status === "rented" || m.status === "active"
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700"
                            }`}
                          >
                            {m.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* TAB: RUNNING LOGS (On Tab)                                      */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === "logs" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[var(--color-ink)] text-xs flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-emerald-600" /> Shift Running Hour Logs
                  </h4>
                  <span className="text-[10px] font-mono text-[var(--color-mute)]">
                    {loadingTab === "logs" ? "Fetching..." : `${runningLogs.length} logs`}
                  </span>
                </div>

                {loadingTab === "logs" ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--color-mute)]">
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                    <span>Loading operational running hours...</span>
                  </div>
                ) : runningLogs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--color-hairline)] p-6 text-center text-[var(--color-mute)] space-y-1">
                    <Clock className="h-6 w-6 mx-auto text-[var(--color-mute)] opacity-50" />
                    <p className="font-semibold text-xs text-[var(--color-ink)]">No Running Logs</p>
                    <p className="text-[11px]">No shift running logs recorded for this client yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {runningLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                              {log.machine_code}
                            </span>
                            <span className="text-[10px] text-[var(--color-mute)]">
                              {log.log_date}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-emerald-600">
                            {log.running_hours} hrs
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-[var(--color-mute)]">
                          <span>Operator: {log.operator_name || "—"}</span>
                          <span>
                            Meter: {log.start_meter ?? "—"} → {log.end_meter ?? "—"}
                          </span>
                        </div>

                        {log.is_breakdown && (
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                            <AlertCircle className="h-3 w-3" /> Breakdown logged
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* TAB: ASSIGNMENTS (On Tab)                                       */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === "assignments" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[var(--color-ink)] text-xs flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-purple-600" /> Operator Equipment Assignments
                  </h4>
                  <span className="text-[10px] font-mono text-[var(--color-mute)]">
                    {loadingTab === "assignments" ? "Loading..." : `${assignments.length} assignments`}
                  </span>
                </div>

                {loadingTab === "assignments" ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--color-mute)]">
                    <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                    <span>Fetching operator assignments...</span>
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--color-hairline)] p-6 text-center text-[var(--color-mute)] space-y-1">
                    <UserCheck className="h-6 w-6 mx-auto text-[var(--color-mute)] opacity-50" />
                    <p className="font-semibold text-xs text-[var(--color-ink)]">No Active Assignments</p>
                    <p className="text-[11px]">No operators assigned to machines deployed for this client.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignments.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[var(--color-ink)]">
                              {a.operator_name}
                            </span>
                            <span className="font-mono text-[10px] text-sky-600">
                              {a.machine_code}
                            </span>
                          </div>
                          <div className="text-[10px] text-[var(--color-mute)] pt-0.5">
                            Shift: {a.shift_start_time.slice(0, 5)} – {a.shift_end_time.slice(0, 5)}
                            {a.operator_phone && <span> • Ph: {a.operator_phone}</span>}
                          </div>
                        </div>

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
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* TAB: HISTORY (On Tab)                                           */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === "history" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[var(--color-ink)] text-xs flex items-center gap-1.5">
                    <History className="h-4 w-4 text-amber-600" /> Client Account Timeline
                  </h4>
                  <span className="text-[10px] font-mono text-[var(--color-mute)]">
                    {loadingTab === "history" ? "Loading..." : `${history.length} milestones`}
                  </span>
                </div>

                {loadingTab === "history" ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--color-mute)]">
                    <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                    <span>Loading timeline history...</span>
                  </div>
                ) : history.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--color-hairline)] p-6 text-center text-[var(--color-mute)] space-y-1">
                    <History className="h-6 w-6 mx-auto text-[var(--color-mute)] opacity-50" />
                    <p className="font-semibold text-xs text-[var(--color-ink)]">No Timeline Events</p>
                    <p className="text-[11px]">No activity history logged for this account yet.</p>
                  </div>
                ) : (
                  <div className="relative pl-5 space-y-3 border-l-2 border-[var(--color-hairline)] ml-2">
                    {history.map((h) => (
                      <div key={h.id} className="relative group">
                        <div className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-[var(--color-canvas)] bg-sky-600" />
                        <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[var(--color-ink)]">{h.title}</span>
                            <span className="text-[10px] text-[var(--color-mute)]">
                              {new Date(h.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-[var(--color-body)] text-[11px] leading-relaxed">
                            {h.description}
                          </p>
                          {h.actor_name && (
                            <span className="text-[9px] text-[var(--color-mute)] block pt-0.5">
                              Logged by: {h.actor_name}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* TAB: AUDIT (On Tab)                                             */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === "audit" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[var(--color-ink)] text-xs flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-sky-600" /> Append-Only Audit Trail
                  </h4>
                  <span className="text-[10px] font-mono text-[var(--color-mute)]">
                    {loadingTab === "audit" ? "Loading..." : `${auditLogs.length} events`}
                  </span>
                </div>

                {loadingTab === "audit" ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--color-mute)]">
                    <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
                    <span>Loading immutable audit records...</span>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--color-hairline)] p-6 text-center text-[var(--color-mute)] space-y-1">
                    <ShieldCheck className="h-6 w-6 mx-auto text-[var(--color-mute)] opacity-50" />
                    <p className="font-semibold text-xs text-[var(--color-ink)]">No Audit Logs</p>
                    <p className="text-[11px]">Zero elevated mutations or audit entries for this record.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                            {a.action}
                          </span>
                          <span className="text-[10px] text-[var(--color-mute)]">
                            {new Date(a.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[var(--color-mute)] pt-0.5">
                          <span>
                            Actor: {a.actor_name || "Unknown"} ({a.actor_role || "—"})
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Footer Actions ─── */}
          <div className="border-t border-[var(--color-hairline)] p-4 flex items-center justify-between gap-3 bg-[var(--color-canvas)]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] px-4 py-2 text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
            >
              Close
            </button>

            {onOpenEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEdit(client);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 transition-colors cursor-pointer shadow-xs"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit Profile
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
