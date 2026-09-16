/**
 * Centralized Operations Data Access Layer (DAL) Foundation
 *
 * Provides a canonical boundary for:
 * - Query keys & cache keys (hierarchical serialization for logs, assignments, filters, summaries)
 * - Server cache tags (targeted Next.js revalidateTag policies)
 * - Filter options caching (machines, clients, operators)
 * - Sub-tab isolated data loaders (machine logs, client logs, operator logs)
 */

export * from "./keys";
export * from "./operations-filters";
export * from "./operations-machine-logs";
export * from "./operations-client-logs";
export * from "./operations-operator-logs";
export * from "./operations-assignments";
export * from "./operations-search";
export * from "./operations-log-detail";
export * from "./operations-read-model";
