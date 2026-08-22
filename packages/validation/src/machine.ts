import { z } from "zod";

export const CreateMachineSchema = z.object({
  machine_id: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  year_of_mfg: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  current_supervisor_id: z.string().optional().nullable(),
  hour_meter: z.number().min(0).optional().default(0),
  service_count: z.number().int().min(0).optional().default(0),
  current_operator_id: z.string().optional().nullable(),
  health_status: z.enum(["active", "under_maintenance", "breakdown"]).optional().default("active"),
  status: z.enum(["available", "rented"]).optional().default("available"),
  // Backward compatibility fields during transition
  machine_code: z.string().optional().nullable(),
  machine_name: z.string().optional().nullable(),
  customer_name: z.string().optional().nullable(),
  customer_mobile: z.string().optional().nullable(),
  customer_email: z.string().optional().nullable(),
  customer_address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
});

export const UpdateMachineSchema = CreateMachineSchema.partial().extend({
  id: z.string().min(1, "Machine ID is required"),
});

export const MachineCategorySchema = z.object({
  name: z.string().min(2, "Category name is required"),
  description: z.string().optional().nullable(),
});

export const MachineModelSchema = z.object({
  manufacturer_id: z.string().min(1, "Manufacturer is required"),
  model_name: z.string().min(1, "Model name is required"),
  category_id: z.string().optional().nullable(),
  specs: z.record(z.unknown()).optional().nullable(),
});

export const ManufacturerSchema = z.object({
  name: z.string().min(2, "Manufacturer name is required"),
  country: z.string().optional().nullable(),
});

export type CreateMachineInput = z.infer<typeof CreateMachineSchema>;
export type UpdateMachineInput = z.infer<typeof UpdateMachineSchema>;
export type MachineCategoryInput = z.infer<typeof MachineCategorySchema>;
export type MachineModelInput = z.infer<typeof MachineModelSchema>;
export type ManufacturerInput = z.infer<typeof ManufacturerSchema>;
