/**
 * ReachInternational Monorepo — Authoritative Centralized Error Sanitizer & Classifier
 * 
 * Invariants:
 * 1. ZERO technical leakage (SQLSTATE, table names, raw constraint names, stack traces).
 * 2. Consistent HTTP status codes and user-facing messages across Web and Native Mobile.
 * 3. Field-level mapping for unique and validation constraints.
 * 4. User enumeration defense.
 */

export type ErrorClassification =
  | "network"
  | "timeout"
  | "server"
  | "permission"
  | "validation"
  | "conflict"
  | "not_found"
  | "generic";

export interface SanitizedDatabaseErrorResult {
  error: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  code?: string;
  statusCode: number;
}

export interface ClassifiedError {
  classification: ErrorClassification;
  title: string;
  message: string;
  statusCode: number;
}

/**
 * Strips raw SQL keywords, internal table references, and technical stack details.
 */
export function sanitizeUserErrorMessage(error: unknown, fallback = "An unexpected error occurred. Please try again."): string {
  if (!error) return fallback;

  const raw =
    typeof error === "string"
      ? error
      : (error as any)?.message || (error as any)?.error_description || String(error);

  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  // Check for database / SQL artifacts
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("(sqlstate") ||
    lower.includes("relation \"") ||
    lower.includes("violates foreign key") ||
    lower.includes("violates check constraint") ||
    lower.includes("duplicate key value") ||
    lower.includes("syntax error at or near") ||
    lower.includes("public.") ||
    lower.includes("pgrst") ||
    lower.includes("column \"")
  ) {
    return sanitizeDatabaseError(error, fallback).error;
  }

  // Cap message length to prevent UI overflow
  if (trimmed.length > 180) {
    return fallback;
  }

  return trimmed;
}

/**
 * Classifies an error into standard categories with friendly titles and sanitized messages.
 * Cross-platform: Used across Web ErrorState, Mobile ErrorState, and API catch handlers.
 */
export function classifyError(error: unknown): ClassifiedError {
  if (!error) {
    return {
      classification: "generic",
      title: "Unable to Load Data",
      message: "An unexpected issue occurred. Please check your connection and try again.",
      statusCode: 500,
    };
  }

  const rawMessage =
    typeof error === "string"
      ? error
      : (error as any)?.message || (error as any)?.error_description || String(error);

  const lower = rawMessage.toLowerCase();
  const code = String((error as any)?.code || (error as any)?.status || "");

  // 1. Network / Offline
  if (
    lower.includes("network") ||
    lower.includes("offline") ||
    lower.includes("failed to fetch") ||
    lower.includes("connection") ||
    lower.includes("internet") ||
    lower.includes("enotfound") ||
    code === "NETWORK_ERROR"
  ) {
    return {
      classification: "network",
      title: "No Internet Connection",
      message: "Please check your network connection and try again.",
      statusCode: 503,
    };
  }

  // 2. Timeout
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("aborted") ||
    code === "ETIMEDOUT" ||
    code === "408"
  ) {
    return {
      classification: "timeout",
      title: "Request Timed Out",
      message: "The server took too long to respond. Please verify your connection and try again.",
      statusCode: 504,
    };
  }

  // 3. Permission / Forbidden
  if (
    lower.includes("permission") ||
    lower.includes("forbidden") ||
    lower.includes("unauthorized") ||
    lower.includes("row-level security") ||
    lower.includes("access denied") ||
    code === "42501" ||
    code === "403" ||
    code === "401"
  ) {
    return {
      classification: "permission",
      title: "Access Restricted",
      message: "You do not have authorization to view or modify this resource.",
      statusCode: 403,
    };
  }

  // 4. Resource Not Found
  if (
    code === "404" ||
    code === "PGRST116" ||
    lower.includes("not found") ||
    lower.includes("does not exist")
  ) {
    return {
      classification: "not_found",
      title: "Resource Not Found",
      message: "The requested record could not be found or has been removed.",
      statusCode: 404,
    };
  }

  // 5. Conflict / Duplicate
  if (
    code === "409" ||
    code === "23505" ||
    lower.includes("conflict") ||
    lower.includes("already exists") ||
    lower.includes("duplicate")
  ) {
    return {
      classification: "conflict",
      title: "Duplicate Record",
      message: "A record with these details already exists.",
      statusCode: 409,
    };
  }

  // 6. Validation Error
  if (
    code === "400" ||
    code === "23514" ||
    code === "23502" ||
    code === "22P02" ||
    lower.includes("validation") ||
    lower.includes("invalid")
  ) {
    return {
      classification: "validation",
      title: "Validation Failed",
      message: "Please review the highlighted fields and correct the errors before submitting.",
      statusCode: 400,
    };
  }

  // 7. Server / Database Error
  if (
    code.startsWith("5") ||
    code === "P0001" ||
    lower.includes("internal server") ||
    lower.includes("database error")
  ) {
    return {
      classification: "server",
      title: "Service Temporarily Unavailable",
      message: "An internal operational error occurred. Our team has been notified.",
      statusCode: 500,
    };
  }

  // 8. Generic Sanitized
  return {
    classification: "generic",
    title: "Unable to Process Request",
    message: sanitizeUserErrorMessage(error),
    statusCode: 500,
  };
}

