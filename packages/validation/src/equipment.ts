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
