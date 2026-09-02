import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email address cannot exceed 255 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").max(128, "Password cannot exceed 128 characters"),
});

// ---------------------------------------------------------------------------
// Verhoeff Algorithm Tables (Aadhaar Mathematical Checksum)
// ---------------------------------------------------------------------------
const VERHOEFF_D: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

function validateVerhoeff(numStr: string): boolean {
  if (!/^\d+$/.test(numStr)) return false;
  let c = 0;
  const digits = numStr.split("").map(Number).reverse();
  for (let i = 0; i < digits.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digits[i]]];
  }
  return c === 0;
}

const INDIAN_STATE_CODES = new Set([
  "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DH", "DL",
  "DN", "GA", "GJ", "HP", "HR", "JH", "JK", "KA", "KL", "LA",
  "LD", "MH", "ML", "MN", "MP", "MZ", "NL", "OD", "OR", "PB",
  "PY", "RJ", "SK", "TN", "TR", "TS", "UA", "UK", "UP", "WB",
]);

export const AadhaarFieldSchema = z
  .string()
  .trim()
  .max(20, "Aadhaar number cannot exceed 20 characters")
  .optional()
  .nullable()
  .superRefine((val, ctx) => {
    if (!val || !val.trim()) return;
    const clean = val.trim().replace(/[\s\-]/g, "");
    if (!/^\d+$/.test(clean)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Aadhaar number must contain digits only.",
      });
      return;
    }
    if (clean.length !== 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Aadhaar number must be exactly 12 digits (entered ${clean.length} digits).`,
      });
      return;
    }
    if (clean.startsWith("0") || clean.startsWith("1")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Aadhaar number cannot start with 0 or 1.",
      });
      return;
    }
    if (/^(\d)\1{11}$/.test(clean)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid Aadhaar number (cannot be a repeated single digit).",
      });
      return;
    }
    if (!validateVerhoeff(clean)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid Aadhaar number (checksum validation failed).",
      });
      return;
    }
  });

export const AadhaarRequiredFieldSchema = z
  .string()
  .trim()
  .min(1, "Aadhaar card number is required")
  .max(20, "Aadhaar number cannot exceed 20 characters")
  .superRefine((val, ctx) => {
    const clean = val.trim().replace(/[\s\-]/g, "");
    if (!clean) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Aadhaar card number is required.",
      });
      return;
    }
    if (!/^\d+$/.test(clean)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Aadhaar number must contain digits only.",
      });
      return;
    }
    if (clean.length !== 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Aadhaar number must be exactly 12 digits (entered ${clean.length} digits).`,
      });
      return;
    }
    if (clean.startsWith("0") || clean.startsWith("1")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Aadhaar number cannot start with 0 or 1.",
      });
      return;
    }
    if (/^(\d)\1{11}$/.test(clean)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid Aadhaar number (cannot be a repeated single digit).",
      });
      return;
    }
    if (!validateVerhoeff(clean)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid Aadhaar number (checksum validation failed).",
      });
      return;
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
    const raw = val.trim().toUpperCase();
    const clean = raw.replace(/[\s\-\/\.]/g, "");
    if (clean.length < 9 || clean.length > 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Driving licence number must be between 9 and 20 characters (e.g. MH12 20110012345).",
      });
      return;
    }
    const stateCode = clean.slice(0, 2);
    if (!INDIAN_STATE_CODES.has(stateCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid state code "${stateCode}". Must start with a valid 2-letter state code (e.g. MH, DL, KA, UP, HR).`,
      });
      return;
    }
    if (!/^[A-Z0-9]+$/.test(clean)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Driving licence number must contain letters and digits only.",
      });
      return;
    }
    const rtoCode = clean.slice(2, 4);
    if (!/^\d{2}$/.test(rtoCode) && !/^\d[A-Z0-9]$/.test(rtoCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid driving licence format. RTO code following state prefix must be numeric (e.g. MH12...).",
      });
      return;
    }
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
  state_id: z.number().int().positive().optional().nullable(),
  aadhaar_number: AadhaarRequiredFieldSchema,
  license_number: LicenseFieldSchema,
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
  state_id: z.number().int().positive().optional().nullable(),
  aadhaar_number: AadhaarFieldSchema,
  license_number: LicenseFieldSchema,
});

export const UpdateUserSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(100, "Full name cannot exceed 100 characters"),
  phone: z.string().trim().min(10, "Mobile number is required (min 10 digits)").max(15, "Mobile number cannot exceed 15 digits"),
  role: z.string().trim().min(1, "Role is required").max(50, "Role string cannot exceed 50 characters"),
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

export type LoginInput = z.infer<typeof LoginSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type UserAccountRequestInput = z.infer<typeof UserAccountRequestSchema>;

