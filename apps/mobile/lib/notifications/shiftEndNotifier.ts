/**
 * ReachInternational Mobile — Shift End Notification Service
 * Monitors assigned shift schedules for operators and dispatches
 * high-priority post notifications to the mobile device when a shift
 * has concluded and daily running hours have not yet been logged.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { postNotification } from './postNotification';
import type { OperatorDashboardDTO } from '@reachinternational/types';

type AssignedShift = NonNullable<OperatorDashboardDTO['assigned_shifts']>[number];

/**
 * Parses time string (24h or 12h AM/PM) into minutes from midnight
 */
export function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const clean = timeStr.trim();

  // Format 1: 12-hour AM/PM (e.g. "05:00 PM", "11:30 AM")
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  // Format 2: 24-hour (e.g. "17:00:00", "17:00")
  const h24Match = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (h24Match) {
    const hours = parseInt(h24Match[1], 10);
    const minutes = parseInt(h24Match[2], 10);
    return hours * 60 + minutes;
  }

  return null;
}

/**
 * Checks if assigned shifts have ended and pushes notifications for unlogged shifts
 */
export async function checkAndNotifyShiftEnded(
  assignedShifts?: AssignedShift[] | null
): Promise<ReturnType<typeof setTimeout> | null> {
  if (!assignedShifts || assignedShifts.length === 0) return null;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayDate = now.toISOString().slice(0, 10);

  let nearestFutureShiftMs: number | null = null;

  for (const shift of assignedShifts) {
    // If shift is already logged today, no need for pending alert
    if (shift.is_logged_today) continue;

    const endMinutes =
      parseTimeToMinutes(shift.raw_end_time) ?? parseTimeToMinutes(shift.end_time);

    if (endMinutes === null) continue;

    const crossesMidnight = Boolean(shift.crosses_midnight);

    // Determine if shift has ended:
    // Case A (Normal shift, e.g. 08:00 - 17:00): ended if current >= end
    // Case B (Crosses midnight, e.g. 20:00 - 04:00): ended if current >= end (in morning) and current < start
    let hasEnded = false;
    if (!crossesMidnight) {
      hasEnded = currentMinutes >= endMinutes;
    } else {
      const startMinutes =
        parseTimeToMinutes(shift.raw_start_time) ?? parseTimeToMinutes(shift.start_time) ?? 1200;
      hasEnded = currentMinutes >= endMinutes && currentMinutes < startMinutes;
    }

    if (hasEnded) {
      const storageKey = `@reach:notified_shift_end_${todayDate}_${shift.code}`;
      try {
        const alreadyNotified = await AsyncStorage.getItem(storageKey);
        if (!alreadyNotified) {
          const shiftName = shift.name || `Shift ${shift.code}`;
          await postNotification({
            id: `shift_end_${todayDate}_${shift.code}`,
            category: 'log_entry',
            title: 'Shift Ended — Log Pending',
            body: `Your scheduled ${shiftName} has ended (${shift.end_time}). Please submit your daily HMR shift entry.`,
            severity: 'warning',
            metadata: {
              shiftCode: shift.code,
              actionUrl: `/operations?tab=entry&shift=${encodeURIComponent(shift.code)}`,
            },
          });
          await AsyncStorage.setItem(storageKey, 'true');
        }
      } catch (err) {
        console.warn('[ShiftEndNotifier] Failed to process notification:', err);
      }
    } else {
      // Shift has not ended yet. Calculate remaining milliseconds for timer scheduling
      let diffMinutes = endMinutes - currentMinutes;
      if (diffMinutes < 0) diffMinutes += 24 * 60; // Next day
      const diffMs = diffMinutes * 60 * 1000 - now.getSeconds() * 1000;

      if (diffMs > 0 && diffMs <= 86400000) {
        if (nearestFutureShiftMs === null || diffMs < nearestFutureShiftMs) {
          nearestFutureShiftMs = diffMs;
        }
      }
    }
  }

  // Schedule background timer for shift ending later today if app remains open
  if (nearestFutureShiftMs !== null && nearestFutureShiftMs > 0) {
    const timerId = setTimeout(() => {
      checkAndNotifyShiftEnded(assignedShifts).catch(() => {});
    }, Math.min(nearestFutureShiftMs + 1000, 2147483647));
    return timerId;
  }

  return null;
}
