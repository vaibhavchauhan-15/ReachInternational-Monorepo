import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NotificationListQuerySchema,
  NotificationMarkReadSchema,
  NotificationMarkAllReadSchema,
} from "./notifications.ts";

describe("Notification Validation Schemas", () => {
  it("validates empty list query with defaults", () => {
    const res = NotificationListQuerySchema.safeParse({});
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.data.limit, 20);
      assert.strictEqual(res.data.filter, "all");
    }
  });

  it("validates complete keyset cursor", () => {
    const res = NotificationListQuerySchema.safeParse({
      cursor_created_at: "2026-11-26T09:00:00.000Z",
      cursor_id: "c9044946-9cfb-4409-92af-050d6bdb2020",
      limit: "15",
      filter: "unread",
    });
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.data.limit, 15);
      assert.strictEqual(res.data.filter, "unread");
    }
  });

  it("rejects half cursor (cursor_created_at without cursor_id)", () => {
    const res = NotificationListQuerySchema.safeParse({
      cursor_created_at: "2026-11-26T09:00:00.000Z",
    });
    assert.strictEqual(res.success, false);
  });

  it("rejects half cursor (cursor_id without cursor_created_at)", () => {
    const res = NotificationListQuerySchema.safeParse({
      cursor_id: "c9044946-9cfb-4409-92af-050d6bdb2020",
    });
    assert.strictEqual(res.success, false);
  });

  it("validates mark read input with valid UUIDs", () => {
    const res = NotificationMarkReadSchema.safeParse({
      notification_ids: ["c9044946-9cfb-4409-92af-050d6bdb2020"],
    });
    assert.strictEqual(res.success, true);
  });

  it("rejects empty mark read array", () => {
    const res = NotificationMarkReadSchema.safeParse({
      notification_ids: [],
    });
    assert.strictEqual(res.success, false);
  });

  it("rejects oversized mark read array (>100)", () => {
    const ids = Array.from({ length: 101 }, () => "c9044946-9cfb-4409-92af-050d6bdb2020");
    const res = NotificationMarkReadSchema.safeParse({
      notification_ids: ids,
    });
    assert.strictEqual(res.success, false);
  });

  it("validates mark all read with optional before_cursor", () => {
    const res1 = NotificationMarkAllReadSchema.safeParse({});
    assert.strictEqual(res1.success, true);

    const res2 = NotificationMarkAllReadSchema.safeParse({
      before_cursor: "2026-11-26T09:00:00.000Z",
    });
    assert.strictEqual(res2.success, true);
  });
});
