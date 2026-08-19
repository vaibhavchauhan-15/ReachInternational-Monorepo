import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const SignupSchema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional().nullable(),
  role: z.string().optional().default("operator"),
  branch_id: z.string().optional().nullable(),
});

export const ResetPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const UserAccountRequestSchema = z.object({
  employee_id: z.string().min(1, "Employee is required"),
  request_type: z.enum(["create_account", "deactivate_account", "role_change"]),
  requested_role: z.string().min(1, "Requested role is required"),
  target_branch_id: z.string().optional().nullable(),
  admin_notes: z.string().optional().nullable(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type UserAccountRequestInput = z.infer<typeof UserAccountRequestSchema>;
