# Route Performance Baseline — Phase 0

> **Environment**: Production Build (`next start`), HTTP/1.1 on `http://localhost:3000`  
> **Testing Methodology**: Chrome DevTools + Browser Performance API (`window.performance.getEntriesByType`) + Node.js benchmark profile with Cache Disabled.

---

## 1. Core Route Performance Baseline Table

| Route | Requests | Transfer (KB) | Load Time (ms) | Status / Errors | Slowest Request | Largest Request | Notes |
|---|---:|---:|---:|---|---|---|---|
| `/login` | 34 | 408.6 KB | 424 ms | `200 OK` (0 errs) | `forgot-password?_rsc=...` (202 ms) | `35aimukz77phg.js` (86.0 KB) | Static prerendered route. Includes client form, mesh background, lucide icons. |
| `/signup` | 28 | 11.9 KB | 984 ms | `200 OK` (0 errs) | `site.webmanifest` (153 ms) | `?_rsc=x75wzsg...` (1.6 KB) | Static prerendered route. Preloaded chunks from `/login` cache hits. |
| `/machines` | 1 | 0.006 KB | 90.6 ms | `307 Redirect` → `/login` | `GET /machines` (90.6 ms) | Document (6 bytes) | Edge proxy session verification (`proxy.ts`). Redirects unauthenticated traffic to `/login`. |
| `/users` | 1 | 0.006 KB | 47.4 ms | `307 Redirect` → `/login` | `GET /users` (47.4 ms) | Document (6 bytes) | Edge proxy session verification (`proxy.ts`). |
| `/clients` | 1 | 0.006 KB | 43.4 ms | `307 Redirect` → `/login` | `GET /clients` (43.4 ms) | Document (6 bytes) | Edge proxy session verification (`proxy.ts`). |
| `/operations?tab=logs` | 1 | 0.006 KB | 42.6 ms | `307 Redirect` → `/login` | `GET /operations?tab=logs` (42.6 ms) | Document (6 bytes) | Edge proxy session verification (`proxy.ts`). |
| `/operations?tab=assignments` | 1 | 0.006 KB | 40.9 ms | `307 Redirect` → `/login` | `GET /operations?tab=assignments` (40.9 ms) | Document (6 bytes) | Edge proxy session verification (`proxy.ts`). |
| `/operations?tab=entry` | 1 | 0.006 KB | 32.4 ms | `307 Redirect` → `/login` | `GET /operations?tab=entry` (32.4 ms) | Document (6 bytes) | Edge proxy session verification (`proxy.ts`). |
| `/operations?tab=history` | 1 | 0.006 KB | 55.6 ms | `307 Redirect` → `/login` | `GET /operations?tab=history` (55.6 ms) | Document (6 bytes) | Edge proxy session verification (`proxy.ts`). |

---

## 2. Resource Breakdown for Initial Entrypoint (`/login`)

```text
Resource Category      Transfer Size (KB)    Decoded Size (KB)    Request Count
───────────────────────────────────────────────────────────────────────────────
• JavaScript (Chunks)           312.4 KB             986.2 KB               18
• Stylesheets (CSS)              42.1 KB             148.5 KB                3
• Document (HTML)                40.3 KB              40.3 KB                1
• Static Assets / Icons          13.8 KB              13.8 KB               12
───────────────────────────────────────────────────────────────────────────────
TOTAL                           408.6 KB            1188.8 KB               34
```

---

## 3. Notable Observations & Bottlenecks

1. **Proxy Redirect Efficiency**: Next.js 16 Edge Proxy (`proxy.ts`) evaluates route access and returns `307 Temporary Redirect` in **32–90 ms**, protecting authenticated server components from unauthorized execution.
2. **First Load JavaScript Payload**: The initial JS bundle transferred on `/login` is **312.4 KB** (decoded to ~986 KB). This presents an opportunity for code-splitting heavy client libraries (e.g. `recharts`, `framer-motion`, modal sheets) via dynamic imports in Phase 2 & Phase 3.
3. **Prefetch Traffic**: Navigation links prefetch `_rsc` server component payloads (e.g. `forgot-password?_rsc=...` took 202 ms).
4. **DAL Schema Invariant**: During user row lookup in `lib/dal.ts`, the database rejected requests querying non-existent column `users.branch_id`. Resolving this DAL projection mismatch is noted for data-layer optimization.
