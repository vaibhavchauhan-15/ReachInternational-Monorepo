import { z } from "zod";

export const CreateMachineSchema = z.object({
  machine_id: z.string().uuid().optional().nullable(),
  model: z.string().max(100, "Model cannot exceed 100 characters").optional().nullable(),
  serial_number: z.string().max(100, "Serial number cannot exceed 100 characters").optional().nullable(),
  year_of_mfg: z.string().max(10, "Year of MFG cannot exceed 10 characters").optional().nullable(),
  manufacturer: z.string().max(100, "Manufacturer cannot exceed 100 characters").optional().nullable(),
  current_supervisor_id: z.string().uuid().optional().nullable(),
  hour_meter: z.number().min(0).optional().default(0),
  service_count: z.number().int().min(0).optional().default(0),
  current_operator_id: z.string().uuid().optional().nullable(),
  health_status: z.enum(["active", "under_maintenance", "breakdown"]).optional().default("active"),
  status: z.enum(["available", "rented"]).optional().default("available"),
  // Backward compatibility fields during transition
  machine_code: z.string().max(50, "Machine code cannot exceed 50 characters").optional().nullable(),
  machine_name: z.string().max(100, "Machine name cannot exceed 100 characters").optional().nullable(),
  customer_name: z.string().max(100, "Customer name cannot exceed 100 characters").optional().nullable(),
  customer_mobile: z.string().max(15, "Mobile number cannot exceed 15 characters").optional().nullable(),
  customer_email: z.string().trim().email("Invalid email").max(255, "Email cannot exceed 255 characters").optional().nullable(),
  customer_address: z.string().max(500, "Customer address cannot exceed 500 characters").optional().nullable(),
  city: z.string().max(100, "City cannot exceed 100 characters").optional().nullable(),
  state: z.string().max(100, "State cannot exceed 100 characters").optional().nullable(),
});

export const UpdateMachineSchema = CreateMachineSchema.partial().extend({
  id: z.string().uuid("Invalid Machine ID"),
});

export const MachineCategorySchema = z.object({
  name: z.string().min(2, "Category name is required").max(100, "Category name cannot exceed 100 characters"),
  description: z.string().max(500, "Description cannot exceed 500 characters").optional().nullable(),
});

export const MachineModelSchema = z.object({
  manufacturer_id: z.string().min(1, "Manufacturer is required").max(100, "Manufacturer ID cannot exceed 100 characters"),
  model_name: z.string().min(1, "Model name is required").max(100, "Model name cannot exceed 100 characters"),
  category_id: z.string().max(100, "Category ID cannot exceed 100 characters").optional().nullable(),
  specs: z.record(z.unknown()).optional().nullable(),
});

export const ManufacturerSchema = z.object({
  name: z.string().min(2, "Manufacturer name is required").max(100, "Manufacturer name cannot exceed 100 characters"),
  country: z.string().max(100, "Country name cannot exceed 100 characters").optional().nullable(),
});

export type CreateMachineInput = z.infer<typeof CreateMachineSchema>;
export type UpdateMachineInput = z.infer<typeof UpdateMachineSchema>;
export type MachineCategoryInput = z.infer<typeof MachineCategorySchema>;
export type MachineModelInput = z.infer<typeof MachineModelSchema>;
export type ManufacturerInput = z.infer<typeof ManufacturerSchema>;
