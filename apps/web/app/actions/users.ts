"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/cache";
import {
  sendWelcomeEmail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendPasswordResetNotification,
} from "@/lib/email";
import { validateAadhaarNumber, validateLicenseNumber } from "@reachinternational/utils";
import type { User, UserRole } from "@/lib/types/database";

export interface UserFormState {
  error?: string;
  message?: string;
}

/**
 * Generates a human-friendly, secure temporary password formatted as:
 * `<UserFirstName>@<4DigitRandomNumber>` (e.g. "Vaibhav@2026", "Aman@8341")
 */
function generateUserFormattedPassword(fullName?: string): string {
  const rawFirst = (fullName || "").trim().split(/\s+/)[0] || "User";
  const cleaned = rawFirst.replace(/[^a-zA-Z0-9]/g, "");
  const firstName = cleaned
    ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    : "User";
  const randomNum = crypto.randomInt(1000, 10000);
  return `${firstName}@${randomNum}`;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

// Get all users (admin only)
export async function getAllUsers(): Promise<User[]> {
  await requireRole("admin", "super_admin", "service_manager", "hr_manager");
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, phone, role, status, city, district, state, aadhaar_number, license_number, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching users:", error.message || error);
    return [];
  }

  return (data as unknown as User[]) || [];
}

// Get pending users
export async function getPendingUsers(): Promise<User[]> {
  await requireRole("admin", "super_admin", "service_manager", "hr_manager");
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, phone, role, status, city, district, state, aadhaar_number, license_number, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching pending users:", error.message || error);
    return [];
  }

  return (data as unknown as User[]) || [];
}

// Approve user (admin only)
export async function approveUser(userId: string): Promise<UserFormState> {
  if (!isValidUuid(userId)) {
    return { error: "Invalid user ID format." };
  }
  try {
    const user = await requireRole("admin", "super_admin");
    const adminSupabase = createSupabaseAdminClient();

    // 1. Atomically update status to active and fetch required fields in 1 single round-trip
    const { data: updatedUser, error: updateError } = await adminSupabase
      .from("users")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("status", "pending")
      .select("id, full_name, email, phone, role, status")
      .maybeSingle();

    if (updateError) {
      console.error("Error approving user:", updateError);
      return { error: "Failed to approve user. Please try again." };
    }

    if (!updatedUser) {
      // User is either not found or already active/processed
      const { data: existingUser } = await adminSupabase
        .from("users")
        .select("id, status, full_name")
        .eq("id", userId)
        .maybeSingle();

      if (!existingUser) {
        return { error: "User not found." };
      }
      if (existingUser.status === "active") {
        return { message: `User ${existingUser.full_name} is already active.` };
      }
      return { error: `User is not pending approval (current status: ${existingUser.status}).` };
    }

    const empCode = `EMP-${crypto.randomInt(1000, 10000)}`;
    const designationLabel = (updatedUser.role || "operator")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());

    // 2. Parallelize auth confirmation, employee directory sync, and audit logging
    await Promise.all([
      // Confirm user email in Supabase auth so they can log in
      adminSupabase.auth.admin.updateUserById(userId, { email_confirm: true }).catch((confirmErr) => {
        console.error("Error confirming user email in auth:", confirmErr);
      }),

      // Synchronize into public.employees directory table
      (async () => {
        try {
          await adminSupabase.from("employees").insert({
            employee_code: empCode,
            full_name: updatedUser.full_name?.trim(),
            user_id: updatedUser.id,
            phone: updatedUser.phone || null,
            email: updatedUser.email?.trim(),
            designation: designationLabel,
            status: "active",
          });
        } catch (empErr: any) {
          console.warn("Note: employees directory sync on approval skipped or existing:", empErr?.message || empErr);
        }
      })(),

      // Structured audit logging
      logAudit({
        action: "user.approved",
        entity_type: "user",
        entity_id: userId,
        user_id: user.id,
        metadata: {
          user_email: updatedUser.email,
          user_name: updatedUser.full_name,
          role: updatedUser.role,
          approved_by: user.email,
          approved_by_name: user.full_name,
        },
      }).catch((auditErr) => {
        console.error("Error logging user approval audit:", auditErr);
      }),
    ]);

    // 3. Send approval email in background without blocking action latency
    if (updatedUser.email) {
      sendApprovalEmail(updatedUser.email, updatedUser.full_name).catch((emailErr) =>
        console.error("Failed to send approval email in background:", emailErr)
      );
    }

    // 4. Invalidate relevant caches
    revalidatePath("/users");
    revalidateTag(CACHE_TAGS.users, "max");
    revalidateTag(CACHE_TAGS.dashboard, "max");
    revalidateTag(CACHE_TAGS.machineMeta, "max");

    return { message: `User ${updatedUser.full_name} has been approved.` };
  } catch (error) {
    console.error("Error in approveUser:", error);
    return { error: "Unauthorized or an error occurred." };
  }
}

