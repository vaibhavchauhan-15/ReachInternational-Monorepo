# Database Calls Audit (Phase 1)

> **SCOPE**: Audit of all 682 database operations across `apps/web`, `apps/mobile`, and `packages`.

---

## 1. Table Access Distribution

| Database Table | Access Frequency (Files) | Primary Operations | Selected Projections | Index Support | Priority / Risk |
| :--- | :---: | :--- | :--- | :--- | :---: |
| `public.machines` | 53 call sites | `select`, `insert`, `update`, `delete` | Mixed (4 `select("*")` calls in DAL/Page) | 9 B-tree indexes | 🟠 P1 |
| `public.users` | 53 call sites | `select`, `update`, `insert` | Mixed (7 `select("*")` in `users.ts`) | 10 B-tree indexes | 🟠 P1 |
| `public.idempotency_keys` | 30 call sites | `select`, `insert`, `update` | Explicit (`idempotency_key, status, ...`) | 4 B-tree indexes | 🟢 P3 |
| `public.machine_hour_logs` | 11 call sites | `select`, `insert`, `update` | Multi-table joins (machines, clients, users) | 9 B-tree indexes | 🔴 P0 (Direct page queries) |
| `public.clients` | 5 call sites | `select`, `insert`, `update` | Explicit projections | 6 B-tree indexes | 🟢 P3 |
| `public.audit_logs` | 5 call sites | `insert` (Append-only), `select` | Append insert payload | 5 B-tree indexes | 🟢 P3 |

---

## 2. Direct Component Database Access (🔴 P0 DAL Violations)

Direct queries from UI components bypass DAL caching (`cache()` / `unstable_cache`) and tag invalidation:

| File | Line | Code Snippet | Root Cause & Problem |
| :--- | :---: | :--- | :--- |
| `apps/web/app/(app)/operations/page.tsx` | 52 | `supabase.from("users").select("*").in("role", ...)` | Fetches all user columns inline instead of calling `getOperationalUsers()` |
| `apps/web/app/(app)/operations/page.tsx` | 55 | `supabase.from("machine_assignments").select("*, machine:machines(*), ...")` | Direct multi-join inline query on assignments |
| `apps/web/app/(app)/operations/page.tsx` | 59 | `supabase.from("machine_hour_logs").select("*, machine:machines(*), client:clients(*), ...")` | Direct multi-join inline query on logs table |
| `apps/web/app/(app)/operations/page.tsx` | 65 | `supabase.from("machine_site_movements").select("*, machine:machines(*), ...")` | Direct inline query on site movements |
| `apps/web/app/(app)/operations/page.tsx` | 70 | `supabase.from("operator_payouts").select("*, operator:users!operator_id(...)")` | Direct inline query on payouts |
| `apps/web/app/(app)/operations/page.tsx` | 74 | `supabase.from("machines").select("*").eq("current_operator_id", user.id)` | Direct operator assigned machine query |
| `apps/web/app/(app)/operations/page.tsx` | 77 | `supabase.from("machines").select("*").order("created_at", ...)` | Direct inline machine fleet query |

---

## 3. Wildcard `select("*")` Audit (🟠 P1)

75 call sites utilize `select("*")`. The most critical ones affecting active core features:

1. **`apps/web/app/(app)/operations/page.tsx` (8 call sites)**:
   - Line 52: `supabase.from("users").select("*")`
   - Line 55: `supabase.from("machine_assignments").select("*, machine:machines(*)")`
   - Line 59: `supabase.from("machine_hour_logs").select("*, machine:machines(*), client:clients(*)")`
   - Line 74: `supabase.from("machines").select("*")`
   - Line 77: `supabase.from("machines").select("*")`
2. **`apps/web/app/actions/users.ts` (7 call sites)**:
   - Actions querying full user records for single field updates.
3. **`apps/web/lib/queries/machines.ts` (4 call sites)**:
   - Machine detail and fleet list queries with wildcard field selections.

---

## 4. Potential N+1 Loop Queries (🔴 P0 / 🟠 P1)

| File | Line | Loop Construct | Inner Query | Recommended Fix | Priority |
| :--- | :---: | :--- | :--- | :--- | :---: |
| `apps/web/app/actions/finance.ts` | 65 | `for (const item of input.items)` | `supabase.from("finance_invoice_items").insert(item)` | Batch insert: `supabase.from("finance_invoice_items").insert(input.items)` | 🔴 P0 |
| `apps/web/app/actions/inventory.ts` | 360 | `for (const item of payload.items)` | `supabase.from("inventory_purchase_order_items").insert(item)` | Batch insert: `supabase.from("inventory_purchase_order_items").insert(payload.items)` | 🔴 P0 |
| `apps/web/app/actions/tasks.ts` | 76 | `for (const assigneeId of validated.assignee_ids)` | `supabase.from("notifications").insert({...})` | Bulk notification insert: `supabase.from("notifications").insert(notificationsArray)` | 🟠 P1 |
