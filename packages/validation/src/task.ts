import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Task title is required").max(200, "Title must be under 200 characters"),
  description: z.string().optional().nullable(),
  due_date: z.string().min(1, "Due date is required"),
  due_time: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  assignee_ids: z.array(z.string().uuid("Invalid assignee user ID")).min(1, "Assign task to at least one employee"),
  reminder_offset: z.enum(["none", "10m", "30m", "1h", "1d"]).default("none"),
  branch_id: z.string().uuid().optional().nullable(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  id: z.string().uuid("Task ID is required"),
  status: z.enum(["pending", "in_progress", "completed", "overdue", "cancelled", "reopened"]).optional(),
});

export const completeTaskSchema = z.object({
  taskId: z.string().uuid("Invalid task ID"),
  completion_notes: z.string().optional().nullable(),
  proof_file_urls: z.array(z.string().url()).optional(),
});

export const verifyTaskSchema = z.object({
  taskId: z.string().uuid("Invalid task ID"),
  decision: z.enum(["verify", "reopen"]),
  reason: z.string().optional().nullable(),
});

export const taskCommentSchema = z.object({
  taskId: z.string().uuid("Invalid task ID"),
  comment: z.string().min(1, "Comment cannot be empty"),
  parentId: z.string().uuid().optional().nullable(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;
export type VerifyTaskInput = z.infer<typeof verifyTaskSchema>;
export type TaskCommentInput = z.infer<typeof taskCommentSchema>;
