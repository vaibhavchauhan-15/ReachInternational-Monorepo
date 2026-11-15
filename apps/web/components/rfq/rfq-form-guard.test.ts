import { test } from "node:test";
import assert from "node:assert/strict";

class SubmitGuard {
  private isSubmitting: boolean = false;
  public submissionCount: number = 0;

  async submit(action: () => Promise<void>, isPending: boolean = false, isUploading: boolean = false) {
    if (this.isSubmitting || isPending || isUploading) {
      return false;
    }
    this.isSubmitting = true;
    try {
      this.submissionCount++;
      await action();
      return true;
    } finally {
      this.isSubmitting = false;
    }
  }
}

test("simultaneous submit calls are guarded and only first proceeds", async () => {
  const guard = new SubmitGuard();
  let resolveAction!: () => void;
  const slowAction = () =>
    new Promise<void>((resolve) => {
      resolveAction = resolve;
    });

  const p1 = guard.submit(slowAction);
  const p2 = guard.submit(slowAction);
  const p3 = guard.submit(slowAction);

  // Release the in-flight action
  resolveAction();

  const [res1, res2, res3] = await Promise.all([p1, p2, p3]);

  assert.equal(res1, true);
  assert.equal(res2, false);
  assert.equal(res3, false);
  assert.equal(guard.submissionCount, 1);
});

test("submit is blocked when uploading attachments", async () => {
  const guard = new SubmitGuard();
  const res = await guard.submit(async () => {}, false, true);
  assert.equal(res, false);
  assert.equal(guard.submissionCount, 0);
});
