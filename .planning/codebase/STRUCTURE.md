# Codebase Structure

**Analysis Date:** 2026-09-09

## Directory Layout

```
ReachInternational-Monorepo/
├── apps/
│   ├── web/                    # Next.js 16.2 web application (App Router, RSC, Server Actions)
│   └── mobile/                 # Expo 54 / React Native 0.81 cross-platform mobile application
├── packages/
│   ├── design-tokens/          # Shared Vercel Geist design system tokens & variables
│   ├── permissions/            # Shared RBAC role definitions, matrices & access guards
│   ├── types/                  # Canonical database row types & shared domain models
│   ├── utils/                  # Cross-platform utility functions, formatters & math helpers
│   └── validation/             # Shared Zod validation schemas for forms & mutations
├── supabase/
│   ├── migrations/             # 58 sequential PostgreSQL migrations & RLS policies
│   ├── tests/                  # Node.js integration test suites for DB logic & RPCs
│   ├── scripts/                # Database execution & seeding helper scripts
│   └── verify_seed.mjs         # Monorepo seed verification runner
├── .agents/
│   ├── rules/                  # Cross-platform UI rules & multi-agent engineering rules
│   └── skills/                 # Agent capability skills (e.g., Supabase best practices)
├── AI/
│   ├── RULES/                  # 14 authoritative engineering policy rule documents
│   ├── FEATURES/               # Granular functional specifications for each module
│   ├── PROJECT_MEMORY.md       # Long-term persistent project overview & tech stack
│   ├── STATE.md                # Real-time state ledger, completed tasks & active focus
│   ├── CURRENT_TASK.md         # Active session task tracker & progress checklist
│   └── CHANGELOG_AI.md         # Chronological changelog of all AI engineering updates
└── .planning/
    ├── codebase/               # 7 structured codebase map reference documents
    └── onboarding/             # Onboarding summaries & project setup metadata
```

## Directory Purposes

**`apps/web/`:**
- Purpose: Primary enterprise web application for desktop, tablet, and mobile browsers.
- Contains:
  - `app/(app)/`: Authenticated operational routes (`dashboard`, `machines`, `operations`, `users`, `audit`, `finance`, `inventory`, `hr`, `crm`, `rentals`, `tasks`, `notifications`).
  - `app/(auth)/` & `app/(public)/`: Public authentication and marketing pages (`login`, `signup`, `forgot-password`, `reset-password`, `about`, `contact`).
  - `app/actions/`: Audited Next.js Server Actions executing data mutations.
  - `app/api/`: Route handlers for health checks, webhooks, and QStash scheduled crons.
  - `components/`: UI design system (`components/ui/*`), domain-specific feature widgets (`components/machines/*`, `components/operations/*`, etc.), and layouts (`components/layout/*`).
  - `lib/`: Data access layer (`lib/dal.ts`), domain queries (`lib/queries/*`), Supabase clients (`lib/supabase/*`), caching engine (`lib/cache.ts`), and audit logger (`lib/audit.ts`).

**`apps/mobile/`:**
- Purpose: Mobile application optimized for field technicians, machine operators, and mobile supervisors.
- Contains:
  - `app/(app)/`: Expo Router screen definitions (`dashboard.tsx`, `machines.tsx`, `operations.tsx`, `users.tsx`, `profile.tsx`).
  - `app/(auth)/`: Mobile login, signup, and password reset screens.
  - `components/`: Native touch components, bottom sheet modals, time pickers, and mobile user cards.
  - `lib/`: Mobile Supabase client with secure storage, React Query providers, and utility helpers.

**`packages/*` (Shared Monorepo Libraries):**
- Purpose: Platform-agnostic domain logic and foundation utilities shared across web and mobile.
- Sub-packages:
  - `packages/types/src/index.ts`: TypeScript entity interfaces (`User`, `Machine`, `HourLog`, `RentalAgreement`, etc.).
  - `packages/permissions/src/index.ts`: RBAC roles (`ADMIN`, `OPERATOR`, etc.), permission checks (`hasPermission()`), and supervised role checkers.
  - `packages/validation/src/index.ts`: Zod schemas for all form and server action validations (`authSchema`, `machineLogSchema`, `userCreateSchema`).
  - `packages/design-tokens/src/index.ts`: Standardized color hex values, typography scales, spacing tokens, and border radii.
  - `packages/utils/src/index.ts`: Cross-platform date math, compact timing formatters, currency formatters, and text truncators.

