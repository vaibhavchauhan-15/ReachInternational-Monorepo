# Row-Level Security (RLS) Architecture & Optimization Audit (Phase 8)

> **SCOPE**: Comprehensive audit of all 28 Row-Level Security (RLS) policies, helper functions, cross-user isolation boundaries, and query planner interactions across public tables in PostgreSQL.

---

## 1. RLS Architecture & Defense-in-Depth Model

ReachInternational employs a **2-tier defense-in-depth authorization model**:

```text
┌────────────────────────────────────────────────────────┐
│             Layer 1: Application-Level RBAC            │
│  - requireRole() / requirePermission() in DAL          │
│  - roleHasPermission() in Server Actions               │
│  - Prevents unauthorized RPC execution                 │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             Layer 2: PostgreSQL Row-Level Security     │
│  - Enforced directly by PostgreSQL engine              │
│  - auth.uid() identity matching                        │
│  - STABLE helper functions (current_user_role())       │
│  - WITH CHECK constraint guards                        │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             PostgreSQL Table Data Records              │
└────────────────────────────────────────────────────────┘
```

---

## 2. Table-by-Table RLS Policy Audit & Optimization Matrix

### Table: `public.users`

| Policy Name | Command | Target Role | USING Expression | WITH CHECK Expression | Complexity | Decision |
| :--- | :---: | :---: | :--- | :--- | :---: | :---: |
| `users_select_authenticated` | `SELECT` | `authenticated` | `true` | — | O(1) | 🟢 **KEEP** |
| `users_insert_admin` | `INSERT` | `authenticated` | — | `public.current_user_role() IN ('super_admin', 'admin')` | O(1) cached | 🟢 **KEEP** |
| `users_update_admin` | `UPDATE` | `authenticated` | `public.current_user_role() IN ('super_admin', 'admin')` | `public.current_user_role() IN ('super_admin', 'admin')` | O(1) cached | 🟢 **KEEP** |
| `users_update_self` | `UPDATE` | `authenticated` | `id = auth.uid()` | `id = auth.uid()` | Indexed PK | 🟢 **KEEP** |
| `users_delete_admin` | `DELETE` | `authenticated` | `public.current_user_role() IN ('super_admin', 'admin')` | — | O(1) cached | 🟢 **KEEP** |

- **Security Triggers**: Trigger `trg_prevent_self_role_status_mutation` strictly blocks non-admin users from escalating their own `role` or `status` during self-updates.

---

### Table: `public.machines`

| Policy Name | Command | Target Role | USING Expression | WITH CHECK Expression | Complexity | Decision |
| :--- | :---: | :---: | :--- | :--- | :---: | :---: |
| `machines_select_authorized` | `SELECT` | `authenticated` | `true` | — | O(1) | 🟢 **KEEP** |
| `machines_insert_authorized` | `INSERT` | `authenticated` | — | `public.current_user_role() IN ('super_admin', 'admin', 'service_manager', 'store_manager')` | O(1) cached | 🟢 **KEEP** |
| `machines_update_authorized` | `UPDATE` | `authenticated` | `public.current_user_role() IN ('super_admin', 'admin', 'service_manager', 'supervisor', 'operator')` | `public.current_user_role() IN ('super_admin', 'admin', 'service_manager', 'supervisor', 'operator')` | O(1) cached | 🟢 **KEEP** |
| `machines_delete_authorized` | `DELETE` | `authenticated` | `public.current_user_role() IN ('super_admin', 'admin')` | — | O(1) cached | 🟢 **KEEP** |

---

### Table: `public.machine_hour_logs`

| Policy Name | Command | Target Role | USING Expression | WITH CHECK Expression | Complexity | Decision |
| :--- | :---: | :---: | :--- | :--- | :---: | :---: |
| `machine_hour_logs_select` | `SELECT` | `authenticated` | `true` (Operational transparency across supervisors/engineers) | — | O(1) | 🟢 **KEEP** |
| `operators_insert_own_logs` | `INSERT` | `authenticated` | — | `operator_id = auth.uid()` | Indexed FK | 🟢 **KEEP** |
| `users_update_logs` | `UPDATE` | `authenticated` | `operator_id = auth.uid() OR public.current_user_role() IN ('super_admin', 'admin', 'supervisor')` | `operator_id = auth.uid() OR public.current_user_role() IN ('super_admin', 'admin', 'supervisor')` | O(1) cached | 🟢 **OPTIMIZED via Migration 021** |
| `admins_delete_logs` | `DELETE` | `authenticated` | `public.current_user_role() IN ('super_admin', 'admin')` | — | O(1) cached | 🟢 **KEEP** |

