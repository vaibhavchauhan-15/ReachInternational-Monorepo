import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, Text } from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import {
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Truck,
  User,
  Calendar,
  Clock,
  AlertTriangle,
} from '../ui/icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  formatShiftTimingRange,
  formatDate,
  parseConflictReason,
} from '@reachinternational/utils';
import type { HourLogRecord } from '../../lib/hooks/useOperationsData';

export interface OperationsConflictBannerProps {
  pendingConflicts: HourLogRecord[];
  showAllConflicts: boolean;
  setShowAllConflicts: (show: boolean | ((prev: boolean) => boolean)) => void;
  onOpenConflictModal: (log: HourLogRecord) => void;
}

export function OperationsConflictBanner({
  pendingConflicts,
  showAllConflicts,
  setShowAllConflicts,
  onOpenConflictModal,
}: OperationsConflictBannerProps) {
  const { theme, isDark } = useTheme();

  if (!pendingConflicts || pendingConflicts.length === 0) {
    return null;
  }

  const displayedConflicts = showAllConflicts
    ? pendingConflicts
    : pendingConflicts.slice(0, 2);

  return (
    <View
      style={[
        styles.conflictBanner,
        {
          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#fffbeb',
          borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
        },
      ]}
    >
      {/* Header: Title + Action Required Badge + Show All Toggle */}
      <View style={styles.conflictBannerHeader}>
        <View style={styles.conflictBannerTitleWrap}>
          <ShieldAlert size={16} color={isDark ? '#fbbf24' : '#d97706'} />
          <Text variant="body" style={{ color: theme.colors.ink }}>
            {pendingConflicts.length} Overtime Shift Conflict
            {pendingConflicts.length > 1 ? 's' : ''}
          </Text>
          <View
            style={[
              styles.conflictActionBadge,
              {
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.22)' : '#fef3c7',
                borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a',
              },
            ]}
          >
            <Text
              variant="caption"
              style={{ color: isDark ? '#fbbf24' : '#92400e' }}
            >
              Action Required
            </Text>
          </View>
        </View>

        {pendingConflicts.length > 2 && (
          <Pressable
            variant="buttonGhost"
            hitSlopToMin48
            onPress={() => setShowAllConflicts(!showAllConflicts)}
            style={styles.toggleRow}
            accessibilityRole="button"
            accessibilityLabel={
              showAllConflicts
                ? 'Show fewer conflicts'
                : `View all ${pendingConflicts.length} conflicts`
            }
          >
            <Text variant="caption" style={{ color: isDark ? '#fbbf24' : '#d97706' }}>
              {showAllConflicts ? 'Show Fewer' : `View All (${pendingConflicts.length})`}
            </Text>
            {showAllConflicts ? (
              <ChevronUp size={13} color={isDark ? '#fbbf24' : '#d97706'} />
            ) : (
              <ChevronDown size={13} color={isDark ? '#fbbf24' : '#d97706'} />
            )}
          </Pressable>
        )}
      </View>

      {/* Clean, Structured Conflict Cards */}
      {displayedConflicts.map((cLog) => {
        const parsed = parseConflictReason(cLog.conflict_reason, {
          machineCode: cLog.machine_code,
          machineModel: cLog.machine?.model,
          operatorName: cLog.operator?.full_name,
          startTime: cLog.start_time,
          endTime: cLog.end_time,
          runningHours: cLog.running_hours,
          overtimeHours: cLog.overtime_hours,
          logDate: cLog.log_date,
        });

        return (
          <View
            key={cLog.id}
            style={[
              styles.cleanConflictCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#fde68a',
                borderLeftColor: isDark ? '#fbbf24' : '#d97706',
              },
            ]}
          >
            {/* Top Tier: Machine Code & Model (Left) | Conflict Badge & Review Button (Right) */}
            <View style={styles.cleanConflictCardHeader}>
              <View style={styles.machineIdentityWrap}>
                <View
                  style={[
                    styles.cleanMachineIconBox,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.06)'
                        : '#f3f4f6',
                    },
                  ]}
                >
                  <Truck size={13} color={theme.colors.ink} />
                </View>
                <Text variant="body" style={{ color: theme.colors.ink }}>
                  {cLog.machine_code}
                </Text>
                {cLog.machine?.model ? (
                  <Text variant="caption" style={{ color: theme.colors.mute }}>
                    ({cLog.machine.model})
                  </Text>
                ) : null}
              </View>

              <View style={styles.actionsWrap}>
                <View
                  style={[
                    styles.cleanSeverityPill,
                    {
                      backgroundColor: isDark
                        ? 'rgba(245, 158, 11, 0.15)'
                        : '#fef3c7',
                      borderColor: isDark
                        ? 'rgba(245, 158, 11, 0.35)'
                        : '#fde68a',
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    style={{ color: isDark ? '#fbbf24' : '#b45309' }}
                  >
                    {parsed.badgeText || 'DUAL MACHINE CONFLICT'}
                  </Text>
                </View>
                <Pressable
                  variant="buttonSecondary"
                  hitSlopToMin48
                  onPress={() => onOpenConflictModal(cLog)}
                  style={[
                    styles.cleanReviewBtn,
                    {
                      borderColor: isDark
                        ? 'rgba(245, 158, 11, 0.4)'
                        : '#fde68a',
                      backgroundColor: isDark
                        ? 'rgba(245, 158, 11, 0.15)'
                        : '#fef3c7',
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Review conflict for machine ${cLog.machine_code}`}
                >
                  <ShieldAlert
                    size={12}
                    color={isDark ? '#fbbf24' : '#b45309'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    variant="caption"
                    style={{ color: isDark ? '#fbbf24' : '#b45309' }}
                  >
                    Review
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Bottom Tier: 4-Column High-Density Info Grid */}
            <View
              style={[
                styles.cleanInfoStrip,
                {
                  borderTopColor: isDark
                    ? 'rgba(255,255,255,0.08)'
                    : theme.colors.hairline,
                },
              ]}
            >
              {/* 1. Operator */}
              <View style={styles.cleanInfoItem}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  OPERATOR
                </Text>
                <View style={styles.cleanInfoValueRow}>
                  <User size={12} color={theme.colors.mute} />
                  <Text
                    variant="caption"
                    style={{ color: theme.colors.ink }}
                    numberOfLines={1}
                  >
                    {cLog.operator?.full_name || 'Operator'}
                  </Text>
                </View>
              </View>

              {/* 2. Shift Date */}
              <View style={styles.cleanInfoItem}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  SHIFT DATE
                </Text>
                <View style={styles.cleanInfoValueRow}>
                  <Calendar size={12} color={theme.colors.mute} />
                  <Text variant="caption" style={{ color: theme.colors.ink }}>
                    {formatDate(cLog.log_date)}
                  </Text>
                </View>
              </View>

              {/* 3. Shift Time & Overtime */}
              <View style={styles.cleanInfoItem}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  SHIFT & OVERTIME
                </Text>
                <View style={styles.cleanInfoValueRow}>
                  <Clock size={12} color={theme.colors.mute} />
                  <Text variant="mono" style={{ color: theme.colors.ink }}>
                    {formatShiftTimingRange(cLog.start_time, cLog.end_time)}
                  </Text>
                  {cLog.overtime_hours ? (
                    <View
                      style={[
                        styles.cleanOtPill,
                        {
                          backgroundColor: isDark
                            ? 'rgba(245, 158, 11, 0.2)'
                            : '#fef3c7',
                          borderColor: isDark
                            ? 'rgba(245, 158, 11, 0.35)'
                            : '#fde68a',
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        style={{ color: isDark ? '#fbbf24' : '#b45309' }}
                      >
                        +{cLog.overtime_hours}h OT
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* 4. Conflict With */}
              <View style={styles.cleanInfoItemConflict}>
                <Text
                  variant="caption"
                  style={{ color: isDark ? '#f87171' : '#dc2626' }}
                >
                  CONFLICTS WITH
                </Text>
                <View style={styles.cleanInfoValueRow}>
                  <AlertTriangle
                    size={12}
                    color={isDark ? '#f87171' : '#dc2626'}
                  />
                  <View
                    style={[
                      styles.cleanConflictEntityBadge,
                      {
                        backgroundColor: isDark
                          ? 'rgba(239, 68, 68, 0.18)'
                          : '#fee2e2',
                        borderColor: isDark
                          ? 'rgba(239, 68, 68, 0.35)'
                          : '#fecaca',
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{ color: isDark ? '#f87171' : '#b91c1c' }}
                    >
                      {parsed.conflictingEntity || 'Subsequent Shift Roster'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  conflictBanner: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  conflictBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conflictBannerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conflictActionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cleanConflictCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: spacingNumeric.sm + 2,
    gap: 8,
  },
  cleanConflictCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  machineIdentityWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 160,
  },
  actionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cleanMachineIconBox: {
    width: 24,
    height: 24,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanSeverityPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  cleanReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  cleanInfoStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 12,
  },
  cleanInfoItem: {
    gap: 2,
    minWidth: 120,
    flexGrow: 1,
  },
  cleanInfoItemConflict: {
    gap: 2,
    minWidth: 140,
    flexGrow: 1,
  },
  cleanInfoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cleanOtPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  cleanConflictEntityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
});
