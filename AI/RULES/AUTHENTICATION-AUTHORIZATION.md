# ReachInternational Production Authentication & Authorization Rules

> **AUTHORITATIVE AUTHENTICATION & AUTHORIZATION POLICY FOR AI AGENTS**  
> *This document establishes the binding identity, authentication, session, authorization, RBAC, permission, multi-tenancy, and resource-access engineering policy for all applications (`apps/web`, `apps/mobile`), shared packages (`packages/*`), data access layers (`lib/dal.ts`), server actions, database queries, and storage systems within the ReachInternational monorepo. Every AI coding agent MUST read, obey, and enforce these rules before writing or modifying any identity or access control code in this repository.*

---

## 1. Purpose

The purpose of ReachInternational's Authentication & Authorization policy is to guarantee that **every request, user session, page navigation, API invocation, Server Action mutation, and database query** is authoritatively evaluated against trusted identity, role, scope, and resource boundaries before granting access or performing state changes.

Every feature implemented by an AI coding agent MUST answer:
```text
1. WHO is the user? (Authentication & Identity)
2. IS the user's session valid? (Session Management)
3. WHAT role and permissions does the user hold? (RBAC & Permissions)
4. WHAT organization/branch scope applies? (Multi-Tenancy & Scoping)
5. WHAT resource is being accessed? (Resource-Level Authorization / BOLA)
6. WHAT action is requested? (Operation Authorization)
7. IS THAT ACTION AUTHORIZED? (Trusted Server Enforcement)
```

---

## 2. Source of Truth

ReachInternational establishes strict canonical sources of truth for all security decisions:
1. **User Identity & Auth**: Supabase SSR Auth (`auth.users`) validated server-side via `verifySession()` in `apps/web/lib/dal.ts`.
2. **User Profile & Account Status**: `public.users` table joined with `public.branches` and cached via `getCachedUserRow()`.
3. **Role & Permission Definitions**: Shared package `@reachinternational/permissions` (`roles.ts`, `permissions.ts`, `matrix.ts`).
4. **Data Access & Permission Helpers**: Data Access Layer (`apps/web/lib/dal.ts`) exposing `requirePermission()`, `getUserBranchIds()`, and `getCurrentUser()`.
5. **Database Authorization**: PostgreSQL Row Level Security (RLS) policies across 35 migrations.

---

## 3. Authentication Provider (Supabase Auth SSR)

Authentication is managed strictly via **Supabase SSR Auth** (`@supabase/ssr`).
* **Server Client**: Created via `createSupabaseServerClient()` in `apps/web/lib/supabase/server.ts`.
* **Prohibition of Custom Auth**: AI agents MUST NOT introduce secondary authentication schemes, custom password hashing, custom JWT signers, or alternative auth providers.

---

## 4. Identity Architecture

User identity spans two linked entities:
* `auth.users`: Managed by Supabase Auth engine storing primary email, encrypted password credentials, and authentication metadata.
* `public.users`: Application user entity storing role, branch assignment (`branch_id`), organization (`organization_id`), full name, employee code, and account status (`is_active`).

---

## 5. User / Profile Relationship

The relationship between `auth.users` and `public.users` is a strict **1:1 foreign key relation** linked by `id`:
```sql
-- Database Schema Foreign Key Linking
ALTER TABLE public.users 
ADD CONSTRAINT fk_users_auth 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
```
AI agents MUST query user application context through `public.users` using `verifySession()` and `getCachedUserRow(userId)` from `lib/dal.ts`.

---

## 6. Session Architecture

1. **HttpOnly Cookie Tokens**: Session tokens are stored in HttpOnly, Secure, SameSite=Lax cookies managed automatically by `@supabase/ssr` middleware.
2. **Server-Side Token Verification**: `verifySession()` in `lib/dal.ts` invokes `supabase.auth.getUser()` to validate JWT signatures against Supabase Auth servers on every request.
3. **No Web Storage Tokens**: Authentication tokens MUST NEVER be stored in `localStorage` or `sessionStorage`.

---

## 7. Authentication States

AI agents MUST handle five explicit authentication lifecycle states:

```text
AUTHENTICATION STATE    DESCRIPTION / HANDLING
──────────────────────────────────────────────────────────────────────────────────────────
• Unauthenticated       No session cookie present; redirect to /login
• Authenticating        Session cookie undergoing server verification in verifySession()
• Authenticated         Valid session & user profile loaded; access granted
• Session Expired       JWT token expired/revoked; redirect to /login with toast notice
• Signed Out            Session destroyed via logout; redirect to /login
```

