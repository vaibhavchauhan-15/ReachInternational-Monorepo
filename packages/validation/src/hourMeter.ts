import { z } from "zod";

export const CreateHourLogSchema = z.object({
  machine_id: z.string().min(1, "Machine reference is required").max(100, "Machine reference cannot exceed 100 characters"),
  log_date: z.string().min(1, "Log date is required").max(50, "Log date string cannot exceed 50 characters"),
  end_date: z.string().max(50, "End date string cannot exceed 50 characters").optional().nullable(),
  start_datetime: z.string().max(100, "Start datetime cannot exceed 100 characters").optional().nullable(),
  end_datetime: z.string().max(100, "End datetime cannot exceed 100 characters").optional().nullable(),
  start_meter: z.number({ required_error: "Start meter reading is required", invalid_type_error: "Start meter reading must be a valid number" }).min(0, "Start meter reading must be non-negative"),
  end_meter: z.number({ required_error: "End meter reading is required", invalid_type_error: "End meter reading must be a valid number" }).min(0, "End meter reading must be non-negative"),
  location: z.string().max(255, "Location cannot exceed 255 characters").optional().nullable(),
  remarks: z.string().max(500, "Remarks cannot exceed 500 characters").optional().nullable(),
  shift: z.string().max(50, "Shift cannot exceed 50 characters").optional().nullable(),
  machine_condition: z.enum(["good", "fair", "needs_attention", "breakdown"]).optional().nullable(),
  start_time: z.string().max(20, "Start time string cannot exceed 20 characters").optional().nullable(),
  end_time: z.string().max(20, "End time string cannot exceed 20 characters").optional().nullable(),
  overtime_hours: z.number().min(0).optional().nullable(),
  normal_working_hours: z.number().min(0).optional().nullable(),
  is_breakdown: z.boolean().optional().nullable(),
  breakdown_start_time: z.string().max(20, "Breakdown start time string cannot exceed 20 characters").optional().nullable(),
  breakdown_end_time: z.string().max(20, "Breakdown end time string cannot exceed 20 characters").optional().nullable(),
  breakdown_duration: z.string().max(100, "Breakdown duration string cannot exceed 100 characters").optional().nullable(),
  breakdown_hours: z.number().min(0).optional().nullable(),
  idempotency_key: z.string().max(128, "Idempotency key cannot exceed 128 characters").optional().nullable(),
}).refine((data) => data.end_meter >= data.start_meter, {
  message: "End meter reading cannot be less than start meter reading",
  path: ["end_meter"],
}).refine((data) => (data.end_meter - data.start_meter) <= 24, {
  message: "Machine running hours cannot exceed 24 hours in a single log.",
  path: ["end_meter"],
}).refine((data) => {
  if (!data.end_datetime) return true;
  let endMs: number;
  const str = data.end_datetime.trim();
  if (!str.includes('+') && !str.endsWith('Z') && !str.match(/-\d{2}:\d{2}$/)) {
    const cleanStr = str.replace(' ', 'T');
    endMs = new Date(`${cleanStr}+05:30`).getTime();
  } else {
    endMs = new Date(str).getTime();
  }
  if (isNaN(endMs)) return true;
  // Allow 60 seconds grace period for network latency and clock skew
  return endMs <= Date.now() + 60 * 1000;
}, {
  message: "Cannot log before shift end.",
  path: ["end_datetime"],
}).refine((data) => {
  if (data.is_breakdown && typeof data.breakdown_hours === "number" && data.breakdown_hours > 0 && data.start_datetime && data.end_datetime) {
    const sMs = new Date(data.start_datetime).getTime();
    const eMs = new Date(data.end_datetime).getTime();
    if (!isNaN(sMs) && !isNaN(eMs) && eMs > sMs) {
      const shiftDurationHours = (eMs - sMs) / (1000 * 60 * 60);
      return data.breakdown_hours <= shiftDurationHours;
    }
  }
  return true;
}, {
  message: "Breakdown duration cannot exceed total shift duration.",
  path: ["breakdown_hours"],
});

export type CreateHourLogInput = z.infer<typeof CreateHourLogSchema>;

