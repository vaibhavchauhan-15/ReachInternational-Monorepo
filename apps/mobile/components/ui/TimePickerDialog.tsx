/**
 * ReachInternational Mobile — Android 16 / Material 3 Clock Time Picker Dialog
 * Redesigned for buttery-smooth mobile touch ergonomics, tactile haptics,
 * clean sans typography, and seamless switching between Dial and Keyboard modes.
 *
 * Architecture & Features:
 *  - Android 16 / Material 3 Clock UI: Modern rounded containers, accent-filled active
 *    states, clean sans-serif typography, and zero visual clutter.
 *  - Robust Inline Validation & Error Handling:
 *    - Real-time validation for Hour (1–12) and Minute (00–59).
 *    - Short, informative error messages ("Hour must be 1–12", "Minute must be 0–59", etc.).
 *    - High-contrast red highlight (#ef4444) on invalid boxes with zero layout jitter.
 *    - Rejection haptics and focus management preventing submission of invalid times.
 *  - 100% Zero-Jitter Touch Dial: Dedicated child-free touch responder overlay with
 *    SVG vector hand line and selector disc.
 *  - Clean Minute Face: Clean 5-minute numerals (00..55) with zero clutter dots for an
 *    ultra-lightweight 3-node SVG render tree and buttery-smooth 60/120fps dragging.
 *  - Transparent Text Selection: Zero blue selection box on focus in keyboard mode;
 *    hairline Reach Sky Blue cursor for native clarity.
 *  - Dual Mode Support (Dial + Keyboard):
 *    - Dial Mode: Interactive circular clock face with smooth dragging and auto-advance.
 *    - Keyboard Mode: Direct numeric inputs with "Hour" & "Minute" sublabels and auto-focus advance.
 *    - Mode Toggle: Bottom-left icon button switches instantly between Keyboard & Clock modes.
 *  - Zero Raw Typography Violations: Strict adherence to canonical <Text variant="...">
 *    and useTypeStyle() hooks.
 *  - Reach Design Tokens: 100% synchronized light/dark palette, Reach Sky Blue (#0284c7 / #38bdf8),
 *    and minimum 48px touch ergonomics.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  PanResponder,
  useWindowDimensions,
  TextInput,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useTheme } from './ThemeProvider';
import { Text, useTypeStyle } from './Text';
import { Pressable } from './touch/Pressable';
import { haptics } from '../../lib/haptics';
import { Clock, Keyboard } from './icon';

export interface TimeOfDay {
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
}

export interface TimePickerDialogProps {
  /** Controls modal visibility */
  visible: boolean;
  /** Initial time value */
  initialTime?: TimeOfDay | string;
  /** Called when user confirms with selected time */
  onConfirm: (selected: {
    hour: number;
    minute: number;
    period: 'AM' | 'PM';
    formatted: string;
  }) => void;
  /** Called when user cancels or dismisses the dialog */
  onClose: () => void;
  /** Option to provide custom text for Cancel button. Defaults to 'Cancel' */
  cancelText?: string;
  /** Option to provide custom text for Confirm button. Defaults to 'OK' */
  confirmText?: string;
  /** Optional header text. Defaults to 'Select time' */
  helpText?: string;
  /** Initial input mode. Defaults to 'dial' */
  initialMode?: 'dial' | 'keyboard';
}

/**
 * Parses TimeOfDay or string into { hour: number, minute: number, period: 'AM' | 'PM' }
 */
