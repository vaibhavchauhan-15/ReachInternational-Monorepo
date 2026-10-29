"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ShieldCheck, MapPin, Loader2, AlertCircle, Building2 } from "lucide-react";
import { AssignmentDialog } from "./AssignmentDialog";
import { AssignmentActions } from "./AssignmentActions";
import { UserSelect, type UserSelectItem } from "@/components/ui/UserSelect";
import { ClientSelect, type ClientSelectItem } from "@/components/ui/ClientSelect";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import {
  getAvailableSupervisorsAction,
  assignClientSupervisorAction,
} from "@/app/actions/client-supervisors";
import { getClientSitesAction } from "@/app/actions/client-sites";
import { getClientOptionsAction } from "@/app/actions/clients";
import type { CandidateSupervisorItem, ClientSupervisorItem } from "@/lib/data/clients";
import type { ClientSite } from "@/lib/data/clients/client-sites";
import { formatEmployeeId } from "@reachinternational/utils";

export interface AssignSupervisorToClientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientId?: string;
  clientName?: string;
  clientCode?: string;
  initialSites?: ClientSite[];
  clients?: ClientSelectItem[];
  onSuccess: (newAssignment: ClientSupervisorItem) => void;
  onError?: (errorMessage: string) => void;
}

/**
 * Reusable AssignSupervisorToClientDialog
 *
 * Allows assigning eligible supervisors to any client account with:
 * - Dynamic client dropdown selection with client name and below-name small client ID
 * - Dynamic site selection scoping
 * - Supervisor selection with standardized employee IDs (EMP-001)
 * - Full mobile viewport touch optimization (min 44px targets, responsive layout)
 */
