import { z } from "zod";

export const SalesLeadSchema = z.object({
  company_name: z.string().min(2, "Company name is required"),
  contact_person: z.string().min(2, "Contact person is required"),
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email().optional().nullable().or(z.literal("")),
  location: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  requirement: z.string().optional().nullable(),
  machine_model: z.string().optional().nullable(),
  expected_quantity: z.number().positive().optional().default(1),
  lead_source: z.string().optional().default("Direct"),
  status: z.enum(["New", "Contacted", "Qualified", "Requirement Identified", "Quotation", "Negotiation", "Won", "Lost"]).optional().default("New"),
  assigned_to: z.string().optional().nullable(),
  branch_id: z.string().optional().nullable(),
});

export const SalesOpportunitySchema = z.object({
  title: z.string().min(2, "Title is required"),
  customer_id: z.string().min(1, "Customer is required"),
  lead_id: z.string().optional().nullable(),
  machine_model: z.string().min(1, "Machine model is required"),
  quantity: z.number().positive().optional().default(1),
  expected_value: z.number().min(0),
  probability: z.number().min(0).max(100).optional().default(50),
  stage: z.enum(["Lead", "Qualified", "Opportunity", "Quotation", "Negotiation", "Order Won", "Order Lost"]).optional().default("Lead"),
  branch_id: z.string().optional().nullable(),
});

export const SalesQuotationSchema = z.object({
  opportunity_id: z.string().optional().nullable(),
  customer_id: z.string().min(1, "Customer is required"),
  customer_name: z.string().min(2, "Customer name is required"),
  machine_model: z.string().min(1, "Machine model required"),
  quantity: z.number().positive(),
  unit_price: z.number().positive("Unit price must be positive"),
  discount_percent: z.number().min(0).max(100).optional().default(0),
  tax_percent: z.number().min(0).optional().default(18),
  delivery_charges: z.number().min(0).optional().default(0),
  warranty_terms: z.string().optional().default("1 Year Warranty"),
  payment_terms: z.string().optional().default("100% Advance"),
  delivery_terms: z.string().optional().default("Ex-Warehouse"),
});

export const SalesOrderSchema = z.object({
  quotation_id: z.string().optional().nullable(),
  customer_id: z.string().min(1, "Customer is required"),
  customer_name: z.string().min(2, "Customer name is required"),
  machine_model: z.string().min(1, "Machine model required"),
  quantity: z.number().positive(),
  final_unit_price: z.number().positive(),
  delivery_location: z.string().min(1, "Delivery location required"),
  delivery_date: z.string().optional().nullable(),
  branch_id: z.string().optional().nullable(),
});

export type SalesLeadInput = z.infer<typeof SalesLeadSchema>;
export type SalesOpportunityInput = z.infer<typeof SalesOpportunitySchema>;
export type SalesQuotationInput = z.infer<typeof SalesQuotationSchema>;
export type SalesOrderInput = z.infer<typeof SalesOrderSchema>;
