import { z } from "zod";

// ─── Notification List Query Schema ───────────────────────────────────

export const NotificationListQuerySchema = z.object({
  cursor_created_at: z.string().datetime({ offset: true }).nullable().optional(),
  cursor_id: z.string().uuid("Invalid cursor ID format").nullable().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  filter: z.enum(["all", "unread"]).default("all"),
}).refine(
  (data) => {
    // If either cursor field is provided, both must be provided for deterministic keyset pagination
    const hasCreatedAt = Boolean(data.cursor_created_at);
    const hasId = Boolean(data.cursor_id);
    return (hasCreatedAt && hasId) || (!hasCreatedAt && !hasId);
  },
  {
    message: "Both cursor_created_at and cursor_id must be provided together for keyset pagination",
    path: ["cursor_created_at"],
  }
);

export type NotificationListQueryInput = z.infer<typeof NotificationListQuerySchema>;

// ─── Notification Mark Read Schema ───────────────────────────────────

export const NotificationMarkReadSchema = z.object({
  notification_ids: z
    .array(z.string().uuid("Invalid notification ID format"))
    .min(1, "At least one notification ID is required")
    .max(100, "Cannot mark more than 100 notifications as read in one batch"),
});

export type NotificationMarkReadInput = z.infer<typeof NotificationMarkReadSchema>;

// ─── Notification Mark All Read Schema ────────────────────────────────

export const NotificationMarkAllReadSchema = z.object({
  before_cursor: z.string().datetime({ offset: true }).nullable().optional(),
});

export type NotificationMarkAllReadInput = z.infer<typeof NotificationMarkAllReadSchema>;
