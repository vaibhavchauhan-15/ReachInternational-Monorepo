"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/cache";
import { ProfileUpdateSchema } from "@reachinternational/validation";
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  validateBankAccountNumber,
  validateIfscCode,
  parseProfileShiftTime,
} from "@reachinternational/utils";
import type { UserRole, ProfileChangeRequest, User } from "@/lib/types/database";

export interface ProfileFormState {
  error?: string;
  message?: string;
  success?: boolean;
  instant?: boolean;
  pendingApproval?: boolean;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

async function resolveStateInfo(
  supabase: any,
  rawState?: string,
  rawStateId?: number | string | null
): Promise<{ state_id: number | null; state: string }> {
  const stateIdNum = rawStateId ? Number(rawStateId) : null;
  const stateName = (rawState || "").trim();

  if (stateIdNum && Number.isFinite(stateIdNum) && stateIdNum > 0) {
    const { data } = await supabase.from("states").select("id, name").eq("id", stateIdNum).maybeSingle();
    if (data) {
      return { state_id: data.id, state: data.name };
    }
  }

  if (stateName) {
    const { data } = await supabase.from("states").select("id, name").ilike("name", stateName).limit(1).maybeSingle();
    if (data) {
      return { state_id: data.id, state: data.name };
    }
    const lower = stateName.toLowerCase();
    if (["gujarat", "gujrat", "gujrati", "gujarati"].includes(lower)) return { state_id: 24, state: "Gujarat" };
    if (["up", "uttar pradesh", "utter pradesh", "uttar pardesh"].includes(lower)) return { state_id: 9, state: "Uttar Pradesh" };
    if (["assam", "aasam"].includes(lower)) return { state_id: 18, state: "Assam" };
    if (["madhya pradesh", "madhady pradesh", "mp"].includes(lower)) return { state_id: 23, state: "Madhya Pradesh" };
    if (["bihar"].includes(lower)) return { state_id: 10, state: "Bihar" };
    if (["maharashtra"].includes(lower)) return { state_id: 27, state: "Maharashtra" };
    if (["west bengal"].includes(lower)) return { state_id: 19, state: "West Bengal" };
    if (["delhi", "new delhi"].includes(lower)) return { state_id: 7, state: "Delhi" };
    if (["rajasthan"].includes(lower)) return { state_id: 8, state: "Rajasthan" };
    if (lower.includes("dad") || lower.includes("haveli")) return { state_id: 38, state: "Dadra and Nagar Haveli and Daman and Diu" };
  }

  return { state_id: stateIdNum, state: stateName };
}

/**
 * Determine if an approver has authority to review a request from a specific requester role.
 */
function canApproveProfileChange(approverRole: UserRole, requesterRole: UserRole): boolean {
  if (approverRole === "super_admin") return true;
  if (approverRole === "admin") {
    return requesterRole !== "super_admin" && requesterRole !== "admin";
  }
  if (["manager", "hr"].includes(approverRole)) {
    return !["super_admin", "admin", "manager", "hr"].includes(requesterRole);
  }
  return false;
}

/**
 * Target approver designation string for routing.
 */
function getTargetApproverRole(requesterRole: UserRole): string {
  if (requesterRole === "admin") return "super_admin";
  if (["manager", "hr"].includes(requesterRole)) return "admin";
  return "manager";
}

/**
 * Update Current User's Profile:
 * - Super Admin: Applied immediately to database without approval.
 * - Admin: Request created for Super Admin approval.
 * - Manager: Request created for Admin approval.
 * - Supervisor/Operator/Engineer: Request created for Manager/Admin approval.
 */
export async function updateMyProfile(formData: FormData): Promise<ProfileFormState> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { error: "Authentication required." };
    }

    const monthlySalaryRaw = formData.get("monthly_salary") as string | null;
    const monthly_salary = monthlySalaryRaw !== null && monthlySalaryRaw !== "" && !isNaN(Number(monthlySalaryRaw))
      ? Number(monthlySalaryRaw)
      : null;

    const shiftTimeRaw = (formData.get("shift_time") as string)?.trim() || null;
    let shiftStartRaw = (formData.get("shift_start_time") as string)?.trim() || null;
    let shiftEndRaw = (formData.get("shift_end_time") as string)?.trim() || null;

    if ((!shiftStartRaw || !shiftEndRaw) && shiftTimeRaw) {
      const parsedShift = parseProfileShiftTime(shiftTimeRaw);
      if (parsedShift) {
        shiftStartRaw = parsedShift.startTime;
        shiftEndRaw = parsedShift.endTime;
      }
    }

    const canEditRestricted = ["super_admin", "admin", "manager"].includes(currentUser.role);

    const fullNameRaw = (formData.get("full_name") as string)?.trim();
    const phoneRaw = (formData.get("phone") as string)?.trim();
    const emailRaw = (formData.get("email") as string)?.trim();

    let pendingDocuments: Record<string, any> = {};
    const pendingDocsRaw = formData.get("pending_documents") as string | null;
    if (pendingDocsRaw) {
      try {
        pendingDocuments = JSON.parse(pendingDocsRaw);
      } catch {
        pendingDocuments = {};
      }
    }

    const rawData = {
      full_name: fullNameRaw !== undefined && fullNameRaw !== "" ? fullNameRaw : currentUser.full_name,
      phone: phoneRaw !== undefined && phoneRaw !== "" ? phoneRaw : (currentUser.phone || ""),
      email: emailRaw !== undefined && emailRaw !== "" ? emailRaw : (currentUser.email || ""),
      shift_time: shiftTimeRaw,
      shift_start_time: shiftStartRaw,
      shift_end_time: shiftEndRaw,
      street: (formData.get("street") as string)?.trim() || (formData.get("address") as string)?.trim() || "",
      address: (formData.get("address") as string)?.trim() || (formData.get("street") as string)?.trim() || "",
      city: (formData.get("city") as string)?.trim() || currentUser.city || "",
      district: (formData.get("district") as string)?.trim() || currentUser.district || "",
      state: (formData.get("state") as string)?.trim() || currentUser.state || "",
      state_id: formData.get("state_id") ? Number(formData.get("state_id")) : currentUser.state_id,
      aadhaar_number: (formData.get("aadhaar_number") as string)?.trim() || currentUser.aadhaar_number || null,
      license_number: (formData.get("license_number") as string)?.trim() || currentUser.license_number || null,
      bank_account_number: (formData.get("bank_account_number") as string)?.trim() || currentUser.bank_account_number || null,
      bank_ifsc_code: (formData.get("bank_ifsc_code") as string)?.trim()?.toUpperCase() || currentUser.bank_ifsc_code || null,
      monthly_salary: currentUser.role === "super_admin" ? monthly_salary : (currentUser.monthly_salary ?? null),
    };

    const parsed = ProfileUpdateSchema.safeParse(rawData);
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]?.message || "Invalid input data.";
      return { error: firstErr };
    }

    const adminSupabase = createSupabaseAdminClient();

    // Validate unique phone against other users
    if (parsed.data.phone) {
      const digitsOnly = parsed.data.phone.replace(/\D/g, "");
      const { data: existingPhoneUsers } = await adminSupabase
        .from("users")
        .select("id, phone")
        .neq("id", currentUser.id)
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
    }

    // Validate unique email against other users if email provided and changed
    if (parsed.data.email && parsed.data.email.toLowerCase() !== (currentUser.email || "").toLowerCase()) {
      const { data: existingEmailUser } = await adminSupabase
        .from("users")
        .select("id")
        .neq("id", currentUser.id)
        .ilike("email", parsed.data.email.toLowerCase())
        .maybeSingle();

      if (existingEmailUser) {
        return { error: "Another user account with this email address already exists." };
      }
    }

    // Validate Aadhaar number
    let cleanAadhaar: string | null = null;
    if (parsed.data.aadhaar_number) {
      const aadhaarResult = validateAadhaarNumber(parsed.data.aadhaar_number);
      if (!aadhaarResult.isValid) {
        return { error: aadhaarResult.error || "Invalid Aadhaar number." };
      }
      cleanAadhaar = aadhaarResult.clean || null;

      if (cleanAadhaar) {
        const { data: existingAadhaar } = await adminSupabase
          .from("users")
          .select("id")
          .neq("id", currentUser.id)
          .eq("aadhaar_number", cleanAadhaar)
          .maybeSingle();

        if (existingAadhaar) {
          return { error: "Another user account with this Aadhaar number already exists." };
        }
      }
    }

    // Validate Driving Licence
    let formattedLicense: string | null = null;
    if (parsed.data.license_number) {
      const licResult = validateLicenseNumber(parsed.data.license_number);
      if (!licResult.isValid) {
        return { error: licResult.error || "Invalid driving licence number." };
      }
      formattedLicense = licResult.formatted || parsed.data.license_number.trim().toUpperCase();

      const { data: existingLic } = await adminSupabase
        .from("users")
        .select("id")
        .neq("id", currentUser.id)
        .ilike("license_number", licResult.clean || parsed.data.license_number.trim())
        .maybeSingle();

      if (existingLic) {
        return { error: "Another user account with this driving licence number already exists." };
      }
    }

    // Validate Bank Details if provided
    let cleanBankAccount: string | null = null;
    if (parsed.data.bank_account_number) {
      const bankResult = validateBankAccountNumber(parsed.data.bank_account_number);
      if (!bankResult.isValid) {
        return { error: bankResult.error || "Invalid bank account number." };
      }
      cleanBankAccount = bankResult.clean || null;
    }

    let cleanIfsc: string | null = null;
    if (parsed.data.bank_ifsc_code) {
      const ifscResult = validateIfscCode(parsed.data.bank_ifsc_code);
      if (!ifscResult.isValid) {
        return { error: ifscResult.error || "Invalid IFSC code." };
      }
      cleanIfsc = ifscResult.clean || parsed.data.bank_ifsc_code.trim().toUpperCase();
    }

    // Enforce supporting document requirement for changes to banking information
    const isBankDetailsModified =
      (Boolean(cleanBankAccount) && cleanBankAccount !== (currentUser.bank_account_number || null)) ||
      (Boolean(cleanIfsc) && cleanIfsc !== (currentUser.bank_ifsc_code || null));

    if (isBankDetailsModified) {
      const hasBankDocInRequest = Boolean(
        pendingDocuments?.bank_document || pendingDocuments?.bank_passbook
      );
      const { data: existingBankDoc } = await adminSupabase
        .from("user_documents")
        .select("id")
        .eq("user_id", currentUser.id)
        .in("document_type_code", ["bank_document", "bank_passbook"])
        .maybeSingle();

      if (!hasBankDocInRequest && !existingBankDoc) {
        return {
          error: "Supporting document (Bank passbook or cancelled cheque) is required when updating banking details.",
        };
      }
    }

    const stateInfo = await resolveStateInfo(adminSupabase, parsed.data.state, parsed.data.state_id);
    const resolvedStreet = (parsed.data.street || parsed.data.address || "").trim() || null;

    // 1. Always update Personal Information directly on public.users
    const personalUpdateData: Record<string, any> = {
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      street: resolvedStreet,
      address: resolvedStreet,
      city: parsed.data.city,
      district: parsed.data.district,
      state: stateInfo.state,
      state_id: stateInfo.state_id,
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.email) {
      personalUpdateData.email = parsed.data.email.toLowerCase();
    }

    const { error: personalUpdateError } = await adminSupabase
      .from("users")
      .update(personalUpdateData)
      .eq("id", currentUser.id);

    if (personalUpdateError) {
      console.error("Error updating personal details on user profile:", personalUpdateError);
      return { error: "Failed to update personal details. Please try again." };
    }

    // Update auth metadata & email in auth.users
    const authUpdatePayload: Record<string, any> = {
      user_metadata: {
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
        location: `${parsed.data.city || currentUser.city || ""}, ${parsed.data.district || currentUser.district || ""}, ${stateInfo.state || currentUser.state || ""}`,
      },
    };
    if (parsed.data.email && parsed.data.email.toLowerCase() !== (currentUser.email || "").toLowerCase()) {
      authUpdatePayload.email = parsed.data.email.toLowerCase();
    }

    await adminSupabase.auth.admin.updateUserById(currentUser.id, authUpdatePayload);

    // Sync employees directory if present
    try {
      await adminSupabase
        .from("employees")
        .update({
          full_name: parsed.data.full_name,
          phone: parsed.data.phone,
          ...(parsed.data.email ? { email: parsed.data.email.toLowerCase() } : {}),
        })
        .eq("user_id", currentUser.id);
    } catch (empErr) {
      console.warn("Employee record sync note:", empErr);
    }

    // Check if user also provided banking or identity changes or replacement documents
    const hasIdentityChanges =
      (Boolean(cleanAadhaar) && cleanAadhaar !== (currentUser.aadhaar_number || null)) ||
      (Boolean(formattedLicense) && formattedLicense !== (currentUser.license_number || null)) ||
      Boolean(pendingDocuments?.aadhaar) ||
      Boolean(pendingDocuments?.driving_license);

    const hasBankChanges =
      isBankDetailsModified ||
      Boolean(pendingDocuments?.bank_document) ||
      Boolean(pendingDocuments?.bank_passbook);

    // Case A: Super Admin can apply banking and identity updates directly
    if (currentUser.role === "super_admin") {
      const superAdminUpdate: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (cleanAadhaar) superAdminUpdate.aadhaar_number = cleanAadhaar;
      if (formattedLicense) superAdminUpdate.license_number = formattedLicense;
      if (cleanBankAccount) superAdminUpdate.bank_account_number = cleanBankAccount;
      if (cleanIfsc) superAdminUpdate.bank_ifsc_code = cleanIfsc;

      if (Object.keys(superAdminUpdate).length > 1) {
        await adminSupabase.from("users").update(superAdminUpdate).eq("id", currentUser.id);
      }

      // Directly promote any uploaded documents
      for (const [docCode, docInfo] of Object.entries(pendingDocuments)) {
        if (docInfo && docInfo.storage_path) {
          await adminSupabase.from("user_documents").upsert(
            {
              user_id: currentUser.id,
              document_type_code: docCode,
              storage_path: docInfo.storage_path,
              mime_type: docInfo.mime_type || "application/octet-stream",
              file_size_bytes: docInfo.file_size_bytes || 0,
              file_name: docInfo.file_name || docInfo.storage_path.split("/").pop(),
              status: "verified",
              uploaded_by: currentUser.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,document_type_code" }
          );
        }
      }

      await logAudit({
        action: "user.profile_updated",
        entity_type: "user",
        entity_id: currentUser.id,
        user_id: currentUser.id,
        metadata: {
          full_name: parsed.data.full_name,
          phone: parsed.data.phone,
          email: parsed.data.email,
          updated_by: currentUser.email,
        },
      });

      revalidatePath("/");
      revalidatePath("/profile");
      revalidatePath("/profile/edit");
      revalidatePath("/users");
      revalidateTag(CACHE_TAGS.users, "max");

      return {
        success: true,
        instant: true,
        message: "Your profile details have been updated successfully.",
      };
    }

    // Case B: Non-Super Admin submitting Banking, Identity, or Document changes
    // These require approval. Keep existing approved documents active until approved.
    if (hasBankChanges || hasIdentityChanges) {
      const targetApproverRole = getTargetApproverRole(currentUser.role);
      const requestPayload = {
        bank_account_number: cleanBankAccount || currentUser.bank_account_number || null,
        bank_ifsc_code: cleanIfsc || currentUser.bank_ifsc_code || null,
        aadhaar_number: cleanAadhaar || currentUser.aadhaar_number || null,
        license_number: formattedLicense || currentUser.license_number || null,
        documents: pendingDocuments,
      };

      const currentSnapshot: Partial<User> = {
        full_name: currentUser.full_name,
        phone: currentUser.phone,
        email: currentUser.email,
        aadhaar_number: currentUser.aadhaar_number,
        license_number: currentUser.license_number,
        bank_account_number: currentUser.bank_account_number,
        bank_ifsc_code: currentUser.bank_ifsc_code,
      };

      const { data: existingRequest } = await adminSupabase
        .from("profile_change_requests")
        .select("id")
        .eq("user_id", currentUser.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existingRequest) {
        await adminSupabase
          .from("profile_change_requests")
          .update({
            requested_data: requestPayload,
            target_approver_role: targetApproverRole,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRequest.id);
      } else {
        await adminSupabase
          .from("profile_change_requests")
          .insert({
            user_id: currentUser.id,
            requester_role: currentUser.role,
            current_data: currentSnapshot,
            requested_data: requestPayload,
            target_approver_role: targetApproverRole,
            status: "pending",
          });
      }

      const approverLabel =
        targetApproverRole === "super_admin"
          ? "Super Admin"
          : targetApproverRole === "admin"
          ? "Administrator"
          : "Manager";

      await logAudit({
        action: "user.profile_change_requested",
        entity_type: "profile_change_request",
        entity_id: currentUser.id,
        user_id: currentUser.id,
        metadata: {
          requested_fields: requestPayload,
          target_approver_role: targetApproverRole,
          requester_name: currentUser.full_name,
          requester_email: currentUser.email,
          requester_role: currentUser.role,
        },
      });

      revalidatePath("/");
      revalidatePath("/profile");
      revalidatePath("/profile/edit");
      revalidatePath("/users");
      revalidateTag(CACHE_TAGS.users, "max");

      return {
        success: true,
        pendingApproval: true,
        message: `Personal details saved. Banking and identity updates submitted for management approval by ${approverLabel}. Existing approved documents remain active until approved.`,
      };
    }

    // Case C: Personal information only was updated
    await logAudit({
      action: "user.profile_updated",
      entity_type: "user",
      entity_id: currentUser.id,
      user_id: currentUser.id,
      metadata: {
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        updated_by: currentUser.email,
      },
    });

    revalidatePath("/");
    revalidatePath("/profile");
    revalidatePath("/profile/edit");
    revalidatePath("/users");
    revalidateTag(CACHE_TAGS.users, "max");

    return {
      success: true,
      instant: true,
      message: "Your personal details have been updated successfully.",
    };
  } catch (error) {
    console.error("Error in updateMyProfile:", error);
    return { error: "An unexpected error occurred while updating profile." };
  }
}

