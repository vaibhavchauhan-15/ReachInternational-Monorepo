import { test } from "node:test";
import assert from "node:assert/strict";
import { toProfileView } from "./profile-view.ts";

test("Aadhaar display value is always masked; raw only in explicit copy payload", () => {
  const v = toProfileView({
    aadhaar_number: "123412341294",
    full_name: "John Doe",
    role: "operator",
    status: "active",
    email: "john@example.com",
  } as any);

  // Every rendered value must be masked — the full number must never be displayed.
  for (const section of v.sections) {
    for (const row of section.rows) {
      assert.ok(!row.value.includes("123412341294"), `Displayed value for ${row.label} must not contain the raw Aadhaar`);
    }
  }

  const idRow = v.sections.flatMap((s) => s.rows).find((r) => r.label === "Aadhaar");
  assert.equal(idRow?.value, "XXXX XXXX 1294");
  // copyValue intentionally carries the clean number for the explicit copy action.
  assert.equal(idRow?.copyValue, "123412341294");
});

test("empty optional fields fall back to neutral placeholders", () => {
  const v = toProfileView({
    full_name: "Jane Operator",
    role: "operator",
    status: "active",
    email: "jane@example.com",
    supervisor_id: null,
    working_location_id: null,
  } as any);

  const workSection = v.sections.find((s) => s.title === "Work & Operations");
  assert.ok(workSection);
  const supRow = workSection.rows.find((r) => r.label === "Site Supervisor");
  const locRow = workSection.rows.find((r) => r.label === "Working Location");
  assert.equal(supRow?.value, "Not Assigned");
  assert.equal(locRow?.value, "Main Facility");
});

test("supervisor and working location names are rendered when populated", () => {
  const v = toProfileView({
    full_name: "Jane Operator",
    role: "operator",
    status: "active",
    email: "jane@example.com",
    supervisor: { full_name: "Pradeep Sharma" },
    working_location: { name: "Sanand Plant" },
  } as any);

  const workSection = v.sections.find((s) => s.title === "Work & Operations");
  assert.ok(workSection);
  const supRow = workSection.rows.find((r) => r.label === "Site Supervisor");
  const locRow = workSection.rows.find((r) => r.label === "Working Location");
  assert.equal(supRow?.value, "Pradeep Sharma");
  assert.equal(locRow?.value, "Sanand Plant");
});

test("header-owned values are not duplicated inside sections", () => {
  const v = toProfileView({
    full_name: "Jane Operator",
    role: "operator",
    status: "active",
    email: "jane@example.com",
  } as any);

  // Header shows name/email/role/status — sections must not repeat them.
  const accountSection = v.sections.find((s) => s.title === "Account & System");
  assert.ok(accountSection);
  assert.ok(!accountSection.rows.some((r) => r.label === "Account Status"), "Account Status duplicates the header status pill");
  assert.ok(!accountSection.rows.some((r) => r.label === "System Role"), "System Role duplicates the header role pill");

  const contactSection = v.sections.find((s) => s.title === "Contact Information");
  assert.ok(contactSection);
  // Email is shown once in Contact Information (removed from the header card).
  assert.ok(contactSection.rows.some((r) => r.label === "Primary Email"));
});
