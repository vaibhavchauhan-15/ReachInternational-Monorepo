import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import {
  CLIENT_KEYS,
  serializeClientFilter,
  encodeClientCursor,
  decodeClientCursor,
  type ClientDirectoryFilter,
} from "@reachinternational/utils";
import type { CRMClient } from "@/lib/types/database";

export interface PaginatedClientsResponse {
  clients: CRMClient[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore?: boolean;
  nextCursor?: string | null;
  prevCursor?: string | null;
}

/**
 * Lean column projection strictly required for the Client Directory list view.
 * Excludes heavy billing addresses, audit history, relational equipment, and machine logs.
 */
export const CLIENT_LIST_COLUMNS =
  "id, code, company_name, contact_person, phone, gstin, pan_number, street, city, district, state, pincode, is_billing_address_different, status, deleted_at";

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  company_name: "company_name",
  code: "code",
  contact_person: "contact_person",
  city: "city",
  status: "status",
  created_at: "created_at",
};

/**
 * Formats database rows into CRMClient with computed unified address string and default flags.
 */
function formatClientRecords(records: any[]): CRMClient[] {
  return records.map((client) => {
    const street = (client.street || "").trim();
    const fullAddress = [street, client.city, client.district, client.state, client.pincode]
      .filter(Boolean)
      .map((s) => String(s).trim())
      .filter(Boolean)
      .join(", ");

    return {
      ...client,
      street,
      address: fullAddress,
      client_name: client.company_name,
      machine_count: 0,
      open_complaints: 0,
      status: client.status ?? "active",
    };
  });
}

/**
 * Cached paginated client list fetcher using Next.js unstable_cache.
 * Uses canonical cache key: clients:list:{filters}
 * Validates inputs, uses server-side filtering, sorting, and pagination.
 * Supports standard offset pagination (10, 25, 50, 100) and keyset/cursor pagination for large datasets.
 * Short TTL: 60s (CACHE_TIERS.CLASS_B_FLEET).
 */
