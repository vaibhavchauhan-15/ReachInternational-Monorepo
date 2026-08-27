# Query Performance Baseline (Phase 0)

> **STATISTICS SOURCE**: PostgreSQL `pg_stat_statements` on Supabase instance `dhbbgfzbyatzvqafnsqp`.

---

## 1. Top Database Queries by Total Execution Time

Query:
```sql
SELECT query, calls, total_exec_time, mean_exec_time, rows
FROM pg_stat_statements
WHERE query ILIKE '%users%' OR query ILIKE '%machines%' OR query ILIKE '%machine_hour_logs%' OR query ILIKE '%clients%' OR query ILIKE '%audit_logs%'
ORDER BY total_exec_time DESC
LIMIT 15;
```

### Measured Execution Profile:

| Query Target / Pattern | Calls | Total Time (ms) | Mean Time (ms) | Rows Returned | Pattern Type | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| `auth.users` session resolution by `id` | 19,160 | 1,498.81 ms | **0.08 ms** | 19,160 | B-tree Point Lookup | Extremely fast PK lookup |
| `public.machines` fleet list with engineer lateral join | 371 | 1,383.57 ms | **3.73 ms** | 371 | PostgREST Multi-Join | Ordered by `next_service_due_date ASC` |
| `public.audit_logs` append insert | 190 | 1,102.13 ms | **5.80 ms** | 190 | Security Audit Insert | Single-row append write |
| `public.machine_hour_logs` multi-relational list (machine, client, operator, supervisor) | 167 | 672.70 ms | **4.03 ms** | 167 | PostgREST Multi-Join | Ordered by `log_date DESC, created_at DESC` |
| `auth.users` last sign-in update | 179 | 529.86 ms | **2.96 ms** | 179 | Auth Timestamp Update | Single-row update |
| `public.users` profile lookup by `id` | 803 | 389.16 ms | **0.48 ms** | 803 | DAL Point Lookup | Used in `getCachedUserRow` |
| `public.users` upsert via trigger sync | 124 | 373.57 ms | **3.01 ms** | 124 | Profile Synchronization | Trigger-driven upsert |
| `public.machine_hour_logs` operator feed lookup | 182 | 337.99 ms | **1.86 ms** | 182 | Filtered List | Filtered on `operator_id` |
| `public.machines` list ordered by `machine_name` | 241 | 283.14 ms | **1.17 ms** | 241 | Fleet Query | Simple indexed order |
| `public.machine_hour_logs` recent logs feed | 90 | 282.10 ms | **3.13 ms** | 90 | Recent Activity Feed | Ordered by `created_at DESC` |
| `public.machine_hour_logs` filtered operator log query | 71 | 281.33 ms | **3.96 ms** | 71 | Multi-Join Log Filter | Filtered on `operator_id` with 4 relations |
| `public.users` cached lookup | 1,835 | 260.71 ms | **0.14 ms** | 1,835 | Single Row Fetch | `lib/dal.ts` cached lookup |
| `public.machines` due date count check | 4,500 | 238.52 ms | **0.05 ms** | 4,500 | Reminder Count Query | Service notification engine |

---

## 2. Key DAL Query Patterns (Source Code Inspection)

1. **User Profile Retrieval (`apps/web/lib/dal.ts`)**:
   - Query: `supabase.from("users").select("id, full_name, phone, role, status, city, district, state, email, created_at, updated_at").eq("id", userId).single()`
   - Baseline Latency: **0.14 ms – 0.48 ms**
   - Protection: Wrapped in React `cache()` and tagged as `dal-user-row-v6`.

2. **Machines Hub List (`apps/web/lib/queries/machines.ts`)**:
   - Query: Explicit column projections with foreign key joins to `current_operator:users` and `current_supervisor:users`.
   - Baseline Latency: **1.17 ms – 3.73 ms**.

3. **Operations Running Hours (`apps/web/lib/queries/operators.ts`)**:
   - Query: `machine_hour_logs` join with `machines`, `clients`, `operator:users`, and `supervisor:users`.
   - Baseline Latency: **3.13 ms – 4.03 ms**.

---

## 3. Query Optimization Targets (For Phase 1 & 7)

- Keep standard point lookups `< 1 ms`.
- Keep multi-relational queries `< 10 ms` even as datasets scale to 100,000+ records.
- Ensure all complex filters (`(machine_id, log_date DESC)`, `(operator_id, log_date DESC)`) continue to hit composite B-tree indexes without falling back to sequential table scans.