/**
 * Detects whether an error or signal was caused by an aborted/cancelled request.
 * Useful to prevent unnecessary console.error logs or error alerts when components unmount
 * or queries are cancelled.
 */
export function isAbortError(error: unknown, signal?: AbortSignal | null): boolean {
  if (signal?.aborted) return true;
  if (!error) return false;
  if (typeof error === "object") {
    const err = error as any;
    if (err.name === "AbortError") return true;
    const msg = typeof err.message === "string" ? err.message : "";
    const hint = typeof err.hint === "string" ? err.hint : "";
    const details = typeof err.details === "string" ? err.details : "";
    const code = String(err.code || "");
    if (
      msg.toLowerCase().includes("abort") ||
      msg.includes("signal is aborted") ||
      hint.toLowerCase().includes("abort") ||
      hint.includes("manual cancellation") ||
      details.toLowerCase().includes("abort") ||
      details.includes("signal is aborted") ||
      code === "20"
    ) {
      return true;
    }
  }
  if (typeof error === "string") {
    const lower = error.toLowerCase();
    return lower.includes("abort") || lower.includes("signal is aborted");
  }
  return false;
}

/**
 * Intercepts PostgreSQL, PostgREST, and Supabase RPC database exceptions
 * and returns safe, user-friendly messages and field-level error maps.
 */
export function sanitizeDatabaseError(
  error: unknown,
  fallback = "Failed to complete operation. Please check your inputs and try again."
): SanitizedDatabaseErrorResult {
  const res = _sanitizeDatabaseErrorRaw(error, fallback);
  return {
    ...res,
    message: res.error,
  };
}

