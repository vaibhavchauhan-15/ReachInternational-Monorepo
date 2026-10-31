import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type {
  EquipmentSegment,
  EquipmentCategory,
  EquipmentBrand,
  EquipmentModel,
  EquipmentModelWithRelations,
  EquipmentFilterParams,
  EquipmentSpecification,
  EquipmentSpecDefinition,
  EquipmentMedia,
  EquipmentDocument,
} from "@reachinternational/types";

// ============================================================================
// 1. Equipment Segments Query (AWP, MHE, Other)
// ============================================================================

const getCachedEquipmentSegments = unstable_cache(
  async (): Promise<EquipmentSegment[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("equipment_segments")
      .select("id, name, slug, description, sort_order, created_at")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[DAL] Error fetching equipment segments:", error);
      return [];
    }

    return (data as EquipmentSegment[]) || [];
  },
  ["equipment-segments-v1"],
  {
    revalidate: CACHE_TIERS.CLASS_A_STATIC,
    tags: [TAGS.equipment, TAGS.equipmentCategories],
  }
);

export const getEquipmentSegments = cache(async (): Promise<EquipmentSegment[]> => {
  return getCachedEquipmentSegments();
});

// ============================================================================
// 2. Equipment Categories Query (with model count & segment)
// ============================================================================

export interface CategoryWithMeta extends EquipmentCategory {
  segment: EquipmentSegment;
  models_count: number;
}

const getCachedEquipmentCategories = unstable_cache(
  async (segmentSlug?: string): Promise<CategoryWithMeta[]> => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("equipment_categories")
      .select(`
        id,
        segment_id,
        name,
        slug,
        description,
        image_url,
        sort_order,
        is_published,
        created_at,
        updated_at,
        segment:equipment_segments!inner(
          id,
          name,
          slug,
          description,
          sort_order,
          created_at
        )
      `)
      .eq("is_published", true)
      .order("sort_order", { ascending: true });

    if (segmentSlug) {
      query = query.eq("segment.slug", segmentSlug);
    }

    const { data: categories, error } = await query;

    if (error || !categories) {
      console.error("[DAL] Error fetching equipment categories:", error);
      return [];
    }

    // Fetch model counts per category
    const { data: modelCounts } = await supabase
      .from("equipment_models")
      .select("category_id")
      .eq("is_published", true);

    const countMap: Record<string, number> = {};
    if (modelCounts) {
      for (const m of modelCounts) {
        countMap[m.category_id] = (countMap[m.category_id] || 0) + 1;
      }
    }

    return categories.map((cat: any) => ({
      ...cat,
      models_count: countMap[cat.id] || 0,
    })) as CategoryWithMeta[];
  },
  ["equipment-categories-with-counts-v1"],
  {
    revalidate: CACHE_TIERS.CLASS_A_STATIC,
    tags: [TAGS.equipment, TAGS.equipmentCategories],
  }
);

export const getEquipmentCategories = cache(
  async (segmentSlug?: string): Promise<CategoryWithMeta[]> => {
    return getCachedEquipmentCategories(segmentSlug);
  }
);

export const getCategoryBySlug = cache(
  async (categorySlug: string): Promise<CategoryWithMeta | null> => {
    const all = await getEquipmentCategories();
    return all.find((c) => c.slug === categorySlug) || null;
  }
);

export const getSegmentBySlug = cache(
  async (segmentSlug: string): Promise<EquipmentSegment | null> => {
    const segments = await getEquipmentSegments();
    return segments.find((s) => s.slug === segmentSlug) || null;
  }
);

// ============================================================================
// 3. Equipment Brands Query (Partner OEMs with published equipment)
// ============================================================================

export interface BrandWithMeta extends EquipmentBrand {
  models_count: number;
}

