import { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/env/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let baseUrl = "https://www.reachinternational.co.in";
  try {
    baseUrl = getAppUrl();
  } catch {
    // fallback
  }

  // Base static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/equipment`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${baseUrl}/careers`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/equipment/awp`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/equipment/mhe`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/account-deletion-guide`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  try {
    const supabase = createSupabaseAdminClient();

    // 1. Fetch published categories with segment slugs
    const { data: categories } = await supabase
      .from("equipment_categories")
      .select(`
        slug,
        updated_at,
        segment:equipment_segments!inner(slug)
      `)
      .eq("is_published", true);

    const categoryRoutes: MetadataRoute.Sitemap = (categories || []).map((cat: any) => ({
      url: `${baseUrl}/equipment/${cat.segment?.slug || "awp"}/${cat.slug}`,
      lastModified: new Date(cat.updated_at || Date.now()),
      changeFrequency: "weekly",
      priority: 0.85,
    }));

    // 2. Fetch all published equipment models
    const { data: models } = await supabase
      .from("equipment_models")
      .select(`
        slug,
        updated_at,
        category:equipment_categories!inner(
          slug,
          segment:equipment_segments!inner(slug)
        )
      `)
      .eq("is_published", true);

    const modelRoutes: MetadataRoute.Sitemap = (models || []).map((m: any) => ({
      url: `${baseUrl}/equipment/${m.category?.slug || "general"}/${m.slug}`,
      lastModified: new Date(m.updated_at || Date.now()),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    // 3. Fetch all published job postings
    const { data: jobs } = await supabase
      .from("job_postings")
      .select("slug, updated_at")
      .eq("status", "published")
      .is("deleted_at", null);

    const jobRoutes: MetadataRoute.Sitemap = (jobs || []).map((job: any) => ({
      url: `${baseUrl}/careers/${job.slug}`,
      lastModified: new Date(job.updated_at || Date.now()),
      changeFrequency: "weekly",
      priority: 0.85,
    }));

    return [...staticRoutes, ...categoryRoutes, ...modelRoutes, ...jobRoutes];
  } catch (error) {
    console.error("[Sitemap] Error fetching dynamic routes:", error);
    return staticRoutes;
  }
}
