# Authentication & Authorization Architecture

> **AUTHORITATIVE ACCESS CONTROL POLICY — REACHINTERNATIONAL MONOREPO**  
> *This document defines the real identity lifecycle, session handling, canonical 6-role permission model, server-side authorization patterns, and database Row Level Security (RLS) enforcement across Web and Mobile.*

---

## 1. Authentication Architecture (Supabase SSR Auth)

ReachInternational authenticates users strictly via **Supabase Auth** backed by PostgreSQL:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 1. User submits email/password or PKCE token                           │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 2. Web: Supabase Auth SSR sets HttpOnly, Secure, SameSite=Lax cookies  │
 │    Mobile: expo-secure-store encrypts token in iOS Keychain/KeyStore   │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 3. Edge Proxy (proxy.ts) checks token presence and rate limits         │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 4. Server DAL (lib/dal.ts) invokes verifySession():                    │
 │    • Checks cryptographically signed edge header (x-internal-user-sig) │
 │    • Or validates JWT signature directly via supabase.auth.getUser()   │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 5. User row retrieved from public.users with active status check       │
 └────────────────────────────────────────────────────────────────────────┘
```

### Critical Identity Invariants:
1. **User Identity Linking**: User identity is partitioned between `auth.users` (managed by Supabase Auth engine) and `public.users` (application profile and role entity), linked 1:1 via foreign key `id`.
2. **Account Status Enforcement**: `lib/dal.ts` checks `user.status === "active"`. Inactive, suspended, or deactivated accounts are immediately rejected with redirect to `/login`.
3. **No Client-Side Token Forgery**: Relying on `supabase.auth.getSession()` for authorization is strictly forbidden because it reads unverified client-side cache. All server validation MUST use `supabase.auth.getUser()`.

---

## 2. Canonical 6-Role Hierarchy & Permissions

The monorepo defines **strictly 6 canonical user roles** declared in `@reachinternational/permissions/src/roles.ts`:

| Role Code | Role Name | Scope & Authority | Primary Responsibilities |
|---|---|---|---|
| **`super_admin`** | Super Admin | System-Wide Wildcard (`["*"]`) | Complete platform administration, tenant isolation, security policy management, and role assignment. |
| **`admin`** | System Admin | Organization-Wide Management | Fleet management, client accounts, user management, machine assignments, and administrative reports. |
| **`manager`** | Manager | Operations & Business | Machinery CRUD, client contracts, purchase orders, operational review, inventory oversight, and staff assignment. |
| **`supervisor`** | Site Supervisor | Field Site Coordination | On-site machinery monitoring, log approvals, daily operator shift assignments, and site movements. |
| **`hr`** | Human Resources | Personnel & Directory | Employee onboarding, document verification, salary/payroll management, directory, and status changes. |
| **`operator`** | Machine Operator | Daily Machine Operations | Daily Hour Meter Reading (HMR) entry (`/operations`), breakdown complaint reporting, self attendance. |

### Role Hierarchy Helper:
```ts
import { isManagerOrAbove, isSupervisedRole } from "@reachinternational/permissions";

// Returns true for super_admin, admin, and manager:
isManagerOrAbove(user.role);

// Returns true for operator (requires supervisor assignment):
isSupervisedRole(user.role);
```

---

## 3. Server-Side Authorization Enforcement (DAL)

All server-side reads and actions must invoke canonical authorization guards in `apps/web/lib/dal.ts`:

### 1. Role Requirement (`requireRole`)
```ts
// Enforces that the user has an active session and matches one of the specified roles:
await requireRole("admin", "super_admin", "manager");
```
*Note*: `super_admin` automatically passes all role checks.

### 2. Fine-Grained Permission Requirement (`requirePermission`)
```ts
// Enforces granular permission string from PERMISSIONS matrix:
await requirePermission(PERMISSIONS.MACHINE_DELETE);
```

### 3. Any-Permission Requirement (`requireAnyPermission`)
```ts
// Passes if the user holds at least one of the specified permissions:
await requireAnyPermission(PERMISSIONS.MACHINE_VIEW, PERMISSIONS.OPERATOR_VIEW);
```

---

## 4. Resource-Level Authorization & BOLA / IDOR Protection

Possessing a valid user role is necessary but not sufficient. When interacting with individual records, Server Actions and queries MUST enforce resource ownership:

1. **Operator Log Submissions (`app/actions/operators.ts`, `/operations`)**:
   - The server must verify that the operator is actively assigned to the machine:
     ```ts
     const { data: assignment } = await supabase
       .from("machines")
       .select("id")
       .eq("id", machineId)
       .contains("operator_ids", [session.userId])
       .single();
     if (!assignment && user.role === "operator") {
       throw new Error("Unauthorized: You are not assigned to operate this machine.");
     }
     ```
2. **KYC Documents (`app/actions/documents.ts`)**:
   - Only `super_admin`, `admin`, and `hr` may view other employees' uploaded identity files.
   - Standard employees and operators may ONLY access documents where `user_documents.user_id === session.userId`.

---

## 5. Database Row Level Security (RLS) Baseline

All 154+ migrations in `supabase/migrations/` enforce RLS at the database engine level.

### Canonical RLS Pattern (Table: `machines`):
```sql
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

