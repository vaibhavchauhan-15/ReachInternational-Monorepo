# Project Memory — ReachInternational (reachinternational.co.in)

## Core Overview
**ReachInternational** is an enterprise-grade industrial machine running logs, operator shift entries, machinery fleet management, and client operations tracking platform built for Super Admins, Admins, Managers, Supervisors, HR, and Operators.

## Technology Stack
- **Framework**: Next.js 16.2 (App Router - `apps/web`), Expo SDK 57 React Native (`apps/mobile`), Turborepo monorepo
- **Language**: TypeScript 5 (Strict Mode)
- **UI Library**: React 19.2 (Web), React Native / Expo (Mobile), Tailwind CSS v4, Base UI, Lucide Icons, Recharts
- **Animations**: Framer Motion 12, TW Animate CSS
- **Database & Auth**: Supabase PostgreSQL, Supabase SSR Auth, Row Level Security (RLS)
- **Shared Packages (`packages/*`)**: `@reachinternational/types`, `@reachinternational/validation`, `@reachinternational/permissions`, `@reachinternational/design-tokens`, `@reachinternational/utils`
- **Validation & State**: Zod v4, Server Actions, React Server Components (RSC) + Data Access Layer (DAL), TanStack Query (Mobile)

## Canonical User Roles (Strictly 6 Roles Monorepo-Wide)
1. **super_admin**: Full platform control, tenant isolation, security enforcement, global oversight.
2. **admin**: Global organizational management, user administration, fleet and client management.
3. **manager**: Operational management, shift review, equipment allocation, and personnel oversight.
4. **supervisor**: Site-level coordination, equipment supervision, direct operator assignment management.
5. **hr**: Human resources, personnel lifecycle, profile change requests, user records management.
6. **operator**: Daily machine operation, HMR meter logging (`/operations?tab=entry`), shift execution.