export function AssignSupervisorToClientDialog({
  isOpen,
  onClose,
  clientId: initialClientId = "",
  clientName: initialClientName = "",
  clientCode: initialClientCode = "",
  initialSites = [],
  clients: initialClients = [],
  onSuccess,
  onError,
}: AssignSupervisorToClientDialogProps) {
  const { toast } = useToast();

  // Selected client state
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId);
  const [selectedClientName, setSelectedClientName] = useState<string>(initialClientName);
  const [selectedClientCode, setSelectedClientCode] = useState<string>(initialClientCode);

  // Available clients list
  const [clientList, setClientList] = useState<ClientSelectItem[]>(() => {
    if (initialClients && initialClients.length > 0) return initialClients;
    if (initialClientId) {
      return [
        {
          id: initialClientId,
          company_name: initialClientName || "Client",
          client_name: initialClientName || "Client",
          code: initialClientCode || undefined,
          client_id: initialClientCode || undefined,
        },
      ];
    }
    return [];
  });
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  // Candidates & sites
  const [candidates, setCandidates] = useState<CandidateSupervisorItem[]>([]);
  const [sites, setSites] = useState<ClientSite[]>(initialSites);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [isLoadingSites, setIsLoadingSites] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Synchronize when initial props change
  useEffect(() => {
    if (initialClientId) {
      setSelectedClientId(initialClientId);
      setSelectedClientName(initialClientName);
      setSelectedClientCode(initialClientCode);
      if (initialClients && initialClients.length > 0) {
        setClientList(initialClients);
      } else {
        setClientList((prev) => {
          if (prev.some((c) => c.id === initialClientId)) return prev;
          return [
            {
              id: initialClientId,
              company_name: initialClientName || "Client",
              client_name: initialClientName || "Client",
              code: initialClientCode || undefined,
              client_id: initialClientCode || undefined,
            },
            ...prev,
          ];
        });
      }
    }
  }, [initialClientId, initialClientName, initialClientCode, initialClients]);

  // Load client directory list for dropdown if not supplied
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    if (clientList.length <= 1) {
      setIsLoadingClients(true);
      getClientOptionsAction()
        .then((options) => {
          if (!mounted) return;
          const mapped: ClientSelectItem[] = (options || []).map((o) => ({
            id: o.id,
            company_name: o.company_name || o.client_name || "Client",
            client_name: o.client_name || o.company_name || "Client",
            code: o.code,
            client_id: o.code,
            city: o.city,
            state: o.state,
            address: o.address,
            phone: o.phone,
          }));
          setClientList(mapped);

          // If a clientId was preselected, update its name/code if not already set
          if (selectedClientId) {
            const found = mapped.find((m) => m.id === selectedClientId);
            if (found) {
              setSelectedClientName(found.company_name || found.client_name || "Client");
              setSelectedClientCode(found.code || found.client_id || "");
            }
          }
        })
        .catch(() => {
          // Non-blocking fallback
        })
        .finally(() => {
          if (mounted) setIsLoadingClients(false);
        });
    }

    return () => {
      mounted = false;
    };
  }, [isOpen, clientList.length, selectedClientId]);

  // Fetch candidate supervisors and sites whenever selectedClientId changes
  useEffect(() => {
    if (!isOpen || !selectedClientId) {
      setCandidates([]);
      setSites([]);
      setSelectedSupervisorId("");
      setSelectedSiteId("");
      return;
    }

    let mounted = true;
    setIsLoadingCandidates(true);
    setFetchError(null);
    setSubmitError(null);
    setSelectedSupervisorId("");
    setSelectedSiteId("");

    // Load candidate supervisors for the selected client
    getAvailableSupervisorsAction(selectedClientId)
      .then((data) => {
        if (!mounted) return;
        setCandidates(data || []);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : "Failed to load candidate supervisors";
        setFetchError(msg);
      })
      .finally(() => {
        if (mounted) setIsLoadingCandidates(false);
      });

    // Load client sites
    setIsLoadingSites(true);
    getClientSitesAction(selectedClientId)
      .then((siteList) => {
        if (!mounted) return;
        setSites(siteList || []);
      })
      .catch(() => {
        if (mounted) setSites([]);
      })
      .finally(() => {
        if (mounted) setIsLoadingSites(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, selectedClientId]);

  // Transform candidates to standardized UserSelect items with EMP-001 format
  const supervisorUsers: UserSelectItem[] = useMemo(() => {
    return candidates.map((c, index) => {
      const empId = c.employee_id
        ? formatEmployeeId(c.employee_id)
        : `EMP-${String(index + 1).padStart(3, "0")}`;
      return {
        id: c.id,
        full_name: c.full_name || "Supervisor",
        name: c.full_name,
        employee_id: empId,
        emp_id: empId,
        phone: c.phone || null,
        email: c.email || null,
        role: "supervisor",
        status: "active",
        badge: "Eligible",
        badgeVariant: "success",
      };
    });
  }, [candidates]);

  // Site dropdown options
  const siteOptions = useMemo(() => {
    return [
      { value: "", label: "All Sites (Full Client Access)" },
      ...sites.map((s) => ({
        value: s.id,
        label: `${s.site_name} (${s.site_code})${s.city ? ` — ${s.city}` : ""}`,
      })),
    ];
  }, [sites]);

  const hasChanges = Boolean(selectedSupervisorId && selectedClientId);
  const isButtonDisabled =
    !hasChanges ||
    !selectedSupervisorId ||
    !selectedClientId ||
    isSubmitting ||
    candidates.length === 0;

  const handleSubmit = useCallback(async () => {
    if (!selectedSupervisorId || !selectedClientId || isSubmitting) return;

    const candidate = candidates.find((c) => c.id === selectedSupervisorId);
    if (!candidate) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await assignClientSupervisorAction({
        clientId: selectedClientId,
        supervisorId: selectedSupervisorId,
      });

      if (res.error) {
        setSubmitError(res.error);
        onError?.(res.error);
        toast("error", "Failed to assign supervisor", res.error);
        return;
      }

      if (res.data) {
        const siteLabel = sites.find((s) => s.id === selectedSiteId)?.site_name;
        const targetClientLabel = selectedClientName || "Client";
        toast(
          "success",
          "Supervisor assigned",
          siteLabel
            ? `${candidate.full_name} assigned to ${targetClientLabel} (${siteLabel}).`
            : `${candidate.full_name} is now supervising ${targetClientLabel}.`
        );
        onSuccess(res.data);
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to assign supervisor to client.";
      setSubmitError(msg);
      onError?.(msg);
      toast("error", "Assignment failed", msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedSupervisorId,
    selectedClientId,
    selectedSiteId,
    selectedClientName,
    isSubmitting,
    candidates,
    sites,
    onSuccess,
    onError,
    onClose,
    toast,
  ]);

  return (
    <AssignmentDialog
      open={isOpen}
      onClose={onClose}
      title="Assign Client Supervisor"
      showCodeInHeader={false}
      size="md"
      footer={
        <AssignmentActions
          onCancel={onClose}
          onSubmit={handleSubmit}
          isSaving={isSubmitting}
          isDirty={false}
          showDirtyNotice={false}
          disabled={isButtonDisabled}
          submitLabel={isSubmitting ? "Assigning Supervisor..." : "Assign Supervisor"}
          cancelLabel="Cancel"
          errorMessage={submitError}
        />
      }
    >
      {/* Fetch Error notice */}
      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* 1. Client Selection Dropdown (Shows client name, and below name client ID with small text) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--color-ink)] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-[var(--color-mute)]" />
              <span>Client Account</span>
            </span>
            <span className="text-[10px] text-[var(--color-mute)] font-normal">
              {clientList.length > 0 ? `${clientList.length} clients` : "Select client"}
            </span>
          </label>
          <ClientSelect
            clients={clientList}
            value={selectedClientId}
            onChange={(newClientId, clientItem) => {
              setSelectedClientId(newClientId);
              if (clientItem) {
                setSelectedClientName(clientItem.company_name || clientItem.client_name || "Client");
                setSelectedClientCode(clientItem.code || clientItem.client_id || "");
              }
              setSubmitError(null);
            }}
            placeholder={isLoadingClients ? "Loading clients..." : "Search and select client..."}
            disabled={isLoadingClients || isSubmitting}
            required
          />
        </div>

        {/* Loading Candidates State */}
        {isLoadingCandidates ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-[var(--color-mute)]">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
            <span>Loading eligible active supervisors for client...</span>
          </div>
        ) : !selectedClientId ? (
          <div className="py-6 text-center text-xs text-[var(--color-mute)] rounded-xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/30">
            <Building2 className="h-7 w-7 mx-auto text-[var(--color-mute)] mb-1" />
            <p className="font-semibold text-xs text-[var(--color-ink)]">
              No Client Selected
            </p>
            <p className="text-[11px] mt-0.5">
              Please choose a client account above to view available supervisors.
            </p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--color-mute)] space-y-1.5 rounded-xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/30 p-3">
            <ShieldCheck className="h-7 w-7 mx-auto text-emerald-500 mb-1" />
            <p className="font-semibold text-sm text-[var(--color-ink)]">
              All Eligible Supervisors Already Assigned
            </p>
            <p className="max-w-xs mx-auto text-[11px]">
              Every active supervisor in the organization currently has oversight over this client account.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 2. Client Site Selection Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--color-ink)] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[var(--color-mute)]" />
                  <span>Client Site Assignment</span>
                </span>
                <span className="text-[10px] text-[var(--color-mute)] font-normal">
                  {sites.length > 0 ? `${sites.length} site${sites.length === 1 ? "" : "s"} available` : "No specific sites"}
                </span>
              </label>
              <Select
                value={selectedSiteId}
                onChange={(val) => {
                  const nextVal = typeof val === "string" ? val : val?.target?.value || "";
                  setSelectedSiteId(nextVal);
                  setSubmitError(null);
                }}
                options={siteOptions}
                placeholder={isLoadingSites ? "Loading client sites..." : "Select client site..."}
                disabled={isLoadingSites || isSubmitting}
              />
              <p className="text-[11px] text-[var(--color-mute)]">
                {selectedSiteId
                  ? "Supervisor will oversee operational shifts and equipment at this specific site."
                  : "Supervisor will have access across all operational sites under this client."}
              </p>
            </div>

            {/* 3. Supervisor Selection Dropdown (UserSelect showing EMP-001) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--color-ink)] flex items-center justify-between">
                <span>Supervisor</span>
                <span className="text-[10px] text-[var(--color-mute)] font-normal">
                  {candidates.length} eligible supervisor{candidates.length === 1 ? "" : "s"}
                </span>
              </label>
              <UserSelect
                users={supervisorUsers}
                value={selectedSupervisorId}
                onChange={(userId) => {
                  setSelectedSupervisorId(userId);
                  setSubmitError(null);
                }}
                placeholder="Search and select supervisor..."
                disabled={isSubmitting || candidates.length === 0}
                required
              />
            </div>
          </div>
        )}
      </div>
    </AssignmentDialog>
  );
}
