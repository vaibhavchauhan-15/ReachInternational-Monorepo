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
 * - Idempotency & duplicate submission locking via savingRef
 * - Dropdown client selection with client name on top and small client ID below
 * - Standardized EMP-001 employee IDs for supervisor candidates
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { AssignmentBottomSheet, TargetEntityDetails } from './AssignmentBottomSheet';
import { AssignmentSearchInput } from './AssignmentSearchInput';
import { AssignmentSelectableList, AssignmentCandidateItem } from './AssignmentSelectableList';
import {
  AssignmentSelectionSummary,
  SelectedAssignmentSummaryItem,
} from './AssignmentSelectionSummary';
import { AssignmentActionBar } from './AssignmentActionBar';
import { SearchableSelect, SelectOption } from '../ui/SearchableSelect';
import { Text } from '../ui/Text';
import { useTheme } from '../ui/ThemeProvider';
import { useToast } from '../ui';
import { haptics } from '../../lib/haptics';
import {
  useEligibleClientSupervisors,
  CandidateSupervisorItem,
  useClientDetailData,
} from '../../lib/hooks/useClientDetailData';
import { supabase } from '../../lib/supabase';
import { Plus, Users, ShieldCheck, X, Building2 } from '../ui/icon';
import { Pressable } from '../ui/touch/Pressable';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface AssignSupervisorToClientModalProps {
  visible: boolean;
  clientId?: string;
  clientName?: string;
  clientCode?: string;
  onClose: () => void;
  onSuccess?: (assignedSupervisor: CandidateSupervisorItem) => void;
}

