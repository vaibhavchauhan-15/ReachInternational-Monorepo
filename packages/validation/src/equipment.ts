import { z } from "zod";

/**
 * Validation schema for public equipment quotation and hire enquiries.
 */
export const equipmentEnquirySchema = z.object({
  equipment_id: z.string().uuid("Invalid equipment reference").optional().nullable(),
  customer_name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters"),
  company_name: z
    .string()
    .trim()
    .max(120, "Company name must not exceed 120 characters")
    .optional()
    .nullable()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$|^(\+91[\-\s]?)?[0]?(91)?[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(150, "Email must not exceed 150 characters"),
  project_location: z
    .string()
    .trim()
    .min(2, "Project location / city is required")
    .max(150, "Project location must not exceed 150 characters"),
  requirement_type: z.enum(["rental", "purchase", "both"], {
    errorMap: () => ({ message: "Please select rental, purchase, or both" }),
  }),
  rental_duration: z
    .string()
    .trim()
    .max(100, "Rental duration must not exceed 100 characters")
    .optional()
    .nullable()
    .or(z.literal("")),
  additional_requirements: z
    .string()
    .trim()
    .max(2000, "Additional requirements must not exceed 2000 characters")
    .optional()
    .nullable()
    .or(z.literal("")),
  source_url: z
    .string()
    .trim()
    .max(500, "Source URL must not exceed 500 characters")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type EquipmentEnquiryInput = z.infer<typeof equipmentEnquirySchema>;

/**
 * Validation schema for updating equipment enquiry status
 */
export const equipmentEnquiryStatusSchema = z.object({
  id: z.string().uuid("Invalid enquiry reference"),
  status: z.enum(["new", "contacted", "quoted", "closed", "rejected"]),
});
export type EquipmentEnquiryStatusInput = z.infer<typeof equipmentEnquiryStatusSchema>;

/**
 * Validation schema for creating or updating an equipment model
 */
export const equipmentUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  brand_id: z.string().uuid("Please select a brand"),
  category_id: z.string().uuid("Please select a category"),
  model_name: z.string().trim().min(2, "Model name must be at least 2 characters").max(150),
  model_number: z.string().trim().min(1, "Model number is required").max(60),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  power: z.enum(["electric", "diesel", "hybrid", "bi_energy", "manual"]).default("electric"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  subtype: z.string().trim().max(100).optional().nullable(),
  tagline: z.string().trim().max(200).optional().nullable(),
  summary: z.string().trim().max(500).optional().nullable(),
  full_description: z.string().trim().min(10, "Description must be at least 10 characters"),
  description_md: z.string().trim().optional().nullable(),
  primary_image_url: z.string().trim().default("/images/awp_scissor_lift.jpg"),
  cover_path: z.string().trim().optional().nullable(),
  cover_blur: z.string().trim().optional().nullable(),
  is_featured: z.boolean().default(false),
  rental_available: z.boolean().default(true),
  purchase_available: z.boolean().default(true),
  indoor_use: z.boolean().default(true),
  outdoor_use: z.boolean().default(false),
  primary_working_height: z.string().trim().max(100).optional().nullable(),
  primary_capacity: z.string().trim().max(100).optional().nullable(),
  primary_power_source: z.string().trim().max(100).optional().nullable(),
  max_platform_height_m: z.number().positive().optional().nullable(),
  max_working_height_m: z.number().positive().optional().nullable(),
  capacity_kg: z.number().int().positive().optional().nullable(),
  weight_kg: z.number().int().positive().optional().nullable(),
  applications: z.array(z.string().trim()).default([]),
  features: z.array(z.string().trim()).default([]),
  tags: z.array(z.string().trim()).default([]),
  specs: z.record(z.string(), z.object({
    v: z.union([z.number(), z.string(), z.boolean(), z.null()]),
    d: z.string().optional(),
  })).default({}),
  sort_weight: z.number().int().default(0),
  seo_title: z.string().trim().max(150).optional().nullable(),
  seo_description: z.string().trim().max(250).optional().nullable(),
  version: z.number().int().default(1),
});

export type EquipmentUpsertInput = z.infer<typeof equipmentUpsertSchema>;

/**
 * Strict publication validation schema ensuring completeness before publishing
 */
export const equipmentPublishValidationSchema = equipmentUpsertSchema.extend({
  summary: z.string().trim().min(10, "A concise summary is required before publishing"),
  primary_image_url: z.string().trim().min(3, "Primary image is required before publishing"),
});

