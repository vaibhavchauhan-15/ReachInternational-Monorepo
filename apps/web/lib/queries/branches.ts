import "server-only";
import { cache } from "react";

export interface Branch {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  status: string;
}

export interface BranchWithMetrics extends Branch {
  machines_count: number;
  employees_count: number;
  inventory_items_count: number;
  open_complaints_count: number;
}

export const getBranches = cache(async (): Promise<Branch[]> => {
  return [];
});

export const getBranchesWithMetrics = cache(async (): Promise<BranchWithMetrics[]> => {
  return [];
});
