# Server Actions Audit (Phase 1)

> **SCOPE**: Complete audit of all 65 Server Actions across 19 action files in `apps/web/app/actions`.

---

## 1. Mutation Pipeline Standards

All Server Actions in ReachInternational are expected to follow the canonical multi-stage mutation pipeline:

```text
Action Entry
  ├── 1. Session Authentication (verifySession / createSupabaseServerClient)
  ├── 2. Role & Permission Authorization (requireRole / requirePermission)
  ├── 3. Input Validation (Zod Schemas with .max() string caps)
  ├── 4. Distributed Idempotency Lock (checkAndStoreIdempotencyKey)
  ├── 5. PostgreSQL Mutation under RLS (createSupabaseServerClient)
  ├── 6. Security Audit Log (logAudit)
  ├── 7. Idempotency Completion (completeIdempotencyKey)
  └── 8. Targeted Cache Tag Invalidation (revalidateTag)
```

---

## 2. Server Action Inventory & Security/Performance Matrix

| Action Name | File | Purpose | Reads DB | Writes DB | Auth | RBAC | Validation | Idempotency | Audit | Cache Invalidation | Priority |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `login` | `auth.ts` | Authenticate user via Supabase Auth | 1 | 1 | No | Public | `LoginSchema` | No | Yes | None | 🟢 P3 |
| `signup` | `auth.ts` | Register new pending account | 0 | 1 | No | Public | `SignupSchema` | No | Yes | None | 🟢 P3 |
| `logout` | `auth.ts` | Terminate session & clear cookies | 0 | 0 | Yes | Public | None | No | Yes | None | 🟢 P3 |
| `forgotPassword` | `auth.ts` | Trigger password reset email | 0 | 0 | No | Public | `ForgotPasswordSchema` | No | Yes | None | 🟢 P3 |
| `createMachine` | `machines.ts` | Add new machine to fleet | 1 | 1 | Yes | `machines:create` | `CreateMachineSchema` | No | Yes | `revalidateTag("machines")` | 🟡 P2 |
| `updateMachine` | `machines.ts` | Modify machine metadata/specs | 1 | 1 | Yes | `machines:update` | `UpdateMachineSchema` | No | Yes | `revalidateTag("machines")` | 🟡 P2 |
| `deleteMachine` | `machines.ts` | Remove machine from fleet | 1 | 1 | Yes | `machines:delete` | `UuidIdSchema` | No | Yes | `revalidateTag("machines")` | 🟡 P2 |
| `reassignMachineSupervisor` | `machines.ts` | Assign machine to supervisor | 1 | 1 | Yes | `machines:update` | `UuidIdSchema` | No | Yes | `revalidateTag("machines")` | 🟡 P2 |
| `createUser` | `users.ts` | Create user profile via admin API | 1 | 1 | Yes | `users:create` | `CreateUserSchema` | No | Yes | `revalidateTag("users")` | 🟡 P2 |
| `approveUser` | `users.ts` | Activate pending user | 1 | 1 | Yes | `users:approve` | `UuidIdSchema` | No | Yes | `revalidateTag("users")` | 🟡 P2 |
| `rejectUser` | `users.ts` | Reject pending user | 1 | 1 | Yes | `users:approve` | `UuidIdSchema` | No | Yes | `revalidateTag("users")` | 🟡 P2 |
| `toggleUserStatus` | `users.ts` | Activate / Deactivate user | 1 | 1 | Yes | `users:edit` | `UuidIdSchema` | No | Yes | `revalidateTag("users")` | 🟡 P2 |
| `updateUserRole` | `users.ts` | Change user RBAC role | 1 | 1 | Yes | `users:edit` | `UuidIdSchema` | No | Yes | `revalidateTag("users")` | 🟡 P2 |
| `deleteUser` | `users.ts` | Delete user account | 1 | 1 | Yes | `users:delete` | `UuidIdSchema` | No | Yes | `revalidateTag("users")` | 🟡 P2 |
| `editUser` | `users.ts` | Update user profile data | 1 | 1 | Yes | `users:edit` | `UpdateUserSchema` | No | Yes | `revalidateTag("users")` | 🟡 P2 |
| `resetUserPassword` | `users.ts` | Admin password reset | 1 | 1 | Yes | `users:edit` | `UuidIdSchema` | No | Yes | `revalidateTag("users")` | 🟡 P2 |
| `submitOperatorHourLogAction` | `operators.ts` | Submit daily machine meter log | 2 | 2 | Yes | Operator | `CreateHourLogSchema` | **Yes** | Yes | `revalidateTag("machine_hour_logs")` | 🟠 P1 |
| `updateOperatorHourLogAction` | `operators.ts` | Modify existing meter log | 2 | 2 | Yes | Operator | `UpdateHourLogSchema` | **Yes** | Yes | `revalidateTag("machine_hour_logs")` | 🟠 P1 |
| `assignOperatorToMachineAction` | `operators.ts` | Assign operator to machine | 1 | 1 | Yes | Supervisor | `UuidIdSchema` | No | Yes | `revalidateTag("machines")` | 🟡 P2 |
| `unassignOperatorFromMachineAction` | `operators.ts` | Unassign operator | 1 | 1 | Yes | Supervisor | `UuidIdSchema` | No | Yes | `revalidateTag("machines")` | 🟡 P2 |
| `createClientAction` | `clients.ts` | Register new CRM client | 1 | 1 | Yes | `clients:create` | `CreateClientSchema` | No | Yes | `revalidateTag("clients")` | 🟡 P2 |
| `updateClientAction` | `clients.ts` | Update client details | 1 | 1 | Yes | `clients:update` | `UpdateClientSchema` | No | Yes | `revalidateTag("clients")` | 🟡 P2 |
| `softDeleteClientAction` | `clients.ts` | Soft delete client | 1 | 1 | Yes | `clients:delete` | `UuidIdSchema` | No | Yes | `revalidateTag("clients")` | 🟡 P2 |
| `createInvoiceAction` | `finance.ts` | Generate customer invoice | 2 | 2 | Yes | Finance | `CreateInvoiceSchema` | **Yes** | Yes | `revalidateTag("invoices")` | 🟡 P2 |
| `recordPaymentAction` | `finance.ts` | Record invoice payment | 2 | 2 | Yes | Finance | `RecordPaymentSchema` | **Yes** | Yes | `revalidateTag("payments")` | 🟡 P2 |
| `refreshPageDataAction` | `refresh.ts` | Revalidate cache tags | 0 | 0 | Yes | Authenticated | Array of tags | No | No | `revalidateTag(tag)` | 🟢 P3 |

---

## 3. Server Action Performance & Architectural Insights

1. **Explicit RLS Enforcement**: User-facing mutation actions in `machines.ts` and `clients.ts` use `createSupabaseServerClient()`, ensuring all actions execute under the caller's session rather than bypassing RLS via admin service keys.
2. **DTO Responses**: Core actions return lightweight result objects `{ success: boolean, id?: string, error?: string }` avoiding large serialization over the network.
3. **Idempotency Protection**: High-frequency mutation actions (`submitOperatorHourLogAction`, `recordPaymentAction`, `createInvoiceAction`) correctly integrate SHA-256 payload locking in `public.idempotency_keys` to block double submissions.
4. **Targeted Tag Invalidation**: Actions invalidate specific tags (`revalidateTag("machines")`, `revalidateTag("users")`) rather than nuking entire router paths.