export const AssignSupervisorToClientModal: React.FC<AssignSupervisorToClientModalProps> = ({
  visible,
  clientId: initialClientId = '',
  clientName: initialClientName = '',
  clientCode: initialClientCode = '',
  onClose,
  onSuccess,
}) => {
  const { theme, isDark } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId);
  const [selectedClientName, setSelectedClientName] = useState<string>(initialClientName);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('');
  const [isAddingSupervisor, setIsAddingSupervisor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const savingRef = useRef(false);

  // Synchronize when initial props change
  useEffect(() => {
    if (initialClientId) {
      setSelectedClientId(initialClientId);
      setSelectedClientName(initialClientName);
    }
  }, [initialClientId, initialClientName]);

  // Fetch full active client options for the reusable client dropdown
  const { data: clientOptions = [] } = useQuery<Array<{ id: string; company_name: string; code?: string }>>({
    queryKey: ['clientDropdownOptions'],
    enabled: visible,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, code')
        .is('deleted_at', null)
        .order('company_name', { ascending: true });

      if (error || !data) return [];
      return data as Array<{ id: string; company_name: string; code?: string }>;
    },
  });

  // Transform clients to dropdown options (showing name, and below name showing small client ID)
  const clientSelectOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = clientOptions.map((c) => ({
      value: c.id,
      label: c.company_name || 'Client',
      description: c.code || undefined,
      code: c.code || undefined,
    }));

    if (initialClientId && !list.some((item) => item.value === initialClientId)) {
      list.unshift({
        value: initialClientId,
        label: initialClientName || 'Client',
        description: initialClientCode || undefined,
        code: initialClientCode || undefined,
      });
    }

    return list;
  }, [clientOptions, initialClientId, initialClientName, initialClientCode]);

  // Fetch candidate supervisors (active supervisors not yet assigned to the selected client)
  const {
    data: candidates = [],
    isLoading: isLoadingCandidates,
    refetch: refetchCandidates,
  } = useEligibleClientSupervisors(visible && selectedClientId ? selectedClientId : undefined);

  // Pull assign mutation, removal, and currently assigned supervisors from client detail hook
  const {
    assignSupervisor,
    supervisors: currentlyAssignedSupervisors = [],
    removeSupervisor,
  } = useClientDetailData(selectedClientId || '');

  // Reset state on open
  useEffect(() => {
    if (visible) {
      savingRef.current = false;
      setSearchQuery('');
      setSelectedSupervisorId('');
      setIsAddingSupervisor(false);
      setIsSubmitting(false);
      setSubmitError(null);
      if (initialClientId) {
        setSelectedClientId(initialClientId);
        setSelectedClientName(initialClientName);
      }
      refetchCandidates();
    }
  }, [visible, initialClientId, initialClientName, refetchCandidates]);

  // Handle removing an existing client supervisor
  const handleRemoveAssigned = useCallback(
    async (item: SelectedAssignmentSummaryItem) => {
      if (!selectedClientId || isSubmitting) return;

      try {
        setIsSubmitting(true);
        await removeSupervisor({ supervisorId: item.id });
        haptics.confirm();
        toast('success', 'Supervisor Removed', `Removed ${item.title} from ${selectedClientName || 'Client'}.`);
        refetchCandidates();
      } catch (err: any) {
        haptics.reject();
        toast('error', 'Removal Failed', err.message || 'Unable to remove supervisor.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedClientId, isSubmitting, removeSupervisor, selectedClientName, refetchCandidates, toast]
  );

  // Filter candidates by search term and format employee IDs like EMP-001
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
      .map((c, index) => {
        const empId = c.employee_id
          ? (c.employee_id.startsWith('EMP-') ? c.employee_id : `EMP-${c.employee_id.padStart(3, '0')}`)
          : `EMP-${String(index + 1).padStart(3, '0')}`;
        return {
          id: c.id,
          title: c.full_name,
          code: empId,
          subtitle: `${empId} • ${c.phone || 'Available Active Supervisor'}`,
          phone: c.phone || null,
          email: c.email || null,
          entityType: 'user',
        };
      });
  }, [candidates, searchQuery]);

  // Selected candidate object
  const selectedCandidate = useMemo(() => {
    return candidates.find((c) => c.id === selectedSupervisorId) || null;
  }, [candidates, selectedSupervisorId]);

  // Submit assignment mutation
  const handleConfirmAssignment = useCallback(async () => {
    if (!selectedSupervisorId || !selectedClientId || savingRef.current || isSubmitting) return;

    savingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    // Snapshot cache for rollback
    const previousSupervisors = queryClient.getQueryData(['clientDetail', selectedClientId, 'supervisors']);

    try {
      await assignSupervisor({ supervisorId: selectedSupervisorId });

      haptics.confirm();
      toast(
        'success',
        'Supervisor Assigned',
        `${selectedCandidate?.full_name || 'Supervisor'} now oversees all machinery under ${selectedClientName || 'Client'}.`
      );

      if (selectedCandidate) {
        onSuccess?.(selectedCandidate);
      }
      onClose();
    } catch (err: any) {
      if (previousSupervisors) {
        queryClient.setQueryData(['clientDetail', selectedClientId, 'supervisors'], previousSupervisors);
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
    selectedClientId,
    isSubmitting,
    assignSupervisor,
    selectedCandidate,
    selectedClientName,
    onSuccess,
    onClose,
    toast,
    queryClient,
  ]);

  const targetEntity: TargetEntityDetails = {
    type: 'client',
    title: selectedClientName || 'Client Account',
    subtitle: `${currentlyAssignedSupervisors.length} active supervisor${currentlyAssignedSupervisors.length === 1 ? '' : 's'}`,
    inheritedNotice: {
      clientName: selectedClientName,
      message:
        'Supervisors assigned to this client account automatically inherit operational oversight over all fleet equipment and shift logs deployed for this client.',
    },
  };

  return (
    <AssignmentBottomSheet
      visible={visible}
      onClose={onClose}
      title="Assign Client Supervisor"
      showCodeInHeader={false}
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
      {/* 1. Client Selection Dropdown (Shows client name, and below name client ID with small text) */}
      <View style={styles.clientSelectSection}>
        <SearchableSelect
          label="Client Account"
          required
          options={clientSelectOptions}
          value={selectedClientId}
          onChange={(newClientId, option) => {
            haptics.select();
            setSelectedClientId(newClientId);
            if (option) {
              setSelectedClientName(option.label);
            }
            setSelectedSupervisorId('');
            setIsAddingSupervisor(false);
            setSubmitError(null);
          }}
          placeholder="Select client account..."
          searchable
          disabled={isSubmitting}
        />
      </View>

      {/* 2. Currently Assigned Client Supervisors */}
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

      {/* 3. Add Supervisor Accordion / Candidate Selector */}
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

            {/* Candidate Selectable List with EMP-001 formatting */}
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
  clientSelectSection: {
    marginBottom: spacingNumeric.sm,
  },
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
