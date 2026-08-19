import { z } from "zod";

export const FsrChecklistSchema = z.object({
  engine_condition: z.string().optional(),
  hydraulic_system: z.string().optional(),
  electrical_system: z.string().optional(),
  transmission: z.string().optional(),
  brakes_steering: z.string().optional(),
  chassis_body: z.string().optional(),
  safety_devices: z.string().optional(),
  custom_checks: z.record(z.unknown()).optional(),
});

export const CreateFsrSchema = z.object({
  service_record_id: z.string().optional().nullable(),
  complaint_id: z.string().optional().nullable(),
  machine_id: z.string().min(1, "Machine is required"),
  engineer_id: z.string().min(1, "Service engineer is required"),
  service_date: z.string().min(1, "Service date is required"),
  hour_meter: z.number().min(0, "Hour meter reading required"),
  work_performed: z.string().min(5, "Work performed description is required"),
  recommendations: z.string().optional().nullable(),
  customer_signature_url: z.string().optional().nullable(),
  engineer_signature_url: z.string().optional().nullable(),
  checklist_data: FsrChecklistSchema.optional(),
  parts_replaced: z.array(z.object({
    part_number: z.string(),
    part_name: z.string(),
    quantity: z.number().positive(),
  })).optional().default([]),
  photos: z.array(z.string()).optional().default([]),
});

export const UpdateFsrSchema = CreateFsrSchema.partial().extend({
  id: z.string().min(1, "FSR ID is required"),
});

export type FsrChecklistInput = z.infer<typeof FsrChecklistSchema>;
export type CreateFsrInput = z.infer<typeof CreateFsrSchema>;
export type UpdateFsrInput = z.infer<typeof UpdateFsrSchema>;
