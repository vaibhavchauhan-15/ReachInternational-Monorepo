# Web Application Security Architecture — `apps/web`

> **NEXT.JS 16.2 APP ROUTER SECURITY ARCHITECTURE & BOUNDARIES**  
> *This document defines the web-specific security boundaries, server/client component invariants, data access layers, and authentication controls for `apps/web`.*

---

## 1. Web Architecture Overview

ReachInternational Web is built on **Next.js 16.2 (App Router)** running in Node.js 22 LTS:
- **Server Components (RSC)**: Fetch data server-side by default via Data Access Layer (`lib/dal.ts`) and direct queries (`lib/queries/*`). Zero database credentials or service-role keys are shipped to the client browser.
- **Client Components (`'use client'`)**: Strictly leaf nodes for interactive UI, modals, form inputs, and animations. Never perform direct database calls.
- **Server Actions (`app/actions/*`)**: Execute all state mutations with mandatory session verification, role authorization, and Zod input validation.
- **Edge Proxy (`proxy.ts`)**: Turbopack proxy handling edge rate limiting, session verification, cryptographically signed internal headers (`x-internal-user-sig`), and protected route redirects.
- **Auth & Session Management**: Handled via `@supabase/ssr` using `HttpOnly`, `Secure`, `SameSite=Lax` cookies.

---

## 2. Web Security Document Index

Every developer and AI agent working in `apps/web` must reference these scoped documents alongside the root policies:

| Document | Primary Focus | Root Baseline Reference |
|---|---|---|
| **[`SECURITY-RULES.md`](./SECURITY-RULES.md)** | Web-specific mandatory coding rules, RSC bounds, DAL rules | [`../../../security/SECURITY-RULES.md`](../../../security/SECURITY-RULES.md) |
| **[`ATTACK-SURFACE.md`](./ATTACK-SURFACE.md)** | Web routes, Server Actions, edge proxy, API endpoints | [`../../../security/ATTACK-SURFACE.md`](../../../security/ATTACK-SURFACE.md) |
| **[`THREAT-MODEL.md`](./THREAT-MODEL.md)** | Web-specific STRIDE threats, XSS, CSRF, BOLA, cache leakage | [`../../../security/THREAT-MODEL.md`](../../../security/THREAT-MODEL.md) |
| **[`SECURITY-CHECKLIST.md`](./SECURITY-CHECKLIST.md)** | Actionable web pre-implementation and PR checklist | [`../../../security/SECURITY-CHECKLIST.md`](../../../security/SECURITY-CHECKLIST.md) |

---

## 3. Server / Client Trust Boundary Model

```text
 [ BROWSER CLIENT (UNTRUSTED) ]
  • React client leaf nodes ('use client')
  • Form submission & User Events
  • HttpOnly Session Cookie (invisible to JavaScript)
             │
             │ HTTPS / TLS 1.3
             ▼
 [ EDGE PROXY (proxy.ts) ]
  • Strips untrusted x-internal-user-* headers
  • LPDoS Rate Limiting Guard (checkRateLimitAsync)
  • Supabase auth.getUser() token check (<20ms)
  • Injects cryptographically signed x-internal-user-sig
             │
             │ Edge-Verified Request
             ▼
 [ SERVER APPLICATION (TRUSTED) ]
  • Next.js React Server Components (RSC)
  • Server Actions (app/actions/*) with requireRole()
  • Data Access Layer (lib/dal.ts verifySession)
  • Zod Validation (@reachinternational/validation)
  • Centralized Audit Logging (lib/audit.ts logAudit)
             │
             │ PostgREST / Supabase Client
             ▼
 [ SUPABASE POSTGRESQL (PERSISTENCE) ]
  • 154+ Migrations enforcing Row Level Security (RLS)
  • Private storage bucket (user_files)
```

---

## 4. Web-Specific Golden Invariants

1. **RSC First**: Components are React Server Components unless browser APIs (`useState`, `useEffect`, `window`) are strictly necessary.
2. **Mutations via Server Actions**: All state updates go through `app/actions/*`, not standalone REST API routes.
3. **No Direct `createClient` in UI**: Components must never import Supabase client creation functions directly; all data reads flow through `lib/dal.ts` or `lib/queries/*`.
4. **No Server Secrets in Browser**: Privileged secrets (`SUPABASE_SECRET_KEY`) must never be imported into client components. Use `import "server-only"` in server utility files.
