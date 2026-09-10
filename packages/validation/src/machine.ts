import { z } from "zod";

export const CreateMachineSchema = z.object({
  machine_id: z.string().max(50, "Machine ID cannot exceed 50 characters").optional().nullable(),
  model: z.string().trim().min(1, "Model is required").max(100, "Model cannot exceed 100 characters"),
  serial_number: z.string().trim().min(1, "Serial number is required").max(100, "Serial number cannot exceed 100 characters"),
  year_of_mfg: z.string().trim().min(1, "Year of manufacture is required").max(10, "Year of MFG cannot exceed 10 characters"),
  manufacturer: z.string().trim().min(1, "Manufacturer is required").max(100, "Manufacturer cannot exceed 100 characters"),
  current_supervisor_id: z.string().uuid().optional().nullable(),
  supervisor_ids: z.array(z.string().uuid()).optional().default([]),
  hour_meter: z.number().min(0).optional().default(0),
  current_operator_id: z.string().uuid().optional().nullable(),
  operator_ids: z.array(z.string().uuid()).optional().default([]),
  client_id: z.string().uuid().optional().nullable(),
  health_status: z.enum(["active", "under_maintenance", "breakdown", "spare"]).optional().default("active"),
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

const TIME_REGEX = /^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:\s*(?:AM|PM))?$/i;

export const CreateAssignmentSchema = z.object({
  machineId: z.string().uuid("Invalid machine ID"),
  operatorId: z.string().uuid("Invalid operator ID"),
  shiftStartTime: z.string().trim().regex(TIME_REGEX, "Shift start time must be a valid time (e.g. 08:00 or 08:00 AM)"),
  shiftEndTime: z.string().trim().regex(TIME_REGEX, "Shift end time must be a valid time (e.g. 16:00 or 04:00 PM)"),
  notes: z.string().max(500, "Notes cannot exceed 500 characters").optional().nullable(),
}).refine((data) => data.shiftStartTime !== data.shiftEndTime, {
  message: "Shift start time and end time cannot be identical",
  path: ["shiftEndTime"],
});

export const EndAssignmentSchema = z.object({
  assignmentId: z.string().uuid("Invalid assignment ID"),
  endReason: z.enum(["reassigned", "removed", "shift_changed", "migrated"]).default("removed"),
  notes: z.string().max(500, "Notes cannot exceed 500 characters").optional().nullable(),
});

export const ResolveConflictSchema = z.object({
  logId: z.string().uuid("Invalid log ID"),
  action: z.enum(["acknowledge", "adjust"]),
  adjustedEndTime: z.string().trim().regex(TIME_REGEX, "Adjusted end time must be a valid time").optional().nullable(),
  notes: z.string().max(500, "Notes cannot exceed 500 characters").optional().nullable(),
});

export type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;
export type EndAssignmentInput = z.infer<typeof EndAssignmentSchema>;
export type ResolveConflictInput = z.infer<typeof ResolveConflictSchema>;

