import "server-only";
import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache";
import { requireRole } from "@/lib/dal";
import {
  CreateClientSchema,
  UpdateClientSchema,
  type CreateClientInput,
  type UpdateClientInput,
} from "@reachinternational/validation";
import type { CRMClient } from "@/lib/types/database";

export interface ClientMutationResult {
  success: boolean;
  client?: CRMClient;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const AUTHORIZED_ROLES = ["super_admin", "admin", "manager", "service_manager"] as const;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Creates a new Client record in public.clients with schema validation and audit logging.
 */
export async function createClient(
  input: CreateClientInput,
  currentUserId?: string
): Promise<ClientMutationResult> {
  try {
    await requireRole(...AUTHORIZED_ROLES);

    const parsed = CreateClientSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const fieldName = issue.path[0]?.toString() || "form";
        fieldErrors[fieldName] = issue.message;
      });
      return {
        success: false,
        error: "Please correct the highlighted validation errors.",
        fieldErrors,
      };
    }

    const data = parsed.data;
    const resolvedStreet = (data.street || data.address || "").trim();

    const insertPayload = {
      company_name: data.companyName.trim(),
      contact_person: data.contactPerson?.trim() || null,
      phone: data.phone?.trim() || null,
      gstin: data.gstin?.trim().toUpperCase() || null,
      pan_number: data.panNumber?.trim().toUpperCase() || null,
      street: resolvedStreet,
      city: data.city.trim(),
      district: data.district?.trim() || null,
      state: data.state.trim(),
      pincode: data.pincode?.trim() || null,
      is_billing_address_different: Boolean(data.isBillingAddressDifferent),
      billing_address: data.isBillingAddressDifferent ? data.billingAddress?.trim() || null : null,
      billing_city: data.isBillingAddressDifferent ? data.billingCity?.trim() || null : null,
      billing_district: data.isBillingAddressDifferent ? data.billingDistrict?.trim() || null : null,
      billing_state: data.isBillingAddressDifferent ? data.billingState?.trim() || null : null,
      billing_pincode: data.isBillingAddressDifferent ? data.billingPincode?.trim() || null : null,
      status: data.status || "active",
    };

    const supabase = await createSupabaseServerClient();
    const { data: createdClient, error: dbError } = await supabase
      .from("clients")
      .insert([insertPayload])
      .select("id, code, company_name, status, city")
      .single();

    if (dbError || !createdClient) {
      console.error("Error creating client in database:", dbError);
      return {
        success: false,
        error: `Failed to create client: ${dbError?.message || "Unknown error"}`,
      };
    }

    if (currentUserId) {
      await logAudit({
        user_id: currentUserId,
        action: "CLIENT_CREATE",
        entity_type: "clients",
        entity_id: createdClient.id,
        metadata: {
          client_code: createdClient.code,
          company_name: createdClient.company_name,
          gstin: data.gstin,
        },
      });
    }

    // Targeted surgical cache invalidation:
    // Only invalidate client lists and KPIs. Existing client details and unrelated domains remain untouched in cache.
    revalidateTag(TAGS.clientsList, "max");
    revalidateTag(TAGS.clientsKpis, "max");
    if (data.city) {
      revalidateTag(TAGS.clientsLocations, "max");
    }

    return {
      success: true,
      client: createdClient as unknown as CRMClient,
    };
  } catch (err: any) {
    console.error("createClient exception:", err);
    return {
      success: false,
      error: err.message || "An unexpected error occurred while creating client.",
    };
  }
}

/**
 * Updates an existing Client record in public.clients with validation and audit logging.
 */
