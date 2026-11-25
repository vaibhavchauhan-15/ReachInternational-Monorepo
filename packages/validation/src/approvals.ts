import { z } from "zod";

// ─── Input Schemas ───────────────────────────────────────────────────

export const ApprovalSubmitInputSchema = z.object({
  type_key: z.string().trim().min(1, "Approval type key is required"),
  subject_type: z.string().trim().min(1, "Subject type is required"),
  subject_id: z.string().uuid("Invalid subject ID").nullable().optional(),
  payload: z.record(z.unknown()),
  idempotency_key: z.string().trim().max(128).optional(),
  summary: z.string().trim().max(500).optional(),
  subject_label: z.string().trim().max(255).optional(),
});

export type ApprovalSubmitInput = z.infer<typeof ApprovalSubmitInputSchema>;

export const ApprovalDecideInputSchema = z.object({
  request_id: z.string().uuid("Invalid request ID"),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(1000).optional(),
  expected_version: z.number().int().positive().optional(),
  bound_request_ids: z.array(z.string().uuid()).optional(),
  idempotency_key: z.string().trim().max(128).optional(),
});

export type ApprovalDecideInput = z.infer<typeof ApprovalDecideInputSchema>;

export const ApprovalCancelInputSchema = z.object({
  request_id: z.string().uuid("Invalid request ID"),
  note: z.string().trim().max(1000).optional(),
});

export type ApprovalCancelInput = z.infer<typeof ApprovalCancelInputSchema>;

export const ApprovalApproveAllInputSchema = z.object({
  type_key: z.string().trim().optional(),
  request_ids: z.array(z.string().uuid("Invalid request ID")).optional(),
  note: z.string().trim().max(1000).optional(),
});

export type ApprovalApproveAllInput = z.infer<typeof ApprovalApproveAllInputSchema>;

/** A keyset page cursor is always a (created_at, id) pair. */
const CursorCreatedAtSchema = z
  .string()
  .trim()
  .min(1, "Cursor timestamp is required")
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid cursor timestamp",
  });

export const ApprovalCursorSchema = z.object({
  created_at: CursorCreatedAtSchema,
  id: z.string().uuid("Invalid cursor ID"),
});

export type ApprovalCursorInput = z.infer<typeof ApprovalCursorSchema>;

export const ApprovalListQuerySchema = z
  .object({
    status: z.enum(["pending", "approved", "rejected", "cancelled", "expired", "all"]).optional().default("pending"),
    type_key: z.string().trim().optional(),
    cursor: ApprovalCursorSchema.optional(),
    cursor_created_at: CursorCreatedAtSchema.optional(),
    cursor_id: z.string().uuid("Invalid cursor ID").optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .superRefine((value, ctx) => {
    // The keyset cursor is a pair: accepting one half silently restarts the page.
    if (Boolean(value.cursor_created_at) !== Boolean(value.cursor_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cursor_created_at and cursor_id must be supplied together",
      });
    }
  })
  .transform((value) => {
    const cursor = value.cursor;
    return {
      ...value,
      cursor_created_at: cursor?.created_at ?? value.cursor_created_at,
      cursor_id: cursor?.id ?? value.cursor_id,
    };
  });

export type ApprovalListQuery = z.infer<typeof ApprovalListQuerySchema>;

// ─── Per-Type Payload Validation Schemas ──────────────────────────────

export const ProfileChangePayloadSchema = z.object({
  target_user_id: z.string().uuid("Invalid target user ID"),
  changes: z.record(
    z.object({
      old_value: z.unknown().optional(),
      new_value: z.unknown(),
    })
  ).refine((changes) => Object.keys(changes).length > 0, {
    message: "At least one profile field change must be specified",
  }),
  requester_role: z.string().optional(),
  reason: z.string().trim().max(500).optional(),
});

export type ProfileChangePayloadInput = z.infer<typeof ProfileChangePayloadSchema>;

export const RegistrationPayloadSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
  email: z.string().email("Invalid email address"),
  full_name: z.string().trim().min(1, "Full name is required"),
  role: z.enum(["super_admin", "admin", "manager", "supervisor", "hr", "operator"]),
  phone: z.string().trim().optional().nullable(),
  machine_category: z.string().trim().optional().nullable(),
});

export type RegistrationPayloadInput = z.infer<typeof RegistrationPayloadSchema>;

export const DocumentVerifyPayloadSchema = z.object({
  document_id: z.string().uuid("Invalid document ID"),
  user_id: z.string().uuid("Invalid user ID"),
  document_type_code: z.string().trim().min(1, "Document type code is required"),
  storage_path: z.string().trim().min(1, "Storage path is required"),
  thumb_path: z.string().trim().optional().nullable(),
});

export type DocumentVerifyPayloadInput = z.infer<typeof DocumentVerifyPayloadSchema>;

export const DocumentReplacePayloadSchema = z.object({
  document_type_code: z.string().trim().min(1, "Document type code is required"),
  user_id: z.string().uuid("Invalid user ID"),
  staging_path: z.string().trim().min(1, "Staging path is required"),
  staging_thumb_path: z.string().trim().optional().nullable(),
  current_storage_path: z.string().trim().optional().nullable(),
});

export type DocumentReplacePayloadInput = z.infer<typeof DocumentReplacePayloadSchema>;

export const AccountDeletionPayloadSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
  reason: z.string().trim().min(1, "Reason is required").max(1000),
  email: z.string().email().optional(),
  full_name: z.string().optional(),
  source: z.enum(["web", "mobile", "public_web"]).default("web"),
});

export type AccountDeletionPayloadInput = z.infer<typeof AccountDeletionPayloadSchema>;

export const ShiftConflictPayloadSchema = z.object({
  log_id: z.string().uuid("Invalid shift log ID"),
  machine_id: z.string().uuid("Invalid machine ID"),
  operator_id: z.string().uuid("Invalid operator ID"),
  action: z.enum(["acknowledge", "adjust"]),
  adjusted_start_time: z.string().optional(),
  adjusted_end_time: z.string().optional(),
  remarks: z.string().trim().max(1000).optional(),
});

export type ShiftConflictPayloadInput = z.infer<typeof ShiftConflictPayloadSchema>;
