/**
 * ReachInternational Mobile — AttendanceEmployeeCard Component
 * 
 * Strict Invariants:
 * - Vercel Geist design tokens (#171717 ink, hairline borders, muted washes)
 * - 0 raw typography properties in StyleSheet.create (enforced via <Text variant="...">)
 * - Minimum 44px touch targets on action cards (hitSlopToMin48, minHeight: 44)
 * - Tactile status indicators for Scheduled, Present, Absent, and Half-Day
 */

import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { HighlightText } from '../ui/HighlightText';
import { Pressable } from '../ui/touch/Pressable';
import { Phone, MapPin, Clock, ChevronRight } from '../ui/icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface AttendanceEmployee {
  employee_id: string;
  full_name: string;
  phone: string | null;
  role: string;
  city: string | null;
  state: string | null;
  shift_start_time: string | null;
  shift_end_time: string | null;
  scheduled_days: number;
  present_days: number;
  half_days: number;
  absent_days: number;
  worked_minutes: number;
  overtime_minutes: number;
  breakdown_minutes: number;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY';
}

export interface AttendanceEmployeeCardProps {
  employee: AttendanceEmployee;
  searchQuery?: string;
  onPress: (employee: AttendanceEmployee) => void;
  formatMins: (minutes: number) => string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const AttendanceEmployeeCardComponent: React.FC<AttendanceEmployeeCardProps> = ({
  employee,
  searchQuery = '',
  onPress,
  formatMins,
  style,
  testID = 'attendance-employee-card',
}) => {
  const { theme, isDark } = useTheme();

  const initials = (employee.full_name || '')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'OP';

  return (
    <Pressable
      testID={testID}
      variant="card"
      style={[
        styles.employeeCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
        style,
      ]}
      onPress={() => onPress(employee)}
      accessibilityRole="button"
      accessibilityLabel={`View attendance details for ${employee.full_name}`}
    >
      {/* Header Row: Initials Avatar, Name, Role badge */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.empAvatar,
              {
                backgroundColor: isDark ? '#262626' : '#f4f4f5',
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Text variant="label" style={{ color: theme.colors.ink }}>
              {initials}
            </Text>
          </View>

          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <HighlightText
                text={employee.full_name}
                query={searchQuery}
                style={[styles.empName, { color: theme.colors.ink }]}
                numberOfLines={1}
              />
              <Badge variant="outline" size="sm" customLabel="OPERATOR" />
            </View>

            <View style={styles.metaRow}>
              {employee.phone ? (
                <View style={styles.metaItem}>
                  <Phone size={11} color={theme.colors.mute} style={{ marginRight: 3 }} />
                  <HighlightText
                    text={employee.phone}
                    query={searchQuery}
                    style={{ color: theme.colors.mute }}
                  />
                </View>
              ) : null}
              {employee.city ? (
                <View style={styles.metaItem}>
                  <MapPin size={11} color={theme.colors.mute} style={{ marginRight: 3 }} />
                  <HighlightText
                    text={employee.city}
                    query={searchQuery}
                    style={{ color: theme.colors.mute }}
                  />
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <ChevronRight size={16} color={theme.colors.mute} />
      </View>

      {/* Day Counts Strip */}
      <View
        style={[
          styles.statsRow,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.statCol}>
          <Text variant="small" style={[styles.statVal, { color: theme.colors.ink }]}>
            {employee.scheduled_days}
          </Text>
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            Scheduled
          </Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: theme.colors.hairline }]} />

        <View style={styles.statCol}>
          <Text variant="small" style={[styles.statVal, { color: '#16a34a' }]}>
            {Math.min(employee.present_days, employee.scheduled_days)}
          </Text>
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            Present
          </Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: theme.colors.hairline }]} />

        <View style={styles.statCol}>
          <Text variant="small" style={[styles.statVal, { color: '#dc2626' }]}>
            {employee.absent_days}
          </Text>
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            Absent
          </Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: theme.colors.hairline }]} />

        <View style={styles.statCol}>
          <Text variant="small" style={[styles.statVal, { color: '#d97706' }]}>
            {employee.half_days}
          </Text>
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            Half-Day
          </Text>
        </View>
      </View>

      {/* Hours & Shift Footer */}
      <View style={[styles.cardFooter, { borderTopColor: theme.colors.hairline }]}>
        <View style={styles.hoursItem}>
          <Clock size={13} color={theme.colors.mute} style={{ marginRight: 4 }} />
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            Worked:{' '}
          </Text>
          <Text variant="label" style={{ color: theme.colors.ink }}>
            {formatMins(employee.worked_minutes)}
          </Text>
          {employee.overtime_minutes > 0 ? (
            <Badge
              variant="warning"
              size="sm"
              customLabel={`+${formatMins(employee.overtime_minutes)} OT`}
              style={{ marginLeft: 6 }}
            />
          ) : null}
        </View>

        <View style={styles.viewDetailBtn}>
          <Text variant="label" style={{ color: theme.colors.link }}>
            Daily Cards
          </Text>
          <ChevronRight size={14} color={theme.colors.link} />
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  employeeCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.md,
    marginBottom: spacingNumeric.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingNumeric.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  empAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBlock: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  empName: {
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacingNumeric.sm,
    paddingHorizontal: spacingNumeric.xs,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    marginBottom: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacingNumeric.xs,
    borderTopWidth: 1,
  },
  hoursItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

export const AttendanceEmployeeCard = React.memo<AttendanceEmployeeCardProps>(
  AttendanceEmployeeCardComponent,
  (prev, next) => {
    return (
      prev.employee.employee_id === next.employee.employee_id &&
      prev.employee.scheduled_days === next.employee.scheduled_days &&
      prev.employee.present_days === next.employee.present_days &&
      prev.employee.absent_days === next.employee.absent_days &&
      prev.employee.half_days === next.employee.half_days &&
      prev.employee.worked_minutes === next.employee.worked_minutes &&
      prev.employee.overtime_minutes === next.employee.overtime_minutes &&
      prev.employee.status === next.employee.status &&
      prev.searchQuery === next.searchQuery &&
      prev.onPress === next.onPress
    );
  }
);

export default AttendanceEmployeeCard;
