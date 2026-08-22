import { z } from "zod";

export const CreateHourLogSchema = z.object({
  machine_id: z.string().min(1, "Machine reference is required"),
  log_date: z.string().min(1, "Log date is required"),
  start_meter: z.number().min(0, "Start meter reading must be non-negative"),
  end_meter: z.number().min(0, "End meter reading must be non-negative"),
  location: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  fuel_consumed: z.number().min(0).optional().nullable(),
  shift: z.string().optional().nullable(),
  start_time: z.string().optional().nullable(),
  end_time: z.string().optional().nullable(),
  overtime_hours: z.number().min(0).optional().nullable(),
  is_breakdown: z.boolean().optional().nullable(),
}).refine((data) => data.end_meter >= data.start_meter, {
  message: "End meter reading cannot be less than start meter reading",
  path: ["end_meter"],
});

export type CreateHourLogInput = z.infer<typeof CreateHourLogSchema>;
