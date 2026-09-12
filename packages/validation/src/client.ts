import { z } from "zod";

export const CreateClientSchema = z.object({
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(100, "Company name cannot exceed 100 characters"),
  contactPerson: z.string().trim().max(100, "Contact person cannot exceed 100 characters").optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(20, "Phone number cannot exceed 20 characters").optional().nullable().or(z.literal("")),
  gstin: z.string().trim().max(50, "GSTIN cannot exceed 50 characters").optional().nullable().or(z.literal("")),
  panNumber: z.string().trim().max(50, "PAN cannot exceed 50 characters").optional().nullable().or(z.literal("")),
  street: z.string().trim().max(500, "Street address cannot exceed 500 characters").optional().nullable().or(z.literal("")),
  address: z.string().trim().max(500, "Address cannot exceed 500 characters").optional().nullable().or(z.literal("")),
  city: z.string().trim().min(2, "City is required").max(100, "City cannot exceed 100 characters"),
  district: z.string().trim().max(100, "District cannot exceed 100 characters").optional().nullable().or(z.literal("")),
  state: z.string().trim().min(2, "State is required").max(100, "State cannot exceed 100 characters"),
  pincode: z.string().trim().max(20, "Pincode cannot exceed 20 characters").optional().nullable().or(z.literal("")),
  isBillingAddressDifferent: z.boolean().default(false),
  billingAddress: z.string().trim().max(500, "Billing address cannot exceed 500 characters").optional().nullable().or(z.literal("")),
  billingCity: z.string().trim().max(100, "Billing city cannot exceed 100 characters").optional().nullable().or(z.literal("")),
  billingDistrict: z.string().trim().max(100, "Billing district cannot exceed 100 characters").optional().nullable().or(z.literal("")),
  billingState: z.string().trim().max(100, "Billing state cannot exceed 100 characters").optional().nullable().or(z.literal("")),
  billingPincode: z.string().trim().max(20, "Billing pincode cannot exceed 20 characters").optional().nullable().or(z.literal("")),
  status: z.enum(["active", "inactive"]).default("active"),
}).refine(
  (data) => Boolean((data.street && data.street.trim().length > 0) || (data.address && data.address.trim().length > 0)),
  {
    message: "Street / Site address is required",
    path: ["street"],
  }
);

export type CreateClientInput = z.infer<typeof CreateClientSchema>;

export const UpdateClientSchema = z.object({
  id: z.string().uuid("Invalid client ID"),
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(100, "Company name cannot exceed 100 characters"),
  contactPerson: z.string().trim().max(100, "Contact person cannot exceed 100 characters").optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(20, "Phone number cannot exceed 20 characters").optional().nullable().or(z.literal("")),
  gstin: z.string().trim().max(50, "GSTIN cannot exceed 50 characters").optional().nullable().or(z.literal("")),
  panNumber: z.string().trim().max(50, "PAN cannot exceed 50 characters").optional().nullable().or(z.literal("")),
  street: z.string().trim().max(500, "Street address cannot exceed 500 characters").optional().nullable().or(z.literal("")),
  address: z.string().trim().max(500, "Address cannot exceed 500 characters").optional().nullable().or(z.literal("")),
  city: z.string().trim().min(2, "City is required").max(100, "City cannot exceed 100 characters"),
  district: z.string().trim().max(100, "District cannot exceed 100 characters").optional().nullable().or(z.literal("")),
  state: z.string().trim().min(2, "State is required").max(100, "State cannot exceed 100 characters"),
  pincode: z.string().trim().max(20, "Pincode cannot exceed 20 characters").optional().nullable().or(z.literal("")),
  isBillingAddressDifferent: z.boolean().default(false),
  billingAddress: z.string().trim().max(500, "Billing address cannot exceed 500 characters").optional().nullable().or(z.literal("")),
  billingCity: z.string().trim().max(100, "Billing city cannot exceed 100 characters").optional().nullable().or(z.literal("")),
  billingDistrict: z.string().trim().max(100, "Billing district cannot exceed 100 characters").optional().nullable().or(z.literal("")),
  billingState: z.string().trim().max(100, "Billing state cannot exceed 100 characters").optional().nullable().or(z.literal("")),
  billingPincode: z.string().trim().max(20, "Billing pincode cannot exceed 20 characters").optional().nullable().or(z.literal("")),
  status: z.enum(["active", "inactive"]).default("active"),
}).refine(
  (data) => Boolean((data.street && data.street.trim().length > 0) || (data.address && data.address.trim().length > 0)),
  {
    message: "Street / Site address is required",
    path: ["street"],
  }
);

export type UpdateClientInput = z.infer<typeof UpdateClientSchema>;

