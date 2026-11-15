import { test } from "node:test";
import assert from "node:assert/strict";

class ConfirmationController {
  private _isOpen: boolean = false;
  private _internalLoading: boolean = false;
  private _isConfirming: boolean = false;
  public executionCount: number = 0;

  get isOpen() {
    return this._isOpen;
  }

  get isLoading() {
    return this._internalLoading;
  }

  open() {
    this._isOpen = true;
    this._internalLoading = false;
    this._isConfirming = false;
  }

  close() {
    if (this._internalLoading) return;
    this._isOpen = false;
    this._internalLoading = false;
    this._isConfirming = false;
  }

  async confirm(onConfirm: () => Promise<void>) {
    if (this._internalLoading || this._isConfirming) {
      return;
    }
    this._isConfirming = true;
    this._internalLoading = true;
    try {
      this.executionCount++;
      await onConfirm();
    } finally {
      this._internalLoading = false;
      this._isConfirming = false;
    }
  }
}

test("synchronous re-entrancy lock prevents double execution", async () => {
  const controller = new ConfirmationController();
  controller.open();

  let resolvePromise!: () => void;
  const slowAction = () =>
    new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

  // Trigger two confirms rapidly
  const p1 = controller.confirm(slowAction);
  const p2 = controller.confirm(slowAction);

  assert.equal(controller.isLoading, true);
  assert.equal(controller.executionCount, 1, "Should only execute once despite rapid calls");

  resolvePromise();
  await Promise.all([p1, p2]);

  assert.equal(controller.isLoading, false, "Loading must reset to false after resolution");
  assert.equal(controller.executionCount, 1);
});

test("reopening dialog is not locked in loading state", async () => {
  const controller = new ConfirmationController();
  controller.open();

  await controller.confirm(async () => {});
  assert.equal(controller.isLoading, false);

  controller.close();
  assert.equal(controller.isOpen, false);

  // Reopen
  controller.open();
  assert.equal(controller.isOpen, true);
  assert.equal(controller.isLoading, false, "Reopened dialog must not be locked in loading state");

  // Can confirm again
  await controller.confirm(async () => {});
  assert.equal(controller.executionCount, 2);
});
