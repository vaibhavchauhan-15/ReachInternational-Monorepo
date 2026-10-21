/**
 * Reach International Mobile — Centralized Authentication Error Mapping
 *
 * SECURITY INVARIANTS:
 * 1. User Enumeration Prevention: Generic message for invalid credentials, avoiding revealing
 *    whether an account exists in the database.
 * 2. Identity-First Account Status: Deactivated or pending messages are ONLY shown after
 *    the user's identity has been verified via Supabase Auth credentials.
 * 3. Credential Sanitization: Never exposes or logs passwords, auth tokens, or sensitive API keys.
 * 4. Consistent UX: Maps technical error messages and codes into clear, actionable toast/field notices.
 */

export interface MappedAuthError {
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  fieldErrors?: { email?: string; password?: string };
}

/**
 * Maps raw Supabase / Network / System errors to safe, user-friendly, enterprise-grade error objects.
 * Defends against user enumeration by returning a generic credential error on any probe attempt.
 */
export function mapAuthError(error: unknown): MappedAuthError {
  if (!error) {
    return {
      title: 'Sign In Failed',
      message: 'Sign in failed. Please try again.',
      type: 'error',
    };
  }

  // Handle string errors
  const rawMessage = typeof error === 'string'
    ? error
    : (error as any)?.message || (error as any)?.error_description || String(error);

  const lower = rawMessage.toLowerCase();
  const status = (error as any)?.status;

  // 1. Rate Limiting (Too Many Requests / 429)
  if (
    status === 429 ||
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('over_email_send_rate_limit')
  ) {
    return {
      title: 'Too Many Attempts',
      message: 'Too many attempts. Please wait a moment.',
      type: 'warning',
    };
  }

  // 2. Network / Offline / Connection Failures
  if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('failed to fetch') ||
    lower.includes('offline') ||
    lower.includes('connection refused') ||
    lower.includes('socket') ||
    lower.includes('econnrefused')
  ) {
    return {
      title: 'Network Error',
      message: 'Network error. Check your connection.',
      type: 'error',
    };
  }

  // 3. Request Timeout
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('aborted')) {
    return {
      title: 'Connection Timed Out',
      message: 'Request timed out. Please try again.',
      type: 'error',
    };
  }

  // 4. Server Error (500 / 503)
  if (status >= 500 || lower.includes('internal server error') || lower.includes('service unavailable')) {
    return {
      title: 'Service Unavailable',
      message: 'Service unavailable. Try again shortly.',
      type: 'error',
    };
  }

  // 5. Invalid Credentials & Enumeration Defense:
  // For any authentication check failure (including unconfirmed email, wrong password, user not found),
  // return generic invalid credentials to prevent attackers from discovering whether an email exists.
  const genericMsg = 'Invalid email or password.';
  return {
    title: 'Sign In Failed',
    message: genericMsg,
    type: 'error',
    fieldErrors: {
      email: genericMsg,
      password: genericMsg,
    },
  };
}

/**
 * Surface account-status guidance ONLY after the user's password has been authenticated.
 */
export function formatAccountStatusNotice(status: 'inactive' | 'pending'): MappedAuthError {
  if (status === 'inactive') {
    return {
      title: 'Account Deactivated',
      message: 'Account deactivated. Contact administrator.',
      type: 'error',
    };
  }

  return {
    title: 'Pending Approval',
    message: 'Account pending administrator approval.',
    type: 'info',
  };
}

export interface MappedSignupError {
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  fieldErrors?: Record<string, string>;
}

/**
 * Maps raw Supabase Auth / PostgreSQL errors during registration to safe, user-friendly,
 * sanitized error messages without exposing schema names (public.), table names (users_),
 * sqlstate codes, or internal database stack traces.
 */
export function mapSignupError(error: unknown): MappedSignupError {
  if (!error) {
    return {
      title: 'Registration Failed',
      message: 'Registration failed. Please try again.',
      type: 'error',
    };
  }

  const rawMessage = typeof error === 'string'
    ? error
    : (error as any)?.message || (error as any)?.error_description || String(error);

  const lower = rawMessage.toLowerCase();
  const status = (error as any)?.status;
  const code = String((error as any)?.code || '');

  // 1. Rate Limit (429)
  if (
    status === 429 ||
    lower.includes('429') ||
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('over_email_send_rate_limit')
  ) {
    return {
      title: 'Rate Limit Reached',
      message: 'Too many signup attempts. Please wait a moment.',
      type: 'warning',
    };
  }

  // 2. Network Drops / Connection Errors / Timeouts
  if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('failed to fetch') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('connection') ||
    lower.includes('aborted')
  ) {
    return {
      title: 'Connection Issue',
      message: 'Connection failed. Check your internet.',
      type: 'error',
    };
  }

  // 3. Duplicate Constraints (23505) & Schema Sanitization (sqlstate, public., users_)
  if (code === '23505' || lower.includes('unique constraint') || lower.includes('duplicate key') || lower.includes('already registered')) {
    if (lower.includes('email') || lower.includes('users_email_key') || lower.includes('public.users')) {
      return {
        title: 'Email Already Registered',
        message: 'Email already registered. Sign in instead.',
        type: 'error',
        fieldErrors: { email: 'Email already registered.' },
      };
    }

    if (lower.includes('phone') || lower.includes('mobile') || lower.includes('users_phone_key')) {
      return {
        title: 'Mobile Already Registered',
        message: 'This mobile number is already registered.',
        type: 'error',
        fieldErrors: { phone: 'This mobile number is already registered.' },
      };
    }

    if (lower.includes('aadhaar') || lower.includes('users_aadhaar_number_key') || lower.includes('users_aadhaar_key')) {
      return {
        title: 'Aadhaar Already Registered',
        message: 'Aadhaar number already registered.',
        type: 'error',
        fieldErrors: {
          aadhaarNumber: 'Aadhaar number already registered.',
          aadhaar_number: 'Aadhaar number already registered.',
        },
      };
    }
  }

  // 4. Default Sanitized Message (strip sqlstate, public., users_, schema references)
  let cleanMsg = rawMessage
    .replace(/\(sqlstate\s+[a-z0-9]+\)/gi, '')
    .replace(/public\./gi, '')
    .replace(/users_/gi, '')
    .trim();

  if (!cleanMsg || cleanMsg.includes('database error') || cleanMsg.includes('internal error')) {
    cleanMsg = 'Registration failed. Please check details.';
  }

  return {
    title: 'Registration Error',
    message: cleanMsg,
    type: 'error',
  };
}
