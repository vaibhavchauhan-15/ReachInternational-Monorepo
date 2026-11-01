"use server";

import { revalidateTag, revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache";
import {
  equipmentUpsertSchema,
  equipmentPublishValidationSchema,
  equipmentEnquiryStatusSchema,
} from "@reachinternational/validation";

const ALLOWED_ADMIN_ROLES = ["super_admin", "admin", "manager"];

/**
 * Revalidation helper that clears ISR and Next data cache for equipment
 */
export async function revalidateEquipmentCache(slug?: string) {
  revalidateTag(TAGS.equipment, "max");
  revalidateTag(TAGS.equipmentList, "max");
  revalidateTag(TAGS.equipmentCategories, "max");
  revalidateTag(TAGS.equipmentBrands, "max");
  if (slug) {
    revalidateTag(`equipment:${slug}`, "max");
    revalidatePath(`/equipment/${slug}`);
  }
  revalidatePath("/equipment");
  revalidatePath("/marketing/equipment");
  revalidatePath("/sitemap.xml");
}

/**
 * Create or update an equipment model
 */
export async function saveEquipmentAction(input: unknown) {
  const user = await getCurrentUser();
  if (!user || !ALLOWED_ADMIN_ROLES.includes(user.role)) {
    return { success: false, error: "Unauthorized. Manager or Admin privileges required." };
  }

  const parsed = equipmentUpsertSchema.safeParse(input);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((e) => e.message).join(", ");
    return { success: false, error: errorMsg };
  }

  const data = parsed.data;

  // If status is published, validate strict publication criteria
  if (data.status === "published") {
    const pubCheck = equipmentPublishValidationSchema.safeParse(data);
    if (!pubCheck.success) {
      return {
        success: false,
        error: pubCheck.error.issues.map((e) => e.message).join(", "),
      };
    }
  }

  const supabase = createSupabaseAdminClient();

  // Optimistic concurrency check if editing existing record
  if (data.id) {
    const { data: existing } = await supabase
      .from("equipment_models")
      .select("version, slug")
      .eq("id", data.id)
      .single();

    if (existing && data.version && existing.version !== data.version) {
      return {
        success: false,
        error: "Concurrency conflict: This machine was modified by another session. Please reload.",
      };
    }
  }

  const payload: any = {
    brand_id: data.brand_id,
    category_id: data.category_id,
    model_name: data.model_name,
    model_number: data.model_number,
    slug: data.slug,
    subtype: data.subtype || null,
    short_description: data.summary || data.model_name,
    full_description: data.full_description,
    primary_image_url: data.primary_image_url,
    is_featured: data.is_featured,
    is_published: data.status === "published",
    status: data.status,
    power: data.power,
    rental_available: data.rental_available,
    purchase_available: data.purchase_available,
    indoor_use: data.indoor_use,
    outdoor_use: data.outdoor_use,
    tagline: data.tagline || null,
    summary: data.summary || null,
    description_md: data.description_md || data.full_description,
    tags: data.tags || [],
    applications: data.applications || [],
    features: data.features || [],
    specs: data.specs || {},
    max_platform_height_m: data.max_platform_height_m || null,
    max_working_height_m: data.max_working_height_m || null,
    capacity_kg: data.capacity_kg || null,
    weight_kg: data.weight_kg || null,
    primary_working_height: data.primary_working_height || null,
    primary_capacity: data.primary_capacity || null,
    primary_power_source: data.primary_power_source || null,
    cover_path: data.cover_path || data.primary_image_url,
    sort_weight: data.sort_weight || 0,
    seo_title: data.seo_title || `${data.model_name} — Industrial Access Equipment`,
    seo_description: data.seo_description || data.summary,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  if (data.status === "published") {
    payload.published_at = new Date().toISOString();
  }

  let resultId = data.id;

  if (data.id) {
    payload.version = (data.version || 1) + 1;
    const { error: updateErr } = await supabase
      .from("equipment_models")
      .update(payload)
      .eq("id", data.id);

    if (updateErr) {
      console.error("[Action] Error updating equipment model:", updateErr);
      return { success: false, error: updateErr.message };
    }

    await logAudit({
      action: "equipment.update",
      entity_type: "equipment_model",
      entity_id: data.id,
      entity_name: data.model_name,
      user_id: user.id,
      metadata: { slug: data.slug, status: data.status },
    });
  } else {
    payload.created_by = user.id;
    payload.version = 1;
    const { data: inserted, error: insertErr } = await supabase
      .from("equipment_models")
      .insert(payload)
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("[Action] Error creating equipment model:", insertErr);
      return { success: false, error: insertErr?.message || "Failed to create equipment" };
    }

    resultId = inserted.id;

    await logAudit({
      action: "equipment.create",
      entity_type: "equipment_model",
      entity_id: resultId,
      entity_name: data.model_name,
      user_id: user.id,
      metadata: { slug: data.slug, status: data.status },
    });
  }

  await revalidateEquipmentCache(data.slug);
  return { success: true, id: resultId };
}

