# Permissions & RBAC Audit (Phase 1)

> **SCOPE**: Audit of Role-Based Access Control (RBAC) in `@reachinternational/permissions`, DAL guards, and PostgreSQL RLS policies.

---

## 1. Role Hierarchy & Operational Scopes

ReachInternational defines 11 distinct user roles with strict operational boundaries:

| Role Name | Scope Description | Accessible Web Routes | Accessible Mobile Screens |
| :--- | :--- | :--- | :--- |
| `super_admin` | Global system control, user management, audit logs | All routes (`/machines`, `/users`, `/operations`, `/audit-logs`) | All screens (`machines`, `users`, `operations`, `profile`) |
| `admin` | Fleet management, user approvals, master data | `/machines`, `/users`, `/operations` | `machines`, `users`, `operations`, `profile` |
| `service_manager` | Account assignments, fleet scheduling | `/machines`, `/users`, `/operations` | `machines`, `users`, `operations`, `profile` |
| `supervisor` | Field supervision, operator daily assignments | `/machines`, `/operations?tab=logs`, `/operations?tab=assignments` | `machines`, `operations`, `profile` |
| `operator` | Daily machine log entry, shift hours, HMR logs | `/operations?tab=entry`, `/operations?tab=history` | `operations` (Log entry & history), `profile` |
| `mechanic` / `service_engineer` | Field breakdown service, FSR reports | `/machines`, `/operations` | `machines`, `operations`, `profile` |
| `hr_manager` | User approvals, staff directory | `/users` | `users`, `profile` |
| `client` | Machine fleet view, service history | Read-only `/machines` | `machines`, `profile` |

---

## 2. RBAC Enforcement Points

1. **Edge Proxy Routing (`apps/web/proxy.ts`)**:
   - Operator Role Routing: Automatically redirects operators landing on `/` or `/machines` directly to `/operations?tab=entry`.
2. **Server-Side DAL Guards (`apps/web/lib/dal.ts`)**:
   - `requireRole(allowedRoles)`: Verifies caller role against allowlist; redirects unauthorized users to `/machines` or throws `Forbidden`.
   - `requirePermission(permission)`: Checks granular permission strings defined in `@reachinternational/permissions`.
3. **Database Row Level Security (PostgreSQL RLS)**:
   - 13 active RLS policies enforce tenant and role isolation directly at the database engine level (e.g. operators can only insert their own meter logs; users cannot alter their own `role` or `status`).

---

## 3. Findings & Performance Evaluation

1. **Zero Database Overhead for Pure Permission Checks**: `@reachinternational/permissions` evaluates user permissions in-memory via pure deterministic functions using the user profile role already retrieved during session verification.
2. **Double Verification (DAL + RLS)**: Authorization is enforced both in the Node.js server action boundary and inside PostgreSQL RLS policies, ensuring full defense-in-depth without redundant round-trips.
