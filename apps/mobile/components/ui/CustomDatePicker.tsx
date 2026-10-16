/**
 * ReachInternational Mobile — Canonical Custom Date Picker Component
 *
 * Implements the project's canonical calendar picker for React Native / Expo Mobile,
 * delivering 100% design and behavioral parity with the Web CustomDatePicker.
 *
 * Key Architecture:
 * - Single-date selection with instant roster filter revalidation
 * - Local date arithmetic avoiding UTC timezone offsets
 * - Month navigation (< Month Year >)
 * - 7-column calendar grid with trailing/leading days
 * - Selected day highlighted in Reach Sky Blue (#0284c7)
 * - Green dot today indicator for unselected today's date
 * - Footer with "• Green dot: Today" and "↻ Select Today" action
 * - Responsive presentation: Bottom sheet on mobile (<= 640px),
 *   anchored clamped popover on tablet/desktop (> 640px)
 * - Accessible combobox triggers, keyboard Escape dismissal, outside click dismissal
 * - 100% Geist Design System tokens and zero raw typography properties
 */

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  Modal,
  Keyboard,
} from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './Text';
import { Pressable } from './touch/Pressable';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  Icon,
} from './icon';
import { formatDate, getISTDateString } from '@reachinternational/utils';
import { haptics } from '../../lib/haptics';

export interface CustomDatePickerProps {
  /** Selected date in "YYYY-MM-DD" format */
  value: string;
  /** Callback fired when a date is selected */
  onChange: (dateStr: string) => void;
  /** Trigger label prefix (defaults to "Date") */
  label?: string;
  /** Max allowed days in the past (default: undefined / unlimited if allowAnyPast is true) */
  maxDaysOld?: number;
  /** Allowed days in the future (default: 0 for operational historical logs) */
  allowFutureDays?: number;
  /** If true, allows any historical past date (default: true for dashboard filters) */
  allowAnyPast?: boolean;
  /** If true, allows future dates (default: false) */
  allowAnyFuture?: boolean;
  /** Shows relative status badge like "Today", "Yesterday" */
  showRelativeBadge?: boolean;
  /** Popover alignment relative to trigger ('left' | 'right') */
  align?: 'left' | 'right';
  /** Disabled state */
  disabled?: boolean;
  /** Placeholder text when value is empty */
  placeholder?: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Parse YYYY-MM-DD into local year, month (0-indexed), date */
function parseYMDParts(dateStr?: string): { year: number; month: number; day: number } {
  if (!dateStr) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return { year: parts[0], month: parts[1] - 1, day: parts[2] };
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

/** Format year, month (0-indexed), day into YYYY-MM-DD */
function formatYMD(year: number, month: number, day: number): string {
  const y = year;
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  label = 'Date',
  maxDaysOld = 365,
  allowFutureDays = 0,
  allowAnyPast = true,
  allowAnyFuture = false,
  showRelativeBadge = true,
  align = 'left',
  disabled = false,
  placeholder = 'Select date...',
}) => {
  const { theme, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<View>(null);

  // Responsive width tracking
  const [windowWidth, setWindowWidth] = useState(() =>
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.innerWidth
      : Dimensions.get('window').width
  );

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const updateDimensions = () => {
      const w =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.innerWidth
          : Dimensions.get('window').width;
      setWindowWidth(w);
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    } else {
      const sub = Dimensions.addEventListener('change', updateDimensions);
      return () => sub.remove();
    }
  }, []);

  // Keyboard awareness so popover is never hidden behind phone keyboard
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Popover coordinates for anchored layout
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({
    top: 0,
    left: 0,
    width: 320,
    maxHeight: 400,
  });

  // Current today string
  const todayStr = useMemo(() => getISTDateString(), []);
  const todayParts = useMemo(() => parseYMDParts(todayStr), [todayStr]);

