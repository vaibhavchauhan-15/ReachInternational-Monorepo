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
// `./keys` re-exports all of `@reachinternational/utils`, which now also provides a
// `dedupeShiftMonitorRows`. Re-export the operations-specific one explicitly so the two
// star exports stay unambiguous and this barrel keeps its current behaviour.
export { dedupeShiftMonitorRows } from "./today-shift-monitor";
export * from "./operations-filters";
export * from "./operations-machine-logs";
export * from "./operations-client-logs";
export * from "./operations-operator-logs";
export * from "./operations-assignments";
export * from "./operations-search";
export * from "./operations-log-detail";
export * from "./operations-read-model";
export * from "./today-shift-monitor";
