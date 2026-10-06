# ReachInternational System Architecture Specification — `ARCHITECTURE.md`

> **AUTHORITATIVE ARCHITECTURAL SPECIFICATION FOR REACHINTERNATIONAL**  
> *This document establishes the official engineering architecture for the ReachInternational monorepo, encompassing the Web Application (`apps/web`), Native Mobile Application (`apps/mobile`), Shared Domain Packages (`packages/*`), Database & Auth Infrastructure (`supabase/`), and Data Access Layers.*

---

## 1. System Overview

**ReachInternational** (`reachinternational.co.in`) is an enterprise-grade industrial machinery fleet management, field service tracking, operator shift logging, client worksite monitoring, and heavy equipment ERP platform.

### Core Capabilities:
- **Equipment Fleet Matrix**: Real-time tracking of heavy machinery (excavators, loaders, backhoes, cranes), maintenance health, warranty, and rental statuses.
- **Operator Shift & HMR Meter Logging**: Daily hour meter (HMR) logging, multi-shift coordination (Morning, Evening, Night), and automated running hour computations.
- **Client Fleet Worksites**: Real-time machine deployment tracking across client sites (JK Paper, Saint Gobain, etc.).
- **Attendance & Personnel Operations**: Shift rostering, attendance verification, document management (Aadhaar, Driving License), and automated payroll generation.
- **Auditing & Telemetry**: Immutable audit trails, automated WhatsApp/SMS/Email notifications, and Sentry crash telemetry.

---

## 2. Monorepo Hierarchy & Dependency Graph (DAG)

The repository is organized as a high-performance **Turborepo monorepo** managed by **pnpm workspaces** (`pnpm@11.21.0`, `turbo@2.10.11`).

Dependencies flow **in one direction only**:

```text
                                [ APPLICATION CLIENTS LAYER ]
                    ┌───────────────────────────┴───────────────────────────┐
                    │                                                       │
         apps/web [@reachinternational/web]                    apps/mobile [@reachinternational/mobile]
    (Next.js 16.2 App Router, RSC, DAL, Actions)            (Expo SDK 57, React Native 0.86, Expo Router)
                    │                                                       │
                    └───────────────────────────┬───────────────────────────┘
                                                │
                                                ▼
                                    [ SHARED DOMAIN PACKAGES ]
    ┌──────────────────────────┬──────────────────────────┬──────────────────────────┬──────────────────────────┐
    │                          │                          │                          │                          │
 @reachinternational/      @reachinternational/      @reachinternational/      @reachinternational/      @reachinternational/
     api-client                validation                 permissions              design-tokens                config
(API Contracts & RPC)     (Zod Entity Schemas)       (6 Canonical Roles)       (Geist Tokens & Theme)     (Tooling & ESLint)
    │                          │                          │                          │                          │
    └──────────────────────────┴──────────────────────────┼──────────────────────────┴──────────────────────────┘
                                                          │
                                                          ▼
                                              [ FOUNDATION PACKAGES ]
                                ┌──────────────────────────────────────────────────┐
                                │                                                  │
                             @reachinternational/types                      @reachinternational/utils
                        (Database & Domain Interfaces)                 (Platform Helpers: Currency/Date)
                                │                                                  │
                                └──────────────────────────────────────────────────┘
                                                          │
                                                          ▼
                                              [ PERSISTENCE & BACKEND ]
                                ┌──────────────────────────────────────────────────┐
                                │       Supabase PostgreSQL (RLS, Migrations)      │
                                │       Supabase SSR Auth | Storage Buckets        │
                                └──────────────────────────────────────────────────┘
```

### Strict Monorepo Invariants:
1. **No Upward Dependencies**: Foundation packages (`types`, `utils`) MUST NEVER import from shared packages or applications.
2. **No Cross-App Imports**: `apps/web` and `apps/mobile` MUST NEVER import from each other.
3. **No Package Imports of Apps**: Packages MUST NEVER import from `apps/*`.
4. **Canonical Barrels Only**: All package imports MUST pass through the package root entrypoint (`index.ts`). Deep internal file paths are prohibited.

---

## 3. Web Application Architecture (`apps/web`)

The Web application is built on **Next.js 16.2 (App Router)** with **React 19.2** and **Tailwind CSS v4**.

