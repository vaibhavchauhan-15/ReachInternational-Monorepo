# Web Application Mandatory Security Rules — `apps/web`

> **SCOPED SECURITY RULES FOR NEXT.JS WEB DEVELOPMENT**  
> *These rules extend the monorepo baseline in [`../../../security/SECURITY-RULES.md`](../../../security/SECURITY-RULES.md). All rules in the root policy apply to `apps/web`. When rules overlap, the STRICTER rule wins.*

---

## 1. Primary Architecture Invariants

1. **Server Components by Default**:
   All page components under `app/(app)/` must be React Server Components (RSC). Do not add `'use client'` unless browser hooks (`useState`, `useEffect`) or browser event listeners are strictly necessary.
2. **Leaf Node Constraint**:
   Client components (`'use client'`) must be leaf nodes in the render tree. A client component must never import or wrap server components in a way that executes server code in client context.
3. **Data Access Layer (DAL) Mandate**:
   All server-side reads MUST flow through `lib/dal.ts` or `lib/queries/*`. Components must never import `createClient` directly.
4. **Mutations via Server Actions**:
   All database state mutations MUST flow through `app/actions/*`. Never implement state mutations in API routes when a Server Action suffices.

---

## 2. Server Action Enforcement Rules

Every Server Action in `apps/web/app/actions/*` MUST execute the following verification pipeline in exact sequential order:

```text
1. Identity Verification  → await verifySession() or await requireRole(...)
2. Role Authorization      → await requireRole(...) or requirePermission(...)
3. Resource Ownership      → Verify target record belongs to or is assigned to user
4. Payload Validation      → Canonical Zod schema safeParse() from @reachinternational/validation
5. Database Operation      → Parameterized Supabase query / RPC execution
6. Audit Logging           → await logAudit({ action, entity_type, entity_id })
7. Cache Revalidation      → revalidateTag(TAGS.*, "max")
8. Typed Result Return     → Return { success: true } or { error: string }
```

**Prohibition**: Never execute a database mutation without completing steps 1, 2, 3, and 4.

---

## 3. Server-Only Secret Isolation

1. **`import "server-only"`**:
   All utility modules that handle database credentials, service-role keys, or internal signing secrets (`apps/web/lib/supabase/admin.ts`, `apps/web/lib/env/server.ts`, `apps/web/lib/audit.ts`) MUST include `import "server-only";` as line 1.
2. **No `NEXT_PUBLIC_` for Secrets**:
   Never prefix server-only environment variables (`SUPABASE_SECRET_KEY`, `INTERNAL_AUTH_SECRET`, `SENDGRID_API_KEY`) with `NEXT_PUBLIC_`.

---

## 4. Output Encoding & HTML Sanitization

1. **JSX Text Rendering**:
   Rely on React 19's native JSX escaping for user-supplied string data.
2. **Raw HTML & Email Templates**:
   Any user-controlled content rendered via `dangerouslySetInnerHTML` or compiled into email templates MUST pass through `sanitizeHtml()` from `@reachinternational/utils/sanitize`.

---

## 5. Cache Hygiene & Isolation

1. **Scoped Cache Keys**:
   When using Next.js `unstable_cache`, any query returning user-specific data MUST include `userId` in the key array to prevent cross-user data bleeding.
2. **Tag Invalidation**:
   Use canonical cache tags defined in `apps/web/lib/cache.ts` and call `revalidateTag(tag, "max")` immediately after successful mutations.
