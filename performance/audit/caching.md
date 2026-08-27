# Caching & Revalidation Audit (Phase 1)

> **SCOPE**: Audit of React `cache()`, Next.js `unstable_cache`, `revalidateTag`, `revalidatePath`, and `router.refresh()` usage across `apps/web`.

---

## 1. Caching Tier Architecture

ReachInternational defines a 4-tier data freshness hierarchy (`lib/cache.ts`):

```text
DATA CLASS        REVALIDATION TTL     INVALIDATION METHOD         USED BY
──────────────────────────────────────────────────────────────────────────────────────────
• Class A (Static)      24h (86400s)   revalidateTag("categories") Categories, app settings
• Class B (Semi-Static) 5m (300s)      revalidateTag("machines")   Machine specs, CRM clients
• Class C (Operational) 15s (15s)      Server Action mutation      User profiles, hour logs
• Class D (Realtime)    0s             Supabase Realtime Channel   Live breakdown alerts
```

---

## 2. Invalidation & Cache Triggers Audit

| Mechanism | Occurrences | Locations | Intended Use | Problem / Opportunity | Priority |
| :--- | :---: | :--- | :--- | :--- | :---: |
| `router.refresh()` | **27** | `users-client.tsx` (8), `OperationsClient.tsx` (5), `MachineListClient.tsx` (4), `ComplaintsClient.tsx` (3), `FinanceClient.tsx` (2), `ServicesClient.tsx` (2), `RefreshButton.tsx` (1) | Trigger client re-fetch of server components after mutation | **Causes full page re-render**. Should be replaced with targeted Server Action `revalidateTag` | 🟠 P1 |
| `revalidateTag` | **180+** | All Server Actions in `apps/web/app/actions/*` | Invalidate Next.js data cache for mutated entities | Highly effective; ensures Next.js cache stays synchronized | 🟢 P3 |
| `revalidatePath` | **12** | `actions/refresh.ts`, `actions/machines.ts` | Invalidate entire URL path cache | Broad invalidation; prefer `revalidateTag` | 🟡 P2 |
| `cacheWithTag` | **45** | `apps/web/lib/queries/*` | Wrap Supabase queries with Next.js data cache | Provides sub-millisecond cached responses | 🟢 P3 |
| React `cache()` | **18** | `apps/web/lib/dal.ts`, `queries/users.ts` | Deduplicate identical queries within a single render pass | Deduplicates `verifySession` and `getCachedUserRow` | 🟢 P3 |

---

## 3. Major Caching Findings

### Finding CACHE-01: Full Page Tree Invalidation via `router.refresh()` (🟠 P1)
- **Problem**: When a supervisor assigns an operator or an admin approves a user, the UI calls `router.refresh()`.
- **Root Cause**: The client component does not update its local state optimistically, relying on Next.js to re-render the entire Server Component page from scratch.
- **Remediation**: Use `startTransition` with optimistic state updates (`useOptimistic` or local React state) while the Server Action handles `revalidateTag`.