```text
apps/web/
├── app/
│   ├── (app)/                  # Authenticated protected routes (Dashboard, Operations, Fleet, Users)
│   │   ├── layout.tsx          # Authenticated AppShell wrapper with server-side auth validation
│   │   ├── dashboard/          # Role-based dashboard command centers
│   │   ├── operations/         # Machine HMR running hour entry & history logs
│   │   ├── machines/           # Machinery fleet management & service records
│   │   ├── clients/            # Client directory & assigned worksite equipment
│   │   ├── users/              # Personnel directory, roles, and shift assignments
│   │   ├── attendance/         # Shift attendance roster & mark attendance
│   │   ├── payroll/            # Running hours computation & wage summary
│   │   └── settings/           # System preferences & security
│   ├── actions/                # Next.js Server Actions (all mutations, validations & revalidations)
│   ├── api/                    # Lightweight webhook handlers (QStash, cron triggers)
│   ├── login/                  # Public auth pages (Login, Signup, Forgot Password)
│   ├── onboarding/             # New user profile completion flow
│   └── globals.css             # Tailwind v4 theme & Geist CSS custom variables
├── components/
│   ├── ui/                     # Canonical UI primitives (EnterpriseTable, Button, Input, Modal, etc.)
│   ├── layout/                 # Shell chrome (AppShellClient, AppSidebar, MobilePageHeader)
│   ├── navigation/             # Manifest-driven BottomNav and MobileMenuDrawer
│   └── [module]/               # Domain components (operations, machines, clients, users, dashboard)
├── lib/
│   ├── dal.ts                  # Server Data Access Layer (session authentication & role gating)
│   ├── queries/                # Domain-specific server query functions
│   ├── supabase/               # Supabase SSR client factories (server, browser, admin)
│   ├── audit.ts                # Centralized mutation audit logging
│   └── utils.ts                # Web styling & helper utilities
```

### 3.1 Server Components First (RSC)
- Pages default to **React Server Components (RSC)** for zero client-bundle overhead, streaming, and direct database queries.
- `'use client'` is strictly confined to **leaf interactive components** (modals, form controls, charts, segmented toggles).

### 3.2 Data Access Layer (DAL) & Queries
- All server data reads go through `lib/dal.ts` or `lib/queries/*`.
- DAL functions create per-request authenticated Supabase clients via `@supabase/ssr` cookies.
- Queries project explicit columns (`SELECT id, name, ...`) and prohibit `SELECT *`.

### 3.3 Server Actions for Mutations
- Database mutations are executed exclusively via Server Actions (`app/actions/*`).
- Every Server Action executes the mandatory security pipeline:
  1. `getCurrentUser()` — Authenticate session.
  2. `hasRole()` / `hasPermission()` — Authorize role.
  3. `schema.safeParse()` — Validate input payload with canonical Zod schema.
  4. Database execution with error resilience.
  5. `logAudit()` — Structured audit trail.
  6. `revalidateTag()` / `revalidatePath()` — Targeted Next.js cache revalidation.

---

## 4. Native Mobile Architecture (`apps/mobile`)

The Mobile application is built on **Expo SDK 57 (React Native 0.86)** with **Expo Router** and **TanStack Query**.

```text
apps/mobile/
├── app/
│   ├── (app)/                  # Authenticated mobile screens (1-to-1 match with web routes)
│   │   ├── _layout.tsx         # Tab layout & navigation guard
│   │   ├── dashboard.tsx       # Role-specific mobile dashboard
│   │   ├── operations.tsx      # Operator Daily Log entry & historical log cards
│   │   ├── machines.tsx        # Machinery fleet touch cards & detail views
│   │   ├── clients.tsx         # Client worksites & assigned machine directory
│   │   ├── users.tsx           # Personnel list, operator profiles, assign modals
│   │   ├── attendance.tsx      # Operator shift attendance & supervisor checklist
│   │   ├── payroll.tsx         # Running hour payout breakdown
│   │   └── settings/           # Native app settings, font scale, theme
│   ├── (auth)/                 # Native auth screens (Login, Signup, Onboarding)
│   ├── _layout.tsx             # Root layout with TypeScaleProvider, ThemeProvider, Sentry
│   └── index.tsx               # Auth gateway redirect
├── components/
│   ├── ui/                     # Mobile UI primitives (Text, Icon, Button, Input, Card, Modal)
│   ├── navigation/             # MobileBottomNav, MobileMenuDrawer, MobileCommandPalette
│   ├── operations/             # MobileOperatorEntryCard, MobileOperatorHistoryTab
│   ├── offline/                # OfflineBanner & connectivity sync widgets
│   └── [module]/               # Domain mobile cards & bottom sheets
├── lib/
│   ├── supabase.ts             # Supabase client with hardware-backed SecureStore adapter
│   ├── hooks/                  # TanStack Query custom hooks (useOperationsData, useMachineData)
│   ├── offline/                # NetInfo network status & AsyncStorage mutation queue
│   ├── typography/             # TypeScaleProvider & scaled typography engine
│   └── auth/                   # useAuth hook & session state manager
├── assets/fonts/               # Bundled static Geist fonts (Regular, Medium, SemiBold, Bold, Mono)
├── app.config.js               # Dynamic Expo config (Sentry build gating)
└── eas.json                    # EAS build profiles (development, preview, production)
```

