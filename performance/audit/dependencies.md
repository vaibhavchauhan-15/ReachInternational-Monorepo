# Package & Dependency Audit (Phase 1)

> **SCOPE**: Audit of root `package.json`, `apps/web/package.json`, `apps/mobile/package.json`, and all 7 shared packages in `packages/*`.

---

## 1. Monorepo Dependency Graph & Protocol

ReachInternational enforces strict one-way DAG layering:
- `apps/web` & `apps/mobile` ──► `@reachinternational/*` shared packages ──► Foundation Packages
- Shared packages **never** import from applications.
- Server-only modules (`@sendgrid/mail`, `twilio`, `@upstash/qstash`) are strictly protected by `import "server-only";` guards.

---

## 2. Web Application Dependencies Audit (`apps/web/package.json`)

| Package Name | Version | Role / Purpose | Execution Boundary | Bundle Size Estimate | Potential Risk / Optimization | Priority |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: |
| `framer-motion` | `12.43.0` | UI animations & transitions | Client | ~120 KB | Core UI engine; verify tree-shaking | 🟡 P2 |
| `recharts` | `3.10.1` | Analytics charts & metrics | Client | ~240 KB | Heavy charting library; **must always be dynamically imported (`next/dynamic`)** | 🟠 P1 |
| `xlsx` | `0.18.5` | Excel workbook generation | Client | ~150 KB | Heavy spreadsheet library; should only load on export click | 🟠 P1 |
| `lucide-react` | `1.28.0` | Icon system | Universal | Tree-shaken | Uses Next.js `optimizePackageImports` | 🟢 P3 |
| `@supabase/ssr` / `@supabase/supabase-js` | `0.12.4` / `2.111.0` | Database & Auth client | Universal | ~45 KB | Core client; authenticated SSR | 🟢 P3 |
| `@base-ui/react` | `1.6.0` | Unstyled accessible UI primitives | Universal | ~30 KB | Base UI components | 🟢 P3 |
| `@sendgrid/mail` | `8.1.6` | Transactional email delivery | **Server Only** | Server Node.js | Guarded with `import "server-only"` | 🟢 P3 |
| `twilio` | `6.0.2` | SMS & WhatsApp notifications | **Server Only** | Server Node.js | Guarded with `import "server-only"` & lazy client | 🟢 P3 |
| `@upstash/qstash` | `2.11.3` | Scheduled background jobs | **Server Only** | Server Node.js | Guarded with `import "server-only"` | 🟢 P3 |
| `zod` | `4.4.3` | Schema validation | Universal | ~15 KB | Standard monorepo validation | 🟢 P3 |

---

## 3. Shared Packages Audit (`packages/*`)

| Package | Workspace Protocol | Export Barrels | Dependencies | Server Code Contamination? |
| :--- | :--- | :--- | :--- | :---: |
| `packages/types` | `workspace:*` | `src/index.ts` | None | **None** (Pure TypeScript interfaces) |
| `packages/validation` | `workspace:*` | `src/index.ts` | `zod` | **None** (Pure Zod schemas) |
| `packages/permissions` | `workspace:*` | `src/index.ts` | None | **None** (Pure in-memory RBAC) |
| `packages/design-tokens`| `workspace:*` | `src/index.ts` | None | **None** (CSS color/spacing tokens) |
| `packages/utils` | `workspace:*` | `src/index.ts` | None | **None** (Pure string/sanitization helpers) |
| `packages/api-client` | `workspace:*` | `src/index.ts` | `@supabase/supabase-js` | **None** (Client interface definitions) |
| `packages/config` | `workspace:*` | `src/index.ts` | None | **None** (Shared constants) |

---

## 4. Major Dependency Insights

1. **Clean Shared Packages**: Zero Node.js server secrets, fs modules, or database credentials exist inside `packages/*`. All shared packages are pure, lightweight, and universal.
2. **Next.js Package Optimization**: `next.config.ts` includes `optimizePackageImports: ["lucide-react", "@base-ui/react", "recharts"]`, ensuring Next.js Turbopack tree-shakes unused icons and components.
3. **Heavy Client Packages**: `recharts` and `xlsx` represent the largest potential bundle bloat in `apps/web`. Both must be strictly restricted to dynamic imports.
