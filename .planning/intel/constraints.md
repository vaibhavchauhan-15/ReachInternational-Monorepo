# Ingested Architectural & Operational Constraints

**Analysis Date:** 2026-09-09

## Architectural Constraints

- **Single Datastore**: One single Supabase PostgreSQL database and one Supabase Auth instance. No independent mobile database or separate microservices backend.
- **Monorepo Layering**: Strict unidirectional DAG flow (`apps/*` → `packages/*`). Apps never import from apps, packages never import from apps, and foundational packages never import from higher-level domain packages.
- **Canonical Barrels**: All cross-package imports must resolve through root package barrels (`index.ts`). Deep imports into internal files are strictly forbidden.
- **Zero Type Errors**: Strict TypeScript mode across all packages. Every pull request and release must maintain 0 type errors (`turbo run typecheck`).

## Security & Compliance Constraints

- **Service Key Isolation**: `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to server-side code (`lib/supabase/admin.ts` and Server Actions). Never expose or leak to client components.
- **Row Level Security**: 100% of operational tables in `public` schema must enforce Row Level Security (RLS) policies.
- **Audit Logging**: All state-changing mutations must write an immutable audit log entry via `logAudit()`. Sensitive credentials and super-admin emails must be redacted prior to insertion.
- **KYC & Attachment Protection**: Sensitive documents (Aadhaar, driving licenses) must be stored in private Supabase Storage buckets with time-limited signed URLs.

## UI/UX & Cross-Platform Constraints

- **Design Tokens**: All user interfaces must adhere to Vercel Geist design tokens (`#171717` ink, `#fafafa` canvas, `#ffffff` elevated, `#ebebeb` 1px border, `#0070f3` link blue).
- **3-Tier Viewport Responsiveness**: Every feature must provide dedicated responsive layouts for Desktop (dense tables), Tablet (2-col adaptive grid), and Mobile (touch cards, bottom sheets).
- **Mandatory Web-to-Mobile Synchronization**: Any change, feature, status badge, form field, or workflow modified in `apps/web` must be simultaneously applied to `apps/mobile` in the same task.

## Performance Constraints

- **Zero Unbounded Queries**: `SELECT *` is prohibited in production queries. Always project explicit column sets.
- **Pagination**: Any dataset that can exceed 20 records must use canonical `<Pagination />`. High-volume datasets must enforce server-side range slicing.
- **Parallel Relational Hydration**: Related entities must be queried in parallel using `Promise.all()` to eliminate sequential network waterfalls.
