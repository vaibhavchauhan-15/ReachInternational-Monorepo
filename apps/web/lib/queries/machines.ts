import "server-only";

/**
 * Backward compatibility facade.
 * Re-exports the centralized Machine Data Access Layer (DAL) from `@/lib/data/machines`.
 */
export * from "@/lib/data/machines";

// Alias getMachineList to getMachines for existing consumers
import { getMachineList } from "@/lib/data/machines";
export const getMachines = getMachineList;