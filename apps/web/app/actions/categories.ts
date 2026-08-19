"use server";

import { revalidateTag } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache";

export async function createCategory(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "super_admin" && user.role !== "admin")) {
    return { error: "Unauthorized: Only Admins can manage machine categories" };
  }

  const name = formData.get("name")?.toString().trim();
  const description = formData.get("description")?.toString().trim() || null;

  if (!name) {
    return { error: "Category name is required" };
  }

  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("machine_categories").insert({
    name,
    description,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `Category "${name}" already exists` };
    }
    return { error: error.message };
  }

  revalidateTag(CACHE_TAGS.categories, { expire: 0 });
  revalidateTag(CACHE_TAGS.machineMeta, { expire: 0 });
  return { success: true };
}

export async function deleteCategory(
  categoryId: string
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "super_admin" && user.role !== "admin")) {
    return { error: "Unauthorized: Only Admins can manage machine categories" };
  }

  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("machine_categories")
    .delete()
    .eq("id", categoryId);

  if (error) {
    return { error: error.message };
  }

  revalidateTag(CACHE_TAGS.categories, { expire: 0 });
  revalidateTag(CACHE_TAGS.machineMeta, { expire: 0 });
  return { success: true };
}
