"use server";

import { revalidatePath, revalidateTag } from "next/cache";
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
import type { User, UserRole } from "@/lib/types/database";

export interface UserFormState {
  error?: string;
  message?: string;
}

// Generate a random password
function generateRandomPassword(length = 12): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Get all users (admin only) — includes assigned branch details
export async function getAllUsers(): Promise<User[]> {
  await requireRole("admin", "super_admin");
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, phone, role, status, branch_id, created_at, branch:branches!users_branch_id_fkey(id, code, name, city, state)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching users:", error.message || error);
    return [];
  }

  return (data as unknown as User[]) || [];
}

// Get pending users — includes assigned branch details
export async function getPendingUsers(): Promise<User[]> {
  await requireRole("admin", "super_admin");
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, phone, role, status, branch_id, created_at, branch:branches!users_branch_id_fkey(id, code, name, city, state)")
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
  try {
    const user = await requireRole("admin", "super_admin");
    const supabase = await createSupabaseServerClient();

    // Get user details before approval
    const { data: targetUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError || !targetUser) {
      return { error: "User not found." };
    }

    if (targetUser.status !== "pending") {
      return { error: "User is not pending approval." };
    }

    // Update user status to active using admin client to bypass RLS
    const adminSupabase = createSupabaseAdminClient();
    const { error: updateError } = await adminSupabase
      .from("users")
      .update({ status: "active" })
      .eq("id", userId);

    if (updateError) {
      console.error("Error approving user:", updateError);
      return { error: "Failed to approve user. Please try again." };
    }

    // Confirm the user's email in auth.users so they can log in.
    const { error: confirmError } = await adminSupabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });

    if (confirmError) {
      console.error("Error confirming user email:", confirmError);
    }

    // Send approval email
    const targetUserEmail = targetUser.email;
    if (targetUserEmail) {
      sendApprovalEmail(targetUserEmail, targetUser.full_name).catch((err) =>
        console.error("Failed to send approval email:", err)
      );
    }

    await logAudit({
      action: "user.approved",
      entity_type: "user",
      entity_id: userId,
      user_id: user.id,
      metadata: { 
        user_email: targetUserEmail, 
        user_name: targetUser.full_name,
        approved_by_id: user.id,
        approved_by_name: user.full_name,
        approved_by_email: user.email,
        approved_by_role: user.role,
      },
    });

    revalidatePath("/users");
    revalidateTag(CACHE_TAGS.users, "max");
    revalidateTag(CACHE_TAGS.machineMeta, "max");
    return { message: `User ${targetUser.full_name} has been approved.` };
  } catch (error) {
    console.error("Error in approveUser:", error);
    return { error: "Unauthorized or an error occurred." };
  }
}