-- Read policy: Authenticated staff can view active fleet
CREATE POLICY "Staff can view machines" ON public.machines
FOR SELECT TO authenticated
USING (
  (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager', 'supervisor', 'hr', 'operator')
);

-- Write policy: Only management tier can create or edit machines
CREATE POLICY "Management can modify machines" ON public.machines
FOR ALL TO authenticated
USING (
  (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
)
WITH CHECK (
  (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
);
```

### Database Function `current_user_role()`:
Helper function defined in database migrations:
```sql
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

---

## 6. Frontend Route Guards vs. Authoritative Security

| Mechanism | Layer | Real Security Function | Usability Function |
|---|---|---|---|
| **`proxy.ts` (Edge Proxy)** | Web Edge | High (Rate limits, token verification, header sanitization) | Redirects unauthenticated traffic to `/login` |
| **`app/(app)/_layout.tsx`** | Mobile Client | Low (Client component routing) | Redirects to `(auth)/login` if no local session |
| **UI Hidden Buttons / Tabs** | Browser / Mobile DOM | Zero (Easily bypassed via curl / Postman) | Declutters interface for operators |
| **`lib/dal.ts` (`requireRole`)** | Server Components | **Authoritative Server Enforcement** | Halts rendering before data access |
| **Server Actions (`app/actions/*`)** | Next.js Server | **Authoritative Mutation Enforcement** | Rejects unauthorized payload execution |
| **PostgreSQL RLS Policies** | Database Engine | **Authoritative Persistence Enforcement** | Protects data even if server code has a flaw |

**Mandate**: Never rely on frontend route guards or hidden buttons to secure an action. Every mutation MUST be protected by Server Actions and PostgreSQL RLS.

---

## 7. Machines Module Capability Matrix (canonical)

Machine authorization is declared exactly once in `@reachinternational/permissions`
(`packages/permissions/src/machines.ts`) and consumed by every layer. Never compare role strings
locally in a Machine module component, Server Action, API route or RPC comment.

| Layer | Enforcement |
|---|---|
| `ROLE_PERMISSIONS` / `MACHINE_ROLE_CAPABILITIES` | Role → capability map. `super_admin` inherits every machine capability; `hr`, `sales`, `marketing` inherit none |
| Route | `canAccessMachinesRoute(role)` → redirect to the role home route (`/machines` deep links included) |
| Data layer | `hasMachineCapability(role, FLEET_VIEW)` gates the fleet list, KPI RPC and filter-option queries. Operators read `get_operator_assigned_machines()` (slim server projection) and never fetch fleet aggregate, rental-rate or audit data |
| Server Actions / API | `requireMachineCapability(...)` + `requireMachineRecordAccess(...)` → `403` (`MACHINE_FORBIDDEN`); routes use `requireMachinesPageAccess()` |
| Database | RLS on `public.machines`, update triggers (`enforce_supervisor_machine_update_restrictions`, `enforce_machine_supervisor_change_role`) and `SECURITY DEFINER` functions raising SQLSTATE `42501` (`get_machines_directory_summary`, `get_operator_assigned_machines`). Migration 233 makes the supervisor SELECT/UPDATE predicate set-based (manager rows skip the helper) |

Confirmed matrix decisions (all five layers): supervisor fleet/KPI/search are **supervised scope only** (client allocation OR direct supervisor assignment, migration 234);
supervisor may update HMR/health/rental status, client assignment, operators and shifts, view the audit
tab and export within scope; supervisor may **not** create/delete machines, edit master specs, assign
supervisors or read commercial rental rates. Operators get the assigned-machine view only.

Regression coverage: `apps/mobile/test/test-machines-rbac.mjs` (live Dev RLS/RPC negative tests per role),
`apps/web/scripts/test-machines-web-rbac.mjs` (82 static guards over actions/routes/UI/migrations), and
`packages/permissions/src/machines.test.ts` (36 capability-matrix tests).
