import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  EquipmentAdminSummary,
  EquipmentAdminListItem,
  EquipmentAdminFilterParams,
  EquipmentModelWithRelations,
  EquipmentBrand,
  EquipmentCategory,
  EquipmentEnquiry,
} from "@reachinternational/types";

export interface EquipmentAdminListResponse {
  items: EquipmentAdminListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Summary KPI metrics for the Equipment Admin dashboard
 */
export const getEquipmentAdminSummary = cache(async (): Promise<EquipmentAdminSummary> => {
  const supabase = await createSupabaseServerClient();

  const [
    { count: totalCount },
    { count: publishedCount },
    { count: draftCount },
    { count: archivedCount },
    { count: totalEnquiriesCount },
    { count: newEnquiriesCount },
    { count: brandsCount },
    { count: categoriesCount },
  ] = await Promise.all([
    supabase.from("equipment_models").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("equipment_models").select("id", { count: "exact", head: true }).eq("status", "published").is("deleted_at", null),
    supabase.from("equipment_models").select("id", { count: "exact", head: true }).eq("status", "draft").is("deleted_at", null),
    supabase.from("equipment_models").select("id", { count: "exact", head: true }).eq("status", "archived").is("deleted_at", null),
    supabase.from("equipment_enquiries").select("id", { count: "exact", head: true }),
    supabase.from("equipment_enquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("equipment_brands").select("id", { count: "exact", head: true }),
    supabase.from("equipment_categories").select("id", { count: "exact", head: true }),
  ]);

  return {
    total_models: totalCount || 0,
    published_models: publishedCount || 0,
    draft_models: draftCount || 0,
    archived_models: archivedCount || 0,
    total_enquiries: totalEnquiriesCount || 0,
    new_enquiries: newEnquiriesCount || 0,
    total_brands: brandsCount || 0,
    total_categories: categoriesCount || 0,
  };
});

/**
 * Paginated, filtered list of equipment models for the admin table
 */
export const getEquipmentAdminList = cache(
  async (params: EquipmentAdminFilterParams): Promise<EquipmentAdminListResponse> => {
    const supabase = await createSupabaseServerClient();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(Math.max(1, params.pageSize || 10), 100);
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("equipment_models")
      .select(
        `
        id,
        slug,
        model_name,
        model_number,
        brand_id,
        category_id,
        power,
        status,
        is_featured,
        max_platform_height_m,
        max_working_height_m,
        capacity_kg,
        weight_kg,
        primary_image_url,
        cover_path,
        rental_available,
        purchase_available,
        sort_weight,
        version,
        published_at,
        updated_at,
        deleted_at,
        brand:equipment_brands!inner(id, name, logo_url),
        category:equipment_categories!inner(id, name),
        media:equipment_media(count),
        documents:equipment_documents(count),
        specifications:equipment_specifications(count)
      `,
        { count: "exact" }
      );

    // Filter by lifecycle status
    if (params.status === "trash") {
      query = query.not("deleted_at", "is", null);
    } else {
      query = query.is("deleted_at", null);
      if (params.status && params.status !== "all") {
        query = query.eq("status", params.status);
      }
    }

    if (params.category_id) {
      query = query.eq("category_id", params.category_id);
    }

    if (params.brand_id) {
      query = query.eq("brand_id", params.brand_id);
    }

    if (params.power) {
      query = query.eq("power", params.power);
    }

    if (params.search) {
      query = query.or(
        `model_name.ilike.%${params.search}%,model_number.ilike.%${params.search}%,slug.ilike.%${params.search}%`
      );
    }

    // Sort order
    switch (params.sort) {
      case "updated_asc":
        query = query.order("updated_at", { ascending: true });
        break;
      case "name_asc":
        query = query.order("model_name", { ascending: true });
        break;
      case "name_desc":
        query = query.order("model_name", { ascending: false });
        break;
      case "height_desc":
        query = query.order("max_platform_height_m", { ascending: false, nullsFirst: false });
        break;
      case "capacity_desc":
        query = query.order("capacity_kg", { ascending: false, nullsFirst: false });
        break;
      case "updated_desc":
      default:
        query = query.order("sort_weight", { ascending: false }).order("updated_at", { ascending: false });
        break;
    }

    query = query.range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("[DAL] Error fetching admin equipment list:", error);
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 1,
      };
    }

    const items: EquipmentAdminListItem[] = (data || []).map((row: any) => ({
      id: row.id,
      slug: row.slug,
      model_name: row.model_name,
      model_number: row.model_number,
      brand_id: row.brand_id,
      brand_name: row.brand?.name || "Unknown Brand",
      brand_logo: row.brand?.logo_url || null,
      category_id: row.category_id,
      category_name: row.category?.name || "Unknown Category",
      power: row.power,
      status: row.status,
      is_featured: row.is_featured,
      max_platform_height_m: row.max_platform_height_m,
      max_working_height_m: row.max_working_height_m,
      capacity_kg: row.capacity_kg,
      weight_kg: row.weight_kg,
      primary_image_url: row.primary_image_url,
      cover_path: row.cover_path,
      rental_available: row.rental_available,
      purchase_available: row.purchase_available,
      sort_weight: row.sort_weight || 0,
      version: row.version || 1,
      published_at: row.published_at,
      updated_at: row.updated_at,
      media_count: row.media?.[0]?.count || 0,
      docs_count: row.documents?.[0]?.count || 0,
      specs_count: row.specifications?.[0]?.count || 0,
    }));

    const total = count || 0;
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }
);

