# Current Task

## Task: User Directory (/users) Feedback & Quality Remediation (`apps/web` & `apps/mobile`)
**Status**: 🟢 FULLY VERIFIED & COMPLETE (0 TYPECHECK ERRORS ACROSS ALL 7 PACKAGES, 357/357 MOBILE TESTS PASSING, 27/27 MONOREPO SUITES PASSING, 42/42 USERS WORKFLOW TESTS PASSING)
**Date**: 2026-11-17
**Target Files & Configurations**:
- Web Users Page & Client: [apps/web/app/(app)/users/page.tsx](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/web/app/(app)/users/page.tsx) & [apps/web/app/(app)/users/UsersClient.tsx](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/web/app/(app)/users/UsersClient.tsx)
- Web Users Table & Rows: [apps/web/app/(app)/users/UsersTable.tsx](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/web/app/(app)/users/UsersTable.tsx) & [apps/web/app/(app)/users/UserRow.tsx](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/web/app/(app)/users/UserRow.tsx)
- Web Mobile User Card: [apps/web/app/(app)/users/MobileUserCard.tsx](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/web/app/(app)/users/MobileUserCard.tsx)
- Web Users Filters Toolbar: [apps/web/app/(app)/users/UsersFilters.tsx](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/web/app/(app)/users/UsersFilters.tsx)
- Web User Data Access Layer (DAL): [apps/web/lib/data/users/user-list.ts](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/web/lib/data/users/user-list.ts)
- Mobile Users Screen: [apps/mobile/app/(app)/users.tsx](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/mobile/app/(app)/users.tsx)
- Mobile User Touch Card: [apps/mobile/components/users/UserTouchCard.tsx](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/mobile/components/users/UserTouchCard.tsx)
- Mobile Users Filters Panel: [apps/mobile/components/users/UserFiltersPanel.tsx](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/mobile/components/users/UserFiltersPanel.tsx)
- Mobile User Query Hook: [apps/mobile/lib/hooks/useUsersData.ts](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/mobile/lib/hooks/useUsersData.ts)

---

### User Feedback Addressed:
1. **Employee ID Display**: Show employee ID below the user's name with small text (instead of beside in an inline pill).
2. **Additional Columns**:
   - Machine category column for operators (e.g. "Forklift", "Boom Lift", etc., or "Unassigned" for operators without machinery, and "—" for non-operator roles).
   - Identity / Statutory KYC column displaying masked 12-digit Aadhaar number (`XXXX XXXX 1234`) and formatted Driving Licence number (`MH12 20110012345`).
   - Fully optimized and visible across both desktop table and mobile cards.
3. **Location Hierarchy**: In the location column, show the user city above and state name below.
4. **Supervisor Filter Replacing KYC Filter**: Removed the KYC verification filter and added a Supervisor filter to filter users by supervisor and view all operators and staff reporting to that supervisor.
5. **General Page Optimization**: Streamlined column widths, text truncation, accessibility labels, and 100% Web & Mobile zero-drift parity.

---

### Implementation Details:
1. **Web Table & Row (`UsersTable.tsx` & `UserRow.tsx`)**:
   - Refactored Column 1: Stacked `user.full_name` (bold, text-sm, text-[var(--color-ink)]) with `user.employee_id` immediately below in `font-mono text-[11px] text-[var(--color-mute)] tracking-tight`.
   - Added Column 5 (Machine Category): For operator accounts, displays machinery category with amber badge and `Wrench` icon (`max-w-[150px] truncate`), or "Unassigned", and "—" for non-operators.
   - Added Column 6 (Identity / KYC): Displays statutory Aadhaar (masked via `maskAadhaar`) and Driving Licence (formatted via `formatLicenseNumber`).
   - Refactored Column 7 (Location): Displays city name above (`text-xs font-semibold text-[var(--color-ink)]`) and state name below (`text-[11px] text-[var(--color-mute)]`).
   - Updated `TableSkeletonRows` and empty state `colSpan` to 11 columns (or 10 for read-only).
2. **Web Mobile Card (`MobileUserCard.tsx`)**:
   - Positioned employee ID below the user name in small monospace text.
   - Stacked city above and state below in the location entry.
   - Added Machine category with `Wrench` icon for operators.
   - Added Aadhaar and Driving Licence metadata chip row.
3. **Web Filters & Data Access Layer (`UsersFilters.tsx`, `UsersClient.tsx`, `user-list.ts`, `page.tsx`)**:
   - Replaced KYC filter with Supervisor custom dropdown selector in `UsersFilters.tsx` and active filter chip strip.
   - Connected `supervisor` parameter to `getUserList`: joins `user_supervisors` junction table and matches `supervisor_id`.
   - Wired `supervisorFilter` state, active counts, URL query synchronization, and export actions.
   - Pre-fetched active supervisors in SSR via `getActiveSupervisorsCached()` in `page.tsx`.
4. **Native Mobile App Synchronization (`UserTouchCard.tsx`, `UserFiltersPanel.tsx`, `users.tsx`, `useUsersData.ts`)**:
   - `UserTouchCard.tsx`: Employee ID rendered cleanly below user's full name. Location updated with city above and state below. Machine category and masked Aadhaar / formatted DL metadata added.
   - `UserFiltersPanel.tsx`: Replaced KYC filter card with Supervisor filter category card utilizing `DropdownFilterSelector` with search.
   - `users.tsx` & `useUsersData.ts`: Extended infinite query to accept `supervisorFilter` and query both `users.supervisor_id` and `user_supervisors` junction table.

---

### Verification:
- `pnpm --filter @reachinternational/web exec tsc --noEmit`: 0 errors.
- `pnpm --filter @reachinternational/mobile exec tsc --noEmit`: 0 errors.
- `pnpm typecheck`: 7/7 workspace packages clean (0 errors).
- `node scripts/check-typography.mjs`: 0 raw typography property violations.
- `node scripts/test-touch-haptics.mjs`: 100% passed.
- `node apps/mobile/run-tests.mjs`: 357/357 verification scenarios passed (100%).
- `node apps/mobile/test/test-users-workflows.mjs`: 42/42 passed (100%).
- `node scripts/run-all-tests.mjs`: 27/27 monorepo suites passed (100%).
