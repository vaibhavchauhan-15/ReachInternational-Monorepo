/**
 * ReachInternational Mobile — Assign Client Supervisor Modal
 *
 * Bottom-sheet modal to assign active supervisors directly to a client account.
 * Implements inherited client-level RBAC: supervisors assigned at the client level
 * inherit operational oversight over all fleet equipment and operator assignments
 * belonging to this client without requiring redundant per-machine assignments.
 *
 * Adheres to monorepo mobile invariants:
 * - Minimum 44px touch targets (minHeight: 44 / hitSlopToMin48)
 * - Zero raw typography properties in StyleSheet.create (strictly <Text variant="...">)
 * - Vercel Geist design tokens and Light/Dark theme synchronization
 * - TanStack Query cache invalidation and atomic RPC backend execution
 * - Idempotency & duplicate submission locking
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  AppModal,
  Text,
  useTheme,
  Button,
  SearchInput,
  useToast,
  Badge,
} from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { getUserInitials } from '@reachinternational/utils';
import { haptics } from '../../lib/haptics';
import {
  ShieldCheck,
  UserCheck,
  X,
  Check,
  AlertCircle,
  Phone,
  Mail,
  User,
  Trash2,
} from '../ui/icon';
import {
  useEligibleClientSupervisors,
  type CandidateSupervisorItem,
  useClientDetailData,
} from '../../lib/hooks/useClientDetailData';

export interface AssignClientSupervisorModalProps {
  visible: boolean;
  clientId: string;
  clientName: string;
  onClose: () => void;
  onSuccess?: (assignedSupervisor: CandidateSupervisorItem) => void;
}

export const AssignClientSupervisorModal: React.FC<AssignClientSupervisorModalProps> = ({
  visible,
  clientId,
  clientName,
  onClose,
  onSuccess,
}) => {
  const { theme, isDark } = useTheme();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch candidate supervisors (active supervisors not yet assigned to this client)
  const {
    data: candidates = [],
    isLoading: isLoadingCandidates,
    isError: isCandidateError,
    error: candidateError,
    refetch: refetchCandidates,
  } = useEligibleClientSupervisors(visible ? clientId : undefined);

  // Pull assign mutation, removal, and currently assigned supervisors from client detail data hook
  const {
    assignSupervisor,
    supervisors: currentlyAssignedSupervisors = [],
    removeSupervisor,
  } = useClientDetailData(clientId);

  const [removingSupId, setRemovingSupId] = useState<string | null>(null);

  // Handle removing an existing client supervisor
  const handleRemoveAssigned = useCallback(
    async (supId: string, supName: string) => {
      if (!clientId || removingSupId) return;
      try {
        setRemovingSupId(supId);
        await removeSupervisor({ supervisorId: supId });
        haptics.confirm();
        toast('success', 'Supervisor Removed', `Removed ${supName} from ${clientName}.`);
        refetchCandidates();
      } catch (err: any) {
        haptics.reject();
        toast('error', 'Removal Failed', err.message || 'Unable to remove supervisor.');
      } finally {
        setRemovingSupId(null);
      }
    },
    [clientId, removingSupId, removeSupervisor, clientName, refetchCandidates, toast]
  );

  // Reset or initialize state on modal open
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setSelectedSupervisorId('');
      setIsSubmitting(false);
      refetchCandidates();
    }
  }, [visible, refetchCandidates]);

  // Filter candidates by search term (name or employee ID)
  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase().trim();
    return candidates.filter((c) => {
      const matchName = c.full_name?.toLowerCase().includes(q);
      const matchEmpId = c.employee_id?.toLowerCase().includes(q);
      const matchPhone = c.phone?.toLowerCase().includes(q);
      return Boolean(matchName || matchEmpId || matchPhone);
    });
  }, [candidates, searchQuery]);

  // Selected candidate object
  const selectedCandidate = useMemo(() => {
    return candidates.find((c) => c.id === selectedSupervisorId) || null;
  }, [candidates, selectedSupervisorId]);

  // Handle supervisor item press (supports selection & toggle deselection)
  const handleSelectSupervisor = useCallback((supId: string) => {
    haptics.select();
    setSelectedSupervisorId((prev) => (prev === supId ? '' : supId));
  }, []);

  // Submit assignment mutation
  const handleConfirmAssignment = useCallback(async () => {
    if (!selectedSupervisorId || !clientId || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await assignSupervisor({ supervisorId: selectedSupervisorId });

      haptics.confirm();
      toast('success', 'Supervisor Assigned', `Assigned ${selectedCandidate?.full_name || 'Supervisor'} to ${clientName}.`);

      if (selectedCandidate && onSuccess) {
        onSuccess(selectedCandidate);
      }
      onClose();
    } catch (err: any) {
      haptics.reject();
      toast('error', 'Assignment Failed', err.message || 'Unable to assign supervisor to client account.');
      // Preserves selectedSupervisorId on error so user doesn't lose their selection
    } finally {
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
  ]);

  if (!visible) return null;

  return (
    <AppModal
      visible={visible}
      onClose={isSubmitting ? () => {} : onClose}
      variant="bottom"
    >
      {/* 1. Header */}
      <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
        <View style={styles.headerLeftRow}>
          <View
            style={[
              styles.shieldIconBox,
              {
                backgroundColor: isDark ? 'rgba(2, 132, 199, 0.18)' : '#e0f2fe',
                borderColor: isDark ? 'rgba(2, 132, 199, 0.4)' : '#bae6fd',
              },
            ]}
          >
            <ShieldCheck size={18} color={theme.colors.primary} />
          </View>
          <View style={styles.headerTextCol}>
            <Text variant="subheading" weight="bold" style={{ color: theme.colors.ink }} numberOfLines={1}>
              Assign Client Supervisor
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute }} numberOfLines={1}>
              {clientName || 'Client Profile'}
            </Text>
          </View>
        </View>

        <Pressable
          variant="buttonGhost"
          hitSlopToMin48
          disabled={isSubmitting}
          onPress={onClose}
          style={styles.closeBtn}
          accessibilityLabel="Close supervisor assignment modal"
        >
          <X size={18} color={theme.colors.mute} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Informational Callout (Inherited Operational Access) */}
        <View
          style={[
            styles.infoCallout,
            {
              backgroundColor: isDark ? 'rgba(2, 132, 199, 0.12)' : '#f0f9ff',
              borderColor: isDark ? 'rgba(2, 132, 199, 0.35)' : '#bae6fd',
            },
          ]}
        >
          <View style={styles.infoCalloutTitleRow}>
            <UserCheck size={14} color={theme.colors.primary} />
            <Text variant="caption" weight="bold" style={{ color: theme.colors.primary }}>
              Inherited Operational Access
            </Text>
          </View>
          <Text variant="caption" style={{ color: isDark ? '#bae6fd' : '#0369a1', marginTop: 3 }}>
            Assigned supervisors automatically inherit operational oversight over all fleet equipment and operator assignments belonging to{' '}
            <Text variant="caption" weight="bold" style={{ color: isDark ? '#e0f2fe' : '#0c4a6e' }}>
              {clientName}
            </Text>{' '}
            without requiring redundant per-machine assignments.
          </Text>
        </View>

        {/* Existing Assigned Supervisors Section */}
        {currentlyAssignedSupervisors && currentlyAssignedSupervisors.length > 0 && (
          <View style={styles.currentSection}>
            <View style={styles.currentSectionHeader}>
              <View style={styles.currentSectionHeaderLeft}>
                <ShieldCheck size={14} color="#0d9488" />
                <Text variant="subheading" weight="bold" style={{ color: theme.colors.ink }}>
                  Currently Assigned ({currentlyAssignedSupervisors.length})
                </Text>
              </View>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                Active oversight
              </Text>
            </View>

            <View style={styles.currentList}>
              {currentlyAssignedSupervisors.map((cs) => {
                const initials = getUserInitials(cs.supervisor_name);
                const isThisRemoving = removingSupId === cs.supervisor_id;
                return (
                  <View
                    key={cs.id}
                    style={[
                      styles.currentRow,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.avatarBoxSm,
                        {
                          backgroundColor: isDark ? '#ffffff' : '#171717',
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        weight="bold"
                        style={{ color: isDark ? '#171717' : '#ffffff' }}
                      >
                        {initials}
                      </Text>
                    </View>

                    <View style={styles.currentInfoCol}>
                      <View style={styles.currentNameRow}>
                        <Text variant="body" weight="semibold" style={{ color: theme.colors.ink }} numberOfLines={1}>
                          {cs.supervisor_name}
                        </Text>
                        <Badge status="active" size="sm" customLabel="ASSIGNED" />
                      </View>
                      <View style={styles.contactRow}>
                        {Boolean(cs.supervisor_phone) && (
                          <View style={styles.contactItem}>
                            <Phone size={10} color={theme.colors.mute} />
                            <Text variant="micro" style={{ color: theme.colors.mute, marginLeft: 2 }}>
                              {cs.supervisor_phone}
                            </Text>
                          </View>
                        )}
                        {Boolean(cs.supervisor_email) && (
                          <View style={styles.contactItem}>
                            <Mail size={10} color={theme.colors.mute} />
                            <Text variant="micro" style={{ color: theme.colors.mute, marginLeft: 2 }} numberOfLines={1}>
                              {cs.supervisor_email}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <Pressable
                      variant="buttonGhost"
                      hitSlopToMin48
                      disabled={isSubmitting || Boolean(removingSupId)}
                      onPress={() => handleRemoveAssigned(cs.supervisor_id, cs.supervisor_name)}
                      style={styles.removeBtn}
                      accessibilityLabel={`Remove ${cs.supervisor_name}`}
                    >
                      {isThisRemoving ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <Trash2 size={15} color="#ef4444" />
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 3. Section Header for Candidate Selection */}
        <View style={styles.candidateSectionHeader}>
          <Text variant="subheading" weight="bold" style={{ color: theme.colors.ink }}>
            {currentlyAssignedSupervisors.length > 0 ? 'Assign Additional Supervisor' : 'Select Eligible Supervisor'}
          </Text>
          <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 1 }}>
            Select an active supervisor to grant inherited client oversight
          </Text>
        </View>

        {/* 4. Search Bar */}
        <View style={styles.searchSection}>
          <SearchInput
            placeholder="Search eligible supervisors..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onClear={() => setSearchQuery('')}
          />
        </View>

        {/* 4. Candidate List Content */}
        {isLoadingCandidates ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 8 }}>
              Loading eligible supervisors...
            </Text>
          </View>
        ) : isCandidateError ? (
          <View style={[styles.errorCard, { borderColor: theme.colors.hairline }]}>
            <AlertCircle size={18} color="#ef4444" />
            <Text variant="caption" style={{ color: theme.colors.ink, flex: 1, marginLeft: 8 }}>
              {candidateError?.message || 'Failed to load eligible supervisors.'}
            </Text>
          </View>
        ) : candidates.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
            <UserCheck size={28} color={theme.colors.mute} />
            <Text variant="body" weight="semibold" style={{ color: theme.colors.ink, marginTop: 8 }}>
              All Eligible Supervisors Already Assigned
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute, textAlign: 'center', marginTop: 4 }}>
              Every active supervisor in the organization is currently assigned to this client account.
            </Text>
          </View>
        ) : filteredCandidates.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
            <Text variant="body" weight="semibold" style={{ color: theme.colors.ink }}>
              No Supervisors Found
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute, textAlign: 'center', marginTop: 4 }}>
              No active supervisors match &quot;{searchQuery}&quot;.
            </Text>
          </View>
        ) : (
          <View style={styles.candidateList}>
            {filteredCandidates.map((candidate) => {
              const isSelected = candidate.id === selectedSupervisorId;
              const initials = getUserInitials(candidate.full_name);

              return (
                <Pressable
                  key={candidate.id}
                  variant="card"
                  hitSlopToMin48
                  disabled={isSubmitting}
                  onPress={() => handleSelectSupervisor(candidate.id)}
                  style={[
                    styles.candidateRow,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? 'rgba(2, 132, 199, 0.16)'
                          : '#f0f9ff'
                        : theme.colors.canvasElevated,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.hairline,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Select supervisor ${candidate.full_name}`}
                >
                  {/* Left Avatar Initial */}
                  <View
                    style={[
                      styles.avatarBox,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primary
                          : isDark
                          ? '#ffffff'
                          : '#171717',
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      weight="bold"
                      style={{
                        color: isSelected
                          ? '#ffffff'
                          : isDark
                          ? '#171717'
                          : '#ffffff',
                      }}
                    >
                      {initials}
                    </Text>
                  </View>

                  {/* Info Column */}
                  <View style={styles.candidateInfoCol}>
                    <View style={styles.candidateNameRow}>
                      <Text variant="body" weight="semibold" style={{ color: theme.colors.ink }} numberOfLines={1}>
                        {candidate.full_name}
                      </Text>
                      {Boolean(candidate.employee_id) && (
                        <Badge
                          variant="outline"
                          customLabel={candidate.employee_id || ''}
                          style={styles.empBadge}
                        />
                      )}
                    </View>

                    <View style={styles.contactRow}>
                      {Boolean(candidate.phone) && (
                        <View style={styles.contactItem}>
                          <Phone size={11} color={theme.colors.mute} />
                          <Text variant="caption" style={{ color: theme.colors.mute, marginLeft: 3 }}>
                            {candidate.phone}
                          </Text>
                        </View>
                      )}
                      {Boolean(candidate.email) && (
                        <View style={styles.contactItem}>
                          <Mail size={11} color={theme.colors.mute} />
                          <Text variant="caption" style={{ color: theme.colors.mute, marginLeft: 3 }} numberOfLines={1}>
                            {candidate.email}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Radio / Check Circle */}
                  <View
                    style={[
                      styles.radioCircle,
                      {
                        borderColor: isSelected ? theme.colors.primary : theme.colors.hairline,
                        backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                      },
                    ]}
                  >
                    {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* 5. Selected Candidate Details Card */}
        {selectedCandidate && (
          <View
            style={[
              styles.selectedPreviewCard,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={styles.selectedPreviewHeader}>
              <User size={13} color={theme.colors.primary} />
              <Text variant="micro" weight="bold" style={{ color: theme.colors.primary, textTransform: 'uppercase' }}>
                Pending Assignment
              </Text>
            </View>

            <View style={styles.selectedDetailRow}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>Supervisor Name:</Text>
              <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                {selectedCandidate.full_name}
              </Text>
            </View>

            {Boolean(selectedCandidate.employee_id) && (
              <View style={styles.selectedDetailRow}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>Employee ID:</Text>
                <Text variant="mono" weight="semibold" style={{ color: theme.colors.ink }}>
                  {selectedCandidate.employee_id}
                </Text>
              </View>
            )}

            {Boolean(selectedCandidate.phone) && (
              <View style={styles.selectedDetailRow}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>Phone:</Text>
                <Text variant="mono" style={{ color: theme.colors.ink }}>
                  {selectedCandidate.phone}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* 6. Footer Actions */}
      <View style={[styles.footerRow, { borderTopColor: theme.colors.hairline }]}>
        <Button
          variant="outline"
          label="Cancel"
          onPress={onClose}
          disabled={isSubmitting}
          style={styles.cancelBtn}
        />
        <Button
          variant="primary"
          label={isSubmitting ? 'Assigning...' : 'Confirm Assignment'}
          loading={isSubmitting}
          disabled={isSubmitting || !selectedSupervisorId}
          onPress={handleConfirmAssignment}
          style={styles.confirmBtn}
        />
      </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm + 2,
    borderBottomWidth: 1,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    flex: 1,
  },
  shieldIconBox: {
    width: 36,
    height: 36,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiusNumeric.sm,
  },
  scrollContent: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.md,
    paddingBottom: spacingNumeric.lg,
    gap: spacingNumeric.md,
  },
  infoCallout: {
    padding: spacingNumeric.md - 2,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  infoCalloutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentSection: {
    gap: spacingNumeric.xs,
  },
  currentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  currentSectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentList: {
    gap: spacingNumeric.xs,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    minHeight: 52,
  },
  avatarBoxSm: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacingNumeric.sm,
  },
  currentInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  currentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  removeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateSectionHeader: {
    marginTop: spacingNumeric.xs,
    marginBottom: 2,
  },
  searchSection: {
    marginBottom: 2,
  },
  centerLoading: {
    paddingVertical: spacingNumeric.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  emptyCard: {
    padding: spacingNumeric.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  candidateList: {
    gap: spacingNumeric.xs + 2,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacingNumeric.sm + 2,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    minHeight: 56,
  },
  avatarBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacingNumeric.sm,
  },
  candidateInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  candidateNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  empBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.md,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacingNumeric.sm,
  },
  selectedPreviewCard: {
    padding: spacingNumeric.sm + 2,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 4,
  },
  selectedPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  selectedDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm + 2,
    borderTopWidth: 1,
    gap: spacingNumeric.sm,
  },
  cancelBtn: {
    minHeight: 44,
    minWidth: 90,
  },
  confirmBtn: {
    minHeight: 44,
    minWidth: 160,
  },
});
