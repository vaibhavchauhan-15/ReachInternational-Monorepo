import { z } from "zod";
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  INDIAN_STATE_CODES,
} from "@reachinternational/utils";

export const LoginSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email address cannot exceed 255 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").max(128, "Password cannot exceed 128 characters"),
});

export const AadhaarFieldSchema = z
  .string()
  .trim()
  .max(20, "Aadhaar number cannot exceed 20 characters")
  .optional()
  .nullable()
  .superRefine((val, ctx) => {
    if (!val || !val.trim()) return;
    const res = validateAadhaarNumber(val);
    if (!res.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.error || "Invalid Aadhaar number",
      });
    }
  });

export const AadhaarRequiredFieldSchema = z
  .string()
  .trim()
  .min(1, "Aadhaar card number is required")
  .max(20, "Aadhaar number cannot exceed 20 characters")
  .superRefine((val, ctx) => {
    const res = validateAadhaarNumber(val);
    if (!res.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.error || "Invalid Aadhaar number",
      });
    }
  });

export const LicenseFieldSchema = z
  .string()
  .trim()
  .max(50, "Licence number cannot exceed 50 characters")
  .optional()
  .nullable()
  .superRefine((val, ctx) => {
    if (!val || !val.trim()) return;
    const res = validateLicenseNumber(val);
    if (!res.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.error || "Invalid driving licence format",
      });
    }
  });

export const SignupSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(100, "Full name cannot exceed 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email address cannot exceed 255 characters"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password cannot exceed 128 characters"),
  phone: z.string().trim().min(10, "Mobile number is required (min 10 digits)").max(15, "Mobile number cannot exceed 15 digits"),
  role: z.string().trim().min(1, "Role is required").max(50, "Role string cannot exceed 50 characters"),
  address: z.string().trim().min(3, "Street / site base address is required").max(255, "Address cannot exceed 255 characters"),
  city: z.string().trim().min(2, "City is required").max(100, "City name cannot exceed 100 characters"),
  district: z.string().trim().min(2, "District is required").max(100, "District name cannot exceed 100 characters"),
  state: z.string().trim().min(2, "State is required").max(100, "State name cannot exceed 100 characters"),
  state_id: z.number().int().positive().optional().nullable(),
  shift_time: z.string().trim().max(100, "Shift timing cannot exceed 100 characters").optional().nullable(),
  shift_start_time: z.string().trim().min(1, "Shift start time is required").max(50),
  shift_end_time: z.string().trim().min(1, "Shift end time is required").max(50),
  aadhaar_number: AadhaarRequiredFieldSchema,
  license_number: LicenseFieldSchema,
});

export const CreateUserSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(100, "Full name cannot exceed 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email address cannot exceed 255 characters"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password cannot exceed 128 characters"),
  phone: z.string().trim().min(10, "Mobile number is required (min 10 digits)").max(15, "Mobile number cannot exceed 15 digits"),
  role: z.string().trim().min(1, "Role is required").max(50, "Role string cannot exceed 50 characters"),
  address: z.string().trim().max(255, "Address cannot exceed 255 characters").optional().nullable(),
  city: z.string().trim().min(2, "City is required").max(100, "City name cannot exceed 100 characters"),
  district: z.string().trim().min(2, "District is required").max(100, "District name cannot exceed 100 characters"),
  state: z.string().trim().min(2, "State is required").max(100, "State name cannot exceed 100 characters"),
  state_id: z.number().int().positive().optional().nullable(),
  aadhaar_number: AadhaarFieldSchema,
  license_number: LicenseFieldSchema,
});

export const UpdateUserSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(100, "Full name cannot exceed 100 characters"),
  phone: z.string().trim().min(10, "Mobile number is required (min 10 digits)").max(15, "Mobile number cannot exceed 15 digits"),
  role: z.string().trim().min(1, "Role is required").max(50, "Role string cannot exceed 50 characters"),
  address: z.string().trim().max(255, "Address cannot exceed 255 characters").optional().nullable(),
  city: z.string().trim().min(2, "City is required").max(100, "City name cannot exceed 100 characters"),
  district: z.string().trim().min(2, "District is required").max(100, "District name cannot exceed 100 characters"),
  state: z.string().trim().min(2, "State is required").max(100, "State name cannot exceed 100 characters"),
  state_id: z.number().int().positive().optional().nullable(),
  aadhaar_number: AadhaarFieldSchema,
  license_number: LicenseFieldSchema,
});

export const ProfileUpdateSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(100, "Full name cannot exceed 100 characters"),
  phone: z.string().trim().min(10, "Mobile number is required (min 10 digits)").max(15, "Mobile number cannot exceed 15 digits"),
  shift_time: z.string().trim().max(100, "Shift timing cannot exceed 100 characters").optional().nullable(),
  address: z.string().trim().max(255, "Address cannot exceed 255 characters").optional().nullable(),
  city: z.string().trim().min(2, "City is required").max(100, "City name cannot exceed 100 characters"),
  district: z.string().trim().min(2, "District is required").max(100, "District name cannot exceed 100 characters"),
  state: z.string().trim().min(2, "State is required").max(100, "State name cannot exceed 100 characters"),
  state_id: z.number().int().positive().optional().nullable(),
  aadhaar_number: AadhaarFieldSchema,
  license_number: LicenseFieldSchema,
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

export const OnboardingProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required (minimum 2 characters)").max(100, "Full name cannot exceed 100 characters"),
  phone: z.string().trim().min(10, "Valid 10-digit mobile number is required").max(15, "Mobile number cannot exceed 15 digits"),
  role: z.string().trim().min(1, "Role is required").max(50, "Role string cannot exceed 50 characters"),
  shift_time: z.string().trim().max(100, "Shift timing cannot exceed 100 characters").optional().nullable(),
  shift_start_time: z.string().trim().min(1, "Shift start time is required").max(50),
  shift_end_time: z.string().trim().min(1, "Shift end time is required").max(50),
  address: z.string().trim().min(3, "Address is required (street / building / locality)").max(255, "Address cannot exceed 255 characters"),
  city: z.string().trim().min(2, "City is required").max(100, "City name cannot exceed 100 characters"),
  district: z.string().trim().min(2, "District is required").max(100, "District name cannot exceed 100 characters"),
  state: z.string().trim().min(2, "State is required").max(100, "State name cannot exceed 100 characters"),
  state_id: z.number().int().positive().optional().nullable(),
  aadhaar_number: AadhaarRequiredFieldSchema,
  license_number: LicenseFieldSchema,
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type UserAccountRequestInput = z.infer<typeof UserAccountRequestSchema>;
export type OnboardingProfileInput = z.infer<typeof OnboardingProfileSchema>;

