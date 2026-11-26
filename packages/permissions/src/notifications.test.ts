import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NOTIFICATION_ROUTE_KEYS,
  NOTIFICATION_ROUTE_ROLE_ACCESS,
  resolveNotificationNav,
} from "./notifications.ts";

describe("Notification Permissions & Route Resolution", () => {
  it("defines standard allowed notification route keys", () => {
    assert(NOTIFICATION_ROUTE_KEYS.includes("operations"));
    assert(NOTIFICATION_ROUTE_KEYS.includes("machines"));
    assert(NOTIFICATION_ROUTE_KEYS.includes("approvals"));
    assert(NOTIFICATION_ROUTE_KEYS.includes("dashboard"));
  });

  it("resolves operations navigation with date param", () => {
    const nav = resolveNotificationNav("operations", { date: "2026-11-20" });
    assert.strictEqual(nav.webHref, "/operations?date=2026-11-20");
    assert.strictEqual(nav.mobileRoute, "/(app)/operations?date=2026-11-20");
    assert.strictEqual(nav.isAuthorized, true);
  });

  it("resolves machine navigation with id param", () => {
    const nav = resolveNotificationNav("machines", { id: "mch-123" });
    assert.strictEqual(nav.webHref, "/machines/mch-123");
    assert.strictEqual(nav.mobileRoute, "/(app)/machines?id=mch-123");
    assert.strictEqual(nav.isAuthorized, true);
  });

  it("resolves approvals for authorized admin role", () => {
    const nav = resolveNotificationNav("approvals", null, "admin");
    assert.strictEqual(nav.webHref, "/approvals");
    assert.strictEqual(nav.mobileRoute, "/(app)/approvals");
    assert.strictEqual(nav.isAuthorized, true);
  });

  it("blocks approvals for unauthorized operator role and redirects to dashboard", () => {
    const nav = resolveNotificationNav("approvals", null, "operator");
    assert.strictEqual(nav.webHref, "/dashboard");
    assert.strictEqual(nav.mobileRoute, "/(app)/dashboard");
    assert.strictEqual(nav.isAuthorized, false);
  });

  it("falls back to dashboard for unrecognized route keys", () => {
    const nav = resolveNotificationNav("unknown_arbitrary_key");
    assert.strictEqual(nav.webHref, "/dashboard");
    assert.strictEqual(nav.mobileRoute, "/(app)/dashboard");
    assert.strictEqual(nav.isAuthorized, true);
  });
});