export function parseInitialTime(val?: TimeOfDay | string): TimeOfDay {
  if (!val) {
    return { hour: 8, minute: 0, period: 'AM' };
  }
  if (typeof val === 'object' && 'hour' in val) {
    const h = Math.max(1, Math.min(12, val.hour || 8));
    const m = Math.max(0, Math.min(59, val.minute || 0));
    const p = val.period === 'PM' ? 'PM' : 'AM';
    return { hour: h, minute: m, period: p };
  }
  if (typeof val === 'string') {
    const clean = val.trim().toUpperCase();
    const match = clean.match(/^(\d{1,2}):(\d{1,2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (match) {
      let rawH = parseInt(match[1], 10);
      let rawM = parseInt(match[2], 10);
      let p: 'AM' | 'PM' = (match[3] || 'AM').toUpperCase() as 'AM' | 'PM';
      if (!match[3] && rawH >= 12) {
        p = 'PM';
        rawH = rawH % 12;
      }
      if (rawH === 0) rawH = 12;
      if (isNaN(rawH) || rawH < 1 || rawH > 12) rawH = 8;
      if (isNaN(rawM) || rawM < 0 || rawM > 59) rawM = 0;
      return { hour: rawH, minute: rawM, period: p };
    }
  }
  return { hour: 8, minute: 0, period: 'AM' };
}

/** Formats TimeOfDay into "HH:MM A" */
export function formatTimeOfDay(hour: number, minute: number, period: 'AM' | 'PM'): string {
  const h = String(hour).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  return `${h}:${m} ${period}`;
}

const DIAL_DIAMETER = 256;
const DIAL_RADIUS = DIAL_DIAMETER / 2; // 128
const NUM_RADIUS = 96; // Distance from dial center to number ring
const SELECTOR_RADIUS = 20; // 40dp diameter selector bubble

// Precomputed 12-hour dial positions (1 to 12)
const STATIC_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => {
  const clockDeg = (h % 12) * 30;
  const cartesianRad = ((clockDeg - 90) * Math.PI) / 180;
  return {
    value: h,
    x: DIAL_RADIUS + NUM_RADIUS * Math.cos(cartesianRad),
    y: DIAL_RADIUS + NUM_RADIUS * Math.sin(cartesianRad),
    angleDeg: clockDeg,
  };
});

// Precomputed 5-minute major dial positions (00, 05, ..., 55)
const STATIC_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => {
  const clockDeg = m * 6;
  const cartesianRad = ((clockDeg - 90) * Math.PI) / 180;
  return {
    value: m,
    label: String(m).padStart(2, '0'),
    x: DIAL_RADIUS + NUM_RADIUS * Math.cos(cartesianRad),
    y: DIAL_RADIUS + NUM_RADIUS * Math.sin(cartesianRad),
    angleDeg: clockDeg,
  };
});

export const TimePickerDialog: React.FC<TimePickerDialogProps> = ({
  visible,
  initialTime,
  onConfirm,
  onClose,
  cancelText = 'Cancel',
  confirmText = 'OK',
  helpText,
  initialMode = 'dial',
}) => {
  const { theme, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const heroStyle = useTypeStyle('hero');

  // Input mode: 'dial' (clock face) vs 'keyboard' (numeric inputs)
  const [mode, setMode] = useState<'dial' | 'keyboard'>(initialMode);

  // Active dial/input unit: 'hour' | 'minute'
  const [activeUnit, setActiveUnit] = useState<'hour' | 'minute'>('hour');

  // Selected time state
  const [selectedHour, setSelectedHour] = useState<number>(8);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');

  // Keyboard text input state
  const [hourInputText, setHourInputText] = useState<string>('08');
  const [minuteInputText, setMinuteInputText] = useState<string>('00');

  // Text input refs for keyboard mode auto-advance
  const hourInputRef = useRef<TextInput>(null);
  const minuteInputRef = useRef<TextInput>(null);

  // Dial layout reference for rock-solid window coordinate tracking
  const dialRef = useRef<View>(null);
  const dialScreenCoord = useRef<{ x: number; y: number } | null>(null);

  // Sync internal state when dialog opens or initialTime changes
  useEffect(() => {
    if (visible) {
      const parsed = parseInitialTime(initialTime);
      setSelectedHour(parsed.hour);
      setSelectedMinute(parsed.minute);
      setSelectedPeriod(parsed.period);
      setHourInputText(String(parsed.hour).padStart(2, '0'));
      setMinuteInputText(String(parsed.minute).padStart(2, '0'));
      setActiveUnit('hour');
      setMode(initialMode);
    }
  }, [visible, initialTime, initialMode]);

  // Validation logic for keyboard inputs (Hour: 1–12, Minute: 0–59)
  const validation = useMemo(() => {
    const trimmedH = hourInputText.trim();
    const trimmedM = minuteInputText.trim();

    let hourError: string | null = null;
    let minuteError: string | null = null;

    if (trimmedH === '') {
      hourError = 'Enter hour';
    } else {
      const h = parseInt(trimmedH, 10);
      if (isNaN(h) || h < 1 || h > 12) {
        hourError = 'Hour must be 1–12';
      }
    }

    if (trimmedM === '') {
      minuteError = 'Enter minute';
    } else {
      const m = parseInt(trimmedM, 10);
      if (isNaN(m) || m < 0 || m > 59) {
        minuteError = 'Minute must be 0–59';
      }
    }

    const hasError = Boolean(hourError || minuteError);

    let errorMessage: string | null = null;
    if (hourError && minuteError) {
      errorMessage = 'Invalid time (1–12 : 00–59)';
    } else if (hourError) {
      errorMessage = hourError;
    } else if (minuteError) {
      errorMessage = minuteError;
    }

    return {
      hourError,
      minuteError,
      hasError,
      errorMessage,
    };
  }, [hourInputText, minuteInputText]);

  // Update measured dial position on screen
  const measureDialPosition = useCallback(() => {
    dialRef.current?.measureInWindow((x, y) => {
      dialScreenCoord.current = { x, y };
    });
  }, []);

  // Switch between Hour and Minute selection
  const handleSelectUnit = (unit: 'hour' | 'minute') => {
    haptics.select();
    setActiveUnit(unit);
    if (mode === 'keyboard') {
      if (unit === 'hour') {
        hourInputRef.current?.focus();
      } else {
        minuteInputRef.current?.focus();
      }
    }
  };

  // AM/PM switcher
  const handlePeriodChange = (period: 'AM' | 'PM') => {
    haptics.select();
    setSelectedPeriod(period);
  };

  // Switch mode between dial and keyboard
  const handleToggleMode = () => {
    haptics.select();
    if (mode === 'dial') {
      setHourInputText(String(selectedHour).padStart(2, '0'));
      setMinuteInputText(String(selectedMinute).padStart(2, '0'));
      setMode('keyboard');
      setTimeout(() => {
        if (activeUnit === 'hour') {
          hourInputRef.current?.focus();
        } else {
          minuteInputRef.current?.focus();
        }
      }, 50);
    } else {
      // If there is an active error in keyboard mode, prevent switching until corrected
      if (validation.hasError) {
        haptics.reject();
        if (validation.hourError) {
          hourInputRef.current?.focus();
        } else {
          minuteInputRef.current?.focus();
        }
        return;
      }
      hourInputRef.current?.blur();
      minuteInputRef.current?.blur();
      setMode('dial');
    }
  };

  // Keyboard hour change
  const handleHourInputChange = (val: string) => {
    const digits = val.replace(/\D/g, '');
    let next = digits;
    if (digits.length > 2) {
      next = digits.slice(-1);
    }
    setHourInputText(next);
    if (next.length > 0) {
      const num = parseInt(next, 10);
      if (!isNaN(num) && num >= 1 && num <= 12) {
        setSelectedHour(num);
      }
    }
    // Auto-advance to minute input when 2 digits entered and valid (1..12)
    if (next.length === 2) {
      const num = parseInt(next, 10);
      if (!isNaN(num) && num >= 1 && num <= 12) {
        haptics.select();
        minuteInputRef.current?.focus();
      }
    }
  };

  // Keyboard hour blur
  const handleHourInputBlur = () => {
    const num = parseInt(hourInputText, 10);
    if (!isNaN(num) && num >= 1 && num <= 12) {
      setSelectedHour(num);
      setHourInputText(String(num).padStart(2, '0'));
    }
  };

  // Keyboard minute change
  const handleMinuteInputChange = (val: string) => {
    const digits = val.replace(/\D/g, '');
    let next = digits;
    if (digits.length > 2) {
      next = digits.slice(-1);
    }
    setMinuteInputText(next);
    if (next.length > 0) {
      const num = parseInt(next, 10);
      if (!isNaN(num) && num >= 0 && num <= 59) {
        setSelectedMinute(num);
      }
    }
  };

  // Keyboard minute blur
  const handleMinuteInputBlur = () => {
    const num = parseInt(minuteInputText, 10);
    if (!isNaN(num) && num >= 0 && num <= 59) {
      setSelectedMinute(num);
      setMinuteInputText(String(num).padStart(2, '0'));
    }
  };

  // Compute clock angle and update hour/minute state
  const processDialCoordinate = useCallback(
    (evt: GestureResponderEvent) => {
      let localX = evt.nativeEvent.locationX;
      let localY = evt.nativeEvent.locationY;

      // When page coordinates are available, calculate relative to measured dial center
      if (dialScreenCoord.current && evt.nativeEvent.pageX !== undefined) {
        localX = evt.nativeEvent.pageX - dialScreenCoord.current.x;
        localY = evt.nativeEvent.pageY - dialScreenCoord.current.y;
      }

      const dx = localX - DIAL_RADIUS;
      const dy = localY - DIAL_RADIUS;
      const rad = Math.atan2(dy, dx);
      const deg = (rad * 180) / Math.PI;
      // Clock 12 o'clock is at 0 degrees (-90 deg in cartesian space)
      const clockAngle = (deg + 90 + 360) % 360;

      if (activeUnit === 'hour') {
        let h = Math.round(clockAngle / 30);
        if (h === 0) h = 12;
        setSelectedHour((prev) => {
          if (prev !== h) {
            haptics.select();
            setHourInputText(String(h).padStart(2, '0'));
            return h;
          }
          return prev;
        });
      } else {
        const m = Math.round(clockAngle / 6) % 60;
        setSelectedMinute((prev) => {
          if (prev !== m) {
            haptics.select();
            setMinuteInputText(String(m).padStart(2, '0'));
            return m;
          }
          return prev;
        });
      }
    },
    [activeUnit]
  );

  // Auto-advance to minute selection upon releasing touch in hour mode
  const handleDialRelease = useCallback(() => {
    if (activeUnit === 'hour') {
      haptics.confirm();
      setActiveUnit('minute');
    }
  }, [activeUnit]);

  // Dedicated PanResponder bound exclusively to the top-level transparent touch layer
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          measureDialPosition();
          processDialCoordinate(evt);
        },
        onPanResponderMove: (evt) => {
          processDialCoordinate(evt);
        },
        onPanResponderRelease: () => {
          handleDialRelease();
        },
      }),
    [measureDialPosition, processDialCoordinate, handleDialRelease]
  );

  // Confirm dialog action
  const handleConfirm = () => {
    // Validate if in keyboard mode before confirming
    if (mode === 'keyboard' && validation.hasError) {
      haptics.reject();
      if (validation.hourError) {
        hourInputRef.current?.focus();
      } else if (validation.minuteError) {
        minuteInputRef.current?.focus();
      }
      return;
    }

    haptics.confirm();
    let finalH = selectedHour;
    let finalM = selectedMinute;
    if (mode === 'keyboard') {
      const hNum = parseInt(hourInputText, 10);
      const mNum = parseInt(minuteInputText, 10);
      if (!isNaN(hNum) && hNum >= 1 && hNum <= 12) finalH = hNum;
      if (!isNaN(mNum) && mNum >= 0 && mNum <= 59) finalM = mNum;
    }
    const formatted = formatTimeOfDay(finalH, finalM, selectedPeriod);
    onConfirm({
      hour: finalH,
      minute: finalM,
      period: selectedPeriod,
      formatted,
    });
    onClose();
  };

  // Current angle and hand tip coordinates
  const currentAngleDeg = useMemo(() => {
    return activeUnit === 'hour'
      ? (selectedHour % 12) * 30
      : selectedMinute * 6;
  }, [activeUnit, selectedHour, selectedMinute]);

  const handTip = useMemo(() => {
    const rad = ((currentAngleDeg - 90) * Math.PI) / 180;
    return {
      x: DIAL_RADIUS + NUM_RADIUS * Math.cos(rad),
      y: DIAL_RADIUS + NUM_RADIUS * Math.sin(rad),
    };
  }, [currentAngleDeg]);

  const dialogWidth = Math.min(screenWidth - 32, 336);

  const isHourInvalid = mode === 'keyboard' && Boolean(validation.hourError);
  const isMinuteInvalid = mode === 'keyboard' && Boolean(validation.minuteError);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.scrimBackdrop}>
        {/* Scrim Dismiss Layer */}
        <Pressable
          variant="plain"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss time picker dialog"
        />

        {/* Android 16 / Material 3 Time Picker Dialog Card */}
        <View
          style={[
            styles.dialogCard,
            {
              width: dialogWidth,
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Header Title */}
          <View style={styles.headerRow}>
            <Text variant="label" style={{ color: theme.colors.mute }}>
              {helpText || 'Select time'}
            </Text>
          </View>

          {/* Time Display Cluster: Hour Box, Colon, Minute Box, and AM/PM Pills */}
          <View style={styles.displayClusterRow}>
            {/* Hour Display / Input Column */}
            <View style={styles.timeBoxColumn}>
              <Pressable
                variant="plain"
                haptic="select"
                onPress={() => handleSelectUnit('hour')}
                accessibilityRole="button"
                accessibilityLabel={`Select hour, current is ${selectedHour}`}
                style={[
                  styles.timeBox,
                  {
                    backgroundColor: isHourInvalid
                      ? isDark
                        ? 'rgba(239, 68, 68, 0.15)'
                        : '#fef2f2'
                      : activeUnit === 'hour'
                      ? isDark
                        ? 'rgba(2, 132, 199, 0.22)'
                        : '#e0f2fe'
                      : isDark
                      ? '#26262a'
                      : '#f1f5f9',
                    borderColor: isHourInvalid
                      ? '#ef4444'
                      : activeUnit === 'hour'
                      ? isDark
                        ? '#38bdf8'
                        : '#0284c7'
                      : isDark
                      ? '#333338'
                      : '#e2e8f0',
                    borderWidth: isHourInvalid || activeUnit === 'hour' ? 2 : 1,
                  },
                ]}
              >
                {mode === 'keyboard' ? (
                  <TextInput
                    ref={hourInputRef}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    autoComplete="off"
                    textContentType="none"
                    importantForAutofill="no"
                    autoCorrect={false}
                    spellCheck={false}
                    maxLength={2}
                    value={hourInputText}
                    onChangeText={handleHourInputChange}
                    onFocus={() => setActiveUnit('hour')}
                    onBlur={handleHourInputBlur}
                    selectionColor="transparent"
                    cursorColor={isHourInvalid ? '#ef4444' : isDark ? '#38bdf8' : '#0284c7'}
                    style={[
                      styles.keyboardInput,
                      heroStyle,
                      {
                        color: isHourInvalid
                          ? '#ef4444'
                          : activeUnit === 'hour'
                          ? isDark
                            ? '#38bdf8'
                            : '#0284c7'
                          : theme.colors.ink,
                      },
                    ]}
                  />
                ) : (
                  <Text
                    variant="hero"
                    style={{
                      color:
                        activeUnit === 'hour'
                          ? isDark
                            ? '#38bdf8'
                            : '#0284c7'
                          : theme.colors.ink,
                    }}
                  >
                    {String(selectedHour).padStart(2, '0')}
                  </Text>
                )}
              </Pressable>
              {mode === 'keyboard' && (
                <Text
                  variant="caption"
                  style={[styles.boxSublabel, { color: isHourInvalid ? '#ef4444' : theme.colors.mute }]}
                >
                  Hour
                </Text>
              )}
            </View>

            {/* Separator Colon */}
            <View style={styles.colonContainer}>
              <Text variant="hero" style={{ color: theme.colors.mute }}>
                :
              </Text>
            </View>

            {/* Minute Display / Input Column */}
            <View style={styles.timeBoxColumn}>
              <Pressable
                variant="plain"
                haptic="select"
                onPress={() => handleSelectUnit('minute')}
                accessibilityRole="button"
                accessibilityLabel={`Select minute, current is ${selectedMinute}`}
                style={[
                  styles.timeBox,
                  {
                    backgroundColor: isMinuteInvalid
                      ? isDark
                        ? 'rgba(239, 68, 68, 0.15)'
                        : '#fef2f2'
                      : activeUnit === 'minute'
                      ? isDark
                        ? 'rgba(2, 132, 199, 0.22)'
                        : '#e0f2fe'
                      : isDark
                      ? '#26262a'
                      : '#f1f5f9',
                    borderColor: isMinuteInvalid
                      ? '#ef4444'
                      : activeUnit === 'minute'
                      ? isDark
                        ? '#38bdf8'
                        : '#0284c7'
                      : isDark
                      ? '#333338'
                      : '#e2e8f0',
                    borderWidth: isMinuteInvalid || activeUnit === 'minute' ? 2 : 1,
                  },
                ]}
              >
                {mode === 'keyboard' ? (
                  <TextInput
                    ref={minuteInputRef}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    autoComplete="off"
                    textContentType="none"
                    importantForAutofill="no"
                    autoCorrect={false}
                    spellCheck={false}
                    maxLength={2}
                    value={minuteInputText}
                    onChangeText={handleMinuteInputChange}
                    onFocus={() => setActiveUnit('minute')}
                    onBlur={handleMinuteInputBlur}
                    selectionColor="transparent"
                    cursorColor={isMinuteInvalid ? '#ef4444' : isDark ? '#38bdf8' : '#0284c7'}
                    style={[
                      styles.keyboardInput,
                      heroStyle,
                      {
                        color: isMinuteInvalid
                          ? '#ef4444'
                          : activeUnit === 'minute'
                          ? isDark
                            ? '#38bdf8'
                            : '#0284c7'
                          : theme.colors.ink,
                      },
                    ]}
                  />
                ) : (
                  <Text
                    variant="hero"
                    style={{
                      color:
                        activeUnit === 'minute'
                          ? isDark
                            ? '#38bdf8'
                            : '#0284c7'
                          : theme.colors.ink,
                    }}
                  >
                    {String(selectedMinute).padStart(2, '0')}
                  </Text>
                )}
              </Pressable>
              {mode === 'keyboard' && (
                <Text
                  variant="caption"
                  style={[styles.boxSublabel, { color: isMinuteInvalid ? '#ef4444' : theme.colors.mute }]}
                >
                  Minute
                </Text>
              )}
            </View>

            {/* AM/PM Vertically Stacked Pill Switcher */}
            <View
              style={[
                styles.ampmContainer,
                {
                  borderColor: theme.colors.hairline,
                  backgroundColor: isDark ? '#26262a' : '#f1f5f9',
                },
              ]}
            >
              {/* AM Segment */}
              <Pressable
                variant="plain"
                haptic="select"
                onPress={() => handlePeriodChange('AM')}
                accessibilityRole="button"
                accessibilityLabel="Set to AM"
                style={[
                  styles.ampmBtn,
                  selectedPeriod === 'AM' && {
                    backgroundColor: '#0284c7',
                  },
                ]}
              >
                <Text
                  variant="label"
                  style={{
                    color:
                      selectedPeriod === 'AM'
                        ? '#ffffff'
                        : isDark
                        ? '#a1a1aa'
                        : '#64748b',
                  }}
                >
                  AM
                </Text>
              </Pressable>

              {/* Center Hairline Divider */}
              <View
                style={[
                  styles.ampmDivider,
                  { backgroundColor: theme.colors.hairline },
                ]}
              />

              {/* PM Segment */}
              <Pressable
                variant="plain"
                haptic="select"
                onPress={() => handlePeriodChange('PM')}
                accessibilityRole="button"
                accessibilityLabel="Set to PM"
                style={[
                  styles.ampmBtn,
                  selectedPeriod === 'PM' && {
                    backgroundColor: '#0284c7',
                  },
                ]}
              >
                <Text
                  variant="label"
                  style={{
                    color:
                      selectedPeriod === 'PM'
                        ? '#ffffff'
                        : isDark
                        ? '#a1a1aa'
                        : '#64748b',
                  }}
                >
                  PM
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Dial Mode: Interactive Clock Face */}
          {mode === 'dial' ? (
            <View
              ref={dialRef}
              onLayout={measureDialPosition}
              style={[
                styles.dialContainer,
                {
                  backgroundColor: isDark ? '#222226' : '#f1f5f9',
                  borderColor: isDark ? '#2e2e33' : '#e2e8f0',
                },
              ]}
            >
              {/* Layer A: SVG Dial Rendering (Vector Hand Line, Pivot & Selector Disc - Ultra-Lightweight 3 Nodes) */}
              <Svg
                width={DIAL_DIAMETER}
                height={DIAL_DIAMETER}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              >
                {/* Hand Line (Center to Selector Disc) */}
                <Line
                  x1={DIAL_RADIUS}
                  y1={DIAL_RADIUS}
                  x2={handTip.x}
                  y2={handTip.y}
                  stroke="#0284c7"
                  strokeWidth={2}
                />

                {/* Center Pivot Pin */}
                <Circle cx={DIAL_RADIUS} cy={DIAL_RADIUS} r={4} fill="#0284c7" />

                {/* Selector Disc at Hand Tip */}
                <Circle
                  cx={handTip.x}
                  cy={handTip.y}
                  r={SELECTOR_RADIUS}
                  fill="#0284c7"
                />
              </Svg>

              {/* Layer B: Number Display Ring (Clean Sans Typography, Zero Dots) */}
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {activeUnit === 'hour'
                  ? STATIC_HOURS.map((item) => {
                      const isSelected = selectedHour === item.value;
                      return (
                        <View
                          key={`h-${item.value}`}
                          style={[
                            styles.numberCell,
                            {
                              left: item.x - 18,
                              top: item.y - 18,
                            },
                          ]}
                        >
                          <Text
                            variant="heading"
                            style={{
                              color: isSelected ? '#ffffff' : theme.colors.ink,
                            }}
                          >
                            {item.value}
                          </Text>
                        </View>
                      );
                    })
                  : STATIC_MINUTES.map((item) => {
                      const isSelected = selectedMinute === item.value;
                      return (
                        <View
                          key={`m-${item.value}`}
                          style={[
                            styles.numberCell,
                            {
                              left: item.x - 18,
                              top: item.y - 18,
                            },
                          ]}
                        >
                          <Text
                            variant="heading"
                            style={{
                              color: isSelected ? '#ffffff' : theme.colors.ink,
                            }}
                          >
                            {item.label}
                          </Text>
                        </View>
                      );
                    })}

                {/* In minute mode: if selected minute is not a multiple of 5, display value in selector disc */}
                {activeUnit === 'minute' && selectedMinute % 5 !== 0 && (
                  <View
                    style={[
                      styles.numberCell,
                      {
                        left: handTip.x - 18,
                        top: handTip.y - 18,
                      },
                    ]}
                  >
                    <Text
                      variant="subheading"
                      style={{ color: '#ffffff' }}
                    >
                      {String(selectedMinute).padStart(2, '0')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Layer C: Pure Transparent Touch & Drag Surface (Zero children for 100% stable coordinates) */}
              <View
                style={[StyleSheet.absoluteFill, styles.touchOverlay]}
                {...panResponder.panHandlers}
              />
            </View>
          ) : (
            /* Keyboard Mode Inline Error Banner with fixed minHeight to prevent jitter */
            <View style={styles.errorContainer}>
              {validation.errorMessage ? (
                <Text
                  variant="caption"
                  style={{ color: '#ef4444', textAlign: 'center' }}
                >
                  {validation.errorMessage}
                </Text>
              ) : null}
            </View>
          )}

          {/* Bottom Action Row: Mode Toggle Icon (Left) + Cancel & OK (Right) */}
          <View style={styles.bottomBarRow}>
            {/* Mode Toggle Button: Keyboard <-> Clock */}
            <Pressable
              variant="plain"
              haptic="select"
              hitSlopToMin48
              onPress={handleToggleMode}
              accessibilityRole="button"
              accessibilityLabel={
                mode === 'dial' ? 'Switch to keyboard input' : 'Switch to clock dial'
              }
              style={styles.modeToggleBtn}
            >
              {mode === 'dial' ? (
                <Keyboard size={22} color={isDark ? '#a1a1aa' : '#64748b'} />
              ) : (
                <Clock size={22} color={isDark ? '#a1a1aa' : '#64748b'} />
              )}
            </Pressable>

            {/* Actions: Cancel & OK */}
            <View style={styles.actionsRightCluster}>
              <Pressable
                variant="buttonSecondary"
                haptic="select"
                hitSlopToMin48
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel time selection"
                style={styles.actionBtn}
              >
                <Text
                  variant="label"
                  style={{ color: isDark ? '#38bdf8' : '#0284c7' }}
                >
                  {cancelText}
                </Text>
              </Pressable>

              <Pressable
                variant="buttonPrimary"
                haptic="confirm"
                hitSlopToMin48
                onPress={handleConfirm}
                accessibilityRole="button"
                accessibilityLabel="Confirm time selection"
                style={styles.actionBtn}
              >
                <Text
                  variant="label"
                  style={{ color: isDark ? '#38bdf8' : '#0284c7' }}
                >
                  {confirmText}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrimBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialogCard: {
    borderRadius: 28,
    borderWidth: 1,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },
  headerRow: {
    marginBottom: 16,
  },
  displayClusterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  timeBoxColumn: {
    alignItems: 'center',
  },
  timeBox: {
    width: 92,
    height: 76,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardInput: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
  },
  boxSublabel: {
    marginTop: 4,
    textAlign: 'center',
  },
  colonContainer: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ampmContainer: {
    width: 52,
    height: 76,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  ampmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
  ampmDivider: {
    height: 1,
    width: '100%',
  },
  dialContainer: {
    width: DIAL_DIAMETER,
    height: DIAL_DIAMETER,
    borderRadius: DIAL_RADIUS,
    borderWidth: 1,
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginVertical: 12,
  },
  touchOverlay: {
    zIndex: 50,
  },
  numberCell: {
    position: 'absolute',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    minHeight: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  bottomBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  modeToggleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
});