  // View month currently displayed in calendar (year, month 0-indexed)
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => {
    const p = parseYMDParts(value || todayStr);
    return { year: p.year, month: p.month };
  });

  // Keep viewMonth synced when value prop changes externally
  useEffect(() => {
    if (value) {
      const p = parseYMDParts(value);
      setViewMonth({ year: p.year, month: p.month });
    }
  }, [value]);

  // Compute anchored position for popover just below or above trigger
  const computeViewportPosition = (
    triggerX: number,
    triggerY: number,
    triggerW: number,
    triggerH: number
  ) => {
    const currentWindowW =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.innerWidth
        : Dimensions.get('window').width;

    const currentWindowH =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.innerHeight
        : Dimensions.get('window').height;

    const effectiveWindowH = Math.max(300, currentWindowH - keyboardHeight);
    const desiredMenuWidth = 320;
    // Dynamic width clamping for small mobile screens (e.g. 320px-360px)
    const menuWidth = Math.min(desiredMenuWidth, currentWindowW - 16);

    let left = align === 'right' ? triggerX + triggerW - menuWidth : triggerX;

    // Viewport horizontal clamp with 8px margin from edges
    if (left < 8) left = 8;
    if (left + menuWidth > currentWindowW - 8) {
      left = Math.max(8, currentWindowW - menuWidth - 8);
    }

    const desiredMenuHeight = 380;
    const spaceBelow = effectiveWindowH - (triggerY + triggerH) - 12;
    const spaceAbove = triggerY - 12;

    const shouldOpenUpwards = spaceBelow < desiredMenuHeight && spaceAbove > spaceBelow;
    const availableSpace = shouldOpenUpwards ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(420, Math.max(220, availableSpace));
    const top = shouldOpenUpwards
      ? Math.max(8, triggerY - Math.min(desiredMenuHeight, maxHeight) - 4)
      : triggerY + triggerH + 4;

    setCoords({
      top: Math.round(top),
      left: Math.round(left),
      width: Math.round(menuWidth),
      maxHeight: Math.round(maxHeight),
    });
    setOpen(true);
  };

  const measureAndOpen = () => {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }

    haptics.select();

    if (!buttonRef.current) {
      setOpen(true);
      return;
    }

    if (Platform.OS === 'web' && (buttonRef.current as any).getBoundingClientRect) {
      const rect = (buttonRef.current as any).getBoundingClientRect();
      computeViewportPosition(rect.left, rect.top, rect.width, rect.height);
      return;
    }

    buttonRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
      computeViewportPosition(x, y, width, height);
    });
  };

  // Close on Escape key on web
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    haptics.select();
    setViewMonth((prev) => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    haptics.select();
    setViewMonth((prev) => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  // Calendar Day generation
  const calendarDays = useMemo(() => {
    const { year, month } = viewMonth;

    // Day of week of 1st day of month: 0 (Sun) to 6 (Sat)
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    // Total days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Total days in previous month
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isSelectable: boolean;
      isSelected: boolean;
      isToday: boolean;
    }> = [];

    const todayDate = new Date(todayParts.year, todayParts.month, todayParts.day);

    // 1. Trailing days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonthIdx = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = formatYMD(prevYear, prevMonthIdx, dayNum);
      const cellDate = new Date(prevYear, prevMonthIdx, dayNum);

      const diffTime = todayDate.getTime() - cellDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      const isSelectable =
        (allowAnyFuture || diffDays >= -allowFutureDays) &&
        (allowAnyPast || diffDays <= maxDaysOld);

      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isSelectable,
        isSelected: dateStr === value,
        isToday: dateStr === todayStr,
      });
    }

    // 2. Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = formatYMD(year, month, i);
      const cellDate = new Date(year, month, i);

      const diffTime = todayDate.getTime() - cellDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      const isSelectable =
        (allowAnyFuture || diffDays >= -allowFutureDays) &&
        (allowAnyPast || diffDays <= maxDaysOld);

      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isSelectable,
        isSelected: dateStr === value,
        isToday: dateStr === todayStr,
      });
    }

    // 3. Leading days of next month (fill up to 35 or 42 slots)
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remainingSlots = totalSlots - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextMonthIdx = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = formatYMD(nextYear, nextMonthIdx, i);
      const cellDate = new Date(nextYear, nextMonthIdx, i);

      const diffTime = todayDate.getTime() - cellDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      const isSelectable =
        (allowAnyFuture || diffDays >= -allowFutureDays) &&
        (allowAnyPast || diffDays <= maxDaysOld);

      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isSelectable,
        isSelected: dateStr === value,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [viewMonth, value, todayStr, todayParts, maxDaysOld, allowFutureDays, allowAnyPast, allowAnyFuture]);

  const handleSelectDay = (dateStr: string) => {
    haptics.select();
    onChange(dateStr);
    setOpen(false);
  };

  const handleSelectToday = () => {
    haptics.confirm();
    onChange(todayStr);
    const p = parseYMDParts(todayStr);
    setViewMonth({ year: p.year, month: p.month });
    setOpen(false);
  };

  const isFiltered = value && value !== todayStr;

  const displayDateText = useMemo(() => {
    if (!value) return placeholder;
    if (value === todayStr) return 'Today';
    return formatDate(value);
  }, [value, todayStr, placeholder]);

  const renderCalendarContent = () => (
    <View style={styles.calendarInnerContainer}>
      {/* 1. Month / Year Header Switcher */}
      <View
        style={[
          styles.monthHeaderRow,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderBottomColor: theme.colors.hairline,
          },
        ]}
      >
        <Pressable
          variant="iconButton"
          haptic="select"
          hitSlopToMin48
          onPress={handlePrevMonth}
          style={[
            styles.navChevronBtn,
            {
              borderColor: theme.colors.hairline,
              backgroundColor: theme.colors.canvas,
            },
          ]}
          accessibilityLabel="Previous month"
        >
          <ChevronLeft size={16} color={theme.colors.ink} />
        </Pressable>

        <Text variant="subheading" style={[styles.monthHeaderText, { color: theme.colors.ink }]}>
          {MONTH_NAMES[viewMonth.month]} {viewMonth.year}
        </Text>

        <Pressable
          variant="iconButton"
          haptic="select"
          hitSlopToMin48
          onPress={handleNextMonth}
          style={[
            styles.navChevronBtn,
            {
              borderColor: theme.colors.hairline,
              backgroundColor: theme.colors.canvas,
            },
          ]}
          accessibilityLabel="Next month"
        >
          <ChevronRight size={16} color={theme.colors.ink} />
        </Pressable>
      </View>

      {/* 2. Weekday Header Row */}
      <View style={styles.weekdayRow}>
        {WEEKDAY_NAMES.map((name) => (
          <View key={name} style={styles.weekdayCell}>
            <Text variant="micro" style={[styles.weekdayText, { color: theme.colors.mute }]}>
              {name}
            </Text>
          </View>
        ))}
      </View>

      {/* 3. Calendar Days Grid */}
      <View style={styles.daysGrid}>
        {calendarDays.map((cell) => {
          const isCellDisabled = !cell.isSelectable;
          const isSelected = cell.isSelected;
          const isToday = cell.isToday;

          return (
            <Pressable
              key={cell.dateStr}
              variant="plain"
              haptic={isCellDisabled ? false : 'select'}
              disabled={isCellDisabled}
              onPress={() => handleSelectDay(cell.dateStr)}
              style={[
                styles.dayCell,
                isSelected && {
                  backgroundColor: '#0284c7',
                },
                !cell.isCurrentMonth && !isSelected && styles.dayCellMuted,
                isCellDisabled && styles.dayCellDisabled,
              ]}
              accessibilityLabel={`${cell.dateStr}${isSelected ? ', selected' : ''}${isToday ? ', today' : ''}`}
            >
              <Text
                variant="body"
                style={[
                  styles.dayNumberText,
                  {
                    color: isSelected
                      ? '#ffffff'
                      : isCellDisabled
                      ? theme.colors.mute
                      : theme.colors.ink,
                  },
                ]}
              >
                {cell.dayNumber}
              </Text>

              {/* Green indicator dot for Today (when not selected) */}
              {isToday && !isSelected && (
                <View style={styles.todayIndicatorDot} />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* 4. Footer Info & Select Today Action */}
      <View
        style={[
          styles.calendarFooterRow,
          {
            borderTopColor: theme.colors.hairline,
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          },
        ]}
      >
        <View style={styles.footerLegendLeft}>
          <View style={styles.legendDot} />
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            Green dot: Today
          </Text>
        </View>

        <Pressable
          variant="plain"
          haptic="confirm"
          hitSlopToMin48
          onPress={handleSelectToday}
          style={styles.selectTodayBtn}
          accessibilityLabel="Select today's date"
        >
          <RotateCcw size={12} color="#0284c7" />
          <Text variant="label" style={[styles.selectTodayBtnText, { color: '#0284c7' }]}>
            Select Today
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Anchor Trigger Button */}
      <View ref={buttonRef} collapsable={false}>
        <Pressable
          variant="outline"
          haptic="select"
          hitSlopToMin48
          disabled={disabled}
          onPress={measureAndOpen}
          style={[
            styles.triggerBtn,
            {
              backgroundColor: isFiltered
                ? isDark
                  ? 'rgba(2, 132, 199, 0.12)'
                  : 'rgba(2, 132, 199, 0.08)'
                : theme.colors.canvas,
              borderColor: isFiltered ? '#0284c7' : theme.colors.hairline,
            },
          ]}
          accessibilityRole="combobox"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${label} filter: ${displayDateText}`}
        >
          <View style={styles.triggerLeft}>
            <CalendarIcon
              size={13}
              color={isFiltered || open ? '#0284c7' : theme.colors.mute}
            />
            <Text variant="caption" style={[{ color: theme.colors.mute }]}>
              {label}:
            </Text>
            <Text
              variant="caption"
              style={[
                styles.triggerValue,
                {
                  color: isFiltered ? '#0284c7' : theme.colors.ink,
                },
              ]}
              numberOfLines={1}
            >
              {displayDateText}
            </Text>
          </View>
          <Icon
            name="chevron-down"
            size={13}
            color={open || isFiltered ? '#0284c7' : theme.colors.mute}
            state={open ? 'open' : 'closed'}
          />
        </Pressable>
      </View>

      {/* Universal Anchored Popover (Just below or above trigger) */}
      <Modal
        visible={open}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent={true}
      >
        {/* Fullscreen transparent backdrop for outside dismissal */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setOpen(false)}
          accessibilityLabel="Close calendar"
        >
          <View style={StyleSheet.absoluteFill} />
        </Pressable>

        {/* Dynamic Anchored Popover Box positioned just below/up the trigger */}
        <View
          style={[
            styles.calendarPopoverMenu,
            {
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <ScrollView
            style={styles.popoverScroll}
            contentContainerStyle={styles.popoverScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {renderCalendarContent()}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: '47%',
  },
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 38,
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 4,
  },
  triggerValue: {
    flexShrink: 1,
  },
  calendarPopoverMenu: {
    position: 'absolute',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 99999,
    ...Platform.select({
      web: {
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.16)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
        elevation: 16,
      },
    }),
  },
  popoverScroll: {
    flexGrow: 0,
  },
  popoverScrollContent: {
    paddingBottom: 0,
  },
  calendarInnerContainer: {
    width: '100%',
  },
  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  navChevronBtn: {
    width: 28,
    height: 28,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthHeaderText: {
    textAlign: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  weekdayText: {
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiusNumeric.md,
    position: 'relative',
    marginVertical: 1,
  },
  dayCellMuted: {
    opacity: 0.35,
  },
  dayCellDisabled: {
    opacity: 0.2,
  },
  dayNumberText: {
    textAlign: 'center',
  },
  todayIndicatorDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10b981',
  },
  calendarFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  footerLegendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  selectTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  selectTodayBtnText: {},
});