---

### Table: `public.clients`

| Policy Name | Command | Target Role | USING Expression | WITH CHECK Expression | Complexity | Decision |
| :--- | :---: | :---: | :--- | :--- | :---: | :---: |
| `clients_select_policy` | `SELECT` | `authenticated` | `deleted_at IS NULL OR public.current_user_role() IN ('super_admin', 'admin')` | — | Indexed | 🟢 **KEEP** |
| `clients_insert_policy` | `INSERT` | `authenticated` | — | `public.current_user_role() IN ('super_admin', 'admin', 'sales_manager', 'sales_executive')` | O(1) cached | 🟢 **KEEP** |
| `clients_update_policy` | `UPDATE` | `authenticated` | `public.current_user_role() IN ('super_admin', 'admin', 'sales_manager', 'sales_executive')` | — | O(1) cached | 🟢 **KEEP** |
| `clients_delete_policy` | `DELETE` | `authenticated` | `public.current_user_role() IN ('super_admin', 'admin')` | — | O(1) cached | 🟢 **KEEP** |

---

### Table: `public.audit_logs`

| Policy Name | Command | Target Role | USING Expression | WITH CHECK Expression | Complexity | Decision |
| :--- | :---: | :---: | :--- | :--- | :---: | :---: |
| `audit_logs_select_admin` | `SELECT` | `authenticated` | `public.current_user_role() IN ('super_admin', 'admin')` | — | O(1) cached | 🟢 **KEEP** |
| `audit_logs_insert_authenticated` | `INSERT` | `authenticated` | — | `true` | O(1) | 🟢 **KEEP** |

- **Append-Only Immutability**: No `UPDATE` or `DELETE` policies exist on `public.audit_logs`. Normal authenticated users cannot modify or erase audit records.

---

## 3. Role & Permission Access Matrix

| Operational Role | `users` (R/W) | `machines` (R/W) | `clients` (R/W) | `machine_hour_logs` (R/W) | `audit_logs` (R/W) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Super Admin / Admin** | ✅ Full / ✅ Full | ✅ Full / ✅ Full | ✅ Full / ✅ Full | ✅ Full / ✅ Full | ✅ Full / ❌ Append-Only |
| **Service Manager** | ✅ Read / ❌ Blocked | ✅ Full / ✅ Full | ✅ Read / ❌ Blocked | ✅ Read / ✅ Edit | ❌ Blocked / ❌ Append-Only |
| **Supervisor** | ✅ Read / ❌ Blocked | ✅ Read / ✅ Edit | ✅ Read / ❌ Blocked | ✅ Read / ✅ Edit | ❌ Blocked / ❌ Append-Only |
| **Operator** | ✅ Read / ❌ Self Only | ✅ Read / ✅ Hour Meter | ✅ Read / ❌ Blocked | ✅ Read / ✅ Own Insert & Edit | ❌ Blocked / ❌ Append-Only |
| **Unauthenticated** | ❌ Blocked / ❌ Blocked | ❌ Blocked / ❌ Blocked | ❌ Blocked / ❌ Blocked | ❌ Blocked / ❌ Blocked | ❌ Blocked / ❌ Blocked |

---

## 4. Key RLS Optimizations Implemented in Migration `021_optimize_rls_functions.sql`

### 1. `STABLE` Role Caching
- **Problem**: `current_user_role()` defaulted to `VOLATILE` in plpgsql, forcing PostgreSQL to re-execute a subquery against `public.users` for every single row scanned during filtered queries.
- **Optimization**: Marked `current_user_role()`, `is_admin()`, and `is_supervisor_or_admin()` as `STABLE`.
- **Result**: Role is computed once per query/transaction, caching the scalar across thousands of rows.

### 2. Explicit `SET search_path = public, pg_temp`
- **Security Hardening**: Hardened all `SECURITY DEFINER` helper functions with explicit search paths to eliminate search path injection vulnerabilities.

---

## 5. Security & Isolation Regression Verification

- [x] **Cross-User Log Isolation**: An operator inserting a machine hour log cannot supply another operator's `operator_id` (enforced by `WITH CHECK (operator_id = auth.uid())`).
- [x] **Self-Privilege Escalation Block**: Regular users cannot alter their own `role` or `status` column via direct update queries (enforced by trigger `trg_prevent_self_role_status_mutation`).
- [x] **Audit Log Immutability**: `audit_logs` contains zero `UPDATE` or `DELETE` RLS policies.
- [x] **Unauthenticated Access**: All tables reject anonymous unauthenticated queries (`TO authenticated`).
