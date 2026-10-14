import { z } from "zod";
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  validateBankAccountNumber,
  validateIfscCode,
  computeShiftTiming,
  INDIAN_STATE_CODES,
} from "@reachinternational/utils";

export const LoginSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email address cannot exceed 255 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").max(128, "Password cannot exceed 128 characters"),
});

export const BankAccountNumberSchema = z
  .string()
  .trim()
  .min(1, "Bank account number is required")
  .superRefine((val, ctx) => {
    const res = validateBankAccountNumber(val);
    if (!res.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.error || "Invalid bank account number",
      });
    }
  });

export const BankIfscSchema = z
  .string()
  .trim()
  .min(1, "IFSC code is required")
  .superRefine((val, ctx) => {
    const res = validateIfscCode(val);
    if (!res.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.error || "Invalid IFSC code",
      });
    }
  });

export const OptionalBankAccountFieldSchema = z
  .string()
  .trim()
  .max(30, "Bank account number cannot exceed 30 characters")
  .optional()
  .nullable()
  .superRefine((val, ctx) => {
    if (!val || !val.trim()) return;
    const res = validateBankAccountNumber(val);
    if (!res.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.error || "Invalid bank account number",
      });
    }
  });

export const OptionalBankIfscFieldSchema = z
  .string()
  .trim()
  .max(20, "IFSC code cannot exceed 20 characters")
  .optional()
  .nullable()
  .superRefine((val, ctx) => {
    if (!val || !val.trim()) return;
    const res = validateIfscCode(val);
    if (!res.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.error || "Invalid IFSC code",
      });
    }
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
  full_name: z.string().trim().min(2, "Enter your full name.").max(100, "Full name cannot exceed 100 characters"),
  email: z.string().trim().email("Enter a valid email address.").max(255, "Email address cannot exceed 255 characters"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password cannot exceed 128 characters"),
  phone: z.string().trim().min(10, "Enter a valid mobile number.").max(15, "Mobile number cannot exceed 15 digits"),
  role: z.string().trim().min(1, "Select a role.").max(50, "Role string cannot exceed 50 characters"),
  street: z.string().trim().max(255, "Street address cannot exceed 255 characters").optional().nullable(),
  address: z.string().trim().max(255, "Address cannot exceed 255 characters").optional().nullable(),
  city: z.string().trim().min(2, "City is required").max(100, "City name cannot exceed 100 characters"),
  district: z.string().trim().min(2, "District is required").max(100, "District name cannot exceed 100 characters"),
  state: z.string().trim().min(2, "State is required").max(100, "State name cannot exceed 100 characters"),
  state_id: z.number().int().positive().optional().nullable(),
  shift_time: z.string().trim().max(100, "Shift timing cannot exceed 100 characters").optional().nullable(),
  shift_start_time: z.string().trim().min(1, "Shift start time is required").max(50),
  shift_end_time: z.string().trim().min(1, "Shift end time is required").max(50),
  supervisor_id: z.string().trim().max(100).optional().nullable(),
  working_location_id: z.string().trim().max(100).optional().nullable(),
  monthly_salary: z.number().min(0, "Monthly salary must be positive").optional().nullable(),
  bank_account_number: BankAccountNumberSchema,
  bank_ifsc_code: BankIfscSchema,
  aadhaar_number: AadhaarRequiredFieldSchema,
  license_number: LicenseFieldSchema,
}).superRefine((data, ctx) => {
  if (!data.street?.trim() && !data.address?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["street"],
      message: "Street / site base address is required",
    });
  }
  if (data.role === "operator" && (!data.supervisor_id || !data.supervisor_id.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["supervisor_id"],
      message: "Select a supervisor.",
    });
  }
  if (data.shift_start_time && data.shift_end_time) {
    const timing = computeShiftTiming({
      startTime: data.shift_start_time,
      endTime: data.shift_end_time,
    });
    if (!timing.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shift_end_time"],
        message: timing.errorMessage === "Start time and end time cannot be identical."
          ? "End time must be after start time."
          : timing.errorMessage || "End time must be after start time.",
      });
    }
  }
});

