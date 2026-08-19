/**
 * ServiceCentric Shared API — Query & Pagination Parameters
 * Standardized pagination, sorting, and filter contracts.
 */

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  cursor?: string;
  limit?: number;
}

export interface SortParams<TKey extends string = string> {
  sortBy?: TKey;
  sortOrder?: 'asc' | 'desc';
}

export interface CommonFilterParams {
  search?: string;
  branchId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface QueryOptions<TFilter = CommonFilterParams, TSortKey extends string = string> {
  pagination?: PaginationParams;
  sort?: SortParams<TSortKey>;
  filter?: TFilter;
}
