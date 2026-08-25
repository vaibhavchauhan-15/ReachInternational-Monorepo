import { z } from "zod";

export const PaginationParamsSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(100).optional().default(20),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const DateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const FilterParamsSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  dateRange: DateRangeSchema.optional(),
});

export type PaginationParamsInput = z.infer<typeof PaginationParamsSchema>;
export type DateRangeInput = z.infer<typeof DateRangeSchema>;
export type FilterParamsInput = z.infer<typeof FilterParamsSchema>;