const getCachedEquipmentBrands = unstable_cache(
  async (): Promise<BrandWithMeta[]> => {
    const supabase = createSupabaseAdminClient();
    const { data: brands, error } = await supabase
      .from("equipment_brands")
      .select("id, name, slug, logo_url, dark_logo_url, website, is_partner, sort_order, created_at")
      .order("sort_order", { ascending: true });

    if (error || !brands) {
      console.error("[DAL] Error fetching equipment brands:", error);
      return [];
    }

    // Count published models per brand
    const { data: models } = await supabase
      .from("equipment_models")
      .select("brand_id")
      .eq("is_published", true);

    const countMap: Record<string, number> = {};
    if (models) {
      for (const m of models) {
        countMap[m.brand_id] = (countMap[m.brand_id] || 0) + 1;
      }
    }

    // Only return brands that actually have published equipment
    return brands
      .map((b) => ({
        ...b,
        models_count: countMap[b.id] || 0,
      }))
      .filter((b) => b.models_count > 0);
  },
  ["equipment-brands-v1"],
  {
    revalidate: CACHE_TIERS.CLASS_A_STATIC,
    tags: [TAGS.equipment, TAGS.equipmentBrands],
  }
);

export const getEquipmentBrands = cache(async (): Promise<BrandWithMeta[]> => {
  return getCachedEquipmentBrands();
});

// ============================================================================
// 4. Featured Equipment Query (Homepage & Landing Showcase)
// ============================================================================

export interface FeaturedEquipmentCard extends EquipmentModel {
  brand: EquipmentBrand;
  category: EquipmentCategory & { segment: EquipmentSegment };
  key_specifications: Array<{
    name: string;
    value: string;
    unit: string | null;
  }>;
}

const getCachedFeaturedEquipment = unstable_cache(
  async (limit = 6): Promise<FeaturedEquipmentCard[]> => {
    const supabase = createSupabaseAdminClient();
    const { data: models, error } = await supabase
      .from("equipment_models")
      .select(`
        id,
        brand_id,
        category_id,
        model_name,
        model_number,
        slug,
        subtype,
        short_description,
        full_description,
        primary_image_url,
        is_featured,
        is_published,
        rental_available,
        purchase_available,
        primary_working_height,
        primary_capacity,
        primary_power_source,
        applications,
        features,
        created_at,
        updated_at,
        brand:equipment_brands!inner(
          id,
          name,
          slug,
          logo_url,
          dark_logo_url,
          website,
          is_partner,
          sort_order,
          created_at
        ),
        category:equipment_categories!inner(
          id,
          segment_id,
          name,
          slug,
          description,
          image_url,
          sort_order,
          is_published,
          created_at,
          updated_at,
          segment:equipment_segments!inner(
            id,
            name,
            slug,
            description,
            sort_order,
            created_at
          )
        )
      `)
      .eq("is_published", true)
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !models) {
      console.error("[DAL] Error fetching featured equipment:", error);
      return [];
    }

    // Fetch key specifications for these models
    const modelIds = models.map((m) => m.id);
    const { data: specs } = await supabase
      .from("equipment_specifications")
      .select(`
        equipment_id,
        spec_value,
        sort_order,
        definition:equipment_spec_definitions!inner(
          name,
          unit,
          group_name
        )
      `)
      .in("equipment_id", modelIds)
      .eq("is_key_spec", true)
      .order("sort_order", { ascending: true });

    const specsByModel: Record<string, Array<{ name: string; value: string; unit: string | null }>> = {};
    if (specs) {
      for (const s of specs as any[]) {
        if (!specsByModel[s.equipment_id]) {
          specsByModel[s.equipment_id] = [];
        }
        specsByModel[s.equipment_id].push({
          name: s.definition?.name || "",
          value: s.spec_value,
          unit: s.definition?.unit || null,
        });
      }
    }

    return models.map((m: any) => ({
      ...m,
      key_specifications: (specsByModel[m.id] || []).slice(0, 3),
    })) as FeaturedEquipmentCard[];
  },
  ["equipment-featured-v1"],
  {
    revalidate: CACHE_TIERS.CLASS_B_SEMI_DYNAMIC,
    tags: [TAGS.equipment, TAGS.equipmentList],
  }
);

export const getFeaturedEquipment = cache(async (limit = 6): Promise<FeaturedEquipmentCard[]> => {
  return getCachedFeaturedEquipment(limit);
});

// ============================================================================
// 5. Equipment Filter & Search Query
// ============================================================================

