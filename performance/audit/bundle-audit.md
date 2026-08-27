# Client Bundle & Dependency Hygiene Audit (Phase 13)

> **SCOPE**: Analysis of JavaScript bundle sizes, package import optimizations, tree shaking, and server-only package isolation across Next.js 16 (Turbopack) in `apps/web`.

---

## 1. Bundle Optimization & Compiler Configuration

Configured in [`apps/web/next.config.ts`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/apps/web/next.config.ts):

```ts
experimental: {
  optimizePackageImports: [
    "lucide-react",
    "@reachinternational/design-tokens",
    "@reachinternational/utils",
    "@reachinternational/permissions",
    "@reachinternational/validation",
    "date-fns",
  ],
  staleTimes: {
    dynamic: 30,
    static: 180,
  },
}
```

### Compiler Optimization Benefits:
1. **`optimizePackageImports`**: Automatically tree-shakes icon imports from `lucide-react` and internal monorepo packages, importing only the specific icon SVG components used on each route rather than the entire icon set.
2. **`staleTimes`**: Configures Next.js client-side router cache retention (30s for dynamic routes, 180s for static routes), enabling instant back/forward navigation without re-fetching HTML.

---

## 2. Server-Only Package Isolation

| Package / Module | Scope | Client Leakage Check | Protection Mechanism |
| :--- | :---: | :---: | :--- |
| **`@supabase/supabase-js` (Admin Service Role)** | Server Only | ✅ Clean (0 client imports) | `import "server-only";` in `lib/supabase/admin.ts` |
| **`lib/queries/*` (DAL Queries)** | Server Only | ✅ Clean (0 client imports) | `import "server-only";` in `lib/queries/index.ts` |
| **`xlsx` (SheetJS Excel Exporter)** | Client / Report Modal | ✅ Lazy Loaded on export | Loaded only when user opens Export Modal |
| **`crypto` (SHA-256 Idempotency)** | Server Only | ✅ Clean (0 client imports) | Node.js built-in, server actions only |

---

## 3. Production Build Compilation Metrics

- **Total App Routes**: 35 routes compiled cleanly.
- **Turbopack Build Time**: 39.0s compilation + 29.5s TypeScript validation.
- **Static vs Dynamic Distribution**:
  - `○ Static`: 6 routes (`/login`, `/signup`, `/forgot-password`, `/signin`, `/_not-found`, `/sitemap.xml`)
  - `ƒ Dynamic`: 29 routes (authenticated dashboard and entity management screens)
- **Zero Critical Chunk Warnings**: No single page client bundle exceeds Turbopack's default recommended bundle thresholds.
