import { z } from "zod";

export const CreateClientSchema = z.object({
  clientName: z.string().trim().min(2, "Client name must be at least 2 characters").max(100, "Client name cannot exceed 100 characters"),
  companyName: z.string().trim().max(100, "Company name cannot exceed 100 characters").optional().or(z.literal("")),
  contactPerson: z.string().trim().max(100, "Contact person cannot exceed 100 characters").optional().or(z.literal("")),
  phone: z.string().trim().max(15, "Phone number cannot exceed 15 characters").optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email address").max(255, "Email cannot exceed 255 characters").optional().or(z.literal("")),
  gstin: z.string().trim().max(15, "GSTIN cannot exceed 15 characters").optional().or(z.literal("")),
  address: z.string().trim().min(2, "Address is required").max(500, "Address cannot exceed 500 characters"),
  city: z.string().trim().min(2, "City is required").max(100, "City cannot exceed 100 characters"),
  state: z.string().trim().min(2, "State is required").max(100, "State cannot exceed 100 characters"),
  pincode: z.string().trim().max(10, "Pincode cannot exceed 10 characters").optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(500, "Notes cannot exceed 500 characters").optional().nullable().or(z.literal("")),
  status: z.enum(["active", "inactive"]).default("active"),
});

export type CreateClientInput = z.infer<typeof CreateClientSchema>;

export const UpdateClientSchema = CreateClientSchema.partial().extend({
  id: z.string().uuid("Invalid client ID"),
  clientName: z.string().trim().min(2, "Client name must be at least 2 characters").max(100, "Client name cannot exceed 100 characters"),
  address: z.string().trim().min(2, "Address is required").max(500, "Address cannot exceed 500 characters"),
  city: z.string().trim().min(2, "City is required").max(100, "City cannot exceed 100 characters"),
  state: z.string().trim().min(2, "State is required").max(100, "State cannot exceed 100 characters"),
});

export type UpdateClientInput = z.infer<typeof UpdateClientSchema>;
