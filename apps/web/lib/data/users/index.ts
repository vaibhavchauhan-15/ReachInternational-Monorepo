/**
 * Centralized User Data Access Layer (DAL)
 * Unified boundary for all User-related data operations:
 * - List queries (lean projections, in-memory cached hydration, server filtering/sorting/pagination)
 * - Single user queries (full detail projections, on-demand resolution)
 * - Master caches (supervisors, working locations, aggregates, options)
 */

export * from "./user-list";
export * from "./user-detail";
export * from "./user-shared";
