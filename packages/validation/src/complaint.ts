import { z } from "zod";

export const CreateComplaintSchema = z.object({
  machine_id: z.string().min(1, "Machine reference is required"),
  supervisor_id: z.string().optional().nullable(),
  engineer_id: z.string().optional().nullable(),
  complaint_date: z.string().min(1, "Complaint date is required"),
  location: z.string().optional().nullable(),
  state_name: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  hour_meter: z.number().min(0, "Hour meter reading must be non-negative"),
  required_part: z.string().optional().nullable(),
  part_quantity: z.number().min(0).optional().default(0),
  complaint: z.string().min(5, "Complaint description must be at least 5 characters"),
  images: z.array(z.string()).optional().default([]),
});

export const UpdateComplaintSchema = CreateComplaintSchema.partial().extend({
  id: z.string().min(1, "Complaint ID is required"),
  status: z.enum(["open", "in_progress", "pending_parts", "resolved", "closed"]).optional(),
  work_done: z.string().optional().nullable(),
  pending_work: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
});

export const ResolveComplaintSchema = z.object({
  id: z.string().min(1, "Complaint ID is required"),
  work_done: z.string().min(5, "Work done description is required"),
  pending_work: z.string().optional().nullable(),
  parts_used: z.array(z.object({
    product_id: z.string(),
    quantity: z.number().positive(),
  })).optional().default([]),
});

export type CreateComplaintInput = z.infer<typeof CreateComplaintSchema>;
export type UpdateComplaintInput = z.infer<typeof UpdateComplaintSchema>;
export type ResolveComplaintInput = z.infer<typeof ResolveComplaintSchema>;
