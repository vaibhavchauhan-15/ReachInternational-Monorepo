/**
 * ReachInternational Mobile — Assign Operator to Machine Modal
 *
 * Dedicated machine-centric assignment modal for configuring machinery equipment
 * shifts and operators. Enforces 24h coverage invariants:
 * - Maximum 3 active operators / shifts per machine
 * - Disjoint non-overlapping shift intervals
 * - Fleet-wide operator cap: max 3 active shifts (24h) across all equipment
 * - Cross-machine shift overlap collision detection
 * - Inherited client-level supervisor operational access callout
 * - Optional supervisor override for unallocated yard equipment
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
  ActivityIndicator,
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
import { isManagerOrAbove } from '@reachinternational/permissions';
import {
  formatTo12Hour,
  parseTimeToMinutes,
  shiftToMinuteRanges,
  doRangesOverlap,
  getUserInitials,
} from '@reachinternational/utils';
import {
  useAssignPersonnelModalData,
  useClientShiftCodes,
  MachineOptionItem,
  DEFAULT_MODAL_SHIFTS,
  ClientShiftOption,
} from '../../lib/hooks/useAssignPersonnelModalData';
import { Plus, Users, Shield, ShieldCheck, X } from '../ui/icon';
import { Pressable } from '../ui/touch/Pressable';

export interface OperatorAssignmentItem {
  operatorId: string;
  operatorName: string;
  employeeId?: string | null;
  phone?: string | null;
  email?: string | null;
  shiftCode: string;
  shiftStartTime: string;
  shiftEndTime: string;
  assignmentId?: string;
}

export interface AssignOperatorToMachineModalProps {
  visible: boolean;
  onClose: () => void;
  machine?: MachineOptionItem | any;
  initialMachineId?: string;
  userRole?: string;
  onSuccess?: (assignedOperators?: OperatorAssignmentItem[]) => void;
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

export const AssignOperatorToMachineModal: React.FC<AssignOperatorToMachineModalProps> = ({
  visible,
  onClose,
  machine: propMachine,
  initialMachineId,
  userRole = 'admin',
  onSuccess,
}) => {
  const { theme, isDark } = useTheme();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isSupervisorRole = userRole === 'supervisor';
  const canEditSupervisor = (!userRole || isManagerOrAbove(userRole as any)) && !isSupervisorRole;

  // Active target machine ID
  const machineId = propMachine?.id || initialMachineId;

  // Fetch modal master data (fleet assignments, operators, supervisors, machines)
  const {
    data: modalData,
    isLoading: isLoadingData,
  } = useAssignPersonnelModalData({
    visible,
    isSupervisorRole,
    supervisorId: user?.id,
    initialMachineId: machineId,
    relevantSupervisorIds: propMachine?.supervisor_ids || [],
  });

  // Resolve target machine from props or fetched machines
  const machine = useMemo(() => {
    if (propMachine) return propMachine;
    if (initialMachineId && modalData?.machines) {
      return modalData.machines.find((m) => m.id === initialMachineId) || null;
    }
    return null;
  }, [propMachine, initialMachineId, modalData?.machines]);

  const clientId = machine?.client_id || machine?.client?.id;
  const clientName = machine?.client?.company_name || machine?.client_name || null;

  // Fetch client shifts for this machine's client
  const { data: clientShifts = DEFAULT_MODAL_SHIFTS } = useClientShiftCodes(clientId, visible);

  // Client-inherited supervisors query
  const { data: clientSupervisors = [] } = useQuery<any[]>({
    queryKey: ['assign-operator-modal', 'client-supervisors', clientId],
    enabled: Boolean(visible && clientId),
    staleTime: 60_000,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_supervisors')
        .select('id, supervisor_id, supervisor:users!client_supervisors_supervisor_id_fkey(id, full_name, employee_id)')
        .eq('client_id', clientId);
      if (error) return [];
      return data || [];
    },
  });

  const inheritedSupervisorNames = useMemo(() => {
    return clientSupervisors
      .map((cs: any) => cs.supervisor?.full_name)
      .filter(Boolean)
      .join(', ');
  }, [clientSupervisors]);

  // Current machine roster and initial snapshot
  const [roster, setRoster] = useState<OperatorAssignmentItem[]>([]);
  const [initialSnapshot, setInitialSnapshot] = useState<{
    roster: OperatorAssignmentItem[];
    supervisorIds: string[];
  }>({ roster: [], supervisorIds: [] });

  const [selectedSupervisorIds, setSelectedSupervisorIds] = useState<string[]>([]);
  const [isAddingOperator, setIsAddingOperator] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [selectedShiftCode, setSelectedShiftCode] = useState<string>('S1');
  const [operatorSearchQuery, setOperatorSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const savingRef = useRef(false);

  // Initialize or reset on open
  useEffect(() => {
    if (!visible || !machineId) return;

    savingRef.current = false;
    setIsSaving(false);
    setSubmitError(null);
    setIsAddingOperator(false);
    setSelectedCandidateId('');
    setSelectedShiftCode('S1');
    setOperatorSearchQuery('');

    // Filter active assignments for this machine from fleet assignments
    const activeMachineAssignments = (modalData.fleetAssignments || []).filter(
      (a) => a.machine_id === machineId && a.is_active !== false
    );

    const mappedRoster: OperatorAssignmentItem[] = activeMachineAssignments.map((a) => {
      const op = modalData.operators.find((o) => o.id === a.operator_id);
      return {
        operatorId: a.operator_id,
        operatorName: op?.full_name || 'Operator',
        employeeId: op?.employee_id || null,
        phone: null,
        email: null,
        shiftCode: (a.shift_code || 'S1').toUpperCase(),
        shiftStartTime: formatTo12Hour(a.shift_start_time) || a.shift_start_time || '06:00 AM',
        shiftEndTime: formatTo12Hour(a.shift_end_time) || a.shift_end_time || '02:00 PM',
        assignmentId: a.id,
      };
    });

    const initSupIds: string[] = Array.isArray(machine?.supervisor_ids)
      ? [...machine.supervisor_ids]
      : machine?.current_supervisor_id
      ? [machine.current_supervisor_id]
      : [];

    setRoster(mappedRoster);
    setSelectedSupervisorIds(initSupIds);
    setInitialSnapshot({
      roster: mappedRoster,
      supervisorIds: initSupIds,
    });
  }, [visible, machineId, modalData.fleetAssignments, modalData.operators, machine]);

  // Compute occupied shift codes on this machine
  const occupiedShiftCodes = useMemo(() => {
    return roster.map((r) => r.shiftCode.toUpperCase());
  }, [roster]);

  // Next available default shift code
  const nextAvailableShift = useMemo(() => {
    const available = clientShifts.find((s) => !occupiedShiftCodes.includes(s.code.toUpperCase()));
    return available ? available.code : clientShifts[0]?.code || 'S1';
  }, [clientShifts, occupiedShiftCodes]);

  useEffect(() => {
    if (isAddingOperator) {
      setSelectedShiftCode(nextAvailableShift);
    }
  }, [isAddingOperator, nextAvailableShift]);

  // Candidate operators list with conflict annotations
  // Allows the same operator to be assigned to up to 3 shifts on each machine
  const candidateItems = useMemo((): AssignmentCandidateItem[] => {
    const q = operatorSearchQuery.trim().toLowerCase();

    return modalData.operators
      .filter((op) => {
        if (!q) return true;
        const matchName = op.full_name?.toLowerCase().includes(q);
        const matchEmp = op.employee_id?.toLowerCase().includes(q);
        return Boolean(matchName || matchEmp);
      })
      .map((op) => {
        const shiftsOnThis = roster.filter((r) => r.operatorId === op.id).length;
        const otherAssignments = (modalData.fleetAssignments || []).filter(
          (a) => a.operator_id === op.id && a.machine_id !== machineId && a.is_active !== false
        );
        const totalShifts = shiftsOnThis + otherAssignments.length;
        const isMaxThisMachine = shiftsOnThis >= 3;
        const isMaxTotal = totalShifts >= 3;
        const disabled = isMaxThisMachine || isMaxTotal;

        let conflictNotice: string | null = null;
        let statusBadge: string | null = null;

        if (totalShifts >= 3 || otherAssignments.length >= 3) {
          conflictNotice = 'Max 3 shifts (24h) reached fleet-wide';
          statusBadge = '3/3 Max';
        } else if (shiftsOnThis > 0) {
          conflictNotice = `${shiftsOnThis}/3 shifts on this machine`;
          statusBadge = `${shiftsOnThis}/3`;
        } else if (otherAssignments.length > 0) {
          conflictNotice = `Assigned on ${otherAssignments.length} other unit${otherAssignments.length > 1 ? 's' : ''}`;
          statusBadge = `${otherAssignments.length}/3 other`;
        }

        return {
          id: op.id,
          title: op.full_name,
          code: op.employee_id || null,
          subtitle: conflictNotice || 'Eligible Operator',
          statusBadge,
          entityType: 'user' as const,
          isAlreadyAssigned: isMaxThisMachine,
          disabled,
          conflictNotice,
        };
      })
      .sort((a, b) => {
        if (a.disabled !== b.disabled) return a.disabled ? 1 : -1;
        return (a.title || '').localeCompare(b.title || '');
      });
  }, [modalData.operators, modalData.fleetAssignments, operatorSearchQuery, roster, machineId]);

  // Shift conflict warning calculation for the candidate + selected shift
  const shiftConflictWarning = useMemo(() => {
    if (!selectedCandidateId || !selectedShiftCode) return null;

    const targetShift = clientShifts.find(
      (s) => s.code.toUpperCase() === selectedShiftCode.toUpperCase()
    );
    if (!targetShift) return null;

    // Check if shift code already assigned on this machine
    if (occupiedShiftCodes.includes(selectedShiftCode.toUpperCase())) {
      return `Shift ${selectedShiftCode} is already assigned on this equipment. Select a distinct shift.`;
    }

    const candRanges = shiftToMinuteRanges(targetShift.start_time, targetShift.end_time);

    // Check overlap with this operator's existing shifts on THIS machine
    const existingOnThis = roster.filter((r) => r.operatorId === selectedCandidateId);
    for (const ex of existingOnThis) {
      const exRanges = shiftToMinuteRanges(ex.shiftStartTime, ex.shiftEndTime);
      if (doRangesOverlap(candRanges, exRanges)) {
        return `Shift interval overlaps with operator's existing Shift ${ex.shiftCode} on this machine.`;
      }
    }

    // Check fleet-wide interval overlap for this operator on other machines
    const otherActive = (modalData.fleetAssignments || []).filter(
      (a) => a.operator_id === selectedCandidateId && a.machine_id !== machineId && a.is_active !== false
    );

    for (const other of otherActive) {
      const otherRanges = shiftToMinuteRanges(other.shift_start_time, other.shift_end_time);
      if (doRangesOverlap(candRanges, otherRanges)) {
        const otherName = other.machine?.machine_id || 'another machine';
        return `Shift interval overlaps with active assignment on ${otherName} (Shift ${other.shift_code}).`;
      }
    }

    return null;
  }, [selectedCandidateId, selectedShiftCode, clientShifts, occupiedShiftCodes, roster, modalData.fleetAssignments, machineId]);

  // Add operator to roster
  const handleAddOperatorToRoster = useCallback(() => {
    if (!selectedCandidateId || !selectedShiftCode) return;
    if (roster.length >= 3) {
      toast('warning', 'Capacity Reached', 'Maximum 3 operators can be assigned to a single machine (24h coverage).');
      return;
    }

    const shiftsOnThis = roster.filter((r) => r.operatorId === selectedCandidateId).length;
    if (shiftsOnThis >= 3) {
      toast('warning', 'Limit Reached', 'Operator is already assigned to all 3 shifts on this machine.');
      return;
    }

    const otherActive = (modalData.fleetAssignments || []).filter(
      (a) => a.operator_id === selectedCandidateId && a.machine_id !== machineId && a.is_active !== false
    );
    if (shiftsOnThis + otherActive.length >= 3) {
      toast('warning', 'Limit Reached', 'Operator has reached maximum 3 shifts (24h) across the fleet.');
      return;
    }

    if (shiftConflictWarning) {
      haptics.reject();
      toast('error', 'Shift Conflict', shiftConflictWarning);
      return;
    }

    const cand = modalData.operators.find((o) => o.id === selectedCandidateId);
    if (!cand) return;

    const shiftObj = clientShifts.find(
      (s) => s.code.toUpperCase() === selectedShiftCode.toUpperCase()
    ) || DEFAULT_MODAL_SHIFTS[0];

    const newItem: OperatorAssignmentItem = {
      operatorId: cand.id,
      operatorName: cand.full_name,
      employeeId: cand.employee_id || null,
      shiftCode: shiftObj.code.toUpperCase(),
      shiftStartTime: shiftObj.start_time,
      shiftEndTime: shiftObj.end_time,
    };

    haptics.confirm();
    setRoster((prev) => [...prev, newItem]);
    setSelectedCandidateId('');
    setIsAddingOperator(false);
    setSubmitError(null);
  }, [selectedCandidateId, selectedShiftCode, roster, shiftConflictWarning, modalData.operators, modalData.fleetAssignments, clientShifts, machineId, toast]);

  // Remove operator from roster
  const handleRemoveOperatorFromRoster = useCallback((item: SelectedAssignmentSummaryItem) => {
    setRoster((prev) => prev.filter((r) => r.operatorId !== item.id || r.shiftCode !== item.shiftCode));
    setSubmitError(null);
  }, []);

  // Has unsaved changes check
  const hasUnsavedChanges = useMemo(() => {
    if (roster.length !== initialSnapshot.roster.length) return true;
    for (let i = 0; i < roster.length; i++) {
      const cur = roster[i];
      const init = initialSnapshot.roster[i];
      if (!init) return true;
      if (cur.operatorId !== init.operatorId || cur.shiftCode !== init.shiftCode) {
        return true;
      }
    }
    return false;
  }, [roster, initialSnapshot]);

  // Save assignments with optimistic updates and snapshot rollback
  const handleSaveAssignments = async () => {
    if (savingRef.current || isSaving) return;
    if (!machineId) return;

    // Mutex lock
    savingRef.current = true;
    setIsSaving(true);
    setSubmitError(null);

    // Snapshot previous cache state
    const previousFleetData = queryClient.getQueryData(['assign-personnel-modal-data', 'fleet-assignments']);
    const previousMachinesData = queryClient.getQueryData(['machines']);

    try {
      const currentUserId = user?.id || null;

      // 1. Relieve assignments that existed in DB but were removed from current roster
      for (const initAss of initialSnapshot.roster) {
        const stillPresent = roster.some(
          (m) =>
            m.operatorId === initAss.operatorId &&
            m.shiftCode.toUpperCase() === initAss.shiftCode.toUpperCase()
        );

        if (!stillPresent && initAss.assignmentId) {
          await supabase.rpc('end_operator_machine_assignment_atomic', {
            p_assignment_id: initAss.assignmentId,
            p_ended_by: currentUserId,
            p_end_reason: 'Updated via mobile standardized assign dialog',
          });
        }
      }

      // 2. Atomically assign/update operators in roster
      for (const opItem of roster) {
        const alreadyActive = initialSnapshot.roster.some(
          (a) =>
            a.operatorId === opItem.operatorId &&
            a.shiftCode.toUpperCase() === opItem.shiftCode.toUpperCase() &&
            Boolean(a.assignmentId)
        );

        if (!alreadyActive) {
          const { error: rpcErr } = await supabase.rpc('assign_operator_machine_atomic', {
            p_machine_id: machineId,
            p_operator_id: opItem.operatorId,
            p_shift_start_time: to24HourTime(opItem.shiftStartTime),
            p_shift_end_time: to24HourTime(opItem.shiftEndTime),
            p_shift_code: opItem.shiftCode,
            p_assigned_by: currentUserId,
            p_notes: 'Assigned via mobile standardized assign dialog',
          });

          if (rpcErr) {
            let msg = rpcErr.message;
            if (rpcErr.code === 'P0002' || msg.includes('MAX_OPERATOR_SHIFTS_REACHED') || msg.includes('active shifts')) {
              msg = `${opItem.operatorName} has reached the maximum of 3 active shifts (24h) across the fleet.`;
            } else if (msg.includes('OVERLAPPING_SHIFT_FOR_OPERATOR') || msg.includes('overlap')) {
              msg = `${opItem.operatorName}'s shift collides with an existing active assignment across the fleet.`;
            }
            throw new Error(msg);
          }
        }
      }

      // 3. Update machine operator IDs and supervisor if permitted
      const machineUpdatePayload: Record<string, any> = {
        operator_ids: Array.from(new Set(roster.map((o) => o.operatorId))),
        current_operator_id: roster[0]?.operatorId || null,
        updated_at: new Date().toISOString(),
      };

      if (canEditSupervisor && !clientId) {
        machineUpdatePayload.supervisor_ids = selectedSupervisorIds;
        machineUpdatePayload.current_supervisor_id = selectedSupervisorIds[0] || null;
      }

      const { error: machineUpdateError } = await supabase
        .from('machines')
        .update(machineUpdatePayload)
        .eq('id', machineId);

      if (machineUpdateError) throw machineUpdateError;

      // Realtime broadcast for multi-client synchronization
      broadcastMobileAssignmentChanged({
        action: 'assigned',
        machineId,
        operatorId: roster[0]?.operatorId || '',
        shiftCode: roster[0]?.shiftCode || '',
      });

      // Surgical cache invalidation
      queryClient.invalidateQueries({ queryKey: ['operations-today-shift-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      queryClient.invalidateQueries({ queryKey: ['machineDetail', machineId] });
      queryClient.invalidateQueries({ queryKey: ['assign-personnel-modal-data'] });

      haptics.confirm();
      toast('success', 'Assignments Saved', `Successfully updated operators on ${machine.machine_id}.`);
      onSuccess?.(roster);
      onClose();
    } catch (err: any) {
      // Rollback cache snapshots
      if (previousFleetData) {
        queryClient.setQueryData(['assign-personnel-modal-data', 'fleet-assignments'], previousFleetData);
      }
      if (previousMachinesData) {
        queryClient.setQueryData(['machines'], previousMachinesData);
      }

      haptics.reject();
      const msg = err?.message || 'Failed to sync assignments to server.';
      setSubmitError(msg);
      toast('error', 'Assignment Failed', msg);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const targetEntity: TargetEntityDetails = {
    type: 'machine',
    title: machine?.model || 'Industrial Machinery',
    code: machine?.machine_id || 'M/C',
    subtitle: `S/N: ${machine?.serial_number || 'N/A'}${clientName ? ` • ${clientName}` : ''}`,
    statusBadge: machine?.health_status ? machine.health_status.toUpperCase() : 'ACTIVE',
    capacityLabel: `${roster.length}/3 Shifts`,
    inheritedNotice: clientId
      ? {
          clientName,
          supervisorName: inheritedSupervisorNames,
          message: inheritedSupervisorNames
            ? `Supervised by ${inheritedSupervisorNames}. Inherited from ${clientName || 'the assigned client'}.`
            : `Belongs to ${clientName || 'the assigned client'}. Client supervisors automatically inherit operational oversight.`,
        }
      : null,
  };

  return (
    <AssignmentBottomSheet
      visible={visible}
      onClose={onClose}
      title="Assign Machine Operator"
      description="Configure 24-hour equipment coverage and shift rosters"
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
      {/* 1. Selection Summary Roster */}
      <AssignmentSelectionSummary
        items={roster.map((r) => ({
          id: r.operatorId,
          title: r.operatorName,
          code: r.employeeId,
          shiftCode: r.shiftCode,
          shiftStartTime: r.shiftStartTime,
          shiftEndTime: r.shiftEndTime,
          entityType: 'user' as const,
          assignmentId: r.assignmentId,
        }))}
        onRemove={handleRemoveOperatorFromRoster}
        maxCapacity={3}
        title="ASSIGNED OPERATORS (24H)"
        disabled={isSaving}
      />

      {/* 2. Add Operator Accordion / Candidate Selector */}
      {roster.length < 3 && (
        <View style={styles.addSectionContainer}>
          {!isAddingOperator ? (
            <Pressable
              onPress={() => {
                haptics.select();
                setIsAddingOperator(true);
              }}
              style={[
                styles.addOperatorTrigger,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: isDark ? '#333333' : '#d4d4d8',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Add another operator to this machine"
            >
              <Plus size={14} color={theme.colors.primary} />
              <Text variant="small" weight="medium" style={{ color: theme.colors.primary }}>
                Assign Operator to Shift
              </Text>
            </Pressable>
          ) : (
            <View
              style={[
                styles.accordionCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: isDark ? '#333333' : '#d4d4d8',
                },
              ]}
            >
              {/* Accordion Header */}
              <View style={styles.accordionHeader}>
                <View style={styles.accordionTitleRow}>
                  <Users size={16} color={theme.colors.primary} />
                  <Text variant="subheading" weight="semibold" style={{ color: theme.colors.ink }}>
                    Select Operator & Shift
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsAddingOperator(false)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close operator selector"
                >
                  <X size={16} color={theme.colors.mute} />
                </Pressable>
              </View>

              {/* Shift Picker */}
              <AssignmentShiftPicker
                shifts={clientShifts}
                selectedShiftCode={selectedShiftCode}
                onSelectShift={setSelectedShiftCode}
                occupiedShiftCodes={occupiedShiftCodes}
                conflictWarning={shiftConflictWarning}
                disabled={isSaving}
              />

              {/* Search & Selectable List */}
              <AssignmentSearchInput
                value={operatorSearchQuery}
                onChange={setOperatorSearchQuery}
                placeholder="Search operators by name or employee ID..."
                count={candidateItems.length}
                totalCount={modalData.operators.length}
              />

              <AssignmentSelectableList
                candidates={candidateItems}
                selectedIds={selectedCandidateId ? [selectedCandidateId] : []}
                onSelect={(id) => setSelectedCandidateId(id)}
                selectionMode="single"
                isLoading={isLoadingData}
                emptyTitle="No operators available"
                emptyDescription="No operators match your search or have available shifts."
              />

              {/* Confirm Add Button */}
              {selectedCandidateId && (
                <Pressable
                  onPress={handleAddOperatorToRoster}
                  disabled={Boolean(shiftConflictWarning)}
                  style={[
                    styles.confirmAddBtn,
                    {
                      backgroundColor: shiftConflictWarning ? theme.colors.hairline : theme.colors.primary,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm adding operator to shift"
                >
                  <Text variant="body" weight="bold" style={{ color: '#ffffff' }}>
                    Add to Roster (Shift {selectedShiftCode})
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
  addOperatorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    borderStyle: 'solid',
    minHeight: 44,
    gap: spacingNumeric.sm,
  },
  accordionCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
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