---

## 8. Authentication Routes

The monorepo defines distinct public and protected route domains:
* **Public Auth Routes**: `/login`, `/signup`, `/reset-password`, `/auth/callback`.
* **Protected Routes**: `/dashboard`, `/my-work`, `/tasks`, `/machines`, `/service`, `/operations`, `/rentals`, `/crm`, `/finance`, `/hr`, `/inventory`, `/users`, `/branches`, `/audit-logs`, `/settings`.

---

## 9. Route Protection Architecture

Route protection is enforced at the edge before page component execution:
1. **Edge Auth Proxy (`proxy.ts`)**: Inspects incoming session cookies (<20ms) and immediately redirects unauthenticated requests attempting to access protected routes to `/login`.
2. **RSC Layout Verification**: Protected server layouts (`app/(app)/layout.tsx`) invoke `verifySession()` to ensure session validity before rendering page subtrees.

---

## 10. Authorization Architecture (3-Layer Model)

Authorization is enforced across three mandatory verification layers:

```text
Layer 1: Edge Proxy (proxy.ts)               → Validates session presence on protected routes
Layer 2: Server Data Access Layer (dal.ts)   → Executes requirePermission() & getUserBranchIds()
Layer 3: Supabase PostgreSQL Database (RLS) → Evaluates auth.uid() against table-level RLS policies
```

---

## 11. Role Model (`@reachinternational/permissions`)

ReachInternational defines 13 canonical enterprise roles in `@reachinternational/permissions`:

```text
ROLE CODE            ROLE DISPLAY NAME    CATEGORY / HIERARCHY TIER
──────────────────────────────────────────────────────────────────────────────────────────
• super_admin        Super Admin          Admin (Full multi-tenant control)
• admin / company_admin System Admin      Admin (Organization-wide management)
• branch_manager     Branch Manager       Management (Branch operations & approvals)
• service_manager    Service Manager      Management (Service & breakdown oversight)
• store_manager      Store Manager        Management (Inventory & PO approvals)
• hr_manager         HR Manager           Management (Staff & payroll management)
• finance_manager    Finance Manager      Finance (Ledgers, billing, 3-way PO match)
• rental_manager     Rental Manager       Operations (Fleet agreements & damage routing)
• sales_executive    Sales Executive      Sales (CRM leads, pipeline & quotations)
• service_engineer   Service Engineer     Field (Breakdown repairs & digital FSRs)
• mechanic           Mechanic             Field (Equipment maintenance & repairs)
• supervisor         Supervisor           Field (Site movements & operator logs)
• operator / client  Operator / Client    Field/Client (Daily meter logs / owned fleet)
```

---

## 12. Permission Model

Permissions are defined as discrete string constants inside `packages/permissions/src/permissions.ts`:
* Machine Permissions: `MACHINES_READ`, `MACHINES_WRITE`, `MACHINES_DELETE`, `MACHINES_EXPORT`.
* Service Permissions: `SERVICE_COMPLAINTS_CREATE`, `SERVICE_FSR_CREATE`, `SERVICE_FSR_APPROVE`.
* Financial Permissions: `FINANCE_PO_CREATE`, `FINANCE_PO_APPROVE`, `FINANCE_LEDGER_READ`.
* Rental Permissions: `RENTAL_AGREEMENT_CREATE`, `RENTAL_DISCOUNT_APPROVE`.
* HR & User Permissions: `HR_STAFF_MANAGE`, `HR_PAYROLL_REVISE`, `USERS_MANAGE`.

---

## 13. Permission Naming Standard

Permissions MUST follow the uppercase `DOMAIN_ACTION` naming convention. Arbitrary string permission names (e.g. `edit-machine`, `can_update_fsr`) are FORBIDDEN.

---

## 14. Role-Based Access Control (RBAC Matrix)

The RBAC matrix in `@reachinternational/permissions` maps each role to its authorized permission set.

```ts
import { roleHasPermission, PERMISSIONS } from "@reachinternational/permissions";

// Check authorization in Server Actions or DAL functions
if (!roleHasPermission(user.role, PERMISSIONS.FINANCE_PO_APPROVE)) {
  throw new Error("Unauthorized: Insufficient permissions to approve Purchase Order");
}
```

