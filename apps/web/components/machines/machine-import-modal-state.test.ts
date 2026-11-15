import { test } from "node:test";
import assert from "node:assert/strict";

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; reason: string }[];
}

class MachineImportModalController {
  public isOpen: boolean = false;
  public result: ImportResult | null = null;
  public dragActive: boolean = false;

  open() {
    this.isOpen = true;
    this.reset();
  }

  setResult(result: ImportResult) {
    this.result = result;
  }

  reset() {
    this.result = null;
    this.dragActive = false;
  }

  close() {
    this.reset();
    this.isOpen = false;
  }
}

test("modal resets previous import result when closed and reopened", () => {
  const modal = new MachineImportModalController();
  modal.open();

  // Simulate completed import with results
  modal.setResult({
    success: 5,
    failed: 1,
    errors: [{ row: 3, reason: "Duplicate Serial Number" }],
  });

  assert.notEqual(modal.result, null);
  assert.equal(modal.result?.success, 5);

  // User closes modal
  modal.close();
  assert.equal(modal.isOpen, false);
  assert.equal(modal.result, null, "Result must be cleared on close");

  // Reopen
  modal.open();
  assert.equal(modal.isOpen, true);
  assert.equal(modal.result, null, "Reopened modal must have null result");
});
