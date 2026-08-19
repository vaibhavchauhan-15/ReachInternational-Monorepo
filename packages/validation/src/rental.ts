import { z } from "zod";

export const RentalCustomerSchema = z.object({
  customer_name: z.string().min(2, "Customer name is required"),
  company_name: z.string().optional().nullable(),
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email().optional().nullable().or(z.literal("")),
  billing_address: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  gstin: z.string().optional().nullable(),
});

export const RentalRequestSchema = z.object({
  customer_id: z.string().min(1, "Rental customer is required"),
  machine_category_id: z.string().optional().nullable(),
  machine_model: z.string().min(1, "Machine model required"),
  quantity: z.number().positive().optional().default(1),
  start_date: z.string().min(1, "Start date required"),
  expected_end_date: z.string().min(1, "End date required"),
  site_location: z.string().min(1, "Site location is required"),
  monthly_rate: z.number().min(0),
  security_deposit: z.number().min(0).optional().default(0),
  notes: z.string().optional().nullable(),
});

export const RentalAgreementSchema = z.object({
  rental_request_id: z.string().optional().nullable(),
  customer_id: z.string().min(1, "Customer is required"),
  machine_id: z.string().min(1, "Machine reference is required"),
  agreement_number: z.string().min(1, "Agreement number required"),
  start_date: z.string().min(1, "Start date required"),
  end_date: z.string().min(1, "End date required"),
  monthly_rate: z.number().positive("Monthly rate must be positive"),
  security_deposit: z.number().min(0).optional().default(0),
  payment_terms: z.string().optional(),
});

export const ReturnInspectionSchema = z.object({
  agreement_id: z.string().min(1, "Agreement is required"),
  machine_id: z.string().min(1, "Machine is required"),
  inspection_date: z.string().min(1, "Inspection date required"),
  return_hour_meter: z.number().min(0, "Hour meter reading required"),
  condition: z.enum(["excellent", "good", "damaged", "needs_overhaul"]),
  remarks: z.string().optional().nullable(),
});

export const DamageReportSchema = z.object({
  agreement_id: z.string().min(1, "Agreement is required"),
  machine_id: z.string().min(1, "Machine is required"),
  damage_description: z.string().min(5, "Damage description required"),
  estimated_repair_cost: z.number().min(0),
  photos: z.array(z.string()).optional().default([]),
});

export type RentalCustomerInput = z.infer<typeof RentalCustomerSchema>;
export type RentalRequestInput = z.infer<typeof RentalRequestSchema>;
export type RentalAgreementInput = z.infer<typeof RentalAgreementSchema>;
export type ReturnInspectionInput = z.infer<typeof ReturnInspectionSchema>;
export type DamageReportInput = z.infer<typeof DamageReportSchema>;
