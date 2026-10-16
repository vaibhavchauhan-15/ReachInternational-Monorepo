/**
 * ServiceCentric Monorepo — Common Utility & API Types
 */

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationState;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: ApiError;
  timestamp?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
  statusCode?: number;
}

export type ErrorClassification =
  | "network"
  | "timeout"
  | "server"
  | "permission"
  | "validation"
  | "conflict"
  | "not_found"
  | "generic";

export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  status: number;
}

export type ActionResponse<T = unknown> =
  | {
      success: true;
      data?: T;
      message?: string;
    }
  | {
      success: false;
      error: string;
      code?: string;
      fieldErrors?: Record<string, string>;
      statusCode?: number;
    };