## Fundamental Architectural Rules
1. **Memory First**: Always check `AI/PROJECT_MEMORY.md`, `AI/STATE.md`, and `AI/CURRENT_TASK.md` before reading code.
2. **Selective File Inspection**: Use `AI/FILE_INDEX.md` to locate and read ONLY the relevant files for a task.
3. **Design System & Responsive UI Rule**: All web and mobile UI developments MUST strictly adhere to `DESIGN.md` (Vercel Geist System: `#171717` ink, `#fafafa` canvas, `#ffffff` elevated, `#ebebeb` 1px hairline border, `#0070f3` link blue, Geist Sans/Mono fonts), `AI/RULES/DESIGN-SYSTEM.md`, `AI/RULES/UI-UX.md`, and `AI/UI_RULES.md` / `.agents/rules/responsive_cross_platform_design.md`. Every page, component, and module must be 3-tier optimized for Mobile (≤640px touch card reflow `block sm:hidden`, scroll toolbars), Tablet (641px–1023px 2-col grid), and Desktop (≥1024px high-density tables `hidden sm:block`, hover tooltips `<TooltipWrapper>`), looking identical in design, color, and theme across viewports.
4. **Monorepo Layering & DAG Rules**: Enforce one-way dependency flow (`apps/*` → `shared domain packages` → `foundation packages`). Never import from apps into packages or introduce circular dependencies. See `AI/RULES/ARCHITECTURE.md` and `AI/ARCHITECTURE.md`.
5. **Canonical Barrels & Import Scoping**: Import only through canonical export barrels (`index.ts`). Deep internal imports into package source files are prohibited.
6. **DAL for Data Access**: Server Data fetching must use `lib/dal.ts` or `lib/queries/*`.
7. **Server Actions for Mutations**: All database updates go through `app/actions/*` with authorization checks and canonical Zod validation.
8. **Architectural Change Control**: Choose the smallest correct change. Do not refactor unnecessarily. Maintain zero type errors across all 9 workspace projects (`pnpm typecheck`).
9. **Performance & Optimization Rule**: All features, queries, and components MUST adhere strictly to `AI/RULES/PERFORMANCE.md` and `AI/PERFORMANCE_RULES.md` (no `SELECT *`, parallel async queries via `Promise.all()`, RSC by default, `'use client'` leaf node restriction, tag-based cache revalidation).
10. **Security, Authentication & Authorization Policy**: All authentication, session management, authorization, RBAC (`@reachinternational/permissions`), RLS policies, input validations (`@reachinternational/validation`), and audit logging (`lib/audit.ts`) MUST strictly follow `AI/RULES/SECURITY.md`, `AI/RULES/AUTHENTICATION-AUTHORIZATION.md`, and `AI/SECURITY_RULES.md`. Never expose `SUPABASE_SERVICE_ROLE_KEY` to client components.
11. **Data Protection & Privacy Policy**: Data processing MUST adhere to `AI/RULES/DATA-PROTECTION-PRIVACY.md` (explicit column projections, field PII masking, private storage buckets for confidential docs, scope-aware cache keys, audit logging).
12. **Validation, Error Handling & Resilience Policy**: Form inputs and API payloads MUST be validated using Zod (`@reachinternational/validation`); mutations MUST use PostgreSQL transactions (`BEGIN...COMMIT`), double-submission guards, loading skeletons, empty states, and toast notifications adhering to `AI/RULES/VALIDATION-ERROR-RESILIENCE.md`.
13. **Testing & Quality Assurance Policy**: Every change MUST satisfy the mandatory Quality Gate in `AI/RULES/TESTING-QA.md` (`pnpm typecheck` passing with 0 errors across 9 workspace packages, clean `pnpm build`, 3-tier viewport responsiveness, and RLS security verification).
14. **SEO, Metadata & Discoverability Policy**: Public routes MUST include canonical URLs, Next.js App Router metadata, and Open Graph previews adhering to `AI/RULES/SEO-METADATA-DISCOVERABILITY.md`; private operational pages (`/dashboard`) MUST enforce `noindex, nofollow` headers.
15. **Observability, Monitoring & Logging Policy**: Elevated mutations MUST trigger structured audit logging via `logAudit()` in `lib/audit.ts` adhering to `AI/RULES/OBSERVABILITY-MONITORING-LOGGING.md`; passwords, auth tokens, and PII MUST BE REDACTED prior to logging; production debugging console.log calls are FORBIDDEN.
16. **Deployment, DevOps & Release Policy**: Releases MUST complete multi-stage deployment validation adhering to `AI/RULES/DEPLOYMENT-DEVOPS-RELEASE.md` (`pnpm typecheck`, `pnpm build`, `pnpm verify:seed`, lockfile locking `pnpm@11.21.0`, zero secret leakage, RLS preservation, and post-release smoke testing); `SUPABASE_SERVICE_ROLE_KEY` exposure or destructive database drops are FORBIDDEN.
17. **Strict AI Agent Rule Compliance**: All AI coding agents developing in this monorepo MUST read, strictly follow, and enforce all 12 authoritative engineering rules in `AI/RULES/` AND all cross-platform UI rules in `.agents/rules/` without exception.
18. **Persistent State Updates**: After completing a task, update `AI/STATE.md`, `AI/CHANGELOG_AI.md`, `AI/CURRENT_TASK.md`, and affected feature docs in `AI/FEATURES/`.
19. **README Synchronization**: When adding or modifying a new feature, role, module, or database schema, always update `README.md` so project documentation remains fully synchronized.
20. **Supabase Environment Isolation Rule**: Organization: `ljzofzlvjtfiqoffaaua`. Development Project: `vlmxciuogczumumrwyot` (`Reach International Dev`). Production Project: `dhbbgfzbyatzvqafnsqp` (`Reach International Production`). During development, testing, schema evolution, and seeding, all migrations, SQL executions, and procedures MUST STRICTLY TARGET `vlmxciuogczumumrwyot`. Modifying, running migrations on, or executing SQL against Production (`dhbbgfzbyatzvqafnsqp`) during development is STRICTLY FORBIDDEN.
