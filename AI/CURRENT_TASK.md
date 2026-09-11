# Current Task: Account Deletion System — Web Feedback, Full-Stack Request Workflow & Admin Dashboard Parity

Status: COMPLETE (2026-09-11)

## Overview & User Feedback Resolutions
1. **Public `/account-deletion` Feedback Polished**:
   - Removed "Data Subject Right" badge (`.flex > div > .flex > .text-[11px]`).
   - Removed rounded amber icon box (`.max-w-3xl > .p-6 > .flex > .w-12`).
   - Removed "Google Play Compliant" text (`.flex > div > .flex > .text-xs`).
   - Styled page header with canonical vector branding matching `/privacy`.
   - Added interactive web submission portal (`AccountDeletionWebForm.tsx`) directly on `/account-deletion`.
2. **Web App Navigation Integration**:
   - Linked "Request Account Deletion" in the bottom profile sheet (`MobileBottomNav.tsx`).
   - Added "Account Deletion" link in the user profile dropdown (`UserProfileDropdown.tsx`).
   - Added "Account & Data Deletion" card in user settings (`SettingsClient.tsx`).
3. **Mobile App Screen & Navigation**:
   - Built dedicated screen `apps/mobile/app/(app)/account-deletion.tsx` with data retention disclosures, real-time pending status tracking, and cancellation.
   - Registered `account-deletion` in `apps/mobile/app/(app)/_layout.tsx` and `apps/mobile/lib/security.ts`.
   - Linked in `apps/mobile/app/(app)/profile.tsx` and `apps/mobile/app/(app)/settings.tsx`.
4. **Admin Dashboard Parity (Web & Mobile)**:
   - Requests from both Web and Mobile arrive in the Admin Users page (`/users`) alongside pending registrations.
   - **Web Admin**: Built `AccountDeletionRequestsSection.tsx` and connected it in `users-client.tsx` and `page.tsx` with Approve (inactivates user, scrubs Aadhaar/license, logs audit) and Decline modals.
   - **Mobile Admin**: Added deletion request fetching, notification badge, and native review cards with Approve & Deactivate / Decline actions in `apps/mobile/app/(app)/users.tsx`.
5. **Backend & Database Dual-Path Resilience**:
   - Migration `063_create_account_deletion_requests.sql` created with RLS and indexing.
   - TypeScript definitions added in `packages/types/src/database.ts`.
   - Server actions in `apps/web/app/actions/account-deletion.ts` with graceful fallback to `profile_change_requests` (`type = 'account_deletion'`) to ensure 100% immediate functionality.

## Files Changed
- ✏️ `apps/web/app/account-deletion/page.tsx`
- 🆕 `apps/web/app/account-deletion/AccountDeletionWebForm.tsx`
- ✏️ `apps/web/components/layout/MobileBottomNav.tsx`
- ✏️ `apps/web/components/layout/sidebar/UserProfileDropdown.tsx`
- ✏️ `apps/web/components/settings/SettingsClient.tsx`
- 🆕 `apps/mobile/app/(app)/account-deletion.tsx`
- ✏️ `apps/mobile/app/(app)/_layout.tsx`
- ✏️ `apps/mobile/lib/security.ts`
- ✏️ `apps/mobile/app/(app)/profile.tsx`
- ✏️ `apps/mobile/app/(app)/settings.tsx`
- ✏️ `apps/mobile/app/(app)/users.tsx`
- 🆕 `apps/web/app/(app)/users/AccountDeletionRequestsSection.tsx`
- ✏️ `apps/web/app/(app)/users/page.tsx`
- ✏️ `apps/web/app/(app)/users/users-client.tsx`
- 🆕 `apps/web/app/actions/account-deletion.ts`
- ✏️ `apps/web/lib/queries/users.ts`
- 🆕 `supabase/migrations/063_create_account_deletion_requests.sql`
- ✏️ `packages/types/src/database.ts`
- ✏️ `AI/STATE.md`
- ✏️ `AI/CURRENT_TASK.md`
- ✏️ `AI/CHANGELOG_AI.md`
- ✏️ `README.md`

## Verification Matrix
- `@reachinternational/web` `typecheck`: **PASSED (0 TypeScript errors)**
- `@reachinternational/mobile` `typecheck`: **PASSED (0 TypeScript errors)**
- `node apps/mobile/run-tests.mjs`: **PASSED (18/18 scenarios verified)**
