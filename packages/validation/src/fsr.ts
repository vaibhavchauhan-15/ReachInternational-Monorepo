import { z } from "zod";

export const FsrChecklistSchema = z.object({
  engine_condition: z.string().max(255).optional(),
  hydraulic_system: z.string().max(255).optional(),
  electrical_system: z.string().max(255).optional(),
  transmission: z.string().max(255).optional(),
  brakes_steering: z.string().max(255).optional(),
  chassis_body: z.string().max(255).optional(),
  safety_devices: z.string().max(255).optional(),
  custom_checks: z.record(z.unknown()).optional(),
});

export const CreateFsrSchema = z.object({
  service_record_id: z.string().max(100).optional().nullable(),
  complaint_id: z.string().max(100).optional().nullable(),
  machine_id: z.string().min(1, "Machine is required").max(100),
  engineer_id: z.string().min(1, "Service engineer is required").max(100),
  service_date: z.string().min(1, "Service date is required").max(50),
  hour_meter: z.number().min(0, "Hour meter reading required"),
  work_performed: z.string().min(5, "Work performed description is required").max(2000, "Work performed description cannot exceed 2000 characters"),
  recommendations: z.string().max(1000, "Recommendations cannot exceed 1000 characters").optional().nullable(),
  customer_signature_url: z.string().max(2048).optional().nullable(),
  engineer_signature_url: z.string().max(2048).optional().nullable(),
  checklist_data: FsrChecklistSchema.optional(),
  parts_replaced: z.array(z.object({
    part_number: z.string().max(100),
    part_name: z.string().max(100),
    quantity: z.number().positive(),
  })).optional().default([]),
  photos: z.array(z.string().max(2048)).optional().default([]),
});

export const UpdateFsrSchema = CreateFsrSchema.partial().extend({
  id: z.string().min(1, "FSR ID is required").max(100),
});

export type FsrChecklistInput = z.infer<typeof FsrChecklistSchema>;
export type CreateFsrInput = z.infer<typeof CreateFsrSchema>;
export type UpdateFsrInput = z.infer<typeof UpdateFsrSchema>;