/**
 * Fetch current user's active pending profile change request (if any).
 */
export async function getMyPendingProfileChangeRequest(): Promise<ProfileChangeRequest | null> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("profile_change_requests")
      .select("*")
      .eq("user_id", currentUser.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (error || !data) return null;
    return data as ProfileChangeRequest;
  } catch (err) {
    console.error("Error in getMyPendingProfileChangeRequest:", err);
    return null;
  }
}

/**
 * Cancel own pending profile change request.
 */
export async function cancelMyProfileChangeRequest(requestId: string): Promise<ProfileFormState> {
  if (!isValidUuid(requestId)) return { error: "Invalid request ID." };

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { error: "Authentication required." };

    const adminSupabase = createSupabaseAdminClient();
    const { data: req, error: fetchErr } = await adminSupabase
      .from("profile_change_requests")
      .select("id, user_id, status")
      .eq("id", requestId)
      .maybeSingle();

    if (fetchErr || !req) return { error: "Request not found." };
    if (req.user_id !== currentUser.id) return { error: "Unauthorized." };
    if (req.status !== "pending") return { error: "Request is no longer pending." };

    const { error: cancelErr } = await adminSupabase
      .from("profile_change_requests")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (cancelErr) return { error: "Failed to cancel request." };

    revalidatePath("/users");
    revalidateTag(CACHE_TAGS.users, "max");
    return { message: "Profile change request has been cancelled." };
  } catch (err) {
    console.error("Error in cancelMyProfileChangeRequest:", err);
    return { error: "An unexpected error occurred." };
  }
}

