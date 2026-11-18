"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { getAppUrl, getResetPasswordRedirectUrl } from "@/lib/env/client";
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  validateBankAccountNumber,
  validateIfscCode,
  getStateById,
  getStateByName,
  DOC_UPLOAD,
  normalizeMachineCategory,
} from "@reachinternational/utils";
import { isSupervisedRole, getRoleHomeRoute } from "@reachinternational/permissions";
import { verifyUploadSessionToken } from "@/lib/security/upload-session";
import { finalizeStagedSignupDocuments } from "@/lib/server/finalize-signup-documents";
import { submitToApprovalEngineSafely } from "@/lib/server/approval-engine-bridge";
import { checkRateLimitAsync, getClientIp, RATE_LIMIT_PROFILES } from "@/lib/security/rate-limiter";
import crypto from "node:crypto";


export interface AuthFormState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  fieldValues?: Record<string, string>;
}

export async function login(state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = ((formData.get("email") as string) || "").trim();
  const password = (formData.get("password") as string) || "";

  const fieldErrors: Record<string, string> = {};
  if (!email) fieldErrors.email = "Email is required.";
  if (!password) fieldErrors.password = "Password is required.";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Email and password are required.",
      fieldErrors,
      fieldValues: { email },
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Distinguish between unconfirmed email, server errors, and invalid credentials
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        error: "Account pending administrator approval.",
        fieldErrors: { email: "Pending administrator approval." },
        fieldValues: { email },
      };
    }

    if (error.status && error.status >= 500) {
      return {
        error: "Service unavailable. Try again shortly.",
        fieldValues: { email },
      };
    }

    return {
      error: "Invalid email or password.",
      fieldErrors: { email: "Invalid email or password.", password: "Invalid email or password." },
      fieldValues: { email },
    };
  }

  // Check if user has a profile and is active — select minimal role, status, and onboarding status
  const { data: profile } = await supabase
    .from("users")
    .select("role, status, complete_profile")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    return {
      error: "Profile not found. Contact administrator.",
      fieldErrors: { email: "Profile not found." },
      fieldValues: { email },
    };
  }

  if (profile.status === "inactive") {
    await supabase.auth.signOut();
    return {
      error: "Account deactivated. Contact administrator.",
      fieldErrors: { email: "Account is deactivated." },
      fieldValues: { email },
    };
  }

  if (profile.status === "pending") {
    await supabase.auth.signOut();
    return {
      error: "Account pending administrator approval.",
      fieldErrors: { email: "Pending administrator approval." },
      fieldValues: { email },
    };
  }

  // Fire audit log with pre-resolved user_id without blocking response
  void logAudit({
    action: "auth.login",
    entity_type: "user",
    entity_id: data.user.id,
    user_id: data.user.id,
    metadata: { user_email: email },
  });

  const isComplete = typeof profile.complete_profile === "boolean"
    ? profile.complete_profile
    : profile.complete_profile === "yes";

  if (!isComplete) {
    redirect("/onboarding");
  }

  redirect(getRoleHomeRoute(profile.role));
}


function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    const s = Math.round(seconds);
    return s <= 1 ? "1 second" : `${s} seconds`;
  }
  if (seconds < 3600) {
    const m = Math.round(seconds / 60);
    return m === 1 ? "1 minute" : `${m} minutes`;
  }
  const h = Math.round(seconds / 3600);
  return h === 1 ? "1 hour" : `${h} hours`;
}

export async function logout() {
  const supabase = await createSupabaseServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await logAudit({
        action: "auth.logout",
        entity_type: "user",
        entity_id: user.id,
        user_id: user.id,
        metadata: { user_email: user.email },
      });
    }
  } catch (auditErr) {
    console.warn("[Auth] Failed to audit logout:", auditErr);
  }

  try {
    await supabase.auth.signOut();
  } catch (signOutErr) {
    console.error("[Auth] Error signing out from Supabase:", signOutErr);
  }

  revalidatePath("/", "layout");
  redirect("/login");
}

export async function forgotPassword(
  state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = ((formData.get("email") as string) || "").trim();

  if (!email) {
    return {
      error: "Email is required.",
      fieldErrors: { email: "Email address is required." },
      fieldValues: { email },
    };
  }

  const emailLower = email.toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailLower)) {
    return {
      error: "Enter a valid email address.",
      fieldErrors: { email: "Please enter a valid email address." },
      fieldValues: { email },
    };
  }

  // 1. Verify if the account exists in Supabase
  const adminSupabase = createSupabaseAdminClient();
  const { data: existingUser, error: lookupError } = await adminSupabase
    .from("users")
    .select("id, email, status")
    .ilike("email", emailLower)
    .maybeSingle();

  if (lookupError) {
    console.error("Database error looking up user in forgotPassword:", lookupError);
  }

  if (!existingUser) {
    return {
      error: "No account found with this email address. Please check your email or request access.",
      fieldErrors: { email: "No account found with this email address." },
      fieldValues: { email },
    };
  }

  // 2. Verify that user is approved by admin (status must be 'active')
  if (existingUser.status === "pending") {
    return {
      error: "Your account is pending administrator approval. You cannot reset your password until your account has been approved.",
      fieldErrors: { email: "Account pending administrator approval." },
      fieldValues: { email },
    };
  }

  if (existingUser.status === "inactive") {
    return {
      error: "Your account has been deactivated. Please contact your administrator.",
      fieldErrors: { email: "Account is deactivated." },
      fieldValues: { email },
    };
  }

  if (existingUser.status !== "active") {
    return {
      error: "Your account is not active. Please contact your administrator.",
      fieldErrors: { email: "Account is not active." },
      fieldValues: { email },
    };
  }

  // 3. User is approved and active: send the password reset email via Supabase Auth
  const supabase = await createSupabaseServerClient();
  let origin: string | undefined;
  try {
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") || headerList.get("host");
    const proto = headerList.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
    if (host) origin = `${proto}://${host}`;
  } catch {}
  const resetRedirectUrl = getResetPasswordRedirectUrl(origin);

  const { error } = await supabase.auth.resetPasswordForEmail(existingUser.email || emailLower, {
    // SECURITY: Use canonical redirect URL for dedicated reset-password page
    redirectTo: resetRedirectUrl,
  });

  if (error) {
    console.error("Supabase resetPasswordForEmail error:", error);
    return {
      error: error.message || "Failed to send reset email. Please try again.",
      fieldErrors: { email: "Failed to send reset link." },
      fieldValues: { email },
    };
  }

  return {
    message: "Password reset link has been sent to your email. Please check your inbox and click the link to set your new password.",
  };
}

