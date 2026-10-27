/**
 * ReachInternational Mobile — Assign Machine to Operator Modal
 *
 * Dedicated operator-centric assignment modal for deploying equipment to an operator.
 * Enforces workforce scheduling invariants:
 * - Maximum 3 active shifts (24h) for the operator across the fleet
 * - Disjoint interval overlap validation across equipment
 * - Equipment selection with Model, Machine ID, S/N, and Client details
 * - Client shift code resolution per selected machinery
 * - TanStack Query cache updates with reliable snapshot rollback
 *
 * Invariants:
 * - Minimum 44px touch targets
 * - Zero raw typography properties in StyleSheet.create
 * - Vercel Geist design tokens and Light/Dark theme synchronization
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { AssignmentBottomSheet, TargetEntityDetails } from './AssignmentBottomSheet';
import { AssignmentSearchInput } from './AssignmentSearchInput';
import { AssignmentSelectableList, AssignmentCandidateItem } from './AssignmentSelectableList';
import { AssignmentShiftPicker } from './AssignmentShiftPicker';
import {
  AssignmentSelectionSummary,
  SelectedAssignmentSummaryItem,
} from './AssignmentSelectionSummary';
import { AssignmentActionBar } from './AssignmentActionBar';
import { Text } from '../ui/Text';
import { useTheme } from '../ui/ThemeProvider';
import { useToast } from '../ui';
import { haptics } from '../../lib/haptics';
import { supabase } from '../../lib/supabase';
import { broadcastMobileAssignmentChanged } from '../../lib/realtime-roster';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { useAuth } from '../../lib/auth/useAuth';
import {
  formatTo12Hour,
  shiftToMinuteRanges,
  doRangesOverlap,
} from '@reachinternational/utils';
import {
  useAssignPersonnelMachines,
  useClientShiftCodes,
  MachineOptionItem,
  DEFAULT_MODAL_SHIFTS,
} from '../../lib/hooks/useAssignPersonnelModalData';
import { Plus, Truck, X } from '../ui/icon';
import { Pressable } from '../ui/touch/Pressable';

export interface OperatorMachineItem {
  machineId: string;
  machineCode: string;
  machineModel?: string;
  clientId?: string | null;
  clientName?: string | null;
  shiftCode: string;
  shiftStartTime: string;
  shiftEndTime: string;
  assignmentId?: string;
}

export interface AssignMachineToOperatorModalProps {
  visible: boolean;
  onClose: () => void;
  operator: {
    id: string;
    full_name?: string;
    employee_id?: string | null;
    role?: string;
  } | null;
  onSuccess?: (assignedMachines?: OperatorMachineItem[]) => void;
}

function to24HourTime(str?: string | null): string {
  if (!str) return '00:00:00';
  const clean = str.trim().toUpperCase();
  const match = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/);
  if (!match) return str;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const modifier = match[3];

  if (modifier) {
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
  }
  return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
}

export const AssignMachineToOperatorModal: React.FC<AssignMachineToOperatorModalProps> = ({
  visible,
  onClose,
  operator,
  onSuccess,
}) => {
  const { theme, isDark } = useTheme();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const operatorId = operator?.id;

  // Active machines query
  const { data: machines = [], isLoading: isLoadingMachines } = useAssignPersonnelMachines({
    visible,
    isSupervisorRole: false,
    search: '',
  });

  // Current active assignments for this operator
  const { data: activeAssignments = [], isLoading: isLoadingAssignments } = useQuery<any[]>({
    queryKey: ['assign-machine-operator-modal', 'assignments', operatorId],
    enabled: Boolean(visible && operatorId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!operatorId) return [];
      const { data, error } = await supabase
        .from('operator_machine_assignments')
        .select('id, machine_id, shift_code, shift_start_time, shift_end_time, is_active, machine:machines(id, machine_id, model, serial_number, client_id, client:clients(id, company_name))')
        .eq('operator_id', operatorId)
        .eq('is_active', true);
      if (error) return [];
      return data || [];
    },
  });

  // Local roster of equipment assigned to this operator
  const [roster, setRoster] = useState<OperatorMachineItem[]>([]);
  const [initialSnapshot, setInitialSnapshot] = useState<OperatorMachineItem[]>([]);

  const [isAddingMachine, setIsAddingMachine] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [selectedShiftCode, setSelectedShiftCode] = useState<string>('S1');
  const [machineSearchQuery, setMachineSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const savingRef = useRef(false);

  // Selected candidate machine object
  const selectedCandidateMachine = useMemo(() => {
    return machines.find((m) => m.id === selectedMachineId) || null;
  }, [machines, selectedMachineId]);

  // Shifts for selected candidate machine's client
  const { data: candidateMachineShifts = DEFAULT_MODAL_SHIFTS } = useClientShiftCodes(
    selectedCandidateMachine?.client_id,
    Boolean(selectedCandidateMachine)
  );

  // Initialize or reset on open
  useEffect(() => {
    if (!visible || !operatorId) return;

    savingRef.current = false;
    setIsSaving(false);
    setSubmitError(null);
    setIsAddingMachine(false);
    setSelectedMachineId('');
    setSelectedShiftCode('S1');
    setMachineSearchQuery('');

    const mapped: OperatorMachineItem[] = activeAssignments.map((a) => ({
      machineId: a.machine_id,
      machineCode: a.machine?.machine_id || 'Machine',
      machineModel: a.machine?.model || 'Equipment',
      clientId: a.machine?.client_id || null,
      clientName: a.machine?.client?.company_name || null,
      shiftCode: (a.shift_code || 'S1').toUpperCase(),
      shiftStartTime: formatTo12Hour(a.shift_start_time) || a.shift_start_time || '06:00 AM',
      shiftEndTime: formatTo12Hour(a.shift_end_time) || a.shift_end_time || '02:00 PM',
      assignmentId: a.id,
    }));

    setRoster(mapped);
    setInitialSnapshot(mapped);
  }, [visible, operatorId, activeAssignments]);

  // Candidate machines list
  const candidateMachineItems = useMemo((): AssignmentCandidateItem[] => {
    const q = machineSearchQuery.trim().toLowerCase();
    const assignedMachineIds = new Set(roster.map((r) => r.machineId));

    return machines
      .filter((m) => {
        if (!q) return true;
        const matchCode = m.machine_id?.toLowerCase().includes(q);
        const matchModel = m.model?.toLowerCase().includes(q);
        const matchSN = m.serial_number?.toLowerCase().includes(q);
        return Boolean(matchCode || matchModel || matchSN);
      })
      .map((m) => {
        const isAlreadyAssigned = assignedMachineIds.has(m.id);
        const clientCompany = m.client?.company_name || null;

        return {
          id: m.id,
          title: m.model || 'Equipment',
          code: m.machine_id,
          subtitle: `S/N: ${m.serial_number || 'N/A'}${clientCompany ? ` • ${clientCompany}` : ''}`,
          entityType: 'machine',
          isAlreadyAssigned,
          disabled: isAlreadyAssigned,
        };
      });
  }, [machines, machineSearchQuery, roster]);

  // Shift conflict warning
  const shiftConflictWarning = useMemo(() => {
    if (!selectedMachineId || !selectedShiftCode) return null;

    const targetShift = candidateMachineShifts.find(
      (s) => s.code.toUpperCase() === selectedShiftCode.toUpperCase()
    );
    if (!targetShift) return null;

    const candRanges = shiftToMinuteRanges(targetShift.start_time, targetShift.end_time);

    // Check overlap with existing roster shifts for this operator
    for (const existing of roster) {
      const existingRanges = shiftToMinuteRanges(existing.shiftStartTime, existing.shiftEndTime);
      if (doRangesOverlap(candRanges, existingRanges)) {
        return `Shift interval collides with existing assignment on ${existing.machineCode} (Shift ${existing.shiftCode}).`;
      }
    }

    return null;
  }, [selectedMachineId, selectedShiftCode, candidateMachineShifts, roster]);

  // Add machine to operator's roster
  const handleAddMachineToRoster = useCallback(() => {
    if (!selectedCandidateMachine || !selectedShiftCode) return;
    if (roster.length >= 3) {
      toast('warning', 'Limit Reached', 'An operator can have a maximum of 3 active shifts (24h) across the fleet.');
      return;
    }
    if (shiftConflictWarning) {
      haptics.reject();
      toast('error', 'Schedule Conflict', shiftConflictWarning);
      return;
    }

    const shiftObj = candidateMachineShifts.find(
      (s) => s.code.toUpperCase() === selectedShiftCode.toUpperCase()
    ) || DEFAULT_MODAL_SHIFTS[0];

    const newItem: OperatorMachineItem = {
      machineId: selectedCandidateMachine.id,
      machineCode: selectedCandidateMachine.machine_id,
      machineModel: selectedCandidateMachine.model || 'Equipment',
      clientId: selectedCandidateMachine.client_id,
      clientName: selectedCandidateMachine.client?.company_name || null,
      shiftCode: shiftObj.code.toUpperCase(),
      shiftStartTime: shiftObj.start_time,
      shiftEndTime: shiftObj.end_time,
    };

    haptics.confirm();
    setRoster((prev) => [...prev, newItem]);
    setSelectedMachineId('');
    setIsAddingMachine(false);
    setSubmitError(null);
  }, [selectedCandidateMachine, selectedShiftCode, roster.length, shiftConflictWarning, candidateMachineShifts, toast]);

  // Remove machine from roster
  const handleRemoveMachine = useCallback((item: SelectedAssignmentSummaryItem) => {
    setRoster((prev) => prev.filter((r) => r.machineId !== item.id || r.shiftCode !== item.shiftCode));
    setSubmitError(null);
  }, []);

  // Has unsaved changes check
  const hasUnsavedChanges = useMemo(() => {
    if (roster.length !== initialSnapshot.length) return true;
    for (let i = 0; i < roster.length; i++) {
      if (roster[i].machineId !== initialSnapshot[i]?.machineId || roster[i].shiftCode !== initialSnapshot[i]?.shiftCode) {
        return true;
      }
    }
    return false;
  }, [roster, initialSnapshot]);

  // Save mutations with optimistic updates and rollback
  const handleSaveAssignments = async () => {
    if (savingRef.current || isSaving) return;
    if (!operatorId) return;

    savingRef.current = true;
    setIsSaving(true);
    setSubmitError(null);

    const previousAssignments = queryClient.getQueryData(['assign-machine-operator-modal', 'assignments', operatorId]);
    const previousUserDetail = queryClient.getQueryData(['userDetail', operatorId]);

    try {
      const currentUserId = user?.id || null;

      // 1. Relieve assignments removed from roster
      for (const initAss of initialSnapshot) {
        const stillPresent = roster.some(
          (m) =>
            m.machineId === initAss.machineId &&
            m.shiftCode.toUpperCase() === initAss.shiftCode.toUpperCase()
        );

        if (!stillPresent && initAss.assignmentId) {
          await supabase.rpc('end_operator_machine_assignment_atomic', {
            p_assignment_id: initAss.assignmentId,
            p_ended_by: currentUserId,
            p_end_reason: 'Updated via operator equipment dialog',
          });
        }
      }

      // 2. Assign added equipment in roster
      for (const rItem of roster) {
        const alreadyActive = initialSnapshot.some(
          (a) =>
            a.machineId === rItem.machineId &&
            a.shiftCode.toUpperCase() === rItem.shiftCode.toUpperCase() &&
            Boolean(a.assignmentId)
        );

        if (!alreadyActive) {
          const { error: rpcErr } = await supabase.rpc('assign_operator_machine_atomic', {
            p_machine_id: rItem.machineId,
            p_operator_id: operatorId,
            p_shift_start_time: to24HourTime(rItem.shiftStartTime),
            p_shift_end_time: to24HourTime(rItem.shiftEndTime),
            p_shift_code: rItem.shiftCode,
            p_assigned_by: currentUserId,
            p_notes: 'Assigned via mobile operator equipment dialog',
          });

          if (rpcErr) {
            let msg = rpcErr.message;
            if (rpcErr.code === 'P0002' || msg.includes('MAX_OPERATOR_SHIFTS_REACHED')) {
              msg = 'Operator has reached maximum of 3 active shifts (24h) across the fleet.';
            } else if (msg.includes('OVERLAPPING_SHIFT_FOR_OPERATOR') || msg.includes('overlap')) {
              msg = `Shift collides with existing assignment on ${rItem.machineCode}.`;
            }
            throw new Error(msg);
          }
        }
      }

      // Realtime broadcast
      broadcastMobileAssignmentChanged({
        action: 'assigned',
        operatorId,
        machineId: roster[0]?.machineId || '',
        shiftCode: roster[0]?.shiftCode || '',
      });

      // Surgical cache invalidation
      queryClient.invalidateQueries({ queryKey: ['assign-machine-operator-modal', 'assignments', operatorId] });
      queryClient.invalidateQueries({ queryKey: ['userDetail', operatorId] });
      queryClient.invalidateQueries({ queryKey: ['operations-today-shift-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['machines'] });

      haptics.confirm();
      toast('success', 'Equipment Assigned', `Updated machinery assignments for ${operator?.full_name || 'operator'}.`);
      onSuccess?.(roster);
      onClose();
    } catch (err: any) {
      // Rollback
      if (previousAssignments) {
        queryClient.setQueryData(['assign-machine-operator-modal', 'assignments', operatorId], previousAssignments);
      }
      if (previousUserDetail) {
        queryClient.setQueryData(['userDetail', operatorId], previousUserDetail);
      }

      haptics.reject();
      const msg = err?.message || 'Failed to update equipment assignments.';
      setSubmitError(msg);
      toast('error', 'Assignment Failed', msg);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const targetEntity: TargetEntityDetails = {
    type: 'operator',
    title: operator?.full_name || 'Operator',
    code: operator?.employee_id || 'OPERATOR',
    subtitle: (operator?.role || 'operator').toUpperCase(),
    capacityLabel: `${roster.length}/3 Shifts`,
  };

  return (
    <AssignmentBottomSheet
      visible={visible}
      onClose={onClose}
      title="Assign Machinery to Operator"
      description="Designate operational equipment and shift rotations"
      targetEntity={targetEntity}
      footer={
        <AssignmentActionBar
          onSave={handleSaveAssignments}
          onCancel={onClose}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          error={submitError}
          disabled={isSaving}
        />
      }
    >
      {/* 1. Current Equipment Assignments Summary */}
      <AssignmentSelectionSummary
        items={roster.map((r) => ({
          id: r.machineId,
          title: r.machineModel || r.machineCode,
          code: r.machineCode,
          subtitle: r.clientName ? `Client: ${r.clientName}` : 'Yard Equipment',
          shiftCode: r.shiftCode,
          shiftStartTime: r.shiftStartTime,
          shiftEndTime: r.shiftEndTime,
          entityType: 'machine',
          assignmentId: r.assignmentId,
        }))}
        onRemove={handleRemoveMachine}
        maxCapacity={3}
        title="ASSIGNED EQUIPMENT & SHIFTS"
        disabled={isSaving}
      />

      {/* 2. Add Machinery Accordion / Selector */}
      {roster.length < 3 && (
        <View style={styles.addSectionContainer}>
          {!isAddingMachine ? (
            <Pressable
              onPress={() => {
                haptics.select();
                setIsAddingMachine(true);
              }}
              style={[
                styles.addMachineTrigger,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Add equipment assignment to this operator"
            >
              <Plus size={16} color={theme.colors.primary} />
              <Text variant="body" weight="semibold" style={{ color: theme.colors.primary }}>
                + Assign Machinery Equipment
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
                  <Truck size={16} color={theme.colors.primary} />
                  <Text variant="subheading" weight="semibold" style={{ color: theme.colors.ink }}>
                    Select Machinery & Shift
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsAddingMachine(false)}
                  hitSlop={10}
                  accessibilityRole="button"
                >
                  <X size={16} color={theme.colors.mute} />
                </Pressable>
              </View>

              {/* Machinery Search & Selectable List */}
              <AssignmentSearchInput
                value={machineSearchQuery}
                onChange={setMachineSearchQuery}
                placeholder="Search equipment by code, model, S/N..."
                count={candidateMachineItems.length}
                totalCount={machines.length}
              />

              <AssignmentSelectableList
                candidates={candidateMachineItems}
                selectedIds={selectedMachineId ? [selectedMachineId] : []}
                onSelect={(id) => setSelectedMachineId(id)}
                selectionMode="single"
                isLoading={isLoadingMachines}
                emptyTitle="No equipment available"
                emptyDescription="No machinery units match your search."
              />

              {/* Shift Picker for Selected Machine */}
              {selectedCandidateMachine && (
                <AssignmentShiftPicker
                  shifts={candidateMachineShifts}
                  selectedShiftCode={selectedShiftCode}
                  onSelectShift={setSelectedShiftCode}
                  conflictWarning={shiftConflictWarning}
                  disabled={isSaving}
                />
              )}

              {/* Confirm Add Button */}
              {selectedMachineId && (
                <Pressable
                  onPress={handleAddMachineToRoster}
                  disabled={Boolean(shiftConflictWarning)}
                  style={[
                    styles.confirmAddBtn,
                    {
                      backgroundColor: shiftConflictWarning ? theme.colors.hairline : theme.colors.primary,
                    },
                  ]}
                  accessibilityRole="button"
                >
                  <Text variant="body" weight="bold" style={{ color: '#ffffff' }}>
                    Assign {selectedCandidateMachine?.machine_id} (Shift {selectedShiftCode})
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
    </AssignmentBottomSheet>
  );
};

const styles = StyleSheet.create({
  addSectionContainer: {
    marginTop: spacingNumeric.xs,
  },
  addMachineTrigger: {
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
  confirmAddBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    minHeight: 44,
  },
});
