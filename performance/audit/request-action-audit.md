# Comprehensive Request & Server Action Audit (Phase 4)

> **SCOPE**: End-to-end request tracing from user browser trigger through Server Actions, DAL layer, PostgreSQL RLS policies, audit logging, idempotency locking, and cache revalidations.

---

## 1. Request Flow Architecture

```text
User Interaction (Browser / Mobile)
   │
   ▼
[1] Next.js Server Action RPC (POST payload < 1MB)
   │
   ├── [2] Session Authentication (verifySession / createSupabaseServerClient)
   │
   ├── [3] Role & Permission Authorization (requireRole / requirePermission)
   │
   ├── [4] Zod Schema Validation (.parse / .safeParse)
   │
   ├── [5] Distributed Idempotency Lock (checkAndStoreIdempotencyKey in public.idempotency_keys)
   │
   ├── [6] Primary Database Mutation(s) (under PostgreSQL Row Level Security)
   │
   ├── [7] Append-Only Audit Logging (logAudit in public.audit_logs)
   │
   ├── [8] Idempotency Completion (completeIdempotencyKey in public.idempotency_keys)
   │
   └── [9] Targeted Next.js Cache Invalidation (revalidateTag)
   │
   ▼
Minimal JSON Response ({ success: true, id?: string })
   │
   ▼
Optimistic UI Update / Toast Notification
```

---

## 2. End-to-End Operation Traces

---

### Operation 1: Operator Daily Meter Log Submission

- **User Action**: Field operator clicks "Submit Daily Log" in Section C of `/operations?tab=entry`.
- **Browser Request**: 1 Next.js Server Action RPC (`POST /operations`) with JSON payload (`machineId`, `startMeter`, `endMeter`, `startTime`, `endTime`, `shift`, `remarks`, `idempotencyKey`).
- **Next.js Component**: `apps/web/components/dashboard/OperatorDashboard.tsx`
- **Server Action**: `submitOperatorHourLogAction` (`apps/web/app/actions/operators.ts`)
- **DAL**: `getCurrentUser()`, `requireRole("operator", "supervisor", "admin")`
- **Database Tables**: `users`, `idempotency_keys`, `machine_hour_logs`, `machines`, `audit_logs`
- **Database Operations (7 Round-Trips)**:
  1. `getCurrentUser()` ──► `public.users` (Cached via React `cache()`)
  2. `checkAndStoreIdempotencyKey()` ──► `SELECT` + `INSERT` on `public.idempotency_keys`
  3. `checkShiftOverlapServer()` ──► `SELECT` on `public.machine_hour_logs`
  4. Hour Log Creation ──► `INSERT` on `public.machine_hour_logs`
  5. Machine HMR Update ──► `UPDATE` on `public.machines`
  6. Security Audit ──► `INSERT` on `public.audit_logs`
  7. Idempotency Completion ──► `UPDATE` on `public.idempotency_keys`
- **Authentication**: `auth.users` cookie session
- **Authorization**: Role verified (`operator`, `supervisor`, `admin`)
- **Validation**: Zod meter range check (`end_meter >= start_meter`)
- **Idempotency**: SHA-256 hash locked in `public.idempotency_keys`
- **Audit**: `machine.hour_logged` logged with metadata
- **Cache Invalidation**: `revalidateTag(CACHE_TAGS.hourLogs)`
- **Total Network Requests**: 1
- **Total DB Calls**: **7 database round-trips**
- **Problems**: High database latency (~180ms) resulting from 7 sequential network round trips to Supabase.
- **Priority**: 🔴 **P0**
- **Optimization Target**: Consolidate checks, log insert, machine update, and audit log into a single atomic PostgreSQL stored procedure (`submit_operator_hour_log_v2`), reducing DB round-trips from **7 to 2** (< 25ms total execution time).

---

### Operation 2: Machine Fleet Creation (`createMachine`)

- **User Action**: Fleet manager submits "Add Machine" modal form on `/machines`.
- **Browser Request**: 1 Server Action RPC (`POST /machines`)
- **Next.js Component**: `AddMachineModal.tsx` ──► `MachineListClient.tsx`
- **Server Action**: `createMachine(formData)` (`apps/web/app/actions/machines.ts`)
- **DAL**: `getCurrentUser()`, `requirePermission("machines:create")`
- **Database Tables**: `users`, `machines`, `audit_logs`
- **Database Operations (3 Calls)**:
  1. User session check (Cached)
  2. Machine insert ──► `INSERT INTO public.machines`
  3. Audit log ──► `INSERT INTO public.audit_logs`
