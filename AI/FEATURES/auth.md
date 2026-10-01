# Feature Module — Authentication & Security

## Overview
Handles user authentication, session management, onboarding registration, password reset workflows, and role-based permissions (`admin`, `service_manager`, `engineer`, `client`).

## File Map
- **Pages**: `app/login/page.tsx`, `app/signup/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`
- **Actions**: `app/actions/auth.ts`
- **API Routes**: `app/api/auth/forgot-password/route.ts`
- **Clients**: `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/admin.ts`
- **DAL**: `lib/dal.ts`

## Key Functions & Workflows
- `login(formData)`: Authenticates user credentials via Supabase Auth.
- `forgotPassword(state, formData)`: Verifies user existence in `public.users` via `createSupabaseAdminClient()`. If user does not exist or is inactive, returns error and blocks email dispatch. If valid, triggers `resetPasswordForEmail` with dynamic `redirectTo` from `getResetPasswordRedirectUrl()`.
- `POST /api/auth/forgot-password`: REST endpoint for mobile (`apps/mobile/app/(auth)/forgot-password.tsx`) providing identical user existence validation and reset dispatch.
- `reset-password`: Dedicated page guarded by 4-state lifecycle machine (`verifying`, `valid`, `missing`, `invalid`). Access without a token is strictly blocked. Handles PKCE `code` and OTP `token_hash`, allowing users to submit new passwords, which signs out the recovery session and redirects to `/login`.
- `signup(formData)`: Registers new user and sets role in `users` table. Captures the user's operational location directly via Section 3 (`street`/`address`, `city`, `district`, `state`, `state_id`), banking details, and identity documents, persisted to `public.users` via Postgres trigger `handle_new_user()`. When role is supervised (`operator`, `service_engineer`, `mechanic`), also requires selecting a supervisor from active supervisors (`getSupervisorsAction` on web, `get_active_supervisors_public` RPC on mobile). On successful registration, displays an animated toast notification informing the user that the account is pending administrator approval, clears local drafts, and redirects to `/login?message=...` where a friendly confirmation banner is rendered.
  - **Security & Anti-Abuse Controls**:
    - **FormSubmitButton Auto-Release Guard**: 500ms auto-unlock timer prevents client-side validation failures from locking the submit button.
    - **Document MIME Whitelisting**: Strictly restricts uploads to `image/jpeg`, `image/png`, `image/webp`, and `application/pdf`. Rejects executables, scripts, and SVG XSS payloads.
    - **Safe Extension Mapping**: Derived solely from validated MIME type; never trusts user-provided extensions.
    - **Path Traversal Sanitization**: File names sanitized against directory traversal (`../`) and control characters before writing to DB.
    - **File Size Cap**: Enforced max 2MB per document on both client and server.
    - **Role Tampering Protection**: Limits registration roles strictly to `manager`, `supervisor`, `hr`, and `operator`. Unauthorized roles (`admin`, `super_admin`) are rejected.
    - **Supervisor Verification**: Requires valid UUIDv4 pointing to an active supervisor or admin in `public.users`.
    - **Bcrypt DoS Protection**: Passwords capped at 128 characters to prevent CPU exhaustion.
    - **Verhoeff Aadhaar & IFSC Validation**: Mathematically verifies Indian Aadhaar numbers via Verhoeff checksum algorithm and IFSC formats.
- `logout()`: Clears authentication session cookies.
- `verifySession()`: DAL utility that validates user session on Server Components.

