# Roadmap: ReachInternational

## Overview

Transform ReachInternational from an Excel-dependent operation into an enterprise-grade Turborepo monorepo powering a Next.js 16 web application and an Expo 54 React Native mobile application sharing a single Supabase PostgreSQL datastore, unified RBAC, and automated multi-channel notification engine.

## Phases

- [x] **Phase 1: Monorepo Foundation & Workspace Tooling** — Turborepo configuration, pnpm workspace setup, shared packages scaffold.
- [x] **Phase 2: Database Schema & Enterprise Security** — Supabase PostgreSQL migrations, Row Level Security, RPCs, composite indexes.
- [x] **Phase 3: Shared Domain Types & Contracts** — `@reachinternational/types` canonical database row types and domain models.
- [x] **Phase 4: Enterprise RBAC & Permissions** — `@reachinternational/permissions` 12-role matrix and supervised role hierarchy.
- [x] **Phase 5: Canonical Validation Schemas** — `@reachinternational/validation` Zod schemas for all form and mutation inputs.
- [x] **Phase 6: Shared Design Tokens** — `@reachinternational/design-tokens` Vercel Geist design tokens and typography.
- [x] **Phase 7: Web Application & Audited Server Actions** — Next.js 16.2 App Router routes and audited Server Actions.
- [x] **Phase 8: Data Access Layer (DAL) & Caching** — Canonical DAL queries with parallel relational hydration and `unstable_cache`.
- [x] **Phase 9: Automated Notifications Engine** — Upstash QStash cron, Twilio WhatsApp/SMS, and SendGrid transactional email.
- [x] **Phase 10: Centralized Audit Logging System** — Dedicated `/audit` route, Before/After JSON diffs, and tamper-proof storage.
- [x] **Phase 11: Monorepo-Wide Canonical Pagination** — Integrated `<Pagination />` across all desktop tables and mobile card views (>20 rows).
- [x] **Phase 12: Mobile Application Foundation & Auth** — Expo 54 / React Native 0.81 setup, Supabase auth with `expo-secure-store`.
- [x] **Phase 13: Mobile Operations & Operator Parity** — Field operator shift hour logging, breakdown tracking, and web parity.
- [x] **Phase 14: Mobile Offline Sync & Network Resilience** — Offline mutation queue with background sync and retry mechanics. (completed 2026-09-09)
- [x] **Phase 15: Production Release & Deployment Verification** — EAS production builds (Android/iOS), Vercel production deployment. (completed 2026-09-09)

## Phase Details

### Phase 11: Monorepo-Wide Canonical Pagination

**Goal**: Integrate canonical `<Pagination />` across all data tables and tab views across the monorepo.
**Depends on**: Phase 7, Phase 8
**Requirements**: DATA-01, DATA-02
**Success Criteria**:

  1. All tables with >20 records render `<Pagination />` with proper page slicing.
  2. Server-side range pagination wired on high-volume directories (`/users`, `/operations`, `/clients`, `/audit`).
  3. Zero TypeScript compilation errors across all workspace packages.

**Status**: Complete (2026-09-09)

### Phase 14: Mobile Offline Sync & Network Resilience

**Goal**: Provide offline-first shift hour logging and inspection submissions for field technicians in low-connectivity yards.
**Depends on**: Phase 12, Phase 13
**Requirements**: MOB-03
**Success Criteria**:

  1. Operator can save shift logs locally when device has no cellular or Wi-Fi signal.
  2. Application detects network reconnection and auto-synchronizes pending mutations.
  3. Conflict resolution guards against duplicate submissions using idempotency keys.

**Status**: Complete (2026-09-09)

### Phase 15: Production Release & Deployment Verification

**Goal**: Final release candidate verification, automated seed auditing, and EAS packaging.
**Depends on**: Phase 14
**Requirements**: AUTH-01, MOB-01
**Success Criteria**:

  1. Zero errors across all test suites (`supabase/tests/*.mjs`).
  2. Android APK/AAB and iOS IPA generated cleanly via Expo EAS.
  3. Production environment variables locked and security audit verified.

**Status**: Complete (2026-09-09)

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Monorepo Foundation | Complete | 2026-08-20 |
| 2. Database Schema & RLS | Complete | 2026-08-22 |
| 3. Shared Domain Types | Complete | 2026-08-24 |
| 4. Enterprise RBAC | Complete | 2026-08-26 |
| 5. Validation Schemas | Complete | 2026-08-28 |
| 6. Shared Design Tokens | Complete | 2026-08-30 |
| 7. Web App & Server Actions | Complete | 2026-09-02 |
| 8. DAL & Caching Engine | Complete | 2026-09-04 |
| 9. Automated Notifications | Complete | 2026-09-05 |
| 10. Centralized Audit Logging | Complete | 2026-09-08 |
| 11. Canonical Pagination | Complete | 2026-09-09 |
| 12. Mobile Foundation & Auth | Complete | 2026-09-06 |
| 13. Mobile Operations Parity | Complete | 2026-09-08 |
| 14. Mobile Offline Sync | Complete   | 2026-09-09 |
| 15. Production Release | Complete    | 2026-09-09 |

---
*Roadmap defined: 2026-09-09*
*Last updated: 2026-09-09 after /gsd-ingest-docs*