- **Authentication**: `auth.users` session
- **Authorization**: `requirePermission("machines:create")`
- **Validation**: `CreateMachineSchema.parse(formData)`
- **Idempotency**: Natural unique key (`machines_machine_id_key` on `machine_id`)
- **Audit**: `machine.created` logged
- **Cache Invalidation**: `revalidateTag("machines")`, `revalidateTag("machinesMeta")`
- **Total Network Requests**: 1
- **Total DB Calls**: 3
- **Priority**: 🟡 **P2** (Healthy execution profile)
- **Optimization Target**: 2 DB calls; maintain current performance.

---

### Operation 3: Machine Fleet Deletion (`deleteMachine`)

- **User Action**: Administrator confirms deletion in `DeleteMachineModal.tsx`.
- **Browser Request**: 1 Server Action RPC
- **Server Action**: `deleteMachine(machineId)` (`apps/web/app/actions/machines.ts`)
- **Database Operations (3 Calls)**:
  1. User session check (Cached)
  2. Machine deletion ──► `DELETE FROM public.machines WHERE id = machineId`
  3. Audit log ──► `INSERT INTO public.audit_logs`
- **Cache Invalidation**: `revalidateTag("machines")`
- **UI Trigger**: `router.refresh()` in `MachineListClient.tsx:L529`
- **Problem**: 🟠 `router.refresh()` forces full-page RSC reload.
- **Priority**: 🟠 **P1**
- **Optimization Target**: Replace `router.refresh()` with local optimistic state removal.

---

### Operation 4: User Approval (`approveUser`)

- **User Action**: Administrator clicks "Approve" on pending user banner on `/users`.
- **Browser Request**: 1 Server Action RPC
- **Next.js Component**: `UsersPageClient.tsx`
- **Server Action**: `approveUser(userId)` (`apps/web/app/actions/users.ts`)
- **Database Operations (3 Calls)**:
  1. User session check (Cached)
  2. User status update ──► `UPDATE public.users SET status = 'active' WHERE id = userId`
  3. Audit log ──► `INSERT INTO public.audit_logs`
- **Email Notification**: Triggers `sendApprovalEmail(user.email)` in background
- **Cache Invalidation**: `revalidateTag("users")`, `revalidatePath("/users")`
- **UI Trigger**: `router.refresh()` in `users-client.tsx:L101`
- **Problem**: 🟠 `router.refresh()` triggers 2 database queries (`getAllUsers()` and `getPendingUsers()`) to reload the entire user table.
- **Priority**: 🟠 **P1**
- **Optimization Target**: Optimistic UI badge update; eliminate redundant `getPendingUsers()` call.

---

### Operation 5: User Role Modification (`updateUserRole`)

- **User Action**: Super Admin changes user role from dropdown in `UserEditModal`.
- **Browser Request**: 1 Server Action RPC
- **Server Action**: `updateUserRole(userId, newRole)` (`apps/web/app/actions/users.ts`)
- **Database Operations (3 Calls)**:
  1. Caller authorization check (`requireRole("super_admin", "admin")`)
  2. User role update ──► `UPDATE public.users SET role = newRole WHERE id = userId`
  3. Audit log ──► `INSERT INTO public.audit_logs`
- **Database Trigger Guard**: Trigger `prevent_self_role_status_mutation()` blocks administrators from elevating their own account.
- **Cache Invalidation**: `revalidateTag("users")`
- **Total DB Calls**: 3
- **Priority**: 🟡 **P2**

---

### Operation 6: CRM Client Creation (`createClientAction`)

- **User Action**: Sales Manager creates client in `CreateClientModal.tsx`.
- **Browser Request**: 1 Server Action RPC
- **Server Action**: `createClientAction(state, formData)` (`apps/web/app/actions/clients.ts`)
- **Database Operations (3 Calls)**:
  1. User session check
  2. Client insert ──► `INSERT INTO public.clients`
  3. Audit log ──► `INSERT INTO public.audit_logs`
- **Cache Invalidation**: `revalidateTag("clients")`
- **Total DB Calls**: 3
- **Priority**: 🟢 **P3**

---

### Operation 7: Batch Invoice Item Insertion (`createInvoiceAction`)

- **User Action**: Finance manager saves invoice with 20 line items.
- **Browser Request**: 1 Server Action RPC
- **Server Action**: `createInvoiceAction(input)` (`apps/web/app/actions/finance.ts`)
- **Database Operations (23 Calls — 🔴 N+1 Loop Writes)**:
  1. User session check (1 call)
  2. Invoice header insert (1 call)
  3. **Invoice items loop insert**: `for (const item of input.items)` ──► **20 individual `INSERT` calls**
  4. Audit log (1 call)