### 4.1 Native Backend & Data Layer
- **TanStack Query (`@tanstack/react-query`)**: Powers client server-state caching, stale-while-revalidate background fetches (30s stale time), and query invalidation.
- **Hardware-Backed SecureStore**: Authentication tokens and refresh tokens are stored in encrypted hardware keystores (iOS Keychain / Android Keystore) via `expo-secure-store`.
- **Offline-First Synchronization**:
  - Proactive network monitoring via `@react-native-community/netinfo`.
  - Offline mutation queue stored persistently in `AsyncStorage`.
  - Ambient top status banner (`OfflineBanner.tsx`) informing users that edits save locally and sync upon reconnection.

### 4.2 Native Touch & Animation Architecture
- **React Native Reanimated 4 & Gesture Handler**: Fluid 60fps spring transitions matching Apple HIG and Vercel Geist motion standards.
- **Tactile Haptics**: Native feedback via `expo-haptics` (`Haptics.selectionAsync()`) on button presses, tab switches, and confirmations.
- **Universal 44px Minimum Touch Targets**: Strict adherence to accessible touch bounds on all clickable elements.

---

## 5. Canonical User Roles (Strictly 6 Roles Monorepo-Wide)

ReachInternational operates strictly under **6 canonical roles** monorepo-wide:

1. **`super_admin`**: Full platform control, tenant isolation, security enforcement, global oversight.
2. **`admin`**: Global organizational management, user administration, machinery fleet, client worksites.
3. **`manager`**: Operational review, shift log verification, fleet utilization, payroll and running hours approval.
4. **`supervisor`**: Site-level coordination, equipment allocation, direct operator assignment management.
5. **`hr`**: Human resources, employee lifecycle, profile change requests, attendance records.
6. **`operator`**: Daily machine operation, HMR meter logging (`/operations?tab=entry`), shift execution.

---

## 6. Database & Persistence Architecture (`supabase/`)

### 6.1 Supabase PostgreSQL Baseline
- **PostgreSQL 15+** running on Supabase.
- **Row Level Security (RLS)**: Enforced on 100% of operational tables (`profiles`, `machines`, `machine_hour_logs`, `operator_assignments`, `attendance_records`, `clients`).
- **Target Environments**:
  - **Development Project**: `vlmxciuogczumumrwyot` (`Reach International Dev`) — all development migrations, SQL executions, and seeding MUST strictly target this instance.
  - **Production Project (PROTECTED)**: `dhbbgfzbyatzvqafnsqp` (`Reach International Production`) — strictly untouched during development.

### 6.2 Critical Business Invariants
1. **Shift Monotonicity**: Machine End Meter MUST always be greater than or equal to Start Meter.
2. **Overtime & Shift Overlap Guards**: An operator cannot be assigned to overlapping active shifts without explicit supervisor exception.
3. **Immutable Audit Trails**: All user creations, role alterations, shift edits, and status transitions generate immutable records in `public.audit_logs`.

---

## 7. Web & Native App Consistency Contract

Web and Native Mobile must behave and look like **one unified product**:

| Dimension | Web App (`apps/web`) | Native Mobile App (`apps/mobile`) | Parity Status |
| :--- | :--- | :--- | :--- |
| **Color Tokens** | Geist CSS variables (`--color-ink`, `--color-canvas`, etc.) | `@reachinternational/design-tokens` theme object | **100% Identical** |
| **Typography** | Geist Sans & Geist Mono (Tailwind classes) | Bundled static Geist `.ttf` fonts (`<Text variant="...">`) | **100% Identical** |
| **Icons** | `lucide-react` (size & stroke standard) | `lucide-react-native` (exact matching glyphs) | **100% Identical** |
| **Navigation** | AppSidebar (desktop) / BottomNav (mobile) | Expo Router Stack / Floating MobileBottomNav | **100% Identical** |
| **Data Models** | `@reachinternational/types` | `@reachinternational/types` | **100% Identical** |
| **Validation** | `@reachinternational/validation` (Zod v4) | `@reachinternational/validation` (Zod v4) | **100% Identical** |
| **Permissions** | `@reachinternational/permissions` | `@reachinternational/permissions` | **100% Identical** |
| **Data Fetching** | Server Components (RSC) + DAL | TanStack Query + Supabase JS Client | Platform-Adapted |
| **Auth Storage** | Secure HTTP-only cookies (`@supabase/ssr`) | Hardware Keystore (`expo-secure-store`) | Platform-Adapted |

---
