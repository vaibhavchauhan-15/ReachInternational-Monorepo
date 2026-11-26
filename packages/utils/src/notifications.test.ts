import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  capNotificationCount,
  formatNotificationTimeIST,
  groupNotificationsByDate,
  getNotificationCategoryVisual,
} from "./notifications.ts";
import type { NotificationItem } from "@reachinternational/types";

describe("Notification Pure Utilities", () => {
  describe("capNotificationCount", () => {
    it("returns '0' for zero or negative counts", () => {
      assert.strictEqual(capNotificationCount(0), "0");
      assert.strictEqual(capNotificationCount(-5), "0");
    });

    it("returns numeric string for counts <= 99", () => {
      assert.strictEqual(capNotificationCount(1), "1");
      assert.strictEqual(capNotificationCount(25), "25");
      assert.strictEqual(capNotificationCount(99), "99");
    });

    it("caps at '99+' when exceeding 99", () => {
      assert.strictEqual(capNotificationCount(100), "99+");
      assert.strictEqual(capNotificationCount(500), "99+");
    });

    it("supports custom max cap", () => {
      assert.strictEqual(capNotificationCount(15, 10), "10+");
    });
  });

  describe("formatNotificationTimeIST", () => {
    it("returns 'Just now' for times < 1 min", () => {
      const now = new Date("2026-11-26T12:00:00.000Z").getTime();
      const past30s = new Date(now - 30000).toISOString();
      assert.strictEqual(formatNotificationTimeIST(past30s, now), "Just now");
    });

    it("returns 'Xm ago' for times < 1 hour", () => {
      const now = new Date("2026-11-26T12:00:00.000Z").getTime();
      const past15m = new Date(now - 15 * 60 * 1000).toISOString();
      assert.strictEqual(formatNotificationTimeIST(past15m, now), "15m ago");
    });

    it("returns 'Xh ago' for times < 24 hours", () => {
      const now = new Date("2026-11-26T12:00:00.000Z").getTime();
      const past3h = new Date(now - 3 * 3600 * 1000).toISOString();
      assert.strictEqual(formatNotificationTimeIST(past3h, now), "3h ago");
    });

    it("returns 'Yesterday' for 1 day ago", () => {
      const now = new Date("2026-11-26T12:00:00.000Z").getTime();
      const yesterday = new Date(now - 25 * 3600 * 1000).toISOString();
      assert.strictEqual(formatNotificationTimeIST(yesterday, now), "Yesterday");
    });

    it("returns empty string for null or invalid inputs", () => {
      assert.strictEqual(formatNotificationTimeIST(null), "");
      assert.strictEqual(formatNotificationTimeIST("invalid-date-string"), "");
    });
  });

  describe("groupNotificationsByDate", () => {
    const makeItem = (id: string, dateStr: string): NotificationItem => ({
      id,
      title: `Item ${id}`,
      body: `Body ${id}`,
      category: "shift_reminder",
      priority: "normal",
      severity: "info",
      is_read: false,
      read_at: null,
      created_at: dateStr,
      route_key: "operations",
      route_params: {},
      deep_link: "/operations",
      metadata: {},
    });

    it("groups items correctly across Today, Yesterday, and Earlier in IST", () => {
      // 2026-11-26 12:00 IST
      const nowMs = new Date("2026-11-26T06:30:00.000Z").getTime();

      const items: NotificationItem[] = [
        makeItem("1", "2026-11-26T05:00:00.000Z"), // Today in IST
        makeItem("2", "2026-11-25T05:00:00.000Z"), // Yesterday in IST
        makeItem("3", "2026-11-20T05:00:00.000Z"), // Earlier in IST
      ];

      const groups = groupNotificationsByDate(items, nowMs);
      assert.strictEqual(groups.length, 3);
      assert.strictEqual(groups[0].label, "Today");
      assert.strictEqual(groups[0].items[0].id, "1");
      assert.strictEqual(groups[1].label, "Yesterday");
      assert.strictEqual(groups[1].items[0].id, "2");
      assert.strictEqual(groups[2].label, "Earlier");
      assert.strictEqual(groups[2].items[0].id, "3");
    });
  });

  describe("getNotificationCategoryVisual", () => {
    it("maps breakdown category to breakdown badgeStatus and alert-triangle icon", () => {
      const v = getNotificationCategoryVisual("breakdown");
      assert.strictEqual(v.label, "Breakdown Alert");
      assert.strictEqual(v.iconName, "alert-triangle");
      assert.strictEqual(v.badgeStatus, "breakdown");
    });

    it("maps shift_reminder to warning badgeStatus and clock icon", () => {
      const v = getNotificationCategoryVisual("shift_reminder");
      assert.strictEqual(v.label, "Shift Reminder");
      assert.strictEqual(v.iconName, "clock");
      assert.strictEqual(v.badgeStatus, "warning");
    });

    it("falls back gracefully for unknown categories", () => {
      const v = getNotificationCategoryVisual("unknown");
      assert.strictEqual(v.badgeStatus, "info");
    });
  });
});
