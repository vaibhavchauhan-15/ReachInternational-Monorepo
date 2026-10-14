# Native App Quick Access Search Optimization — Audit & Implementation Plan

## Phase 1: Comprehensive Codebase & Navigation Audit

### 1. Route & Screen Inventory
The native app (`apps/mobile`) uses Expo Router with a persistent `<Tabs>` architecture in `apps/mobile/app/(app)/_layout.tsx`, backed by canonical RBAC rules from `@reachinternational/permissions`.

| # | Route / Path | Destination Name | Category | Hierarchical Breadcrumb | Authorized Roles | Screen File |
|---|-------------|------------------|----------|-------------------------|------------------|-------------|
| 1 | `/dashboard` | Home / Executive Overview | Navigation | `Home` | All 6 Canonical Roles | `app/(app)/dashboard.tsx` |
| 2 | `/machines` | Machines Directory | Navigation | `Fleet → Machines` | `super_admin`, `admin`, `manager`, `supervisor` | `app/(app)/machines.tsx` |
| 3 | `/machines` | My Assigned Machine | Navigation | `Fleet → My Machine` | `operator` | `app/(app)/machines.tsx` |
| 4 | `/operations` | Operations Hub | Navigation | `Operations` | All 6 Canonical Roles | `app/(app)/operations.tsx` |
| 5 | `/operations?tab=today` | Today's Shift Monitor | Navigation | `Operations → Today's Shifts` | `super_admin`, `admin`, `manager`, `supervisor`, `hr` | `app/(app)/operations.tsx` |
| 6 | `/operations?tab=entry` | Operator Shift Entry | Navigation | `Operations → Shift Entry` | `super_admin`, `admin`, `manager`, `supervisor`, `operator` | `app/(app)/operations.tsx` |
| 7 | `/operations?tab=history` | Operator Log History | Navigation | `Operations → Log History` | `super_admin`, `admin`, `manager`, `supervisor`, `operator` | `app/(app)/operations.tsx` |
| 8 | `/operations?tab=logs` | Machinery Running Hours | Navigation | `Operations → Running Hours` | `super_admin`, `admin`, `manager`, `supervisor`, `hr` | `app/(app)/operations.tsx` |
| 9 | `/running-logs` | Daily Running Hours Logs | Navigation | `Operations → Daily Running Logs` | `super_admin`, `admin`, `manager`, `supervisor`, `hr` | `app/(app)/running-logs.tsx` |
| 10 | `/attendance` | Attendance & Shifts | Navigation | `Workforce → Attendance` | All 6 Canonical Roles | `app/(app)/attendance.tsx` |
| 11 | `/payroll` | Payroll & Compensation | Navigation | `Workforce → Payroll` | `super_admin`, `admin`, `hr` | `app/(app)/payroll.tsx` |
| 12 | `/clients` | Clients Directory | Navigation | `Commercial → Clients` | `super_admin`, `admin`, `manager`, `supervisor` | `app/(app)/clients.tsx` |
| 13 | `/users` | User & Staff Directory | Navigation | `Administration → Users` | `super_admin`, `admin`, `manager`, `supervisor`, `hr` | `app/(app)/users.tsx` |
| 14 | `/profile` | User Profile & Identity | Navigation | `Account → Profile` | All 6 Canonical Roles | `app/(app)/profile/index.tsx` |
| 15 | `/profile/edit` | Edit Profile Details | Navigation | `Account → Profile → Edit Profile` | All 6 Canonical Roles | `app/(app)/profile/edit.tsx` |
| 16 | `/settings` | Settings Hub | Settings | `Settings` | All 6 Canonical Roles | `app/(app)/settings/index.tsx` |
| 17 | `/settings/account` | Account Settings | Settings | `Settings → Account` | All 6 Canonical Roles | `app/(app)/settings/account.tsx` |
| 18 | `/settings/preferences` | App Preferences & Styling | Settings | `Settings → Preferences` | All 6 Canonical Roles | `app/(app)/settings/preferences.tsx` |
| 19 | `/settings/preferences` | Theme Customization | Settings | `Settings → Preferences → Theme` | All 6 Canonical Roles | `app/(app)/settings/preferences.tsx` |
| 20 | `/settings/font-size` | Font Size & Display Scaling | Settings | `Settings → Preferences → Font Size` | All 6 Canonical Roles | `app/(app)/settings/font-size.tsx` |
| 21 | `/settings/notification` | Notification Settings | Settings | `Settings → Notifications` | All 6 Canonical Roles | `app/(app)/settings/notification.tsx` |
| 22 | `/settings/password` | Change Password | Settings | `Settings → Account → Password` | All 6 Canonical Roles | `app/(app)/settings/password.tsx` |
| 23 | `/settings/security` | Account Security & Hardware Store | Settings | `Settings → Account → Security` | All 6 Canonical Roles | `app/(app)/settings/security.tsx` |
| 24 | `/settings/app-info` | App Info & Specifications | Settings | `Settings → App Info` | All 6 Canonical Roles | `app/(app)/settings/app-info.tsx` |
| 25 | `/settings/support` | Support & Help Desk | Settings | `Settings → Support` | All 6 Canonical Roles | `app/(app)/settings/support.tsx` |
| 26 | `/account-deletion` | Delete Account & Erasure | Settings | `Settings → Account → Delete Account` | All 6 Canonical Roles | `app/(app)/account-deletion/index.tsx` |
| 27 | `/account-deletion/guide` | Account Deletion Guide | Settings | `Settings → Account → Deletion Guide` | All 6 Canonical Roles | `app/(app)/account-deletion/guide.tsx` |
| 28 | `/privacy` | Privacy Policy | System | `Legal → Privacy Policy` | All 6 Canonical Roles | `app/(app)/privacy.tsx` |
| 29 | `/terms` | Terms of Service | System | `Legal → Terms of Service` | All 6 Canonical Roles | `app/(app)/terms.tsx` |
| 30 | `/motion-lab` | Motion & Transitions Lab | System | `Diagnostics → Motion Lab` | `super_admin`, `admin` | `app/(app)/motion-lab.tsx` |

### 2. Actionable System Functions & Quick Actions Inventory

| # | Action Identifier | Title | Category | Hierarchical Breadcrumb | Action / Handler | Roles |
|---|-------------------|-------|----------|-------------------------|------------------|-------|
| 31 | `sys-toggle-theme` | Switch to Dark / Light Theme | System | `System → Appearance` | `setMode(isDark ? 'light' : 'dark')` | All Roles |
| 32 | `sys-toggle-haptics` | Toggle Haptic Feedback | System | `System → Preferences` | `setHapticsEnabled(!hapticsEnabled)` | All Roles |
| 33 | `sys-logout` | Sign Out of Account | System | `System → Session` | `signOut()` + redirect to login | All Roles |
| 34 | `action-add-machine` | Add New Machine Asset | Quick Actions | `Fleet → Machines → New Asset` | Navigate `/machines` | `super_admin`, `admin`, `manager` |
| 35 | `action-assign-operator` | Assign Operator to Machine | Quick Actions | `Operations → Today's Shifts → Roster` | Navigate `/operations?tab=today` | `super_admin`, `admin`, `manager`, `supervisor` |
| 36 | `action-log-hours` | Log Daily Machine Hours (HMR) | Quick Actions | `Operations → Shift Entry → Log Meter` | Navigate `/operations?tab=entry` | `super_admin`, `admin`, `manager`, `supervisor`, `operator` |
| 37 | `action-export-running-logs` | Export Running Hours Summary | Quick Actions | `Operations → Daily Running Logs → Export` | Navigate `/running-logs` | `super_admin`, `admin`, `manager`, `supervisor`, `hr` |
| 38 | `action-invite-user` | Register New Personnel Account | Quick Actions | `Administration → Users → Create User` | Navigate `/users` | `super_admin`, `admin`, `manager`, `hr` |