---

## 15. Resource-Level Authorization & BOLA/IDOR Protection

Possessing a valid URL or record ID (e.g. `/machines/mch_9921`) DOES NOT grant authorization.
1. **Resource Ownership & Scope Validation**: Server Actions and DAL query functions MUST verify that the requested resource belongs to the user's organization (`organization_id`) and authorized branch set (`getUserBranchIds()`).
2. **BOLA Prevention**: Directly querying records by ID without checking `organization_id` or `branch_id` is **STRICTLY FORBIDDEN**.

---

## 16. Organization Scope (Multi-Tenancy)

All data tables (`machines`, `service_logs`, `purchase_orders`, `users`) MUST contain an `organization_id` column. Multi-tenant isolation is enforced at the database level via PostgreSQL RLS policies matching `organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())`.

---

## 17. Branch Scope (`getUserBranchIds`)

1. **Branch-Scoped Filtering**: Users with branch-restricted roles (`branch_manager`, `service_manager`, `field_engineer`, `mechanic`, `operator`) can only access data belonging to their assigned branches.
2. **`getUserBranchIds()` Helper**: `getUserBranchIds(user)` in `lib/dal.ts` resolves the user's primary `branch_id` and additional branch assignments from `user_branches`.

---

## 18. Ownership Scope

For field engineers, operators, and clients, authorization rules verify ownership:
* `created_by === user.id` (Log creator)
* `assigned_to === user.id` (Assigned breakdown complaint / task)
* `client_id === user.client_id` (Client-owned machine)

---

## 19. Database Authorization Architecture

Database operations execute under PostgreSQL Row Level Security. Even if application code attempts an unauthorized query, the database engine drops non-compliant rows automatically.

---

## 20. Row Level Security (RLS) Policies

RLS policies are enforced across all 35 SQL migrations. AI agents MUST observe:

```sql
-- RLS Policy Example for Service Complaints
CREATE POLICY "Branch-scoped complaints access" ON public.service_complaints
FOR SELECT TO authenticated
USING (
  organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  AND (
    branch_id IN (SELECT branch_id FROM user_branches WHERE user_id = auth.uid())
    OR assigned_engineer_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('super_admin', 'admin')
  )
);
```

---

## 21. Service-Role Access Restrictions

1. **Server-Only Restriction**: `SUPABASE_SERVICE_ROLE_KEY` (`createSupabaseAdminClient()`) bypasses RLS policies and MUST ONLY be used inside trusted server-only DAL modules (`lib/dal.ts`).
2. **Prohibition in Client Components**: Importing service-role clients inside Client Components (`'use client'`) is **STRICTLY FORBIDDEN**.

---

## 22. API Authorization Standards

1. **Session Check**: API routes in `apps/web/app/api/` MUST invoke `verifySession()`.
2. **Permission Gate**: Protected API routes MUST verify specific permissions (`requirePermission()`) before parsing request bodies or querying database tables.

---

## 23. Server Action Execution Template

Every Server Action mutation in `apps/web/app/actions/` MUST adhere to this strict 5-step execution flow:

```ts
export async function executeProtectedAction(inputData: unknown) {
  // Step 1: Verify Session Authentication
  const session = await verifySession();

  // Step 2: Resolve User Profile & Verify Permission
  const user = await getCurrentUser(session.userId);
  if (!roleHasPermission(user.role, PERMISSIONS.MACHINES_DELETE)) {
    return { success: false, error: "Unauthorized: Insufficient permissions" };
  }

  // Step 3: Validate Input Payload against Zod Schema
  const parsed = deleteMachineSchema.parse(inputData);

  // Step 4: Execute Database Mutation within RLS bounds
  const result = await deleteMachine(parsed.id, user);

  // Step 5: Write Audit Log to public.audit_logs
  await logAuditEvent({ action: "DELETE_MACHINE", userId: user.id, targetId: parsed.id });

  return { success: true, data: result };
}
```

---

## 24. Client-Side Authorization Boundaries

1. **UX Toggling Only**: Conditionally hiding an `Edit` or `Delete` button based on `roleHasPermission()` is a user experience enhancement, NOT a security control.
2. **Server-Side Enforcement**: Server Actions and API endpoints MUST independently execute full authentication and permission checks.

---

## 25. Forms & Mutations Security