function getCachedClientList(filter?: ClientDirectoryFilter) {
  const cacheKey = CLIENT_KEYS.list(filter);
  return unstable_cache(
    async (): Promise<PaginatedClientsResponse> => {
      const supabase = createSupabaseAdminClient();
      const page = Math.max(1, filter?.page ?? 1);
      const pageSize = Math.max(1, Math.min(filter?.pageSize ?? 10, 100));
      const isCursorMode = Boolean(filter?.afterCursor || filter?.beforeCursor);

      let query = supabase
        .from("clients")
        .select(CLIENT_LIST_COLUMNS, { count: isCursorMode ? undefined : "exact" });

      // Status Filter (Uses idx_clients_cursor_active or idx_clients_status)
      if (filter?.status === "active") {
        query = query.eq("status", "active").is("deleted_at", null);
      } else if (filter?.status === "inactive") {
        query = query.or("status.eq.inactive,deleted_at.not.is.null");
      }

      // State Filter (Uses idx_clients_state_trgm)
      if (filter?.state && filter.state !== "all") {
        query = query.ilike("state", filter.state);
      }

      // District Filter (Uses idx_clients_district / idx_clients_district_trgm)
      if (filter?.district && filter.district !== "all") {
        query = query.ilike("district", filter.district);
      }

      // City Filter (Uses idx_clients_city)
      if (filter?.city && filter.city !== "all") {
        query = query.eq("city", filter.city);
      }

      // Full-Text Search (Accelerated by PostgreSQL GIN Trigram indexes)
      if (filter?.search && filter.search.trim()) {
        const s = filter.search.trim().replace(/[,()"\\]/g, "");
        if (s) {
          query = query.or(
            `company_name.ilike.%${s}%,code.ilike.%${s}%,gstin.ilike.%${s}%,pan_number.ilike.%${s}%,contact_person.ilike.%${s}%,phone.ilike.%${s}%,city.ilike.%${s}%,district.ilike.%${s}%,state.ilike.%${s}%`
          );
        }
      }

      // Server-Side Sorting & Cursor Seeks
      const sortCol = ALLOWED_SORT_COLUMNS[filter?.sortField || filter?.sort || "company_name"] || "company_name";
      const ascending = filter?.sortOrder !== "desc";

      if (filter?.afterCursor) {
        const decoded = decodeClientCursor(filter.afterCursor);
        if (decoded) {
          const safeVal = String(decoded.sortValue ?? "").replace(/[,()"\\]/g, "");
          if (ascending) {
            query = query.or(`${sortCol}.gt."${safeVal}",and(${sortCol}.eq."${safeVal}",id.gt."${decoded.id}")`);
          } else {
            query = query.or(`${sortCol}.lt."${safeVal}",and(${sortCol}.eq."${safeVal}",id.lt."${decoded.id}")`);
          }
        }
      } else if (filter?.beforeCursor) {
        const decoded = decodeClientCursor(filter.beforeCursor);
        if (decoded) {
          const safeVal = String(decoded.sortValue ?? "").replace(/[,()"\\]/g, "");
          if (ascending) {
            query = query.or(`${sortCol}.lt."${safeVal}",and(${sortCol}.eq."${safeVal}",id.lt."${decoded.id}")`);
          } else {
            query = query.or(`${sortCol}.gt."${safeVal}",and(${sortCol}.eq."${safeVal}",id.gt."${decoded.id}")`);
          }
        }
      }

      // Order by primary sort column + deterministic primary key tiebreaker (id)
      query = query
        .order(sortCol, { ascending })
        .order("id", { ascending });

      let records: any[] = [];
      let totalCount = 0;
      let hasMore = false;

      if (isCursorMode) {
        // Keyset Cursor Pagination: fetch pageSize + 1 to determine hasMore without full count scan
        const { data, error } = await query.limit(pageSize + 1);
        if (error) {
          console.error("Error in getClientList cursor query:", error.message || error);
          return { clients: [], total: 0, page: 1, pageSize, totalPages: 0, hasMore: false };
        }
        const rows = (data as any[]) ?? [];
        if (rows.length > pageSize) {
          hasMore = true;
          records = rows.slice(0, pageSize);
        } else {
          hasMore = false;
          records = rows;
        }
        totalCount = records.length;
      } else {
        // Standard Offset Pagination with Exact Count
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, count, error } = await query.range(from, to);

        if (error) {
          console.error("Error in getClientList query:", error.message || error);
          return { clients: [], total: 0, page, pageSize, totalPages: 0, hasMore: false };
        }

        records = (data as any[]) ?? [];
        totalCount = count ?? 0;
        hasMore = page * pageSize < totalCount;
      }

      const clients = formatClientRecords(records);

      // Compute deterministic cursors from boundary items
      const firstItem = clients[0];
      const lastItem = clients[clients.length - 1];
      const nextCursor =
        hasMore && lastItem
          ? encodeClientCursor(lastItem[sortCol as keyof CRMClient] ?? lastItem.company_name, lastItem.id)
          : null;
      const prevCursor =
        (page > 1 || filter?.afterCursor) && firstItem
          ? encodeClientCursor(firstItem[sortCol as keyof CRMClient] ?? firstItem.company_name, firstItem.id)
          : null;

      return {
        clients,
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasMore,
        nextCursor,
        prevCursor,
      };
    },
    [cacheKey],
    {
      revalidate: CACHE_TIERS.CLASS_B_FLEET, // 60s short TTL
      tags: [TAGS.clientsList, TAGS.clients],
    }
  )();
}

/**
 * Top-level paginated client list query service.
 * Uses canonical cache key: clients:list:{filters}
 * Deduplicates in-flight calls within a single render pass via React cache().
 */
export const getClientList = cache(
  async (filter?: ClientDirectoryFilter): Promise<PaginatedClientsResponse> => {
    return getCachedClientList(filter);
  }
);

// Backward-compatible alias
export const getPaginatedClientsList = getClientList;
