import { test } from "node:test";
import assert from "node:assert/strict";

class ConflictModalStateController {
  public action: "acknowledge" | "adjust" = "acknowledge";
  public adjustedEndTime: string = "";
  public notes: string = "";
  public isResolving: boolean = false;
  public isOpen: boolean = false;

  open(logId: string) {
    this.reset();
    this.isOpen = true;
  }

  reset() {
    this.action = "acknowledge";
    this.adjustedEndTime = "";
    this.notes = "";
    this.isResolving = false;
  }

  close() {
    this.reset();
    this.isOpen = false;
  }
}

test("modal resets form state on cancel/close", () => {
  const modal = new ConflictModalStateController();
  modal.open("log-1");

  // User alters state
  modal.action = "adjust";
  modal.adjustedEndTime = "18:00";
  modal.notes = "Overtime corrected by 1 hour";

  assert.equal(modal.action, "adjust");
  assert.equal(modal.adjustedEndTime, "18:00");
  assert.equal(modal.notes, "Overtime corrected by 1 hour");

  // User cancels / closes
  modal.close();

  assert.equal(modal.isOpen, false);
  assert.equal(modal.action, "acknowledge", "Action must reset to acknowledge");
  assert.equal(modal.adjustedEndTime, "", "Adjusted end time must be empty");
  assert.equal(modal.notes, "", "Notes must be empty");
});

test("reopening for a new log starts with pristine state", () => {
  const modal = new ConflictModalStateController();
  modal.open("log-1");
  modal.action = "adjust";
  modal.notes = "Stale notes";

  // Reopened for log-2
  modal.open("log-2");
  assert.equal(modal.action, "acknowledge");
  assert.equal(modal.notes, "");
});
