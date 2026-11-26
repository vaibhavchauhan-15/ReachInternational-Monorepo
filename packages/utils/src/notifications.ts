/**
 * ReachInternational In-App Notification Pure Utilities (@reachinternational/utils)
 */

import type { NotificationItem } from "@reachinternational/types";

/**
 * Caps notification count at max threshold (default 99 -> "99+").
 */
export function capNotificationCount(count: number, max: number = 99): string {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  if (safeCount === 0) return "0";
  if (safeCount > max) return `${max}+`;
  return String(safeCount);
}

/**
 * Formats relative timestamp in Indian Standard Time (IST, UTC+05:30).
 * Handles edge cases (future dates, invalid strings, sub-minute times).
 */
export function formatNotificationTimeIST(
  dateInput: string | Date | null | undefined,
  baseNowMs: number = Date.now()
): string {
  if (!dateInput) return "";

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const timeMs = date.getTime();
  if (Number.isNaN(timeMs)) return "";

  const diffMs = baseNowMs - timeMs;
  if (diffMs < 0) return "Just now"; // Clock skew defense

  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  // Standard IST date representation (e.g. "24 Nov")
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  });
}

export interface NotificationDateGroup {
  label: "Today" | "Yesterday" | "Earlier";
  items: NotificationItem[];
}

/**
 * Groups an array of notifications into chronological sections: "Today", "Yesterday", and "Earlier"
 * based on Asia/Kolkata calendar day boundaries.
 */
export function groupNotificationsByDate(
  items: NotificationItem[],
  baseNowMs: number = Date.now()
): NotificationDateGroup[] {
  if (!items || items.length === 0) return [];

  // Compute today's and yesterday's YYYY-MM-DD in Asia/Kolkata
  const now = new Date(baseNowMs);
  const todayStr = getISTDateString(now);

  const yesterday = new Date(baseNowMs - 86400000);
  const yesterdayStr = getISTDateString(yesterday);

  const todayItems: NotificationItem[] = [];
  const yesterdayItems: NotificationItem[] = [];
  const earlierItems: NotificationItem[] = [];

  for (const item of items) {
    const itemDate = new Date(item.created_at);
    const itemDateStr = getISTDateString(itemDate);

    if (itemDateStr === todayStr) {
      todayItems.push(item);
    } else if (itemDateStr === yesterdayStr) {
      yesterdayItems.push(item);
    } else {
      earlierItems.push(item);
    }
  }

  const groups: NotificationDateGroup[] = [];
  if (todayItems.length > 0) groups.push({ label: "Today", items: todayItems });
  if (yesterdayItems.length > 0) groups.push({ label: "Yesterday", items: yesterdayItems });
  if (earlierItems.length > 0) groups.push({ label: "Earlier", items: earlierItems });

  return groups;
}

function getISTDateString(d: Date): string {
  try {
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // Returns YYYY-MM-DD
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export interface NotificationCategoryVisual {
  label: string;
  iconName: string;
  badgeStatus: "operational" | "warning" | "breakdown" | "info" | "pending";
}

/**
 * Maps notification category to canonical UI label, icon name, and Geist badge status.
 */
export function getNotificationCategoryVisual(category: string | null | undefined): NotificationCategoryVisual {
  const cat = (category || "").toLowerCase().trim();

  switch (cat) {
    case "breakdown":
    case "breakdown_alerts":
      return {
        label: "Breakdown Alert",
        iconName: "alert-triangle",
        badgeStatus: "breakdown",
      };
    case "shift_reminder":
    case "shift_reminders":
      return {
        label: "Shift Reminder",
        iconName: "clock",
        badgeStatus: "warning",
      };
    case "assignment":
    case "assignment_alerts":
      return {
        label: "Assignment Update",
        iconName: "wrench",
        badgeStatus: "info",
      };
    case "approvals":
      return {
        label: "Approvals",
        iconName: "check-circle",
        badgeStatus: "pending",
      };
    case "security":
      return {
        label: "Security Alert",
        iconName: "shield",
        badgeStatus: "breakdown",
      };
    case "payroll":
    case "payroll_alerts":
      return {
        label: "Payroll Notice",
        iconName: "credit-card",
        badgeStatus: "operational",
      };
    case "admin":
    case "admin_alerts":
      return {
        label: "System Notice",
        iconName: "bell",
        badgeStatus: "info",
      };
    case "log_entry":
    default:
      return {
        label: "Log Entry",
        iconName: "file-text",
        badgeStatus: "info",
      };
  }
}
