import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email address cannot exceed 255 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").max(128, "Password cannot exceed 128 characters"),
});

export const SignupSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(100, "Full name cannot exceed 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email address cannot exceed 255 characters"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password cannot exceed 128 characters"),
  phone: z.string().trim().min(10, "Mobile number is required (min 10 digits)").max(15, "Mobile number cannot exceed 15 digits"),
  role: z.string().trim().min(1, "Role is required").max(50, "Role string cannot exceed 50 characters"),
  city: z.string().trim().min(2, "City is required").max(100, "City name cannot exceed 100 characters"),
  district: z.string().trim().min(2, "District is required").max(100, "District name cannot exceed 100 characters"),
  state: z.string().trim().min(2, "State is required").max(100, "State name cannot exceed 100 characters"),
});

export const CreateUserSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(100, "Full name cannot exceed 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email address cannot exceed 255 characters"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password cannot exceed 128 characters"),
  phone: z.string().trim().min(10, "Mobile number is required (min 10 digits)").max(15, "Mobile number cannot exceed 15 digits"),
  role: z.string().trim().min(1, "Role is required").max(50, "Role string cannot exceed 50 characters"),
  city: z.string().trim().min(2, "City is required").max(100, "City name cannot exceed 100 characters"),
  district: z.string().trim().min(2, "District is required").max(100, "District name cannot exceed 100 characters"),
  state: z.string().trim().min(2, "State is required").max(100, "State name cannot exceed 100 characters"),
});

export const UpdateUserSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(100, "Full name cannot exceed 100 characters"),
  phone: z.string().trim().min(10, "Mobile number is required (min 10 digits)").max(15, "Mobile number cannot exceed 15 digits"),
  role: z.string().trim().min(1, "Role is required").max(50, "Role string cannot exceed 50 characters"),
  city: z.string().trim().min(2, "City is required").max(100, "City name cannot exceed 100 characters"),
  district: z.string().trim().min(2, "District is required").max(100, "District name cannot exceed 100 characters"),
  state: z.string().trim().min(2, "State is required").max(100, "State name cannot exceed 100 characters"),
});

export const ResetPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email address cannot exceed 255 characters"),
});

export const UserAccountRequestSchema = z.object({
  employee_id: z.string().min(1, "Employee is required").max(100, "Employee ID cannot exceed 100 characters"),
  request_type: z.enum(["create_account", "deactivate_account", "role_change"]),
  requested_role: z.string().min(1, "Requested role is required").max(50, "Requested role cannot exceed 50 characters"),
  admin_notes: z.string().max(500, "Admin notes cannot exceed 500 characters").optional().nullable(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type UserAccountRequestInput = z.infer<typeof UserAccountRequestSchema>;