// Reject user (admin only)
export async function rejectUser(userId: string): Promise<UserFormState> {
  if (!isValidUuid(userId)) {
    return { error: "Invalid user ID format." };
  }
  try {
    const user = await requireRole("admin", "super_admin");
    const adminSupabase = createSupabaseAdminClient();

    // 1. Get user details before deletion with targeted selective projection
    const { data: targetUser, error: fetchError } = await adminSupabase
      .from("users")
      .select("id, full_name, email, role, status")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError || !targetUser) {
      return { error: "User not found." };
    }

    if (targetUser.status !== "pending") {
      return { error: "Only pending users can be rejected." };
    }

    // 2. Delete from auth.users (cascades to public.users table)
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error rejecting user:", deleteError);
      return { error: "Failed to reject user. Please try again." };
    }

    const targetUserEmail = targetUser.email;
    const targetUserName = targetUser.full_name;

    // 3. Parallel audit log & background rejection email
    await Promise.all([
      logAudit({
        action: "user.rejected",
        entity_type: "user",
        entity_id: userId,
        user_id: user.id,
        metadata: {
          user_email: targetUserEmail,
          user_name: targetUserName,
          rejected_by_id: user.id,
          rejected_by_name: user.full_name,
          rejected_by_email: user.email,
          rejected_by_role: user.role,
        },
      }).catch((auditErr) => {
        console.error("Error logging user rejection audit:", auditErr);
      }),
    ]);

    if (targetUserEmail) {
      sendRejectionEmail(targetUserEmail, targetUserName).catch((emailErr) =>
        console.error("Failed to send rejection email in background:", emailErr)
      );
    }

    revalidatePath("/users");
    revalidateTag(CACHE_TAGS.users, "max");
    revalidateTag(CACHE_TAGS.machineMeta, "max");

    return { message: `User ${targetUserName} has been rejected.` };
  } catch (error) {
    console.error("Error in rejectUser:", error);
    return { error: "Unauthorized or an error occurred." };
  }
}

