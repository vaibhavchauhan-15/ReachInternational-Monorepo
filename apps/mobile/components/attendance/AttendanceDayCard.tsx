/**
 * ReachInternational Mobile — AttendanceDayCard Component
 * 
 * Strict Invariants:
 * - Vercel Geist design tokens (#171717 ink, hairline borders, muted washes)
 * - 0 raw typography properties in StyleSheet.create (enforced via <Text variant="...">)
 * - Minimum 44px touch targets on action elements (hitSlopToMin48)
 * - Tactile status badges (PRESENT, ABSENT, HALF_DAY, WEEK_OFF)
 */

import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { Clock, Truck, MapPin } from '../ui/icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface AttendanceDayEntry {
  id: string;
  machine_id: string;
  machine_code?: string;
  machine_name?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  shift_code?: string | null;
  start_time: string | null;
  end_time: string | null;
  start_meter: number | null;
  end_meter: number | null;
  running_hours: number;
  normal_working_hours: number;
  overtime_hours: number;
  is_breakdown: boolean;
  location: string | null;
}

export interface AttendanceDay {
  date: string;
  dow: number;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'WEEK_OFF' | 'DISABLED';
  worked_minutes: number;
  overtime_minutes: number;
  breakdown_minutes: number;
  log_count: number;
  punch_in?: string | null;
  punch_out?: string | null;
  entries: AttendanceDayEntry[];
}

