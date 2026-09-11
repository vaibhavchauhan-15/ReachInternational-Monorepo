/**
 * ReachInternational Mobile — Post Notification Service
 * Universal event dispatcher delivering notifications to:
 * 1. Native/OS Notification Center (via Web Notification API / system permissions)
 * 2. In-App Ambient Floating Banner (animated banner at top of viewport)
 * 3. Persistent Operational Feed in AsyncStorage (@reach:operational_notifications_feed)
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNotificationPermissionStatus } from '../permissions';

export type NotificationCategory = 'machine' | 'user' | 'log_entry' | 'log_manage' | 'profile' | 'system';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface PostNotificationPayload {
  id?: string;
  category: NotificationCategory;
  title: string;
  body: string;
  severity?: NotificationSeverity;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export type NotificationListener = (notification: PostNotificationPayload) => void;

const listeners: Set<NotificationListener> = new Set();
const STORAGE_KEY_FEED = '@reach:operational_notifications_feed';
const MAX_FEED_ITEMS = 40;

/**
 * Subscribe to real-time in-app notification events
 */
export function subscribeToPostNotifications(listener: NotificationListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Dispatch an operational post notification
 */
export async function postNotification(payload: PostNotificationPayload): Promise<PostNotificationPayload> {
  const item: PostNotificationPayload = {
    ...payload,
    id: payload.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    severity: payload.severity || 'info',
    timestamp: payload.timestamp || Date.now(),
  };

  // 1. Deliver to In-App Listeners (Floating Banner)
  listeners.forEach((listener) => {
    try {
      listener(item);
    } catch (err) {
      console.warn('[PostNotification] Listener error:', err);
    }
  });

  // 2. Deliver to OS / Browser Notification Center (if granted)
  try {
    const permStatus = await getNotificationPermissionStatus();
    if (permStatus === 'granted') {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
        if (window.Notification.permission === 'granted') {
          new window.Notification(item.title, {
            body: item.body,
            icon: '/light-favicon.ico',
            tag: item.category,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[PostNotification] System notification delivery skipped:', err);
  }

  // 3. Persist to Recent Notification Feed
  try {
    const rawFeed = await AsyncStorage.getItem(STORAGE_KEY_FEED);
    const existingFeed: PostNotificationPayload[] = rawFeed ? JSON.parse(rawFeed) : [];
    const updatedFeed = [item, ...existingFeed].slice(0, MAX_FEED_ITEMS);
    await AsyncStorage.setItem(STORAGE_KEY_FEED, JSON.stringify(updatedFeed));
  } catch (err) {
    console.warn('[PostNotification] Failed to persist feed:', err);
  }

  return item;
}

/**
 * Retrieve recent persistent notification feed
 */
export async function getRecentNotificationFeed(): Promise<PostNotificationPayload[]> {
  try {
    const rawFeed = await AsyncStorage.getItem(STORAGE_KEY_FEED);
    return rawFeed ? JSON.parse(rawFeed) : [];
  } catch {
    return [];
  }
}

/**
 * Clear notification feed
 */
export async function clearNotificationFeed(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_FEED);
  } catch (err) {
    console.warn('[PostNotification] Failed to clear feed:', err);
  }
}

/* =========================================================================
   DOMAIN NOTIFICATION HELPERS
   ========================================================================= */

// --- 1. Machine Notifications ---

export function notifyMachineCreated(machineCode: string, model: string) {
  return postNotification({
    category: 'machine',
    title: 'Fleet Asset Added',
    body: `Machine ${machineCode} (${model}) has been successfully enrolled into the fleet.`,
    severity: 'success',
  });
}

export function notifyMachineUpdated(machineCode: string, summary: string) {
  return postNotification({
    category: 'machine',
    title: 'Machine Specifications Updated',
    body: `Asset ${machineCode}: ${summary}`,
    severity: 'info',
  });
}

export function notifyMachineStatusChanged(machineCode: string, status: string) {
  const isBreakdown = status.toLowerCase() === 'breakdown';
  return postNotification({
    category: 'machine',
    title: isBreakdown ? 'Machine Breakdown Alert' : 'Machine Status Changed',
    body: `Asset ${machineCode} status changed to ${status.toUpperCase().replace(/_/g, ' ')}.`,
    severity: isBreakdown ? 'error' : 'warning',
  });
}

export function notifyMachineDeleted(machineCode: string) {
  return postNotification({
    category: 'machine',
    title: 'Fleet Machinery Decommissioned',
    body: `Machine asset ${machineCode} was permanently removed from active service.`,
    severity: 'warning',
  });
}

export function notifyMachineExported(format: string, count: number) {
  return postNotification({
    category: 'machine',
    title: 'Machinery Directory Exported',
    body: `Exported ${count} fleet machinery asset records to ${format.toUpperCase()}.`,
    severity: 'success',
  });
}

// --- 2. User & Personnel Notifications ---

export function notifyUserCreated(name: string, role: string) {
  return postNotification({
    category: 'user',
    title: 'New Personnel Registered',
    body: `${name} has been enrolled into ReachInternational as ${role.replace(/_/g, ' ')}.`,
    severity: 'success',
  });
}

export function notifyUserUpdated(name: string, role: string) {
  return postNotification({
    category: 'user',
    title: 'User Profile Updated',
    body: `Updated credentials and operational details for ${name} (${role.replace(/_/g, ' ')}).`,
    severity: 'info',
  });
}

export function notifyUserStatusChanged(name: string, status: string) {
  const isDeactivated = status.toLowerCase() === 'inactive';
  return postNotification({
    category: 'user',
    title: isDeactivated ? 'User Account Deactivated' : 'User Account Activated',
    body: `Account for ${name} is now ${status.toUpperCase()}.`,
    severity: isDeactivated ? 'warning' : 'success',
  });
}

export function notifyUserPasswordReset(name: string) {
  return postNotification({
    category: 'user',
    title: 'Security: Password Reset Issued',
    body: `Temporary access credentials generated for ${name}.`,
    severity: 'warning',
  });
}

export function notifyUserExported(format: string, count: number) {
  return postNotification({
    category: 'user',
    title: 'Personnel Directory Exported',
    body: `Exported ${count} team member accounts to ${format.toUpperCase()}.`,
    severity: 'success',
  });
}

// --- 3. Logs Entry (Operations) ---

export function notifyLogEntryCreated(machineCode: string, runningHours: number, overtimeHours: number = 0) {
  const hasOvertime = overtimeHours > 0;
  return postNotification({
    category: 'log_entry',
    title: 'Daily Meter Log Recorded',
    body: `Machine ${machineCode}: ${runningHours}h logged${hasOvertime ? ` with ${overtimeHours}h overtime` : ''}.`,
    severity: 'success',
  });
}

export function notifyShiftConflictDetected(machineCode: string, reason: string) {
  return postNotification({
    category: 'log_entry',
    title: '⚠️ Shift Conflict Warning',
    body: `Machine ${machineCode}: Overtime shift conflict detected. ${reason}`,
    severity: 'error',
  });
}

export function notifyShiftStarted(shiftType: string, machineCode: string) {
  return postNotification({
    category: 'log_entry',
    title: 'Shift Started',
    body: `Commenced ${shiftType} shift on equipment ${machineCode}.`,
    severity: 'info',
  });
}

export function notifyShiftEnded(shiftType: string, machineCode: string) {
  return postNotification({
    category: 'log_entry',
    title: 'Shift Concluded',
    body: `Completed ${shiftType} shift on equipment ${machineCode}.`,
    severity: 'info',
  });
}

// --- 4. Logs Export & Manage ---

export function notifyLogsPdfExported(totalLogs: number, machineCount: number) {
  return postNotification({
    category: 'log_manage',
    title: 'Printable A4 Report Generated',
    body: `Prepared formal A4 Running Hours Report for ${machineCount} machines (${totalLogs} daily log entries).`,
    severity: 'success',
  });
}

export function notifyLogsCsvExported(totalLogs: number) {
  return postNotification({
    category: 'log_manage',
    title: 'Operations Spreadsheets Exported',
    body: `Successfully exported ${totalLogs} daily running hours entries to CSV spreadsheet.`,
    severity: 'success',
  });
}

export function notifyOperatorAssigned(machineCode: string, operatorName: string, shift: string) {
  return postNotification({
    category: 'log_manage',
    title: 'Operator Assignment Confirmed',
    body: `Assigned ${operatorName} to machine ${machineCode} for the ${shift} shift.`,
    severity: 'success',
  });
}

export function notifyConflictResolved(machineCode: string, adjustedHours: number) {
  return postNotification({
    category: 'log_manage',
    title: 'Shift Conflict Resolved',
    body: `Overtime overlap resolved for ${machineCode}. Adjusted running hours saved to ${adjustedHours}h.`,
    severity: 'success',
  });
}

// --- 5. Profile & Preferences ---

export function notifyProfileUpdated(details?: string) {
  return postNotification({
    category: 'profile',
    title: 'Profile Updated',
    body: details ? `Profile saved: ${details}` : 'Your profile details and shift settings were successfully updated.',
    severity: 'success',
  });
}

export function notifyProfileRequestSubmitted(approverRole: string) {
  return postNotification({
    category: 'profile',
    title: 'Profile Change Request Submitted',
    body: `Your request has been routed to ${approverRole.replace(/_/g, ' ')} for administrative review.`,
    severity: 'info',
  });
}

export function notifyProfileRequestCancelled() {
  return postNotification({
    category: 'profile',
    title: 'Change Request Cancelled',
    body: 'Your pending profile change request has been withdrawn.',
    severity: 'warning',
  });
}

export function notifyThemeToggled(isDark: boolean) {
  return postNotification({
    category: 'profile',
    title: 'Theme Preference Saved',
    body: `Switched visual appearance to ${isDark ? 'Dark' : 'Light'} Mode.`,
    severity: 'info',
  });
}
