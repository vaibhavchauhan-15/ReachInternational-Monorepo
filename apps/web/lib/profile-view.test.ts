import { test } from "node:test";
import assert from "node:assert/strict";
import { toProfileView } from "./profile-view.ts";

test("full Aadhaar never appears in the view model", () => {
  const v = toProfileView({
    aadhaar_number: "123412341294",
    full_name: "John Doe",
    role: "operator",
    status: "active",
    email: "john@example.com",
  } as any);

  const serialized = JSON.stringify(v);
  assert.ok(!serialized.includes("123412341294"), "Raw Aadhaar should not be present");
  assert.ok(serialized.includes("1294"), "Masked Aadhaar should contain the last 4 digits");
  assert.ok(serialized.includes("XXXX-XXXX-1294"), "Masked Aadhaar format should be XXXX-XXXX-1294");
});

test("empty optional fields are omitted from sections", () => {
  const v = toProfileView({
    full_name: "Jane Operator",
    role: "operator",
    status: "active",
    email: "jane@example.com",
    supervisor_id: null,
    working_location_id: null,
  } as any);

  const workSection = v.sections.find((s) => s.title === "Work");
  if (workSection) {
    assert.ok(!workSection.rows.some((r) => r.label === "Supervisor"));
    assert.ok(!workSection.rows.some((r) => r.label === "Working location"));
  }
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

  const workSection = v.sections.find((s) => s.title === "Work");
  assert.ok(workSection);
  const supRow = workSection.rows.find((r) => r.label === "Supervisor");
  const locRow = workSection.rows.find((r) => r.label === "Working location");
  assert.equal(supRow?.value, "Pradeep Sharma");
  assert.equal(locRow?.value, "Sanand Plant");
});
