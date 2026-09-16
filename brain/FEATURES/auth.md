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
- `signup(formData)`: Registers new user and sets role in `users` table. Allows every user to select a working location / site / office from the active working locations list (`getWorkingLocationsAction` on web, `get_active_working_locations_public` RPC on mobile), persisting `working_location_id` via Postgres trigger `handle_new_user()`. When role is supervised (`operator`, `service_engineer`, `mechanic`), also requires selecting a supervisor from active supervisors (`getSupervisorsAction` on web, `get_active_supervisors_public` RPC on mobile).
- `logout()`: Clears authentication session cookies.
- `verifySession()`: DAL utility that validates user session on Server Components.
