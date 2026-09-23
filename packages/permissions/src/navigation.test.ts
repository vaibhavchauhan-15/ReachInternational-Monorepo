import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NAV_ITEMS,
  getNavForRole,
  ROLE_HOME_ROUTES,
  MOBILE_ROLE_HOME_ROUTES,
  getRoleHomeRoute,
  getMobileRoleHomeRoute,
  isProtectedRoute,
  isAuthRoute,
  isPublicLegalRoute,
  isDeprecatedRoute,
  isRouteAllowedForRole,
} from "./navigation.ts";
import type { UserRole } from "@reachinternational/types";

const ROLES: UserRole[] = [
  "super_admin",
  "admin",
  "manager",
  "supervisor",
  "hr",
  "operator",
];

test("every allowed page is reachable, bar stays within 5 slots", () => {
  for (const role of ROLES) {
    const { primary, more } = getNavForRole(role);
    const allowed = NAV_ITEMS.filter((i) => i.roles.includes(role))
      .map((i) => i.key)
      .sort();
    assert.deepEqual(
      [...primary, ...more].map((i) => i.key).sort(),
      allowed,
      `${role}: mismatch in reachable pages`
    );
    assert.ok(primary.length + 1 <= 5, `${role}: bar too long (${primary.length + 1} slots)`);
    assert.equal(primary[0]?.key, "home", `${role}: Home must be first`);
  }
});

test("ROLE_HOME_ROUTES and getRoleHomeRoute resolve properly for all roles", () => {
  for (const role of ROLES) {
    const webHome = getRoleHomeRoute(role);
    const mobileHome = getMobileRoleHomeRoute(role);
    assert.equal(webHome, "/dashboard", `${role}: Web Home route should be /dashboard`);
    assert.equal(mobileHome, "/(app)/dashboard", `${role}: Mobile Home route should be /(app)/dashboard`);
  }
  // Fallback for null/undefined/unknown
  assert.equal(getRoleHomeRoute(null), "/dashboard");
  assert.equal(getRoleHomeRoute(undefined), "/dashboard");
  assert.equal(getRoleHomeRoute("unknown"), "/dashboard");
  assert.equal(getMobileRoleHomeRoute(null), "/(app)/dashboard");
});

test("route classification helpers classify accurately", () => {
  assert.equal(isProtectedRoute("/operations"), true);
  assert.equal(isProtectedRoute("/operations?tab=logs"), true);
  assert.equal(isProtectedRoute("/dashboard"), true);
  assert.equal(isProtectedRoute("/users/123"), true);
  assert.equal(isProtectedRoute("/login"), false);

  assert.equal(isAuthRoute("/login"), true);
  assert.equal(isAuthRoute("/signup"), true);
  assert.equal(isAuthRoute("/operations"), false);

  assert.equal(isPublicLegalRoute("/privacy"), true);
  assert.equal(isPublicLegalRoute("/terms"), true);
  assert.equal(isPublicLegalRoute("/operations"), false);

  assert.equal(isDeprecatedRoute("/finance"), true);
  assert.equal(isDeprecatedRoute("/operations"), false);

  // Role permissions per route
  assert.equal(isRouteAllowedForRole("/dashboard", "operator"), true);
  assert.equal(isRouteAllowedForRole("/operations", "operator"), true);
  assert.equal(isRouteAllowedForRole("/machines", "operator"), true);
  assert.equal(isRouteAllowedForRole("/audit", "operator"), false);
  assert.equal(isRouteAllowedForRole("/audit", "super_admin"), true);
  assert.equal(isRouteAllowedForRole("/payroll", "operator"), false);
  assert.equal(isRouteAllowedForRole("/payroll", "hr"), true);
  assert.equal(isRouteAllowedForRole("/payroll", "manager"), false);
  assert.equal(isRouteAllowedForRole("/hr", "operator"), false);
  assert.equal(isRouteAllowedForRole("/hr", "hr"), true);
  assert.equal(isRouteAllowedForRole("/hr", "manager"), false);
  assert.equal(isRouteAllowedForRole("/attendance", "manager"), false);
  assert.equal(isRouteAllowedForRole("/attendance", "hr"), true);
  assert.equal(isRouteAllowedForRole("/attendance", "admin"), true);
  assert.equal(isRouteAllowedForRole("/attendance", "super_admin"), true);
  assert.equal(isRouteAllowedForRole("/attendance", "operator"), false);
});

