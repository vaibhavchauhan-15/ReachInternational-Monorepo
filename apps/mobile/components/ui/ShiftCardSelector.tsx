/**
 * ReachInternational Mobile — Canonical Reusable ShiftCardSelector
 * Matches web ShiftCardSelector (apps/web/components/operations/entry/ShiftCardSelector.tsx)
 * Features:
 * - Grow & shrink behavior: selected card grows (flex: 1.45), unselected cards shrink (flex: 1)
 * - 60fps smooth grow & shrink transitions across both web and native platforms
 * - Expanded state (selected): exactly 2 lines (Shift code / Night moon icon + Compact time range)
 * - Collapsed state (unselected): exactly 1 line (Shift code centered)
 * - Support for normal, logged, and conflict states
 * - 44px minimum touch targets and native tactile haptics
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  LayoutAnimation,
  UIManager,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from './ThemeProvider';
import { Moon } from 'lucide-react-native';
import { radiusNumeric } from '@reachinternational/design-tokens';
import { formatTo12Hour } from '@reachinternational/utils';

// Enable layout animations on Android if available
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface ShiftCardItem {
  id?: string;
  code: string;
  name?: string;
  start_time?: string;
  end_time?: string;
  crosses_midnight?: boolean;
  scheduled_minutes?: number;
}

export interface ShiftCardSelectorProps {
  shiftCodes: ShiftCardItem[];
  selectedCode?: string;
  onSelect: (shift: ShiftCardItem) => void;
  todayLoggedShiftCodes?: string[];
  isConflicting?: (code: string) => boolean;
  disabled?: boolean;
  containerStyle?: ViewStyle;
}

/**
 * Strips leading zero from hours and removes space before AM/PM.
 * e.g. "06:00 AM" -> "6:00AM", "02:00 PM" -> "2:00PM"
 */
export function formatCompactTime(timeStr?: string | null): string {
  if (!timeStr) return '';
  const formatted = formatTo12Hour(timeStr) || timeStr;
  return formatted.trim().replace(/^0(\d:)/, '$1').replace(/\s+(AM|PM)$/i, '$1');
}

/**
 * Formats start–end times as a tight single-string range.
 * Example: "6:00AM-2:00PM"
 */
export function formatCompactShiftRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return '';
  const s = formatCompactTime(start);
  const e = formatCompactTime(end);
  if (s && e) return `${s}-${e}`;
  return s || e || '';
}

/**
 * Returns formatted shift title e.g. "Shift A"
 */
export function getShiftDisplayTitle(sc: { code: string; name?: string }): string {
  if (!sc) return '';
  const code = (sc.code || '').replace(/^shift\s+/i, '').trim();
  return `Shift ${code}`;
}

export const ShiftCardSelector: React.FC<ShiftCardSelectorProps> = ({
  shiftCodes,
  selectedCode,
  onSelect,
  todayLoggedShiftCodes = [],
  isConflicting,
  disabled = false,
  containerStyle,
}) => {
  const { theme, isDark } = useTheme();

  if (!shiftCodes || shiftCodes.length === 0) {
    return null;
  }

  const handlePress = (sc: ShiftCardItem) => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {});
    if (Platform.OS !== 'web') {
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch {}
    }
    onSelect(sc);
  };

  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.container, containerStyle]}
    >
      {shiftCodes.map((sc) => {
        const scNorm = sc.code.replace(/^shift\s+/i, '').trim().toUpperCase();
        const selNorm = (selectedCode || '').replace(/^shift\s+/i, '').trim().toUpperCase();
        const isSelected =
          (selectedCode || '').toUpperCase() === sc.code.toUpperCase() ||
          (selNorm !== '' && selNorm === scNorm);

        const compactRange = formatCompactShiftRange(sc.start_time, sc.end_time);
        const isLogged = todayLoggedShiftCodes.some(
          (c) =>
            c.toUpperCase() === sc.code.toUpperCase() ||
            c.replace(/^shift\s+/i, '').trim().toUpperCase() === scNorm
        );
        const hasConflict = isConflicting ? Boolean(isConflicting(sc.code)) : false;

        // Background & border resolution
        let bg = theme.colors.canvasElevated;
        let borderColor = theme.colors.hairline;
        let textColor = theme.colors.ink;

        if (isSelected) {
          if (hasConflict) {
            bg = '#ef4444';
            borderColor = '#dc2626';
          } else if (isLogged) {
            bg = '#059669';
            borderColor = '#047857';
          } else {
            bg = '#0284c7';
            borderColor = '#0284c7';
          }
          textColor = '#ffffff';
        } else {
          if (hasConflict) {
            bg = isDark ? 'rgba(239, 68, 68, 0.12)' : '#fee2e2';
            borderColor = isDark ? 'rgba(239, 68, 68, 0.35)' : '#fca5a5';
            textColor = '#ef4444';
          } else if (isLogged) {
            bg = isDark ? 'rgba(16, 185, 129, 0.12)' : '#d1fae5';
            borderColor = isDark ? 'rgba(16, 185, 129, 0.35)' : '#a7f3d0';
            textColor = '#059669';
          } else {
            bg = theme.colors.canvas;
            borderColor = theme.colors.hairline;
            textColor = theme.colors.ink;
          }
        }

        return (
          <TouchableOpacity
            key={sc.id || sc.code}
            onPress={() => handlePress(sc)}
            activeOpacity={0.75}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${getShiftDisplayTitle(sc)}${compactRange ? `, ${compactRange}` : ''}`}
            style={[
              styles.card,
              {
                flex: isSelected ? 1.45 : 1,
                backgroundColor: bg,
                borderColor,
                opacity: disabled ? 0.6 : 1,
              },
            ]}
          >
            {isSelected ? (
              /* EXPANDED (SELECTED) STATE: Exactly TWO lines */
              <View style={styles.expandedContent}>
                <View style={styles.titleRow}>
                  <Text
                    numberOfLines={1}
                    style={[styles.expandedTitleText, { color: textColor }]}
                  >
                    {isLogged ? `✓ ${getShiftDisplayTitle(sc)}` : getShiftDisplayTitle(sc)}
                  </Text>
                  {sc.crosses_midnight && (
                    <Moon
                      size={10}
                      color="rgba(255, 255, 255, 0.85)"
                      style={{ marginLeft: 3 }}
                    />
                  )}
                </View>
                {compactRange ? (
                  <Text
                    numberOfLines={1}
                    style={[styles.timingText, { color: 'rgba(255, 255, 255, 0.95)' }]}
                  >
                    {compactRange}
                  </Text>
                ) : null}
              </View>
            ) : (
              /* COLLAPSED (UNSELECTED) STATE: Exactly ONE line */
              <View style={styles.collapsedContent}>
                <Text
                  numberOfLines={1}
                  style={[styles.collapsedTitleText, { color: textColor }]}
                >
                  {isLogged ? `✓ ${getShiftDisplayTitle(sc)}` : getShiftDisplayTitle(sc)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    width: '100%',
  },
  card: {
    minHeight: 44,
    height: 44,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    ...Platform.select({
      web: {
        transition: 'flex 0.22s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.18s ease, border-color 0.18s ease, transform 0.15s ease',
        cursor: 'pointer',
      } as any,
    }),
  },
  expandedContent: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
  },
  expandedTitleText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  timingText: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: -0.2,
  },
  collapsedContent: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  collapsedTitleText: {
    fontSize: 11.5,
    fontWeight: '700',
    textAlign: 'center',
  },
});
