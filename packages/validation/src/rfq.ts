import { z } from "zod";

export const rfqRequirementEnum = z.enum(["rental", "purchase"]);
export type RfqRequirementType = z.infer<typeof rfqRequirementEnum>;

export const durationUnitEnum = z.enum(["day", "week", "month"]);
export type DurationUnitType = z.infer<typeof durationUnitEnum>;

export const rfqSourceEnum = z.enum([
  "website",
  "equipment_page",
  "phone",
  "whatsapp",
  "email",
  "walk_in",
  "referral",
]);
export type RfqSourceType = z.infer<typeof rfqSourceEnum>;

export const rfqStatusEnum = z.enum([
  "new",
  "under_review",
  "contacted",
  "quotation_prepared",
  "quotation_sent",
  "on_hold",
  "converted",
  "lost",
  "spam",
]);

export const quoteLineKindEnum = z.enum([
  "rental",
  "sale",
  "transport",
  "operator",
  "other",
]);

export const rfqItemSchema = z
  .object({
    requirement_type: rfqRequirementEnum,
    equipment_id: z.string().uuid().optional().nullable().or(z.literal("")),
    category_id: z.string().uuid().optional().nullable().or(z.literal("")),
    brand_id: z.string().uuid().optional().nullable().or(z.literal("")),
    custom_description: z.string().trim().max(500).optional().nullable().or(z.literal("")),
    quantity: z.coerce
      .number()
      .int()
      .min(1, "Quantity must be at least 1")
      .max(999, "Quantity must not exceed 999")
      .default(1),
    min_height_m: z.coerce.number().positive().optional().nullable(),
    min_capacity_kg: z.coerce.number().int().positive().optional().nullable(),
    duration_value: z.coerce.number().int().positive().optional().nullable(),
    duration_unit: durationUnitEnum.optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable().or(z.literal("")),
    sort_order: z.coerce.number().int().default(0),
  })
  .superRefine((data, ctx) => {
    // Rental duration validation
    if (data.requirement_type === "rental") {
      if (!data.duration_value || data.duration_value <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Rental duration is required",
          path: ["duration_value"],
        });
      }
      if (!data.duration_unit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Rental duration unit (day/week/month) is required",
          path: ["duration_unit"],
        });
      }
    }

    // Identity validation: must provide equipment_id OR (category_id or custom_description)
    const hasEquipment = Boolean(data.equipment_id);
    const hasCategory = Boolean(data.category_id);
    const hasCustom = Boolean(data.custom_description && data.custom_description.trim().length > 0);

    if (!hasEquipment && !hasCategory && !hasCustom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select a specific machine, choose a category, or describe your equipment requirement",
        path: ["equipment_id"],
      });
    }

    if (hasEquipment && (hasCategory || Boolean(data.brand_id) || hasCustom)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "When selecting a catalogue machine, category, brand, and custom description must be omitted",
        path: ["custom_description"],
      });
    }
  });

export type RfqItemInput = z.infer<typeof rfqItemSchema>;

export const rfqAttachmentInputSchema = z.object({
  id: z.string().uuid().optional(),
  storage_path: z.string().min(1, "Storage path required"),
  original_name: z.string().min(1, "Original name required"),
  mime_type: z.string().min(1, "MIME type required"),
  size_bytes: z.coerce.number().int().positive().max(10485760, "Maximum file size is 10MB"),
});

export type RfqAttachmentInput = z.infer<typeof rfqAttachmentInputSchema>;

