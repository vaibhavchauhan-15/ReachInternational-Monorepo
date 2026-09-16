import "server-only";

export * from "@reachinternational/utils";

/**
 * Client Directory Server Cache Tags & Granular Revalidation Helpers
 * Used with Next.js revalidateTag() across client mutations.
 */
export const CLIENTS_CACHE_TAGS = {
  // Domain Root
  clients: "clients",

  // Sub-domains
  list: "clients:list",
  kpis: "clients:kpis",
  locations: "clients:locations",

  // Granular Entity Tags
  clientDetail: (id: string) => `client:${id}`,
} as const;

export type ClientsCacheTag =
  | (typeof CLIENTS_CACHE_TAGS)[keyof Omit<typeof CLIENTS_CACHE_TAGS, "clientDetail">]
  | string;