export interface AttendanceDayCardProps {
  day: AttendanceDay;
  employeeShiftStart?: string | null;
  employeeShiftEnd?: string | null;
  isToday?: boolean;
  dayNum?: number;
  monthName?: string;
  dowShort?: string;
  isSunday?: boolean;
  isCardDimmed?: boolean;
  effectiveStatus?: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'WEEK_OFF' | 'DISABLED';
  hasWorked?: boolean;
  statusBadgeNode?: React.ReactNode;
  formatTimeAMPM?: (timeStr: string | null) => string;
  formatMins?: (minutes: number) => string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const defaultFormatMins = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const defaultFormatTimeAMPM = (t?: string | null) => {
  if (!t) return '—';
  const parts = t.trim().split(':');
  if (parts.length < 2) return t;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return t;
  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
};

const renderDefaultStatusBadge = (
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'WEEK_OFF' | 'DISABLED',
  isToday: boolean
) => {
  switch (status) {
    case 'PRESENT':
      return <Badge variant="success" dot size="sm" customLabel="Present" />;
    case 'HALF_DAY':
      return <Badge variant="warning" dot size="sm" customLabel="Half Day" />;
    case 'WEEK_OFF':
      return <Badge variant="neutral" dot size="sm" customLabel="Rest Day" />;
    case 'DISABLED':
      return (
        <Badge
          variant="neutral"
          dot
          size="sm"
          customLabel={isToday ? 'In Progress' : 'Upcoming'}
        />
      );
    case 'ABSENT':
    default:
      return <Badge variant="error" dot size="sm" customLabel="Absent" />;
  }
};

const AttendanceDayCardComponent: React.FC<AttendanceDayCardProps> = ({
  day,
  employeeShiftStart,
  employeeShiftEnd,
  isToday = false,
  dayNum,
  monthName,
  dowShort,
  isSunday,
  isCardDimmed = false,
  effectiveStatus,
  hasWorked,
  statusBadgeNode,
  formatTimeAMPM,
  formatMins,
  style,
  testID = 'attendance-day-card',
}) => {
  const { theme, isDark } = useTheme();

  // Derive date metadata if not explicitly provided
  let computedDayNum = dayNum;
  let computedMonthName = monthName;
  let computedDowShort = dowShort;
  let computedIsSunday = isSunday;

  if (computedDayNum === undefined || !computedMonthName || !computedDowShort || computedIsSunday === undefined) {
    const [, mStr, dStr] = (day.date || '').split('-');
    const mIdx = parseInt(mStr, 10) - 1;
    computedDayNum = computedDayNum ?? (parseInt(dStr, 10) || 1);
    computedMonthName = computedMonthName || (MONTH_NAMES[mIdx] ?? '');
    computedDowShort = computedDowShort || (DOW_NAMES[day.dow] ?? '');
    computedIsSunday = computedIsSunday ?? (day.dow === 0);
  }

  const computedEffectiveStatus: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'WEEK_OFF' | 'DISABLED' =
    effectiveStatus ?? day.status;
  const computedHasWorked =
    hasWorked ?? (day.worked_minutes > 0 || (day.entries && day.entries.length > 0));
  const timeFormatter = formatTimeAMPM ?? defaultFormatTimeAMPM;
  const minsFormatter = formatMins ?? defaultFormatMins;
  const badgeNode = statusBadgeNode ?? renderDefaultStatusBadge(computedEffectiveStatus, isToday);

  return (
    <View
      testID={testID}
      style={[
        styles.dayCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: isToday ? theme.colors.link : theme.colors.hairline,
          opacity: isCardDimmed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {/* Card Header: Date & Day of Week, Today Badge, Status Badge */}
      <View
        style={[
          styles.dayCardHeader,
          { borderBottomColor: theme.colors.hairline },
        ]}
      >
        <View style={styles.dayCardDateRow}>
          <Text
            variant="label"
            style={{ color: isToday ? theme.colors.link : theme.colors.ink }}
          >
            {computedDayNum} {computedMonthName}
          </Text>
          <Text
            variant="caption"
            style={{ color: computedIsSunday ? '#ef4444' : theme.colors.mute }}
          >
            • {computedDowShort}{computedIsSunday ? ' (Rest)' : ''}
          </Text>
          {isToday && (
            <Badge variant="default" size="sm" customLabel="TODAY" />
          )}
        </View>

        {badgeNode}
      </View>

      {/* Card Body: Worked Hours, Shift, Machine, Location */}
      {computedHasWorked ? (
        <View style={styles.dayCardContent}>
          {/* Hours & Shift Box */}
          <View
            style={[
              styles.dayHoursWell,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={styles.dayPunchesCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Clock size={12} color={theme.colors.mute} />
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  SHIFT
                </Text>
              </View>
              <Text variant="small" style={{ color: theme.colors.ink }}>
                {day.punch_in && day.punch_out
                  ? `${timeFormatter(day.punch_in ?? null)} – ${timeFormatter(day.punch_out ?? null)}`
                  : employeeShiftStart && employeeShiftEnd
                  ? `${timeFormatter(employeeShiftStart ?? null)} – ${timeFormatter(employeeShiftEnd ?? null)}`
                  : '06:00 AM – 02:00 PM'}
              </Text>
            </View>

            <View style={styles.dayWorkedCol}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                WORKED
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text variant="small" style={{ color: theme.colors.ink }}>
                  {minsFormatter(day.worked_minutes)}
                </Text>
                {day.overtime_minutes > 0 && (
                  <Badge
                    variant="warning"
                    size="sm"
                    customLabel={`+${minsFormatter(day.overtime_minutes)} OT`}
                  />
                )}
              </View>
            </View>
          </View>

          {/* Entries (Machinery & Location) */}
          {day.entries && day.entries.length > 0 && (
            <View style={styles.dayEntriesStack}>
              {day.entries.map((entry, idx) => (
                <View
                  key={entry.id || idx}
                  style={[
                    styles.dayEntryCard,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <View style={styles.dayEntryRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Truck size={13} color={theme.colors.link} />
                      <Text variant="small" style={{ color: theme.colors.ink }} numberOfLines={1}>
                        {entry.machine_code || 'Machinery'}
                        {entry.machine_name ? ` • ${entry.machine_name}` : entry.model ? ` • ${entry.model}` : ''}
                      </Text>
                    </View>
                    {entry.shift_code && (
                      <Badge
                        variant="outline"
                        size="sm"
                        customLabel={`Shift ${entry.shift_code}`}
                      />
                    )}
                  </View>

                  <View style={[styles.dayEntryMetaRow, { marginTop: 4 }]}>
                    {entry.location ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                        <MapPin size={11} color={theme.colors.mute} />
                        <Text variant="caption" style={{ color: theme.colors.mute }} numberOfLines={1}>
                          {entry.location}
                        </Text>
                      </View>
                    ) : null}

                    {entry.is_breakdown ? (
                      <Badge
                        variant="error"
                        size="sm"
                        customLabel={entry.running_hours ? 'Breakdown' : 'Machine Breakdown'}
                      />
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        /* Non-worked informative message */
        <View
          style={[
            styles.dayEmptyStateWell,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Text variant="caption" style={{ color: theme.colors.mute, textAlign: 'center' }}>
            {computedEffectiveStatus === 'WEEK_OFF'
              ? 'Scheduled Rest Day — No running log entry required.'
              : isToday
              ? 'Shift in progress or pending submission for today.'
              : 'No operational shift entries recorded on this calendar day.'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  dayCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.md,
    marginBottom: spacingNumeric.sm,
  },
  dayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  dayCardDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayCardContent: {
    paddingTop: spacingNumeric.sm,
  },
  dayHoursWell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  dayPunchesCol: {
    gap: 2,
  },
  dayWorkedCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  dayEntriesStack: {
    gap: 6,
  },
  dayEntryCard: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  dayEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayEntryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayEmptyStateWell: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginTop: spacingNumeric.sm,
  },
});

export const AttendanceDayCard = React.memo<AttendanceDayCardProps>(
  AttendanceDayCardComponent,
  (prev, next) => {
    return (
      prev.day.date === next.day.date &&
      prev.day.status === next.day.status &&
      prev.day.worked_minutes === next.day.worked_minutes &&
      prev.day.overtime_minutes === next.day.overtime_minutes &&
      prev.day.punch_in === next.day.punch_in &&
      prev.day.punch_out === next.day.punch_out &&
      prev.day.entries?.length === next.day.entries?.length &&
      prev.isToday === next.isToday &&
      prev.isCardDimmed === next.isCardDimmed &&
      prev.effectiveStatus === next.effectiveStatus &&
      prev.hasWorked === next.hasWorked &&
      prev.employeeShiftStart === next.employeeShiftStart &&
      prev.employeeShiftEnd === next.employeeShiftEnd
    );
  }
);

export default AttendanceDayCard;
