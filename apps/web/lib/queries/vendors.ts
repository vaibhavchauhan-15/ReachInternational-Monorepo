import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { Vendor } from "@/lib/types/database";

const getCachedVendors = unstable_cache(
  async (): Promise<Vendor[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("vendors")
      .select("id, vendor_name, code, contact_person, email, phone, category, city, rating, status, created_at")
      .order("vendor_name", { ascending: true });

    if (error) {
      console.error("Error fetching vendors:", error);
      return [];
    }

    return (data as Vendor[]) ?? [];
  },
  ["vendors-directory-list-v1"],
  {
    revalidate: CACHE_TIERS.CLASS_B_DIRECTORY,
    tags: [TAGS.vendors],
  }
);

export const getVendors = cache(async (): Promise<Vendor[]> => {
  return getCachedVendors();
});

export const getVendorById = cache(async (id: string): Promise<Vendor | null> => {
  const vendors = await getVendors();
  return vendors.find((v) => v.id === id) ?? null;
});
