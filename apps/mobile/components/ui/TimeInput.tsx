/**
 * ReachInternational Mobile — Native Time Input Primitive
 * Separate Hours (1-12) & Minutes (0-60, auto-0) fields with AM/PM toggle and inline validation.
 * 95% identical to web mobile viewport with 5% native optimizations (haptics, smooth focus).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from './ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface TimeInputProps {
  label?: string;
  value?: string;
  onChangeText?: (value: string) => void;
  onChange?: (value: string) => void;
  onErrorChange?: (hasError: boolean) => void;
  required?: boolean;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  error?: string;
  isInvalid?: boolean;
  hideErrorMessage?: boolean;
  helperText?: string;
  /** Layout arrangement of the AM/PM toggle relative to time picker box. Defaults to "side-by-side" matching web viewport. */
  toggleLayout?: 'stacked' | 'side-by-side';
}

/**
 * Parses any incoming time string into { hour: string, minute: string, period: 'AM' | 'PM' }
 */
function parseTimeString(timeStr?: string | null): {
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
} {
  if (!timeStr || !timeStr.trim()) {
    return { hour: '', minute: '', period: 'AM' };
  }

  const clean = timeStr.trim().toUpperCase();

  // Match 12-hour with AM/PM (e.g. "08:00 AM", "010:030 AM", "8:30PM", "8:00")
  const ampmMatch = clean.match(/^(\d{1,3}):(\d{1,3})(?::\d{2})?\s*(AM|PM)?$/i);
  if (ampmMatch) {
    const rawH = parseInt(ampmMatch[1], 10);
    const rawM = parseInt(ampmMatch[2], 10);
    const p = (ampmMatch[3] || 'AM').toUpperCase() as 'AM' | 'PM';

    let hStr = '';
    if (!isNaN(rawH)) {
      if (rawH >= 1 && rawH <= 12) {
        hStr = String(rawH).padStart(2, '0');
      } else {
        hStr = String(rawH);
      }
    }

    let mStr = '00';
    if (!isNaN(rawM)) {
      if (rawM >= 0 && rawM <= 60) {
        mStr = String(rawM).padStart(2, '0');
      } else {
        mStr = String(rawM);
      }
    }

    return { hour: hStr, minute: mStr, period: p === 'PM' ? 'PM' : 'AM' };
  }

  // Match 24-hour format (e.g. "14:30", "06:00:00")
  const match24 = clean.match(/^(\d{1,3}):(\d{1,3})(?::\d{2})?$/);
  if (match24) {
    let hours = parseInt(match24[1], 10);
    const rawM = parseInt(match24[2], 10);
    const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return {
      hour: String(hours).padStart(2, '0'),
      minute: String(isNaN(rawM) ? 0 : rawM).padStart(2, '0'),
      period,
    };
  }

  return { hour: '', minute: '', period: 'AM' };
}

