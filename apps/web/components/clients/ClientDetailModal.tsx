"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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

interface ClientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: CRMClient | null;
}

type ModalTab = "machines" | "logs" | "assignments" | "history" | "audit";

export function ClientDetailModal({ isOpen, onClose, client }: ClientDetailModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab | null>(null);
  const [isLocationExpanded, setIsLocationExpanded] = useState(false);
  const [locationData, setLocationData] = useState<ClientLocationData | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  const [loadingTab, setLoadingTab] = useState<ModalTab | null>(null);
  const [machines, setMachines] = useState<ClientMachineItem[]>([]);
  const [runningLogs, setRunningLogs] = useState<ClientRunningLogItem[]>([]);
  const [assignments, setAssignments] = useState<ClientAssignmentItem[]>([]);
  const [history, setHistory] = useState<ClientHistoryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<ClientAuditItem[]>([]);

  const cacheRef = useRef<Map<string, Record<string, unknown>>>(new Map());

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
    }
  }, [isOpen, client?.id]);

  const handleToggleLocation = useCallback(async () => {
    if (!client?.id) return;
    const next = !isLocationExpanded;
    setIsLocationExpanded(next);

    if (next && !locationData) {
      const cached = cacheRef.current.get(client.id)?.location as ClientLocationData | undefined;
      if (cached) {
        setLocationData(cached);
        return;
      }
      try {
        setLoadingLocation(true);
        const data = await getClientLocationAction(client.id);
        setLocationData(data);
        const ex = cacheRef.current.get(client.id) || {};
        cacheRef.current.set(client.id, { ...ex, location: data });
      } finally {
        setLoadingLocation(false);
      }
    }
  }, [client?.id, isLocationExpanded, locationData]);

  const handleTabChange = useCallback(
    async (tab: ModalTab) => {
      setActiveTab(tab);
      if (!client?.id) return;
      const ex = cacheRef.current.get(client.id) || {};

      switch (tab) {
        case "machines": {
          if (ex.machines) {
            setMachines(ex.machines as ClientMachineItem[]);
            return;
          }
          try {
            setLoadingTab("machines");
            const data = await getClientMachinesAction(client.id);
            setMachines(data);
            cacheRef.current.set(client.id, { ...ex, machines: data });
          } finally {
            setLoadingTab(null);
          }
          break;
        }
        case "logs": {
          if (ex.logs) {
            setRunningLogs(ex.logs as ClientRunningLogItem[]);
            return;
          }
          try {
            setLoadingTab("logs");
            const data = await getClientRunningLogsAction(client.id);
            setRunningLogs(data);
            cacheRef.current.set(client.id, { ...ex, logs: data });
          } finally {
            setLoadingTab(null);
          }
          break;
        }
        case "assignments": {
          if (ex.assignments) {
            setAssignments(ex.assignments as ClientAssignmentItem[]);
            return;
          }
          try {
            setLoadingTab("assignments");
            const data = await getClientAssignmentsAction(client.id);
            setAssignments(data);
            cacheRef.current.set(client.id, { ...ex, assignments: data });
          } finally {
            setLoadingTab(null);
          }
          break;
        }
        case "history": {
          if (ex.history) {
            setHistory(ex.history as ClientHistoryItem[]);
            return;
          }
          try {
            setLoadingTab("history");
            const data = await getClientHistoryAction(client.id);
            setHistory(data);
            cacheRef.current.set(client.id, { ...ex, history: data });
          } finally {
            setLoadingTab(null);
          }
          break;
        }
        case "audit": {
          if (ex.audit) {
            setAuditLogs(ex.audit as ClientAuditItem[]);
            return;
          }
          try {
            setLoadingTab("audit");
            const data = await getClientAuditLogsAction(client.id);
            setAuditLogs(data);
            cacheRef.current.set(client.id, { ...ex, audit: data });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xl overflow-hidden">
        {/* Modal Header (Immediate Summary) */}
        <div className="flex items-start justify-between border-b border-[var(--color-hairline)] p-4 bg-[var(--color-canvas-elevated)]">
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
              <h2 className="text-base font-bold text-[var(--color-ink)]">
                {client.company_name || client.client_name}
              </h2>
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

        {/* Persistent Top: Contact, Tax & On-Demand Location */}
        <div className="border-b border-[var(--color-hairline)] p-3.5 bg-[var(--color-canvas)] space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Primary Contact (Immediate) */}
            <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-2.5 space-y-1">
              <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">
                Primary Contact
              </span>
              <p className="font-semibold text-xs text-[var(--color-ink)]">{client.contact_person || "—"}</p>
              {client.phone ? (
                <a href={`tel:${client.phone}`} className="font-mono text-[11px] text-[var(--color-mute)] hover:text-sky-600 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>{client.phone}</span>
                </a>
              ) : (
                <span className="text-[10px] text-[var(--color-mute)]">No phone</span>
              )}
            </div>

            {/* Tax & Statutory (Immediate) */}
            <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-2.5 space-y-1">
              <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">
                Tax Identifiers
              </span>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[10px] text-[var(--color-mute)]">GSTIN:</span>
                <span className="font-mono font-semibold text-[var(--color-ink)]">{client.gstin || "Unregistered"}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[10px] text-[var(--color-mute)]">PAN:</span>
                <span className="font-mono font-semibold text-[var(--color-ink)]">{client.pan_number || "—"}</span>
              </div>
            </div>
          </div>

          {/* Location (On Demand) */}
          <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden">
            <button
              type="button"
              onClick={handleToggleLocation}
              className="w-full flex items-center justify-between p-2 text-xs font-bold text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Location</span>
                <span className="text-[10px] font-normal text-[var(--color-mute)] truncate">
                  — {[client.city, client.state].filter(Boolean).join(", ") || "Site"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-sky-600 font-semibold shrink-0">
                <span>{isLocationExpanded ? "Hide" : "Load On Demand"}</span>
                {isLocationExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </div>
            </button>

            {isLocationExpanded && (
              <div className="border-t border-[var(--color-hairline)] p-2.5 space-y-2 bg-[var(--color-canvas)] text-xs">
                {loadingLocation ? (
                  <div className="py-2 flex items-center justify-center gap-2 text-[var(--color-mute)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                    <span>Loading location...</span>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="text-[10px] text-[var(--color-mute)] font-medium block">Site Address</span>
                      <p className="text-[var(--color-body)]">{locationData?.site_address || "—"}</p>
                    </div>
                    <div className="pt-1 border-t border-[var(--color-hairline)]">
                      <span className="text-[10px] text-[var(--color-mute)] font-medium block">Billing Address</span>
                      <p className="text-[var(--color-body)]">{locationData?.formatted_billing_address || "Same as site"}</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tab Strip (5 Operational Tabs) */}
        <div className="flex items-center gap-1 border-b border-[var(--color-hairline)] px-4 bg-[var(--color-canvas-elevated)] overflow-x-auto text-xs scrollbar-none">
          <button
            type="button"
            onClick={() => handleTabChange("machines")}
            className={`py-2 px-3 border-b-2 font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "machines"
                ? "border-sky-600 text-sky-600 font-semibold"
                : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
            }`}
          >
            Machines {machines.length > 0 && `(${machines.length})`}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("logs")}
            className={`py-2 px-3 border-b-2 font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "logs"
                ? "border-sky-600 text-sky-600 font-semibold"
                : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
            }`}
          >
            Running Logs {runningLogs.length > 0 && `(${runningLogs.length})`}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("assignments")}
            className={`py-2 px-3 border-b-2 font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "assignments"
                ? "border-sky-600 text-sky-600 font-semibold"
                : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
            }`}
          >
            Assignments {assignments.length > 0 && `(${assignments.length})`}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("history")}
            className={`py-2 px-3 border-b-2 font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "history"
                ? "border-sky-600 text-sky-600 font-semibold"
                : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
            }`}
          >
            History {history.length > 0 && `(${history.length})`}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("audit")}
            className={`py-2 px-3 border-b-2 font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "audit"
                ? "border-sky-600 text-sky-600 font-semibold"
                : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
            }`}
          >
            Audit {auditLogs.length > 0 && `(${auditLogs.length})`}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {activeTab === null && (
            <div className="rounded-lg border border-dashed border-[var(--color-hairline)] p-5 text-center text-[var(--color-mute)] space-y-2 bg-[var(--color-canvas)]">
              <p className="font-semibold text-xs text-[var(--color-ink)]">Select an Operational Tab</p>
              <p className="text-[11px] text-[var(--color-mute)]">
                Machines, Running Logs, Assignments, History, and Audit load independently on tab selection.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleTabChange("machines")}
                  className="px-2.5 py-1.5 rounded border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] font-semibold text-[11px] text-[var(--color-ink)] hover:border-sky-500 cursor-pointer"
                >
                  Machines
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("logs")}
                  className="px-2.5 py-1.5 rounded border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] font-semibold text-[11px] text-[var(--color-ink)] hover:border-emerald-500 cursor-pointer"
                >
                  Running Logs
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("assignments")}
                  className="px-2.5 py-1.5 rounded border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] font-semibold text-[11px] text-[var(--color-ink)] hover:border-purple-500 cursor-pointer"
                >
                  Assignments
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("history")}
                  className="px-2.5 py-1.5 rounded border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] font-semibold text-[11px] text-[var(--color-ink)] hover:border-amber-500 cursor-pointer"
                >
                  History
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("audit")}
                  className="px-2.5 py-1.5 rounded border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] font-semibold text-[11px] text-[var(--color-ink)] hover:border-sky-500 cursor-pointer"
                >
                  Audit
                </button>
              </div>
            </div>
          )}

          {activeTab === "machines" && (
            <div className="space-y-2">
              {loadingTab === "machines" ? (
                <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--color-mute)]">
                  <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                  <span>Loading equipment roster...</span>
                </div>
              ) : machines.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--color-mute)]">No machines currently deployed.</p>
              ) : (
                machines.map((m) => (
                  <div key={m.id} className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-sky-600">{m.machine_id}</span>
                      <span className="text-[11px] text-[var(--color-mute)] ml-2">{m.model}</span>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700">
                      {m.status.toUpperCase()}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "logs" && (
            <div className="space-y-2">
              {loadingTab === "logs" ? (
                <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--color-mute)]">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                  <span>Loading running logs...</span>
                </div>
              ) : runningLogs.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--color-mute)]">No running logs recorded.</p>
              ) : (
                runningLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-sky-600">{log.machine_code}</span>
                      <span className="text-[10px] text-[var(--color-mute)] ml-2">{log.log_date}</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-600">{log.running_hours} hrs</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "assignments" && (
            <div className="space-y-2">
              {loadingTab === "assignments" ? (
                <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--color-mute)]">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  <span>Loading assignments...</span>
                </div>
              ) : assignments.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--color-mute)]">No operator assignments found.</p>
              ) : (
                assignments.map((a) => (
                  <div key={a.id} className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-[var(--color-ink)]">{a.operator_name}</span>
                      <span className="font-mono text-sky-600 text-[10px] ml-2">{a.machine_code}</span>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700">
                      {a.is_active ? "ACTIVE" : "ENDED"}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-2">
              {loadingTab === "history" ? (
                <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--color-mute)]">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                  <span>Loading history...</span>
                </div>
              ) : history.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--color-mute)]">No timeline events recorded.</p>
              ) : (
                history.map((h) => (
                  <div key={h.id} className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--color-ink)]">{h.title}</span>
                      <span className="text-[10px] text-[var(--color-mute)]">{new Date(h.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[var(--color-body)] text-[11px] pt-1">{h.description}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "audit" && (
            <div className="space-y-2">
              {loadingTab === "audit" ? (
                <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--color-mute)]">
                  <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                  <span>Loading audit logs...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--color-mute)]">No audit entries found.</p>
              ) : (
                auditLogs.map((a) => (
                  <div key={a.id} className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-sky-600">{a.action}</span>
                      <span className="text-[10px] text-[var(--color-mute)] ml-2">{new Date(a.created_at).toLocaleDateString()}</span>
                    </div>
                    <span className="text-[10px] text-[var(--color-mute)]">{a.actor_name}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-[var(--color-hairline)] p-4 bg-[var(--color-canvas)]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] px-4 py-2 text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
          >
            Close Overview
          </button>
        </div>
      </div>
    </div>
  );
}
