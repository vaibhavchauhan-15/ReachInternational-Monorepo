/**
 * ServiceCentric Shared API — Response Envelopes
 * Standardized API response contracts for Web and Mobile backend requests.
 */

export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface ApiPaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
  timestamp: string;
}

export interface ApiErrorDetails {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  stack?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetails;
  timestamp: string;
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;
export type ApiPaginatedResult<T> = ApiPaginatedResponse<T> | ApiErrorResponse;