// Create user (admin only)
export async function createUser(formData: FormData): Promise<UserFormState> {
  try {
    const currentUser = await requireRole("admin", "super_admin");
    const supabase = await createSupabaseServerClient();
    
    const fullName = formData.get("full_name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as UserRole;
    const phone = (formData.get("phone") as string)?.trim() || "";
    const city = (formData.get("city") as string)?.trim() || "";
    const district = (formData.get("district") as string)?.trim() || "";
    const state = (formData.get("state") as string)?.trim() || "";
    const aadhaarNumber = (formData.get("aadhaar_number") as string)?.trim() || "";
    const licenseNumber = (formData.get("license_number") as string)?.trim() || "";

    if (!fullName || !email || !password || !role || !phone) {
      return { error: "Full name, email, mobile number, password, and role fields are required." };
    }

    if (!city || !district || !state) {
      return { error: "City, District, and State are required address fields." };
    }

    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      return { error: "Please enter a valid 10-digit mobile number." };
    }

    // Role validation: super_admin can create any role; admin can create any role except super_admin
    if (currentUser.role !== "super_admin" && role === "super_admin") {
      return { error: "Only Super Admins can assign the Super Admin role." };
    }

    // Validate Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return { error: "Please enter a valid email address." };
    }

    const adminSupabase = createSupabaseAdminClient();

    // 1. Database check for duplicate email
    const { data: existingEmailUser } = await adminSupabase
      .from("users")
      .select("id")
      .ilike("email", email.trim())
      .maybeSingle();

    if (existingEmailUser) {
      return { error: "A user account with this email address already exists." };
    }

    // 2. Database check for duplicate phone number
    const { data: existingPhoneUsers } = await adminSupabase
      .from("users")
      .select("id, phone")
      .not("phone", "is", null);

    const hasDuplicatePhone = existingPhoneUsers?.some((u) => {
      if (!u.phone) return false;
      const uDigits = u.phone.replace(/\D/g, "");
      if (digitsOnly.length >= 10 && uDigits.length >= 10) {
        return digitsOnly.slice(-10) === uDigits.slice(-10);
      }
      return digitsOnly === uDigits;
    });

    if (hasDuplicatePhone) {
      return { error: "A user account with this mobile number already exists." };
    }

    // 3. Aadhaar validation & duplicate check
    let cleanAadhaar: string | null = null;
    if (aadhaarNumber) {
      const aadhaarResult = validateAadhaarNumber(aadhaarNumber);
      if (!aadhaarResult.isValid) {
        return { error: aadhaarResult.error || "Please enter a valid 12-digit Aadhaar number." };
      }
      cleanAadhaar = aadhaarResult.clean || null;

      if (cleanAadhaar) {
        const { data: existingAadhaar } = await adminSupabase
          .from("users")
          .select("id")
          .eq("aadhaar_number", cleanAadhaar)
          .maybeSingle();

        if (existingAadhaar) {
          return { error: "A user account with this Aadhaar number already exists." };
        }
      }
    }

    // 4. Driving Licence validation & duplicate check
    let formattedLicense: string | null = null;
    if (licenseNumber) {
      const licResult = validateLicenseNumber(licenseNumber);
      if (!licResult.isValid) {
        return { error: licResult.error || "Please enter a valid driving licence number." };
      }
      formattedLicense = licResult.formatted || licenseNumber.trim().toUpperCase();

      const { data: existingLic } = await adminSupabase
        .from("users")
        .select("id")
        .ilike("license_number", licResult.clean || licenseNumber.trim())
        .maybeSingle();

      if (existingLic) {
        return { error: "A user account with this driving licence number already exists." };
      }
    }

    // Create user with admin client (default status: active, no admin approval required)
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: role,
        phone: phone || null,
        city,
        district,
        state,
        location: `${city}, ${district}, ${state}`,
        aadhaar_number: cleanAadhaar,
        license_number: formattedLicense,
        status: "active",
      },
    });

    if (error) {
      console.error("Error creating user:", error);
      const msg = error.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("already exists")) {
        return { error: "A user account with this email or mobile number already exists." };
      }
      return { error: "Failed to create user. Please try again." };
    }

    if (!data.user) {
      return { error: "Failed to create user. Please try again." };
    }

    // Update status to active and sync role, phone, city, district, state, aadhaar_number, license_number
    const { error: updateError } = await adminSupabase
      .from("users")
      .update({
        status: "active",
        role: role,
        phone: phone || null,
        city,
        district,
        state,
        aadhaar_number: cleanAadhaar,
        license_number: formattedLicense,
      })
      .eq("id", data.user.id);

    if (updateError) {
      console.error("Error updating user profile:", updateError);
    }

    // Synchronize user account into public.employees directory table
    const empCode = `EMP-${crypto.randomInt(1000, 10000)}`;
    const designationLabel = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    try {
      await adminSupabase
        .from("employees")
        .insert({
          employee_code: empCode,
          full_name: fullName.trim(),
          user_id: data.user.id,
          phone: phone || null,
          email: email.trim(),
          designation: designationLabel,
          status: "active",
        });
    } catch (empErr: any) {
      console.warn("Note: employees directory record sync skipped or existing:", empErr?.message || empErr);
    }

    // Send welcome email with credentials
    await sendWelcomeEmail(email, fullName, password);

    await logAudit({
      action: "user.created",
      entity_type: "user",
      entity_id: data.user.id,
      user_id: currentUser.id,
      metadata: { 
        user_email: email, 
        user_name: fullName,
        role: role,
        city,
        district,
        state,
        location: `${city}, ${district}, ${state}`,
        created_by: currentUser.email,
        created_by_name: currentUser.full_name,
        created_by_role: currentUser.role,
      },
    });

    revalidatePath("/users");
    revalidateTag(CACHE_TAGS.users, "max");
    revalidateTag(CACHE_TAGS.machineMeta, "max");
    return { message: `User ${fullName} has been created successfully with active access. Credentials sent to email.` };
  } catch (error) {
    console.error("Error in createUser:", error);
    return { error: "Unauthorized or an error occurred." };
  }
}

