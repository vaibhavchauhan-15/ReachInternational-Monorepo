# Web Application Agent Rules — `apps/web`

> **Inherits from**: Root `AGENTS.md` (global engineering rules)
>
> These rules EXTEND the global rules. When a module rule conflicts with a global rule, the **STRICTER** rule wins.

---

## Technology Stack

- **Framework**: Next.js 16.2 (App Router) — `node_modules/next/dist/docs/` is the source of truth for APIs
- **Rendering**: React Server Components (RSC) by default; `'use client'` only at leaf nodes
- **Language**: TypeScript 5 (Strict Mode)
- **UI**: React 19.2, Tailwind CSS v4, Base UI, Lucide Icons, Recharts
- **Animations**: Framer Motion 12, TW Animate CSS
- **State**: Zustand (client state), React Query is NOT used on web (server components handle data)
- **Validation**: Zod v4 via `@reachinternational/validation`
- **Auth**: Supabase SSR Auth (`lib/supabase/server.ts`)

---

## Directory Structure

```text
apps/web/
├── app/                    # Next.js App Router
│   ├── (app)/              # Protected routes (authenticated)
│   ├── actions/            # Server Actions (mutations)
│   ├── api/                # API routes
│   ├── login/              # Public auth pages
│   ├── signup/
│   ├── onboarding/
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Landing / redirect
├── components/             # UI components
│   ├── ui/                 # Design system primitives
│   ├── forms/              # Form components
│   ├── branding/           # Brand elements
│   └── [module]/           # Module-specific components
├── lib/                    # Core utilities
│   ├── supabase/           # Supabase clients (server/client/middleware)
│   ├── dal.ts              # Data Access Layer
│   ├── queries/            # Server-side query functions
│   ├── audit.ts            # Audit logging
│   └── utils.ts            # Shared utilities
├── public/                 # Static assets
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## Web-Specific Rules

### 1. Server Components First

- **Default to RSC**. Only add `'use client'` when the component genuinely needs browser APIs, event handlers, or hooks.
- `'use client'` components must be **leaf nodes** — never wrap a server component tree.
- Data fetching happens in server components or server actions, never in client components via `fetch`.

### 2. Data Access Layer (DAL)

- All server-side data reads go through `lib/dal.ts` or `lib/queries/*`.
- The DAL creates authenticated Supabase clients per-request.
- **Never** import `createClient` directly in components — use DAL functions.
- **Never** use `SELECT *` — always specify exact columns.

### 3. Server Actions for Mutations

- All database writes go through `app/actions/*`.
- Every server action MUST:
  1. Authenticate the user (`getUser()` or equivalent)
  2. Authorize the action (check role via `@reachinternational/permissions`)
  3. Validate input (Zod schema from `@reachinternational/validation`)
  4. Execute the database operation
  5. Revalidate affected cache tags
  6. Return typed success/error response
- **Never** put mutation logic in API routes when a server action suffices.

### 4. Routing & Layout

- Protected routes live under `app/(app)/` with middleware auth checks.
- Public routes (login, signup, landing) live at `app/` root.
- Use `AI/ROUTING_MAP.md` to identify existing routes before creating new ones.
- Route groups use parenthesized names: `(app)`, `(auth)`, etc.

### 5. Component Architecture

- **Check `components/ui/*` first** before creating any UI primitive.
- Module-specific components go in `components/[module]/`.
- Follow the Geist Design System tokens from `DESIGN.md` and `AI/RULES/DESIGN-SYSTEM.md`.
- Every component must support 3-tier responsive viewports:
  - Mobile (≤640px): Touch-optimized cards, `block sm:hidden`
  - Tablet (641–1023px): 2-column grids, adaptive modals
  - Desktop (≥1024px): Full tables, multi-column layouts, hover tooltips

### 6. Error Handling & States

- Use `error.tsx` boundary files at route level.
- Every data-driven page must handle: loading (skeleton), empty, error, and data states.
- Toast notifications for action feedback (success/error).
- Confirmation dialogs before destructive actions.

### 7. Performance

- Use `next/image` with explicit dimensions for all images.
- Dynamic imports (`next/dynamic`) for heavy client components.
- Parallel data fetching with `Promise.all()` in server components.
- Tag-based cache revalidation (`revalidateTag`) over path-based.
- No N+1 query patterns — batch or join at the database level.

### 8. Build & Verification Commands

```bash
# TypeScript check
pnpm --filter @reachinternational/web exec tsc --noEmit

# Lint
pnpm --filter @reachinternational/web lint

# Build
pnpm --filter @reachinternational/web build

# Full monorepo typecheck
pnpm typecheck
```

### 9. Web-Specific Prohibitions

- **NEVER** use `useEffect` for data fetching — use server components or server actions.
- **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` in client components.
- **NEVER** use `router.push()` for server-side redirects — use `redirect()` from `next/navigation`.
- **NEVER** create a new page without adding it to `AI/ROUTING_MAP.md`.
- **NEVER** skip middleware auth checks for protected routes.
- **NEVER** import from `apps/mobile` into `apps/web`.
