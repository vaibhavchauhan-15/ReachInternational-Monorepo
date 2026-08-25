"use server";

import { revalidateTag } from "next/cache";
import { getCurrentUser, requireRole, requirePermission } from "@/lib/dal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache";
import { TAGS } from "@/lib/cache/tags";
import { logAudit } from "@/lib/audit";

export async function getBranchesAction() {
  await getCurrentUser();
  return { success: true, data: [] };
}

// Branch creation is strictly Super Admin only
export async function createBranchAction(payload: {
  code: string;
  name: string;
  city: string;
  state: string;
  address?: string;
  phone?: string;
  email?: string;
}) {
  const user = await requireRole("super_admin");
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("branches")
    .insert({
      code: payload.code.toUpperCase().trim(),
      name: payload.name.trim(),
      city: payload.city.trim(),
      state: payload.state.trim(),
      address: payload.address || null,
      phone: payload.phone || null,
      email: payload.email || null,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating branch:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: user.id,
    action: "branch.created",
    entity_type: "branch",
    entity_id: data.id,
    metadata: { code: data.code, name: data.name, city: data.city },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  revalidateTag(TAGS.branches, "max");
  return { success: true, data };
}

// Update operational branch details (Admin and Super Admin)
export async function updateBranchAction(
  id: string,
  payload: {
    name?: string;
    city?: string;
    state?: string;
    address?: string;
    phone?: string;
    email?: string;
  }
) {
  const user = await requirePermission("branch.edit");
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("branches")
    .update({
      ...(payload.name ? { name: payload.name.trim() } : {}),
      ...(payload.city ? { city: payload.city.trim() } : {}),
      ...(payload.state ? { state: payload.state.trim() } : {}),
      ...(payload.address !== undefined ? { address: payload.address || null } : {}),
      ...(payload.phone !== undefined ? { phone: payload.phone || null } : {}),
      ...(payload.email !== undefined ? { email: payload.email || null } : {}),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating branch:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: user.id,
    action: "branch.updated",
    entity_type: "branch",
    entity_id: id,
    metadata: payload,
  });

  revalidateTag(TAGS.branches, "max");
  return { success: true, data };
}

// Deactivate / Archive branch (Admin and Super Admin)
export async function deactivateBranchAction(id: string, reason?: string) {
  const user = await requireRole("admin", "super_admin");
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("branches")
    .update({ status: "inactive" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error deactivating branch:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: user.id,
    action: "branch.deactivated",
    entity_type: "branch",
    entity_id: id,
    metadata: { reason: reason || "Branch deactivated by Administrator" },
  });

  revalidateTag(TAGS.branches, "max");
  return { success: true, data };
}
