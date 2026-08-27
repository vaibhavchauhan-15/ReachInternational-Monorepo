import { z } from "zod";

export const SalesLeadSchema = z.object({
  company_name: z.string().min(2, "Company name is required").max(100, "Company name cannot exceed 100 characters"),
  contact_person: z.string().min(2, "Contact person is required").max(100, "Contact person cannot exceed 100 characters"),
  phone: z.string().min(10, "Valid phone number required").max(15, "Phone number cannot exceed 15 characters"),
  email: z.string().trim().email("Invalid email").max(255, "Email cannot exceed 255 characters").optional().nullable().or(z.literal("")),
  location: z.string().max(255, "Location cannot exceed 255 characters").optional().nullable(),
  city: z.string().min(1, "City is required").max(100, "City cannot exceed 100 characters"),
  state: z.string().min(1, "State is required").max(100, "State cannot exceed 100 characters"),
  requirement: z.string().max(1000, "Requirement text cannot exceed 1000 characters").optional().nullable(),
  machine_model: z.string().max(100, "Machine model cannot exceed 100 characters").optional().nullable(),
  expected_quantity: z.number().positive().optional().default(1),
  lead_source: z.string().max(50).optional().default("Direct"),
  status: z.enum(["New", "Contacted", "Qualified", "Requirement Identified", "Quotation", "Negotiation", "Won", "Lost"]).optional().default("New"),
  assigned_to: z.string().max(100).optional().nullable(),
  branch_id: z.string().max(100).optional().nullable(),
});

export const SalesOpportunitySchema = z.object({
  title: z.string().min(2, "Title is required").max(200, "Title cannot exceed 200 characters"),
  customer_id: z.string().min(1, "Customer is required").max(100),
  lead_id: z.string().max(100).optional().nullable(),
  machine_model: z.string().min(1, "Machine model is required").max(100),
  quantity: z.number().positive().optional().default(1),
  expected_value: z.number().min(0),
  probability: z.number().min(0).max(100).optional().default(50),
  stage: z.enum(["Lead", "Qualified", "Opportunity", "Quotation", "Negotiation", "Order Won", "Order Lost"]).optional().default("Lead"),
  branch_id: z.string().max(100).optional().nullable(),
});

export const SalesQuotationSchema = z.object({
  opportunity_id: z.string().max(100).optional().nullable(),
  customer_id: z.string().min(1, "Customer is required").max(100),
  customer_name: z.string().min(2, "Customer name is required").max(100),
  machine_model: z.string().min(1, "Machine model required").max(100),
  quantity: z.number().positive(),
  unit_price: z.number().positive("Unit price must be positive"),
  discount_percent: z.number().min(0).max(100).optional().default(0),
  tax_percent: z.number().min(0).optional().default(18),
  delivery_charges: z.number().min(0).optional().default(0),
  warranty_terms: z.string().max(200).optional().default("1 Year Warranty"),
  payment_terms: z.string().max(200).optional().default("100% Advance"),
  delivery_terms: z.string().max(200).optional().default("Ex-Warehouse"),
});

export const SalesOrderSchema = z.object({
  quotation_id: z.string().max(100).optional().nullable(),
  customer_id: z.string().min(1, "Customer is required").max(100),
  customer_name: z.string().min(2, "Customer name is required").max(100),
  machine_model: z.string().min(1, "Machine model required").max(100),
  quantity: z.number().positive(),
  final_unit_price: z.number().positive(),
  delivery_location: z.string().min(1, "Delivery location required").max(255),
  delivery_date: z.string().max(50).optional().nullable(),
  branch_id: z.string().max(100).optional().nullable(),
});

export type SalesLeadInput = z.infer<typeof SalesLeadSchema>;
export type SalesOpportunityInput = z.infer<typeof SalesOpportunitySchema>;
export type SalesQuotationInput = z.infer<typeof SalesQuotationSchema>;
export type SalesOrderInput = z.infer<typeof SalesOrderSchema>;
