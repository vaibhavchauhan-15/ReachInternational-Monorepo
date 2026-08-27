import { z } from "zod";

export const PaginationParamsSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(100).optional().default(20),
  cursor: z.string().max(255).optional(),
  sortBy: z.string().max(100).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const DateRangeSchema = z.object({
  startDate: z.string().max(50).optional(),
  endDate: z.string().max(50).optional(),
});

export const FilterParamsSchema = z.object({
  search: z.string().max(255).optional(),
  status: z.string().max(50).optional(),
  dateRange: DateRangeSchema.optional(),
});

export const IdempotencySchema = z.object({
  idempotency_key: z.string().max(128).optional().nullable(),
});

export type PaginationParamsInput = z.infer<typeof PaginationParamsSchema>;
export type DateRangeInput = z.infer<typeof DateRangeSchema>;
export type FilterParamsInput = z.infer<typeof FilterParamsSchema>;
export type IdempotencyInput = z.infer<typeof IdempotencySchema>;

