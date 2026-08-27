"use server";

import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache";
import { requireRole } from "@/lib/dal";
import { CreateClientSchema, UpdateClientSchema } from "@reachinternational/validation";

export interface ClientFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

const AUTHORIZED_ROLES = ["super_admin", "admin", "service_manager", "rental_manager", "sales_executive"] as const;

/**
 * Create a new Client in database (public.clients)
 */
export async function createClientAction(state: ClientFormState, formData: FormData): Promise<ClientFormState> {
  try {
    await requireRole(...AUTHORIZED_ROLES);

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required. Please log in to perform this action." };
    }

    const payload = {
      clientName: (formData.get("clientName") as string)?.trim(),
      companyName: (formData.get("companyName") as string)?.trim() || "",
      contactPerson: (formData.get("contactPerson") as string)?.trim() || "",
      phone: (formData.get("phone") as string)?.trim() || "",
      email: (formData.get("email") as string)?.trim() || "",
      gstin: (formData.get("gstin") as string)?.trim() || "",
      address: (formData.get("address") as string)?.trim() || "",
      city: (formData.get("city") as string)?.trim() || "",
      state: (formData.get("state") as string)?.trim() || "",
      pincode: (formData.get("pincode") as string)?.trim() || "",
      branchId: (formData.get("branchId") as string)?.trim() || null,
      notes: (formData.get("notes") as string)?.trim() || "",
      status: ((formData.get("status") as string) || "active") as "active" | "inactive",
    };

    const parsed = CreateClientSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const fieldName = issue.path[0]?.toString() || "form";
        fieldErrors[fieldName] = issue.message;
      });
      return {
        error: "Please correct the highlighted validation errors.",
        fieldErrors,
      };
    }

    const data = parsed.data;

    const insertPayload = {
      client_name: data.clientName,
      company_name: data.companyName || null,
      contact_person: data.contactPerson || null,
      phone: data.phone || null,
      email: data.email || null,
      gstin: data.gstin || null,
      address: data.address.trim(),
      city: data.city.trim(),
      state: data.state.trim(),
      pincode: data.pincode || null,
      notes: data.notes || null,
      status: data.status,
    };

    const { data: createdClient, error: dbError } = await supabase
      .from("clients")
      .insert([insertPayload])
      .select("id, code, client_name")
      .single();

    if (dbError) {
      console.error("Error creating client in database:", dbError);
      return { error: `Failed to create client: ${dbError.message}` };
    }

    await logAudit({
      user_id: user.id,
      action: "CLIENT_CREATE",
      entity_type: "clients",
      entity_id: createdClient.id,
      metadata: { client_code: createdClient.code, client_name: createdClient.client_name },
    });

    revalidateTag(TAGS.clients, "max");
    return { success: true };
  } catch (err: any) {
    console.error("createClientAction exception:", err);
    return { error: err.message || "An unexpected error occurred while adding client details." };
  }
}

/**
 * Update existing Client in database
 */
export async function updateClientAction(state: ClientFormState, formData: FormData): Promise<ClientFormState> {
  try {
    await requireRole(...AUTHORIZED_ROLES);

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required. Please log in to perform this action." };
    }

    const id = (formData.get("id") as string)?.trim();
    if (!id || !isValidUuid(id)) {
      return { error: "Valid Client ID is required for update." };
    }

    const payload = {
      id,
      clientName: (formData.get("clientName") as string)?.trim(),
      companyName: (formData.get("companyName") as string)?.trim() || "",
      contactPerson: (formData.get("contactPerson") as string)?.trim() || "",
      phone: (formData.get("phone") as string)?.trim() || "",
      email: (formData.get("email") as string)?.trim() || "",
      gstin: (formData.get("gstin") as string)?.trim() || "",
      address: (formData.get("address") as string)?.trim() || "",
      city: (formData.get("city") as string)?.trim() || "",
      state: (formData.get("state") as string)?.trim() || "",
      pincode: (formData.get("pincode") as string)?.trim() || "",
      branchId: (formData.get("branchId") as string)?.trim() || null,
      notes: (formData.get("notes") as string)?.trim() || "",
      status: ((formData.get("status") as string) || "active") as "active" | "inactive",
    };

    const parsed = UpdateClientSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const fieldName = issue.path[0]?.toString() || "form";
        fieldErrors[fieldName] = issue.message;
      });
      return {
        error: "Please correct the highlighted validation errors.",
        fieldErrors,
      };
    }

    const data = parsed.data;

    const updatePayload = {
      client_name: data.clientName,
      company_name: data.companyName || null,
      contact_person: data.contactPerson || null,
      phone: data.phone || null,
      email: data.email || null,
      gstin: data.gstin || null,
      address: data.address.trim(),
      city: data.city.trim(),
      state: data.state.trim(),
      pincode: data.pincode || null,
      notes: data.notes || null,
      status: data.status,
      updated_at: new Date().toISOString(),
    };

    const { error: dbError } = await supabase
      .from("clients")
      .update(updatePayload)
      .eq("id", id);

    if (dbError) {
      console.error("Error updating client in database:", dbError);
      return { error: `Failed to update client: ${dbError.message}` };
    }

    await logAudit({
      user_id: user.id,
      action: "CLIENT_UPDATE",
      entity_type: "clients",
      entity_id: id,
      metadata: { client_name: data.clientName },
    });

    revalidateTag(TAGS.clients, "max");
    return { success: true };
  } catch (err: any) {
    console.error("updateClientAction exception:", err);
    return { error: err.message || "An unexpected error occurred while updating client details." };
  }
}

/**
 * Soft delete Client in database (deleted_at = NOW(), status = 'inactive')
 */
export async function softDeleteClientAction(clientId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireRole(...AUTHORIZED_ROLES);

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required. Please log in to perform this action." };
    }

    if (!clientId || !isValidUuid(clientId)) {
      return { error: "Valid Client ID is required for soft deletion." };
    }

    const { error: dbError } = await supabase
      .from("clients")
      .update({
        deleted_at: new Date().toISOString(),
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);

    if (dbError) {
      console.error("Error soft-deleting client:", dbError);
      return { error: `Failed to soft delete client: ${dbError.message}` };
    }

    await logAudit({
      user_id: user.id,
      action: "CLIENT_SOFT_DELETE",
      entity_type: "clients",
      entity_id: clientId,
      metadata: { deleted_at: new Date().toISOString() },
    });

    revalidateTag(TAGS.clients, "max");
    return { success: true };
  } catch (err: any) {
    console.error("softDeleteClientAction exception:", err);
    return { error: err.message || "An unexpected error occurred while soft deleting client." };
  }
}