export interface EquipmentListResult {
  items: FeaturedEquipmentCard[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getEquipmentList(
  params: EquipmentFilterParams
): Promise<EquipmentListResult> {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(48, Number(params.limit) || 12));
  const offset = (page - 1) * limit;

  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("equipment_models")
    .select(
      `
        id,
        brand_id,
        category_id,
        model_name,
        model_number,
        slug,
        subtype,
        short_description,
        full_description,
        primary_image_url,
        is_featured,
        is_published,
        rental_available,
        purchase_available,
        primary_working_height,
        primary_capacity,
        primary_power_source,
        applications,
        features,
        created_at,
        updated_at,
        brand:equipment_brands!inner(
          id,
          name,
          slug,
          logo_url,
          dark_logo_url,
          website,
          is_partner,
          sort_order,
          created_at
        ),
        category:equipment_categories!inner(
          id,
          segment_id,
          name,
          slug,
          description,
          image_url,
          sort_order,
          is_published,
          created_at,
          updated_at,
          segment:equipment_segments!inner(
            id,
            name,
            slug,
            description,
            sort_order,
            created_at
          )
        )
      `,
      { count: "exact" }
    )
    .eq("is_published", true);

  // Filter by segment slug
  if (params.segment) {
    query = query.eq("category.segment.slug", params.segment);
  }

  // Filter by category slug
  if (params.category) {
    query = query.eq("category.slug", params.category);
  }

  // Filter by brand slug
  if (params.brand) {
    query = query.eq("brand.slug", params.brand);
  }

  // Filter by subtype
  if (params.subtype) {
    query = query.ilike("subtype", `%${params.subtype}%`);
  }

  // Filter by power source
  if (params.power) {
    query = query.ilike("primary_power_source", `%${params.power}%`);
  }

  // Filter by rental availability
  if (params.rental) {
    query = query.eq("rental_available", true);
  }

  // Filter by purchase availability
  if (params.purchase) {
    query = query.eq("purchase_available", true);
  }

  // Search by text query across name, model number, description
  if (params.query && params.query.trim()) {
    const q = params.query.trim();
    query = query.or(
      `model_name.ilike.%${q}%,model_number.ilike.%${q}%,short_description.ilike.%${q}%,subtype.ilike.%${q}%`
    );
  }

  // Sorting
  switch (params.sort) {
    case "name_asc":
      query = query.order("model_name", { ascending: true });
      break;
    case "name_desc":
      query = query.order("model_name", { ascending: false });
      break;
    case "height_asc":
      query = query.order("primary_working_height", { ascending: true, nullsFirst: false });
      break;
    case "height_desc":
      query = query.order("primary_working_height", { ascending: false, nullsFirst: false });
      break;
    case "featured":
    default:
      query = query
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data: models, count, error } = await query;

  if (error || !models) {
    console.error("[DAL] Error querying equipment list:", error);
    return {
      items: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
    };
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  // Fetch key specs for returned items
  const modelIds = models.map((m) => m.id);
  const { data: specs } = await supabase
    .from("equipment_specifications")
    .select(`
      equipment_id,
      spec_value,
      sort_order,
      definition:equipment_spec_definitions!inner(
        name,
        unit,
        group_name
      )
    `)
    .in("equipment_id", modelIds)
    .eq("is_key_spec", true)
    .order("sort_order", { ascending: true });

  const specsByModel: Record<string, Array<{ name: string; value: string; unit: string | null }>> = {};
  if (specs) {
    for (const s of specs as any[]) {
      if (!specsByModel[s.equipment_id]) {
        specsByModel[s.equipment_id] = [];
      }
      specsByModel[s.equipment_id].push({
        name: s.definition?.name || "",
        value: s.spec_value,
        unit: s.definition?.unit || null,
      });
    }
  }

  const items = models.map((m: any) => ({
    ...m,
    key_specifications: (specsByModel[m.id] || []).slice(0, 3),
  })) as FeaturedEquipmentCard[];

  return {
    items,
    total,
    page,
    limit,
    totalPages,
  };
}

// ============================================================================
// 6. Available Filter Options Generator (Derived from Real Published Data)
// ============================================================================

export interface FilterOptions {
  brands: Array<{ label: string; value: string; count: number }>;
  subtypes: Array<{ label: string; value: string; count: number }>;
  powerSources: Array<{ label: string; value: string; count: number }>;
  rentalCount: number;
  purchaseCount: number;
}

export const getAvailableFilters = cache(
  async (categorySlug?: string, segmentSlug?: string): Promise<FilterOptions> => {
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("equipment_models")
      .select(`
        id,
        subtype,
        primary_power_source,
        rental_available,
        purchase_available,
        brand:equipment_brands!inner(
          name,
          slug
        ),
        category:equipment_categories!inner(
          slug,
          segment:equipment_segments!inner(
            slug
          )
        )
      `)
      .eq("is_published", true);

    if (categorySlug) {
      query = query.eq("category.slug", categorySlug);
    } else if (segmentSlug) {
      query = query.eq("category.segment.slug", segmentSlug);
    }

    const { data: models, error } = await query;

    if (error || !models) {
      return {
        brands: [],
        subtypes: [],
        powerSources: [],
        rentalCount: 0,
        purchaseCount: 0,
      };
    }

    const brandCounts: Record<string, { label: string; value: string; count: number }> = {};
    const subtypeCounts: Record<string, { label: string; value: string; count: number }> = {};
    const powerCounts: Record<string, { label: string; value: string; count: number }> = {};
    let rentalCount = 0;
    let purchaseCount = 0;

    for (const m of models as any[]) {
      if (m.brand?.slug) {
        if (!brandCounts[m.brand.slug]) {
          brandCounts[m.brand.slug] = { label: m.brand.name, value: m.brand.slug, count: 0 };
        }
        brandCounts[m.brand.slug].count++;
      }

      if (m.subtype) {
        const sub = m.subtype.trim();
        if (!subtypeCounts[sub]) {
          subtypeCounts[sub] = { label: sub, value: sub, count: 0 };
        }
        subtypeCounts[sub].count++;
      }

      if (m.primary_power_source) {
        const raw = m.primary_power_source.toLowerCase();
        let normalized = "Other";
        if (raw.includes("electric") || raw.includes("battery")) normalized = "Electric / Battery";
        else if (raw.includes("diesel")) normalized = "Diesel";
        else if (raw.includes("lpg") || raw.includes("gas")) normalized = "LPG / Petrol";

        if (!powerCounts[normalized]) {
          powerCounts[normalized] = { label: normalized, value: normalized.toLowerCase().split(" ")[0], count: 0 };
        }
        powerCounts[normalized].count++;
      }

      if (m.rental_available) rentalCount++;
      if (m.purchase_available) purchaseCount++;
    }

    return {
      brands: Object.values(brandCounts).sort((a, b) => b.count - a.count),
      subtypes: Object.values(subtypeCounts).sort((a, b) => b.count - a.count),
      powerSources: Object.values(powerCounts).sort((a, b) => b.count - a.count),
      rentalCount,
      purchaseCount,
    };
  }
);

// ============================================================================
// 7. Equipment Detail Query by Model Slug
// ============================================================================

export interface GroupedSpecifications {
  groupName: string;
  specs: Array<{
    name: string;
    code: string;
    value: string;
    unit: string | null;
    isKeySpec: boolean;
  }>;
}

export interface EquipmentDetailData extends EquipmentModel {
  brand: EquipmentBrand;
  category: EquipmentCategory & { segment: EquipmentSegment };
  groupedSpecifications: GroupedSpecifications[];
  keySpecifications: Array<{
    name: string;
    value: string;
    unit: string | null;
  }>;
  media: EquipmentMedia[];
  documents: EquipmentDocument[];
}

export const getEquipmentBySlug = cache(
  async (slug: string): Promise<EquipmentDetailData | null> => {
    const supabase = createSupabaseAdminClient();

    // 1. Fetch model with brand and category
    const { data: model, error } = await supabase
      .from("equipment_models")
      .select(`
        id,
        brand_id,
        category_id,
        model_name,
        model_number,
        slug,
        subtype,
        short_description,
        full_description,
        primary_image_url,
        is_featured,
        is_published,
        rental_available,
        purchase_available,
        primary_working_height,
        primary_capacity,
        primary_power_source,
        applications,
        features,
        created_at,
        updated_at,
        brand:equipment_brands!inner(
          id,
          name,
          slug,
          logo_url,
          dark_logo_url,
          website,
          is_partner,
          sort_order,
          created_at
        ),
        category:equipment_categories!inner(
          id,
          segment_id,
          name,
          slug,
          description,
          image_url,
          sort_order,
          is_published,
          created_at,
          updated_at,
          segment:equipment_segments!inner(
            id,
            name,
            slug,
            description,
            sort_order,
            created_at
          )
        )
      `)
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (error || !model) {
      return null;
    }

    // 2. Fetch specifications, media, and documents in parallel
    const [specsRes, mediaRes, docsRes] = await Promise.all([
      supabase
        .from("equipment_specifications")
        .select(`
          id,
          spec_value,
          is_key_spec,
          sort_order,
          definition:equipment_spec_definitions!inner(
            id,
            group_name,
            name,
            code,
            unit,
            sort_order
          )
        `)
        .eq("equipment_id", model.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("equipment_media")
        .select("id, equipment_id, media_url, media_type, alt_text, sort_order, is_primary, created_at")
        .eq("equipment_id", model.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("equipment_documents")
        .select("id, equipment_id, title, document_type, file_url, file_size_bytes, mime_type, is_published, created_at")
        .eq("equipment_id", model.id)
        .eq("is_published", true)
        .order("created_at", { ascending: true }),
    ]);

    // Group specifications logically
    const groupMap: Record<string, GroupedSpecifications> = {};
    const keySpecifications: Array<{ name: string; value: string; unit: string | null }> = [];

    if (specsRes.data) {
      for (const s of specsRes.data as any[]) {
        const group = s.definition?.group_name || "General Specifications";
        if (!groupMap[group]) {
          groupMap[group] = {
            groupName: group,
            specs: [],
          };
        }

        const item = {
          name: s.definition?.name || "",
          code: s.definition?.code || "",
          value: s.spec_value,
          unit: s.definition?.unit || null,
          isKeySpec: s.is_key_spec,
        };

        groupMap[group].specs.push(item);

        if (s.is_key_spec) {
          keySpecifications.push({
            name: item.name,
            value: item.value,
            unit: item.unit,
          });
        }
      }
    }

    // Ensure primary image is at start of media array
    const media: EquipmentMedia[] = (mediaRes.data as EquipmentMedia[]) || [];
    if (!media.some((m) => m.media_url === model.primary_image_url)) {
      media.unshift({
        id: `primary-${model.id}`,
        equipment_id: model.id,
        media_url: model.primary_image_url,
        media_type: "image",
        alt_text: `${model.model_name} primary view`,
        sort_order: 0,
        is_primary: true,
        created_at: model.created_at,
      });
    }

    return {
      ...(model as any),
      groupedSpecifications: Object.values(groupMap),
      keySpecifications,
      media,
      documents: (docsRes.data as EquipmentDocument[]) || [],
    };
  }
);

// ============================================================================
// 8. Related Equipment Query
// ============================================================================

export const getRelatedEquipment = cache(
  async (
    currentModelId: string,
    categoryId: string,
    limit = 3
  ): Promise<FeaturedEquipmentCard[]> => {
    const supabase = createSupabaseAdminClient();
    const { data: models, error } = await supabase
      .from("equipment_models")
      .select(`
        id,
        brand_id,
        category_id,
        model_name,
        model_number,
        slug,
        subtype,
        short_description,
        full_description,
        primary_image_url,
        is_featured,
        is_published,
        rental_available,
        purchase_available,
        primary_working_height,
        primary_capacity,
        primary_power_source,
        applications,
        features,
        created_at,
        updated_at,
        brand:equipment_brands!inner(
          id,
          name,
          slug,
          logo_url,
          dark_logo_url,
          website,
          is_partner,
          sort_order,
          created_at
        ),
        category:equipment_categories!inner(
          id,
          segment_id,
          name,
          slug,
          description,
          image_url,
          sort_order,
          is_published,
          created_at,
          updated_at,
          segment:equipment_segments!inner(
            id,
            name,
            slug,
            description,
            sort_order,
            created_at
          )
        )
      `)
      .eq("is_published", true)
      .eq("category_id", categoryId)
      .neq("id", currentModelId)
      .limit(limit);

    if (error || !models) {
      return [];
    }

    return models.map((m: any) => ({
      ...m,
      key_specifications: [],
    })) as FeaturedEquipmentCard[];
  }
);
