# Performance Audit Issues

## P0 — Critical

### P0-001
Location: `apps/web/app/(app)/operations/page.tsx:L52-L77`  
Problem: Direct inline Supabase querying inside page component with wildcard `select("*")` bypassing the Data Access Layer (DAL).  
Evidence:
```ts
const [users, assignments, hourLogs, siteMovements, payouts, assignedMachine, machines] = await Promise.all([
  supabase.from("users").select("*").in("role", ["operator", "mechanic", "supervisor", "service_engineer"]),
  supabase.from("machine_assignments").select("*, machine:machines(*), operator:users!operator_id(id, full_name, phone, email), assigner:users!assigned_by(id, full_name)"),
  supabase.from("machine_hour_logs").select("*, machine:machines(*), client:clients(*), operator:users!operator_id(id, full_name, phone, email), supervisor:users!supervisor_id(id, full_name, phone)"),
  supabase.from("machine_site_movements").select("*, machine:machines(*), operator:users!operator_id(id, full_name)"),
  supabase.from("operator_payouts").select("*, operator:users!operator_id(id, full_name, phone)"),
  user?.role === "operator" ? supabase.from("machines").select("*").eq("current_operator_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  supabase.from("machines").select("*").order("created_at", { ascending: false }).limit(100),
]);
```
Potential impact: Bypasses React `cache()` request deduplication, downloads all columns indiscriminately, executes queries for tabs that the user is not actively viewing, and violates monorepo DAL layering.

---

### P0-002
Location: `apps/web/app/actions/finance.ts:L65-L72` and `apps/web/app/actions/inventory.ts:L360-L375`  
Problem: N+1 sequential database insert queries executed in a loop instead of a single bulk batch insert.  
Evidence:
```ts
// finance.ts
for (const item of input.items) {
  await supabase.from("finance_invoice_items").insert({
    invoice_id: invoiceId,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    amount: item.amount
  });
}
```
Potential impact: Multiplies database round-trips by the number of invoice/PO line items (e.g. 50 items = 50 round-trips instead of 1), increasing mutation latency from ~50ms to >1000ms and increasing risk of partial transaction failure.

---

### P0-003
Location: `apps/web/components/operations/OperationsClient.tsx:L32` and `apps/web/components/dashboard/OperatorDashboard.tsx:L28`  
Problem: Synchronous static importing and bundling of heavy print preview and export components (`PrintableSupervisorLogsModal.tsx`, `PrintableOperatorLogsModal.tsx`, `xlsx`).  
Evidence:
```tsx
// OperationsClient.tsx
import { PrintableSupervisorLogsModal } from "./PrintableSupervisorLogsModal"; // 40.9 KB
// OperatorDashboard.tsx
import { PrintableOperatorLogsModal } from "./PrintableOperatorLogsModal"; // 23.4 KB
import * as XLSX from "xlsx"; // ~150 KB
```
Potential impact: Inflates initial client JavaScript bundle size on `/operations` by over 210 KB for all users, degrading LCP and TTI on mobile 3G/4G connections.

---

## P1 — High

### P1-001
Location: `apps/web/app/(app)/users/users-client.tsx`, `apps/web/components/machines/MachineListClient.tsx`, `apps/web/components/operations/OperationsClient.tsx`  
Problem: Overuse of `router.refresh()` on simple status mutations and table updates (27 call sites across client components).  
Evidence:
```tsx
// users-client.tsx L101, L116, L132, L148, L163, L178, L194, L209
await toggleUserStatus(userId, currentStatus);
router.refresh(); // Triggers full server component re-fetch of entire user list
```
Potential impact: Causes full RSC page tree re-render, discarded client scroll/focus positions, and unnecessary database queries on single-row state toggles.

---

### P1-002
Location: 75 call sites in `apps/web/lib/queries/*`, `apps/web/app/actions/*`, and `apps/web/app/(app)/operations/page.tsx`  
Problem: Over-fetching database records using wildcard `select("*")` on large operational tables (`machines`, `users`, `machine_hour_logs`).  
Evidence:
```ts
// machines.ts
export const getMachineById = cache(async (id: string) => {
  return supabase.from("machines").select("*").eq("id", id).single();
});
```
Potential impact: Transports unneeded metadata (notes, certificates, timestamps) across network on high-frequency list views.

---

## P2 — Medium

### P2-001
Location: `supabase/migrations/` (`public.users` and `public.clients`)  
Problem: Redundant B-tree indexes defined on identical columns.  
Evidence:
- `public.users.email` has 4 indexes: `users_email_key`, `idx_users_email_unique`, `idx_users_email`, `users_email_unique_idx`.
- `public.clients.code` has 2 indexes: `clients_code_key` and `idx_clients_code`.  
Potential impact: Write amplification on user profile updates and client mutations, consuming database buffer cache and disk I/O.

---

### P2-002
Location: `apps/web/components/operations/OperationsClient.tsx:L174-L246`  
Problem: Heavy synchronous in-memory array filtering and deduplication (`Array.from(new Set(...))`) executed on every component render.  
Evidence: Multiple client-side filter passes mapping over historical log records.  
Potential impact: Main-thread UI micro-stutters when rendering long operational feeds.

---

## P3 — Low

### P3-001
Location: `apps/web/lib/queries/`  
Problem: Legacy query files for deprecated modules (`finance.ts`, `inventory.ts`, `crm.ts`, `rentals.ts`) still present in codebase.  
Evidence: 20 query files in `lib/queries/` while only 3 core domains (`machines`, `users`, `operators`) are active.  
Potential impact: Codebase clutter; harmless to runtime performance due to tree-shaking.
