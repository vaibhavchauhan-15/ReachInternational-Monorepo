"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import {
  createClient,
  updateClient,
  deactivateClient,
  restoreClient,
  searchClients,
  type SearchClientsOptions,
  getClientList,
  type PaginatedClientsResponse,
} from "@/lib/data/clients";
import {
  type ClientDirectoryFilter,
  getClientShiftPresetById,
} from "@reachinternational/utils";
import type { CRMClient } from "@/lib/types/database";

export interface ClientFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  client?: CRMClient;
}

/**
 * Server Action: Create a new Client in database (public.clients)
 * Delegates core mutation, validation, audit logging, and cache invalidation to client-mutations.ts
 */
export async function createClientAction(state: ClientFormState, formData: FormData): Promise<ClientFormState> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required. Please log in to perform this action." };
    }

    const isBillingDiff =
      formData.get("isBillingAddressDifferent") === "true" ||
      formData.get("isBillingAddressDifferent") === "on";

    const rawStreet =
      (formData.get("street") as string)?.trim() ||
      (formData.get("address") as string)?.trim() ||
      "";

    const payload = {
      companyName:
        (formData.get("companyName") as string)?.trim() ||
        (formData.get("clientName") as string)?.trim() ||
        "",
      contactPerson: (formData.get("contactPerson") as string)?.trim() || "",
      phone: (formData.get("phone") as string)?.trim() || "",
      gstin: ((formData.get("gstin") as string)?.trim() || "").toUpperCase(),
      panNumber: ((formData.get("panNumber") as string)?.trim() || "").toUpperCase(),
      street: rawStreet,
      address: rawStreet,
      city: (formData.get("city") as string)?.trim() || "",
      district: (formData.get("district") as string)?.trim() || "",
      state: (formData.get("state") as string)?.trim() || "",
      pincode: (formData.get("pincode") as string)?.trim() || "",
      isBillingAddressDifferent: isBillingDiff,
      billingAddress: isBillingDiff ? (formData.get("billingAddress") as string)?.trim() || "" : "",
      billingCity: isBillingDiff ? (formData.get("billingCity") as string)?.trim() || "" : "",
      billingDistrict: isBillingDiff ? (formData.get("billingDistrict") as string)?.trim() || "" : "",
      billingState: isBillingDiff ? (formData.get("billingState") as string)?.trim() || "" : "",
      billingPincode: isBillingDiff ? (formData.get("billingPincode") as string)?.trim() || "" : "",
      status: ((formData.get("status") as string) || "active") as "active" | "inactive",
      maintenanceAllowanceMinutes: parseInt((formData.get("maintenanceAllowanceMinutes") as string) || "0", 10) || 0,
    };

    const result = await createClient(payload, user.id);

    if (!result.success) {
      return {
        error: result.error,
        fieldErrors: result.fieldErrors,
      };
    }

    // Provision industry shift template preset if selected
    const presetId =
      (formData.get("shift_preset") as string)?.trim() ||
      (formData.get("shiftPreset") as string)?.trim() ||
      "";
    if (presetId && presetId !== "none" && result.client?.id) {
      const preset = getClientShiftPresetById(presetId);
      if (preset && preset.shifts.length > 0) {
        const adminSupabase = createSupabaseAdminClient();
        const shiftRecords = preset.shifts.map((s) => ({
          client_id: result.client!.id,
          code: s.code,
          name: s.name,
          start_time: s.startTime,
          end_time: s.endTime,
          scheduled_minutes: s.scheduledMinutes,
          normal_minutes: s.normalMinutes,
          crosses_midnight: s.crossesMidnight,
          display_order: s.displayOrder,
          is_active: true,
          updated_at: new Date().toISOString(),
        }));
        await adminSupabase.from("client_shift_codes").insert(shiftRecords);
      }
    }

    revalidatePath("/clients");

    return { success: true, client: result.client };
  } catch (err: any) {
    console.error("createClientAction exception:", err);
    return { error: err.message || "An unexpected error occurred while adding client details." };
  }
}

/**
 * Server Action: Update existing Client in database
 * Delegates core mutation, validation, audit logging, and cache invalidation to client-mutations.ts
 */
