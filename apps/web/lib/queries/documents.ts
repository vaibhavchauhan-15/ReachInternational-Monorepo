import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { DocumentRecord } from "@/lib/types/database";

const getCachedDocuments = unstable_cache(
  async (branchId?: string, entityType?: string, status?: string): Promise<DocumentRecord[]> => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("documents")
      .select("id, document_name, entity_type, entity_id, entity_label, document_type, file_url, status, expiry_date, branch_id, owner_id, created_at")
      .order("created_at", { ascending: false });

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }
    if (entityType) {
      query = query.eq("entity_type", entityType);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching documents:", error);
      return [];
    }

    return (data as DocumentRecord[]) ?? [];
  },
  ["documents-list-v1"],
  {
    revalidate: CACHE_TIERS.CLASS_B_DIRECTORY,
    tags: [TAGS.documents],
  }
);

export const getDocuments = cache(async (branchId?: string, entityType?: string, status?: string): Promise<DocumentRecord[]> => {
  return getCachedDocuments(branchId, entityType, status);
});

export const getDocumentById = cache(async (id: string): Promise<DocumentRecord | null> => {
  const documents = await getDocuments();
  return documents.find((d) => d.id === id) ?? null;
});
