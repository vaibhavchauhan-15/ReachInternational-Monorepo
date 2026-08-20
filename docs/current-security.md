# ReachInternational — Current Security & RBAC Audit

> **Phase 0 Deliverable**  
> **Last Updated:** 2026-08-19  
> **Status:** Verified & Baseline Established  

---

## 1. Executive Summary & Defense-in-Depth Model

Security in ReachInternational is built on a **defense-in-depth model** with four distinct layers:

1. **Authentication Boundary**: Supabase SSR Auth with secure HTTP-only cookies (`lib/supabase/server.ts`).
2. **Database Authorization Boundary**: Supabase Row Level Security (RLS) enforced directly in PostgreSQL across 38+ tables using `auth.uid()`, `public.profiles`, and tenant scoping policies.
3. **Application Server Authorization Boundary**: Server Actions in `app/actions/*.ts` verify user sessions via `verifySession()`, validate inputs with `zod`, and check explicit role permissions (`checkPermission()`).
4. **Audit Boundary**: Centralized mutation logging in `public.audit_logs` tracking user ID, IP, user agent, action target, and payload diffs (`lib/audit-helpers.ts`).

---

## 2. Comprehensive RBAC Role Matrix (13 Operational System Roles + Client)

The application enforces **13 distinct operational roles** plus Client access, defined canonical in `lib/auth/rbac.ts`:

| Role Key | Display Name | Core Purpose | Access Scope |
| :--- | :--- | :--- | :--- |
| `super_admin` | Super Admin | Full system control, branch setup, global security | `ORGANIZATION` |
| `admin` | Organization Admin | System configuration, user administration, global master specs | `ORGANIZATION` |
| `branch_manager` | Branch Manager | Oversees branch operations, employees, inventory, and finances | `BRANCH` |
| `service_manager` | Service Manager | Manages field service schedules, breakdown complaints, FSR approvals | `BRANCH` |
| `service_engineer` | Field Service Engineer | Field service execution, breakdown resolution, digital FSR reporting | `ASSIGNED` |
| `supervisor` | Heavy Equipment Supervisor | Meter hour logs, operator assignments, site movement dispatch | `BRANCH` |
| `mechanic` | Maintenance Mechanic | Workshop machine maintenance, breakdown repair logs | `ASSIGNED` |
| `operator` | Equipment Operator | Daily shift running hour logs, machine assignment status | `ASSIGNED` |
| `store_manager` | Warehouse & Store Manager | Inventory stock control, part issues, PO creation, GRNs | `BRANCH` |
| `hr_manager` | HR Manager | Employee directory, onboarding, operator rosters & payroll payouts | `BRANCH` |
| `rental_manager` | Rental Manager | Customer directory, rental contracts, dispatches, return inspections | `BRANCH` |
| `sales_executive` | Sales Executive | CRM leads, quotes, deals, sales pipeline | `ORGANIZATION` |
| `finance_manager` | Finance Manager | Invoicing, payments, credit/debit notes, 3-way match, expenses | `ORGANIZATION` |
| `client` | External Client | View owned/rented equipment status, submit breakdown requests | `ASSIGNED` |

---

## 3. Scoping System (`lib/auth/scope.ts`)

Every user role belongs to one of three security scopes:

```text
ORGANIZATION Scope (Super Admin, Admin, Sales, Finance)
       │
       └── BRANCH Scope (Branch Manager, Service Manager, Supervisor, Store, HR, Rental)
              │
              └── ASSIGNED Scope (Service Engineer, Mechanic, Operator, Client)
```

- **`ORGANIZATION`**: User can access data across all branches within the enterprise.
- **`BRANCH`**: User can only access data belonging to their assigned `branch_id` (e.g. Delhi Branch `DEL-HQ`).
- **`ASSIGNED`**: User can strictly access items explicitly assigned to them (e.g. `engineer_id = auth.uid()` or `current_operator_id = auth.uid()`).

---

## 4. Row Level Security (RLS) Policy Baseline

Database level RLS is enabled on **all 38+ system tables**. RLS policies enforce access control even if a client bypasses application code.

### Policy Examples (`supabase/migrations/`)

#### 4.1 Machines Table (`031_fix_machines_rls_scoping.sql`)
```sql
CREATE POLICY "machines_select_policy" ON public.machines
FOR SELECT USING (
  -- Super Admin / Admin / Sales / Finance have global organization access
  public.get_user_role(auth.uid()) IN ('super_admin', 'admin', 'sales_executive', 'finance_manager')
  OR
  -- Branch staff access machines in their assigned branch
  (public.get_user_role(auth.uid()) IN ('branch_manager', 'service_manager', 'supervisor', 'store_manager', 'hr_manager', 'rental_manager')
   AND branch_id = public.get_user_branch(auth.uid()))
  OR
  -- Field staff & operators access assigned machines
  (public.get_user_role(auth.uid()) IN ('service_engineer', 'mechanic', 'operator')
   AND (assigned_engineer_id = auth.uid() OR current_operator_id = auth.uid()))
  OR
  -- Client accesses owned machines
  (public.get_user_role(auth.uid()) = 'client' AND customer_id = public.get_user_customer_id(auth.uid()))
);
```

#### 4.2 Breakdown Complaints Table (`011_enterprise_rbac_branches_inventory.sql`)
- `SELECT`: Allowed for Branch managers, assigned engineers, creating user, or organization admins.
- `INSERT`: Allowed for roles with `"complaint.create"` permission (`client`, `supervisor`, `service_engineer`, `service_manager`, `admin`).
- `UPDATE`: Restricted to `service_manager`, `branch_manager`, `admin`, and assigned `service_engineer` (for status updates).

---

## 5. Audit Logging Architecture (`lib/audit-helpers.ts`)

Every database mutation logs an entry into `public.audit_logs` containing:
- `user_id`: UUID of the authenticated actor.
- `role`: Role at time of action.
- `action`: E.g. `CREATE_INVOICE`, `ASSIGN_OPERATOR`, `DISPATCH_RENTAL_MACHINE`, `RECORD_PAYMENT`.
- `target_table`: Name of table affected.
- `target_id`: ID of affected row.
- `old_data`: JSON snapshot before mutation.
- `new_data`: JSON snapshot after mutation.
- `created_at`: Timestamp.

Audit logs are append-only. No user role (except Super Admin database superuser via direct SQL migration) has permission to `DELETE` or `UPDATE` audit logs.
