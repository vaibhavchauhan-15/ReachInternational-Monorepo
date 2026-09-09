# Technology Stack

**Analysis Date:** 2026-09-09

## Languages

**Primary:**
- TypeScript 5.x (`typescript ^5` in `apps/web`, `^5.0.0` in `apps/mobile`, strict mode across `packages/*`) - Used for all application code, server actions, DAL queries, domain packages, and mobile screens.

**Secondary:**
- JavaScript (Node.js ESM/CJS, `.mjs` / `.cjs`) - Used for database verification scripts (`supabase/verify_seed.mjs`), test suites (`supabase/tests/*.mjs`), and tooling shims.
- SQL (PostgreSQL PL/pgSQL) - Database migrations, table definitions, RLS policies, indexes, and triggers (`supabase/migrations/*.sql`).

## Runtime

**Environment:**
- Node.js 20.x+ (LTS) - Server runtime for Next.js 16 server actions, RSC, and monorepo scripts.
- React Native 0.81.5 / Hermes Engine - Mobile runtime executed via Expo 54 (`apps/mobile`).
- Modern Evergreen Browsers (Chrome, Firefox, Safari, Edge) - Client web runtime for `apps/web`.

**Package Manager:**
- pnpm 11.21.0 (configured via `packageManager: "pnpm@11.21.0"` in root `package.json`).
- Workspace management via `pnpm-workspace.yaml` covering `apps/*` and `packages/*`.
- Lockfile: `pnpm-lock.yaml` present and strictly locked.

## Frameworks

**Core:**
- Next.js 16.2.12 (`apps/web`) - App Router, React Server Components (RSC), Server Actions (`bodySizeLimit: 1mb`), route handlers, custom proxying, dynamic/static route streaming.
- React 19.2.4 (`apps/web`) - Core web UI rendering with concurrent features (`useTransition`, `useOptimistic`).
- Expo 54.0.0 (`apps/mobile`) with `expo-router` ~6.0.24 - File-based routing and native device access (`expo-secure-store`, `expo-constants`).
- React Native 0.81.5 (`apps/mobile`) - Native cross-platform mobile UI.

**Testing:**
- Node.js Test Matrix & Custom Asserters (`supabase/tests/*.mjs`) - Integration test suites for shift timing, breakdown logic, overlap prevention, and operator permissions.
- TypeScript Compilation Gate (`tsc --noEmit` across all workspace packages via `turbo run typecheck`).

**Build & Dev Tooling:**
- Turborepo 2.10.11 (`turbo.json`) - Pipeline task runner caching `build`, `lint`, and `typecheck` across packages.
- Tailwind CSS v4 (`@tailwindcss/postcss` ^4) - Modern CSS engine for web interface.
- Babel 7.25.2 (`apps/mobile`) - Metro bundling for Expo/React Native.

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` ^2.111.0 & `@supabase/ssr` ^0.12.4 - Relational database access, Supabase Auth SSR cookies, Row Level Security (RLS), and Realtime.
- `zod` ^4.4.3 (Web & `@reachinternational/validation`), `zod` ^3.23.8 (Mobile) - Type-safe schema validation for form submissions, API routes, and Server Actions.
- `@tanstack/react-query` ^5.66.0 (`apps/mobile`) - Asynchronous server-state hydration, caching, and background refetching on mobile.
- `framer-motion` ^12.43.0 (`apps/web`) - Fluid page transitions, modal spring physics, and animated interactive elements.
- `recharts` ^3.10.1 (`apps/web`) - Operational telemetry visualization, hour meter breakdown charts, and executive KPI trendlines.
- `xlsx` ^0.18.5 (`apps/web`) - Excel spreadsheet generation and report downloads for machine logs, users directory, and financial audits.

**UI & Component Libraries:**
- `@radix-ui/react-dialog` & `@radix-ui/react-tooltip` - Accessible dialog modals, sheets, and hover tooltips (`apps/web`).
- `lucide-react` ^1.28.0 & `lucide-react-native` ^0.475.0 - Iconography across desktop and mobile platforms.
- `class-variance-authority`, `clsx`, `tailwind-merge` - Dynamic CSS class generation adhering to design system tokens.
- `tw-animate-css` ^1.4.0 - Utility CSS animations.

**Infrastructure & Communications:**
- `@upstash/qstash` ^2.11.3 - Distributed scheduling and serverless cron orchestration for automated maintenance alerts.
- `twilio` ^6.0.2 - SMS notifications and WhatsApp message templates for field technicians.
- `@sendgrid/mail` ^8.1.6 - Transactional email notifications and service reports.

## Configuration

**Monorepo & Build:**
- Root `package.json` - Defines monorepo scripts (`turbo run dev`, `turbo run build`, `turbo run typecheck`, `verify:seed`).
- `pnpm-workspace.yaml` - Defines workspaces (`apps/*`, `packages/*`) and dependency build allowances (`sharp`, `unrs-resolver`).
- `turbo.json` - Defines task pipeline dependencies (`^build`, `^typecheck`, `^lint`).
- `apps/web/next.config.ts` - Custom security headers (CSP, HSTS, Permissions-Policy, X-Frame-Options), package import optimizations, and asset caching.
- `apps/web/tsconfig.json` & `apps/mobile/tsconfig.json` - Strict TypeScript configurations with `@/*` path mapping.

**Environment Variables:**
- Web Client (`apps/web/.env.local`):
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Supabase anonymous public key
  - `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` - Backend administrative database key (restricted to server-side code)
  - `NEXT_PUBLIC_APP_URL` - Canonical public web domain URL
  - `NEXT_PUBLIC_APP_VERSION` - Active release identifier
- Microservices & Integrations:
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` - Rate limiting and caching
  - `CRON_SECRET`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` - QStash cron trigger authentication
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_NUMBER`, `TWILIO_WHATSAPP_NUMBER`, `TWILIO_CONTENT_SID` - Twilio gateway
  - `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME` - SendGrid email transport

## Platform Requirements

**Development:**
- OS: Windows, macOS, Linux (cross-platform compatible).
- Runtime requirements: Node.js 20+, pnpm 11.21.0.
- Mobile development: Expo Go or Android Studio / Xcode native simulator runtimes.
- Database: Cloud Supabase instance or local Supabase Docker engine.

**Production:**
- Web Target: Vercel / Node.js 20+ containerized environment.
- Mobile Target: Android (.apk/.aab) and iOS (.ipa) packaged through Expo EAS Build.
- Database: Supabase Managed PostgreSQL 15+ with pg_trgm, RLS, and security definer RPC functions.

---

*Stack analysis: 2026-09-09*
*Update after major dependency changes*
