/**
 * Reach International Mobile — Today's Shift Roster Card Component
 * Pure memoized leaf component for rendering an individual shift roster record.
 * 
 * Strict Invariants:
 * - React.memo with custom shallow comparator preventing unnecessary re-renders
 * - 0 raw typography properties in StyleSheet (strictly uses <Text variant="..." weight="...">)
 * - 44px minimum touch targets on all interactive actions
 * - Tactile haptics on user interaction
 * - 100% design and visual parity with Geist design tokens and web TodayShiftMonitorCard
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
  UserCheck,
  AlertCircle,
  Wrench,
  Edit2,
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
  onOpenMenu?: (row: TodayShiftMonitorRow) => void;
}

function formatTime(t: string | null | undefined): string {
  if (!t) return '—';
  try {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  } catch {
    return t;
  }
}

function formatMeterText(row: TodayShiftMonitorRow): string {
  const start = row.start_meter;
  const end = row.end_meter;
  if (start != null && end != null) {
    return `${start} → ${end}`;
  }
  if (start != null) {
    return `${start} → —`;
  }
  if (end != null) {
    return `— → ${end}`;
  }
  if (row.current_meter != null) {
    return `${row.current_meter}`;
  }
  return '—';
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
    pr.machine_model === nr.machine_model &&
    pr.machine_serial_number === nr.machine_serial_number &&
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
    pr.operator_employee_id === nr.operator_employee_id &&
    pr.operator_phone === nr.operator_phone &&
    pr.entered_by === nr.entered_by &&
    pr.entered_by_name === nr.entered_by_name &&
    pr.entry_source === nr.entry_source
  );
}

export const MobileTodayShiftCard: React.FC<MobileTodayShiftCardProps> = React.memo(({
  row,
  index,
  searchQuery,
  canEnterLog,
  onInitiateAssign,
  onEnterLog,
}) => {
  const { theme, isDark } = useTheme();

  const isUnassigned = row.status === 'unassigned' || !row.operator_id;
  const isEntered = row.status === 'entered';
  const isBreakdown = row.machine_health_status === 'breakdown';
  const isMaintenance =
    row.machine_health_status === 'under_maintenance' ||
    row.machine_status === 'under_maintenance';

  const enteredAuthorName = row.entered_by_name || (row.operator_name || 'Operator');

  const authorRoleBadge =
    row.entry_source && row.entry_source !== 'operator'
      ? row.entry_source === 'super_admin'
        ? 'Super Admin'
        : row.entry_source === 'admin'
        ? 'Admin'
        : row.entry_source === 'manager'
        ? 'Manager'
        : row.entry_source === 'supervisor'
        ? 'Supervisor'
        : row.entry_source
      : null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isEntered
            ? (isDark ? '#082f49' : '#f0f9ff')
            : isBreakdown
            ? (isDark ? '#4c0519' : '#fff1f2')
            : isMaintenance || isUnassigned
            ? (isDark ? '#451a03' : '#fffbeb')
            : theme.colors.canvasElevated,
          borderColor: isEntered
            ? (isDark ? '#0284c7' : '#7dd3fc')
            : isBreakdown
            ? (isDark ? '#fda4af' : '#fecdd3')
            : isMaintenance || isUnassigned
            ? (isDark ? '#fde68a' : '#fef3c7')
            : theme.colors.hairline,
        },
      ]}
      accessibilityLabel={`${row.operator_name || 'Unassigned Machine'}, ${row.shift_name || row.shift_code}, Status: ${row.status}`}
    >
      {/* 1. CARD HEADER: Operator Name / Alert Heading (Left) + Status Badge (Right) */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeftCol}>
          {isUnassigned ? (
            isBreakdown ? (
              <View style={styles.unassignedHeaderGroup}>
                <AlertCircle size={15} color={isDark ? '#f87171' : '#dc2626'} />
                <Text variant="subheading" weight="bold" style={{ color: isDark ? '#f87171' : '#dc2626' }}>
                  Breakdown Machine
                </Text>
              </View>
            ) : isMaintenance ? (
              <View style={styles.unassignedHeaderGroup}>
                <Wrench size={15} color={isDark ? '#fbbf24' : '#d97706'} />
                <Text variant="subheading" weight="bold" style={{ color: isDark ? '#fbbf24' : '#d97706' }}>
                  Under Maintenance
                </Text>
              </View>
            ) : (
              <View style={styles.unassignedHeaderGroup}>
                <AlertCircle size={15} color={isDark ? '#fbbf24' : '#d97706'} />
                <Text variant="subheading" weight="bold" style={{ color: isDark ? '#fbbf24' : '#d97706' }}>
                  Unassigned Machine
                </Text>
              </View>
            )
          ) : (
            <HighlightText
              variant="subheading"
              weight="bold"
              text={row.operator_name || 'Operator'}
              query={searchQuery}
              style={{ color: theme.colors.ink }}
              numberOfLines={1}
            />
          )}
        </View>

        {/* Right Header: Shift Log Status Badge */}
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
                ? 'Entered'
                : isBreakdown
                ? 'Breakdown'
                : isMaintenance
                ? 'Maintenance'
                : isUnassigned
                ? 'Unassigned'
                : 'Pending'
            }
            size="md"
          />
        </View>
      </View>

      {/* 2. OPERATOR SUBTITLE ROW (EMP ID - 100% Web Parity) */}
      {!isUnassigned && row.operator_employee_id ? (
        <View style={styles.operatorSubtitleRow}>
          <HighlightText
            variant="caption"
            weight="semibold"
            text={row.operator_employee_id}
            query={searchQuery}
            style={{ color: isDark ? '#7dd3fc' : '#0369a1' }}
          />
        </View>
      ) : null}

      {/* 3. DETAILS GRID: All values shifted to the left, well formatted (100% Web Parity) */}
      <View style={[styles.detailsGrid, { borderTopColor: theme.colors.hairline }]}>
        {/* Row 1: Machine (Model + Serial No) */}
        <View style={[styles.detailRow, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.labelCol}>
            <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
              Machine:
            </Text>
          </View>
          <View style={styles.valueCol}>
            <HighlightText
              variant="caption"
              weight="semibold"
              text={row.machine_model || row.machine_code || '—'}
              query={searchQuery}
              style={{ color: theme.colors.ink }}
              numberOfLines={1}
            />
            {(() => {
              const serialText =
                row.machine_serial_number ||
                (row.machine_model && row.machine_code !== row.machine_model ? row.machine_code : null);
              if (!serialText) return null;
              const hasPrefix =
                serialText.trim().toUpperCase().startsWith('SN') ||
                serialText.trim().toUpperCase().startsWith('S/N');
              return (
                <Text variant="micro" style={{ color: theme.colors.mute }}>
                  ({hasPrefix ? '' : 'SN: '}
                  <HighlightText
                    variant="mono"
                    weight="medium"
                    text={serialText}
                    query={searchQuery}
                    style={{ color: theme.colors.mute }}
                  />
                  )
                </Text>
              );
            })()}
          </View>
        </View>

        {/* Row 2: Shift */}
        <View style={[styles.detailRow, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.labelCol}>
            <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
              Shift:
            </Text>
          </View>
          <View style={styles.valueCol}>
            <Text variant="mono" weight="bold" style={{ color: theme.colors.ink }}>
              {row.shift_code
                ? row.shift_code.trim().toUpperCase().startsWith('SHIFT')
                  ? row.shift_code.trim()
                  : `Shift ${row.shift_code.trim()}`
                : '—'}
            </Text>
            {row.shift_start || row.shift_end ? (
              <Text variant="micro" style={{ color: theme.colors.mute }}>
                {' '}({formatTime(row.shift_start)} – {formatTime(row.shift_end)})
              </Text>
            ) : null}
          </View>
        </View>

        {/* Row 4: HMR (Hours) */}
        <View style={[styles.detailRow, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.labelCol}>
            <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
              HMR (Hours):
            </Text>
          </View>
          <View style={styles.valueCol}>
            <Text variant="mono" weight="bold" style={{ color: theme.colors.ink }}>
              {formatMeterText(row)}
            </Text>
          </View>
        </View>

        {/* Row 5: Client */}
        <View style={[styles.detailRow, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.labelCol}>
            <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
              Client:
            </Text>
          </View>
          <View style={styles.valueCol}>
            <HighlightText
              variant="caption"
              weight="medium"
              text={row.client_name || '—'}
              query={searchQuery}
              style={{ color: theme.colors.ink }}
              numberOfLines={1}
            />
          </View>
        </View>

        {/* Row 6: Site */}
        <View style={styles.detailRowLast}>
          <View style={styles.labelCol}>
            <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
              Site:
            </Text>
          </View>
          <View style={styles.valueCol}>
            <HighlightText
              variant="caption"
              weight="medium"
              text={row.client_city || row.site_name || '—'}
              query={searchQuery}
              style={{ color: theme.colors.ink }}
              numberOfLines={1}
            />
          </View>
        </View>
      </View>

      {/* 4. ENTERED BY ATTRIBUTION ROW */}
      {isEntered && row.entered_by_name ? (
        <View style={styles.attributionRow}>
          <UserCheck size={13} color={isDark ? '#34d399' : '#059669'} />
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            Entered by{' '}
            <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
              {row.entered_by_name}
            </Text>
          </Text>
          {row.entry_source && row.entry_source !== 'operator' ? (
            <Badge
              variant="info"
              size="sm"
              solid={false}
              label={authorRoleBadge || row.entry_source}
            />
          ) : null}
        </View>
      ) : null}

      {/* 5. ACTION BUTTON: Enter/Edit Shift Log below the card (Min 44px touch target) */}
      {!isUnassigned && canEnterLog ? (
        <Pressable
          variant={isEntered ? 'outline' : 'primary'}
          haptic="tap"
          hitSlopToMin48
          onPress={() => onEnterLog(row)}
          style={[
            styles.actionRowBtn,
            {
              backgroundColor: isEntered
                ? isDark
                  ? '#082f49'
                  : '#f0f9ff'
                : '#0284c7',
              borderColor: isEntered
                ? isDark
                  ? '#0284c7'
                  : '#7dd3fc'
                : '#0284c7',
            },
          ]}
        >
          <Edit2
            size={14}
            color={isEntered ? (isDark ? '#38bdf8' : '#0284c7') : '#ffffff'}
          />
          <Text
            variant="caption"
            weight="semibold"
            style={{
              color: isEntered
                ? isDark
                  ? '#38bdf8'
                  : '#0284c7'
                : '#ffffff',
            }}
          >
            {isEntered ? 'Edit Shift' : 'Enter Shift'}
          </Text>
        </Pressable>
      ) : isUnassigned ? (
        <Pressable
          variant="primary"
          haptic="tap"
          hitSlopToMin48
          onPress={() => onInitiateAssign(row)}
          style={[
            styles.actionRowBtn,
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
          <Text variant="caption" weight="semibold" style={{ color: '#ffffff' }}>
            {isBreakdown || isMaintenance
              ? `Activate & Assign ${row.machine_model || row.machine_code}`
              : `Assign Operator to ${row.machine_model || row.machine_code}`}
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
    gap: 6,
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
    gap: 6,
    flexShrink: 0,
  },
  unassignedHeaderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  headerLeftCol: {
    flex: 1,
    minWidth: 0,
  },
  operatorSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 2,
    marginTop: -2,
    marginBottom: 2,
  },
  detailsGrid: {
    borderTopWidth: 1,
    paddingTop: 6,
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  detailRowLast: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 3,
    gap: 8,
  },
  labelCol: {
    width: 90,
    flexShrink: 0,
  },
  valueCol: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 4,
  },
  attributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
    paddingHorizontal: 2,
  },
  actionRowBtn: {
    height: 44,
    minHeight: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    marginTop: 4,
  },
});
