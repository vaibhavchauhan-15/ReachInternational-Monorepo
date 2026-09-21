# Current Task: HR & Operator Payroll Full Route Accessibility & Multi-Role Implementation (/hr, /payroll)

Status: COMPLETED & FULLY VERIFIED (2026-09-21)

## Goal & Scope
1. **Full 4-Role Accessibility**:
   - Ensure the HR Payroll routes (`/hr`, `/payroll`) are fully accessible and properly operational for `super_admin`, `admin`, `manager`, and `hr`.
   - Protect routes from unauthorized roles (`supervisor`, `operator`).
2. **Edge Auth Proxy Alignment**:
   - Move `/hr` from `deprecatedRoutes` to `activeProtectedRoutes` in `apps/web/proxy.ts` to eliminate edge redirects to `/dashboard`.
   - Register route alias redirect from `/payroll` to `/hr` in `apps/web/next.config.ts`.
3. **Database Security Hardening & Rate Mutation RPCs (Migration 095)**:
   - Added caller RBAC guard inside `get_hr_payroll_summary` verifying `role IN ('super_admin', 'admin', 'manager', 'hr')`.
   - Created `update_operator_payroll_rates(p_operator_id, p_daily_rate, p_ot_hourly_rate)` with `SECURITY DEFINER` and caller role validation.
   - Created `bulk_update_operator_payroll_rates(p_updates)` for atomic batch rate updates in a single transaction.
   - Fixed mobile client RLS blockage where `hr` and `manager` were blocked by Postgres RLS when editing rates.
4. **Navigation & Command Palette Parity**:
   - Web Bottom Navigation (`BottomNav.tsx`): Dynamically include `more` overflow matches so `/hr` highlights the "More" tab for Manager, Admin, and Super Admin.
   - Mobile Bottom Navigation (`MobileBottomNav.tsx`): Dynamically include `more` matches in the "More" tab.
   - Web More Page (`MorePageClient.tsx`): Added `Banknote` icon to `ICONS` mapping.
   - Command Palette (`CommandPalette.tsx` & `MobileCommandPalette.tsx`): Added `nav-hr` ("HR & Operator Payroll", `⌘P`, roles: `super_admin`, `admin`, `manager`, `hr`) and granted `hr` to `nav-operations-running-hours`.
5. **Permissions Matrix & Codes**:
   - Added `HR_PAYROLL_VIEW: "hr.payroll.view"` and `HR_PAYROLL_MANAGE: "hr.payroll.manage"` to `@reachinternational/permissions`.
   - Granted `"hr.payroll.view"` and `"hr.payroll.manage"` to `admin`, `manager`, and `hr` in `ROLE_PERMISSIONS`.

## Delivered Updates
1. **Edge Proxy & Routing**:
   - `apps/web/proxy.ts`: Moved `"/hr"` from `deprecatedRoutes` to `activeProtectedRoutes`.
   - `apps/web/next.config.ts`: Added permanent redirect `{ source: "/payroll", destination: "/hr", permanent: false }`.
2. **Normalized Database Architecture (Migration 096)**:
   - Applied `supabase/migrations/096_operator_payrolls_table.sql` to live database `dhbbgfzbyatzvqafnsqp`.
   - Created normalized `public.operator_payrolls` table linking to `public.users(id)` via foreign key with 0 duplicated operator demographics.
   - Added dedicated B-tree indexes (`idx_operator_payrolls_month`, `idx_operator_payrolls_operator_id`, `idx_operator_payrolls_status`, `idx_operator_payrolls_approved_by`).
   - Added unique constraint `(operator_id, payroll_month)` and non-negative CHECK constraints.
   - Updated `get_hr_payroll_summary` RPC to dynamically import operator demographic info via `JOIN public.users u ON u.id = p.operator_id`.
   - Updated `update_operator_payroll_rates` and `bulk_update_operator_payroll_rates` to update `operator_payrolls` and sync baseline rates.
3. **PostgreSQL Security RPCs (Migration 095)**:
   - Implemented `update_operator_payroll_rates` and `bulk_update_operator_payroll_rates` with caller authorization check.
   - Updated `get_hr_payroll_summary` with explicit caller role verification.
4. **Permissions Package (`packages/permissions/`)**:
   - `src/permissions.ts`: Defined `HR_PAYROLL_VIEW` and `HR_PAYROLL_MANAGE`.
   - `src/matrix.ts`: Assigned permissions to `admin`, `manager`, `hr`.
5. **Web Implementation (`apps/web/`)**:
   - `app/actions/hr.ts`: Connected `updateOperatorRates` and `bulkUpdateOperatorRates` to call RPCs.
   - `app/(app)/hr/HRPayrollClient.tsx`: Linked operator name to `/users?search=...` with `ExternalLink` icon.
   - `components/navigation/BottomNav.tsx`: Spread `more` matches to highlight `more` tab when on `/hr`.
   - `components/navigation/MorePageClient.tsx`: Added `Banknote` icon to `ICONS`.
   - `components/ui/CommandPalette.tsx`: Added `nav-hr` and added `hr` to running hours.
6. **Mobile Implementation (`apps/mobile/`)**:
   - `app/(app)/hr.tsx`: Switched rate updating to `supabase.rpc('update_operator_payroll_rates')`, and linked operator name to `/(app)/users?search=...` with `ExternalLink` icon.
   - `app/(app)/users.tsx`: Added `useLocalSearchParams` to automatically populate search filter from route navigation.
   - `components/navigation/MobileBottomNav.tsx`: Included `more` matches in `more` tab.
   - `components/navigation/MobileCommandPalette.tsx`: Added `nav-hr` and added `hr` to running hours.

## Verification
- Navigation tests (`packages/permissions/src/navigation.test.ts`): Passed (1/1 tests, 0 failures).
- Web TypeScript check (`pnpm --filter @reachinternational/web typecheck`): Passed (0 errors, exit 0).
- Mobile TypeScript check (`pnpm --filter @reachinternational/mobile typecheck`): Passed (0 errors, exit 0).
- Monorepo Turbo typecheck (`pnpm typecheck`): Passed across all 7 packages (7/7 success, exit 0).
- Live Supabase RPC Execution: `get_hr_payroll_summary` and `update_operator_payroll_rates` verified on live database (`dhbbgfzbyatzvqafnsqp`).