// Reset user password (admin only)
export async function resetUserPassword(userId: string): Promise<{ formState: UserFormState; newPassword?: string }> {
  if (!isValidUuid(userId)) {
    return { formState: { error: "Invalid user ID format." } };
  }
  try {
    const currentUser = await requireRole("admin", "super_admin");
    const adminSupabase = createSupabaseAdminClient();

    // 1. Get user details with targeted selective projection
    const { data: targetUser, error: fetchError } = await adminSupabase
      .from("users")
      .select("id, full_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError || !targetUser) {
      return { formState: { error: "User not found." } };
    }

    // 2. Generate formatted password: userfirstname@random4digitnumber (e.g. "Vaibhav@2026")
    const newPassword = generateUserFormattedPassword(targetUser.full_name);

    // 3. Update password in auth database using admin client
    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      console.error("Error resetting password:", updateError);
      return { formState: { error: "Failed to reset password. Please try again." } };
    }

    // 4. Send background notification & audit logging asynchronously (non-blocking for high speed)
    if (targetUser.email) {
      sendPasswordResetNotification(targetUser.email, targetUser.full_name, newPassword).catch((emailErr) =>
        console.error("Failed to send password reset email in background:", emailErr)
      );
    }

    logAudit({
      action: "user.password_reset",
      entity_type: "user",
      entity_id: userId,
      user_id: currentUser.id,
      metadata: { 
        user_email: targetUser.email,
        user_name: targetUser.full_name,
        reset_by: currentUser.email,
        reset_by_name: currentUser.full_name,
      },
    }).catch((auditErr) => {
      console.error("Error logging password reset audit:", auditErr);
    });

    revalidatePath("/users");
    revalidateTag(CACHE_TAGS.users, "max");
    return { 
      formState: { message: `Password for ${targetUser.full_name} has been reset successfully.` },
      newPassword,
    };
  } catch (error) {
    console.error("Error in resetUserPassword:", error);
    return { formState: { error: "Unauthorized or an error occurred." } };
  }
}

// Toggle user status (admin only)
export async function toggleUserStatus(userId: string): Promise<UserFormState> {
  if (!isValidUuid(userId)) {
    return { error: "Invalid user ID format." };
  }
  try {
    const currentUser = await requireRole("admin", "super_admin");
    const supabase = await createSupabaseServerClient();

    // Get current user details
    const { data: targetUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError || !targetUser) {
      return { error: "User not found." };
    }

    // Prevent admin from deactivating themselves
    if (targetUser.id === currentUser.id) {
      return { error: "You cannot change your own status." };
    }

    // Prevent admin from changing status of super_admins
    if (currentUser.role === "admin" && targetUser.role === "super_admin") {
      return { error: "Only Super Admins can modify Super Admin accounts." };
    }

    // Toggle status
    const newStatus = targetUser.status === "active" ? "inactive" : "active";

    const adminSupabase = createSupabaseAdminClient();
    const { error: updateError } = await adminSupabase
      .from("users")
      .update({ status: newStatus })
      .eq("id", userId);

    if (updateError) {
      console.error("Error toggling user status:", updateError);
      return { error: "Failed to update user status. Please try again." };
    }

    // Sync status with public.employees directory table if linked
    try {
      await adminSupabase
        .from("employees")
        .update({ status: newStatus === "active" ? "active" : "inactive" })
        .eq("user_id", userId);
    } catch (empErr: any) {
      console.warn("Note: employees directory status update skipped:", empErr?.message || empErr);
    }

    const action = newStatus === "active" ? "activated" : "deactivated";

    await logAudit({
      action: newStatus === "active" ? "user.activated" : "user.deactivated",
      entity_type: "user",
      entity_id: userId,
      user_id: currentUser.id,
      metadata: { 
        user_email: targetUser.email,
        user_name: targetUser.full_name,
        performed_by_id: currentUser.id,
        performed_by_name: currentUser.full_name,
        performed_by_email: currentUser.email,
        performed_by_role: currentUser.role,
        new_status: newStatus
      },
    });

    revalidatePath("/users");
    revalidateTag(CACHE_TAGS.users, "max");
    revalidateTag(CACHE_TAGS.machineMeta, "max");
    return { message: `User ${targetUser.full_name} has been ${action}.` };
  } catch (error) {
    console.error("Error in toggleUserStatus:", error);
    return { error: "Unauthorized or an error occurred." };
  }
}