/**
 * Fetch full equipment model with all relational specifications, media, documents, and definitions
 */
export const getEquipmentAdminDetail = cache(
  async (id: string): Promise<EquipmentModelWithRelations | null> => {
    const supabase = await createSupabaseServerClient();

    const { data: model, error } = await supabase
      .from("equipment_models")
      .select(`
        *,
        brand:equipment_brands(*),
        category:equipment_categories(
          *,
          segment:equipment_segments(*)
        ),
        specifications:equipment_specifications(
          *,
          definition:equipment_spec_definitions(*)
        ),
        media:equipment_media(*),
        documents:equipment_documents(*)
      `)
      .eq("id", id)
      .single();

    if (error || !model) {
      console.error("[DAL] Error fetching admin equipment detail:", error);
      return null;
    }

    // Sort specifications by definition sort order
    if (model.specifications) {
      model.specifications.sort(
        (a: any, b: any) => (a.definition?.sort_order || 0) - (b.definition?.sort_order || 0)
      );
    }

    // Sort media by sort_order
    if (model.media) {
      model.media.sort((a: any, b: any) => a.sort_order - b.sort_order);
    }

    // Sort documents by created_at
    if (model.documents) {
      model.documents.sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return model as EquipmentModelWithRelations;
  }
);

/**
 * Fetch dropdown options for brands, categories, and spec definitions
 */
export const getEquipmentFilterOptions = cache(async () => {
  const supabase = await createSupabaseServerClient();

  const [{ data: brands }, { data: categories }, { data: specDefinitions }] = await Promise.all([
    supabase.from("equipment_brands").select("id, name, slug, logo_url").order("name"),
    supabase.from("equipment_categories").select("id, name, slug, segment_id").order("name"),
    supabase.from("equipment_spec_definitions").select("*").order("sort_order"),
  ]);

  return {
    brands: (brands as EquipmentBrand[]) || [],
    categories: (categories as EquipmentCategory[]) || [],
    specDefinitions: specDefinitions || [],
  };
});

/**
 * Fetch customer enquiries submitted for equipment
 */
export const getEquipmentEnquiriesList = cache(
  async (options?: { status?: string; page?: number; pageSize?: number }) => {
    const supabase = await createSupabaseServerClient();
    const page = Math.max(1, options?.page || 1);
    const pageSize = Math.min(Math.max(1, options?.pageSize || 20), 100);
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("equipment_enquiries")
      .select(
        `
        *,
        equipment:equipment_models(id, model_name, model_number, slug, primary_image_url)
      `,
        { count: "exact" }
      );

    if (options?.status && options.status !== "all") {
      query = query.eq("status", options.status);
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("[DAL] Error fetching equipment enquiries:", error);
      return {
        enquiries: [],
        total: 0,
        page,
        pageSize,
        totalPages: 1,
      };
    }

    const total = count || 0;
    return {
      enquiries: data as (EquipmentEnquiry & { equipment?: any })[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }
);