function _sanitizeDatabaseErrorRaw(
  error: unknown,
  fallback = "Failed to complete operation. Please check your inputs and try again."
): Omit<SanitizedDatabaseErrorResult, "message"> {
  if (!error) {
    return { error: fallback, statusCode: 500 };
  }

  const err = error as { code?: string; message?: string; details?: string; hint?: string };
  const code = String(err.code || "").trim();
  const msg = String(err.message || "");
  const details = String(err.details || "");
  const combined = `${msg} ${details}`.toLowerCase();

  // 1. Permission / RLS Violations (42501)
  if (code === "42501" || combined.includes("row-level security") || combined.includes("permission denied")) {
    return {
      error: "Permission denied: Your account role does not have authorization to perform this action.",
      code: "42501",
      statusCode: 403,
    };
  }

  // 2. Unique Constraint Violations (23505)
  if (code === "23505" || combined.includes("duplicate key") || combined.includes("unique constraint")) {
    // Machine ID
    if (combined.includes("machines_machine_id_key") || combined.includes("machine_id")) {
      return {
        error: "A machine with this Machine ID already exists in the inventory.",
        fieldErrors: { machine_id: "Machine ID is already registered." },
        code: "23505",
        statusCode: 409,
      };
    }

    // Serial Number
    if (combined.includes("serial_number") || combined.includes("idx_machines_serial_number")) {
      return {
        error: "A machine with this Serial Number already exists in the inventory.",
        fieldErrors: { serial_number: "Serial Number is already registered." },
        code: "23505",
        statusCode: 409,
      };
    }

    // Client GSTIN
    if (combined.includes("gstin") || combined.includes("clients_gstin_key")) {
      return {
        error: "A client with this GSTIN is already registered in the system.",
        fieldErrors: { gstin: "GSTIN is already registered." },
        code: "23505",
        statusCode: 409,
      };
    }

    // Client Company Name / Code
    if (combined.includes("company_name") || combined.includes("client_code")) {
      return {
        error: "A client with this name or code already exists in the directory.",
        fieldErrors: { companyName: "Client company name is already registered." },
        code: "23505",
        statusCode: 409,
      };
    }

    // Client Site Name / Code
    if (combined.includes("client_sites") || combined.includes("site_code")) {
      return {
        error: "A client site with this name or code already exists for this client.",
        fieldErrors: { site_name: "Site name or code already registered." },
        code: "23505",
        statusCode: 409,
      };
    }

    // User Email / Phone
    if (combined.includes("users_email_key") || combined.includes("email")) {
      return {
        error: "An account with this email address already exists.",
        fieldErrors: { email: "Email is already registered." },
        code: "23505",
        statusCode: 409,
      };
    }
    if (combined.includes("phone")) {
      return {
        error: "An account with this mobile phone number already exists.",
        fieldErrors: { phone: "Phone number is already registered." },
        code: "23505",
        statusCode: 409,
      };
    }

    // Machine Shift Logs — Operator Duplicate Shift
    if (combined.includes("uq_machine_hour_logs_operator_date_shift")) {
      return {
        error: "Operator has already recorded a log for this shift today. An operator cannot run multiple machines during the same shift.",
        code: "23505",
        statusCode: 409,
      };
    }

    // Machine Shift Logs — Machine Duplicate Shift
    if (combined.includes("uq_machine_hour_logs_machine_date_shift")) {
      return {
        error: "A log has already been submitted for this machine and shift today.",
        code: "23505",
        statusCode: 409,
      };
    }

    // Idempotency Key
    if (combined.includes("idempotency_key")) {
      return {
        error: "This shift log entry has already been processed. Please refresh to view latest records.",
        code: "23505",
        statusCode: 409,
      };
    }

    return {
      error: "A record with these unique details already exists in the system.",
      code: "23505",
      statusCode: 409,
    };
  }

  // 3. Foreign Key Violations (23503)
  if (code === "23503" || combined.includes("foreign key constraint") || combined.includes("is not present in table")) {
    if (combined.includes("machines") || combined.includes("machine_id")) {
      return {
        error: "Cannot complete operation: Active shift logs or assignments are attached to this machine.",
        code: "23503",
        statusCode: 409,
      };
    }
    if (combined.includes("clients") || combined.includes("client_id")) {
      return {
        error: "Cannot complete operation: Machinery or sites are actively associated with this client.",
        code: "23503",
        statusCode: 409,
      };
    }
    if (combined.includes("users") || combined.includes("user_id") || combined.includes("operator_id")) {
      return {
        error: "The referenced employee or personnel record could not be found or has active assignments.",
        code: "23503",
        statusCode: 409,
      };
    }
    return {
      error: "Cannot delete or modify this record because related dependent records exist.",
      code: "23503",
      statusCode: 409,
    };
  }

  // 4. Check Constraint Violations (23514)
  if (code === "23514" || combined.includes("violates check constraint")) {
    if (combined.includes("meter_range") || combined.includes("cannot be less than start meter")) {
      return {
        error: "Ending hour meter reading cannot be less than starting hour meter reading.",
        fieldErrors: { endMeter: "Ending meter must be greater than or equal to starting meter." },
        code: "23514",
        statusCode: 400,
      };
    }
    if (combined.includes("meter_positive") || combined.includes("hour_meter_positive")) {
      return {
        error: "Hour meter reading cannot be negative.",
        fieldErrors: { endMeter: "Meter reading must be positive." },
        code: "23514",
        statusCode: 400,
      };
    }
    if (combined.includes("before shift end") || combined.includes("cannot log before shift end")) {
      return {
        error: "Shift has not ended yet. Shift logs can only be recorded after your shift concludes.",
        code: "23514",
        statusCode: 400,
      };
    }
    if (combined.includes("status_check")) {
      return {
        error: "Invalid status value provided. Please choose a valid status option.",
        code: "23514",
        statusCode: 400,
      };
    }
    return {
      error: "The entered values violate business validation rules. Please verify your inputs.",
      code: "23514",
      statusCode: 400,
    };
  }

  // 5. Not Null Violations (23502)
  if (code === "23502" || combined.includes("null value in column")) {
    return {
      error: "Mandatory details are missing. Please complete all required fields.",
      code: "23502",
      statusCode: 400,
    };
  }

  // 6. Invalid Syntax / UUID / Integer Format (22P02)
  if (code === "22P02" || combined.includes("invalid input syntax")) {
    return {
      error: "Invalid input format provided. Please check numeric and identifier values.",
      code: "22P02",
      statusCode: 400,
    };
  }

  // 7. PostgREST 0-row query error (PGRST116)
  if (code === "PGRST116" || combined.includes("0 rows")) {
    return {
      error: "The requested record was not found or has been removed.",
      code: "PGRST116",
      statusCode: 404,
    };
  }

  // 8. Custom Postgres Raise Exceptions (P0001)
  if (code === "P0001") {
    // If the database trigger raised an explicit human-readable error, sanitize it
    let cleanMsg = msg.replace(/^error:\s*/i, "").trim();
    if (cleanMsg.length > 140) {
      cleanMsg = "A database business rule check failed. Please review your entries.";
    }
    return {
      error: cleanMsg || "Operation failed business validation checks.",
      code: "P0001",
      statusCode: 400,
    };
  }

  return {
    error: fallback,
    statusCode: 500,
  };
}