// Update user role (admin/super_admin)
export async function updateUserRole(userId: string, newRole: UserRole): Promise<UserFormState> {
  if (!isValidUuid(userId)) {
    return { error: "Invalid user ID format." };
  }
  try {
    const currentUser = await requireRole("admin", "super_admin");
    const supabase = await createSupabaseServerClient();

    // Get user details
    const { data: targetUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError || !targetUser) {
      return { error: "User not found." };
    }

    if (targetUser.id === currentUser.id) {
      return { error: "You cannot change your own role." };
    }

    if (currentUser.role !== "super_admin" && (newRole === "super_admin" || targetUser.role === "super_admin")) {
      return { error: "Only Super Admins can assign or modify Super Admin roles." };
    }

    const adminSupabase = createSupabaseAdminClient();
    const { error: updateError } = await adminSupabase
      .from("users")
      .update({ role: newRole })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating user role:", updateError);
      return { error: "Failed to update user role. Please try again." };
    }

    await logAudit({
      action: "user.role_updated",
      entity_type: "user",
      entity_id: userId,
      user_id: currentUser.id,
      metadata: { 
        user_email: targetUser.email,
        user_name: targetUser.full_name,
        old_role: targetUser.role,
        new_role: newRole,
        updated_by_name: currentUser.full_name,
        updated_by_email: currentUser.email,
      },
    });

    revalidatePath("/users");
    revalidateTag(CACHE_TAGS.users, "max");
    revalidateTag(CACHE_TAGS.machineMeta, "max");
    return { message: `User ${targetUser.full_name}'s role has been updated to ${newRole}.` };
  } catch (error) {
    console.error("Error in updateUserRole:", error);
    return { error: "Unauthorized or an error occurred." };
  }
}

// Delete user (admin can delete non-super_admins, super_admin can delete anyone except self)
export async function deleteUser(userId: string): Promise<UserFormState> {
  if (!isValidUuid(userId)) {
    return { error: "Invalid user ID format." };
  }
  try {
    const currentUser = await requireRole("admin", "super_admin");
    const supabase = await createSupabaseServerClient();

    // Get user details before deletion
    const { data: targetUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError || !targetUser) {
      return { error: "User not found." };
    }

    // Prevent deleting self
    if (targetUser.id === currentUser.id) {
      return { error: "You cannot delete your own account." };
    }

    // Role check: admin cannot delete super_admin
    if (currentUser.role === "admin" && targetUser.role === "super_admin") {
      return { error: "Only Super Admins can delete Super Admin accounts." };
    }

    // Delete from auth.users using admin client
    const adminSupabase = createSupabaseAdminClient();
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return { error: "Failed to delete user. Please try again." };
    }

    await logAudit({
      action: "user.deleted",
      entity_type: "user",
      entity_id: userId,
      user_id: currentUser.id,
      metadata: { 
        user_email: targetUser.email,
        user_name: targetUser.full_name,
        role: targetUser.role,
        deleted_by_name: currentUser.full_name,
        deleted_by_email: currentUser.email,
      },
    });

    revalidatePath("/users");
    revalidateTag(CACHE_TAGS.users, "max");
    revalidateTag(CACHE_TAGS.machineMeta, "max");
    return { message: `User ${targetUser.full_name} has been deleted.` };
  } catch (error) {
    console.error("Error in deleteUser:", error);
    return { error: "Unauthorized or an error occurred." };
  }
}

