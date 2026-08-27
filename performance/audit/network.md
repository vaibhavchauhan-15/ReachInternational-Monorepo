# Network Architecture Audit (Phase 1)

> **SCOPE**: Network data transfer, edge proxy routing, Server Action RPCs, and API communication.

---

## 1. Network Boundary Overview

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Browser / Mobile Client                                                          │
│ └── Submits form actions via Next.js Server Action RPC (POST payload < 1MB)     │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Edge Proxy (proxy.ts)                                                            │
│ └── Evaluates session cookies in 2.6ms – 4.3ms; enforces 120 req/min rate limit  │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Next.js Server Components (RSC)                                                  │
│ └── Direct secure HTTPS calls to Supabase PostgreSQL                             │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Scheduled Cron Worker                                                            │
│ └── POST /api/cron/send-reminders (Bearer auth + 10s execution timeout)          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Network Audit Findings

1. **Zero Client-Side REST Waterfalls in Web**: Web client components do not issue raw client-side REST `fetch()` or `axios` calls; all initial datasets arrive pre-rendered via RSC.
2. **Payload Size Caps**: `apps/web/next.config.ts` enforces `serverActions.bodySizeLimit: "1mb"`.
3. **Optimized Edge Proxy**: `apps/web/proxy.ts` evaluates session cookies locally in **2.6ms – 4.3ms** before routing to Node.js server components.
