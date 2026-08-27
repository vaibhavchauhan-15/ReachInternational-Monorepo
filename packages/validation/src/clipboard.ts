import { z } from "zod";

/**
 * Machine Serial Number Schema for Clipboard & Form Input Validation.
 * Accepts alphanumeric characters, dots, underscores, and hyphens.
 */
export const MachineSerialSchema = z
  .string()
  .trim()
  .min(1, "Machine serial number is required")
  .max(100, "Machine serial number cannot exceed 100 characters")
  .regex(
    /^[A-Za-z0-9._-]+$/,
    "Invalid machine serial number (only letters, numbers, '.', '_', and '-' allowed)"
  );

/**
 * Hour Meter (HMR) Schema for Clipboard & Form Input Validation.
 * Ensures non-negative numbers within realistic industrial operational limits.
 */
export const HmrSchema = z
  .union([z.number(), z.string()])
  .transform((val) => (typeof val === "string" ? parseFloat(val.trim()) : val))
  .pipe(
    z
      .number({ invalid_type_error: "Meter reading must be a valid number" })
      .min(0, "Meter reading cannot be negative")
      .max(1000000, "Meter reading exceeds maximum allowed limit (1,000,000 hrs)")
  );

/**
 * UUID Identifier Schema for Machine ID, Client ID, and User ID.
 */
export const UuidIdSchema = z
  .string()
  .trim()
  .uuid("Invalid resource identifier format");

/**
 * Machine ID Schema (allows UUID or standard machine code e.g. RI-MC-0001).
 */
export const MachineIdSchema = z
  .string()
  .trim()
  .min(1, "Machine ID is required")
  .max(50, "Machine ID cannot exceed 50 characters")
  .regex(
    /^[A-Za-z0-9._-]+$/,
    "Invalid machine ID format"
  );

/**
 * Phone Number Schema (Exactly 10 digits for Indian standard phone numbers).
 */
export const PhoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits");

/**
 * Email Schema for Clipboard & Form Input Validation.
 */
export const EmailSchema = z
  .string()
  .trim()
  .email("Invalid email address format")
  .max(255, "Email address format cannot exceed 255 characters");

/**
 * Time String Schema (HH:MM or HH:MM AM/PM).
 */
export const TimeStringSchema = z
  .string()
  .trim()
  .max(20, "Time string cannot exceed 20 characters")
  .regex(
    /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](\s*(AM|PM|am|pm))?$/,
    "Invalid time format (expected HH:MM or HH:MM AM/PM)"
  );

/**
 * Remarks & Notes Schema (Max 500 characters plain text, HTML tags stripped).
 */
export const RemarksSchema = z
  .string()
  .trim()
  .max(500, "Remarks cannot exceed 500 characters")
  .transform((str) => str.replace(/<[^>]*>?/g, ""));

/**
 * Generic Untrusted Clipboard Payload Wrapper Schema.
 */
export const ClipboardPayloadSchema = z.object({
  rawText: z.string().max(2048, "Clipboard payload text cannot exceed 2048 characters"),
  sourceField: z.string().max(100, "Source field cannot exceed 100 characters").optional(),
});

export type MachineSerialInput = z.infer<typeof MachineSerialSchema>;
export type HmrInput = z.infer<typeof HmrSchema>;
export type UuidIdInput = z.infer<typeof UuidIdSchema>;
export type PhoneInput = z.infer<typeof PhoneSchema>;
export type EmailInput = z.infer<typeof EmailSchema>;
export type TimeStringInput = z.infer<typeof TimeStringSchema>;
export type RemarksInput = z.infer<typeof RemarksSchema>;
