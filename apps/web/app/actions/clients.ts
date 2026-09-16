"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
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
import type { ClientDirectoryFilter } from "@reachinternational/utils";
import type { CRMClient } from "@/lib/types/database";

export interface ClientFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
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
    };

    const result = await createClient(payload, user.id);

    if (!result.success) {
      return {
        error: result.error,
        fieldErrors: result.fieldErrors,
      };
    }

    return { success: true };
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
    };

    const result = await updateClient(payload, user.id);

    if (!result.success) {
      return {
        error: result.error,
        fieldErrors: result.fieldErrors,
      };
    }

    return { success: true };
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

const AUTHORIZED_CLIENT_ROLES = ["super_admin", "admin", "manager", "service_manager", "supervisor"] as const;

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