/**
 * Approve a profile detail change request based on role hierarchy.
 */
export async function approveProfileChangeRequest(requestId: string): Promise<ProfileFormState> {
  if (!isValidUuid(requestId)) return { error: "Invalid request ID format." };

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { error: "Authentication required." };

    const adminSupabase = createSupabaseAdminClient();

    // 1. Fetch the request details
    const { data: request, error: fetchErr } = await adminSupabase
      .from("profile_change_requests")
      .select("*, user:users!profile_change_requests_user_id_fkey(*)")
      .eq("id", requestId)
      .maybeSingle();

    if (fetchErr || !request) {
      return { error: "Profile change request not found." };
    }

    if (request.status !== "pending") {
      return { error: `Request is already ${request.status}.` };
    }

    // 2. Enforce hierarchy check
    if (!canApproveProfileChange(currentUser.role, request.requester_role)) {
      return { error: "You do not have authorization to approve profile changes for this role." };
    }

    const requestedData = request.requested_data || {};
    const targetUserId = request.user_id;

    // 3. Apply changes to public.users selectively
    const userUpdatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (requestedData.full_name !== undefined && requestedData.full_name !== null) {
      userUpdatePayload.full_name = requestedData.full_name;
    }
    if (requestedData.phone !== undefined) {
      userUpdatePayload.phone = requestedData.phone || null;
    }
    if (requestedData.street !== undefined || requestedData.address !== undefined) {
      userUpdatePayload.street = requestedData.street || requestedData.address || null;
    }
    if (requestedData.city !== undefined) userUpdatePayload.city = requestedData.city;
    if (requestedData.district !== undefined) userUpdatePayload.district = requestedData.district;
    if (requestedData.state !== undefined) userUpdatePayload.state = requestedData.state;
    if (requestedData.state_id !== undefined) userUpdatePayload.state_id = requestedData.state_id || null;
    if (requestedData.aadhaar_number !== undefined) userUpdatePayload.aadhaar_number = requestedData.aadhaar_number || null;
    if (requestedData.license_number !== undefined) userUpdatePayload.license_number = requestedData.license_number || null;
    if (requestedData.bank_account_number !== undefined) userUpdatePayload.bank_account_number = requestedData.bank_account_number || null;
    if (requestedData.bank_ifsc_code !== undefined) userUpdatePayload.bank_ifsc_code = requestedData.bank_ifsc_code || null;
    if (requestedData.shift_start_time) userUpdatePayload.shift_start_time = requestedData.shift_start_time;
    if (requestedData.shift_end_time) userUpdatePayload.shift_end_time = requestedData.shift_end_time;

    if (Object.keys(userUpdatePayload).length > 1) {
      const { error: userUpdateErr } = await adminSupabase
        .from("users")
        .update(userUpdatePayload)
        .eq("id", targetUserId);

      if (userUpdateErr) {
        console.error("Error updating user table upon profile approval:", userUpdateErr);
        return { error: "Failed to apply profile changes to user account." };
      }
    }

    // 4. Promote any approved pending replacement documents to user_documents with verified status
    if (requestedData.documents && typeof requestedData.documents === "object") {
      for (const [docCode, docInfo] of Object.entries(requestedData.documents as Record<string, any>)) {
        if (docInfo && docInfo.storage_path) {
          const docUpsertPayload = {
            user_id: targetUserId,
            document_type_code: docCode,
            storage_path: docInfo.storage_path,
            mime_type: docInfo.mime_type || "application/octet-stream",
            file_size_bytes: docInfo.file_size_bytes || 0,
            file_name: docInfo.file_name || docInfo.storage_path.split("/").pop(),
            status: "verified",
            uploaded_by: targetUserId,
            verified_by: currentUser.id,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { error: docUpsertErr } = await adminSupabase
            .from("user_documents")
            .upsert(docUpsertPayload, { onConflict: "user_id,document_type_code" });

          if (docUpsertErr) {
            console.error(`Error promoting document ${docCode} upon approval:`, docUpsertErr);
          }
        }
      }
    }

    // 5. Update auth user metadata if personal data changed
    if (requestedData.full_name || requestedData.phone || requestedData.city) {
      await adminSupabase.auth.admin.updateUserById(targetUserId, {
        user_metadata: {
          ...userUpdatePayload,
          location: `${requestedData.city || ""}, ${requestedData.district || ""}, ${requestedData.state || ""}`,
        },
      });
    }

    // 6. Sync employees table if linked
    if (requestedData.full_name || requestedData.phone) {
      try {
        await adminSupabase
          .from("employees")
          .update({
            ...(requestedData.full_name ? { full_name: requestedData.full_name.trim() } : {}),
            ...(requestedData.phone ? { phone: requestedData.phone } : {}),
          })
          .eq("user_id", targetUserId);
      } catch (empErr) {
        console.warn("Employee directory sync note:", empErr);
      }
    }

    // 7. Mark request as approved
    const { error: reqApproveErr } = await adminSupabase
      .from("profile_change_requests")
      .update({
        status: "approved",
        reviewed_by: currentUser.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (reqApproveErr) {
      console.error("Error updating profile request status:", reqApproveErr);
    }

    // 7. Structured audit logging
    await logAudit({
      action: "user.profile_change_approved",
      entity_type: "profile_change_request",
      entity_id: requestId,
      user_id: currentUser.id,
      metadata: {
        target_user_id: targetUserId,
        target_user_email: request.user?.email,
        target_user_name: request.user?.full_name,
        requester_role: request.requester_role,
        applied_changes: requestedData,
        approved_by_id: currentUser.id,
        approved_by_name: currentUser.full_name,
        approved_by_email: currentUser.email,
        approved_by_role: currentUser.role,
      },
    });

    revalidatePath("/profile");
    revalidatePath("/users");
    revalidateTag(CACHE_TAGS.users, "max");
    revalidateTag(CACHE_TAGS.dashboard, "max");

    return {
      success: true,
      message: `Profile changes for ${request.user?.full_name || "user"} have been approved and applied.`,
    };
  } catch (error) {
    console.error("Error in approveProfileChangeRequest:", error);
    return { error: "An unexpected error occurred during profile approval." };
  }
}

/**
 * Reject a profile detail change request.
 */
export async function rejectProfileChangeRequest(requestId: string, reason?: string): Promise<ProfileFormState> {
  if (!isValidUuid(requestId)) return { error: "Invalid request ID format." };

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { error: "Authentication required." };

    const adminSupabase = createSupabaseAdminClient();

    const { data: request, error: fetchErr } = await adminSupabase
      .from("profile_change_requests")
      .select("*, user:users!profile_change_requests_user_id_fkey(*)")
      .eq("id", requestId)
      .maybeSingle();

    if (fetchErr || !request) {
      return { error: "Profile change request not found." };
    }

    if (request.status !== "pending") {
      return { error: `Request is already ${request.status}.` };
    }

    if (!canApproveProfileChange(currentUser.role, request.requester_role)) {
      return { error: "You do not have authorization to reject profile changes for this role." };
    }

    const rejectionReasonText = reason?.trim() || "Profile detail update request was rejected by reviewer.";

    const { error: rejectErr } = await adminSupabase
      .from("profile_change_requests")
      .update({
        status: "rejected",
        reviewed_by: currentUser.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReasonText,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (rejectErr) {
      console.error("Error rejecting profile change request:", rejectErr);
      return { error: "Failed to reject request." };
    }

    await logAudit({
      action: "user.profile_change_rejected",
      entity_type: "profile_change_request",
      entity_id: requestId,
      user_id: currentUser.id,
      metadata: {
        target_user_id: request.user_id,
        target_user_name: request.user?.full_name,
        target_user_email: request.user?.email,
        requester_role: request.requester_role,
        rejection_reason: rejectionReasonText,
        rejected_by_id: currentUser.id,
        rejected_by_name: currentUser.full_name,
        rejected_by_email: currentUser.email,
        rejected_by_role: currentUser.role,
      },
    });

    revalidatePath("/users");
    revalidateTag(CACHE_TAGS.users, "max");

    return {
      success: true,
      message: `Profile change request for ${request.user?.full_name || "user"} has been rejected.`,
    };
  } catch (error) {
    console.error("Error in rejectProfileChangeRequest:", error);
    return { error: "An unexpected error occurred." };
  }
}

/**
 * Bulk approve multiple profile change requests in parallel.
 */
export async function bulkApproveProfileChangeRequests(requestIds: string[]): Promise<{
  successCount?: number;
  failedCount?: number;
  message?: string;
  error?: string;
}> {
  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    return { error: "No requests provided." };
  }

  try {
    const validIds = requestIds.filter((id) => isValidUuid(id));
    if (validIds.length === 0) return { error: "Invalid request IDs." };

    let successCount = 0;
    let failedCount = 0;

    for (const id of validIds) {
      const res = await approveProfileChangeRequest(id);
      if (res.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    return {
      successCount,
      failedCount,
      message: `Successfully approved ${successCount} profile change request${successCount > 1 ? "s" : ""}.`,
    };
  } catch (err) {
    console.error("Error in bulkApproveProfileChangeRequests:", err);
    return { error: "An error occurred during bulk profile approval." };
  }
}

/**
 * Bulk reject multiple profile change requests in parallel.
 */
export async function bulkRejectProfileChangeRequests(
  requestIds: string[],
  reason?: string
): Promise<{
  successCount?: number;
  failedCount?: number;
  message?: string;
  error?: string;
}> {
  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    return { error: "No requests provided." };
  }

  try {
    const validIds = requestIds.filter((id) => isValidUuid(id));
    if (validIds.length === 0) return { error: "Invalid request IDs." };

    let successCount = 0;
    let failedCount = 0;

    for (const id of validIds) {
      const res = await rejectProfileChangeRequest(id, reason);
      if (res.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    return {
      successCount,
      failedCount,
      message: `Successfully rejected ${successCount} profile change request${successCount > 1 ? "s" : ""}.`,
    };
  } catch (err) {
    console.error("Error in bulkRejectProfileChangeRequests:", err);
    return { error: "An error occurred during bulk profile rejection." };
  }
}