**`supabase/`:**
- Purpose: Database migrations, security definer RPC functions, RLS policies, seed data, and DB test harnesses.
- Contains:
  - `migrations/*.sql`: Numbered SQL migration files tracking database evolution.
  - `tests/*.mjs`: Node.js test runners executing operational assertions directly against Supabase.
  - `verify_seed.mjs`: High-speed verification checking row counts across all database tables.

## Key File Locations

**Entry Points:**
- Web Root Layout: `apps/web/app/layout.tsx`
- Web Dashboard Shell: `apps/web/app/(app)/layout.tsx`
- Mobile Root Layout: `apps/mobile/app/_layout.tsx`
- Mobile Navigation Tabs: `apps/mobile/app/(app)/_layout.tsx`

**Configuration:**
- Monorepo Orchestration: `package.json`, `pnpm-workspace.yaml`, `turbo.json`
- Next.js Web Config: `apps/web/next.config.ts`, `apps/web/tsconfig.json`
- Mobile Expo Config: `apps/mobile/app.json`, `apps/mobile/tsconfig.json`
- Tailwind & CSS: `apps/web/app/globals.css`, `apps/web/postcss.config.mjs`

**Core Logic & Data Access:**
- Data Access Layer (DAL): `apps/web/lib/dal.ts`
- Domain Query Modules: `apps/web/lib/queries/*.ts`
- Server Action Mutations: `apps/web/app/actions/*.ts`
- Centralized Audit Logging: `apps/web/lib/audit.ts`
- Caching & Tags: `apps/web/lib/cache.ts`

**Design System & UI:**
- Canonical Table & Pagination: `apps/web/components/ui/Table.tsx`
- Modal & Confirmation Dialogs: `apps/web/components/ui/Modal.tsx`, `ConfirmationDialog.tsx`
- Form Pickers & Inputs: `apps/web/components/ui/CustomDatePicker.tsx`, `CustomTimePicker.tsx`, `SearchableSelect.tsx`
- App Navigation: `apps/web/components/layout/AppSidebar.tsx`, `MobileBottomNav.tsx`

## Naming Conventions

**Files & Directories:**
- Component Files: PascalCase (`MachineModal.tsx`, `OperatorDashboard.tsx`, `UserRow.tsx`).
- Utility & Action Files: kebab-case (`audit-helpers.ts`, `send-reminders.ts`, `operator-logs-export.ts`).
- Query Modules: kebab-case in `lib/queries/` (`machines.ts`, `operators.ts`, `audit-logs.ts`).
- Route Folders: kebab-case with Next.js route grouping `(app)/`, `(auth)/`.
- Migration Files: Sequential 3-digit prefix with descriptive snake_case (`056_add_user_supervisor_ids.sql`).

**Code Entities:**
- Functions & Server Actions: camelCase with descriptive verbs (`getUserList()`, `updateUserSupervisor()`, `submitOperatorLogAction()`).
- Types & Interfaces: PascalCase (`User`, `MachineRecord`, `AuditLogEntry`, `PaginationProps`).
- Constants & Enums: UPPER_SNAKE_CASE (`USER_ROLES`, `TAGS`, `CACHE_TIERS`).
- React Hooks: camelCase prefixed with `use` (`useTransition`, `useOptimistic`, `useDebounce`).

## Where to Add New Code

**Adding a New Feature / Module:**
1. **Database**: Create a new sequential migration in `supabase/migrations/NNN_feature_name.sql` defining tables, foreign keys, RLS policies, and composite indexes.
2. **Domain Types & Validation**: Add TypeScript interfaces to `packages/types/src/database.ts` and Zod validation schemas to `packages/validation/src/`.
3. **Data Access (DAL)**: Add query functions to `apps/web/lib/queries/<feature>.ts` using explicit column projections and `unstable_cache`.
4. **Mutations**: Add audited Server Actions to `apps/web/app/actions/<feature>.ts` verifying auth session, validating payload via Zod, and invoking `logAudit()`.
5. **Web Interface**:
   - Create route page in `apps/web/app/(app)/<feature>/page.tsx`.
   - Build client components in `apps/web/components/<feature>/` adhering to 3-tier viewport responsiveness (desktop table + mobile card list + `<Pagination />`).
6. **Mobile App Synchronization**:
   - Add corresponding screen to `apps/mobile/app/(app)/<feature>.tsx`.
   - Build touch-friendly card views and bottom sheet dialogs following the mandatory Web-to-Mobile sync rule.
7. **Documentation**: Update `README.md`, `AI/STATE.md`, `AI/CHANGELOG_AI.md`, and relevant doc in `AI/FEATURES/`.

---

*Structure analysis: 2026-09-09*
*Update after directory reorganizations or new package additions*
