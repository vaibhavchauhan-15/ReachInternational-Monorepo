/**
 * Centralized Machine Data Access Layer (DAL)
 * Unified boundary for all Machine-related data operations:
 * - List queries (slim projections, parallel hydration, server filtering/sorting/pagination)
 * - KPI queries (high-performance scalar RPC get_machines_directory_summary)
 * - Detail & shift assignment queries (complete specifications, active rental contracts)
 * - Full-fleet search queries (GIN trigram indexed search suggestions)
 * - Filter options queries (cached directory master data)
 * - Mutations (typed creations, updates, deactivations, uniqueness validation, audit logging)
 */

export * from "./machine-list";
export * from "./machine-kpis";
export * from "./machine-detail";
export * from "./machine-search";
export * from "./machine-filters";
export * from "./machine-mutations";
export * from "./machine-export";