export const TimeInput: React.FC<TimeInputProps> = ({
  label,
  value,
  onChangeText,
  onChange,
  onErrorChange,
  required = false,
  disabled = false,
  containerStyle,
  error: externalError,
  isInvalid = false,
  hideErrorMessage = false,
  helperText,
  toggleLayout = 'side-by-side',
}) => {
  const { theme, isDark } = useTheme();

  const parsed = useMemo(() => parseTimeString(value), [value]);
  const [hour, setHour] = useState<string>(parsed.hour);
  const [minute, setMinute] = useState<string>(parsed.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed.period);
  const [touched, setTouched] = useState<boolean>(false);

  // Sync internal state if external value changes
  useEffect(() => {
    const current = parseTimeString(value);
    setHour(current.hour);
    setMinute(current.minute);
    setPeriod(current.period);
  }, [value]);

  // Validation
  const validation = useMemo(() => {
    const trimmedH = hour.trim();
    const trimmedM = minute.trim();

    let hourErr: string | null = null;
    let minuteErr: string | null = null;

    if (!trimmedH) {
      if (required || touched) {
        hourErr = 'Hour required (1–12)';
      }
    } else {
      const hNum = parseInt(trimmedH, 10);
      if (isNaN(hNum) || hNum < 1 || hNum > 12) {
        hourErr = 'Hour must be 1–12';
      }
    }

    if (trimmedM !== '') {
      const mNum = parseInt(trimmedM, 10);
      if (isNaN(mNum) || mNum < 0 || mNum > 60) {
        minuteErr = 'Minutes must be 0–60';
      }
    }

    const hasInternalError = Boolean(hourErr || minuteErr);
    const hasError = hasInternalError || Boolean(externalError) || Boolean(isInvalid);
    const errorMessage = (!hideErrorMessage && (externalError || hourErr || minuteErr)) || null;

    return {
      hourError: hourErr,
      minuteError: minuteErr,
      hasError,
      errorMessage,
    };
  }, [hour, minute, required, touched, externalError, isInvalid, hideErrorMessage]);

  useEffect(() => {
    onErrorChange?.(validation.hasError);
  }, [validation.hasError, onErrorChange]);

  const emitFormattedTime = useCallback(
    (newHour: string, newMinute: string, newPeriod: 'AM' | 'PM') => {
      const trimmedH = newHour.trim();
      const trimmedM = newMinute.trim();

      if (!trimmedH) {
        onChangeText?.('');
        onChange?.('');
        return;
      }

      const hNum = parseInt(trimmedH, 10);
      if (isNaN(hNum) || hNum < 1 || hNum > 12) {
        return;
      }

      let mNum = 0;
      if (trimmedM !== '') {
        mNum = parseInt(trimmedM, 10);
        if (isNaN(mNum) || mNum < 0 || mNum > 60) {
          return;
        }
      }

      const formattedH = String(hNum).padStart(2, '0');
      const formattedM = String(mNum).padStart(2, '0');
      const formattedTime = `${formattedH}:${formattedM} ${newPeriod}`;
      onChangeText?.(formattedTime);
      onChange?.(formattedTime);
    },
    [onChangeText, onChange]
  );

  const handleHourChange = (val: string) => {
    setTouched(true);
    const digits = val.replace(/\D/g, '');

    if (digits === '') {
      setHour('');
      emitFormattedTime('', minute, period);
      return;
    }

    let sanitized = digits;
    if (digits.length > 2 && digits.startsWith('0')) {
      const parsedNum = parseInt(digits, 10);
      sanitized = isNaN(parsedNum) ? '' : String(parsedNum);
    } else if (digits.length > 2) {
      const parsedNum = parseInt(digits, 10);
      if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 12) {
        sanitized = String(parsedNum);
      } else {
        sanitized = digits.slice(-2);
      }
    }

    setHour(sanitized);
    emitFormattedTime(sanitized, minute, period);
  };

  const handleHourBlur = () => {
    setTouched(true);
    const trimmedH = hour.trim();
    if (trimmedH) {
      const hNum = parseInt(trimmedH, 10);
      if (!isNaN(hNum)) {
        if (hNum >= 1 && hNum <= 12) {
          const padded = String(hNum).padStart(2, '0');
          setHour(padded);
          emitFormattedTime(padded, minute, period);
        } else {
          setHour(String(hNum));
          emitFormattedTime(String(hNum), minute, period);
        }
      }
    }
  };

  const handleMinuteChange = (val: string) => {
    setTouched(true);
    const digits = val.replace(/\D/g, '');

    if (digits === '') {
      setMinute('');
      emitFormattedTime(hour, '', period);
      return;
    }

    let sanitized = digits;
    if (digits.length > 2 && digits.startsWith('0')) {
      const parsedNum = parseInt(digits, 10);
      sanitized = isNaN(parsedNum) ? '' : String(parsedNum);
    } else if (digits.length > 2) {
      const parsedNum = parseInt(digits, 10);
      if (!isNaN(parsedNum) && parsedNum >= 0 && parsedNum <= 60) {
        sanitized = String(parsedNum);
      } else {
        sanitized = digits.slice(-2);
      }
    }

    setMinute(sanitized);
    emitFormattedTime(hour, sanitized, period);
  };

  const handleMinuteBlur = () => {
    setTouched(true);
    const trimmedM = minute.trim();
    if (trimmedM === '') {
      setMinute('00');
      emitFormattedTime(hour, '00', period);
    } else {
      const mNum = parseInt(trimmedM, 10);
      if (!isNaN(mNum)) {
        if (mNum >= 0 && mNum <= 60) {
          const padded = String(mNum).padStart(2, '0');
          setMinute(padded);
          emitFormattedTime(hour, padded, period);
        } else {
          setMinute(String(mNum));
          emitFormattedTime(hour, String(mNum), period);
        }
      }
    }
  };

  const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
    Haptics.selectionAsync().catch(() => {});
    setTouched(true);
    setPeriod(newPeriod);
    emitFormattedTime(hour, minute, newPeriod);
  };

  const hourInputRef = React.useRef<TextInput>(null);
  const minuteInputRef = React.useRef<TextInput>(null);

  const containerBorderColor = validation.hasError
    ? '#ef4444'
    : isDark
    ? '#262626'
    : '#ebebeb';

  const shellBg = isDark ? '#141414' : '#fafafa';
  const periodCapsuleBg = isDark ? '#18181b' : '#f3f4f6';

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: isDark ? '#ffffff' : '#0f172a' }]}>
            {label}
            {required && <Text style={{ color: '#ef4444', fontWeight: '700' }}> *</Text>}
          </Text>
        </View>
      )}

      {/* Time Picker Controls: Time Box and Separate AM/PM Toggle */}
      <View
        style={[
          toggleLayout === 'side-by-side' ? styles.sideBySideRow : styles.stackedCol,
        ]}
      >
        {/* 1. Time Picker Shell: Digits Only */}
        <View
          style={[
            styles.timeBoxShell,
            toggleLayout === 'side-by-side' && { flex: 1 },
            {
              backgroundColor: shellBg,
              borderColor: containerBorderColor,
            },
          ]}
        >
          <View style={styles.digitalCluster}>
            <TextInput
              ref={hourInputRef}
              keyboardType="number-pad"
              maxLength={3}
              value={hour}
              onChangeText={(val) => {
                handleHourChange(val);
                const digits = val.replace(/\D/g, '');
                if (digits.length === 2) {
                  const num = parseInt(digits, 10);
                  if (!isNaN(num) && num >= 1 && num <= 12) {
                    minuteInputRef.current?.focus();
                  }
                }
              }}
              onBlur={handleHourBlur}
              placeholder="08"
              placeholderTextColor={isDark ? '#71717a' : '#9ca3af'}
              editable={!disabled}
              selectTextOnFocus
              style={[
                styles.digitInput,
                { color: isDark ? '#f8fafc' : '#0f172a' },
              ]}
            />

            <Text style={[styles.colonText, { color: isDark ? '#71717a' : '#9ca3af' }]}>:</Text>

            <TextInput
              ref={minuteInputRef}
              keyboardType="number-pad"
              maxLength={3}
              value={minute}
              onChangeText={handleMinuteChange}
              onBlur={handleMinuteBlur}
              placeholder="00"
              placeholderTextColor={isDark ? '#71717a' : '#9ca3af'}
              editable={!disabled}
              selectTextOnFocus
              style={[
                styles.digitInput,
                { color: isDark ? '#f8fafc' : '#0f172a' },
              ]}
            />
          </View>
        </View>

        {/* 2. Separate AM/PM Segmented Switcher Layout */}
        <View
          style={[
            styles.periodContainer,
            toggleLayout === 'side-by-side' ? styles.periodContainerSide : styles.periodContainerStacked,
            {
              borderColor: isDark ? '#262626' : '#e5e7eb',
              backgroundColor: periodCapsuleBg,
            },
          ]}
        >
          <TouchableOpacity
            disabled={disabled}
            onPress={() => handlePeriodChange('AM')}
            activeOpacity={0.7}
            style={[
              styles.periodBtn,
              period === 'AM' && {
                backgroundColor: '#0284c7',
                shadowColor: '#0284c7',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.25,
                shadowRadius: 2,
                elevation: 1,
              },
            ]}
          >
            <Text
              style={[
                styles.periodText,
                {
                  color: period === 'AM' ? '#ffffff' : isDark ? '#a1a1aa' : '#64748b',
                  fontWeight: period === 'AM' ? '800' : '700',
                },
              ]}
            >
              AM
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={disabled}
            onPress={() => handlePeriodChange('PM')}
            activeOpacity={0.7}
            style={[
              styles.periodBtn,
              period === 'PM' && {
                backgroundColor: '#0284c7',
                shadowColor: '#0284c7',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.25,
                shadowRadius: 2,
                elevation: 1,
              },
            ]}
          >
            <Text
              style={[
                styles.periodText,
                {
                  color: period === 'PM' ? '#ffffff' : isDark ? '#a1a1aa' : '#64748b',
                  fontWeight: period === 'PM' ? '800' : '700',
                },
              ]}
            >
              PM
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Inline Validation Error Message */}
      {validation.errorMessage ? (
        <Text style={[styles.errorText, { color: '#ef4444' }]}>
          {validation.errorMessage}
        </Text>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: theme.colors.mute }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  stackedCol: {
    flexDirection: 'column',
    width: '100%',
    gap: 6,
  },
  sideBySideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  timeBoxShell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  digitalCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  digitInput: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    width: 36,
    height: 38,
    padding: 0,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontVariant: ['tabular-nums'],
  },
  colonText: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  periodContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 2.5,
    gap: 2,
    alignItems: 'center',
  },
  periodContainerStacked: {
    width: '100%',
    height: 40,
  },
  periodContainerSide: {
    height: 44,
    minWidth: 92,
  },
  periodBtn: {
    flex: 1,
    height: '100%',
    minHeight: 34,
    minWidth: 42,
    paddingHorizontal: 10,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 11.5,
    marginTop: 4,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 11.5,
    marginTop: 4,
  },
});
