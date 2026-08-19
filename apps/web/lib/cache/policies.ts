import "server-only";

/**
 * ServiceCentric Multi-Layer Performance Architecture
 * Data Freshness Policies & Revalidation Time Tiers (in Seconds)
 */
export const CACHE_TIERS = {
  /** Class A: Static / Slow-Changing Data (24 hours) - Categories, Tax Types, System Settings */
  CLASS_A_STATIC: 86400,

  /** Class A: Reference Taxonomies (1 hour) - Branches, Departments, Document Types, Manufacturers */
  CLASS_A_REFERENCE: 3600,

  /** Class B: Semi-Dynamic Directories (2 minutes) - Client Directory, Vendor Directory, Employee Directory */
  CLASS_B_DIRECTORY: 120,

  /** Class B: Catalogs & Summaries (5 minutes) - Product Catalog, Heavy Report Summaries */
  CLASS_B_CATALOG: 300,

  /** Class B: Machine Fleet Directory (1 minute) - Machine Directory, Model Specs */
  CLASS_B_FLEET: 60,

  /** Class C: Operational Data (15 seconds) - Complaints, Service Jobs, Service Dashboard Summaries */
  CLASS_C_OPERATIONAL: 15,

  /** Class D: Realtime / Critical Data (0 seconds / Fresh) - Stock Balance, PO Approvals, Meter Logs, Audit Logs */
  CLASS_D_FRESH: 0,
} as const;

export type CacheTierKey = keyof typeof CACHE_TIERS;
