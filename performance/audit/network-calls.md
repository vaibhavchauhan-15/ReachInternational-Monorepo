# Network Calls Audit (Phase 1)

> **SCOPE**: Audit of client-side HTTP requests, API routes, and mobile TanStack Query calls.

---

## 1. Network Fetching Overview

| Application Area | Network Mechanism | Typical Request / URL | Frequency | Payload Size | Can it be Server-Fetched? | Priority |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **Web Server Components** | Supabase HTTPS/WSS (Server-to-Server) | `https://*.supabase.co/rest/v1/...` | On page load / navigation | 2 KB – 30 KB | Already Server-Side (RSC) | 🟢 P3 |
| **Web Client Components** | Next.js Server Actions (RPC POST) | Next.js internal Action RPC | On user form submit | < 10 KB | N/A (Mutations) | 🟢 P3 |
| **Web Edge Proxy** | Cookie check / Supabase Auth | `proxy.ts` Edge runtime | On every navigation request | < 1 KB | Edge-evaluated (< 4ms) | 🟢 P3 |
| **Cron Worker** | Upstash QStash / Direct HTTP POST | `POST /api/cron/send-reminders` | Hourly scheduled cron | < 1 KB | Server background worker | 🟢 P3 |
| **Mobile App (`apps/mobile`)** | Supabase REST Client + TanStack Query | `supabase.from("machines").select(...)` | Screen focus / manual pull-to-refresh | 5 KB – 20 KB | Mobile native fetching with offline cache | 🟢 P3 |

---

## 2. Key Network Findings

1. **Zero Client-Side REST Waterfalls in Web**: Web client components do not issue raw `fetch()` or `axios` calls to third-party endpoints; all data arrives pre-rendered via RSC.
2. **Server Action Body Size Limits**: `apps/web/next.config.ts` enforces `serverActions.bodySizeLimit: "1mb"`, preventing large payload DoS attacks over the network.
3. **Optimized Edge Proxy**: `apps/web/proxy.ts` evaluates session cookies locally in **2.6ms – 4.3ms** before routing to Node.js server components.
