# Route Performance Baseline (Phase 0)

> **MEASUREMENT PROTOCOL**: Next.js 16.2.12 Production Build (`next start` on `http://localhost:3005`), HTTP/1.1 with Cache Disabled.

---

## 1. Core Route Summary Table

| Route | Method | Status | Requests | Transferred (HTML) | Total Transfer (Assets) | Avg Load Time | Min Load Time | Notes |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `/login` | `GET` | `200 OK` | 16 | 31,591 B (30.9 KB) | 1,446,134 B (1.41 MB) | 9.85 ms | 8.06 ms | Rendered static/client form |
| `/signup` | `GET` | `200 OK` | 16 | 40,620 B (39.7 KB) | 1,461,612 B (1.43 MB) | 8.67 ms | 7.46 ms | Rendered registration form |
| `/machines` | `GET` | `307 Redirect` | 1 | 6 B | 6 B | 4.01 ms | 2.88 ms | Edge Proxy redirects to `/login` |
| `/users` | `GET` | `307 Redirect` | 1 | 6 B | 6 B | 3.47 ms | 2.99 ms | Edge Proxy redirects to `/login` |
| `/clients` | `GET` | `307 Redirect` | 1 | 6 B | 6 B | 3.45 ms | 3.02 ms | Edge Proxy redirects to `/login` |
| `/operations?tab=logs` | `GET` | `307 Redirect` | 1 | 6 B | 6 B | 3.41 ms | 2.63 ms | Edge Proxy redirects to `/login` |
| `/operations?tab=assignments` | `GET` | `307 Redirect` | 1 | 6 B | 6 B | 4.12 ms | 3.51 ms | Edge Proxy redirects to `/login` |
| `/operations?tab=entry` | `GET` | `307 Redirect` | 1 | 6 B | 6 B | 4.31 ms | 3.48 ms | Edge Proxy redirects to `/login` |
| `/operations?tab=history` | `GET` | `307 Redirect` | 1 | 6 B | 6 B | 3.71 ms | 3.02 ms | Edge Proxy redirects to `/login` |

---

## 2. Sub-Resource Bundle Breakdown (`/login`)

Total requests: **16 requests**  
Total transferred data (uncompressed): **1.41 MB (1,446,134 bytes)**  
Total script chunks: **15 JS Chunks**

| Chunk Filename | Asset Type | Size (Bytes) | Size (KB) | Avg Duration | Notes |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `35aimukz77phg.js` | JS Chunk | 404,053 B | 394.58 KB | 4.15 ms | **Largest chunk**: Core React / Radix / Base UI vendor chunk |
| `20_ga2wjswjyy.js` | JS Chunk | 227,423 B | 222.09 KB | 2.67 ms | Framer Motion / UI styling runtime |
| `0okxtd6-1d58i.js` | JS Chunk | 190,721 B | 186.25 KB | 2.75 ms | Shared icons / Supabase client bundle |
| `0cz1d0mv5g_q7.js` | JS Polyfill | 112,594 B | 109.95 KB | 2.61 ms | Next.js baseline polyfills |
| `17xr82xco-q7f.js` | JS Chunk | 110,736 B | 108.14 KB | 1.86 ms | Lucide icon subset and utilities |
| `33dyn1vo7en0m.js` | JS Chunk | 94,438 B | 92.22 KB | 1.97 ms | Form validation & Zod runtime |
| `32nxn7n7pgkji.js` | JS Chunk | 76,933 B | 75.13 KB | 1.89 ms | Auth form client component |
| `3b19hpzl98l7o.js` | JS Chunk | 54,781 B | 53.50 KB | 2.44 ms | Theme & notification providers |
| `2j2woml_bs7pk.js` | JS Chunk | 44,496 B | 43.45 KB | 3.83 ms | App shell root utilities |
| `3apf5jap0d9wm.js` | JS Chunk | 32,880 B | 32.11 KB | 1.62 ms | Turbopack runtime bootstrap |
| `3po3fl2ey1icj.js` | JS Chunk | 31,387 B | 30.65 KB | 8.85 ms | Main client manifest |
| `turbopack-3d5yaka1vsc2b.js` | JS Chunk | 10,614 B | 10.37 KB | 2.98 ms | Turbopack module loader |
| `1b92z9m_cileb.js` | JS Chunk | 9,383 B | 9.16 KB | 1.74 ms | Shared utility functions |
| `3kzspakjy3zsu.js` | JS Chunk | 7,647 B | 7.47 KB | 1.60 ms | Error boundary chunk |
| `1mqjbiyf52jem.js` | JS Chunk | 6,451 B | 6.30 KB | 1.78 ms | State hooks chunk |

---

## 3. Sub-Resource Bundle Breakdown (`/signup`)

Total requests: **16 requests**  
Total transferred data (uncompressed): **1.43 MB (1,461,612 bytes)**  
Total script chunks: **15 JS Chunks**

---

## 4. Key Observations & Bottleneck Opportunities (For Phase 1+)

1. **Initial Bundle Size**: Initial JS bundle on `/login` is ~1.41 MB uncompressed (~320 KB gzipped). While local load time is `< 10ms`, on low-speed 3G/4G networks this exceeds the 150 KB budget.
2. **Edge Proxy Latency**: `proxy.ts` session verification and redirects execute in **2.6ms – 4.3ms**, proving highly efficient.
3. **Chunk Splitting Target**: Investigate opportunities to optimize package imports and lazy-load non-critical client UI libraries.