export interface SignupValidationFields {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  supervisorId?: string | null;
  shiftStartTime: string;
  shiftEndTime: string;
  street: string;
  city: string;
  district: string;
  state: string;
  bankAccountNumber: string;
  bankIfscCode: string;
  hasBankDoc: boolean;
  aadhaarNumber: string;
  hasAadhaarDoc: boolean;
  licenseNumber?: string | null;
  password: string;
  confirmPassword: string;
  agreedToTerms: boolean;
}

export function validateSignupFormData(fields: SignupValidationFields): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const cleanName = fields.fullName.trim();
  if (!cleanName || cleanName.length < 2) {
    errors.full_name = "Enter your full name.";
  }

  const cleanEmail = fields.email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    errors.email = "Enter a valid email address.";
  }

  const cleanPhone = fields.phone.replace(/\D/g, "");
  if (cleanPhone.length < 10) {
    errors.phone = "Enter a valid mobile number.";
  }

  if (fields.role === "operator" && (!fields.supervisorId || !fields.supervisorId.trim())) {
    errors.supervisor_id = "Select a supervisor.";
  }

  if (!fields.shiftStartTime?.trim()) {
    errors.shift_start_time = "Select shift start time.";
  }
  if (!fields.shiftEndTime?.trim()) {
    errors.shift_end_time = "Select shift end time.";
  }

  if (fields.shiftStartTime?.trim() && fields.shiftEndTime?.trim()) {
    const shiftTiming = computeShiftTiming({
      startTime: fields.shiftStartTime,
      endTime: fields.shiftEndTime,
    });
    if (!shiftTiming.isValid) {
      const msg = shiftTiming.errorMessage === "Start time and end time cannot be identical."
        ? "End time must be after start time."
        : shiftTiming.errorMessage || "End time must be after start time.";
      errors.shift_end_time = msg;
      errors.shift_time = msg;
    }
  }

  if (!fields.street?.trim() || fields.street.trim().length < 2) {
    errors.street = "Street address is required.";
  }
  if (!fields.city?.trim() || fields.city.trim().length < 2) {
    errors.city = "City is required.";
  }
  if (!fields.district?.trim() || fields.district.trim().length < 2) {
    errors.district = "District is required.";
  }
  if (!fields.state?.trim()) {
    errors.state = "State is required.";
  }

  const cleanBankAcc = fields.bankAccountNumber.replace(/\D/g, "");
  if (!cleanBankAcc || cleanBankAcc.length < 9 || cleanBankAcc.length > 18) {
    errors.bank_account_number = "Enter a valid bank account number (9 to 18 digits).";
  } else {
    const bankRes = validateBankAccountNumber(cleanBankAcc);
    if (!bankRes.isValid) {
      errors.bank_account_number = bankRes.error || "Enter a valid bank account number (9 to 18 digits).";
    }
  }

  const cleanIfsc = fields.bankIfscCode.trim().toUpperCase();
  if (!cleanIfsc || cleanIfsc.length !== 11) {
    errors.bank_ifsc_code = "Enter a valid 11-character IFSC code (e.g. SBIN0001234).";
  } else {
    const ifscRes = validateIfscCode(cleanIfsc);
    if (!ifscRes.isValid) {
      errors.bank_ifsc_code = ifscRes.error || "Enter a valid 11-character IFSC code (e.g. SBIN0001234).";
    }
  }

  if (!fields.hasBankDoc) {
    errors.bank_doc = "Upload your bank account document.";
  }

  const cleanAadhaar = fields.aadhaarNumber.replace(/\D/g, "");
  if (cleanAadhaar.length !== 12) {
    errors.aadhaar_number = "Enter a valid 12-digit Aadhaar number.";
  } else {
    const aadhaarRes = validateAadhaarNumber(cleanAadhaar);
    if (!aadhaarRes.isValid) {
      errors.aadhaar_number = aadhaarRes.error || "Enter a valid 12-digit Aadhaar number.";
    }
  }

  if (!fields.hasAadhaarDoc) {
    errors.aadhaar_doc = "Upload your Aadhaar document.";
  }

  if (fields.licenseNumber && fields.licenseNumber.trim()) {
    const licRes = validateLicenseNumber(fields.licenseNumber.trim());
    if (!licRes.isValid) {
      errors.license_number = licRes.error || "Invalid driving licence format.";
    }
  }

  if (!fields.password || fields.password.length < 8) {
    errors.password = "Password must be at least 8 characters long.";
  } else {
    const hasUpper = /[A-Z]/.test(fields.password);
    const hasLower = /[a-z]/.test(fields.password);
    const hasNum = /\d/.test(fields.password);
    if (!hasUpper || !hasLower || !hasNum) {
      errors.password = "Password must include uppercase, lowercase, and a number.";
    }
  }

  if (fields.password !== fields.confirmPassword) {
    errors.confirm_password = "Passwords do not match.";
  }

  if (!fields.agreedToTerms) {
    errors.terms = "You must agree to the Terms of Service and Privacy Policy.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export const CreateUserSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(100, "Full name cannot exceed 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email address cannot exceed 255 characters"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password cannot exceed 128 characters"),
  phone: z.string().trim().min(10, "Mobile number is required (min 10 digits)").max(15, "Mobile number cannot exceed 15 digits"),
  role: z.string().trim().min(1, "Role is required").max(50, "Role string cannot exceed 50 characters"),
  supervisor_id: z.string().trim().max(100).optional().nullable(),
  working_location_id: z.string().trim().max(100).optional().nullable(),
  street: z.string().trim().max(255, "Street cannot exceed 255 characters").optional().nullable(),
  address: z.string().trim().max(255, "Address cannot exceed 255 characters").optional().nullable(),
  city: z.string().trim().min(2, "City is required").max(100, "City name cannot exceed 100 characters"),
  district: z.string().trim().min(2, "District is required").max(100, "District name cannot exceed 100 characters"),
  state: z.string().trim().min(2, "State is required").max(100, "State name cannot exceed 100 characters"),
  state_id: z.number().int().positive().optional().nullable(),
  daily_rate: z.number().min(0).optional().nullable(),
  ot_hourly_rate: z.number().min(0).optional().nullable(),
  monthly_salary: z.number().min(0, "Monthly salary must be positive").optional().nullable(),
  aadhaar_number: AadhaarFieldSchema,
  license_number: LicenseFieldSchema,
}).superRefine((data, ctx) => {
  if (data.role === "operator" && (data.monthly_salary === undefined || data.monthly_salary === null || data.monthly_salary <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["monthly_salary"],
      message: "Monthly salary is mandatory for operator accounts (minimum ₹1)",
    });
  }
});

