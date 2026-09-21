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
- `signup(formData)`: Registers new user and sets role in `users` table. Captures the user's operational location directly via Section 3 (`address`, `city`, `district`, `state`, `state_id`), persisted to `public.users` via Postgres trigger `handle_new_user()`. When role is supervised (`operator`, `service_engineer`, `mechanic`), also requires selecting a supervisor from active supervisors (`getSupervisorsAction` on web, `get_active_supervisors_public` RPC on mobile).
- `logout()`: Clears authentication session cookies.
- `verifySession()`: DAL utility that validates user session on Server Components.
