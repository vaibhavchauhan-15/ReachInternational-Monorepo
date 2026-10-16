import { z } from "zod";

export const CreateTaskSchema = z.object({
  title: z.string().min(1, "Task title is required").max(200, "Title must be under 200 characters"),
  description: z.string().max(2000, "Description cannot exceed 2000 characters").optional().nullable(),
  due_date: z.string().min(1, "Due date is required").max(50, "Due date cannot exceed 50 characters"),
  due_time: z.string().max(20, "Due time cannot exceed 20 characters").optional().nullable(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  assignee_ids: z.array(z.string().uuid("Invalid assignee user ID")).min(1, "Assign task to at least one employee"),
  reminder_offset: z.enum(["none", "10m", "30m", "1h", "1d"]).default("none"),
});

export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  id: z.string().uuid("Task ID is required"),
  status: z.enum(["pending", "in_progress", "completed", "overdue", "cancelled", "reopened"]).optional(),
});

export const CompleteTaskSchema = z.object({
  taskId: z.string().uuid("Invalid task ID"),
  completion_notes: z.string().max(1000, "Completion notes cannot exceed 1000 characters").optional().nullable(),
  proof_file_urls: z.array(z.string().url().max(2048)).optional(),
});

export const VerifyTaskSchema = z.object({
  taskId: z.string().uuid("Invalid task ID"),
  decision: z.enum(["verify", "reopen"]),
  reason: z.string().max(1000, "Reason cannot exceed 1000 characters").optional().nullable(),
});

export const TaskCommentSchema = z.object({
  taskId: z.string().uuid("Invalid task ID"),
  comment: z.string().min(1, "Comment cannot be empty").max(1000, "Comment cannot exceed 1000 characters"),
  parentId: z.string().uuid().optional().nullable(),
});

// Backward compatibility aliases
export const createTaskSchema = CreateTaskSchema;
export const updateTaskSchema = UpdateTaskSchema;
export const completeTaskSchema = CompleteTaskSchema;
export const verifyTaskSchema = VerifyTaskSchema;
export const taskCommentSchema = TaskCommentSchema;

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type CompleteTaskInput = z.infer<typeof CompleteTaskSchema>;
export type VerifyTaskInput = z.infer<typeof VerifyTaskSchema>;
export type TaskCommentInput = z.infer<typeof TaskCommentSchema>;