export const UpdateUserSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(100, "Full name cannot exceed 100 characters"),
  phone: z.string().trim().min(10, "Mobile number is required (min 10 digits)").max(15, "Mobile number cannot exceed 15 digits"),
  role: z.string().trim().min(1, "Role is required").max(50, "Role string cannot exceed 50 characters"),
  supervisor_id: z.string().trim().max(100).optional().nullable(),
  working_location_id: z.string().trim().max(100).optional().nullable(),
  street: z.string().trim().max(255, "Street cannot exceed 255 characters").optional().nullable(),
  address: z.string().trim().max(255, "Address cannot exceed 255 characters").optional().nullable(),
  city: z.string().trim().min(2, "City is required").max(100, "City name cannot exceed 100 characters"),
  district: z.string().trim().min(2, "District is required").max(100, "District name cannot exceed 100 characters"),
  state: z.string().trim().min(2, "State is required").max(100, "State name cannot exceed 100 characters"),
  state_id: z.number().int().positive().optional().nullable(),
  daily_rate: z.number().min(0).optional().nullable(),
  ot_hourly_rate: z.number().min(0).optional().nullable(),
  monthly_salary: z.number().min(0, "Monthly salary must be positive").optional().nullable(),
  aadhaar_number: AadhaarFieldSchema,
  license_number: LicenseFieldSchema,
}).superRefine((data, ctx) => {
  if (data.role === "operator" && (data.monthly_salary === undefined || data.monthly_salary === null || data.monthly_salary <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["monthly_salary"],
      message: "Monthly salary is mandatory for operator accounts (minimum ₹1)",
    });
  }
});

