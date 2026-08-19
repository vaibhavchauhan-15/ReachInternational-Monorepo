# Project Memory — ServiceCentric (reachinternation.com)

## Core Overview
**ServiceCentric** is an enterprise-grade industrial machine service, maintenance tracking, and notification management platform built for Service Managers, Engineers, and Clients.

## Technology Stack
- **Framework**: Next.js 16.2 (App Router - `apps/web`), Expo React Native (`apps/mobile`), Turborepo monorepo
- **Language**: TypeScript 5 (Strict Mode)
- **UI Library**: React 19.2 (Web), React Native / Expo (Mobile), Tailwind CSS v4, Base UI, Lucide Icons, Recharts
- **Animations**: Framer Motion 12, TW Animate CSS
- **Database & Auth**: Supabase PostgreSQL, Supabase SSR Auth, Row Level Security (RLS)
- **Notification Services**: SendGrid Mail API, Twilio (SMS/WhatsApp), Upstash QStash (Scheduled Jobs/Queues)
- **Shared Packages (`packages/*`)**: `@servicecentric/types`, `@servicecentric/validation`, `@servicecentric/permissions`, `@servicecentric/design-tokens`, `@servicecentric/api-client`, `@servicecentric/utils`, `@servicecentric/config`
- **Validation & State**: Zod v4, Server Actions, React Server Components (RSC) + Data Access Layer (DAL), TanStack Query (Mobile)

## Key User Roles (RBAC)
1. **admin** (Super Admin): Full system control, user management, global configuration.
2. **service_manager**: Manages assigned client accounts, machines, service schedules, and notifications.
3. **engineer**: Field operations, update machine status, log completed services, upload reports.
4. **client**: View owned machines, service histories, and notification preferences.

## Fundamental Architectural Rules
1. **Memory First**: Always check `AI/PROJECT_MEMORY.md`, `AI/STATE.md`, and `AI/CURRENT_TASK.md` before reading code.
2. **Selective File Inspection**: Use `AI/FILE_INDEX.md` to locate and read ONLY the relevant files for a task.
3. **Monorepo Layering & DAG Rules**: Enforce one-way dependency flow (`apps/*` → `shared domain packages` → `foundation packages`). Never import from apps into packages or introduce circular dependencies. See `AI/ARCHITECTURE.md`.
4. **Canonical Barrels & Import Scoping**: Import only through canonical export barrels (`index.ts`). Deep internal imports into package source files are prohibited.
5. **DAL for Data Access**: Server Data fetching must use `lib/dal.ts` or `lib/queries/*`.
6. **Server Actions for Mutations**: All database updates go through `app/actions/*` with authorization checks and canonical Zod validation.
7. **Architectural Change Control**: Choose the smallest correct change. Do not refactor unnecessarily. Maintain zero type errors across all 9 workspace projects (`pnpm typecheck`).
8. **Persistent State Updates**: After completing a task, update `AI/STATE.md`, `AI/CHANGELOG_AI.md`, `AI/CURRENT_TASK.md`, and affected feature docs in `AI/FEATURES/`.
9. **README Synchronization**: When adding or modifying a new feature, role, module, or database schema, always update `README.md` so project documentation remains fully synchronized.