// Edit user details
export async function editUser(userId: string, formData: FormData): Promise<UserFormState> {
  if (!isValidUuid(userId)) {
    return { error: "Invalid user ID format." };
  }
  try {
    const currentUser = await requireRole("admin", "super_admin");
    const supabase = await createSupabaseServerClient();
    
    // Get user details
    const { data: targetUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError || !targetUser) {
      return { error: "User not found." };
    }

    if (currentUser.role === "admin" && targetUser.role === "super_admin") {
      return { error: "Only Super Admins can edit Super Admin accounts." };
    }

    const fullName = (formData.get("full_name") as string)?.trim() || "";
    const phone = (formData.get("phone") as string)?.trim() || "";
    const role = formData.get("role") as UserRole;
    const city = (formData.get("city") as string)?.trim() || "";
    const district = (formData.get("district") as string)?.trim() || "";
    const state = (formData.get("state") as string)?.trim() || "";
    const aadhaarNumber = (formData.get("aadhaar_number") as string)?.trim() || "";
    const licenseNumber = (formData.get("license_number") as string)?.trim() || "";
    
    if (!fullName) {
      return { error: "Full name is required." };
    }

    if (!phone) {
      return { error: "Mobile number is required." };
    }

    if (!role) {
      return { error: "User access role is required." };
    }

    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      return { error: "Please enter a valid 10-digit mobile number." };
    }

    if (!city || !district || !state) {
      return { error: "City, District, and State are required address fields." };
    }

    const adminSupabase = createSupabaseAdminClient();

    // Check duplicate mobile number for other user accounts (id != userId)
    const { data: existingPhoneUsers } = await adminSupabase
      .from("users")
      .select("id, phone")
      .neq("id", userId)
      .not("phone", "is", null);

    const hasDuplicatePhone = existingPhoneUsers?.some((u) => {
      if (!u.phone) return false;
      const uDigits = u.phone.replace(/\D/g, "");
      if (digitsOnly.length >= 10 && uDigits.length >= 10) {
        return digitsOnly.slice(-10) === uDigits.slice(-10);
      }
      return digitsOnly === uDigits;
    });

    if (hasDuplicatePhone) {
      return { error: "Another user account with this mobile number already exists." };
    }

    // Validate Aadhaar & Licence
    let cleanAadhaar: string | null = null;
    if (aadhaarNumber) {
      const aadhaarResult = validateAadhaarNumber(aadhaarNumber);
      if (!aadhaarResult.isValid) {
        return { error: aadhaarResult.error || "Please enter a valid 12-digit Aadhaar number." };
      }
      cleanAadhaar = aadhaarResult.clean || null;

      if (cleanAadhaar) {
        const { data: existingAadhaar } = await adminSupabase
          .from("users")
          .select("id")
          .neq("id", userId)
          .eq("aadhaar_number", cleanAadhaar)
          .maybeSingle();

        if (existingAadhaar) {
          return { error: "Another user account with this Aadhaar number already exists." };
        }
      }
    }

    let formattedLicense: string | null = null;
    if (licenseNumber) {
      const licResult = validateLicenseNumber(licenseNumber);
      if (!licResult.isValid) {
        return { error: licResult.error || "Please enter a valid driving licence number." };
      }
      formattedLicense = licResult.formatted || licenseNumber.trim().toUpperCase();

      const { data: existingLic } = await adminSupabase
        .from("users")
        .select("id")
        .neq("id", userId)
        .ilike("license_number", licResult.clean || licenseNumber.trim())
        .maybeSingle();

      if (existingLic) {
        return { error: "Another user account with this driving licence number already exists." };
      }
    }
    
    // Update auth user metadata
    const { error: authError } = await adminSupabase.auth.admin.updateUserById(userId, {
      user_metadata: { 
        full_name: fullName, 
        phone: phone || null,
        city,
        district,
        state,
        location: `${city}, ${district}, ${state}`,
        aadhaar_number: cleanAadhaar,
        license_number: formattedLicense,
        ...(role ? { role } : {}),
      }
    });
    
    if (authError) {
      console.error("Error updating user auth metadata:", authError);
      return { error: "Failed to update user details. Please try again." };
    }
    
    const updatePayload: Record<string, unknown> = {
      full_name: fullName,
      phone: phone || null,
      city,
      district,
      state,
      aadhaar_number: cleanAadhaar,
      license_number: formattedLicense,
    };
    if (role && (currentUser.role === "super_admin" || role !== "super_admin")) {
      updatePayload.role = role;
    }

    // Update public.users
    const { error: updateError } = await adminSupabase
      .from("users")
      .update(updatePayload)
      .eq("id", userId);
      
    if (updateError) {
      console.error("Error updating user profile:", updateError);
      return { error: "Failed to update user profile. Please try again." };
    }

    // Sync changes with public.employees directory table if linked
    try {
      const empUpdatePayload: Record<string, unknown> = {
        full_name: fullName.trim(),
        phone: phone || null,
      };
      if (role) {
        empUpdatePayload.designation = role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      }
      await adminSupabase
        .from("employees")
        .update(empUpdatePayload)
        .eq("user_id", userId);
    } catch (empErr: any) {
      console.warn("Note: employees directory edit sync skipped:", empErr?.message || empErr);
    }

    await logAudit({
      action: "user.edited",
      entity_type: "user",
      entity_id: userId,
      user_id: currentUser.id,
      metadata: { 
        user_email: targetUser.email,
        user_name: targetUser.full_name,
        city,
        district,
        state,
        location: `${city}, ${district}, ${state}`,
        role: role || targetUser.role,
        updated_by_name: currentUser.full_name,
        updated_by: currentUser.email,
      },
    });
    
    revalidatePath("/users");
    revalidateTag(CACHE_TAGS.users, "max");
    revalidateTag(CACHE_TAGS.machineMeta, "max");
    return { message: `User ${fullName} has been updated successfully.` };
  } catch (error) {
    console.error("Error in editUser:", error);
    return { error: "Unauthorized or an error occurred." };
  }
}

