# Project Memory — ReachInternational (reachinternational.co.in)

## Core Overview
**ReachInternational** is an enterprise-grade industrial machine running logs, operator shift entries, machinery fleet management, and client operations tracking platform built for Super Admins, Admins, Managers, Supervisors, HR, and Operators.

## Technology Stack
- **Framework**: Next.js 16.2 (App Router - `apps/web`), Expo SDK 58 React Native (`apps/mobile`), Turborepo monorepo
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

## Date-Independent Operator Shift Architecture (Phases 0-6 Rollout)
- **Effective-Dated Ranges**: Table `operator_machine_assignments` uses `valid_from` (DATE) and `valid_to` (DATE, NULL = open/ongoing).
- **Default Carry-Forward**: An open assignment (`valid_to IS NULL`) automatically carries forward indefinitely without requiring daily reassignment rows.
- **Historical Immutability**: Modifying or ending an assignment today closes the range (`valid_to = yesterday`) and opens a new range (`valid_from = today`). Past days' assignments and logs are 100% immutable.
- **7-Day Rolling Window (IST)**: Operators can view and submit shift entries for the last 7 calendar days (`[today_ist - 6, today_ist]`) based strictly on `Asia/Kolkata` time.
- **Read-Time Status Derivation**: `get_shift_tasks()` dynamically derives pending/entered states by `LEFT JOIN` between assignment ranges and logs over the 7-day window. No synthetic pending rows are stored in the database.
- **Authoritative Foreign Key**: `machine_hour_logs.assignment_id` references the specific assignment range covering that `log_date`.
- **Overlap Prevention**: Enforced at the database engine level via `btree_gist` exclusion constraint `ex_oma_no_overlapping_shifts` (`[valid_from, COALESCE(valid_to, '9999-12-31'::date)]`).
- **Offline Resilience**: Offline entries store `machine_id`, `operator_id`, `log_date`, `shift_code`, and `idempotency_key`. On sync, the server resolves `assignment_id` from the valid range on `log_date`. Expired mutations (> 7 days) fail cleanly without retry loops.
- **Storage Efficiency**: Requires ~5,500 rows/yr for 5,000 operators vs 1,825,000 rows/yr for daily rows (99.7% reduction in row count and storage).

## Push Notification & Alert System Architecture
- **Unified Inbox & Outbox**: `public.notifications` serves as both in-app notification inbox and transactional outbox.
- **Delivery Channels**: Dual delivery pipelines supporting Expo SDK 58 Push Notifications (`expo-server-sdk`) for native mobile (`apps/mobile`) and Web Push API (`web-push`, VAPID, `/sw.js`) for browser desktop/mobile (`apps/web`).
- **Sub-Second Fast-Path Dispatch**: Database trigger `trg_notifications_fastpath` leverages `pg_net` to invoke Next.js route `/api/notify/dispatch` asynchronously on high/critical notifications, backed by a 1-minute `pg_cron` sweeper (`push_notifications_sweeper`).
- **High Concurrency & Fault Tolerance**: Dispatcher claims notification batches via `claim_push_batch` using `FOR UPDATE SKIP LOCKED`, reclaiming abandoned leases after 2 minutes. Status updates (`finish_push_batch`) support exponential retry backoff and automatic token deactivation on `DeviceNotRegistered` receipts.
- **Shift Reminder Ladder**: 4 automated `pg_cron` scanners drive shift entry adherence within the 7-day retrospective logging window (`[today_IST - 6, today_IST]`):
  - `SP1-s1` & `SP1-s2`: Shift end + 15m and +90m prompt for closing hour meter.
  - `SP2`: Daily 09:00 IST morning digest of pending shifts.
  - `SL1`: Daily 18:00 IST final lock warning (critical priority) for shifts expiring at midnight.
  - `SUP1`: Daily 09:30 IST supervisor digest of team members with aged pending shifts (≥ 3 days).
- **Producers & Zero-PII Security**: Triggers on `machine_hour_logs` (`BD1` breakdown, `AS1` assisted entry), `machines` (`EM1` maintenance), `operator_machine_assignments` (`SA1`), `users` (`REG1`), and `quote_requests` (`ENQ1`). Server Actions dispatch `SEC1` (security alerts, always-on) and `PAY1` (payroll statement updates, zero PII).
- **Role-Aware Preference Sync**: Synchronized across Web and Native Mobile via `public.user_notification_preferences` with quiet-hours deferral (IST) and 5/day non-critical capping.

## Fundamental Architectural Rules
1. **Memory First**: Always check `AI/PROJECT_MEMORY.md`, `AI/STATE.md`, and `AI/CURRENT_TASK.md` before reading code.
2. **Selective File Inspection**: Use `AI/FILE_INDEX.md` to locate and read ONLY the relevant files for a task.
3. **Design System, Reusable Components First & 100% Responsive UI Rule**: All web and mobile UI developments MUST strictly adhere to root `DESIGN.md` (Vercel Geist System: `#171717` ink, `#fafafa` canvas, `#ffffff` elevated, `#ebebeb` 1px hairline border, Reach sky blue `#0284c7` / `#0ea5e9`, Geist Sans/Mono fonts), `AI/RULES/DESIGN-SYSTEM.md`, `AI/RULES/UI-UX.md`, and `.agents/rules/web_mobile_ui_consistency.md`. Every component, UI primitive, and element MUST be reusable: always inspect existing components (`components/ui/*`, `components/forms/*`, `components/branding/*`) first before creating new ones. Every page, component, and module across both Web and Mobile must maintain 100% consistent typography, font sizes, line heights, border radii, colors, spacing tokens, touch targets (min 44px), and tactile haptics, looking identical in design, color, and theme across viewports.
4. **Monorepo Layering & DAG Rules**: Enforce one-way dependency flow (`apps/*` → `shared domain packages` → `foundation packages`). Never import from apps into packages or introduce circular dependencies. See root `ARCHITECTURE.md` and `AI/RULES/ARCHITECTURE.md`.
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
17. **Strict AI Agent Rule Compliance**: All AI coding agents developing in this monorepo MUST read, strictly follow, and enforce all 15 authoritative engineering rules in `AI/RULES/` (including `WEB-MOBILE-PARITY.md`), cross-platform UI rules in `.agents/rules/` (`web_mobile_parity.md`, `native_backend_architecture.md`, `web_mobile_ui_consistency.md`), and agent skills in `.agents/skills/` (`web-mobile-parity`, `native-backend-architecture`) without exception.
18. **Persistent State Updates**: After completing a task, update `AI/STATE.md`, `AI/CHANGELOG_AI.md`, `AI/CURRENT_TASK.md`, and affected feature docs in `AI/FEATURES/`.
19. **README Synchronization**: When adding or modifying a new feature, role, module, or database schema, always update `README.md` so project documentation remains fully synchronized.
20. **Supabase Environment Isolation Rule**: Organization: `ljzofzlvjtfiqoffaaua`. Development Project: `vlmxciuogczumumrwyot` (`Reach International Dev`). Production Project: `dhbbgfzbyatzvqafnsqp` (`Reach International Production`). During development, testing, schema evolution, and seeding, all migrations, SQL executions, and procedures MUST STRICTLY TARGET `vlmxciuogczumumrwyot`. Modifying, running migrations on, or executing SQL against Production (`dhbbgfzbyatzvqafnsqp`) during development is STRICTLY FORBIDDEN.
