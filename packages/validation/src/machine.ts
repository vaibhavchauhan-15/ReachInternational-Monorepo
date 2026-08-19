import { z } from "zod";

export const CreateMachineSchema = z.object({
  machine_code: z.string().min(2, "Machine code is required"),
  machine_name: z.string().min(2, "Machine name is required"),
  model: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  year_of_mfg: z.string().optional().nullable(),
  category_id: z.string().optional().nullable(),
  branch_id: z.string().optional().nullable(),
  manufacturer_id: z.string().optional().nullable(),
  model_id: z.string().optional().nullable(),
  ownership_type: z.enum(["company_owned", "customer_owned", "rental_fleet"]).optional().default("company_owned"),
  purchase_date: z.string().optional().nullable(),
  purchase_cost: z.number().min(0).optional().nullable(),
  warranty_end_date: z.string().optional().nullable(),
  hour_meter: z.number().min(0).optional().default(0),
  customer_name: z.string().min(2, "Customer name is required"),
  customer_mobile: z.string().min(10, "Valid mobile number required"),
  customer_email: z.string().email().optional().nullable().or(z.literal("")),
  customer_address: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  engineer_id: z.string().optional().nullable(),
  current_operator_id: z.string().optional().nullable(),
  current_supervisor_id: z.string().optional().nullable(),
  service_interval_days: z.number().positive().optional().default(90),
  status: z.enum(["active", "inactive", "on_rent", "under_maintenance"]).optional().default("active"),
  notes: z.string().optional().nullable(),
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
