# Client Directory Performance Baseline (Phase C1)

> **Document Type**: Pre-Optimization Route & Action Benchmark  
> **Target Route**: `/clients` (Web App: `apps/web/app/(app)/clients/page.tsx`, `apps/web/components/clients/*`) & Mobile App (`apps/mobile/app/(app)/clients.tsx`)  
> **Benchmark Date**: 2026-09-13  
> **Master Benchmark File**: [`CLIENT_PERFORMANCE_BASELINE.md`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/CLIENT_PERFORMANCE_BASELINE.md)

---

## 1. Master Baseline Summary Table

| Operation | TTFB | LCP | INP | API Latency | DB Latency | Request Count | Duplicate Requests | Payload Size | JS Size | Render Time | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Cold Load** | 246.2 ms | 320 ms | N/A (15ms TBT) | 246.2 ms | 6.71 ms (3.41ms conc.) | 3 queries | 1 (Full city scan) | 1,211 B | 1,059.77 KB (11 chunks) | 18.5 ms | Eager full-table scan on clients for cities |
| **Warm Load** | 8.5 ms | 45 ms | N/A (<5ms TBT) | 0.45 ms | 0.00 ms (Memory Cache) | 0 queries | 0 | 1,211 B | 0 B (Disk Cache) | 8.2 ms | Next.js SWR cache hit |
| **Search ("infra")** | 66.1 ms | 110 ms | 28 ms | 66.1 ms | 12.64 ms (12.44ms plan) | 1 query | 0 | 450 – 1,120 B | 0 B | 6.4 ms | High planning penalty (missing GIN on GSTIN/PAN) |
| **Filter (City)** | 63.6 ms | 105 ms | 24 ms | 63.6 ms | 4.19 ms (4.03ms plan) | 1 query | 0 | 450 – 1,120 B | 0 B | 5.8 ms | Partial B-tree index `idx_clients_city` hit |
| **Tab Switch (Active)** | 66.5 ms | 98 ms | 22 ms | 66.5 ms | 1.47 ms | 1 query | 0 | 1,121 B | 0 B | 5.2 ms | Composite index `(status, company_name)` hit |
| **Tab Switch (Inactive)**| 69.1 ms | 85 ms | 22 ms | 69.1 ms | 1.54 ms | 1 query | 0 | 2 B | 0 B | 4.8 ms | B-tree index `idx_clients_deleted_at` hit |
| **Add Client** | 97.1 ms | N/A | 45 ms | 97.1 ms | 13.90 ms | 2 queries | 0 | 100 B | 16.4 KB (Modal chunk) | 12.5 ms | Client insert + audit log insert with FK check |
| **Edit Client** | 74.3 ms | N/A | 42 ms | 74.3 ms | 5.06 ms | 2 queries | 0 | 90 B | 0 B | 9.8 ms | Client update + audit log insert |
| **Delete Client** | 64.1 ms | N/A | 35 ms | 64.1 ms | 5.05 ms | 2 queries | 0 | 110 B | 4.1 KB (Delete chunk) | 8.1 ms | Soft delete update + audit log insert |

---

## 2. Key Target Improvements

1. **Cold Load**: Eliminate redundant city scan, reducing DB queries from 3 to 2 and cutting TTFB to `<150ms`.
2. **Search**: Add GIN trigram indexes on `gstin` and `pan_number`, reducing DB planning time from `12.44ms` to `<1.0ms`.
3. **Payload**: Trim `CLIENT_LIST_COLUMNS` from 22 to 14, reducing row payload by `~35%`.
4. **Mobile**: Replace unpaginated full-table dump (~50-500 KB) with server-paginated 10-item pages (<400 KB heap).
