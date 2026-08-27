import { z } from "zod";

export const RentalCustomerSchema = z.object({
  customer_name: z.string().min(2, "Customer name is required").max(100, "Customer name cannot exceed 100 characters"),
  company_name: z.string().max(100, "Company name cannot exceed 100 characters").optional().nullable(),
  phone: z.string().min(10, "Valid phone number required").max(15, "Phone number cannot exceed 15 characters"),
  email: z.string().trim().email("Invalid email").max(255, "Email cannot exceed 255 characters").optional().nullable().or(z.literal("")),
  billing_address: z.string().max(500, "Billing address cannot exceed 500 characters").optional().nullable(),
  city: z.string().min(1, "City is required").max(100, "City cannot exceed 100 characters"),
  state: z.string().min(1, "State is required").max(100, "State cannot exceed 100 characters"),
  gstin: z.string().max(15, "GSTIN cannot exceed 15 characters").optional().nullable(),
});

export const RentalRequestSchema = z.object({
  customer_id: z.string().min(1, "Rental customer is required").max(100),
  machine_category_id: z.string().max(100).optional().nullable(),
  machine_model: z.string().min(1, "Machine model required").max(100, "Machine model cannot exceed 100 characters"),
  quantity: z.number().positive().optional().default(1),
  start_date: z.string().min(1, "Start date required").max(50),
  expected_end_date: z.string().min(1, "End date required").max(50),
  site_location: z.string().min(1, "Site location is required").max(255, "Site location cannot exceed 255 characters"),
  monthly_rate: z.number().min(0),
  security_deposit: z.number().min(0).optional().default(0),
  notes: z.string().max(1000, "Notes cannot exceed 1000 characters").optional().nullable(),
});

export const RentalAgreementSchema = z.object({
  rental_request_id: z.string().max(100).optional().nullable(),
  customer_id: z.string().min(1, "Customer is required").max(100),
  machine_id: z.string().min(1, "Machine reference is required").max(100),
  agreement_number: z.string().min(1, "Agreement number required").max(50, "Agreement number cannot exceed 50 characters"),
  start_date: z.string().min(1, "Start date required").max(50),
  end_date: z.string().min(1, "End date required").max(50),
  monthly_rate: z.number().positive("Monthly rate must be positive"),
  security_deposit: z.number().min(0).optional().default(0),
  payment_terms: z.string().max(200, "Payment terms cannot exceed 200 characters").optional(),
});

export const ReturnInspectionSchema = z.object({
  agreement_id: z.string().min(1, "Agreement is required").max(100),
  machine_id: z.string().min(1, "Machine is required").max(100),
  inspection_date: z.string().min(1, "Inspection date required").max(50),
  return_hour_meter: z.number().min(0, "Hour meter reading required"),
  condition: z.enum(["excellent", "good", "damaged", "needs_overhaul"]),
  remarks: z.string().max(500, "Remarks cannot exceed 500 characters").optional().nullable(),
});

export const DamageReportSchema = z.object({
  agreement_id: z.string().min(1, "Agreement is required").max(100),
  machine_id: z.string().min(1, "Machine is required").max(100),
  damage_description: z.string().min(5, "Damage description required").max(1000, "Damage description cannot exceed 1000 characters"),
  estimated_repair_cost: z.number().min(0),
  photos: z.array(z.string().max(2048)).optional().default([]),
});

export type RentalCustomerInput = z.infer<typeof RentalCustomerSchema>;
export type RentalRequestInput = z.infer<typeof RentalRequestSchema>;
export type RentalAgreementInput = z.infer<typeof RentalAgreementSchema>;
export type ReturnInspectionInput = z.infer<typeof ReturnInspectionSchema>;
export type DamageReportInput = z.infer<typeof DamageReportSchema>;
