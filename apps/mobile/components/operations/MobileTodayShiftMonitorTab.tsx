/**
 * Reach International Mobile — Today's Shift Monitor Component
 * Displays real-time today shift roster for Supervisors, Managers, and Admins.
 * Shows who has entered today's shift log and who is pending, with RBAC scoping
 * and 1-tap Assisted Shift Entry.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Card, Badge, Button, useTheme } from '../ui';
import type { TodayShiftMonitorRow } from '@reachinternational/types';
import { useTodayShiftMonitor } from '../../lib/hooks/useOperationsData';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { formatTo12Hour } from '@reachinternational/utils';
import { supabase } from '../../lib/supabase';
import {
  Clock,
  UserCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  Truck,
  Building2,
  User,
  X,
  Gauge,
  UserPlus,
  UserX,
} from 'lucide-react-native';
import { MobileAssignPersonnelModal } from './MobileAssignPersonnelModal';
import { isManagerOrAbove } from '@reachinternational/permissions';
import { useAuth } from '../../lib/auth/useAuth';

export interface MobileTodayShiftMonitorTabProps {
  actorId?: string;
  userRole?: string;
  onEnterLog: (row: TodayShiftMonitorRow) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  isAssignModalOpen?: boolean;
  onCloseAssignModal?: () => void;
}

export const MobileTodayShiftMonitorTab: React.FC<MobileTodayShiftMonitorTabProps> = ({
  actorId,
  userRole,
  onEnterLog,
  isAssignModalOpen: isAssignModalOpenProp,
  onCloseAssignModal,
}) => {
  const { theme, isDark } = useTheme();
  const { user: authUser } = useAuth();
  const effectiveRole = userRole || authUser?.role;
  const canEnterLog = isManagerOrAbove(effectiveRole);
  const { data: rows = [], isLoading, refetch } = useTodayShiftMonitor(actorId);

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'entered' | 'unassigned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [internalAssignModalOpen, setInternalAssignModalOpen] = useState(false);
  const [assignMachineId, setAssignMachineId] = useState<string | undefined>();

  const isAssignModalOpen = isAssignModalOpenProp !== undefined ? isAssignModalOpenProp : internalAssignModalOpen;

  const handleOpenAssignModal = (machineId?: string) => {
    setAssignMachineId(machineId);
    setInternalAssignModalOpen(true);
  };

  const handleCloseAssignModal = () => {
    setInternalAssignModalOpen(false);
    setAssignMachineId(undefined);
    onCloseAssignModal?.();
  };

  // Real-time broadcast listener for instant roster revalidation
  useEffect(() => {
    const rosterChannel = supabase.channel('operations-roster');

    rosterChannel
      .on('broadcast', { event: 'assignment_changed' }, () => {
        refetch();
      })
      .on('broadcast', { event: 'roster_updated' }, () => {
        refetch();
      })
      .on('broadcast', { event: 'log_entered' }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(rosterChannel);
    };
  }, [refetch]);

  const summary = useMemo(() => {
    const total = rows.length;
    const entered = rows.filter((r) => r.status === 'entered').length;
    const pending = rows.filter((r) => r.status === 'pending').length;
    const unassigned = rows.filter((r) => r.status === 'unassigned').length;
    return { total, entered, pending, unassigned };
  }, [rows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (statusFilter !== 'all') {
      r = r.filter((row) => row.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().replace(/\s+/g, '');
      r = r.filter(
        (row) =>
          (row.operator_name || '').toLowerCase().replace(/\s+/g, '').includes(q) ||
          (row.machine_code || '').toLowerCase().includes(q) ||
          (row.machine_serial_number || '').toLowerCase().includes(q) ||
          (row.machine_model || '').toLowerCase().includes(q) ||
          (row.client_name || '').toLowerCase().includes(q) ||
          (row.client_code || '').toLowerCase().includes(q) ||
          (row.client_id || '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, statusFilter, searchQuery]);

  const formatTiming = (t: string | null) => {
    if (!t) return '—';
    return formatTo12Hour(t) || t;
  };

  if (isLoading && rows.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.link} />
        <Text style={[styles.loadingText, { color: theme.colors.mute }]}>
          Loading today's shift roster...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. KPI COUNTER SUMMARY CARDS */}
      <View style={styles.kpiRow}>
        {/* Total */}
        <View
          style={[
            styles.kpiCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View style={styles.kpiTop}>
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Total</Text>
            <Clock size={13} color={theme.colors.mute} />
          </View>
          <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
            {summary.total}
          </Text>
        </View>

        {/* Entered */}
        <View
          style={[
            styles.kpiCard,
            {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#a7f3d0',
            },
          ]}
        >
          <View style={styles.kpiTop}>
            <Text
              style={[
                styles.kpiLabel,
                { color: isDark ? '#34d399' : '#059669', fontWeight: '600' },
              ]}
            >
              Entered
            </Text>
            <CheckCircle2 size={13} color={isDark ? '#34d399' : '#059669'} />
          </View>
          <Text
            style={[
              styles.kpiValue,
              { color: isDark ? '#34d399' : '#059669' },
            ]}
          >
            {summary.entered}
          </Text>
        </View>

        {/* Pending */}
        <View
          style={[
            styles.kpiCard,
            {
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#fffbeb',
              borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#fde68a',
            },
          ]}
        >
          <View style={styles.kpiTop}>
            <Text
              style={[
                styles.kpiLabel,
                { color: isDark ? '#fbbf24' : '#d97706', fontWeight: '600' },
              ]}
            >
              Pending
            </Text>
            <AlertCircle size={13} color={isDark ? '#fbbf24' : '#d97706'} />
          </View>
          <Text
            style={[
              styles.kpiValue,
              { color: isDark ? '#fbbf24' : '#d97706' },
            ]}
          >
            {summary.pending}
          </Text>
        </View>

        {/* Unassigned */}
        <View
          style={[
            styles.kpiCard,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#fef2f2',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#fecaca',
            },
          ]}
        >
          <View style={styles.kpiTop}>
            <Text
              style={[
                styles.kpiLabel,
                { color: isDark ? '#f87171' : '#dc2626', fontWeight: '600' },
              ]}
            >
              Unassigned
            </Text>
            <UserX size={13} color={isDark ? '#f87171' : '#dc2626'} />
          </View>
          <Text
            style={[
              styles.kpiValue,
              { color: isDark ? '#f87171' : '#dc2626' },
            ]}
          >
            {summary.unassigned}
          </Text>
        </View>
      </View>

      {/* 2. FILTER PILLS & SEARCH */}
      <View style={styles.filterSection}>
        <View style={styles.filterStrip}>
          {(['all', 'pending', 'entered', 'unassigned'] as const).map((f) => {
            const isActive = statusFilter === f;
            const count =
              f === 'all'
                ? summary.total
                : f === 'pending'
                ? summary.pending
                : f === 'entered'
                ? summary.entered
                : summary.unassigned;
            const label =
              f === 'all'
                ? `All (${count})`
                : f === 'pending'
                ? `Pending (${count})`
                : f === 'entered'
                ? `Entered (${count})`
                : `Unassigned (${count})`;

            return (
              <TouchableOpacity
                key={f}
                onPress={() => setStatusFilter(f)}
                activeOpacity={0.8}
                style={[
                  styles.filterPill,
                  isActive
                    ? [styles.filterPillActive, { backgroundColor: theme.colors.ink }]
                    : [
                        styles.filterPillInactive,
                        {
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ],
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    {
                      color: isActive ? theme.colors.canvas : theme.colors.body,
                    },
                    isActive && styles.filterPillTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchWrap,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Search size={14} color={theme.colors.mute} />
          <TextInput
            placeholder="Search operator, machine, client..."
            placeholderTextColor={theme.colors.mute}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: theme.colors.ink }]}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color={theme.colors.mute} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3. ROSTER CARDS */}
      {filtered.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <AlertCircle size={28} color={theme.colors.mute} />
          <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>
            No Shifts Found
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.mute }]}>
            {searchQuery
              ? 'No matching operators found for your search.'
              : statusFilter === 'pending'
              ? 'All operators have submitted their shift logs today!'
              : 'No active shift assignments found for today.'}
          </Text>
          {!searchQuery && (
            <TouchableOpacity
              onPress={() => handleOpenAssignModal(undefined)}
              activeOpacity={0.8}
              style={[styles.emptyAssignButton, { backgroundColor: theme.colors.link }]}
            >
              <UserPlus size={14} color="#ffffff" />
              <Text style={styles.emptyAssignButtonText}>Assign Operator</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.cardsList}>
          {filtered.map((row, idx) => {
            const isUnassigned = row.status === 'unassigned' || !row.operator_id;
            const isEntered = row.status === 'entered';
            const cardKey = row.operator_id
              ? `mon-${row.operator_id}-${row.machine_id}-${row.shift_code}`
              : `mon-unassigned-${row.machine_id}-${idx}`;

            return (
              <View
                key={cardKey}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.canvasElevated,
                    borderColor: isUnassigned
                      ? isDark
                        ? 'rgba(245, 158, 11, 0.4)'
                        : '#fde68a'
                      : theme.colors.hairline,
                  },
                ]}
              >
                {/* Card Top: Operator Name + Status Badge */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    {isUnassigned ? (
                      <View style={styles.unassignedHeaderRow}>
                        <AlertCircle size={15} color={isDark ? '#fbbf24' : '#d97706'} />
                        <Text style={[styles.operatorName, { color: isDark ? '#fbbf24' : '#d97706' }]}>
                          Unassigned Machine
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.operatorName, { color: theme.colors.ink }]}>
                        {row.operator_name}
                      </Text>
                    )}
                    {/* Machine & Client Row — Clickable to preselect machine in Assign Modal */}
                    <TouchableOpacity
                      onPress={() => handleOpenAssignModal(row.machine_id)}
                      activeOpacity={0.7}
                      style={styles.machineClientRow}
                    >
                      <Truck size={12} color={theme.colors.link} />
                      <Text style={[styles.metaTextMono, { color: theme.colors.link, fontWeight: '600' }]}>
                        {row.machine_serial_number || row.machine_code}
                      </Text>
                      {row.machine_model ? (
                        <>
                          <Text style={[styles.metaBullet, { color: theme.colors.hairline }]}>•</Text>
                          <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                            {row.machine_model}
                          </Text>
                        </>
                      ) : null}
                      <Text style={[styles.metaBullet, { color: theme.colors.hairline }]}>•</Text>
                      <Building2 size={12} color={theme.colors.mute} />
                      <Text
                        style={[styles.metaText, { color: theme.colors.mute }]}
                        numberOfLines={1}
                      >
                        {row.client_name}
                        {row.client_code ? ` (${row.client_code})` : ''}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Badge
                    status={isEntered ? 'active' : isUnassigned ? 'pending' : 'pending'}
                    customLabel={isEntered ? 'Entered' : isUnassigned ? 'Unassigned' : 'Pending'}
                  />
                </View>

                {/* Shift Details Row */}
                {!isUnassigned ? (
                  <View style={[styles.shiftDetailsRow, { borderTopColor: theme.colors.hairline }]}>
                    <View style={styles.shiftBadgeGroup}>
                      <Badge
                        status="active"
                        customLabel={`Shift ${row.shift_code}`}
                      />
                      {row.shift_name ? (
                        <Text
                          style={[styles.shiftNameText, { color: theme.colors.mute }]}
                          numberOfLines={1}
                        >
                          {row.shift_name}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.shiftTimingText, { color: theme.colors.body }]}>
                      {formatTiming(row.shift_start)} – {formatTiming(row.shift_end)}
                    </Text>
                    {isEntered && row.running_hours != null && (
                      <Text style={[styles.runningHoursText, { color: theme.colors.ink }]}>
                        {`${row.running_hours}h`}
                      </Text>
                    )}
                  </View>
                ) : (
                  <View style={[styles.shiftDetailsRow, { borderTopColor: theme.colors.hairline }]}>
                    <Text style={[styles.shiftTimingText, { color: theme.colors.mute, fontSize: 12.5 }]}>
                      No active operator assigned for today's shift
                    </Text>
                  </View>
                )}

                {/* HMR & Attribution (If Entered) */}
                {isEntered && (
                  <View
                    style={[
                      styles.enteredMetaBox,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    {row.start_meter != null && row.end_meter != null && (
                      <View style={styles.hmrInline}>
                        <Gauge size={12} color={theme.colors.mute} />
                        <Text style={[styles.hmrText, { color: theme.colors.mute }]}>
                          HMR: <Text style={{ color: theme.colors.ink, fontWeight: '600' }}>{row.start_meter}</Text> → <Text style={{ color: theme.colors.ink, fontWeight: '600' }}>{row.end_meter}</Text>
                        </Text>
                      </View>
                    )}

                    {row.entered_by_name && (
                      <View style={styles.attributionInline}>
                        <UserCheck size={12} color={theme.colors.mute} />
                        <Text style={[styles.attributionText, { color: theme.colors.mute }]}>
                          Logged by <Text style={{ color: theme.colors.ink, fontWeight: '500' }}>{row.entered_by_name}</Text>
                        </Text>
                        {row.entry_source && row.entry_source !== 'operator' && (
                          <Badge
                            status="active"
                            customLabel={row.entry_source}
                          />
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* Action Button: Assign Operator (if Unassigned) or Assisted Entry (If Pending) */}
                {isUnassigned ? (
                  <TouchableOpacity
                    onPress={() => handleOpenAssignModal(row.machine_id)}
                    activeOpacity={0.8}
                    style={[styles.assignRowBtn, { backgroundColor: theme.colors.link }]}
                  >
                    <UserPlus size={14} color="#ffffff" />
                    <Text style={styles.assignRowBtnText}>
                      Assign Operator to {row.machine_code}
                    </Text>
                  </TouchableOpacity>
                ) : !isEntered ? (
                  canEnterLog ? (
                    <TouchableOpacity
                      onPress={() => onEnterLog(row)}
                      activeOpacity={0.8}
                      style={[
                        styles.enterLogBtn,
                        {
                          backgroundColor: theme.colors.link + '15',
                          borderColor: theme.colors.link + '35',
                        },
                      ]}
                    >
                      <User size={14} color={theme.colors.link} />
                      <Text style={[styles.enterLogBtnText, { color: theme.colors.link }]}>
                        Enter Shift Log for {row.operator_name ? row.operator_name.split(' ')[0] : 'Operator'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.pendingNoticeBox}>
                      <Text style={[styles.pendingNoticeText, { color: theme.colors.mute }]}>
                        Shift log submission pending
                      </Text>
                    </View>
                  )
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {/* 3. ASSIGN PERSONNEL MODAL */}
      <MobileAssignPersonnelModal
        visible={isAssignModalOpen}
        onClose={handleCloseAssignModal}
        initialMachineId={assignMachineId}
        onSuccess={() => {
          refetch();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacingNumeric.sm,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  kpiTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  filterSection: {
    gap: spacingNumeric.xs,
  },
  filterStrip: {
    flexDirection: 'row',
    gap: 8,
    overflow: 'hidden',
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  filterPillActive: {},
  filterPillInactive: {},
  filterPillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterPillTextActive: {
    fontWeight: '600',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 42,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  cardsList: {
    gap: spacingNumeric.xs,
  },
  card: {
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardHeaderLeft: {
    flex: 1,
    gap: 3,
  },
  operatorName: {
    fontSize: 15,
    fontWeight: '700',
  },
  machineClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaTextMono: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  metaBullet: {
    fontSize: 12,
  },
  metaText: {
    fontSize: 12.5,
    flex: 1,
  },
  shiftDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  shiftBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shiftNameText: {
    fontSize: 12.5,
    fontWeight: '500',
    maxWidth: 130,
  },
  shiftTimingText: {
    fontSize: 12.5,
    flex: 1,
  },
  runningHoursText: {
    fontSize: 13,
    fontWeight: '700',
  },
  enteredMetaBox: {
    padding: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    gap: 6,
  },
  hmrInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hmrText: {
    fontSize: 12.5,
  },
  attributionInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attributionText: {
    fontSize: 12.5,
  },
  enterLogBtn: {
    height: 44, // Minimum 44px touch target
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  enterLogBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyAssignButton: {
    height: 44, // Minimum 44px touch target
    borderRadius: radiusNumeric.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    marginTop: 6,
  },
  emptyAssignButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  unassignedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assignRowBtn: {
    height: 44, // Minimum 44px touch target
    borderRadius: radiusNumeric.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  assignRowBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  pendingNoticeBox: {
    paddingVertical: spacingNumeric.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingNoticeText: {
    fontSize: 12.5,
    fontStyle: 'italic',
  },
});
