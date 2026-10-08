/**
 * ReachInternational Mobile — Material Design 3 Clock Time Picker Dialog
 * High-performance, lightweight, buttery-smooth interactive clock dial primitive adhering 100% to Google M3 specs.
 * Features:
 *  - 100% Focused Clock Dial UI: optimized, lightweight, zero bloat
 *  - Precomputed static trigonometric geometry: zero math allocation during render loops
 *  - Throttled state updates: only renders and fires haptic tick when the selected hour/minute actually changes
 *  - Interactive 256dp dial face with fluid touch & drag pan responder
 *  - Hour selector (1-12) with automatic smooth advance to minutes upon release
 *  - Minute selector (00-59) with 5-minute primary ticks and minute-level precision
 *  - Tactile haptic feedback on dial ticks (haptics.select) and confirmation (haptics.confirm)
 *  - High-contrast vertically stacked AM/PM segmented switcher
 *  - Vercel Geist design tokens & theme synchronization (light/dark)
 *  - Strict zero-raw-typography compliance via canonical <Text variant="...">
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text, useTypeStyle } from './Text';
import { Pressable } from './touch/Pressable';
import { haptics } from '../../lib/haptics';

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
const NUM_RADIUS = 96; // distance of numbers from center
const SELECTOR_RADIUS = 20; // 40dp diameter circle

// Pre-computed static hour dial positions (1 to 12) — calculated once at startup
const STATIC_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => {
  const angle = ((h % 12) * 30 - 90) * (Math.PI / 180);
  return {
    value: h,
    x: DIAL_RADIUS + NUM_RADIUS * Math.cos(angle),
    y: DIAL_RADIUS + NUM_RADIUS * Math.sin(angle),
    angleDeg: (h % 12) * 30,
  };
});

// Pre-computed static minute dial positions (00, 05, 10, ..., 55)
const STATIC_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => {
  const angle = (m * 6 - 90) * (Math.PI / 180);
  return {
    value: m,
    label: String(m).padStart(2, '0'),
    x: DIAL_RADIUS + NUM_RADIUS * Math.cos(angle),
    y: DIAL_RADIUS + NUM_RADIUS * Math.sin(angle),
    angleDeg: m * 6,
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
}) => {
  const { theme, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  // Active unit currently selected on the dial: 'hour' | 'minute'
  const [activeUnit, setActiveUnit] = useState<'hour' | 'minute'>('hour');

  // Internal Time State
  const [selectedHour, setSelectedHour] = useState<number>(8);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');

  // Sync state when dialog opens or initialTime changes
  useEffect(() => {
    if (visible) {
      const parsed = parseInitialTime(initialTime);
      setSelectedHour(parsed.hour);
      setSelectedMinute(parsed.minute);
      setSelectedPeriod(parsed.period);
      setActiveUnit('hour');
    }
  }, [visible, initialTime]);

  // Switch between Hour and Minute selection
  const handleSelectUnit = (unit: 'hour' | 'minute') => {
    haptics.select();
    setActiveUnit(unit);
  };

  // AM/PM change handler
  const handlePeriodChange = (period: 'AM' | 'PM') => {
    haptics.select();
    setSelectedPeriod(period);
  };

  // Dial touch responder math with state-diff guard for optimal 60fps performance
  const handleDialTouch = useCallback(
    (x: number, y: number) => {
      const dx = x - DIAL_RADIUS;
      const dy = y - DIAL_RADIUS;
      const rad = Math.atan2(dy, dx);
      const deg = (rad * 180) / Math.PI;
      // Clock 0 degrees is straight up (-90 deg in cartesian)
      const clockAngle = (deg + 90 + 360) % 360;

      if (activeUnit === 'hour') {
        let h = Math.round(clockAngle / 30);
        if (h === 0) h = 12;
        setSelectedHour((prev) => {
          if (prev !== h) {
            haptics.select();
            return h;
          }
          return prev;
        });
      } else {
        const m = Math.round(clockAngle / 6) % 60;
        setSelectedMinute((prev) => {
          if (prev !== m) {
            haptics.select();
            return m;
          }
          return prev;
        });
      }
    },
    [activeUnit]
  );

  const handleDialRelease = useCallback(() => {
    // When picking hour, auto-advance smoothly to minutes upon release
    if (activeUnit === 'hour') {
      haptics.confirm();
      setActiveUnit('minute');
    }
  }, [activeUnit]);

  // Confirmation handler
  const handleConfirm = () => {
    haptics.confirm();
    const formatted = formatTimeOfDay(selectedHour, selectedMinute, selectedPeriod);
    onConfirm({
      hour: selectedHour,
      minute: selectedMinute,
      period: selectedPeriod,
      formatted,
    });
    onClose();
  };

  // Direct number click handlers
  const handleTapHour = (h: number) => {
    haptics.select();
    setSelectedHour(h);
    setActiveUnit('minute');
  };

  const handleTapMinute = (m: number) => {
    haptics.select();
    setSelectedMinute(m);
  };

  // Compute selector disc position and rotation angle on the dial
  const currentAngleDeg = useMemo(() => {
    return activeUnit === 'hour'
      ? (selectedHour % 12) * 30
      : selectedMinute * 6;
  }, [activeUnit, selectedHour, selectedMinute]);

  const selectorCoords = useMemo(() => {
    const rad = ((currentAngleDeg - 90) * Math.PI) / 180;
    const cx = DIAL_RADIUS + NUM_RADIUS * Math.cos(rad);
    const cy = DIAL_RADIUS + NUM_RADIUS * Math.sin(rad);
    return { cx, cy };
  }, [currentAngleDeg]);

  const monoStyle = useTypeStyle('mono');
  const dialogWidth = Math.min(screenWidth - 32, 336);

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
        {/* Dismiss Scrim Area */}
        <Pressable
          variant="card"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss time picker dialog"
        />

        {/* Material 3 Time Picker Dialog Card */}
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
          {/* Header Title (M3 Specification) */}
          <View style={styles.headerRow}>
            <Text variant="label" style={{ color: theme.colors.mute }}>
              {helpText || 'Select time'}
            </Text>
          </View>

          {/* Time Display Cluster: Hour, Minute, and AM/PM */}
          <View style={styles.displayClusterRow}>
            {/* Hour Display Box */}
            <Pressable
              variant="card"
              haptic="select"
              onPress={() => handleSelectUnit('hour')}
              accessibilityRole="button"
              accessibilityLabel={`Select hour, current is ${selectedHour}`}
              style={[
                styles.timeBox,
                {
                  backgroundColor:
                    activeUnit === 'hour'
                      ? isDark
                        ? 'rgba(2, 132, 199, 0.2)'
                        : '#e0f2fe'
                      : isDark
                      ? '#262626'
                      : '#f1f5f9',
                  borderColor: activeUnit === 'hour' ? '#0284c7' : 'transparent',
                },
              ]}
            >
              <Text
                variant="hero"
                style={[
                  monoStyle,
                  {
                    color:
                      activeUnit === 'hour'
                        ? isDark
                          ? '#38bdf8'
                          : '#0284c7'
                        : theme.colors.ink,
                  },
                ]}
              >
                {String(selectedHour).padStart(2, '0')}
              </Text>
            </Pressable>

            {/* Separator Colon */}
            <Text variant="hero" style={[monoStyle, { color: theme.colors.mute }]}>
              :
            </Text>

            {/* Minute Display Box */}
            <Pressable
              variant="card"
              haptic="select"
              onPress={() => handleSelectUnit('minute')}
              accessibilityRole="button"
              accessibilityLabel={`Select minute, current is ${selectedMinute}`}
              style={[
                styles.timeBox,
                {
                  backgroundColor:
                    activeUnit === 'minute'
                      ? isDark
                        ? 'rgba(2, 132, 199, 0.2)'
                        : '#e0f2fe'
                      : isDark
                      ? '#262626'
                      : '#f1f5f9',
                  borderColor: activeUnit === 'minute' ? '#0284c7' : 'transparent',
                },
              ]}
            >
              <Text
                variant="hero"
                style={[
                  monoStyle,
                  {
                    color:
                      activeUnit === 'minute'
                        ? isDark
                          ? '#38bdf8'
                          : '#0284c7'
                        : theme.colors.ink,
                  },
                ]}
              >
                {String(selectedMinute).padStart(2, '0')}
              </Text>
            </Pressable>

            {/* AM/PM Vertically Stacked Segmented Switcher */}
            <View
              style={[
                styles.ampmContainer,
                {
                  borderColor: theme.colors.hairline,
                  backgroundColor: isDark ? '#262626' : '#f8fafc',
                },
              ]}
            >
              {/* AM Segment */}
              <Pressable
                variant="segmentedOption"
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

              {/* Center Divider */}
              <View
                style={[
                  styles.ampmDivider,
                  { backgroundColor: theme.colors.hairline },
                ]}
              />

              {/* PM Segment */}
              <Pressable
                variant="segmentedOption"
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

          {/* Interactive Clock Face Dial */}
          <View
            style={[
              styles.dialContainer,
              { backgroundColor: isDark ? '#222226' : '#f1f5f9' },
            ]}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e: GestureResponderEvent) =>
              handleDialTouch(e.nativeEvent.locationX, e.nativeEvent.locationY)
            }
            onResponderMove={(e: GestureResponderEvent) =>
              handleDialTouch(e.nativeEvent.locationX, e.nativeEvent.locationY)
            }
            onResponderRelease={handleDialRelease}
          >
            {/* Center Pivot Pin */}
            <View style={styles.centerPivot} />

            {/* Selector Hand Line */}
            <View
              style={[
                styles.selectorHand,
                {
                  height: NUM_RADIUS,
                  transform: [
                    { translateY: NUM_RADIUS / 2 },
                    { rotate: `${currentAngleDeg}deg` },
                    { translateY: -NUM_RADIUS / 2 },
                  ],
                },
              ]}
            />

            {/* Selector Disc Bubble (Centered at Tip of Hand) */}
            <View
              style={[
                styles.selectorDisc,
                {
                  left: selectorCoords.cx - SELECTOR_RADIUS,
                  top: selectorCoords.cy - SELECTOR_RADIUS,
                },
              ]}
            />

            {/* Dial Numbers: Hours (1-12) or Minutes (00-55) */}
            {activeUnit === 'hour'
              ? STATIC_HOURS.map((item) => {
                  const isSelected = selectedHour === item.value;
                  return (
                    <Pressable
                      key={`h-${item.value}`}
                      onPress={() => handleTapHour(item.value)}
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
                        style={[
                          monoStyle,
                          {
                            color: isSelected ? '#ffffff' : theme.colors.ink,
                          },
                        ]}
                      >
                        {item.value}
                      </Text>
                    </Pressable>
                  );
                })
              : STATIC_MINUTES.map((item) => {
                  const isSelected = selectedMinute === item.value;
                  return (
                    <Pressable
                      key={`m-${item.value}`}
                      onPress={() => handleTapMinute(item.value)}
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
                        style={[
                          monoStyle,
                          {
                            color: isSelected ? '#ffffff' : theme.colors.ink,
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}

            {/* If minute is not a multiple of 5, show exact minute inside selector disc */}
            {activeUnit === 'minute' && selectedMinute % 5 !== 0 && (
              <View
                pointerEvents="none"
                style={[
                  styles.numberCell,
                  {
                    left: selectorCoords.cx - 18,
                    top: selectorCoords.cy - 18,
                  },
                ]}
              >
                <Text
                  variant="heading"
                  style={[monoStyle, { color: '#ffffff' }]}
                >
                  {String(selectedMinute).padStart(2, '0')}
                </Text>
              </View>
            )}
          </View>

          {/* Bottom Action Row: Cancel and OK */}
          <View style={styles.bottomBarRow}>
            <View style={styles.spacer} />

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
                <Text variant="label" style={{ color: isDark ? '#38bdf8' : '#0284c7' }}>
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
                <Text variant="label" style={{ color: isDark ? '#38bdf8' : '#0284c7' }}>
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
    paddingHorizontal: 24,
    paddingBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },
  headerRow: {
    marginBottom: 20,
  },
  displayClusterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  timeBox: {
    width: 86,
    height: 76,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ampmContainer: {
    width: 52,
    height: 76,
    borderRadius: 8,
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
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  centerPivot: {
    position: 'absolute',
    left: DIAL_RADIUS - 4,
    top: DIAL_RADIUS - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284c7',
    zIndex: 10,
  },
  selectorHand: {
    position: 'absolute',
    left: DIAL_RADIUS - 1,
    top: DIAL_RADIUS - NUM_RADIUS,
    width: 2,
    backgroundColor: '#0284c7',
    zIndex: 5,
  },
  selectorDisc: {
    position: 'absolute',
    width: SELECTOR_RADIUS * 2,
    height: SELECTOR_RADIUS * 2,
    borderRadius: SELECTOR_RADIUS,
    backgroundColor: '#0284c7',
    zIndex: 6,
  },
  numberCell: {
    position: 'absolute',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  bottomBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  spacer: {
    flex: 1,
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