export async function updateClientAction(state: ClientFormState, formData: FormData): Promise<ClientFormState> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required. Please log in to perform this action." };
    }

    const id = (formData.get("id") as string)?.trim();
    if (!id) {
      return { error: "Valid Client ID is required for update." };
    }

    const rawStreet =
      (formData.get("street") as string)?.trim() ||
      (formData.get("address") as string)?.trim() ||
      "";

    const isBillingDiff =
      formData.get("isBillingAddressDifferent") === "true" ||
      formData.get("isBillingAddressDifferent") === "on";

    const payload = {
      id,
      companyName:
        (formData.get("companyName") as string)?.trim() ||
        (formData.get("clientName") as string)?.trim() ||
        "",
      contactPerson: (formData.get("contactPerson") as string)?.trim() || "",
      phone: (formData.get("phone") as string)?.trim() || "",
      gstin: ((formData.get("gstin") as string)?.trim() || "").toUpperCase(),
      panNumber: ((formData.get("panNumber") as string)?.trim() || "").toUpperCase(),
      street: rawStreet,
      address: rawStreet,
      city: (formData.get("city") as string)?.trim() || "",
      district: (formData.get("district") as string)?.trim() || "",
      state: (formData.get("state") as string)?.trim() || "",
      pincode: (formData.get("pincode") as string)?.trim() || "",
      isBillingAddressDifferent: isBillingDiff,
      billingAddress: isBillingDiff ? (formData.get("billingAddress") as string)?.trim() || "" : "",
      billingCity: isBillingDiff ? (formData.get("billingCity") as string)?.trim() || "" : "",
      billingDistrict: isBillingDiff ? (formData.get("billingDistrict") as string)?.trim() || "" : "",
      billingState: isBillingDiff ? (formData.get("billingState") as string)?.trim() || "" : "",
      billingPincode: isBillingDiff ? (formData.get("billingPincode") as string)?.trim() || "" : "",
      status: ((formData.get("status") as string) || "active") as "active" | "inactive",
      maintenanceAllowanceMinutes: parseInt((formData.get("maintenanceAllowanceMinutes") as string) || "0", 10) || 0,
    };

    const result = await updateClient(payload, user.id);

    if (!result.success) {
      return {
        error: result.error,
        fieldErrors: result.fieldErrors,
      };
    }

    revalidatePath(`/clients/${id}`);
    revalidatePath("/clients");

    return { success: true, client: result.client };
  } catch (err: any) {
    console.error("updateClientAction exception:", err);
    return { error: err.message || "An unexpected error occurred while updating client details." };
  }
}

/**
 * Server Action: Soft delete Client in database (deleted_at = NOW(), status = 'inactive')
 */
export async function softDeleteClientAction(clientId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required. Please log in to perform this action." };
    }

    const result = await deactivateClient(clientId, user.id);
    if (!result.success) {
      return { error: result.error };
    }

    return { success: true };
  } catch (err: any) {
    console.error("softDeleteClientAction exception:", err);
    return { error: err.message || "An unexpected error occurred while soft deleting client." };
  }
}

/**
 * Server Action: Restore a soft-deleted Client record (deleted_at = null, status = 'active')
 */
export async function restoreClientAction(clientId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required. Please log in to perform this action." };
    }

    const result = await restoreClient(clientId, user.id);
    if (!result.success) {
      return { error: result.error };
    }

    return { success: true };
  } catch (err: any) {
    console.error("restoreClientAction exception:", err);
    return { error: err.message || "An unexpected error occurred while restoring client." };
  }
}

const AUTHORIZED_CLIENT_ROLES = ["super_admin", "admin", "manager", "supervisor"] as const;

/**
 * Server Action: Search clients using server-side 8-dimension GIN trigram indexes.
 * Returns strictly max 10 rows (configurable up to 50), cached for 60s via React cache() and unstable_cache.
 */
export async function searchClientsAction(
  query: string,
  options?: SearchClientsOptions
): Promise<{ success: boolean; data: CRMClient[]; error?: string }> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, data: [], error: "Authentication required." };
    }

    if (!AUTHORIZED_CLIENT_ROLES.includes(user.role as any)) {
      return { success: false, data: [], error: "Unauthorized: Insufficient permissions to search clients." };
    }

    const clean = (query || "").trim();
    if (!clean) {
      return { success: true, data: [] };
    }

    const data = await searchClients(clean, {
      ...options,
      limit: Math.min(options?.limit ?? 10, 50),
    });

    return { success: true, data };
  } catch (err: any) {
    console.error("searchClientsAction exception:", err);
    return {
      success: false,
      data: [],
      error: err.message || "An unexpected error occurred while searching clients.",
    };
  }
}