export const rfqSubmissionSchema = z.object({
  id: z.string().uuid().optional(),
  idempotency_key: z.string().uuid().optional(),
  source: rfqSourceEnum.default("website"),

  // Company details
  company_name: z
    .string()
    .trim()
    .min(2, "Company name must be at least 2 characters")
    .max(150, "Company name must not exceed 150 characters"),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
      "Please enter a valid 15-character GSTIN (e.g. 07AABCR1234F1Z5)"
    )
    .optional()
    .nullable()
    .or(z.literal("")),
  company_city: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  company_state_code: z.string().trim().length(2).optional().nullable().or(z.literal("")),

  // Contact details
  full_name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must not exceed 100 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid business email address")
    .max(150, "Email must not exceed 150 characters"),
  phone: z
    .string()
    .trim()
    .refine((val) => {
      const cleaned = val.replace(/[\s\-\(\)]/g, "");
      return /^(\+91)?[6-9]\d{9}$/.test(cleaned);
    }, "Please enter a valid 10-digit Indian mobile number (e.g. +91 98765 43210)"),

  // Project details
  project_city: z
    .string()
    .trim()
    .min(2, "Project city is required")
    .max(100, "Project city must not exceed 100 characters"),
  project_state_code: z
    .string()
    .trim()
    .length(2, "State code must be a 2-letter Indian state code"),
  project_site_address: z
    .string()
    .trim()
    .max(500, "Site address must not exceed 500 characters")
    .optional()
    .nullable()
    .or(z.literal("")),
  required_from: z.string().optional().nullable().or(z.literal("")),

  // Items
  items: z
    .array(rfqItemSchema)
    .min(1, "Please specify at least one equipment item")
    .max(10, "Maximum 10 items per quote request"),

  // Additional Notes
  client_notes: z
    .string()
    .trim()
    .max(4000, "Notes must not exceed 4000 characters")
    .optional()
    .nullable()
    .or(z.literal("")),

  // Attachments
  attachments: z
    .array(rfqAttachmentInputSchema)
    .max(5, "Maximum 5 attachments allowed")
    .optional()
    .default([]),

  // Compliance (DPDP Act 2023)
  consent: z
    .boolean({ required_error: "Consent is required" })
    .refine((val) => val === true, "You must consent to data processing for quote generation"),

  // Security & Anti-abuse
  honeypot: z.string().max(0, "Bot detected").optional().or(z.literal("")),
  form_render_time: z.coerce.number().optional(),
  turnstile_token: z.string().optional().nullable().or(z.literal("")),
  attribution: z.record(z.unknown()).optional().default({}),
});

export type RfqSubmissionInput = z.infer<typeof rfqSubmissionSchema>;

// Admin mutating action schemas
export const rfqStatusUpdateSchema = z.object({
  id: z.string().uuid("Invalid RFQ reference"),
  to_status: rfqStatusEnum,
  expected_version: z.number().int().min(1),
  lost_reason: z
    .enum([
      "price",
      "availability",
      "competitor",
      "no_response",
      "project_cancelled",
      "client_cancelled",
      "not_serviceable",
      "other",
    ])
    .optional()
    .nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

export type RfqStatusUpdateInput = z.infer<typeof rfqStatusUpdateSchema>;

export const rfqAssignSchema = z.object({
  id: z.string().uuid("Invalid RFQ reference"),
  assigned_to: z.string().uuid().optional().nullable(),
  expected_version: z.number().int().min(1),
});
export type RfqAssignInput = z.infer<typeof rfqAssignSchema>;

export const rfqNoteSchema = z.object({
  id: z.string().uuid("Invalid RFQ reference"),
  text: z.string().trim().min(1, "Note cannot be empty").max(2000),
});
export type RfqNoteInput = z.infer<typeof rfqNoteSchema>;

export const rfqFollowUpSchema = z.object({
  id: z.string().uuid("Invalid RFQ reference"),
  follow_up_at: z.string().datetime().nullable(),
});
export type RfqFollowUpInput = z.infer<typeof rfqFollowUpSchema>;

export const rfqContactLogSchema = z.object({
  id: z.string().uuid("Invalid RFQ reference"),
  channel: z.enum(["phone", "whatsapp", "email", "meeting", "other"]),
  summary: z.string().trim().min(1, "Summary is required").max(2000),
});
export type RfqContactLogInput = z.infer<typeof rfqContactLogSchema>;
