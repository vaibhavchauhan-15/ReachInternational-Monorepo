import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionJob,
  JOB_TRANSITIONS,
  getAllowedJobTransitions,
} from "./job-transitions.ts";
import type { JobStatus } from "@reachinternational/types";

const ALL_JOB_STATUSES: JobStatus[] = ["draft", "published", "closed", "archived"];

test("every JobStatus is accounted for in JOB_TRANSITIONS", () => {
  for (const status of ALL_JOB_STATUSES) {
    assert.ok(status in JOB_TRANSITIONS, `Status "${status}" must be defined in JOB_TRANSITIONS`);
  }
});

test("self-transitions return false", () => {
  for (const status of ALL_JOB_STATUSES) {
    assert.equal(
      canTransitionJob(status, status),
      false,
      `Self-transition from "${status}" to "${status}" must return false`
    );
  }
});

test("draft jobs can transition to published, closed, or archived", () => {
  assert.equal(canTransitionJob("draft", "published"), true);
  assert.equal(canTransitionJob("draft", "closed"), true);
  assert.equal(canTransitionJob("draft", "archived"), true);
});

test("published jobs can transition to draft (unpublish), closed, or archived", () => {
  assert.equal(canTransitionJob("published", "draft"), true);
  assert.equal(canTransitionJob("published", "closed"), true);
  assert.equal(canTransitionJob("published", "archived"), true);
});

test("closed jobs can only be reopened (to published) or archived", () => {
  assert.equal(canTransitionJob("closed", "published"), true);
  assert.equal(canTransitionJob("closed", "archived"), true);
  // Cannot directly unpublish a closed job to draft without reopening
  assert.equal(canTransitionJob("closed", "draft"), false);
});

test("archived jobs cannot transition to any other status", () => {
  assert.deepEqual(getAllowedJobTransitions("archived"), []);
  for (const target of ALL_JOB_STATUSES) {
    assert.equal(
      canTransitionJob("archived", target),
      false,
      `Archived job cannot transition to "${target}"`
    );
  }
});
