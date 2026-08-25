import { z } from "zod";

export const CreateClientSchema = z.object({
  clientName: z.string().trim().min(2, "Client name must be at least 2 characters"),
  companyName: z.string().trim().optional().or(z.literal("")),
  contactPerson: z.string().trim().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email address").optional().or(z.literal("")),
  gstin: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  state: z.string().trim().optional().or(z.literal("")),
  pincode: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).default("active"),
});

export type CreateClientInput = z.infer<typeof CreateClientSchema>;

export const UpdateClientSchema = CreateClientSchema.partial().extend({
  id: z.string().uuid("Invalid client ID"),
});

export type UpdateClientInput = z.infer<typeof UpdateClientSchema>;
