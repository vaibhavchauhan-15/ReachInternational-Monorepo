# Server Actions Baseline (Phase 0)

> **MUTATION PIPELINE SPECIFICATION**  
> Every mutating Server Action adheres to the canonical execution lifecycle:  
> `Action Entry` ──► `Authentication (verifySession)` ──► `Authorization (requireRole/Permission)` ──► `Validation (Zod Schema)` ──► `Database Mutation (PostgreSQL / RLS)` ──► `Security Audit Logging (logAudit)` ──► `Idempotency Completion` ──► `Tag Revalidation (revalidateTag)`.

---

## 1. Core Active Server Action Inventory

### 1.1 Machine Management Actions (`apps/web/app/actions/machines.ts`)

| Action Name | Target Entity | Authorization Required | Zod Validation Schema | DB Operation | Cache Revalidation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `createMachine` | `public.machines` | `machines:create` | `CreateMachineSchema` | `INSERT INTO machines` | `revalidateTag("machines")` |
| `updateMachine` | `public.machines` | `machines:update` | `UpdateMachineSchema` | `UPDATE machines` | `revalidateTag("machines")` |
| `deleteMachine` | `public.machines` | `machines:delete` | `UuidIdSchema` | `DELETE FROM machines` | `revalidateTag("machines")` |
| `reassignMachineSupervisor` | `public.machines` | `machines:update` | `UuidIdSchema` | `UPDATE machines` | `revalidateTag("machines")` |

### 1.2 User Management Actions (`apps/web/app/actions/users.ts`)

| Action Name | Target Entity | Authorization Required | Zod Validation Schema | DB Operation | Cache Revalidation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `createUser` | `public.users` & Auth | `users:create` | `CreateUserSchema` | `auth.admin.createUser` | `revalidateTag("users")` |
| `approveUser` | `public.users` | `users:approve` | `UuidIdSchema` | `UPDATE users SET status='active'` | `revalidateTag("users")` |
| `rejectUser` | `public.users` | `users:approve` | `UuidIdSchema` | `UPDATE users SET status='rejected'` | `revalidateTag("users")` |
| `toggleUserStatus` | `public.users` | `users:edit` | `UuidIdSchema` | `UPDATE users SET status=...` | `revalidateTag("users")` |
| `updateUserRole` | `public.users` | `users:edit` | `UuidIdSchema` | `UPDATE users SET role=...` | `revalidateTag("users")` |
| `deleteUser` | `public.users` | `users:delete` | `UuidIdSchema` | `DELETE FROM users` | `revalidateTag("users")` |
| `editUser` | `public.users` | `users:edit` | `UpdateUserSchema` | `UPDATE users` | `revalidateTag("users")` |
| `resetUserPassword` | `auth.users` | `users:edit` | `UuidIdSchema` | `auth.admin.updateUserById` | `revalidateTag("users")` |

### 1.3 Operations & Daily Log Actions (`apps/web/app/actions/operators.ts`)

| Action Name | Target Entity | Authorization Required | Zod Validation Schema | DB Operation | Cache Revalidation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `submitOperatorHourLogAction` | `public.machine_hour_logs` | Authenticated Operator | `CreateHourLogSchema` | `INSERT INTO machine_hour_logs` + Update machine meter | `revalidateTag("machine_hour_logs")` |
| `updateOperatorHourLogAction` | `public.machine_hour_logs` | Authenticated Operator | `UpdateHourLogSchema` | `UPDATE machine_hour_logs` | `revalidateTag("machine_hour_logs")` |
| `assignOperatorToMachineAction` | `public.machines` | Supervisor / Admin | `UuidIdSchema` | `UPDATE machines SET current_operator_id=...` | `revalidateTag("machines")` |
| `unassignOperatorFromMachineAction` | `public.machines` | Supervisor / Admin | `UuidIdSchema` | `UPDATE machines SET current_operator_id=NULL` | `revalidateTag("machines")` |

### 1.4 Client Management Actions (`apps/web/app/actions/clients.ts`)

| Action Name | Target Entity | Authorization Required | Zod Validation Schema | DB Operation | Cache Revalidation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `createClientAction` | `public.clients` | `clients:create` | `CreateClientSchema` | `INSERT INTO clients` | `revalidateTag("clients")` |
| `updateClientAction` | `public.clients` | `clients:update` | `UpdateClientSchema` | `UPDATE clients` | `revalidateTag("clients")` |
| `softDeleteClientAction` | `public.clients` | `clients:delete` | `UuidIdSchema` | `UPDATE clients SET deleted_at=NOW()` | `revalidateTag("clients")` |

### 1.5 Authentication Actions (`apps/web/app/actions/auth.ts`)

| Action Name | Target Entity | Access Level | Validation Schema | Operation |
| :--- | :--- | :--- | :--- | :--- |
| `login` | `auth.users` | Public | `LoginSchema` | `supabase.auth.signInWithPassword` |
| `signup` | `auth.users` & Trigger | Public | `SignupSchema` | `supabase.auth.signUp` |
| `logout` | Session | Authenticated | None | `supabase.auth.signOut` |
| `forgotPassword` | `auth.users` | Public | `ForgotPasswordSchema` | `supabase.auth.resetPasswordForEmail` |

---

## 2. Server Action Performance Targets (Phase 4/10)

- **Total Mutation Round-Trip**: Target `< 300 ms` for normal CRUD actions.
- **Heavy Multi-Step Mutations** (e.g. `submitOperatorHourLogAction` with idempotency, audit log, machine hour-meter sync): Target `< 450 ms`.
- **Payload DTO Size**: Response payloads strictly bounded (`{ success: true, id: string }`). Full entity serialization over the wire is avoided.
