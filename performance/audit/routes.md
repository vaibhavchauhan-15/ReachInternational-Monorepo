# Complete Route Architecture Audit (Phase 1)

> **SCOPE**: All Next.js 16 App Router routes in `apps/web/app` and Expo Mobile Router routes in `apps/mobile/app`.

---

## 1. Web Application Route Inventory & Classification (`apps/web/app`)

| Route | Type | Auth Required | Role / Access Scope | RSC vs Client Boundary | Data Requirements | Mutation Triggers | Performance & Optimization Concerns | Priority |
| :--- | :---: | :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| `/login` | Public | No (Redirects if auth) | Anonymous | RSC Shell (`page.tsx`) + Client Form (`login-form.tsx`) | None | `login()` Server Action | 1.41 MB initial JS bundle; multiple vendor dependencies | 🟡 P2 |
| `/signup` | Public | No (Redirects if auth) | Anonymous | RSC Shell (`page.tsx`) + Client Form (`signup-form.tsx`) | None | `signup()` Server Action | 1.43 MB initial JS bundle | 🟡 P2 |
| `/forgot-password` | Public | No | Anonymous | RSC Shell (`page.tsx`) + Client Form | None | `forgotPassword()` Action | Static HTML shell | 🟢 P3 |
| `/` | Public/Protected | Conditional | All | RSC (`page.tsx`) | Session check via Edge Proxy | None | Gateway redirect to `/login` or `/machines` | 🟢 P3 |
| `/machines` | Protected | Yes | `admin`, `service_manager`, `supervisor`, `engineer` | RSC (`page.tsx`) + Client (`MachineListClient.tsx`) | `getMachines()`, user permissions, active counts | `createMachine`, `updateMachine`, `deleteMachine` | `MachineListClient` is 39.6 KB client bundle; inline `router.refresh()` | 🟠 P1 |
| `/machines/[id]` | Protected | Yes | `admin`, `service_manager`, `supervisor`, `engineer` | RSC (`page.tsx`) + Client (`machine-client-view.tsx`) | `getMachineById(id)`, service records, telemetry | `updateMachine` | `machine-client-view.tsx` is 59.3 KB client bundle | 🟠 P1 |
| `/users` | Protected | Yes | `super_admin`, `admin`, `service_manager`, `hr_manager` | RSC (`page.tsx`) + Client (`users-client.tsx`) | `getUsers()`, pending approvals, role counts | `approveUser`, `rejectUser`, `updateUserRole`, `toggleUserStatus` | 8 `router.refresh()` calls; large table re-rendering | 🟠 P1 |
| `/operations` | Protected | Yes | All Roles (Role-aware tabs) | RSC (`page.tsx`) + Client (`OperationsClient.tsx`, `OperatorDashboard.tsx`) | Inline Supabase queries on `machine_hour_logs`, `machines`, `users` | `submitOperatorHourLogAction`, `assignOperatorToMachineAction` | 🔴 **P0**: Direct inline Supabase queries inside `page.tsx` using `select("*")`; `OperationsClient.tsx` is 100.8 KB | 🔴 P0 |
| `/operations?tab=logs` | Protected | Yes | `admin`, `service_manager`, `supervisor` | Sub-view in `OperationsClient.tsx` | Full logs list with 4 table joins | Log filtering & PDF export | Unbounded log history without cursor pagination | 🟠 P1 |
| `/operations?tab=assignments` | Protected | Yes | `admin`, `service_manager`, `supervisor` | Sub-view in `OperationsClient.tsx` | Assigned machines, unassigned operators | `assignOperatorToMachineAction` | Client-side search & filtering | 🟡 P2 |
| `/operations?tab=entry` | Protected | Yes | `operator`, `supervisor` | Sub-view in `OperatorDashboard.tsx` | Assigned machine details, HMR history, client list | `submitOperatorHourLogAction` | `OperatorDashboard.tsx` is 98.3 KB; large PDF modal included | 🟠 P1 |
| `/operations?tab=history` | Protected | Yes | `operator`, `supervisor` | Sub-view in `OperatorDashboard.tsx` | Operator specific logs (`operator_id`) | Edit log action | Client-side log filtering | 🟡 P2 |
| `/clients` | Protected (Deprecated) | Yes | `admin`, `service_manager` | RSC (`page.tsx`) + Client (`ClientsClient.tsx`) | `getClients()` | `createClientAction`, `updateClientAction` | Edge proxy redirects to `/machines`; route preserved | 🟢 P3 |
| `/api/cron/send-reminders` | API Route | Bearer Secret / QStash | System Background Worker | Route Handler (`route.ts`) | Machines due for service | Notification dispatch (Email/SMS) | Asynchronous execution with 10s execution timeout | 🟢 P3 |

---

## 2. Mobile Application Route Inventory (`apps/mobile/app`)

| Mobile Screen Path | Navigation Mode | Auth Required | Target Roles | Key Components | Data Strategy | Priority |
| :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| `/(auth)/login` | Stack Screen | No | Anonymous | Mobile LoginForm | Supabase Auth `signInWithPassword` | 🟢 P3 |
| `/(auth)/signup` | Stack Screen | No | Anonymous | Mobile SignupForm | Supabase Auth `signUp` | 🟢 P3 |
| `/(auth)/forgot-password` | Stack Screen | No | Anonymous | Password Reset Screen | Supabase Auth `resetPasswordForEmail` | 🟢 P3 |
| `/(app)/machines` | Bottom Tab | Yes | Management / Field | `AddMachineModal`, Fleet List | Direct Supabase query + TanStack Query cache | 🟡 P2 |
| `/(app)/operations` | Bottom Tab | Yes | Operator / Supervisor | `MeterLogModal`, Log Feed | Role-aware Daily Log entry / Supervisor Running Hours | 🟠 P1 |
| `/(app)/users` | Drawer / Modal | Yes | Management / Admins | `CreateUserModal`, `UserDetailModal` | Live Supabase query against `public.users` | 🟡 P2 |
| `/(app)/profile` | Bottom Tab | Yes | All Users | Profile Card, Logout | Cached user state | 🟢 P3 |

---

## 3. Top Route Architectural Findings

1. 🔴 **P0 — Direct Database Access in `/operations/page.tsx`**: The operations page executes 7 direct inline Supabase queries inside `page.tsx` rather than querying through `lib/dal.ts` or `lib/queries/operators.ts`, violating monorepo architectural boundaries and bypassing unified caching layers.
2. 🟠 **P1 — Oversized Client Viewports**: `OperationsClient.tsx` (100.8 KB) and `OperatorDashboard.tsx` (98.3 KB) contain embedded export modals (`PrintableSupervisorLogsModal.tsx`, `PrintableOperatorLogsModal.tsx`) which inflate the client bundle. These should be dynamically imported (`next/dynamic`).
3. 🟠 **P1 — Overuse of `router.refresh()` in Mutation Actions**: When operations or user changes occur, client components invoke `router.refresh()`, forcing full-page server component re-rendering instead of targeted tag revalidation.