---

### 3. Existing Component & Navigation Patterns
1. **Modal Container**: `AppModal.tsx` handles responsive layout (`bottom` on mobile viewports <640px, `center` on desktop/tablets).
2. **Search Input**: `SearchInput.tsx` provides clean text input with clear `X` button, search icon, and focus ring.
3. **Typography**: Strictly canonical `<Text variant="...">` with **zero raw typography properties in StyleSheet**.
4. **Theme**: `useTheme()` providing `theme`, `isDark`, `setMode`.
5. **Haptics**: `usePreferences()` providing `hapticsEnabled`, `setHapticsEnabled`, and `haptics.select()`, `haptics.confirm()`, `haptics.tap()`.
6. **Query Parameter Navigation**: When navigating to tabs like `/operations?tab=today`, Expo Router requires clean parameter passing so `useLocalSearchParams` in `operations.tsx` updates `activeTab` immediately.

---

## Phase 2: Implementation Architecture

1. **Dedicated Destination Registry (`apps/mobile/lib/navigation/quickAccessRegistry.ts`)**:
   - Extract destination generation into a clean, testable, typed helper.
   - Dynamically compute items based on `userRole`, `isDark`, and `hapticsEnabled`.
   - Strictly filter out inaccessible items for unauthorized roles (e.g. operators cannot see `/users`, `/payroll`, `/clients`, `/motion-lab`).
   - Every destination has an explicit `breadcrumb` string (e.g. `Settings → Preferences → Theme`).

2. **Scoring & Debounced Search Algorithm**:
   - 120ms debounce on input query so typing is 60fps fluid.
   - Normalized matching: lowercase, whitespace collapsed, punctuation tolerant.
   - Token-based ranking:
     - Exact title prefix: +200
     - Title token match: +100
     - Breadcrumb match: +80
     - Keyword match: +50
     - Subtitle match: +20
     - Route match: +10
   - Grouped by `Navigation`, `Settings`, `Quick Actions`, `System`.

3. **Interactive & Ergonomic UI (`MobileCommandPalette.tsx`)**:
   - Renders hierarchical breadcrumbs above the title (`Text variant="micro"` with `#737373` / `#a3a3a3` muted styling).
   - Minimum 52px row height with 48px hitSlop.
   - Smooth keyboard navigation (ArrowDown, ArrowUp, Enter, Escape).
   - Clear empty state with "Clear search" CTA.
   - Seamless direct navigation supporting query params (e.g. `?tab=today`).

4. **Zero Raw Typography Compliance**:
   - 100% compliance with `node scripts/check-typography.mjs`.

5. **Automated Verification**:
   - Create `apps/mobile/test-quick-access.mjs` verifying:
     - 38 destinations and actions
     - RBAC isolation across all 6 roles
     - Breadcrumb hierarchy verification
     - Scoring and ranking accuracy
     - Query parameter handling
