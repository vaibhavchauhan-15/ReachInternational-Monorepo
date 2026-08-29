import { z } from "zod";

export const CreateHourLogSchema = z.object({
  machine_id: z.string().min(1, "Machine reference is required").max(100, "Machine reference cannot exceed 100 characters"),
  log_date: z.string().min(1, "Log date is required").max(50, "Log date string cannot exceed 50 characters"),
  start_meter: z.number().min(0, "Start meter reading must be non-negative"),
  end_meter: z.number().min(0, "End meter reading must be non-negative"),
  location: z.string().max(255, "Location cannot exceed 255 characters").optional().nullable(),
  remarks: z.string().max(500, "Remarks cannot exceed 500 characters").optional().nullable(),
  shift: z.string().max(50, "Shift cannot exceed 50 characters").optional().nullable(),
  machine_condition: z.enum(["good", "fair", "needs_attention", "breakdown"]).optional().nullable(),
  start_time: z.string().max(20, "Start time string cannot exceed 20 characters").optional().nullable(),
  end_time: z.string().max(20, "End time string cannot exceed 20 characters").optional().nullable(),
  overtime_hours: z.number().min(0).optional().nullable(),
  normal_working_hours: z.number().min(0).optional().nullable(),
  is_breakdown: z.boolean().optional().nullable(),
  idempotency_key: z.string().max(128, "Idempotency key cannot exceed 128 characters").optional().nullable(),
}).refine((data) => data.end_meter >= data.start_meter, {
  message: "End meter reading cannot be less than start meter reading",
  path: ["end_meter"],
});

export type CreateHourLogInput = z.infer<typeof CreateHourLogSchema>;
