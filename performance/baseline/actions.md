# Server Actions Inventory & Baseline — Phase 0

> **Location**: `apps/web/app/actions/*`  
> **Recorded Date**: 2026-08-27  
> **Server Action Pipeline Model**:
> ```text
> Action Trigger (Client / Form)
>   ↓
> Authentication (verifySession / Supabase Auth)
>   ↓
> Authorization (RBAC / @reachinternational/permissions)
>   ↓
> Input Validation (Zod Schemas / @reachinternational/validation)
>   ↓
> Database Mutation (Supabase Server Client + PostgreSQL RLS)
>   ↓
> Audit Logging (lib/audit.ts -> public.audit_logs)
>   ↓
> Idempotency Check & Complete (lib/security/idempotency.ts)
>   ↓
> Cache Revalidation (revalidatePath / revalidateTag)
> ```

---

## 1. Core Operational Server Actions

### Fleet & Machine Management (`apps/web/app/actions/machines.ts`, `machine-import.ts`)

| Action Name | Source File | Input Validation | Auth & RBAC Guard | DB Tables Mutated | Idempotency / Audit |
|---|---|---|---|---|---|
| `createMachine` | `machines.ts` | `CreateMachineSchema` | `admin`, `service_manager` | `public.machines` | Audit logged (`MACHINE_CREATED`) |
| `updateMachine` | `machines.ts` | `UpdateMachineSchema` | `admin`, `service_manager` | `public.machines` | Audit logged (`MACHINE_UPDATED`) |
| `deleteMachine` | `machines.ts` | `UuidIdSchema` | `super_admin`, `admin` | `public.machines` | Audit logged (`MACHINE_DELETED`) |
| `reassignMachineSupervisor`| `machines.ts` | `UuidIdSchema` | `admin`, `service_manager` | `public.machines` | Audit logged (`SUPERVISOR_REASSIGNED`) |
| `importMachinesFromExcel` | `machine-import.ts`| MIME & Size Validation | `admin`, `service_manager` | `public.machines` | Batch transaction |

### User Management & Operator Lifecycle (`apps/web/app/actions/users.ts`, `operators.ts`)

| Action Name | Source File | Input Validation | Auth & RBAC Guard | DB Tables Mutated | Idempotency / Audit |
|---|---|---|---|---|---|
| `createUser` | `users.ts` | `CreateUserSchema` | `admin`, `service_manager`, `hr_manager` | `auth.users`, `public.users` | Audit logged (`USER_CREATED`) |
| `editUser` | `users.ts` | `UpdateUserSchema` | `admin`, `service_manager`, `hr_manager` | `public.users` | Audit logged (`USER_UPDATED`) |
| `approveUser` | `users.ts` | `UuidIdSchema` | `super_admin`, `admin` | `public.users` | Audit logged (`USER_APPROVED`) |
| `rejectUser` | `users.ts` | `UuidIdSchema` | `super_admin`, `admin` | `public.users` | Audit logged (`USER_REJECTED`) |
| `toggleUserStatus` | `users.ts` | `UuidIdSchema` | `admin` | `public.users` | Audit logged (`STATUS_TOGGLED`) |
| `updateUserRole` | `users.ts` | `UuidIdSchema` + `RoleSchema` | `super_admin`, `admin` | `public.users` | Audit logged (`ROLE_UPDATED`) |
| `resetUserPassword` | `users.ts` | `UuidIdSchema` | `admin` | `auth.users` | Audit logged (`PASSWORD_RESET`) |
| `deleteUser` | `users.ts` | `UuidIdSchema` | `super_admin` | `auth.users`, `public.users` | Audit logged (`USER_DELETED`) |
| `hireOperatorAction` | `operators.ts` | `CreateUserSchema` | `admin`, `service_manager` | `auth.users`, `public.users` | Audit logged (`OPERATOR_HIRED`) |

### Daily Operations & Machine Meter Logs (`apps/web/app/actions/operators.ts`)

| Action Name | Source File | Input Validation | Auth & RBAC Guard | DB Tables Mutated | Idempotency / Audit |
|---|---|---|---|---|---|
| `submitOperatorHourLogAction` | `operators.ts` | `CreateHourLogSchema` | `operator`, `service_engineer`, `supervisor` | `public.machine_hour_logs` | Idempotency key protected (`idempotency_keys`), Audit logged |
| `updateOperatorHourLogAction` | `operators.ts` | `UpdateHourLogSchema` | `supervisor`, `service_manager`, `admin` | `public.machine_hour_logs` | Idempotency key protected, Audit logged |
| `assignOperatorToMachineAction` | `operators.ts` | `AssignOperatorSchema` | `supervisor`, `service_manager`, `admin` | `public.machines` | Audit logged (`OPERATOR_ASSIGNED`) |
| `requestOperatorAssignmentChangeAction` | `operators.ts` | `AssignmentChangeSchema` | Authenticated session | `public.tasks` / `audit_logs` | Audit logged |

### Client Management (`apps/web/app/actions/clients.ts`)

| Action Name | Source File | Input Validation | Auth & RBAC Guard | DB Tables Mutated | Idempotency / Audit |
|---|---|---|---|---|---|
| `createClientAction` | `clients.ts` | `CreateClientSchema` | `admin`, `service_manager`, `sales_manager` | `public.clients` | Audit logged (`CLIENT_CREATED`) |
| `updateClientAction` | `clients.ts` | `UpdateClientSchema` | `admin`, `service_manager`, `sales_manager` | `public.clients` | Audit logged (`CLIENT_UPDATED`) |
| `softDeleteClientAction` | `clients.ts` | `UuidIdSchema` | `super_admin`, `admin` | `public.clients` | Audit logged (`CLIENT_DELETED`) |

### Authentication & Session Lifecycle (`apps/web/app/actions/auth.ts`, `refresh.ts`)

| Action Name | Source File | Input Validation | Auth & RBAC Guard | DB Tables Mutated | Idempotency / Audit |
|---|---|---|---|---|---|
| `login` | `auth.ts` | `LoginSchema` | Public / Rate Limited | Supabase Auth Session | Rate limited (10 req/min) |
| `signup` | `auth.ts` | `SignupSchema` | Public / Rate Limited | `auth.users`, `public.users` (as pending) | Rate limited (10 req/min) |
| `logout` | `auth.ts` | N/A | Authenticated | Supabase Auth Session | Revokes SSR cookie |
| `forgotPassword` | `auth.ts` | `EmailSchema` | Public / Rate Limited | Supabase Auth | Rate limited |
| `refreshPageDataAction` | `refresh.ts` | Path / Tag string | Authenticated session | None (Cache Purge) | Session verification guard |

---

## 2. Server Action Performance Targets

- Mutation Response Latency: `< 300 ms` end-to-end
- Input Validation: `< 2 ms` (linear safe regex, non-backtracking)
- Database Transaction Execution: `< 50 ms`
- Parallel Revalidation: Asynchronous tag and path purge without blocking UI optimistic response
