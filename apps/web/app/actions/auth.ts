"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { getAppUrl, getResetPasswordRedirectUrl } from "@/lib/env";
import { validateAadhaarNumber, validateLicenseNumber, getStateById, getStateByName } from "@reachinternational/utils";
import { isSupervisedRole, getRoleHomeRoute } from "@reachinternational/permissions";


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
  if (!email) fieldErrors.email = "Email address is required.";
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
        error: "Your email is not confirmed yet. Please wait for an administrator to approve your account.",
        fieldErrors: { email: "Email pending administrator confirmation." },
        fieldValues: { email },
      };
    }

    if (error.status && error.status >= 500) {
      return {
        error: "Authentication service encountered a server error. Please try again shortly.",
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
      error: "User profile not found. Contact your administrator.",
      fieldErrors: { email: "User profile not found." },
      fieldValues: { email },
    };
  }

  if (profile.status === "inactive") {
    await supabase.auth.signOut();
    return {
      error: "Your account has been deactivated. Contact your administrator.",
      fieldErrors: { email: "Account is deactivated." },
      fieldValues: { email },
    };
  }

  if (profile.status === "pending") {
    await supabase.auth.signOut();
    return {
      error: "Your account is pending approval. Please wait for an administrator to approve your account.",
      fieldErrors: { email: "Account pending admin approval." },
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
      error: "Please enter a valid email address.",
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

export async function signup(
  state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const fullName = ((formData.get("full_name") as string) || "").trim();
  const email = ((formData.get("email") as string) || "").trim();
  const phone = ((formData.get("phone") as string) || "").trim();
  const city = ((formData.get("city") as string) || "").trim();
  const district = ((formData.get("district") as string) || "").trim();
  const stateRaw = ((formData.get("state") as string) || "").trim();
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

  const address = ((formData.get("address") as string) || "").trim();
  const aadhaarNumber = ((formData.get("aadhaar_number") as string) || "").trim();
  const licenseNumber = ((formData.get("license_number") as string) || "").trim();
  const shiftStartTimeRaw = ((formData.get("shift_start_time") as string) || "").trim();
  const shiftEndTimeRaw = ((formData.get("shift_end_time") as string) || "").trim();
  const shiftTimeRaw = ((formData.get("shift_time") as string) || "").trim();
  const supervisorIdRaw = ((formData.get("supervisor_id") as string) || "").trim();
  const rawMonthlySalary = formData.get("monthly_salary");
  const monthlySalary = rawMonthlySalary !== null && rawMonthlySalary !== "" && !isNaN(Number(rawMonthlySalary)) ? Number(rawMonthlySalary) : null;

  const resolvedShiftTime =
    shiftTimeRaw ||
    (shiftStartTimeRaw && shiftEndTimeRaw
      ? `${shiftStartTimeRaw} - ${shiftEndTimeRaw}`
      : shiftStartTimeRaw || shiftEndTimeRaw || "");

  const password = (formData.get("password") as string) || "";
  const confirmPassword = (formData.get("confirm_password") as string) || "";
  const requestedRole = (formData.get("role") as string) || "operator";

  // SECURITY (F07): Only allow non-admin roles during self-registration signup.
  // Admin and super_admin roles must be explicitly assigned by existing admins post-approval.
  const allowedSignupRoles = [
    "manager",
    "supervisor",
    "hr",
    "operator",
  ];

  const role = allowedSignupRoles.includes(requestedRole) ? requestedRole : "operator";

  const fieldValues = {
    full_name: fullName,
    email,
    phone,
    role,
    supervisor_id: supervisorIdRaw,
    shift_start_time: shiftStartTimeRaw,
    shift_end_time: shiftEndTimeRaw,
    shift_time: resolvedShiftTime,
    address,
    city,
    district,
    state: resolvedStateName,
    state_id: resolvedStateId ? String(resolvedStateId) : "",
    monthly_salary: rawMonthlySalary ? String(rawMonthlySalary) : "",
    aadhaar_number: aadhaarNumber,
    license_number: licenseNumber,
    password,
    confirm_password: confirmPassword,
  };

  const fieldErrors: Record<string, string> = {};

  if (!fullName) fieldErrors.full_name = "Full name is required.";
  if (!email) fieldErrors.email = "Email address is required.";
  if (!phone) fieldErrors.phone = "Mobile number is required.";
  if (!shiftStartTimeRaw) fieldErrors.shift_start_time = "Shift start time is required.";
  if (!shiftEndTimeRaw) fieldErrors.shift_end_time = "Shift end time is required.";
  if (isSupervisedRole(role) && !supervisorIdRaw) {
    fieldErrors.supervisor_id = "Please select your supervisor.";
  }
  if (!address) fieldErrors.address = "Street / site base address is required.";
  if (!city) fieldErrors.city = "City/Town/Village is required.";
  if (!district) fieldErrors.district = "District is required.";
  if (!resolvedStateName) fieldErrors.state = "State is required.";
  if (monthlySalary === null || monthlySalary <= 0) {
    fieldErrors.monthly_salary = "Monthly salary is required and must be greater than 0.";
  }
  if (!aadhaarNumber) fieldErrors.aadhaar_number = "Aadhaar card number is required.";
  if (!password) fieldErrors.password = "Password is required.";
  if (!confirmPassword) fieldErrors.confirm_password = "Confirm password is required.";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Please fill in all required fields.",
      fieldErrors,
      fieldValues,
    };
  }

  if (password !== confirmPassword) {
    return {
      error: "Passwords do not match.",
      fieldErrors: {
        password: "Passwords do not match.",
        confirm_password: "Passwords do not match.",
      },
      fieldValues,
    };
  }

  // SECURITY (F08): Enforce minimum 8-character passwords with complexity requirements
  if (password.length < 8) {
    return {
      error: "Password must be at least 8 characters long.",
      fieldErrors: {
        password: "Password must be at least 8 characters long.",
      },
      fieldValues,
    };
  }

  // Require at least one uppercase, one lowercase, and one digit
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  if (!hasUppercase || !hasLowercase || !hasDigit) {
    return {
      error: "Password must contain at least one uppercase letter, one lowercase letter, and one number.",
      fieldErrors: {
        password: "Password must include uppercase, lowercase, and a number.",
      },
      fieldValues,
    };
  }

  const digitsOnly = phone.replace(/\D/g, "");
  const is10DigitMobile =
    digitsOnly.length === 10 ||
    (digitsOnly.length === 12 && digitsOnly.startsWith("91")) ||
    (digitsOnly.length === 11 && digitsOnly.startsWith("0"));

  if (!is10DigitMobile) {
    return {
      error: "Please enter a valid 10-digit mobile number.",
      fieldErrors: {
        phone: "Please enter a valid 10-digit mobile number.",
      },
      fieldValues,
    };
  }

  const emailLower = email.toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailLower)) {
    return {
      error: "Please enter a valid email address.",
      fieldErrors: {
        email: "Please enter a valid email address.",
      },
      fieldValues,
    };
  }

  // Admin client check to enforce unique email and mobile number rule
  const adminSupabase = createSupabaseAdminClient();

  // 1. Check duplicate email in public.users
  const { data: existingEmailUser } = await adminSupabase
    .from("users")
    .select("id")
    .ilike("email", emailLower)
    .maybeSingle();

  if (existingEmailUser) {
    return {
      error: "A user account with this email address already exists.",
      fieldErrors: {
        email: "A user account with this email address already exists.",
      },
      fieldValues,
    };
  }

  // 2. Check duplicate mobile number in public.users
  if (phone) {
    const { data: existingPhoneUsers } = await adminSupabase
      .from("users")
      .select("id, phone")
      .not("phone", "is", null);

    const targetDigits = phone.replace(/\D/g, "");
    const hasDuplicatePhone = existingPhoneUsers?.some((u) => {
      if (!u.phone) return false;
      const uDigits = u.phone.replace(/\D/g, "");
      if (targetDigits.length >= 10 && uDigits.length >= 10) {
        return targetDigits.slice(-10) === uDigits.slice(-10);
      }
      return targetDigits === uDigits;
    });

    if (hasDuplicatePhone) {
      return {
        error: "A user account with this mobile number already exists.",
        fieldErrors: {
          phone: "A user account with this mobile number already exists.",
        },
        fieldValues,
      };
    }
  }

  // 3. Validation & Duplicate check for Aadhaar Number
  let cleanAadhaar: string | null = null;
  if (aadhaarNumber) {
    const aadhaarResult = validateAadhaarNumber(aadhaarNumber);
    if (!aadhaarResult.isValid) {
      return {
        error: aadhaarResult.error || "Please enter a valid 12-digit Aadhaar number.",
        fieldErrors: {
          aadhaar_number: aadhaarResult.error || "Please enter a valid 12-digit Aadhaar number.",
        },
        fieldValues,
      };
    }
    cleanAadhaar = aadhaarResult.clean || null;

    if (cleanAadhaar) {
      const { data: existingAadhaar } = await adminSupabase
        .from("users")
        .select("id")
        .eq("aadhaar_number", cleanAadhaar)
        .maybeSingle();

      if (existingAadhaar) {
        return {
          error: "A user account with this Aadhaar number already exists.",
          fieldErrors: {
            aadhaar_number: "A user account with this Aadhaar number already exists.",
          },
          fieldValues,
        };
      }
    }
  }

  // 4. Validation & Duplicate check for Driving Licence Number
  let formattedLicense: string | null = null;
  if (licenseNumber) {
    const licResult = validateLicenseNumber(licenseNumber);
    if (!licResult.isValid) {
      return {
        error: licResult.error || "Please enter a valid driving licence number.",
        fieldErrors: {
          license_number: licResult.error || "Please enter a valid driving licence number.",
        },
        fieldValues,
      };
    }
    formattedLicense = licResult.formatted || licenseNumber.trim().toUpperCase();

    const { data: existingLic } = await adminSupabase
      .from("users")
      .select("id")
      .ilike("license_number", licResult.clean || licenseNumber.trim())
      .maybeSingle();

    if (existingLic) {
      return {
        error: "A user account with this driving licence number already exists.",
        fieldErrors: {
          license_number: "A user account with this driving licence number already exists.",
        },
        fieldValues,
      };
    }
  }

  const supabase = await createSupabaseServerClient();

  // Create the auth user. The handle_new_user() DB trigger automatically
  // inserts a row into public.users with status = 'pending', so no
  // app-side status update is needed (and none would work pre-confirmation
  // because RLS blocks writes without a session).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
        role: role,
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
        monthly_salary: monthlySalary,
        aadhaar_number: cleanAadhaar,
        license_number: formattedLicense,
        supervisor_id: supervisorIdRaw || null,
      },
      emailRedirectTo: `${getAppUrl()}/login`,
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
        error: "Please enter a valid email address.",
        fieldErrors: {
          email: "Please enter a valid email address.",
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

  // Upload Aadhaar & Driving Licence documents if provided during signup
  const aadhaarFile = formData.get("aadhaar_file") as File | null;
  const licenseFile = formData.get("license_file") as File | null;

  if (aadhaarFile && aadhaarFile.size > 0) {
    try {
      const ext = aadhaarFile.name.split(".").pop()?.toLowerCase() || "bin";
      const storagePath = `documents/${userId}/aadhaar.${ext}`;
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
          },
          { onConflict: "user_id,document_type_code" }
        );
      } else {
        console.error("Failed to upload signup Aadhaar file:", uploadErr);
      }
    } catch (err) {
      console.error("Exception uploading signup Aadhaar file:", err);
    }
  }

  if (licenseFile && licenseFile.size > 0) {
    try {
      const ext = licenseFile.name.split(".").pop()?.toLowerCase() || "bin";
      const storagePath = `documents/${userId}/driving_license.${ext}`;
      const fileBytes = await licenseFile.arrayBuffer();

      const { error: uploadErr } = await adminSupabase.storage
        .from("user_files")
        .upload(storagePath, fileBytes, {
          contentType: licenseFile.type,
          upsert: true,
        });

      if (!uploadErr) {
        await adminSupabase.from("user_documents").upsert(
          {
            user_id: userId,
            document_type_code: "driving_license",
            storage_path: storagePath,
            mime_type: licenseFile.type,
            file_size_bytes: licenseFile.size,
          },
          { onConflict: "user_id,document_type_code" }
        );
      } else {
        console.error("Failed to upload signup Licence file:", uploadErr);
      }
    } catch (err) {
      console.error("Exception uploading signup Licence file:", err);
    }
  }

  await logAudit({
    action: "user.signup",
    entity_type: "user",
    entity_id: userId,
    user_id: userId,
    metadata: { 
      user_name: fullName, 
      user_email: email, 
      phone, 
      role: role, 
      shift_time: resolvedShiftTime || null,
      city, 
      district, 
      state: resolvedStateName, 
      state_id: resolvedStateId,
      location: `${city}, ${district}, ${resolvedStateName}`,
      has_aadhaar: !!aadhaarNumber,
      has_license: !!licenseNumber,
    },
  });

  return { message: "Signup successful! Your account is pending approval. You will be notified once an administrator approves your account." };
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
        error: "Password must contain at least one uppercase letter, one lowercase letter, and one number.",
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

    return { success: true };
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error("Exception in resetPasswordAction:", err);
    return { success: false, error: error?.message || "An unexpected error occurred." };
  }
}

