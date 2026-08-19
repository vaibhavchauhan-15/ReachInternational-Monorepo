# Feature Module — Authentication & Security

## Overview
Handles user authentication, session management, onboarding registration, password reset workflows, and role-based permissions (`admin`, `service_manager`, `engineer`, `client`).

## File Map
- **Pages**: `app/login/page.tsx`, `app/signup/page.tsx`, `app/forgot-password/page.tsx`
- **Actions**: `app/actions/auth.ts`
- **Clients**: `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/admin.ts`
- **DAL**: `lib/dal.ts`

## Key Functions & Workflows
- `login(formData)`: Authenticates user credentials via Supabase Auth.
- `signup(formData)`: Registers new user and sets default role in `profiles` table.
- `logout()`: Clears authentication session cookies.
- `verifySession()`: DAL utility that validates user session on Server Components.