export const ProfileUpdateSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(100, "Full name cannot exceed 100 characters"),
  phone: z.string().trim().min(10, "Mobile number is required (min 10 digits)").max(15, "Mobile number cannot exceed 15 digits"),
  email: z.string().trim().email("Invalid email address").max(255, "Email address cannot exceed 255 characters").optional().nullable(),
  shift_time: z.string().trim().max(100, "Shift timing cannot exceed 100 characters").optional().nullable(),
  shift_start_time: z.string().trim().max(50).optional().nullable(),
  shift_end_time: z.string().trim().max(50).optional().nullable(),
  supervisor_id: z.string().trim().max(100).optional().nullable(),
  working_location_id: z.string().trim().max(100).optional().nullable(),
  street: z.string().trim().max(255, "Street cannot exceed 255 characters").optional().nullable(),
  address: z.string().trim().max(255, "Address cannot exceed 255 characters").optional().nullable(),
  city: z.string().trim().min(2, "City is required").max(100, "City name cannot exceed 100 characters"),
  district: z.string().trim().min(2, "District is required").max(100, "District name cannot exceed 100 characters"),
  state: z.string().trim().min(2, "State is required").max(100, "State name cannot exceed 100 characters"),
  state_id: z.number().int().positive().optional().nullable(),
  monthly_salary: z.number().min(0, "Monthly salary must be positive").optional().nullable(),
  aadhaar_number: AadhaarFieldSchema,
  license_number: LicenseFieldSchema,
  bank_account_number: OptionalBankAccountFieldSchema,
  bank_ifsc_code: OptionalBankIfscFieldSchema,
  documents: z.record(z.string(), z.any()).optional().nullable(),
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
  role: z.string().trim().max(50).optional().nullable(),
  supervisor_id: z.string().trim().max(100).optional().nullable(),
  working_location_id: z.string().trim().max(100).optional().nullable(),
  shift_time: z.string().trim().max(100, "Shift timing cannot exceed 100 characters").optional().nullable(),
  shift_start_time: z.string().trim().min(1, "Shift start time is required").max(50),
  shift_end_time: z.string().trim().min(1, "Shift end time is required").max(50),
  street: z.string().trim().max(255, "Street cannot exceed 255 characters").optional().nullable(),
  address: z.string().trim().max(255, "Address cannot exceed 255 characters").optional().nullable(),
  city: z.string().trim().min(2, "City is required").max(100, "City name cannot exceed 100 characters"),
  district: z.string().trim().min(2, "District is required").max(100, "District name cannot exceed 100 characters"),
  state: z.string().trim().min(2, "State is required").max(100, "State name cannot exceed 100 characters"),
  state_id: z.number().int().positive().optional().nullable(),
  monthly_salary: z.number().min(0, "Monthly salary must be positive").optional().nullable(),
  aadhaar_number: AadhaarRequiredFieldSchema,
  license_number: LicenseFieldSchema,
}).superRefine((data, ctx) => {
  if (!data.street?.trim() && !data.address?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["street"],
      message: "Street / locality address is required",
    });
  }
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type UserAccountRequestInput = z.infer<typeof UserAccountRequestSchema>;
export type OnboardingProfileInput = z.infer<typeof OnboardingProfileSchema>;