export async function updateClient(
  input: UpdateClientInput,
  currentUserId?: string
): Promise<ClientMutationResult> {
  try {
    await requireRole(...AUTHORIZED_ROLES);

    if (!input.id || !isValidUuid(input.id)) {
      return { success: false, error: "Valid Client UUID is required for update." };
    }

    const parsed = UpdateClientSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const fieldName = issue.path[0]?.toString() || "form";
        fieldErrors[fieldName] = issue.message;
      });
      return {
        success: false,
        error: "Please correct the highlighted validation errors.",
        fieldErrors,
      };
    }

    const data = parsed.data;
    const resolvedStreet = (data.street || data.address || "").trim();

    const updatePayload = {
      company_name: data.companyName.trim(),
      contact_person: data.contactPerson?.trim() || null,
      phone: data.phone?.trim() || null,
      gstin: data.gstin?.trim().toUpperCase() || null,
      pan_number: data.panNumber?.trim().toUpperCase() || null,
      street: resolvedStreet,
      city: data.city.trim(),
      district: data.district?.trim() || null,
      state: data.state.trim(),
      pincode: data.pincode?.trim() || null,
      is_billing_address_different: Boolean(data.isBillingAddressDifferent),
      billing_address: data.isBillingAddressDifferent ? data.billingAddress?.trim() || null : null,
      billing_city: data.isBillingAddressDifferent ? data.billingCity?.trim() || null : null,
      billing_district: data.isBillingAddressDifferent ? data.billingDistrict?.trim() || null : null,
      billing_state: data.isBillingAddressDifferent ? data.billingState?.trim() || null : null,
      billing_pincode: data.isBillingAddressDifferent ? data.billingPincode?.trim() || null : null,
      status: data.status || "active",
      updated_at: new Date().toISOString(),
    };

    const supabase = await createSupabaseServerClient();
    const { data: updatedClient, error: dbError } = await supabase
      .from("clients")
      .update(updatePayload)
      .eq("id", data.id)
      .select("id, code, company_name, status")
      .single();

    if (dbError) {
      console.error("Error updating client in database:", dbError);
      return {
        success: false,
        error: `Failed to update client: ${dbError.message}`,
      };
    }

    if (currentUserId) {
      await logAudit({
        user_id: currentUserId,
        action: "CLIENT_UPDATE",
        entity_type: "clients",
        entity_id: data.id,
        metadata: {
          company_name: data.companyName,
          gstin: data.gstin,
        },
      });
    }

    // Targeted surgical cache invalidation:
    // 1. Invalidate ONLY this specific client's detail: clients:detail:{id}
    revalidateTag(TAGS.clientDetail(data.id), "max");
    // 2. Invalidate client list queries to reflect updated name/status/phone: clients:list:{filters}
    revalidateTag(TAGS.clientsList, "max");
    // 3. Invalidate KPIs
    revalidateTag(TAGS.clientsKpis, "max");
    // 4. Invalidate location metadata ONLY if city changed
    if (data.city) {
      revalidateTag(TAGS.clientsLocations, "max");
    }

    return {
      success: true,
      client: updatedClient as unknown as CRMClient,
    };
  } catch (err: any) {
    console.error("updateClient exception:", err);
    return {
      success: false,
      error: err.message || "An unexpected error occurred while updating client.",
    };
  }
}

/**
 * Soft deletes / deactivates a Client record (deleted_at = NOW(), status = 'inactive').
 */
export async function deactivateClient(
  clientId: string,
  currentUserId?: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(...AUTHORIZED_ROLES);

    if (!clientId || !isValidUuid(clientId)) {
      return { success: false, error: "Valid Client UUID is required for deactivation." };
    }

    const supabase = await createSupabaseServerClient();
    const { error: dbError } = await supabase
      .from("clients")
      .update({
        deleted_at: new Date().toISOString(),
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);

    if (dbError) {
      console.error("Error deactivating client:", dbError);
      return { success: false, error: `Failed to deactivate client: ${dbError.message}` };
    }

    if (currentUserId) {
      await logAudit({
        user_id: currentUserId,
        action: "CLIENT_SOFT_DELETE",
        entity_type: "clients",
        entity_id: clientId,
        metadata: {
          deleted_at: new Date().toISOString(),
          reason: reason || "User initiated deactivation",
        },
      });
    }

    // Targeted surgical cache invalidation:
    // Invalidate ONLY this client's detail, list queries, and KPI counts.
    // Unrelated client details and location metadata remain cached.
    revalidateTag(TAGS.clientDetail(clientId), "max");
    revalidateTag(TAGS.clientsList, "max");
    revalidateTag(TAGS.clientsKpis, "max");

    return { success: true };
  } catch (err: any) {
    console.error("deactivateClient exception:", err);
    return {
      success: false,
      error: err.message || "An unexpected error occurred while deactivating client.",
    };
  }
}

/**
 * Restores / reactivates a previously soft-deleted Client record (deleted_at = null, status = 'active').
 */
export async function restoreClient(
  clientId: string,
  currentUserId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(...AUTHORIZED_ROLES);

    if (!clientId || !isValidUuid(clientId)) {
      return { success: false, error: "Valid Client UUID is required for restoration." };
    }

    const supabase = await createSupabaseServerClient();
    const { error: dbError } = await supabase
      .from("clients")
      .update({
        deleted_at: null,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);

    if (dbError) {
      console.error("Error restoring client:", dbError);
      return { success: false, error: `Failed to restore client: ${dbError.message}` };
    }

    if (currentUserId) {
      await logAudit({
        user_id: currentUserId,
        action: "CLIENT_RESTORE",
        entity_type: "clients",
        entity_id: clientId,
        metadata: {
          restored_at: new Date().toISOString(),
        },
      });
    }

    // Targeted surgical cache invalidation:
    // Invalidate ONLY this client's detail, list queries, and KPI counts.
    // Unrelated client details and location metadata remain cached.
    revalidateTag(TAGS.clientDetail(clientId), "max");
    revalidateTag(TAGS.clientsList, "max");
    revalidateTag(TAGS.clientsKpis, "max");

    return { success: true };
  } catch (err: any) {
    console.error("restoreClient exception:", err);
    return {
      success: false,
      error: err.message || "An unexpected error occurred while restoring client.",
    };
  }
}
