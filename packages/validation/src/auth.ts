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
  full_name: z.string().trim().min(2, "Full name required (min 2 chars)").max(100, "Full name cannot exceed 100 characters"),
  email: z.string().trim().email("Valid email required").max(255, "Email address cannot exceed 255 characters"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password cannot exceed 128 characters"),
  phone: z.string().trim().min(10, "10-digit mobile number required").max(15, "Mobile number cannot exceed 15 digits"),
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
  machine_category: z.string().trim().optional().nullable(),
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
      message: "Supervisor required",
    });
  }
  if (data.role === "operator" && (!data.machine_category || !data.machine_category.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["machine_category"],
      message: "Machine category is required",
    });
  }
  if (data.role === "operator" && (!data.license_number || !data.license_number.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["license_number"],
      message: "Driving licence is required for operators",
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
          ? "End time must be after start time"
          : timing.errorMessage || "End time must be after start time",
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
  machineCategory?: string | null;
  shiftStartTime: string;
  shiftEndTime: string;
  street: string;
  city: string;
  district: string;
  state: string;
  stateId?: number | string | null;
  bankAccountNumber: string;
  bankIfscCode: string;
  hasBankDoc: boolean;
  aadhaarNumber: string;
  hasAadhaarDoc: boolean;
  licenseNumber?: string | null;
  hasLicenseDoc?: boolean;
  password: string;
  confirmPassword: string;
  agreedToTerms: boolean;
}

export function validateSignupFormData(fields: SignupValidationFields): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const cleanName = (fields.fullName || "").trim();
  if (!cleanName || cleanName.length < 2) {
    errors.full_name = "Full name required (min 2 chars)";
  } else if (cleanName.length > 100) {
    errors.full_name = "Full name cannot exceed 100 characters";
  }

  const cleanEmail = (fields.email || "").trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    errors.email = "Valid email required";
  } else if (cleanEmail.length > 255) {
    errors.email = "Email cannot exceed 255 characters";
  }

  const digitsOnly = (fields.phone || "").replace(/\D/g, "");
  const is10DigitMobile =
    digitsOnly.length === 10 ||
    (digitsOnly.length === 12 && digitsOnly.startsWith("91")) ||
    (digitsOnly.length === 11 && digitsOnly.startsWith("0"));
  if (!is10DigitMobile) {
    errors.phone = "10-digit mobile number required";
  }

  const validRoles = ["operator", "supervisor", "manager", "hr"];
  if (!fields.role || !validRoles.includes(fields.role)) {
    errors.role = "Valid role selection required";
  }

  if (fields.role === "operator" && (!fields.supervisorId || !fields.supervisorId.trim())) {
    errors.supervisor_id = "Supervisor required";
  }

  if (fields.role === "operator" && (!fields.machineCategory || !fields.machineCategory.trim())) {
    errors.machine_category = "Machine category is required";
  }

  if (!fields.shiftStartTime?.trim()) {
    errors.shift_start_time = "Start time required";
  }
  if (!fields.shiftEndTime?.trim()) {
    errors.shift_end_time = "End time required";
  }

  if (fields.shiftStartTime?.trim() && fields.shiftEndTime?.trim()) {
    const shiftTiming = computeShiftTiming({
      startTime: fields.shiftStartTime,
      endTime: fields.shiftEndTime,
    });
    if (!shiftTiming.isValid) {
      const msg = shiftTiming.errorMessage === "Start time and end time cannot be identical."
        ? "End time must be after start time"
        : shiftTiming.errorMessage || "End time must be after start time";
      errors.shift_end_time = msg;
      errors.shift_time = msg;
    }
  }

  const cleanStreet = (fields.street || "").trim();
  if (!cleanStreet || cleanStreet.length < 2) {
    errors.street = "Street address required";
  } else if (cleanStreet.length > 255) {
    errors.street = "Street address cannot exceed 255 characters";
  }

  const cleanCity = (fields.city || "").trim();
  if (!cleanCity || cleanCity.length < 2) {
    errors.city = "City required";
  } else if (cleanCity.length > 100) {
    errors.city = "City cannot exceed 100 characters";
  }

  const cleanDistrict = (fields.district || "").trim();
  if (!cleanDistrict || cleanDistrict.length < 2) {
    errors.district = "District required";
  } else if (cleanDistrict.length > 100) {
    errors.district = "District cannot exceed 100 characters";
  }

  const cleanState = (fields.state || "").trim();
  if (!cleanState && !fields.stateId) {
    errors.state = "State required";
  }

  const cleanBankAcc = (fields.bankAccountNumber || "").replace(/\D/g, "");
  if (!cleanBankAcc || cleanBankAcc.length < 9 || cleanBankAcc.length > 18) {
    errors.bank_account_number = "Account number required (9-18 digits)";
  } else {
    const bankRes = validateBankAccountNumber(cleanBankAcc);
    if (!bankRes.isValid) {
      errors.bank_account_number = bankRes.error || "Account number required (9-18 digits)";
    }
  }

  const cleanIfsc = (fields.bankIfscCode || "").trim().toUpperCase();
  if (!cleanIfsc || cleanIfsc.length !== 11) {
    errors.bank_ifsc_code = "11-character IFSC required";
  } else {
    const ifscRes = validateIfscCode(cleanIfsc);
    if (!ifscRes.isValid) {
      errors.bank_ifsc_code = ifscRes.error || "11-character IFSC required";
    }
  }

  if (!fields.hasBankDoc) {
    errors.bank_doc = "Bank document required";
  }

  const cleanAadhaar = (fields.aadhaarNumber || "").replace(/\D/g, "");
  if (cleanAadhaar.length !== 12) {
    errors.aadhaar_number = "12-digit Aadhaar required";
  } else {
    const aadhaarRes = validateAadhaarNumber(cleanAadhaar);
    if (!aadhaarRes.isValid) {
      errors.aadhaar_number = aadhaarRes.error || "12-digit Aadhaar required";
    }
  }

  if (!fields.hasAadhaarDoc) {
    errors.aadhaar_doc = "Aadhaar document required";
  }

  const isOperator = fields.role ? fields.role.trim().toLowerCase() === "operator" : false;
  if (isOperator) {
    if (!fields.licenseNumber || !fields.licenseNumber.trim()) {
      errors.license_number = "Driving licence is required for operators";
    } else {
      const licRes = validateLicenseNumber(fields.licenseNumber.trim());
      if (!licRes.isValid) {
        errors.license_number = licRes.error || "Invalid licence format";
      }
    }

    if (!fields.hasLicenseDoc) {
      errors.license_doc = "Licence document required for operators";
    }
  } else if (fields.licenseNumber && fields.licenseNumber.trim()) {
    const licRes = validateLicenseNumber(fields.licenseNumber.trim());
    if (!licRes.isValid) {
      errors.license_number = licRes.error || "Invalid licence format";
    }
  }

  if (!fields.password || fields.password.length < 8) {
    errors.password = "Min 8 characters required";
  } else if (fields.password.length > 128) {
    errors.password = "Password cannot exceed 128 characters";
  } else {
    const hasUpper = /[A-Z]/.test(fields.password);
    const hasLower = /[a-z]/.test(fields.password);
    const hasNum = /\d/.test(fields.password);
    if (!hasUpper || !hasLower || !hasNum) {
      errors.password = "Must include upper, lower & number";
    }
  }

  if (!fields.confirmPassword) {
    errors.confirm_password = "Confirm password is required";
  } else if (fields.password !== fields.confirmPassword) {
    errors.confirm_password = "Passwords do not match";
  }

  if (!fields.agreedToTerms) {
    errors.terms = "Please agree to terms to continue";
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
  machine_category: z.string().trim().optional().nullable(),
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
  if (data.role === "operator" && (!data.machine_category || !data.machine_category.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["machine_category"],
      message: "Machine category is required for operator accounts",
    });
  }
  if (data.role === "operator" && (!data.license_number || !data.license_number.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["license_number"],
      message: "Driving licence number is required for operator accounts",
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
  machine_category: z.string().trim().optional().nullable(),
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
  if (data.role === "operator" && (!data.machine_category || !data.machine_category.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["machine_category"],
      message: "Machine category is required for operator accounts",
    });
  }
  if (data.role === "operator" && (!data.license_number || !data.license_number.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["license_number"],
      message: "Driving licence number is required for operator accounts",
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
  machine_category: z.string().trim().optional().nullable(),
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
  if (data.role === "operator" && (!data.license_number || !data.license_number.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["license_number"],
      message: "Driving licence number is required for operators",
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

export interface SignupSectionFields {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  supervisor_id?: string | null;
  machine_category?: string | null;
  shift_start_time?: string | null;
  shift_end_time?: string | null;
  street?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  state_id?: number | string | null;
  bank_account_number?: string | null;
  bank_ifsc_code?: string | null;
  has_bank_doc?: boolean | null;
  aadhaar_number?: string | null;
  has_aadhaar_doc?: boolean | null;
  license_number?: string | null;
  has_license_doc?: boolean | null;
  password?: string | null;
  confirm_password?: string | null;
  agreed_to_terms?: boolean | null;
}

export function isSignupSection1Complete(fields: SignupSectionFields): boolean {
  const nameOk = Boolean(fields.full_name && fields.full_name.trim().length >= 2);
  const emailOk = Boolean(fields.email && fields.email.trim().includes("@"));
  const phoneOk = Boolean(fields.phone && fields.phone.replace(/\D/g, "").length >= 10);
  const roleOk = Boolean(fields.role && fields.role.trim().length > 0);
  const isOperator = fields.role ? fields.role.trim().toLowerCase() === "operator" : false;
  const supOk = !isOperator || Boolean(fields.supervisor_id && fields.supervisor_id.trim().length > 0);
  const catOk = !isOperator || Boolean(fields.machine_category && fields.machine_category.trim().length > 0);
  return nameOk && emailOk && phoneOk && roleOk && supOk && catOk;
}

export function isSignupSection2Complete(fields: SignupSectionFields): boolean {
  return Boolean(
    fields.shift_start_time &&
    fields.shift_start_time.trim().length > 0 &&
    fields.shift_end_time &&
    fields.shift_end_time.trim().length > 0
  );
}

export function isSignupSection3Complete(fields: SignupSectionFields): boolean {
  const hasStreet = Boolean((fields.street || fields.address) && (fields.street || fields.address)!.trim().length >= 2);
  const hasCity = Boolean(fields.city && fields.city.trim().length >= 2);
  const hasDistrict = Boolean(fields.district && fields.district.trim().length >= 2);
  const hasState = Boolean((fields.state && fields.state.trim().length >= 2) || fields.state_id);
  return hasStreet && hasCity && hasDistrict && hasState;
}

export function isSignupSection4Complete(fields: SignupSectionFields): boolean {
  const hasBankAcc = Boolean(fields.bank_account_number && validateBankAccountNumber(fields.bank_account_number).isValid);
  const hasIfsc = Boolean(fields.bank_ifsc_code && validateIfscCode(fields.bank_ifsc_code).isValid);
  const hasDoc = Boolean(fields.has_bank_doc);
  return hasBankAcc && hasIfsc && hasDoc;
}

export function isSignupSection5Complete(fields: SignupSectionFields): boolean {
  const hasAadhaar = Boolean(fields.aadhaar_number && fields.aadhaar_number.replace(/\D/g, "").length === 12);
  const hasAadhaarDoc = Boolean(fields.has_aadhaar_doc);
  if (!hasAadhaar || !hasAadhaarDoc) return false;

  const isOperator = fields.role ? fields.role.trim().toLowerCase() === "operator" : false;
  if (isOperator) {
    const hasLicenseNumber = Boolean(
      fields.license_number &&
      fields.license_number.trim().length > 0 &&
      validateLicenseNumber(fields.license_number.trim()).isValid
    );
    const hasLicenseDoc = Boolean(fields.has_license_doc);
    return hasLicenseNumber && hasLicenseDoc;
  }

  return true;
}

export function isSignupSection6Complete(fields: SignupSectionFields): boolean {
  return Boolean(
    fields.password &&
    fields.confirm_password &&
    fields.password.length >= 8 &&
    fields.confirm_password.length >= 8 &&
    fields.password === fields.confirm_password &&
    fields.agreed_to_terms
  );
}

