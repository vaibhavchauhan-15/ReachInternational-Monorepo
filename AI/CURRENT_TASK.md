# Current Task: Dedicated Delete Account Page & Strict Separation from Guide

Status: COMPLETE (2026-09-11)

## Overview & User Feedback Resolutions
1. **Dedicated Delete Account Page (`/delete-account`)**:
   - Created standalone Server Component `apps/web/app/delete-account/page.tsx` with ScissorLift branding, metadata, auth detection, and pending status prefetch.
   - Built interactive client interface `apps/web/app/delete-account/DeleteAccountClient.tsx` featuring:
     - Operator/User profile identification summary.
     - Unauthenticated fallback identification for operators without active credentials.
     - Common deletion reason chips + customizable notes.
     - Policy & irreversible data loss acknowledgement checkbox.
     - Live pending status banner with submission timestamp, stated reason, and cancellation option (`cancelMyAccountDeletionRequestAction`).
2. **Account Deletion Guide (`/account-deletion`) Kept Pure & Distinct**:
   - `http://localhost:3000/account-deletion` is strictly the educational and statutory guide.
   - Does NOT contain the direct deletion form.
   - Prominently features direct action buttons routing to `http://localhost:3000/delete-account`.
3. **UserProfileDropdown Linkage (`/machines` feedback)**:
   - Clicking "Account Deletion" in `UserProfileDropdown` opens and navigates directly to `/delete-account` via `<Link href="/delete-account">`.
   - Cleaned up redundant modal code.
4. **Edge Proxy Whitelist**:
   - Added `/delete-account` and `/account-deletion-guide` to `publicLegalRoutes` in `apps/web/proxy.ts`.

## Files Modified / Created
- 🆕 `apps/web/app/delete-account/page.tsx`
- 🆕 `apps/web/app/delete-account/DeleteAccountClient.tsx`
- ✏️ `apps/web/app/account-deletion/page.tsx`
- ✏️ `apps/web/components/layout/sidebar/UserProfileDropdown.tsx`
- ✏️ `apps/web/components/layout/MobileBottomNav.tsx`
- ✏️ `apps/web/components/settings/SettingsClient.tsx`
- ✏️ `apps/web/proxy.ts`
- ✏️ `AI/CURRENT_TASK.md`
- ✏️ `AI/STATE.md`
- ✏️ `AI/CHANGELOG_AI.md`

## Verification
- `@reachinternational/web` `typecheck`: **PASSED (0 errors)**
- `@reachinternational/mobile` `typecheck`: **PASSED (0 errors)**
- `node apps/mobile/run-tests.mjs`: **PASSED (18/18 scenarios verified)**
