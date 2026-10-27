/**
 * ReachInternational Mobile — Assign Supervisor to Client Modal
 *
 * Bottom-sheet modal to assign active supervisors directly to a client account.
 * Implements inherited client-level RBAC: supervisors assigned at the client level
 * inherit operational oversight over all fleet equipment and operator assignments
 * belonging to this client without requiring redundant per-machine assignments.
 *
 * Invariants:
 * - Minimum 44px touch targets
 * - Zero raw typography properties in StyleSheet.create
 * - Vercel Geist design tokens and Light/Dark theme synchronization
 * - TanStack Query cache invalidation and atomic RPC backend execution
 * - Idempotency & duplicate submission locking
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { AssignmentBottomSheet, TargetEntityDetails } from './AssignmentBottomSheet';
import { AssignmentSearchInput } from './AssignmentSearchInput';
import { AssignmentSelectableList, AssignmentCandidateItem } from './AssignmentSelectableList';
import {
  AssignmentSelectionSummary,
  SelectedAssignmentSummaryItem,
} from './AssignmentSelectionSummary';
import { AssignmentActionBar } from './AssignmentActionBar';
import { Text } from '../ui/Text';
import { useTheme } from '../ui/ThemeProvider';
import { useToast } from '../ui';
import { haptics } from '../../lib/haptics';
import {
  useEligibleClientSupervisors,
  CandidateSupervisorItem,
  useClientDetailData,
} from '../../lib/hooks/useClientDetailData';
import { Plus, Users, ShieldCheck, X } from '../ui/icon';
import { Pressable } from '../ui/touch/Pressable';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface AssignSupervisorToClientModalProps {
  visible: boolean;
  clientId: string;
  clientName: string;
  onClose: () => void;
  onSuccess?: (assignedSupervisor: CandidateSupervisorItem) => void;
}

export const AssignSupervisorToClientModal: React.FC<AssignSupervisorToClientModalProps> = ({
  visible,
  clientId,
  clientName,
  onClose,
  onSuccess,
}) => {
  const { theme, isDark } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('');
  const [isAddingSupervisor, setIsAddingSupervisor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const savingRef = useRef(false);

  // Fetch candidate supervisors (active supervisors not yet assigned to this client)
  const {
    data: candidates = [],
    isLoading: isLoadingCandidates,
    refetch: refetchCandidates,
  } = useEligibleClientSupervisors(visible ? clientId : undefined);

  // Pull assign mutation, removal, and currently assigned supervisors from client detail hook
  const {
    assignSupervisor,
    supervisors: currentlyAssignedSupervisors = [],
    removeSupervisor,
  } = useClientDetailData(clientId);

  // Reset state on open
  useEffect(() => {
    if (visible) {
      savingRef.current = false;
      setSearchQuery('');
      setSelectedSupervisorId('');
      setIsAddingSupervisor(false);
      setIsSubmitting(false);
      setSubmitError(null);
      refetchCandidates();
    }
  }, [visible, refetchCandidates]);

  // Handle removing an existing client supervisor
  const handleRemoveAssigned = useCallback(
    async (item: SelectedAssignmentSummaryItem) => {
      if (!clientId || isSubmitting) return;

      try {
        setIsSubmitting(true);
        await removeSupervisor({ supervisorId: item.id });
        haptics.confirm();
        toast('success', 'Supervisor Removed', `Removed ${item.title} from ${clientName}.`);
        refetchCandidates();
      } catch (err: any) {
        haptics.reject();
        toast('error', 'Removal Failed', err.message || 'Unable to remove supervisor.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [clientId, isSubmitting, removeSupervisor, clientName, refetchCandidates, toast]
  );

  // Filter candidates by search term
  const candidateItems = useMemo((): AssignmentCandidateItem[] => {
    const q = searchQuery.toLowerCase().trim();
    return candidates
      .filter((c) => {
        if (!q) return true;
        const matchName = c.full_name?.toLowerCase().includes(q);
        const matchEmpId = c.employee_id?.toLowerCase().includes(q);
        const matchPhone = c.phone?.toLowerCase().includes(q);
        return Boolean(matchName || matchEmpId || matchPhone);
      })
      .map((c) => ({
        id: c.id,
        title: c.full_name,
        code: c.employee_id || null,
        subtitle: c.phone || 'Available Active Supervisor',
        phone: c.phone || null,
        email: c.email || null,
        entityType: 'user',
      }));
  }, [candidates, searchQuery]);

  // Selected candidate object
  const selectedCandidate = useMemo(() => {
    return candidates.find((c) => c.id === selectedSupervisorId) || null;
  }, [candidates, selectedSupervisorId]);

  // Submit assignment mutation
  const handleConfirmAssignment = useCallback(async () => {
    if (!selectedSupervisorId || !clientId || savingRef.current || isSubmitting) return;

    savingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    // Snapshot cache for rollback
    const previousSupervisors = queryClient.getQueryData(['clientDetail', clientId, 'supervisors']);

    try {
      await assignSupervisor({ supervisorId: selectedSupervisorId });

      haptics.confirm();
      toast(
        'success',
        'Supervisor Assigned',
        `${selectedCandidate?.full_name || 'Supervisor'} now oversees all machinery under ${clientName}.`
      );

      if (selectedCandidate) {
        onSuccess?.(selectedCandidate);
      }
      onClose();
    } catch (err: any) {
      if (previousSupervisors) {
        queryClient.setQueryData(['clientDetail', clientId, 'supervisors'], previousSupervisors);
      }
      haptics.reject();
      const msg = err?.message || 'Failed to assign supervisor.';
      setSubmitError(msg);
      toast('error', 'Assignment Failed', msg);
    } finally {
      savingRef.current = false;
      setIsSubmitting(false);
    }
  }, [
    selectedSupervisorId,
    clientId,
    isSubmitting,
    assignSupervisor,
    selectedCandidate,
    clientName,
    onSuccess,
    onClose,
    toast,
    queryClient,
  ]);

  const targetEntity: TargetEntityDetails = {
    type: 'client',
    title: clientName,
    code: 'CLIENT',
    subtitle: `${currentlyAssignedSupervisors.length} active supervisor${currentlyAssignedSupervisors.length === 1 ? '' : 's'}`,
    inheritedNotice: {
      clientName,
      message:
        'Supervisors assigned to this client account automatically inherit operational oversight over all fleet equipment and shift logs deployed for this client.',
    },
  };

  return (
    <AssignmentBottomSheet
      visible={visible}
      onClose={onClose}
      title="Assign Client Supervisor"
      description="Grant client-level fleet oversight to active supervisors"
      targetEntity={targetEntity}
      footer={
        selectedSupervisorId ? (
          <AssignmentActionBar
            onSave={handleConfirmAssignment}
            onCancel={onClose}
            saveLabel={`Assign ${selectedCandidate?.full_name?.split(' ')[0] || 'Supervisor'}`}
            isSaving={isSubmitting}
            hasUnsavedChanges={Boolean(selectedSupervisorId)}
            error={submitError}
            disabled={!selectedSupervisorId || isSubmitting}
          />
        ) : null
      }
    >
      {/* 1. Currently Assigned Client Supervisors */}
      <AssignmentSelectionSummary
        items={currentlyAssignedSupervisors.map((s) => ({
          id: s.supervisor_id,
          title: s.supervisor_name,
          subtitle: s.supervisor_phone || s.supervisor_email || 'Client Supervisor',
          entityType: 'user',
        }))}
        onRemove={handleRemoveAssigned}
        maxCapacity={10}
        title="CURRENTLY ASSIGNED CLIENT SUPERVISORS"
        capacityLabel={`${currentlyAssignedSupervisors.length} Assigned`}
        disabled={isSubmitting}
      />

      {/* 2. Add Supervisor Accordion / Candidate Selector */}
      <View style={styles.addSectionContainer}>
        {!isAddingSupervisor && !selectedSupervisorId ? (
          <Pressable
            onPress={() => {
              haptics.select();
              setIsAddingSupervisor(true);
            }}
            style={[
              styles.addSupervisorTrigger,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add another supervisor to this client"
          >
            <Plus size={16} color={theme.colors.primary} />
            <Text variant="body" weight="semibold" style={{ color: theme.colors.primary }}>
              + Assign Another Supervisor
            </Text>
          </Pressable>
        ) : (
          <View
            style={[
              styles.accordionCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={styles.accordionHeader}>
              <View style={styles.accordionTitleRow}>
                <ShieldCheck size={16} color={theme.colors.primary} />
                <Text variant="subheading" weight="semibold" style={{ color: theme.colors.ink }}>
                  Select Eligible Supervisor
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setIsAddingSupervisor(false);
                  setSelectedSupervisorId('');
                }}
                hitSlop={10}
                accessibilityRole="button"
              >
                <X size={16} color={theme.colors.mute} />
              </Pressable>
            </View>

            {/* Candidate Search */}
            <AssignmentSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search supervisors by name or employee ID..."
              count={candidateItems.length}
              totalCount={candidates.length}
            />

            {/* Candidate Selectable List */}
            <AssignmentSelectableList
              candidates={candidateItems}
              selectedIds={selectedSupervisorId ? [selectedSupervisorId] : []}
              onSelect={(id) => setSelectedSupervisorId((prev) => (prev === id ? '' : id))}
              selectionMode="single"
              isLoading={isLoadingCandidates}
              emptyTitle="No eligible supervisors"
              emptyDescription="All active supervisors are already assigned to this client or none match your search."
            />
          </View>
        )}
      </View>
    </AssignmentBottomSheet>
  );
};

const styles = StyleSheet.create({
  addSectionContainer: {
    marginTop: spacingNumeric.xs,
  },
  addSupervisorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    minHeight: 48,
    gap: spacingNumeric.sm,
  },
  accordionCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accordionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
});