export const SubmitHourLogSchema = z.object({
  machineId: z.string().min(1, "Machine ID is required"),
  operatorId: z.string().uuid("Invalid operator ID").optional().nullable(),
  clientId: z.string().uuid("Invalid client ID").optional().nullable(),
  startDate: z.string().max(50).optional().nullable(),
  logDate: z.string().max(50).optional().nullable(),
  endDate: z.string().max(50).optional().nullable(),
  startMeter: z.number({ required_error: "Starting hour meter reading is required", invalid_type_error: "Starting hour meter reading must be a valid number" }).min(0, "Starting hour meter reading must be non-negative"),
  endMeter: z.number({ required_error: "Ending hour meter reading is required", invalid_type_error: "Ending hour meter reading must be a valid number" }).min(0, "Ending hour meter reading must be non-negative"),
  startTime: z.string().max(20).optional().nullable(),
  endTime: z.string().max(20).optional().nullable(),
  overtimeHours: z.number().min(0).max(24).optional().nullable(),
  isBreakdown: z.boolean().optional().nullable(),
  breakdownStartTime: z.string().max(20).optional().nullable(),
  breakdownEndTime: z.string().max(20).optional().nullable(),
  breakdownDuration: z.string().max(100).optional().nullable(),
  breakdownHours: z.number().min(0).optional().nullable(),
  shift: z.string().max(50).optional().nullable(),
  machineCondition: z.enum(["good", "fair", "needs_attention", "breakdown"]).optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().max(128).optional().nullable(),
}).refine((data) => data.endMeter >= data.startMeter, {
  message: "Ending hour meter reading cannot be less than starting hour meter reading.",
  path: ["endMeter"],
}).refine((data) => (data.endMeter - data.startMeter) <= 24, {
  message: "Machine running hours cannot exceed 24 hours in a single log.",
  path: ["endMeter"],
});

export type SubmitHourLogInput = z.infer<typeof SubmitHourLogSchema>;

export const UpdateHourLogSchema = z.object({
  logId: z.string().uuid("Invalid log ID format"),
  clientId: z.string().uuid("Invalid client ID format").optional().nullable(),
  startDate: z.string().max(50).optional().nullable(),
  endDate: z.string().max(50).optional().nullable(),
  startMeter: z.number().min(0, "Start meter reading must be non-negative").optional().nullable(),
  endMeter: z.number().min(0, "End meter reading must be non-negative").optional().nullable(),
  startTime: z.string().max(20).optional().nullable(),
  endTime: z.string().max(20).optional().nullable(),
  overtimeHours: z.number().min(0).max(24).optional().nullable(),
  isBreakdown: z.boolean().optional().nullable(),
  breakdownStartTime: z.string().max(20).optional().nullable(),
  breakdownEndTime: z.string().max(20).optional().nullable(),
  breakdownDuration: z.string().max(100).optional().nullable(),
  breakdownHours: z.number().min(0).optional().nullable(),
  shift: z.string().max(50).optional().nullable(),
  machineCondition: z.enum(["good", "fair", "needs_attention", "breakdown"]).optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
}).refine((data) => {
  if (data.startMeter !== undefined && data.startMeter !== null && data.endMeter !== undefined && data.endMeter !== null) {
    return data.endMeter >= data.startMeter;
  }
  return true;
}, {
  message: "Ending hour meter reading cannot be less than starting hour meter reading.",
  path: ["endMeter"],
}).refine((data) => {
  if (data.startMeter !== undefined && data.startMeter !== null && data.endMeter !== undefined && data.endMeter !== null) {
    return (data.endMeter - data.startMeter) <= 24;
  }
  return true;
}, {
  message: "Machine running hours cannot exceed 24 hours in a single log.",
  path: ["endMeter"],
});

export type UpdateHourLogInput = z.infer<typeof UpdateHourLogSchema>;

export const DeleteHourLogSchema = z.object({
  logId: z.string().uuid("Invalid log ID format"),
  reason: z.string().max(255).optional().nullable(),
});

export type DeleteHourLogInput = z.infer<typeof DeleteHourLogSchema>;
