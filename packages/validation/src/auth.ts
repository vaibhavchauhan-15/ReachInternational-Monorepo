import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const SignupSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().trim().min(10, "Mobile number is required (min 10 digits)"),
  role: z.string().optional().default("operator"),
  city: z.string().trim().min(2, "City is required"),
  district: z.string().trim().min(2, "District is required"),
  state: z.string().trim().min(2, "State is required"),
});

export const CreateUserSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().trim().min(10, "Mobile number is required (min 10 digits)"),
  role: z.string().min(1, "Role is required"),
  city: z.string().trim().min(2, "City is required"),
  district: z.string().trim().min(2, "District is required"),
  state: z.string().trim().min(2, "State is required"),
});

export const UpdateUserSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required"),
  phone: z.string().trim().min(10, "Mobile number must be at least 10 digits").optional().nullable(),
  role: z.string().optional(),
  city: z.string().trim().min(2, "City is required"),
  district: z.string().trim().min(2, "District is required"),
  state: z.string().trim().min(2, "State is required"),
});

export const ResetPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const UserAccountRequestSchema = z.object({
  employee_id: z.string().min(1, "Employee is required"),
  request_type: z.enum(["create_account", "deactivate_account", "role_change"]),
  requested_role: z.string().min(1, "Requested role is required"),
  admin_notes: z.string().optional().nullable(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type UserAccountRequestInput = z.infer<typeof UserAccountRequestSchema>;