/**
 * Publish an equipment model
 */
export async function publishEquipmentAction(id: string) {
  const user = await getCurrentUser();
  if (!user || !ALLOWED_ADMIN_ROLES.includes(user.role)) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: model, error: fetchErr } = await supabase
    .from("equipment_models")
    .select("slug, model_name, summary, primary_image_url")
    .eq("id", id)
    .single();

  if (fetchErr || !model) {
    return { success: false, error: "Machine not found." };
  }

  const { error: updateErr } = await supabase
    .from("equipment_models")
    .update({
      status: "published",
      is_published: true,
      published_at: new Date().toISOString(),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await logAudit({
    action: "equipment.publish",
    entity_type: "equipment_model",
    entity_id: id,
    entity_name: model.model_name,
    user_id: user.id,
  });

  await revalidateEquipmentCache(model.slug);
  return { success: true };
}

/**
 * Unpublish an equipment model (sets to draft)
 */
export async function unpublishEquipmentAction(id: string) {
  const user = await getCurrentUser();
  if (!user || !ALLOWED_ADMIN_ROLES.includes(user.role)) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: model } = await supabase
    .from("equipment_models")
    .select("slug, model_name")
    .eq("id", id)
    .single();

  const { error: updateErr } = await supabase
    .from("equipment_models")
    .update({
      status: "draft",
      is_published: false,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await logAudit({
    action: "equipment.unpublish",
    entity_type: "equipment_model",
    entity_id: id,
    entity_name: model?.model_name,
    user_id: user.id,
  });

  await revalidateEquipmentCache(model?.slug);
  return { success: true };
}

/**
 * Archive an equipment model
 */
export async function archiveEquipmentAction(id: string) {
  const user = await getCurrentUser();
  if (!user || !ALLOWED_ADMIN_ROLES.includes(user.role)) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: model } = await supabase
    .from("equipment_models")
    .select("slug, model_name")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("equipment_models")
    .update({
      status: "archived",
      is_published: false,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  await logAudit({
    action: "equipment.archive",
    entity_type: "equipment_model",
    entity_id: id,
    entity_name: model?.model_name,
    user_id: user.id,
  });

  await revalidateEquipmentCache(model?.slug);
  return { success: true };
}

/**
 * Restore an equipment model from archive or soft delete
 */
export async function restoreEquipmentAction(id: string) {
  const user = await getCurrentUser();
  if (!user || !ALLOWED_ADMIN_ROLES.includes(user.role)) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: model } = await supabase
    .from("equipment_models")
    .select("slug, model_name")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("equipment_models")
    .update({
      status: "draft",
      deleted_at: null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  await logAudit({
    action: "equipment.restore",
    entity_type: "equipment_model",
    entity_id: id,
    entity_name: model?.model_name,
    user_id: user.id,
  });

  await revalidateEquipmentCache(model?.slug);
  return { success: true };
}

/**
 * Delete an equipment model (soft delete by default, hard delete from trash)
 */
export async function deleteEquipmentAction(id: string, hard = false) {
  const user = await getCurrentUser();
  if (!user || !ALLOWED_ADMIN_ROLES.includes(user.role)) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: model } = await supabase
    .from("equipment_models")
    .select("slug, model_name")
    .eq("id", id)
    .single();

  if (hard) {
    const { error } = await supabase.from("equipment_models").delete().eq("id", id);
    if (error) return { success: false, error: error.message };

    await logAudit({
      action: "equipment.hard_delete",
      entity_type: "equipment_model",
      entity_id: id,
      entity_name: model?.model_name,
      user_id: user.id,
    });
  } else {
    const { error } = await supabase
      .from("equipment_models")
      .update({
        deleted_at: new Date().toISOString(),
        is_published: false,
        updated_by: user.id,
      })
      .eq("id", id);
    if (error) return { success: false, error: error.message };

    await logAudit({
      action: "equipment.soft_delete",
      entity_type: "equipment_model",
      entity_id: id,
      entity_name: model?.model_name,
      user_id: user.id,
    });
  }

  await revalidateEquipmentCache(model?.slug);
  return { success: true };
}

/**
 * Duplicate an existing equipment model
 */
export async function duplicateEquipmentAction(id: string) {
  const user = await getCurrentUser();
  if (!user || !ALLOWED_ADMIN_ROLES.includes(user.role)) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: original, error: fetchErr } = await supabase
    .from("equipment_models")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !original) {
    return { success: false, error: "Source machine not found" };
  }

  const randomSuffix = Math.random().toString(36).substring(2, 6);
  const newSlug = `${original.slug}-copy-${randomSuffix}`;

  const { data: inserted, error: insertErr } = await supabase
    .from("equipment_models")
    .insert({
      brand_id: original.brand_id,
      category_id: original.category_id,
      model_name: `${original.model_name} (Copy)`,
      model_number: `${original.model_number}-COPY`,
      slug: newSlug,
      subtype: original.subtype,
      short_description: original.short_description,
      full_description: original.full_description,
      primary_image_url: original.primary_image_url,
      is_featured: false,
      is_published: false,
      status: "draft",
      power: original.power || "electric",
      rental_available: original.rental_available,
      purchase_available: original.purchase_available,
      indoor_use: original.indoor_use,
      outdoor_use: original.outdoor_use,
      tagline: original.tagline,
      summary: original.summary,
      description_md: original.description_md,
      tags: original.tags || [],
      applications: original.applications || [],
      features: original.features || [],
      specs: original.specs || {},
      max_platform_height_m: original.max_platform_height_m,
      max_working_height_m: original.max_working_height_m,
      capacity_kg: original.capacity_kg,
      weight_kg: original.weight_kg,
      primary_working_height: original.primary_working_height,
      primary_capacity: original.primary_capacity,
      primary_power_source: original.primary_power_source,
      cover_path: original.cover_path,
      sort_weight: 0,
      version: 1,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id, slug")
    .single();

  if (insertErr || !inserted) {
    return { success: false, error: insertErr?.message || "Failed to duplicate model" };
  }

  // Copy relational specs
  const { data: specs } = await supabase
    .from("equipment_specifications")
    .select("spec_definition_id, spec_value, is_key_spec, sort_order")
    .eq("equipment_id", id);

  if (specs && specs.length > 0) {
    await supabase.from("equipment_specifications").insert(
      specs.map((s) => ({
        ...s,
        equipment_id: inserted.id,
      }))
    );
  }

  // Copy media references
  const { data: media } = await supabase
    .from("equipment_media")
    .select("media_url, media_type, alt_text, sort_order, is_primary")
    .eq("equipment_id", id);

  if (media && media.length > 0) {
    await supabase.from("equipment_media").insert(
      media.map((m) => ({
        ...m,
        equipment_id: inserted.id,
      }))
    );
  }

  // Copy documents
  const { data: docs } = await supabase
    .from("equipment_documents")
    .select("title, document_type, file_url, file_size_bytes, mime_type, is_published")
    .eq("equipment_id", id);

  if (docs && docs.length > 0) {
    await supabase.from("equipment_documents").insert(
      docs.map((d) => ({
        ...d,
        equipment_id: inserted.id,
      }))
    );
  }

  await logAudit({
    action: "equipment.duplicate",
    entity_type: "equipment_model",
    entity_id: inserted.id,
    entity_name: `${original.model_name} (Copy)`,
    user_id: user.id,
    metadata: { source_id: id, new_slug: newSlug },
  });

  await revalidateEquipmentCache(newSlug);
  return { success: true, id: inserted.id };
}

/**
 * Update the status of an equipment enquiry
 */
export async function updateEnquiryStatusAction(input: unknown) {
  const user = await getCurrentUser();
  if (!user || !ALLOWED_ADMIN_ROLES.includes(user.role)) {
    return { success: false, error: "Unauthorized." };
  }

  const parsed = equipmentEnquiryStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid enquiry input" };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("equipment_enquiries")
    .update({
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (error) {
    return { success: false, error: error.message };
  }

  await logAudit({
    action: "equipment_enquiry.status_update",
    entity_type: "equipment_enquiry",
    entity_id: parsed.data.id,
    user_id: user.id,
    metadata: { new_status: parsed.data.status },
  });

  revalidatePath("/marketing/equipment/enquiries");
  return { success: true };
}
