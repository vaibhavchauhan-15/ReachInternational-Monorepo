import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionApplication,
  APPLICATION_TRANSITIONS,
  getAllowedApplicationTransitions,
} from "./application-transitions.ts";
import type { ApplicationStatus } from "@reachinternational/types";

const ALL_STATUSES: ApplicationStatus[] = [
  "new",
  "screening",
  "shortlisted",
  "interview",
  "offered",
  "hired",
  "rejected",
  "withdrawn",
];

test("every ApplicationStatus is explicitly accounted for in APPLICATION_TRANSITIONS", () => {
  for (const status of ALL_STATUSES) {
    assert.ok(
      status in APPLICATION_TRANSITIONS,
      `Status "${status}" must be defined in APPLICATION_TRANSITIONS`
    );
  }
});

test("self-transitions return false", () => {
  for (const status of ALL_STATUSES) {
    assert.equal(
      canTransitionApplication(status, status),
      false,
      `Self-transition from "${status}" to "${status}" must be rejected`
    );
  }
});

test("terminal statuses (hired, rejected, withdrawn) have empty allowed transitions", () => {
  const terminalStatuses: ApplicationStatus[] = ["hired", "rejected", "withdrawn"];
  for (const terminal of terminalStatuses) {
    assert.deepEqual(
      getAllowedApplicationTransitions(terminal),
      [],
      `Terminal status "${terminal}" must have zero allowed transitions`
    );
    for (const target of ALL_STATUSES) {
      assert.equal(
        canTransitionApplication(terminal, target),
        false,
        `Cannot transition out of terminal status "${terminal}" to "${target}"`
      );
    }
  }
});

test("forward pipeline transitions succeed", () => {
  assert.equal(canTransitionApplication("new", "screening"), true);
  assert.equal(canTransitionApplication("new", "shortlisted"), true);
  assert.equal(canTransitionApplication("screening", "shortlisted"), true);
  assert.equal(canTransitionApplication("screening", "interview"), true);
  assert.equal(canTransitionApplication("shortlisted", "interview"), true);
  assert.equal(canTransitionApplication("shortlisted", "offered"), true);
  assert.equal(canTransitionApplication("interview", "offered"), true);
  assert.equal(canTransitionApplication("interview", "shortlisted"), true);
  assert.equal(canTransitionApplication("offered", "hired"), true);
});

test("rejection and withdrawal are allowed from active pipeline stages", () => {
  const activeStages: ApplicationStatus[] = [
    "new",
    "screening",
    "shortlisted",
    "interview",
    "offered",
  ];
  for (const stage of activeStages) {
    assert.equal(
      canTransitionApplication(stage, "rejected"),
      true,
      `Active stage "${stage}" must be allowed to transition to "rejected"`
    );
    assert.equal(
      canTransitionApplication(stage, "withdrawn"),
      true,
      `Active stage "${stage}" must be allowed to transition to "withdrawn"`
    );
  }
});

test("illegal skipping or reverse transitions are rejected", () => {
  // Cannot jump straight from new to hired
  assert.equal(canTransitionApplication("new", "hired"), false);
  // Cannot jump straight from screening to hired
  assert.equal(canTransitionApplication("screening", "hired"), false);
  // Cannot transition backwards from offered to new
  assert.equal(canTransitionApplication("offered", "new"), false);
  // Cannot transition backwards from interview to new
  assert.equal(canTransitionApplication("interview", "new"), false);
});
