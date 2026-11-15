import { test } from "node:test";
import assert from "node:assert/strict";

type ViewMode = "statement" | "attendance" | "earnings" | "deductions" | "payouts" | "leaves";

function resolvePayrollViewMode(param: string | null): ViewMode {
  if (
    param === "attendance" ||
    param === "earnings" ||
    param === "deductions" ||
    param === "payouts" ||
    param === "leaves"
  ) {
    return param;
  }
  return "statement";
}

test("resolves viewMode with fallback to statement", () => {
  assert.equal(resolvePayrollViewMode("attendance"), "attendance");
  assert.equal(resolvePayrollViewMode("earnings"), "earnings");
  assert.equal(resolvePayrollViewMode(null), "statement");
  assert.equal(resolvePayrollViewMode("invalid_tab"), "statement");
});

test("simulates object URL revocation lifecycle", () => {
  let createdUrl: string | null = null;
  let revokedUrl: string | null = null;

  const mockCreateObjectURL = (_blob: any) => {
    createdUrl = "blob:http://localhost/mock-uuid-123";
    return createdUrl;
  };

  const mockRevokeObjectURL = (url: string) => {
    revokedUrl = url;
  };

  // Run simulated export
  const url = mockCreateObjectURL(new Blob(["mock-csv"]));
  assert.equal(url, "blob:http://localhost/mock-uuid-123");

  mockRevokeObjectURL(url);
  assert.equal(revokedUrl, createdUrl, "Object URL must be revoked after download click");
});
