"use server";

import { revalidateTag, revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache";
import { logAudit } from "@/lib/audit";
import { OnboardingProfileSchema } from "@reachinternational/validation";
import { getStateById } from "@reachinternational/utils";

export interface OnboardingFormState {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  fieldValues?: Record<string, string>;
  redirectUrl?: string;
}

export async function completeOnboardingAction(
  prevState: OnboardingFormState,
  formData: FormData
): Promise<OnboardingFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: "Authentication session expired. Please log in again.",
    };
  }

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const full_name = (raw.full_name || "").trim();
  const phone = (raw.phone || "").trim();
  const role = (raw.role || "").trim();
  const shift_start_time = (raw.shift_start_time || "").trim();
  const shift_end_time = (raw.shift_end_time || "").trim();
  const shift_time = (raw.shift_time || "").trim() || (shift_start_time && shift_end_time ? `${shift_start_time} - ${shift_end_time}` : "");

  const city = (raw.city || "").trim();
  const district = (raw.district || "").trim();
  const address = (raw.address || "").trim();
  const stateIdRaw = raw.state_id;
  const state_id = stateIdRaw && !isNaN(Number(stateIdRaw)) ? Number(stateIdRaw) : null;
  const state = (raw.state || "").trim() || (state_id ? getStateById(state_id)?.name || "" : "");

  const aadhaar_number = (raw.aadhaar_number || "").trim();
  const license_number = (raw.license_number || "").trim();

  const fieldValues: Record<string, string> = {
    ...raw,
    full_name,
    phone,
    role,
    shift_time,
    shift_start_time,
    shift_end_time,
    city,
    district,
    address,
    state,
    state_id: state_id ? String(state_id) : "",
    aadhaar_number,
    license_number,
  };

  const validationResult = OnboardingProfileSchema.safeParse({
    full_name,
    phone,
    role,
    shift_time,
    shift_start_time,
    shift_end_time,
    city,
    district,
    state,
    state_id,
    address,
    aadhaar_number,
    license_number: license_number || null,
  });

  if (!validationResult.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validationResult.error.issues) {
      const fieldName = issue.path[0] as string;
      if (!fieldErrors[fieldName]) {
        fieldErrors[fieldName] = issue.message;
      }
    }
    return {
      error: "Please correct the highlighted fields before completing onboarding.",
      fieldErrors,
      fieldValues,
    };
  }

  const cleanAadhaar = aadhaar_number.replace(/\D/g, "");

  try {
    const { error: rpcError } = await supabase.rpc("complete_user_onboarding_atomic", {
      p_user_id: user.id,
      p_full_name: full_name,
      p_phone: phone,
      p_role: role,
      p_shift_time: shift_time,
      p_address: address,
      p_city: city,
      p_district: district,
      p_state: state,
      p_state_id: state_id,
      p_aadhaar_number: cleanAadhaar,
      p_license_number: license_number || null,
    });

    if (rpcError) {
      console.warn("[Onboarding] complete_user_onboarding_atomic RPC returned error, attempting direct table update via admin client:", rpcError.message);
      const adminClient = createSupabaseAdminClient();
      const { error: directError } = await adminClient
        .from("users")
        .update({
          full_name,
          phone,
          role: role || undefined,
          shift_time,
          address,
          city,
          district,
          state,
          state_id,
          aadhaar_number: cleanAadhaar,
          license_number: license_number || null,
          complete_profile: "yes",
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (directError) {
        console.error("[Onboarding] Direct table fallback failed:", directError);
        return {
          error: directError.message || "Failed to update user profile. Please try again.",
          fieldValues,
        };
      }
    }

    revalidateTag(CACHE_TAGS.users, "max");
    revalidatePath("/onboarding");
    revalidatePath("/machines");
    revalidatePath("/operations");

    try {
      await logAudit({
        user_id: user.id,
        action: "user.onboarding_completed",
        entity_type: "users",
        entity_id: user.id,
        metadata: {
          complete_profile: "yes",
          role,
          shift_time,
          city,
          district,
          state,
        },
      });
    } catch {
      // Non-fatal audit log catch
    }

    return {
      success: true,
      redirectUrl: role === "operator" ? "/operations?tab=entry" : "/machines",
    };
  } catch (err: any) {
    return {
      error: err?.message || "An unexpected error occurred. Please try again.",
      fieldValues,
    };
  }
}
