"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ShieldCheck, UserCheck, AlertCircle, Loader2 } from "lucide-react";
import { AssignmentDialog } from "./AssignmentDialog";
import { AssignmentSearch } from "./AssignmentSearch";
import { AssignmentSelectableList, type AssignmentCandidateItem } from "./AssignmentSelectableList";
import { AssignmentActions } from "./AssignmentActions";
import { useToast } from "@/components/ui/Toast";
import {
  getAvailableSupervisorsAction,
  assignClientSupervisorAction,
} from "@/app/actions/client-supervisors";
import type { CandidateSupervisorItem, ClientSupervisorItem } from "@/lib/data/clients";
import { getUserInitials, formatEmployeeId } from "@reachinternational/utils";

export interface AssignSupervisorToClientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  clientCode?: string;
  onSuccess: (newAssignment: ClientSupervisorItem) => void;
  onError?: (errorMessage: string) => void;
}

export function AssignSupervisorToClientDialog({
  isOpen,
  onClose,
  clientId,
  clientName,
  clientCode,
  onSuccess,
  onError,
}: AssignSupervisorToClientDialogProps) {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<CandidateSupervisorItem[]>([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch candidates on modal open
  useEffect(() => {
    if (!isOpen || !clientId) return;

    let mounted = true;
    setIsLoadingCandidates(true);
    setFetchError(null);
    setSubmitError(null);
    setSelectedSupervisorId("");
    setSearchQuery("");

    getAvailableSupervisorsAction(clientId)
      .then((data) => {
        if (!mounted) return;
        setCandidates(data || []);
        if (data && data.length > 0) {
          setSelectedSupervisorId(data[0].id);
        }
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : "Failed to load candidate supervisors";
        setFetchError(msg);
      })
      .finally(() => {
        if (mounted) setIsLoadingCandidates(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, clientId]);

  // Filter candidates by search term
  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => {
      const name = (c.full_name || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const empId = formatEmployeeId(c.id).toLowerCase();
      return name.includes(q) || phone.includes(q) || email.includes(q) || empId.includes(q);
    });
  }, [candidates, searchQuery]);

  const candidateItems: AssignmentCandidateItem[] = useMemo(() => {
    return filteredCandidates.map((c) => ({
      id: c.id,
      title: c.full_name || "Supervisor",
      subtitle: formatEmployeeId(c.id),
      phone: c.phone || null,
      email: c.email || null,
      role: "Supervisor",
      avatarInitials: getUserInitials(c.full_name),
      statusBadge: {
        label: "Eligible",
        variant: "success",
      },
    }));
  }, [filteredCandidates]);

  const handleSelectCandidate = (item: AssignmentCandidateItem) => {
    setSelectedSupervisorId(item.id);
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (!selectedSupervisorId || !clientId || isSubmitting) return;

    const candidate = candidates.find((c) => c.id === selectedSupervisorId);
    if (!candidate) return;

    setIsSubmitting(true);
    setSubmitError(null);

    // Optimistic assignment snapshot for rollback if needed
    const optimisticAssignment: ClientSupervisorItem = {
      id: `opt-${Date.now()}`,
      client_id: clientId,
      supervisor_id: candidate.id,
      supervisor_name: candidate.full_name,
      supervisor_phone: candidate.phone || null,
      supervisor_email: candidate.email || null,
      assigned_at: new Date().toISOString(),
      assigned_by: null,
    };

    try {
      const res = await assignClientSupervisorAction({
        clientId,
        supervisorId: selectedSupervisorId,
      });

      if (res.error) {
        setSubmitError(res.error);
        onError?.(res.error);
        toast("error", "Failed to assign supervisor", res.error);
        return;
      }

      if (res.data) {
        toast("success", "Supervisor assigned", `${candidate.full_name} is now supervising ${clientName}.`);
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
  };

  return (
    <AssignmentDialog
      open={isOpen}
      onClose={onClose}
      title="Assign Client Supervisor"
      description={`Grant operational oversight over equipment and operator shifts belonging to ${clientName}.`}
      size="md"
      targetEntity={{
        type: "client",
        title: clientName,
        code: clientCode,
        subtitle: "Client Account",
      }}
      footer={
        <AssignmentActions
          onCancel={onClose}
          onSubmit={handleSubmit}
          isSaving={isSubmitting}
          isDirty={Boolean(selectedSupervisorId)}
          disabled={!selectedSupervisorId || isSubmitting || candidates.length === 0}
          submitLabel={isSubmitting ? "Assigning Supervisor..." : "Assign Supervisor"}
          cancelLabel="Cancel"
          errorMessage={submitError}
        />
      }
    >
      {/* Inherited Access Callout */}
      <div className="rounded-xl border border-sky-200 dark:border-sky-800/80 bg-sky-50 dark:bg-sky-950/40 p-3.5 text-xs text-sky-900 dark:text-sky-300 space-y-1">
        <p className="font-semibold flex items-center gap-1.5 text-sky-950 dark:text-sky-200">
          <UserCheck className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <span>Inherited Operational Access</span>
        </p>
        <p className="leading-relaxed text-[11px] text-sky-800 dark:text-sky-300">
          Assigned supervisors automatically inherit operational authority over all fleet machinery and operator shifts allocated to <strong>{clientName}</strong> without requiring repetitive individual equipment assignments.
        </p>
      </div>

      {/* Fetch Error notice */}
      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoadingCandidates ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[var(--color-mute)]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
          <span>Loading eligible active supervisors...</span>
        </div>
      ) : candidates.length === 0 ? (
        <div className="py-8 text-center text-xs text-[var(--color-mute)] space-y-2 rounded-xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/30">
          <ShieldCheck className="h-8 w-8 mx-auto text-emerald-500 mb-1" />
          <p className="font-semibold text-sm text-[var(--color-ink)]">All Eligible Supervisors Already Assigned</p>
          <p className="max-w-xs mx-auto text-[11px]">
            Every active supervisor in the organization currently has oversight over this client account.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Search Box */}
          <AssignmentSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Filter eligible supervisors by name, ID, or phone..."
            totalCount={candidates.length}
            filteredCount={filteredCandidates.length}
          />

          {/* Selectable Candidates List */}
          <AssignmentSelectableList
            items={candidateItems}
            selectedIds={selectedSupervisorId ? [selectedSupervisorId] : []}
            onSelect={handleSelectCandidate}
            isMultiSelect={false}
            emptyMessage={searchQuery ? `No supervisors matching "${searchQuery}"` : "No eligible supervisors found"}
            listMaxHeight="max-h-[280px]"
          />
        </div>
      )}
    </AssignmentDialog>
  );
}