Form submissions MUST NOT pass role or authorization flags in form payloads (e.g. `<input type="hidden" name="userRole" value="admin" />`). User roles MUST be resolved on the server from the verified session context.

---

## 26. Search & Filter Authorization

1. **Scope Preservation**: Search and filter toolbar inputs MUST execute within the user's authorized branch and organization scope.
2. **No Data Leakage**: Search queries MUST NOT return records outside the user's authorized branch scope.

---

## 27. Pagination Authorization

Every page slice in a paginated dataset (`PAGE 1`, `PAGE 2`) MUST enforce identical authorization and branch scoping.

---

## 28. Export Authorization

1. **Permission Gating**: Exporting CSV directories or generating A4 PDF reports requires explicit export permissions (`MACHINES_EXPORT`, `FINANCE_REPORTS_READ`).
2. **Row-Level Filtering**: Export files MUST exclude unauthorized records and scrub sensitive internal credentials.

---

## 29. Storage Access Control

1. **Public Storage**: Machine catalog photos and public images use public storage buckets.
2. **Private Storage**: HR records, financial invoices, payroll receipts, and agreements MUST use private buckets requiring time-limited signed URLs (`createSignedUrl(path, 60)`).

---

## 30. Administrative Access

1. **`super_admin`**: Full multi-tenant system oversight across all organizations and modules.
2. **`admin` / `company_admin`**: Organization-wide administrative access bound to `organization_id`.

---

## 31. Privilege Escalation Prevention

Users MUST NOT be permitted to modify their own `role`, `permissions`, `branch_id`, or `organization_id`. Role and branch modifications MUST be restricted to `super_admin` or `company_admin` roles inside dedicated administrative Server Actions (`app/actions/users.ts`).

---

## 32. Business Logic Approval Thresholds

ReachInternational enforces strict financial and operational approval thresholds:
* **Purchase Orders > ₹10,000**: Requires approval by Store Manager, Branch Manager, or Finance Manager (`FINANCE_PO_APPROVE`).
* **Expenses > ₹50,000**: Requires approval by Company Admin or Super Admin (`FINANCE_EXPENSE_APPROVE`).
* **Rental Agreement Discounts > 15%**: Requires approval by Rental Manager (`RENTAL_DISCOUNT_APPROVE`).

---

## 33. State Transition Matrix

Status transitions MUST be gated by role:
* **Breakdown Complaint**: `Reported` → `Assigned` (Service Manager) → `In Repair` (Service Engineer) → `Resolved & Approved` (Service Manager).
* **Purchase Order**: `Draft` → `Submitted` (Store Manager) → `Approved` (Finance Manager) → `Fulfilled` (Store Manager).

---

## 34. Sensitive Operations

The following elevated operations MUST log structured audit entries via `logAuditEvent()` in `lib/audit.ts`:
* User creation, role change, or branch re-assignment.
* Machine creation, spec modification, or record deletion.
* Breakdown complaint resolution and FSR sign-off.
* Purchase order approval or rejection.
* Financial ledger adjustments or expense approvals.

---

## 35. Authentication UX Standards

1. **Clear Error Messages**: Login failures display generic, secure error notices ("Invalid email or password") to prevent username enumeration attacks.
2. **Session Expiry Toasts**: Session expiry triggers an explicit toast notification (`toast.error("Session expired. Please log in again.")`).

---

## 36. Password & Reset Security

Password resets MUST execute via Supabase Auth's official reset flows (`supabase.auth.resetPasswordForEmail()`) sending secure, time-limited reset tokens directly to user emails.

---

## 37. Account Status Verification (`is_active`)

The user profile row in `public.users` includes an `is_active` boolean column. `getCachedUserRow()` verifies `is_active === true`. Disabled accounts (`is_active === false`) MUST be blocked from logging in or executing actions.

---

## 38. Role & Permission Updates

When a user's role or branch assignment is updated, the administrative Server Action MUST invalidate cached profile data via `revalidateTag(CACHE_TAGS.users)` to force immediate profile re-fetching.

---

## 39. Multi-Tenant Data Isolation

Multi-tenant boundary checks (`organization_id = user.organization_id`) MUST be applied to every database table and query without exception.

---

## 40. Canonical Authorization Helpers

