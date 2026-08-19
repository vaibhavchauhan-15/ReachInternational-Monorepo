/**
 * ServiceCentric Shared API — Error Handling & Codes
 * Canonical API error code enum and custom ServiceCentricApiError class.
 */

export enum ApiErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export class ServiceCentricApiError extends Error {
  public readonly code: ApiErrorCode | string;
  public readonly status: number;
  public readonly fieldErrors?: Record<string, string[]>;

  constructor(message: string, code: ApiErrorCode | string = ApiErrorCode.INTERNAL_SERVER_ERROR, status: number = 500, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = 'ServiceCentricApiError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  public static fromStatus(status: number, message?: string): ServiceCentricApiError {
    switch (status) {
      case 401:
        return new ServiceCentricApiError(message || 'Unauthorized session', ApiErrorCode.UNAUTHORIZED, 401);
      case 403:
        return new ServiceCentricApiError(message || 'Forbidden access', ApiErrorCode.FORBIDDEN, 403);
      case 404:
        return new ServiceCentricApiError(message || 'Resource not found', ApiErrorCode.NOT_FOUND, 404);
      case 422:
        return new ServiceCentricApiError(message || 'Validation error', ApiErrorCode.VALIDATION_ERROR, 422);
      case 409:
        return new ServiceCentricApiError(message || 'Resource conflict', ApiErrorCode.CONFLICT, 409);
      default:
        return new ServiceCentricApiError(message || 'Internal server error', ApiErrorCode.INTERNAL_SERVER_ERROR, status);
    }
  }
}