/**
 * Server Action: Fetch paginated and filtered client list on demand.
 * Enables 0ms client-side cache transitions and on-demand tab loading (Milestone C9).
 */
export async function getClientListAction(
  filter?: ClientDirectoryFilter
): Promise<{ success: boolean; data?: PaginatedClientsResponse; error?: string }> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    if (!AUTHORIZED_CLIENT_ROLES.includes(user.role as any)) {
      return { success: false, error: "Unauthorized: Insufficient permissions to view client directory." };
    }

    const data = await getClientList(filter);
    return { success: true, data };
  } catch (err: any) {
    console.error("getClientListAction exception:", err);
    return {
      success: false,
      error: err.message || "Failed to load client directory data.",
    };
  }
}

/**
 * Server Action: Fetch active and inactive shift codes for a specific client
 */
export async function getClientShiftCodesAction(
  clientId: string
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("client_shift_codes")
      .select("*")
      .eq("client_id", clientId)
      .order("display_order", { ascending: true })
      .order("code", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch shift codes." };
  }
}

/**
 * Server Action: Create or update a client shift code
 */
export async function upsertClientShiftCodeAction(
  input: any
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    if (!["super_admin", "admin", "manager"].includes(user.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions to configure shift codes." };
    }

    const supabase = createSupabaseAdminClient();

    const record = {
      client_id: input.clientId,
      code: input.code.toUpperCase().trim(),
      name: input.name ? input.name.trim() : `Shift ${input.code.toUpperCase().trim()}`,
      start_time: input.startTime,
      end_time: input.endTime,
      crosses_midnight: Boolean(input.crossesMidnight),
      scheduled_minutes: Number(input.scheduledMinutes),
      normal_minutes: Number(input.normalMinutes),
      display_order: Number(input.displayOrder || 0),
      is_active: input.isActive ?? true,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (input.id) {
      // Fetch existing record to detect code rename or timing changes
      const { data: existing } = await supabase
        .from("client_shift_codes")
        .select("code, name, start_time, end_time, crosses_midnight")
        .eq("id", input.id)
        .maybeSingle();

      const { data, error } = await supabase
        .from("client_shift_codes")
        .update(record)
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      result = data;

      // If code was renamed (e.g. 'A' -> 'A1'), cascade update all active operator machine assignments
      if (existing && existing.code !== record.code) {
        const { data: clientMachines } = await supabase
          .from("machines")
          .select("id")
          .eq("client_id", input.clientId);

        if (clientMachines && clientMachines.length > 0) {
          const mIds = clientMachines.map((m: any) => m.id);
          await supabase
            .from("operator_machine_assignments")
            .update({
              shift_code: record.code,
              shift_start_time: record.start_time,
              shift_end_time: record.end_time,
            })
            .in("machine_id", mIds)
            .eq("shift_code", existing.code);
        }
      } else if (
        existing &&
        (existing.start_time !== record.start_time ||
          existing.end_time !== record.end_time)
      ) {
        // Timings updated without code rename: cascade new timings to active assignments
        const { data: clientMachines } = await supabase
          .from("machines")
          .select("id")
          .eq("client_id", input.clientId);

        if (clientMachines && clientMachines.length > 0) {
          const mIds = clientMachines.map((m: any) => m.id);
          await supabase
            .from("operator_machine_assignments")
            .update({
              shift_start_time: record.start_time,
              shift_end_time: record.end_time,
            })
            .in("machine_id", mIds)
            .eq("shift_code", record.code);
        }
      }
    } else {
      const { data, error } = await supabase
        .from("client_shift_codes")
        .insert([record])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    try {
      const { revalidateTag, revalidatePath } = await import("next/cache");
      const { CACHE_TAGS, TAGS } = await import("@/lib/cache");
      revalidateTag(CACHE_TAGS.clients, "max");
      revalidateTag(CACHE_TAGS.operations, "max");
      revalidateTag(TAGS.machines, "max");
      revalidateTag(TAGS.machinesList, "max");
      revalidateTag(TAGS.assignments, "max");
      revalidatePath(`/clients/${input.clientId}`);
      revalidatePath("/machines");
      revalidatePath("/operations");
    } catch {
      // Non-blocking cache revalidation
    }

    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save shift code." };
  }
}

/**
 * Server Action: Delete or toggle a client shift code
 */
export async function deleteClientShiftCodeAction(
  shiftCodeId: string,
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    if (!["super_admin", "admin", "manager"].includes(user.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions to delete shift codes." };
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("client_shift_codes")
      .delete()
      .eq("id", shiftCodeId)
      .eq("client_id", clientId);

    if (error) throw error;

    try {
      const { revalidateTag, revalidatePath } = await import("next/cache");
      const { CACHE_TAGS, TAGS } = await import("@/lib/cache");
      revalidateTag(CACHE_TAGS.clients, "max");
      revalidateTag(CACHE_TAGS.operations, "max");
      revalidateTag(TAGS.machines, "max");
      revalidateTag(TAGS.machinesList, "max");
      revalidateTag(TAGS.assignments, "max");
      revalidatePath(`/clients/${clientId}`);
      revalidatePath("/machines");
      revalidatePath("/operations");
    } catch {
      // Non-blocking
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete shift code." };
  }
}

/**
 * Server Action: Apply an industry standard shift preset template to a client
 */
export async function applyClientShiftPresetAction(
  clientId: string,
  presetId: string,
  mode: "replace" | "append" = "replace"
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    if (!["super_admin", "admin", "manager"].includes(user.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions to configure shift codes." };
    }

    const preset = getClientShiftPresetById(presetId);
    if (!preset) {
      return { success: false, error: "Invalid preset template selected." };
    }

    const supabase = createSupabaseAdminClient();

    if (mode === "replace") {
      // Clear existing shift codes for this client
      await supabase.from("client_shift_codes").delete().eq("client_id", clientId);
    }

    if (preset.shifts.length > 0) {
      let shiftsToInsert = preset.shifts;
      if (mode === "append") {
        const { data: existingCodes } = await supabase
          .from("client_shift_codes")
          .select("code")
          .eq("client_id", clientId);
        const existingSet = new Set((existingCodes || []).map((c: any) => c.code.toUpperCase()));
        shiftsToInsert = preset.shifts.filter((s) => !existingSet.has(s.code.toUpperCase()));
      }

      if (shiftsToInsert.length > 0) {
        const records = shiftsToInsert.map((s) => ({
          client_id: clientId,
          code: s.code,
          name: s.name,
          start_time: s.startTime,
          end_time: s.endTime,
          scheduled_minutes: s.scheduledMinutes,
          normal_minutes: s.normalMinutes,
          crosses_midnight: s.crossesMidnight,
          display_order: s.displayOrder,
          is_active: true,
          updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from("client_shift_codes")
          .insert(records);

        if (error) throw error;
      }

      // Cascade updated shift timings to all active assignments on client machines
      const { data: clientMachines } = await supabase
        .from("machines")
        .select("id")
        .eq("client_id", clientId);

      if (clientMachines && clientMachines.length > 0) {
        const mIds = clientMachines.map((m: any) => m.id);
        const { data: currentShifts } = await supabase
          .from("client_shift_codes")
          .select("code, start_time, end_time")
          .eq("client_id", clientId)
          .eq("is_active", true);

        if (currentShifts && currentShifts.length > 0) {
          for (const cs of currentShifts) {
            await supabase
              .from("operator_machine_assignments")
              .update({
                shift_start_time: cs.start_time,
                shift_end_time: cs.end_time,
                updated_at: new Date().toISOString(),
              })
              .in("machine_id", mIds)
              .eq("shift_code", cs.code)
              .eq("is_active", true);
          }
        }
      }
    }

    // Fetch full active list
    const { data: fullList } = await supabase
      .from("client_shift_codes")
      .select("*")
      .eq("client_id", clientId)
      .order("display_order", { ascending: true })
      .order("code", { ascending: true });

    try {
      const { revalidateTag, revalidatePath } = await import("next/cache");
      const { CACHE_TAGS, TAGS } = await import("@/lib/cache");
      revalidateTag(CACHE_TAGS.clients, "max");
      revalidateTag(CACHE_TAGS.operations, "max");
      revalidateTag(TAGS.machines, "max");
      revalidateTag(TAGS.machinesList, "max");
      revalidateTag(TAGS.assignments, "max");
      revalidatePath(`/clients/${clientId}`);
      revalidatePath("/machines");
      revalidatePath("/operations");
    } catch {
      // Non-blocking
    }

    return { success: true, data: fullList || [] };
  } catch (err: any) {
    console.error("applyClientShiftPresetAction exception:", err);
    return { success: false, error: err.message || "Failed to apply shift preset." };
  }
}