export interface BulkDeleteResult {
  successCount?: number;
  failedCount?: number;
  error?: string;
  message?: string;
}

// Bulk delete users (admin/super_admin)
export async function bulkDeleteUsers(userIds: string[]): Promise<BulkDeleteResult> {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return { error: "No users selected for deletion." };
  }

  try {
    const currentUser = await requireRole("admin", "super_admin");
    const supabase = await createSupabaseServerClient();
    const adminSupabase = createSupabaseAdminClient();

    // 1. Sanitize IDs
    const validIds = userIds.filter((id) => isValidUuid(id));
    if (validIds.length === 0) {
      return { error: "Invalid user ID list provided." };
    }

    // 2. Fetch users to be deleted
    const { data: targetUsers, error: fetchError } = await supabase
      .from("users")
      .select("id, full_name, email, role")
      .in("id", validIds);

    if (fetchError || !targetUsers || targetUsers.length === 0) {
      return { error: "No matching users found to delete." };
    }

    // 3. Filter out protected accounts (cannot delete self; if admin, cannot delete super_admin)
    const deletableUsers = targetUsers.filter((u) => {
      if (u.id === currentUser.id) return false;
      if (currentUser.role === "admin" && u.role === "super_admin") return false;
      return true;
    });

    if (deletableUsers.length === 0) {
      return { error: "None of the selected users can be deleted (cannot delete self or protected Super Admin accounts)." };
    }

    const deletableIds = deletableUsers.map((u) => u.id);

    // 4. Parallel delete from auth.users (cascades to public.users)
    const deleteResults = await Promise.allSettled(
      deletableIds.map((id) => adminSupabase.auth.admin.deleteUser(id))
    );

    let successCount = 0;
    let failedCount = 0;
    const deletedUserEmails: string[] = [];

    deleteResults.forEach((res, idx) => {
      if (res.status === "fulfilled" && !res.value.error) {
        successCount++;
        deletedUserEmails.push(deletableUsers[idx].email);
      } else {
        failedCount++;
        console.error(`Failed to delete user ${deletableUsers[idx].id}:`, res.status === "fulfilled" ? res.value.error : res.reason);
      }
    });

    // Also cleanup any linked employee profiles
    try {
      if (deletableIds.length > 0) {
        await adminSupabase
          .from("employees")
          .delete()
          .in("user_id", deletableIds);
      }
    } catch (empErr) {
      console.warn("Bulk employee cleanup warning:", empErr);
    }

    // 5. Structured Audit Logging
    await logAudit({
      action: "users.bulk_deleted",
      entity_type: "user",
      entity_id: currentUser.id,
      user_id: currentUser.id,
      metadata: {
        requested_count: userIds.length,
        deleted_count: successCount,
        failed_count: failedCount,
        deleted_emails: deletedUserEmails,
        deleted_by_name: currentUser.full_name,
        deleted_by_email: currentUser.email,
        deleted_by_role: currentUser.role,
      },
    });

    revalidatePath("/users");
    revalidateTag(CACHE_TAGS.users, "max");
    revalidateTag(CACHE_TAGS.machineMeta, "max");

    if (successCount === 0) {
      return { error: "Failed to delete the selected users. Please try again." };
    }

    const msg = failedCount > 0
      ? `Successfully deleted ${successCount} user${successCount > 1 ? "s" : ""}. ${failedCount} user${failedCount > 1 ? "s" : ""} could not be deleted.`
      : `Successfully deleted ${successCount} user${successCount > 1 ? "s" : ""}.`;

    return {
      successCount,
      failedCount,
      message: msg,
    };
  } catch (error) {
    console.error("Error in bulkDeleteUsers:", error);
    return { error: "Unauthorized or an error occurred while deleting users." };
  }
}