AI agents MUST reuse canonical helpers from `apps/web/lib/dal.ts` and `@reachinternational/permissions`:
* `verifySession()` — Validates session cookie and returns user auth identity.
* `getCurrentUser(userId)` — Resolves user profile row, branch, and role context.
* `requirePermission(user, permission)` — Throws an error if user role lacks permission.
* `getUserBranchIds(user)` — Resolves array of authorized branch IDs.
* `roleHasPermission(role, permission)` — Evaluates boolean permission eligibility.

---

## 41. Testing & Verification

1. **Compilation Check**: `pnpm typecheck` across all 9 monorepo workspace packages.
2. **Permission Matrix Tests**: Unit tests in `packages/permissions` verifying role permission coverage.

---

## 42. Authorization Test Matrix

When testing protected features, AI agents MUST verify:
```text
• Scenario A: Unauthenticated request → Redirect to /login
• Scenario B: Authenticated + Authorized role → Action succeeds
• Scenario C: Authenticated + Unauthorized role → HTTP 403 / Error returned
• Scenario D: Authenticated + Wrong Branch scope → Records filtered out (0 rows returned)
• Scenario E: Disabled Account (is_active = false) → Access blocked
```

---

## 43. Regression Protection Policy

Before modifying `lib/dal.ts`, `@reachinternational/permissions`, or Supabase RLS migrations:
1. Audit downstream impact across all 26 domain modules.
2. Verify zero permission leakage vectors exist.
3. Verify zero compilation errors across all workspace packages (`pnpm typecheck`).

---

## 44. Authentication & Authorization Performance

1. **Edge Auth Checks**: Edge Auth Proxy (`proxy.ts`) evaluates session cookies in <20ms.
2. **Request Deduplication**: `verifySession()` is wrapped in React `cache()`.
3. **Profile Caching**: User profile lookup uses `unstable_cache()` tagged with `CACHE_TAGS.users`.

---

## 45. Security Audit Logging (`lib/audit.ts`)

Elevated mutations MUST log structured security entries:
```ts
import { logAuditEvent } from "@/lib/audit";

await logAuditEvent({
  action: "UPDATE_USER_ROLE",
  userId: adminUser.id,
  targetId: targetUserId,
  details: { oldRole: "engineer", newRole: "service_manager" },
});
```

---

## 46. Forbidden Auth Anti-Patterns (NEVER INTRODUCE)

AI agents MUST NEVER introduce any of the following authentication/authorization anti-patterns:
* ❌ **Client-Side Role Trust**: Authorizing actions based on `localStorage.role` or client state.
* ❌ **Form Payload Role Passing**: Accepting `<input type="hidden" name="role" />` from form inputs.
* ❌ **Bypassing RLS**: Disabling Row Level Security or using service-role clients in Client Components.
* ❌ **Un-Validated Server Actions**: Executing Server Actions without session verification and Zod schema parsing.
* ❌ **Scattered Custom Auth**: Writing custom JWT verification routines outside `lib/dal.ts`.
* ❌ **BOLA Vulnerabilities**: Querying database records by ID without checking branch/organization scope.

---

## 47. Change Policy

Before executing any identity, authentication, or authorization change:
1. Identify affected security boundaries and permission matrices.
2. Formulate the smallest correct code change.
3. Verify zero security, performance, or visual regressions are introduced.

---

## 48. AI Agent Pre-Implementation Checklist

Before writing code, every AI agent MUST complete this mental checklist:

* [ ] Is authentication verified on the server via `verifySession()`?
* [ ] Is authorization verified using canonical `roleHasPermission()` or `requirePermission()`?
* [ ] Are database queries scoped by `getUserBranchIds()` and `organization_id`?
* [ ] Are inputs validated against Zod schemas from `@reachinternational/validation`?
* [ ] Are administrative role modifications restricted to `super_admin` / `company_admin`?
* [ ] Is an audit log entry written to `public.audit_logs` for elevated mutations?

---

## 49. AI Agent Post-Implementation Authentication & Authorization Audit

After completing code modifications, every AI agent MUST perform the following verification protocol:

1. **Compilation Audit**: Run `pnpm typecheck` across all 9 monorepo workspace packages.
2. **Security & RLS Audit**: Confirm authorization checks and RLS policies remain 100% active.
3. **Design & Responsive Audit**: Confirm visual compliance with `DESIGN.md` across Mobile, Tablet, and Desktop.
4. **Memory Synchronization**: Update `AI/STATE.md`, `AI/CURRENT_TASK.md`, `AI/CHANGELOG_AI.md`, and `README.md`.

---
