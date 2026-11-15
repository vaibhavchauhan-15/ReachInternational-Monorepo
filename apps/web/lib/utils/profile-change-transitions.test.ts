import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionProfileRequest,
  PROFILE_REQUEST_TRANSITIONS,
  canApproveProfileChange,
  type ProfileRequestStatus,
} from "./profile-change-transitions.ts";
import type { UserRole } from "@reachinternational/types";

const ALL_PROFILE_STATUSES: ProfileRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
];

test("every ProfileRequestStatus is in PROFILE_REQUEST_TRANSITIONS", () => {
  for (const status of ALL_PROFILE_STATUSES) {
    assert.ok(status in PROFILE_REQUEST_TRANSITIONS);
  }
});

test("pending status can transition to approved, rejected, or cancelled", () => {
  assert.equal(canTransitionProfileRequest("pending", "approved"), true);
  assert.equal(canTransitionProfileRequest("pending", "rejected"), true);
  assert.equal(canTransitionProfileRequest("pending", "cancelled"), true);
  assert.equal(canTransitionProfileRequest("pending", "pending"), false);
});

test("approved, rejected, and cancelled are terminal", () => {
  const terminal: ProfileRequestStatus[] = ["approved", "rejected", "cancelled"];
  for (const status of terminal) {
    for (const target of ALL_PROFILE_STATUSES) {
      assert.equal(
        canTransitionProfileRequest(status, target),
        false,
        `Terminal status "${status}" must not transition to "${target}"`
      );
    }
  }
});

test("canApproveProfileChange enforces strict role hierarchy", () => {
  // super_admin can approve all
  assert.equal(canApproveProfileChange("super_admin", "admin"), true);
  assert.equal(canApproveProfileChange("super_admin", "operator"), true);

  // admin cannot approve super_admin or admin
  assert.equal(canApproveProfileChange("admin", "super_admin"), false);
  assert.equal(canApproveProfileChange("admin", "admin"), false);
  assert.equal(canApproveProfileChange("admin", "manager"), true);
  assert.equal(canApproveProfileChange("admin", "operator"), true);

  // manager/hr cannot approve admin/manager/hr
  assert.equal(canApproveProfileChange("manager", "admin"), false);
  assert.equal(canApproveProfileChange("manager", "manager"), false);
  assert.equal(canApproveProfileChange("manager", "operator"), true);
  assert.equal(canApproveProfileChange("hr", "operator"), true);

  // operator cannot approve anyone
  assert.equal(canApproveProfileChange("operator", "operator"), false);
});
