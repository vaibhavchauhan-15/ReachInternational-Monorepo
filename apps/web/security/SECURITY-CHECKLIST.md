# Web Security Checklist & Verification Gate — `apps/web`

> **ACTIONABLE SECURITY COMPLIANCE GATE FOR NEXT.JS WEB DEVELOPMENT**  
> *Every item in this checklist must be satisfied before merging web pull requests or declaring web engineering tasks complete.*

---

## 1. Server Components & Architecture (`apps/web`)

- [ ] **WEB-CHK-01: React Server Component (RSC) Default**
  - *Check*: The page or component is an RSC unless client-side hooks (`useState`, `useEffect`) or browser DOM APIs are strictly necessary.
  - *Evidence*: Absence of `'use client'` at the top of server-data-fetching files.
- [ ] **WEB-CHK-02: Client Leaf Node Restriction**
  - *Check*: `'use client'` components are strictly leaf nodes; they never wrap a server component tree.
  - *Evidence*: Component tree structure verified.
- [ ] **WEB-CHK-03: Data Access Layer (DAL) Enforcement**
  - *Check*: All server-side data fetching uses `lib/dal.ts` or `lib/queries/*`. Components never import `createClient` directly.
  - *Evidence*: Imports reviewed for DAL usage.
- [ ] **WEB-CHK-04: Explicit Column Projections**
  - *Check*: Database queries explicitly project required fields only (no `SELECT *`).
  - *Evidence*: Query string specifies explicit column names.

---

## 2. Server Actions & Mutations (`apps/web/app/actions/*`)

- [ ] **WEB-CHK-05: Server Action Session Verification**
  - *Check*: The action begins with `await verifySession()` or `await requireRole(...)`.
  - *Evidence*: Line reference in action file.
- [ ] **WEB-CHK-06: Role & Permission Authorization**
  - *Check*: The action invokes `requireRole()` or `requirePermission()` from `@reachinternational/permissions`.
  - *Evidence*: Explicit check before database mutation.
- [ ] **WEB-CHK-07: Resource Ownership / BOLA Guard**
  - *Check*: For non-administrative roles, the server verifies `user_id` or machine assignment matches the session.
  - *Evidence*: Ownership validation logic in action handler.
- [ ] **WEB-CHK-08: Canonical Zod Input Validation**
  - *Check*: Input `formData` or JSON payload is validated using a schema from `@reachinternational/validation`.
  - *Evidence*: `schema.safeParse()` or `schema.parse()` executed.
- [ ] **WEB-CHK-09: Centralized Audit Logging**
  - *Check*: State-changing actions call `await logAudit({ action, entity_type, entity_id })`.
  - *Evidence*: Audit logging call in action handler.
- [ ] **WEB-CHK-10: Cache Tag Invalidation**
  - *Check*: The action calls `revalidateTag(TAGS.*, "max")` to invalidate affected cached queries.
  - *Evidence*: `revalidateTag` call with canonical tag from `lib/cache.ts`.

---

## 3. Edge Proxy & Routes (`apps/web/proxy.ts`)

- [ ] **WEB-CHK-11: Route Guard Coverage**
  - *Check*: If a new protected route is created under `/(app)/`, confirm `proxy.ts` redirects unauthenticated traffic to `/login`.
  - *Evidence*: Route test with unauthenticated browser session.
- [ ] **WEB-CHK-12: Rate Limiting Assignment**
  - *Check*: New mutation endpoints or auth callbacks have appropriate rate limit profile assigned.
  - *Evidence*: Verification in `proxy.ts` or route handler.
- [ ] **WEB-CHK-13: Cache-Control Header Hygiene**
  - *Check*: Navigation redirects set `Cache-Control: no-store` to prevent caching of auth redirects.
  - *Evidence*: Headers verified in redirect responses.

---

## 4. Verification & Testing

- [ ] **WEB-CHK-14: Static Typecheck Clean**
  - *Check*: `pnpm --filter @reachinternational/web typecheck` exits with code 0.
  - *Evidence*: CLI output showing 0 type errors.
- [ ] **WEB-CHK-15: Web Production Build**
  - *Check*: `pnpm --filter @reachinternational/web build` succeeds without compiler warnings or bundle errors.
  - *Evidence*: Next.js build output showing route table and clean exit code.
- [ ] **WEB-CHK-16: Git Diff Review**
  - *Check*: No debug `console.log` statements with user data, no commented-out security checks, no secrets committed.
  - *Evidence*: Clean `git diff` review.