const ALLOWED_SIGNUP_DOCUMENT_MIMES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};
const MAX_SIGNUP_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

function validateDocumentUpload(
  file: File | null,
  required: boolean,
  label: string
): { error?: string; safeExt?: string } {
  if (!file || file.size === 0) {
    if (required) return { error: `${label} is required.` };
    return {};
  }
  if (file.size > MAX_SIGNUP_FILE_SIZE_BYTES) {
    return {
      error: `${label} must be smaller than 2 MB (received ${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }
  const safeExt = ALLOWED_SIGNUP_DOCUMENT_MIMES[file.type.toLowerCase()];
  if (!safeExt) {
    return {
      error: `${label} must be a valid document file (JPG, PNG, WebP, or PDF).`,
    };
  }
  return { safeExt };
}

function sanitizeDocumentFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, 100);
}

/**
 * Extracts client IP from incoming request headers for Server Actions.
 */
async function getServerActionClientIp(): Promise<string> {
  try {
    const headerList = await headers();
    const cfIp = headerList.get("cf-connecting-ip");
    if (cfIp && cfIp.trim().length > 0) return cfIp.trim();
    const realIp = headerList.get("x-real-ip");
    if (realIp && realIp.trim().length > 0) return realIp.trim();
    const trueClientIp = headerList.get("true-client-ip");
    if (trueClientIp && trueClientIp.trim().length > 0) return trueClientIp.trim();
    const forwarded = headerList.get("x-forwarded-for");
    if (forwarded) {
      const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length > 0) return parts[parts.length - 1] || parts[0];
    }
  } catch {}
  return "127.0.0.1";
}

/**
 * Verifies that the first 3 bytes of a staged file match JPEG magic bytes FF D8 FF.
 * Uses HTTP Range 0-2 request so exactly 3 bytes travel across the network.
 */
async function verifyStagedJpegMagicBytes(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  stagingPath: string
): Promise<boolean> {
  try {
    const { data: signedData, error: signErr } = await adminSupabase.storage
      .from("doc_staging")
      .createSignedUrl(stagingPath, 60);

    if (signErr || !signedData?.signedUrl) {
      console.error(`[MagicBytes] Failed to create signed URL for ${stagingPath}:`, signErr);
      return false;
    }

    const resp = await fetch(signedData.signedUrl, {
      headers: { Range: "bytes=0-2" },
    });

    if (!resp.ok && resp.status !== 206) {
      console.error(`[MagicBytes] HTTP error ${resp.status} reading ${stagingPath}`);
      return false;
    }

    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.length < 3) return false;

    // Standard JPEG magic bytes: FF D8 FF
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  } catch (err) {
    console.error(`[MagicBytes] Exception reading magic bytes for ${stagingPath}:`, err);
    return false;
  }
}

export async function signup(
  state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const sanitize = (val: string) => val.replace(/[\x00-\x1F\x7F]/g, "").trim();

  // 1. Rate limit inside the action (Upstash / In-Memory fallback)
  const clientIp = await getServerActionClientIp();
  const rateLimitResult = await checkRateLimitAsync(`${clientIp}:action:signup`, RATE_LIMIT_PROFILES.AUTH_STRICT);
  if (!rateLimitResult.success) {
    const retryText = formatRetryAfter(rateLimitResult.resetSeconds);
    return {
      error: `Too many registration attempts. Please try again in ${retryText}.`,
      fieldValues: {
        email: sanitize((formData.get("email") as string) || ""),
      },
    };
  }

  // 2. Extract and sanitize input fields
  const fullName = sanitize((formData.get("full_name") as string) || "");
  const email = sanitize((formData.get("email") as string) || "");
  const phone = sanitize((formData.get("phone") as string) || "");
  const city = sanitize((formData.get("city") as string) || "");
  const district = sanitize((formData.get("district") as string) || "");
  const stateRaw = sanitize((formData.get("state") as string) || "");
  const stateIdRaw = formData.get("state_id") as string | null;

  // Resolve state_id and normalized state name
  let resolvedStateId: number | null = null;
  let resolvedStateName = stateRaw;

  if (stateIdRaw && !isNaN(Number(stateIdRaw)) && Number(stateIdRaw) > 0) {
    const matchedState = getStateById(Number(stateIdRaw));
    if (matchedState) {
      resolvedStateId = matchedState.id;
      resolvedStateName = matchedState.name;
    }
  }

  if (!resolvedStateId && stateRaw) {
    const matchedState = getStateByName(stateRaw);
    if (matchedState) {
      resolvedStateId = matchedState.id;
      resolvedStateName = matchedState.name;
    }
  }

  const address = sanitize((formData.get("address") as string) || "");
  const bankAccountNumber = sanitize((formData.get("bank_account_number") as string) || "");
  const bankIfscCode = sanitize((formData.get("bank_ifsc_code") as string) || "").toUpperCase();
  const aadhaarNumber = sanitize((formData.get("aadhaar_number") as string) || "");
  const licenseNumber = sanitize((formData.get("license_number") as string) || "");
  const shiftStartTimeRaw = sanitize((formData.get("shift_start_time") as string) || "");
  const shiftEndTimeRaw = sanitize((formData.get("shift_end_time") as string) || "");
  const shiftTimeRaw = sanitize((formData.get("shift_time") as string) || "");
  const supervisorIdRaw = sanitize((formData.get("supervisor_id") as string) || "");
  const rawMachineCategory = sanitize((formData.get("machine_category") as string) || "");

  const resolvedShiftTime =
    shiftTimeRaw ||
    (shiftStartTimeRaw && shiftEndTimeRaw
      ? `${shiftStartTimeRaw} - ${shiftEndTimeRaw}`
      : shiftStartTimeRaw || shiftEndTimeRaw || "");

  const password = (formData.get("password") as string) || "";
  const confirmPassword = (formData.get("confirm_password") as string) || "";
  const requestedRole = sanitize((formData.get("role") as string) || "operator");
  const machineCategory = requestedRole === "operator" ? (normalizeMachineCategory(rawMachineCategory) || rawMachineCategory || null) : null;

  // SECURITY (F07): Only allow non-admin roles during self-registration signup.
  const allowedSignupRoles = [
    "manager",
    "supervisor",
    "hr",
    "operator",
  ];

  const fieldValues = {
    full_name: fullName,
    email,
    phone,
    role: requestedRole,
    machine_category: requestedRole === "operator" ? (machineCategory || rawMachineCategory) : "",
    supervisor_id: supervisorIdRaw,
    shift_start_time: shiftStartTimeRaw,
    shift_end_time: shiftEndTimeRaw,
    shift_time: resolvedShiftTime,
    address,
    city,
    district,
    state: resolvedStateName,
    state_id: resolvedStateId ? String(resolvedStateId) : "",
    bank_account_number: bankAccountNumber,
    bank_ifsc_code: bankIfscCode,
    aadhaar_number: aadhaarNumber,
    license_number: licenseNumber,
    password,
    confirm_password: confirmPassword,
  };

  if (!allowedSignupRoles.includes(requestedRole)) {
    return {
      error: "Invalid role selected for registration.",
      fieldErrors: { role: "Invalid role selected." },
      fieldValues,
    };
  }
  const role = requestedRole;

  const fieldErrors: Record<string, string> = {};

  if (!fullName) {
    fieldErrors.full_name = "Full name is required.";
  } else if (fullName.length < 2 || fullName.length > 100) {
    fieldErrors.full_name = "Full name must be between 2 and 100 characters.";
  }

  if (!email) {
    fieldErrors.email = "Email is required.";
  } else if (email.length > 255) {
    fieldErrors.email = "Email address cannot exceed 255 characters.";
  }

  if (!phone) {
    fieldErrors.phone = "Mobile number is required.";
  } else if (phone.length > 15) {
    fieldErrors.phone = "Mobile number cannot exceed 15 digits.";
  }

  if (!shiftStartTimeRaw) fieldErrors.shift_start_time = "Start time is required.";
  if (!shiftEndTimeRaw) fieldErrors.shift_end_time = "End time is required.";

  let safeSupervisorId: string | null = null;
  if (isSupervisedRole(role)) {
    if (!supervisorIdRaw) {
      fieldErrors.supervisor_id = "Supervisor is required.";
    } else {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(supervisorIdRaw)) {
        fieldErrors.supervisor_id = "Selected supervisor is invalid.";
      } else {
        safeSupervisorId = supervisorIdRaw;
      }
    }
  }

  if (role === "operator") {
    if (!rawMachineCategory) {
      fieldErrors.machine_category = "Machine category is required.";
    } else if (!machineCategory) {
      fieldErrors.machine_category = "Please select a valid machine category.";
    }
  }

  if (!address) {
    fieldErrors.address = "Street address is required.";
  } else if (address.length < 2 || address.length > 255) {
    fieldErrors.address = "Address must be between 2 and 255 characters.";
  }

  if (!city) {
    fieldErrors.city = "City/Town/Village is required.";
  } else if (city.length < 2 || city.length > 100) {
    fieldErrors.city = "City must be between 2 and 100 characters.";
  }

  if (!district) {
    fieldErrors.district = "District is required.";
  } else if (district.length < 2 || district.length > 100) {
    fieldErrors.district = "District must be between 2 and 100 characters.";
  }

  if (!resolvedStateName) {
    fieldErrors.state = "State is required.";
  } else if (resolvedStateName.length < 2 || resolvedStateName.length > 100) {
    fieldErrors.state = "State must be between 2 and 100 characters.";
  }

  // Banking Validation
  if (!bankAccountNumber) {
    fieldErrors.bank_account_number = "Bank account number is required.";
  } else {
    const bankRes = validateBankAccountNumber(bankAccountNumber);
    if (!bankRes.isValid) {
      fieldErrors.bank_account_number = bankRes.error || "Valid bank account required (9-18 digits).";
    }
  }

  if (!bankIfscCode) {
    fieldErrors.bank_ifsc_code = "IFSC code is required.";
  } else {
    const ifscRes = validateIfscCode(bankIfscCode);
    if (!ifscRes.isValid) {
      fieldErrors.bank_ifsc_code = ifscRes.error || "Valid 11-character IFSC code required.";
    }
  }

  if (!password) fieldErrors.password = "Password is required.";
  if (!confirmPassword) fieldErrors.confirm_password = "Confirm password is required.";

  if (password && confirmPassword && password !== confirmPassword) {
    fieldErrors.password = "Passwords do not match.";
    fieldErrors.confirm_password = "Passwords do not match.";
  }

  // SECURITY (DoS prevention): Max password length 128 characters
  if (password && password.length > 128) {
    fieldErrors.password = "Password cannot exceed 128 characters.";
  }

  // SECURITY (F08): Enforce minimum 8-character passwords with complexity requirements
  if (password && password.length < 8) {
    fieldErrors.password = "Must be at least 8 characters.";
  } else if (password) {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    if (!hasUppercase || !hasLowercase || !hasDigit) {
      fieldErrors.password = "Must include uppercase, lowercase, and a number.";
    }
  }

  const digitsOnly = phone.replace(/\D/g, "");
  const is10DigitMobile =
    digitsOnly.length === 10 ||
    (digitsOnly.length === 12 && digitsOnly.startsWith("91")) ||
    (digitsOnly.length === 11 && digitsOnly.startsWith("0"));

  if (phone && !is10DigitMobile) {
    fieldErrors.phone = "Valid 10-digit mobile number required.";
  }

  const emailLower = email.toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !emailRegex.test(emailLower)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  // Aadhaar format validation
  let cleanAadhaar: string | null = null;
  if (aadhaarNumber) {
    const aadhaarResult = validateAadhaarNumber(aadhaarNumber);
    if (!aadhaarResult.isValid) {
      fieldErrors.aadhaar_number = aadhaarResult.error || "Valid 12-digit Aadhaar required.";
    } else {
      cleanAadhaar = aadhaarResult.clean || null;
    }
  }

  // Driving licence format validation (Mandatory for operators)
  let formattedLicense: string | null = null;
  let licClean: string | null = null;
  if (role === "operator") {
    if (!licenseNumber || !licenseNumber.trim()) {
      fieldErrors.license_number = "Driving licence is required for operators.";
    } else {
      const licResult = validateLicenseNumber(licenseNumber);
      if (!licResult.isValid) {
        fieldErrors.license_number = licResult.error || "Invalid licence format.";
      } else {
        formattedLicense = licResult.formatted || licenseNumber.trim().toUpperCase();
        licClean = licResult.clean || licenseNumber.trim();
      }
    }
  } else if (licenseNumber && licenseNumber.trim()) {
    const licResult = validateLicenseNumber(licenseNumber);
    if (!licResult.isValid) {
      fieldErrors.license_number = licResult.error || "Invalid licence format.";
    } else {
      formattedLicense = licResult.formatted || licenseNumber.trim().toUpperCase();
      licClean = licResult.clean || licenseNumber.trim();
    }
  }

  // Document Session Token Validation (Zero-Byte Staging Architecture)
  const stagingSessionToken =
    ((formData.get("staging_session_token") || formData.get("session")) as string | null)?.trim() || null;

  let stagingUuid: string | null = null;
  let bankFile: File | null = null;
  let bankValidation: { error?: string; safeExt?: string } = {};
  let aadhaarValidation: { error?: string; safeExt?: string } = {};
  let licenseValidation: { error?: string; safeExt?: string } = {};

  if (stagingSessionToken) {
    const verifyRes = verifyUploadSessionToken(stagingSessionToken);
    if (!verifyRes.valid) {
      return {
        error: verifyRes.error || "Upload session has expired. Please reselect your documents.",
        fieldErrors: { bank_document_file: "Upload session expired." },
        fieldValues,
      };
    }
    stagingUuid = verifyRes.uuid;
  } else {
    // Legacy fallback for multipart file uploads
    bankFile = (formData.get("bank_document_file") || formData.get("bank_passbook_file")) as File | null;
    bankValidation = validateDocumentUpload(bankFile, true, "Bank document");
    if (bankValidation.error) {
      fieldErrors.bank_document_file = bankValidation.error;
    }

    if (!aadhaarNumber) {
      fieldErrors.aadhaar_number = "Aadhaar number is required.";
    }
    const aadhaarFileRaw = formData.get("aadhaar_file") as File | null;
    aadhaarValidation = validateDocumentUpload(aadhaarFileRaw, true, "Aadhaar document");
    if (aadhaarValidation.error) {
      fieldErrors.aadhaar_file = aadhaarValidation.error;
    }

    const licenseFileRaw = formData.get("license_file") as File | null;
    licenseValidation = validateDocumentUpload(licenseFileRaw, false, "Licence document");
    if (licenseValidation.error) {
      fieldErrors.license_file = licenseValidation.error;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Please complete all required fields.",
      fieldErrors,
      fieldValues,
    };
  }

  const adminSupabase = createSupabaseAdminClient();
  const last10Digits = digitsOnly.slice(-10);

  // 3. Parallel checks (Promise.all): supervisor, email, phone, Aadhaar, licence, and staging list
  const [
    supervisorCheckResult,
    emailCheckResult,
    phoneCheckResult,
    aadhaarCheckResult,
    licenseCheckResult,
    stagingListResult,
  ] = await Promise.all([
    safeSupervisorId
      ? adminSupabase.from("users").select("id, role, status").eq("id", safeSupervisorId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    adminSupabase.from("users").select("id").ilike("email", emailLower).maybeSingle(),

    phone
      ? adminSupabase.from("users").select("id, phone").or(`phone.eq.${phone},phone.ilike.%${last10Digits}`).limit(5)
      : Promise.resolve({ data: [] as Array<{ id: string; phone: string | null }>, error: null }),

    cleanAadhaar
      ? adminSupabase.from("users").select("id").eq("aadhaar_number", cleanAadhaar).maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    licClean
      ? adminSupabase.from("users").select("id").ilike("license_number", licClean).maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    stagingUuid
      ? adminSupabase.storage.from("doc_staging").list(`signup/${stagingUuid}`)
      : Promise.resolve({ data: null, error: null }),
  ]);

  // Evaluate supervisor validity
  if (safeSupervisorId && isSupervisedRole(role)) {
    const validSup = supervisorCheckResult.data;
    if (
      !validSup ||
      (validSup.role !== "supervisor" &&
        validSup.role !== "manager" &&
        validSup.role !== "admin" &&
        validSup.role !== "super_admin") ||
      validSup.status !== "active"
    ) {
      return {
        error: "The selected supervisor is invalid or inactive.",
        fieldErrors: { supervisor_id: "The selected supervisor is invalid or inactive." },
        fieldValues,
      };
    }
  }

  // Evaluate email uniqueness
  if (emailCheckResult.data) {
    return {
      error: "Email already registered.",
      fieldErrors: { email: "Email already registered." },
      fieldValues,
    };
  }

  // Evaluate phone uniqueness
  if (phoneCheckResult.data && phoneCheckResult.data.length > 0) {
    const targetDigits = digitsOnly;
    const hasDup = phoneCheckResult.data.some((u) => {
      if (!u.phone) return false;
      const uDigits = u.phone.replace(/\D/g, "");
      if (targetDigits.length >= 10 && uDigits.length >= 10) {
        return targetDigits.slice(-10) === uDigits.slice(-10);
      }
      return targetDigits === uDigits;
    });
    if (hasDup) {
      return {
        error: "Mobile number already registered.",
        fieldErrors: { phone: "Mobile number already registered." },
        fieldValues,
      };
    }
  }

  // Evaluate Aadhaar uniqueness
  if (cleanAadhaar && aadhaarCheckResult.data) {
    return {
      error: "Aadhaar number already registered.",
      fieldErrors: { aadhaar_number: "Aadhaar number already registered." },
      fieldValues,
    };
  }

  // Evaluate Driving Licence uniqueness
  if (licClean && licenseCheckResult.data) {
    return {
      error: "Licence number already registered.",
      fieldErrors: { license_number: "Licence number already registered." },
      fieldValues,
    };
  }

  // 4. Staged Document Metadata & Magic Bytes Validation
  if (stagingUuid) {
    const stagedFiles = stagingListResult.data;
    if (stagingListResult.error || !stagedFiles) {
      console.error("[Signup] Staging check error:", stagingListResult.error);
      return {
        error: "Failed to verify uploaded documents in staging.",
        fieldValues,
      };
    }

    const stagedFileMap = new Map(stagedFiles.map((f) => [f.name, f]));

    const validateSlotMetadata = (docType: string, label: string, required: boolean) => {
      const mainName = `${docType}.jpg`;
      const thumbName = `${docType}_thumb.jpg`;
      const mainFile = stagedFileMap.get(mainName);
      const thumbFile = stagedFileMap.get(thumbName);

      if (!mainFile) {
        if (required) return `${label} photo is required.`;
        return null;
      }

      // Check MIME type
      const mainMime = mainFile.metadata?.mimetype || "";
      if (mainMime && mainMime !== "image/jpeg") {
        return `${label} must be a JPEG image.`;
      }

      // Check size limit (max 1 MB)
      const mainSize = mainFile.metadata?.size;
      if (typeof mainSize === "number" && mainSize > DOC_UPLOAD.maxBytes) {
        return `${label} exceeds maximum allowed size of 1 MB.`;
      }

      if (!thumbFile && required) {
        return `${label} thumbnail is missing. Please re-upload.`;
      }

      return null;
    };

    const bankDocErr = validateSlotMetadata("bank_document", "Bank document", true);
    if (bankDocErr) fieldErrors.bank_document_file = bankDocErr;

    const aadhaarDocErr = validateSlotMetadata("aadhaar", "Aadhaar document", true);
    if (aadhaarDocErr) fieldErrors.aadhaar_file = aadhaarDocErr;

    if (role === "operator") {
      const licDocErr = validateSlotMetadata("driving_license", "Driving licence document", true);
      if (licDocErr) fieldErrors.license_file = licDocErr;
    } else if (stagedFileMap.has("driving_license.jpg")) {
      const licDocErr = validateSlotMetadata("driving_license", "Licence document", false);
      if (licDocErr) fieldErrors.license_file = licDocErr;
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        error: "Document verification failed. Please check your uploaded documents.",
        fieldErrors,
        fieldValues,
      };
    }

    // 4b. Read first 3 bytes of each main file in parallel and confirm FF D8 FF
    const magicByteChecks: Array<Promise<{ docType: string; valid: boolean }>> = [
      verifyStagedJpegMagicBytes(adminSupabase, `signup/${stagingUuid}/bank_document.jpg`).then((valid) => ({
        docType: "bank_document",
        valid,
      })),
      verifyStagedJpegMagicBytes(adminSupabase, `signup/${stagingUuid}/aadhaar.jpg`).then((valid) => ({
        docType: "aadhaar",
        valid,
      })),
    ];

    if (role === "operator" || stagedFileMap.has("driving_license.jpg")) {
      magicByteChecks.push(
        verifyStagedJpegMagicBytes(adminSupabase, `signup/${stagingUuid}/driving_license.jpg`).then((valid) => ({
          docType: "driving_license",
          valid,
        }))
      );
    }

    const magicResults = await Promise.all(magicByteChecks);
    for (const res of magicResults) {
      if (!res.valid) {
        return {
          error: "Uploaded document file is invalid or corrupted. Please re-upload your document.",
          fieldValues,
        };
      }
    }
  }

  // 5. Create auth user with admin client (email_confirm: true prevents GoTrue email rate limits)
  const { data, error } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone,
      role: role,
      machine_category: role === "operator" ? machineCategory : null,
      shift_time: resolvedShiftTime || null,
      shift_start_time: shiftStartTimeRaw || null,
      shift_end_time: shiftEndTimeRaw || null,
      street: address || null,
      address: address || null,
      city,
      district,
      state: resolvedStateName,
      state_id: resolvedStateId,
      location: `${address ? `${address}, ` : ""}${city}, ${district}, ${resolvedStateName}`,
      bank_account_number: bankAccountNumber.replace(/[\s\-]/g, ""),
      bank_ifsc_code: bankIfscCode.replace(/[\s\-]/g, ""),
      aadhaar_number: cleanAadhaar,
      license_number: formattedLicense,
      supervisor_id: supervisorIdRaw || null,
      staging_session_token: stagingSessionToken || null,
    },
  });

  if (error) {
    console.error("Signup error:", error);
    const message = error.message.toLowerCase();

    if (message.includes("already registered") || message.includes("user already exists") || message.includes("already exists")) {
      return {
        error: "An account with this email already exists.",
        fieldErrors: {
          email: "An account with this email already exists.",
        },
        fieldValues,
      };
    }
    if (error.status === 429 || message.includes("rate limit") || message.includes("too many requests")) {
      const maybeRetryAfter = (error as unknown as { retry_after?: number }).retry_after;
      const retryText = typeof maybeRetryAfter === "number" && Number.isFinite(maybeRetryAfter) && maybeRetryAfter > 0
        ? formatRetryAfter(maybeRetryAfter)
        : "about a minute";
      return {
        error: `Too many attempts. Please try again in ${retryText}.`,
        fieldValues,
      };
    }
    if (message.includes("invalid") && (message.includes("email") || message.includes("address"))) {
      return {
        error: "Enter a valid email address.",
        fieldErrors: {
          email: "Enter a valid email address.",
        },
        fieldValues,
      };
    }
    if (message.includes("password") && message.includes("weak")) {
      return {
        error: "Password is too weak. Please use a stronger password.",
        fieldErrors: {
          password: "Password is too weak. Please use a stronger password.",
        },
        fieldValues,
      };
    }
    if (message.includes("signup") || message.includes("registration")) {
      return {
        error: error.message,
        fieldValues,
      };
    }

    return {
      error: "Signup failed. Please check your details and try again.",
      fieldValues,
    };
  }

  if (!data.user) {
    return {
      error: "Failed to create account. Please try again.",
      fieldValues,
    };
  }

  const userId = data.user.id;

  // 6. Direct sync to public.users for guaranteed bank account & IFSC persistence
  try {
    const cleanBank = bankAccountNumber.replace(/[\s\-]/g, "");
    const cleanIfsc = bankIfscCode.replace(/[\s\-]/g, "");
    await adminSupabase.from("users").update({
      bank_account_number: cleanBank,
      bank_ifsc_code: cleanIfsc,
      machine_category: role === "operator" ? machineCategory : null,
    }).eq("id", userId);
  } catch (syncErr) {
    console.warn("Direct bank info sync warning:", syncErr);
  }

  // 7 & 8. Move files to user_files, batch upsert user_documents, and log audit
  // 9. Failure after step 5 is not atomic: if step 7 or 8 fails, delete the new auth user (cascades)
  //    return "Please try again", and leave staged files in place for retry.
  try {
    let finalizedLicense = false;
    let finalizeDocsList: Array<{ id: string; docType: string; mainPath: string; thumbPath: string | null; sizeBytes: number }> = [];

    if (stagingSessionToken && stagingUuid) {
      const finalizeResult = await finalizeStagedSignupDocuments({
        userId,
        stagingUuid,
      });

      if (!finalizeResult.success) {
        throw new Error(finalizeResult.error || "Failed to finalize staged documents");
      }

      finalizedLicense = finalizeResult.documents.some((d) => d.docType === "driving_license");
      finalizeDocsList = finalizeResult.documents;
    } else {
      // Legacy multipart file upload fallback
      bankFile = (formData.get("bank_document_file") || formData.get("bank_passbook_file")) as File | null;
      if (bankFile && bankFile.size > 0 && bankValidation.safeExt) {
        const storagePath = `documents/${userId}/bank_document${bankValidation.safeExt}`;
        const fileBytes = await bankFile.arrayBuffer();

        const { error: uploadErr } = await adminSupabase.storage
          .from("user_files")
          .upload(storagePath, fileBytes, {
            contentType: bankFile.type,
            upsert: true,
          });

        if (!uploadErr) {
          await adminSupabase.from("user_documents").upsert(
            {
              user_id: userId,
              document_type_code: "bank_document",
              storage_path: storagePath,
              mime_type: bankFile.type,
              file_size_bytes: bankFile.size,
              file_name: sanitizeDocumentFileName(bankFile.name),
              status: "pending",
              verification_status: "pending",
            },
            { onConflict: "user_id,document_type_code" }
          );
        }
      }

      const aadhaarFile = formData.get("aadhaar_file") as File | null;
      const licenseFile = formData.get("license_file") as File | null;

      if (aadhaarFile && aadhaarFile.size > 0 && aadhaarValidation.safeExt) {
        const storagePath = `documents/${userId}/aadhaar${aadhaarValidation.safeExt}`;
        const fileBytes = await aadhaarFile.arrayBuffer();

        const { error: uploadErr } = await adminSupabase.storage
          .from("user_files")
          .upload(storagePath, fileBytes, {
            contentType: aadhaarFile.type,
            upsert: true,
          });

        if (!uploadErr) {
          await adminSupabase.from("user_documents").upsert(
            {
              user_id: userId,
              document_type_code: "aadhaar",
              storage_path: storagePath,
              mime_type: aadhaarFile.type,
              file_size_bytes: aadhaarFile.size,
              file_name: sanitizeDocumentFileName(aadhaarFile.name),
              status: "pending",
              verification_status: "pending",
            },
            { onConflict: "user_id,document_type_code" }
          );
        }
      }

      if (licenseFile && licenseFile.size > 0 && licenseValidation.safeExt) {
        const storagePath = `documents/${userId}/driving_license${licenseValidation.safeExt}`;
        const fileBytes = await licenseFile.arrayBuffer();

        const { error: uploadErr } = await adminSupabase.storage
          .from("user_files")
          .upload(storagePath, fileBytes, {
            contentType: licenseFile.type,
            upsert: true,
          });

        if (!uploadErr) {
          finalizedLicense = true;
          await adminSupabase.from("user_documents").upsert(
            {
              user_id: userId,
              document_type_code: "driving_license",
              storage_path: storagePath,
              mime_type: licenseFile.type,
              file_size_bytes: licenseFile.size,
              file_name: sanitizeDocumentFileName(licenseFile.name),
              status: "pending",
              verification_status: "pending",
            },
            { onConflict: "user_id,document_type_code" }
          );
        }
      }
    }

    // Step 8: Write Audit Log Entry
    await logAudit({
      action: "user.signup",
      entity_type: "user",
      entity_id: userId,
      user_id: userId,
      target_user_id: userId,
      metadata: {
        user_name: fullName,
        user_email: email,
        phone,
        role: role,
        machine_category: role === "operator" ? machineCategory : null,
        shift_time: resolvedShiftTime || null,
        city,
        district,
        state: resolvedStateName,
        state_id: resolvedStateId,
        location: `${city}, ${district}, ${resolvedStateName}`,
        has_bank_details: !!bankAccountNumber,
        has_bank_document: !!stagingUuid || !!bankFile,
        has_aadhaar: !!aadhaarNumber,
        has_license: finalizedLicense || !!licenseNumber,
        staging_session: stagingUuid,
      },
    });

    // Step 8.1: Submit Registration Request to Centralized Approval Engine
    await submitToApprovalEngineSafely({
      type_key: "registration",
      subject_type: "user",
      subject_id: userId,
      subject_label: `${fullName} (${role})`,
      requested_by: userId,
      summary: `New registration: ${fullName} (${role})`,
      payload: {
        user_id: userId,
        full_name: fullName,
        email,
        phone,
        role,
        supervisor_id: safeSupervisorId || supervisorIdRaw || null,
        address: address || null,
        city,
        district,
        state: resolvedStateName,
        machine_category: role === "operator" ? machineCategory : null,
      },
    });

    // Step 8.2: Submit Initial Document Verification Requests to Centralized Approval Engine
    if (finalizeDocsList && finalizeDocsList.length > 0) {
      for (const fDoc of finalizeDocsList) {
        await submitToApprovalEngineSafely({
          type_key: "document_verify",
          subject_type: "document",
          subject_id: fDoc.id,
          subject_label: `${fDoc.docType.toUpperCase()} - ${fullName}`,
          requested_by: userId,
          summary: `Initial verification for ${fDoc.docType} (${fullName})`,
          payload: {
            document_id: fDoc.id,
            user_id: userId,
            document_type_code: fDoc.docType,
            storage_path: fDoc.mainPath,
            thumb_path: fDoc.thumbPath,
            size_bytes: fDoc.sizeBytes,
          },
        });
      }
    }

    return {
      message:
        "Registration request submitted successfully! Your account is pending administrator approval. After approval from the administrator, you can log in.",
    };
  } catch (postAuthErr) {
    console.error("[Signup] Post-auth document processing failed, executing compensation rollback:", postAuthErr);

    // Step 9 Rollback: Delete the newly created user (cascades to public.users & user_documents)
    // Staged files stay in doc_staging for user retry
    try {
      await adminSupabase.from("user_documents").delete().eq("user_id", userId);
      await adminSupabase.from("users").delete().eq("id", userId);
      await adminSupabase.auth.admin.deleteUser(userId);
    } catch (cleanupErr) {
      console.error("[Signup] Compensation rollback user cleanup error:", cleanupErr);
    }

    return {
      error: "Registration processing failed. Please try again.",
      fieldValues,
    };
  }
}

/**
 * Server action to fetch all active supervisors for selection dropdowns.
 * SECURITY (C-02): Uses admin client scoped to non-sensitive fields only.
 * Emails are intentionally excluded to prevent information disclosure.
 */
export async function getSupervisorsAction(): Promise<
  Array<{ value: string; label: string }>
> {
  try {
    const adminSupabase = createSupabaseAdminClient();
    const { data, error } = await adminSupabase
      .from("users")
      .select("id, full_name")
      .eq("role", "supervisor")
      .eq("status", "active")
      .order("full_name", { ascending: true })
      .limit(200);

    if (error || !data) {
      console.error("Error fetching supervisors list:", error);
      return [];
    }

    // SECURITY: Only return ID and name — no email, no description
    return data.map((s) => ({
      value: s.id,
      label: s.full_name,
    }));
  } catch (err) {
    console.error("Exception in getSupervisorsAction:", err);
    return [];
  }
}

/**
 * Server action to fetch all active working locations for selection dropdowns.
 * SECURITY (C-02): Scoped to non-sensitive location fields only.
 */
export async function getWorkingLocationsAction(): Promise<
  Array<{ value: string; label: string; description?: string }>
> {
  // Working locations table is retired in favor of unified employee address and site deployment logs
  return [];
}

/**
 * Authenticated server action to change the current user's password.
 * Optionally verifies current password if provided, then updates password and logs audit.
 */
export async function changePasswordAction(params: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "Not authenticated. Please log in again." };
    }

    // SECURITY (H-02): Current password is MANDATORY to prevent session-hijack password takeover
    if (!params.currentPassword) {
      return { success: false, error: "Current password is required to change your password." };
    }

    // SECURITY (H-03): Enforce consistent 8-char + complexity requirements (same as signup)
    if (!params.newPassword || params.newPassword.length < 8) {
      return { success: false, error: "New password must be at least 8 characters long." };
    }

    const hasUppercase = /[A-Z]/.test(params.newPassword);
    const hasLowercase = /[a-z]/.test(params.newPassword);
    const hasDigit = /\d/.test(params.newPassword);
    if (!hasUppercase || !hasLowercase || !hasDigit) {
      return {
        success: false,
        error: "New password must contain at least one uppercase letter, one lowercase letter, and one number.",
      };
    }

    // Verify current password before allowing change
    if (user.email) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: params.currentPassword,
      });

      if (signInError) {
        return { success: false, error: "Current password is incorrect." };
      }
    } else {
      return { success: false, error: "Unable to verify identity. Please contact support." };
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: params.newPassword,
    });

    if (updateError) {
      return { success: false, error: updateError.message || "Failed to update password." };
    }

    await logAudit({
      action: "auth.password_change",
      entity_type: "user",
      entity_id: user.id,
      user_id: user.id,
      metadata: { user_email: user.email },
    });

    // Enqueue SEC1 security alert (Critical priority, ignores quiet hours/preferences)
    try {
      await supabase.rpc('enqueue_notification', {
        p_user_id: user.id,
        p_category: 'security',
        p_priority: 'critical',
        p_title: 'Security Alert: Password Changed',
        p_body: 'Your account password was successfully updated. If you did not make this change, contact support immediately.',
        p_deep_link: '/settings/account',
        p_dedupe_key: `sec:${user.id}:${Math.floor(Date.now() / 1000)}`,
        p_source: 'action:change_password',
      });
    } catch (notifErr) {
      console.warn('[changePasswordAction] Failed to enqueue security notification:', notifErr);
    }

    return { success: true };
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error("Exception in changePasswordAction:", err);
    return { success: false, error: error?.message || "An unexpected error occurred." };
  }
}

export async function resetPasswordAction(params: {
  newPassword: string;
  confirmPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!params.newPassword || !params.confirmPassword) {
      return { success: false, error: "Please enter and confirm your new password." };
    }

    if (params.newPassword !== params.confirmPassword) {
      return { success: false, error: "Passwords do not match." };
    }

    if (params.newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters long." };
    }

    const hasUppercase = /[A-Z]/.test(params.newPassword);
    const hasLowercase = /[a-z]/.test(params.newPassword);
    const hasDigit = /\d/.test(params.newPassword);
    if (!hasUppercase || !hasLowercase || !hasDigit) {
      return {
        success: false,
        error: "Must include uppercase, lowercase, and a number.",
      };
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "Your password reset session has expired or is invalid. Please request a new reset link.",
      };
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: params.newPassword,
    });

    if (updateError) {
      return { success: false, error: updateError.message || "Failed to reset password." };
    }

    await logAudit({
      action: "auth.password_reset",
      entity_type: "user",
      entity_id: user.id,
      user_id: user.id,
      metadata: { user_email: user.email },
    });

    // Enqueue SEC1 security alert (Critical priority, ignores quiet hours/preferences)
    try {
      await supabase.rpc('enqueue_notification', {
        p_user_id: user.id,
        p_category: 'security',
        p_priority: 'critical',
        p_title: 'Security Alert: Password Reset',
        p_body: 'Your account password has been reset. If you did not make this change, contact support immediately.',
        p_deep_link: '/settings/account',
        p_dedupe_key: `sec:${user.id}:${Math.floor(Date.now() / 1000)}`,
        p_source: 'action:reset_password',
      });
    } catch (notifErr) {
      console.warn('[resetPasswordAction] Failed to enqueue security notification:', notifErr);
    }

    return { success: true };
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error("Exception in resetPasswordAction:", err);
    return { success: false, error: error?.message || "An unexpected error occurred." };
  }
}

