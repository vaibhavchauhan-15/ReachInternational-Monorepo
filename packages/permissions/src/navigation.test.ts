import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, getNavForRole } from "./navigation.ts";
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
