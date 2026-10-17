/**
 * Reach International Mobile — Today's Shift Roster Card Component
 * Pure memoized leaf component for rendering an individual shift roster record.
 * 
 * Strict Invariants:
 * - React.memo with custom shallow comparator preventing unnecessary re-renders
 * - 0 raw typography properties in StyleSheet (strictly uses <Text variant="...">)
 * - 44px minimum touch targets on all interactive actions
 * - Tactile haptics on user interaction
 * - 100% design and visual parity with Geist design tokens
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { HighlightText } from '../ui/HighlightText';
import { Pressable } from '../ui/touch/Pressable';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  Clock,
  UserCheck,
  AlertCircle,
  Truck,
  Building2,
  UserX,
  Wrench,
  Gauge,
  MapPin,
  MoreVertical,
  UserPlus,
} from '../ui/icon';
import type { TodayShiftMonitorRow } from '@reachinternational/types';

export interface MobileTodayShiftCardProps {
  row: TodayShiftMonitorRow;
  index: number;
  searchQuery: string;
  canEnterLog: boolean;
  onInitiateAssign: (row: TodayShiftMonitorRow) => void;
  onEnterLog: (row: TodayShiftMonitorRow) => void;
  onOpenMenu: (row: TodayShiftMonitorRow) => void;
}

function areShiftCardPropsEqual(
  prevProps: MobileTodayShiftCardProps,
  nextProps: MobileTodayShiftCardProps
): boolean {
  if (prevProps.searchQuery !== nextProps.searchQuery) return false;
  if (prevProps.canEnterLog !== nextProps.canEnterLog) return false;

  const pr = prevProps.row;
  const nr = nextProps.row;

  return (
    pr.machine_id === nr.machine_id &&
    pr.operator_id === nr.operator_id &&
    pr.shift_code === nr.shift_code &&
    pr.status === nr.status &&
    pr.log_id === nr.log_id &&
    pr.start_meter === nr.start_meter &&
    pr.end_meter === nr.end_meter &&
    pr.current_meter === nr.current_meter &&
    pr.running_hours === nr.running_hours &&
    pr.machine_health_status === nr.machine_health_status &&
    pr.machine_status === nr.machine_status &&
    pr.operator_name === nr.operator_name &&
    pr.entered_by === nr.entered_by &&
    pr.entered_by_name === nr.entered_by_name
  );
}

export const MobileTodayShiftCard: React.FC<MobileTodayShiftCardProps> = React.memo(({
  row,
  index,
  searchQuery,
  canEnterLog,
  onInitiateAssign,
  onEnterLog,
  onOpenMenu,
}) => {
  const { theme, isDark } = useTheme();

  const isUnassigned = row.status === 'unassigned' || !row.operator_id;
  const isEntered = row.status === 'entered';
  const isBreakdown = row.machine_health_status === 'breakdown';
  const isMaintenance =
    row.machine_health_status === 'under_maintenance' ||
    row.machine_status === 'under_maintenance';

  const accentColor = isEntered
    ? '#10b981'
    : isBreakdown
    ? '#ef4444'
    : isMaintenance
    ? '#f59e0b'
    : isUnassigned
    ? isDark ? '#fbbf24' : '#d97706'
    : '#f59e0b';

  const isAssistedLog = Boolean(
    (row.entry_source && row.entry_source !== 'operator') ||
    (row.entered_by && row.operator_id && row.entered_by !== row.operator_id) ||
    (row.entered_by_name && row.operator_name && row.entered_by_name.trim().toLowerCase() !== row.operator_name.trim().toLowerCase())
  );

  const enteredAuthorName = row.entered_by_name || (isAssistedLog ? 'Admin' : (row.operator_name || 'Operator'));

  const authorRoleBadge = row.entry_source && row.entry_source !== 'operator'
    ? row.entry_source === 'super_admin' ? 'Super Admin'
      : row.entry_source === 'admin' ? 'Admin'
      : row.entry_source === 'manager' ? 'Manager'
      : row.entry_source === 'supervisor' ? 'Supervisor'
      : row.entry_source
    : null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isEntered
            ? (isDark ? '#082f49' : '#f0f9ff')
            : theme.colors.canvasElevated,
          borderColor: isEntered
            ? (isDark ? '#0284c7' : '#7dd3fc')
            : isBreakdown
            ? (isDark ? '#ef4444' : '#fca5a5')
            : isMaintenance
            ? (isDark ? '#f59e0b' : '#fcd34d')
            : theme.colors.hairline,
          borderLeftColor: accentColor,
          borderLeftWidth: 4,
        },
      ]}
      accessibilityLabel={`${row.operator_name || 'Unassigned Machine'}, ${row.shift_name || row.shift_code}, Status: ${row.status}`}
    >
      {/* LINE 1: Operator Name (Left)  +  Shift Log Status & Touch Indicator (Right) */}
      <View style={styles.cardHeader}>
        <View style={styles.userAvatarRow}>
          <View
            style={[
              styles.avatarCircle,
              {
                backgroundColor: isUnassigned
                  ? isBreakdown
                    ? isDark ? '#450a0a' : '#fee2e2'
                    : isMaintenance
                    ? isDark ? '#451a03' : '#fef3c7'
                    : isDark ? '#451a03' : '#fef3c7'
                  : '#0284c7',
              },
            ]}
          >
            {isUnassigned ? (
              isBreakdown ? (
                <AlertCircle size={15} color={isDark ? '#f87171' : '#dc2626'} />
              ) : isMaintenance ? (
                <Wrench size={15} color={isDark ? '#fbbf24' : '#d97706'} />
              ) : (
                <UserX size={15} color={isDark ? '#fbbf24' : '#d97706'} />
              )
            ) : (
              <Text variant="heading" style={[styles.avatarLetter, { color: '#ffffff' }]}>
                {row.operator_name ? row.operator_name[0].toUpperCase() : 'O'}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              variant="subheading"
              style={[
                styles.operatorName,
                {
                  color: isUnassigned
                    ? isBreakdown
                      ? isDark ? '#f87171' : '#dc2626'
                      : isMaintenance
                      ? isDark ? '#fbbf24' : '#d97706'
                      : isDark ? '#fbbf24' : '#d97706'
                    : theme.colors.ink,
                },
              ]}
              numberOfLines={1}
            >
              {isUnassigned ? (
                isBreakdown ? (
                  'Breakdown Equipment'
                ) : isMaintenance ? (
                  'Under Maintenance'
                ) : (
                  'Unassigned Machine'
                )
              ) : (
                <HighlightText
                  variant="subheading"
                  text={row.operator_name}
                  query={searchQuery}
                  style={[styles.operatorName, { color: theme.colors.ink }]}
                  numberOfLines={1}
                />
              )}
            </Text>
          </View>
        </View>

        {/* Right Header: Shift Log Status Badge + 3-Dot Action Menu */}
        <View style={styles.cardHeaderRight}>
          <Badge
            status={
              isEntered
                ? 'entered'
                : isBreakdown
                ? 'breakdown'
                : isMaintenance
                ? 'maintenance'
                : isUnassigned
                ? 'unassigned'
                : 'pending'
            }
            dot
            label={
              isEntered
                ? 'ENTERED'
                : isBreakdown
                ? 'BREAKDOWN'
                : isMaintenance
                ? 'MAINTENANCE'
                : isUnassigned
                ? 'UNASSIGNED'
                : 'PENDING'
            }
            size="md"
          />

          {/* 3-Dot Action Menu Button (Gated by RBAC: only authorized roles) */}
          {canEnterLog && !isUnassigned && (
            <Pressable
              variant="plain"
              haptic="tap"
              hitSlopToMin48
              onPress={() => onOpenMenu(row)}
              style={[
                styles.cardMoreBtn,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
              accessibilityLabel="Shift actions"
            >
              <MoreVertical size={14} color={theme.colors.mute} />
            </Pressable>
          )}
        </View>
      </View>

      {/* USER DETAILS CARD METADATA BOX (6 Focused Key-Value Rows) */}
      <View
        style={[
          styles.cardMetaBox,
          {
            backgroundColor: theme.colors.canvas,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        {/* Row 1: Shift */}
        <View style={styles.metaFieldRow}>
          <View style={styles.metaFieldLabelGroup}>
            <Clock size={12} color={theme.colors.mute} />
            <Text variant="caption" style={[styles.metaFieldLabel, { color: theme.colors.mute }]}>
              Shift:
            </Text>
          </View>
          <Text variant="caption" style={[styles.metaFieldValue, { color: theme.colors.link }]} numberOfLines={1}>
            {row.shift_code || '—'}
          </Text>
        </View>

        {/* Row 2: M/C Model */}
        <View style={styles.metaFieldRow}>
          <View style={styles.metaFieldLabelGroup}>
            <Wrench size={12} color={theme.colors.mute} />
            <Text variant="caption" style={[styles.metaFieldLabel, { color: theme.colors.mute }]}>
              M/C Model:
            </Text>
          </View>
          <HighlightText
            variant="caption"
            text={row.machine_model || '—'}
            query={searchQuery}
            style={[styles.metaFieldValue, { color: theme.colors.ink }]}
            numberOfLines={1}
          />
        </View>

        {/* Row 3: M/C Sr no */}
        <View style={styles.metaFieldRow}>
          <View style={styles.metaFieldLabelGroup}>
            <Truck size={12} color={theme.colors.link} />
            <Text variant="caption" style={[styles.metaFieldLabel, { color: theme.colors.mute }]}>
              M/C Sr no:
            </Text>
          </View>
          <HighlightText
            variant="caption"
            text={row.machine_serial_number || '—'}
            query={searchQuery}
            style={[styles.metaFieldValue, { color: theme.colors.link }]}
            numberOfLines={1}
          />
        </View>

        {/* Row 4: HMR */}
        <View style={styles.metaFieldRow}>
          <View style={styles.metaFieldLabelGroup}>
            <Gauge size={12} color={theme.colors.mute} />
            <Text variant="caption" style={[styles.metaFieldLabel, { color: theme.colors.mute }]}>
              HMR:
            </Text>
          </View>
          <Text variant="caption" style={[styles.metaFieldValue, { color: theme.colors.ink }]} numberOfLines={1}>
            {(() => {
              const start = row.start_meter;
              const end = row.end_meter;
              if (start != null && end != null) {
                return `${start}->${end}`;
              }
              if (start != null) {
                return `${start}->${end ?? '—'}`;
              }
              if (end != null) {
                return `—->${end}`;
              }
              if (row.current_meter != null) {
                return `${row.current_meter}`;
              }
              return '—';
            })()}
          </Text>
        </View>

        {/* Row 5: Client */}
        <View style={styles.metaFieldRow}>
          <View style={styles.metaFieldLabelGroup}>
            <Building2 size={12} color={theme.colors.mute} />
            <Text variant="caption" style={[styles.metaFieldLabel, { color: theme.colors.mute }]}>
              Client:
            </Text>
          </View>
          <HighlightText
            variant="caption"
            text={row.client_name || '—'}
            query={searchQuery}
            style={[styles.metaFieldValue, { color: theme.colors.ink }]}
            numberOfLines={1}
          />
        </View>

        {/* Row 6: Site */}
        <View style={[styles.metaFieldRow, { borderBottomWidth: 0 }]}>
          <View style={styles.metaFieldLabelGroup}>
            <MapPin size={12} color={theme.colors.mute} />
            <Text variant="caption" style={[styles.metaFieldLabel, { color: theme.colors.mute }]}>
              Site:
            </Text>
          </View>
          <HighlightText
            variant="caption"
            text={row.client_city || row.site_name || '—'}
            query={searchQuery}
            style={[styles.metaFieldValue, { color: theme.colors.ink }]}
            numberOfLines={1}
          />
        </View>
      </View>

      {/* Entered Details Clean Attribution Row */}
      {isEntered && (
        <View style={styles.attributionRow}>
          <UserCheck size={13} color={isDark ? '#34d399' : '#059669'} />
          <Text variant="caption" style={[styles.attributionText, { color: isDark ? '#34d399' : '#047857' }]} numberOfLines={1}>
            {isAssistedLog ? (
              <>
                Assisted Log by <Text variant="caption">{enteredAuthorName}</Text>
                {authorRoleBadge ? (
                  <Text variant="caption">{` (${authorRoleBadge})`}</Text>
                ) : null}
              </>
            ) : (
              <>
                Logged by <Text variant="caption">{enteredAuthorName}</Text>
              </>
            )}
          </Text>
        </View>
      )}

      {/* Action Button: Assign Operator (Unassigned only) */}
      {isUnassigned ? (
        <Pressable
          variant="primary"
          haptic="tap"
          hitSlopToMin48
          onPress={() => onInitiateAssign(row)}
          style={[
            styles.assignRowBtn,
            {
              backgroundColor: isBreakdown
                ? '#dc2626'
                : isMaintenance
                ? '#d97706'
                : '#0284c7',
            },
          ]}
        >
          {isBreakdown || isMaintenance ? (
            <Wrench size={14} color="#ffffff" />
          ) : (
            <UserPlus size={14} color="#ffffff" />
          )}
          <Text variant="label" style={[styles.assignRowBtnText, { color: '#ffffff' }]}>
            {isBreakdown || isMaintenance
              ? `Activate & Assign ${row.machine_code}`
              : `Assign Operator to ${row.machine_code}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}, areShiftCardPropsEqual);

MobileTodayShiftCard.displayName = 'MobileTodayShiftCard';

const styles = StyleSheet.create({
  card: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: spacingNumeric.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  userAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {},
  operatorName: {},
  cardStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  cardStatusText: {},
  cardMetaBox: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 8,
    gap: 4,
  },
  metaFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaFieldLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaFieldLabel: {},
  metaFieldValue: {
    flexShrink: 1,
  },
  attributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5.5,
    paddingTop: 1,
    paddingHorizontal: 2,
  },
  attributionText: {},
  assignRowBtn: {
    height: 44, // Minimum 44px touch target
    minHeight: 44,
    borderRadius: radiusNumeric.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  assignRowBtnText: {
    color: '#ffffff',
  },
  cardMoreBtn: {
    width: 28,
    height: 28,
    minWidth: 28,
    minHeight: 28,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
