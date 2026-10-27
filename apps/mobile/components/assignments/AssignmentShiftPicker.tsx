/**
 * ReachInternational Mobile — Assignment Shift Picker
 *
 * Touch-optimized shift selector for machine-operator assignments.
 * Supports S1, S2, S3 or custom client shift codes, 12-hour start/end time display,
 * visual time-of-day iconography (Sun, Moon, Clock), occupied shift badges,
 * and real-time conflict warnings.
 *
 * Invariants:
 * - Minimum 44px touch targets
 * - Zero raw typography properties in StyleSheet.create
 * - Vercel Geist design tokens and Light/Dark theme synchronization
 */

import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { Text } from '../ui/Text';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { formatTo12Hour } from '@reachinternational/utils';
import { Sun, Moon, Clock, AlertCircle, Check } from '../ui/icon';
import { Pressable } from '../ui/touch/Pressable';
import { haptics } from '../../lib/haptics';

export interface ShiftPickerOption {
  code: string;
  name?: string;
  start_time: string;
  end_time: string;
  crosses_midnight?: boolean;
}

export interface AssignmentShiftPickerProps {
  shifts: ShiftPickerOption[];
  selectedShiftCode: string;
  onSelectShift: (code: string) => void;
  occupiedShiftCodes?: string[];
  conflictWarning?: string | null;
  disabled?: boolean;
}

export const AssignmentShiftPicker: React.FC<AssignmentShiftPickerProps> = ({
  shifts,
  selectedShiftCode,
  onSelectShift,
  occupiedShiftCodes = [],
  conflictWarning,
  disabled = false,
}) => {
  const { theme, isDark } = useTheme();

  const getShiftIcon = (shift: ShiftPickerOption) => {
    if (shift.crosses_midnight || shift.code === 'S3') {
      return <Moon size={14} color="#818cf8" />;
    }
    if (shift.code === 'S1') {
      return <Sun size={14} color="#f59e0b" />;
    }
    return <Clock size={14} color="#0284c7" />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text variant="caption" weight="semibold" style={{ color: theme.colors.mute }}>
          SELECT SHIFT ROTATION *
        </Text>
        <Text variant="micro" style={{ color: theme.colors.mute }}>
          24h Continuous
        </Text>
      </View>

      {/* Shift Option Buttons */}
      <View style={styles.shiftsGrid}>
        {shifts.map((shift) => {
          const isSelected = selectedShiftCode === shift.code;
          const isOccupied = occupiedShiftCodes.includes(shift.code);
          const formattedStart = formatTo12Hour(shift.start_time) || shift.start_time;
          const formattedEnd = formatTo12Hour(shift.end_time) || shift.end_time;

          return (
            <Pressable
              key={shift.code}
              onPress={() => {
                if (disabled) return;
                haptics.select();
                onSelectShift(shift.code);
              }}
              disabled={disabled}
              style={[
                styles.shiftButton,
                {
                  backgroundColor: isSelected
                    ? isDark
                      ? 'rgba(2, 132, 199, 0.16)'
                      : 'rgba(2, 132, 199, 0.08)'
                    : theme.colors.canvasElevated,
                  borderColor: isSelected
                    ? theme.colors.primary
                    : isOccupied
                    ? isDark ? '#b45309' : '#fde68a'
                    : theme.colors.hairline,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={`Shift ${shift.code}, ${formattedStart} to ${formattedEnd}`}
            >
              <View style={styles.shiftTop}>
                <View style={styles.shiftCodeRow}>
                  {getShiftIcon(shift)}
                  <Text
                    variant="body"
                    weight="bold"
                    style={{
                      color: isSelected ? theme.colors.primary : theme.colors.ink,
                    }}
                  >
                    {shift.code}
                  </Text>
                </View>
                {isOccupied && (
                  <View
                    style={[
                      styles.occupiedBadge,
                      {
                        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
                        borderColor: isDark ? '#b45309' : '#fde68a',
                      },
                    ]}
                  >
                    <Text variant="micro" weight="medium" style={{ color: '#d97706' }}>
                      OCCUPIED
                    </Text>
                  </View>
                )}
                {isSelected && (
                  <View
                    style={[
                      styles.checkCircle,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    <Check size={10} color="#ffffff" />
                  </View>
                )}
              </View>

              <Text
                variant="micro"
                style={{
                  color: isSelected ? theme.colors.primary : theme.colors.mute,
                }}
              >
                {formattedStart} – {formattedEnd}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Conflict Warning Notice */}
      {conflictWarning && (
        <View
          style={[
            styles.conflictNotice,
            {
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
              borderColor: isDark ? '#b45309' : '#fde68a',
            },
          ]}
        >
          <AlertCircle size={14} color="#d97706" style={{ marginTop: 1 }} />
          <Text variant="caption" style={[styles.conflictText, { color: isDark ? '#fde68a' : '#92400e' }]}>
            {conflictWarning}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacingNumeric.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacingNumeric.xs,
  },
  shiftsGrid: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
  },
  shiftButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: radiusNumeric.md,
    borderWidth: 1.5,
    padding: spacingNumeric.sm,
    justifyContent: 'center',
    gap: 4,
  },
  shiftTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shiftCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  occupiedBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radiusNumeric.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
  checkCircle: {
    width: 16,
    height: 16,
    borderRadius: radiusNumeric.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conflictNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacingNumeric.sm,
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacingNumeric.xs,
  },
  conflictText: {
    flex: 1,
  },
});