// Reject user (admin only)
export async function rejectUser(userId: string): Promise<UserFormState> {
  try {
    const user = await requireRole("admin", "super_admin");
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

    if (targetUser.status !== "pending") {
      return { error: "Only pending users can be rejected." };
    }

    // Delete from auth.users (this will cascade to users table)
    const adminSupabase = createSupabaseAdminClient();
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error rejecting user:", deleteError);
      return { error: "Failed to reject user. Please try again." };
    }

    // Send rejection email
    const targetUserEmail = targetUser.email;
    if (targetUserEmail) {
      sendRejectionEmail(targetUserEmail, targetUser.full_name).catch((err) =>
        console.error("Failed to send rejection email:", err)
      );
    }

    await logAudit({
      action: "user.rejected",
      entity_type: "user",
      entity_id: userId,
      user_id: user.id,
      metadata: { 
        user_email: targetUserEmail, 
        user_name: targetUser.full_name,
        rejected_by_id: user.id,
        rejected_by_name: user.full_name,
        rejected_by_email: user.email,
        rejected_by_role: user.role,
      },
    });

    revalidatePath("/users");
    revalidateTag(CACHE_TAGS.users, "max");
    revalidateTag(CACHE_TAGS.machineMeta, "max");
    return { message: `User ${targetUser.full_name} has been rejected.` };
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
    const phone = formData.get("phone") as string;
    const branchId = formData.get("branch_id") as string;
    const location = formData.get("location") as string;

    if (!fullName || !email || !password || !role) {
      return { error: "Name, email, password and role fields are required." };
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

    // Create user with admin client
    const adminSupabase = createSupabaseAdminClient();
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: role,
        phone: phone || null,
        branch_id: branchId && branchId !== "none" ? branchId : null,
        location: location || null,
      },
    });

    if (error) {
      console.error("Error creating user:", error);
      if (error.message.includes("already registered")) {
        return { error: "A user with this email already exists." };
      }
      return { error: "Failed to create user. Please try again." };
    }

    if (!data.user) {
      return { error: "Failed to create user. Please try again." };
    }

    // Update the status to active and sync role, phone, and branch_id
    const { error: updateError } = await supabase
      .from("users")
      .update({
        status: "active",
        role: role,
        phone: phone || null,
        branch_id: branchId && branchId !== "none" ? branchId : null,
      })
      .eq("id", data.user.id);

    if (updateError) {
      console.error("Error updating user status:", updateError);
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
        branch_id: branchId || null,
        location: location || null,
        created_by: currentUser.email,
        created_by_name: currentUser.full_name,
        created_by_role: currentUser.role,
      },
    });

    revalidatePath("/users");
    revalidateTag(CACHE_TAGS.users, "max");
    revalidateTag(CACHE_TAGS.machineMeta, "max");
    return { message: `User ${fullName} has been created successfully.` };
  } catch (error) {
    console.error("Error in createUser:", error);
    return { error: "Unauthorized or an error occurred." };
  }
}

// Reset user password (admin only)
export async function resetUserPassword(userId: string): Promise<{ formState: UserFormState; newPassword?: string }> {
  try {
    const currentUser = await requireRole("admin", "super_admin");
    const supabase = await createSupabaseServerClient();
    const adminSupabase = createSupabaseAdminClient();

    // Get user details
    const { data: targetUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError || !targetUser) {
      return { formState: { error: "User not found." } };
    }

    // Generate new password
    const newPassword = generateRandomPassword();

    // Update password using admin client
    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      console.error("Error resetting password:", updateError);
      return { formState: { error: "Failed to reset password. Please try again." } };
    }

    // Send password reset notification
    await sendPasswordResetNotification(targetUser.email, targetUser.full_name, newPassword);

    await logAudit({
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
    });

    revalidatePath("/users");
    return { formState: { message: `Password for ${targetUser.full_name} has been reset.` }, newPassword };
  } catch (error) {
    console.error("Error in resetUserPassword:", error);
    return { formState: { error: "Unauthorized or an error occurred." } };
  }
}

// Toggle user status (admin only)
export async function toggleUserStatus(userId: string): Promise<UserFormState> {
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

    const fullName = formData.get("full_name") as string;
    const phone = formData.get("phone") as string;
    const branchId = formData.get("branch_id") as string;
    const role = formData.get("role") as UserRole;
    const location = formData.get("location") as string;
    
    if (!fullName) {
      return { error: "Full name is required." };
    }

    const adminSupabase = createSupabaseAdminClient();
    
    // Update auth user metadata
    const { error: authError } = await adminSupabase.auth.admin.updateUserById(userId, {
      user_metadata: { 
        full_name: fullName, 
        phone: phone || null,
        location: location || null,
        ...(role ? { role } : {}),
        ...(branchId ? { branch_id: branchId === "none" ? null : branchId } : {}),
      }
    });
    
    if (authError) {
      console.error("Error updating user auth metadata:", authError);
      return { error: "Failed to update user details. Please try again." };
    }
    
    const updatePayload: Record<string, unknown> = {
      full_name: fullName,
      phone: phone || null,
      branch_id: branchId && branchId !== "none" ? branchId : null,
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

    await logAudit({
      action: "user.edited",
      entity_type: "user",
      entity_id: userId,
      user_id: currentUser.id,
      metadata: { 
        user_email: targetUser.email,
        user_name: targetUser.full_name,
        branch_id: branchId || null,
        location: location || null,
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