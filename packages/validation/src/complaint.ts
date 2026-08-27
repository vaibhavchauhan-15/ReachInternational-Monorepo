import { z } from "zod";

export const CreateComplaintSchema = z.object({
  machine_id: z.string().uuid("Invalid Machine reference"),
  supervisor_id: z.string().uuid().optional().nullable(),
  engineer_id: z.string().uuid().optional().nullable(),
  complaint_date: z.string().min(1, "Complaint date is required").max(50, "Complaint date cannot exceed 50 characters"),
  location: z.string().max(255, "Location cannot exceed 255 characters").optional().nullable(),
  state_name: z.string().max(100, "State name cannot exceed 100 characters").optional().nullable(),
  city: z.string().max(100, "City cannot exceed 100 characters").optional().nullable(),
  hour_meter: z.number().min(0, "Hour meter reading must be non-negative"),
  required_part: z.string().max(200, "Required part string cannot exceed 200 characters").optional().nullable(),
  part_quantity: z.number().min(0).optional().default(0),
  complaint: z.string().min(5, "Complaint description must be at least 5 characters").max(1000, "Complaint description cannot exceed 1000 characters"),
  images: z.array(z.string().max(2048)).optional().default([]),
});

export const UpdateComplaintSchema = CreateComplaintSchema.partial().extend({
  id: z.string().min(1, "Complaint ID is required").max(100),
  status: z.enum(["open", "in_progress", "pending_parts", "resolved", "closed"]).optional(),
  work_done: z.string().max(2000, "Work done description cannot exceed 2000 characters").optional().nullable(),
  pending_work: z.string().max(1000, "Pending work description cannot exceed 1000 characters").optional().nullable(),
  end_date: z.string().max(50).optional().nullable(),
});

export const ResolveComplaintSchema = z.object({
  id: z.string().min(1, "Complaint ID is required").max(100),
  work_done: z.string().min(5, "Work done description is required").max(2000, "Work done description cannot exceed 2000 characters"),
  pending_work: z.string().max(1000, "Pending work description cannot exceed 1000 characters").optional().nullable(),
  parts_used: z.array(z.object({
    product_id: z.string().max(100),
    quantity: z.number().positive(),
  })).optional().default([]),
});

export type CreateComplaintInput = z.infer<typeof CreateComplaintSchema>;
export type UpdateComplaintInput = z.infer<typeof UpdateComplaintSchema>;
export type ResolveComplaintInput = z.infer<typeof ResolveComplaintSchema>;
