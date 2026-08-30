"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { validateAadhaarNumber, validateLicenseNumber } from "@reachinternational/utils";

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
    // Distinguish between unconfirmed email and invalid credentials
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        error: "Your email is not confirmed yet. Please wait for an administrator to approve your account.",
        fieldErrors: { email: "Email pending administrator confirmation." },
        fieldValues: { email },
      };
    }
    return {
      error: "Invalid email or password.",
      fieldErrors: { email: "Invalid email or password.", password: "Invalid email or password." },
      fieldValues: { email },
    };
  }

  // Check if user has a profile and is active — select minimal role and status columns
  const { data: profile } = await supabase
    .from("users")
    .select("role, status")
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

  if (profile.role === "operator") {
    redirect("/operations?tab=entry");
  }

  redirect("/machines");
}

function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    const s = Math.round(seconds);
    return s === 1 ? "1 minute" : `${s} minutes`;
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

  await supabase.auth.signOut();
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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.toLowerCase())) {
    return {
      error: "Please enter a valid email address.",
      fieldErrors: { email: "Please enter a valid email address." },
      fieldValues: { email },
    };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // SECURITY (F16): Use NEXT_PUBLIC_APP_URL for redirect, not the Supabase project URL
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || ""}/reset-password`,
  });

  if (error) {
    return {
      error: "Failed to send reset email. Please try again.",
      fieldErrors: { email: "Failed to send reset link." },
      fieldValues: { email },
    };
  }

  return { message: "Password reset link has been sent to your email." };
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
  const stateName = ((formData.get("state") as string) || "").trim();
  const aadhaarNumber = ((formData.get("aadhaar_number") as string) || "").trim();
  const licenseNumber = ((formData.get("license_number") as string) || "").trim();
  const password = (formData.get("password") as string) || "";
  const confirmPassword = (formData.get("confirm_password") as string) || "";
  const requestedRole = (formData.get("role") as string) || "operator";

  // SECURITY (F07): Only allow non-admin roles during self-registration signup.
  // Admin and super_admin roles must be explicitly assigned by existing admins post-approval.
  const allowedSignupRoles = [
    "service_engineer",
    "manager",
    "service_manager",
    "engineer",
    "supervisor",
    "store_manager",
    "operator",
    "mechanic",
    "hr_manager",
  ];

  const role = allowedSignupRoles.includes(requestedRole) ? requestedRole : "operator";

  const fieldValues = {
    full_name: fullName,
    email,
    phone,
    role,
    city,
    district,
    state: stateName,
    aadhaar_number: aadhaarNumber,
    license_number: licenseNumber,
    password,
    confirm_password: confirmPassword,
  };

  const fieldErrors: Record<string, string> = {};

  if (!fullName) fieldErrors.full_name = "Full name is required.";
  if (!email) fieldErrors.email = "Email address is required.";
  if (!phone) fieldErrors.phone = "Mobile number is required.";
  if (!city) fieldErrors.city = "City is required.";
  if (!district) fieldErrors.district = "District is required.";
  if (!stateName) fieldErrors.state = "State is required.";
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
        city,
        district,
        state: stateName,
        location: `${city}, ${district}, ${stateName}`,
        aadhaar_number: cleanAadhaar,
        license_number: formattedLicense,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
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

  // Use the existing admin client to fetch admin emails for notification
  const { data: adminUsers } = await adminSupabase
    .from("users")
    .select("email")
    .in("role", ["super_admin", "admin"])
    .eq("status", "active");

  // Send notification emails to admins
  if (adminUsers && adminUsers.length > 0) {
    const adminEmails = adminUsers.map((u) => u.email).filter((e): e is string => e !== null);

    // Import email functions dynamically to avoid circular dependencies
    const { sendPendingApprovalEmailToAdmins } = await import("@/lib/email");
    sendPendingApprovalEmailToAdmins(adminEmails, fullName, email, role).catch((err) =>
      console.error("Failed to send pending approval emails:", err)
    );
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
      city, 
      district, 
      state: stateName, 
      location: `${city}, ${district}, ${stateName}`,
      has_aadhaar: !!aadhaarNumber,
      has_license: !!licenseNumber,
    },
  });

  return { message: "Signup successful! Your account is pending approval. You will be notified once an administrator approves your account." };
}