- **Problem**: 🔴 **P0 N+1 Database Writes**.
- **Priority**: 🔴 **P0**
- **Optimization Target**: Replace `for` loop with single batch array insert `supabase.from("finance_invoice_items").insert(input.items)` (reducing DB calls from 23 to 3).

---

## 3. Server Action Performance & Database Call Matrix

| Server Action | File | Auth Checks | Zod Validation | DB Queries | Idempotency Check | Audit Log | Total DB Calls | Action Priority |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `submitOperatorHourLogAction` | `operators.ts` | 1 | 1 | 4 | 2 | 1 | **7** | 🔴 **P0** |
| `createInvoiceAction` | `finance.ts` | 1 | 1 | 1 + N | 0 | 1 | **3 + N** | 🔴 **P0** |
| `createMachine` | `machines.ts` | 1 | 1 | 1 | 0 | 1 | **3** | 🟡 **P2** |
| `updateMachine` | `machines.ts` | 1 | 1 | 1 | 0 | 1 | **3** | 🟡 **P2** |
| `deleteMachine` | `machines.ts` | 1 | 1 | 1 | 0 | 1 | **3** | 🟠 **P1** |
| `reassignMachineSupervisor` | `machines.ts` | 1 | 1 | 1 | 0 | 1 | **3** | 🟡 **P2** |
| `createUser` | `users.ts` | 1 | 1 | 2 | 0 | 1 | **4** | 🟡 **P2** |
| `approveUser` | `users.ts` | 1 | 1 | 1 | 0 | 1 | **3** | 🟠 **P1** |
| `rejectUser` | `users.ts` | 1 | 1 | 1 | 0 | 1 | **3** | 🟠 **P1** |
| `toggleUserStatus` | `users.ts` | 1 | 1 | 1 | 0 | 1 | **3** | 🟠 **P1** |
| `updateUserRole` | `users.ts` | 1 | 1 | 1 | 0 | 1 | **3** | 🟡 **P2** |
| `resetUserPassword` | `users.ts` | 1 | 1 | 1 | 0 | 1 | **3** | 🟡 **P2** |
| `assignOperatorToMachineAction`| `operators.ts` | 1 | 1 | 4 | 0 | 1 | **6** | 🟠 **P1** |
| `createClientAction` | `clients.ts` | 1 | 1 | 1 | 0 | 1 | **3** | 🟢 **P3** |
| `updateClientAction` | `clients.ts` | 1 | 1 | 1 | 0 | 1 | **3** | 🟢 **P3** |
| `softDeleteClientAction` | `clients.ts` | 1 | 1 | 1 | 0 | 1 | **3** | 🟢 **P3** |

---

## 4. Polling & Realtime Subscription Audit

- **Client Polling Intervals**: **0** (Zero wasteful `setInterval` or `refetchInterval` polling loops exist on web client components).
- **Rate-Limiter Cleanup Interval**: 1 in `apps/web/lib/security/rate-limiter.ts:L16` (Server Node.js memory garbage collection, runs every 60s).
- **Realtime Subscriptions**: 1 in `apps/mobile/lib/realtime.ts:L80` for mobile push breakdown notifications.

---

## 5. Phase 4 Request Priority Ranking

The highest-cost operations ranked by cumulative impact (`execution_latency × call_frequency`):

1. 🔴 **P0-01 — Operator Daily Log Submission (`submitOperatorHourLogAction`)**:
   - **Cost**: 7 database round trips per submission.
   - **Frequency**: Executed daily by every active machine operator.
   - **Remediation**: Atomic stored procedure in Phase 10.
2. 🔴 **P0-02 — Monolithic Operations Page Load (`/operations`)**:
   - **Cost**: 10 parallel queries downloading 850 rows.
   - **Frequency**: Executed on every navigation to operations.
   - **Remediation**: Tab-routed sub-loaders in Phase 5.
3. 🔴 **P0-03 — N+1 Loop Item Inserts (`createInvoiceAction`, `inventory.ts`)**:
   - **Cost**: 20+ sequential insert round trips.
   - **Remediation**: Refactor into atomic single batch array inserts.
4. 🟠 **P1-01 — User Status Toggle Cascades (`users-client.tsx`)**:
   - **Cost**: `router.refresh()` triggers full 28-row table re-fetch on every toggle.
   - **Remediation**: Optimistic UI state.
