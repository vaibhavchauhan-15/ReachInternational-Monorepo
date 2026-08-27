# ReachInternational — Performance Baseline (Phase 0)

> **PHASE 0 BACKUP & BASELINE SPECIFICATION**  
> *Captured on: 2026-08-27*  
> *Git Branch: `performance-optimization`*  
> *Monorepo Commit Checkpoint: `chore: baseline before performance optimization`*

---

## 1. Executive Summary

This directory contains the foundational performance baseline measurements for the ReachInternational monorepo (`apps/web`, `apps/mobile`, `packages/*`, and Supabase PostgreSQL). **No optimizations or code modifications have been applied yet.** 

All measurements in this directory serve as the empirical ground truth against which all subsequent phases (Phase 1 through Phase 10) will be validated.

---

## 2. Monorepo Quality Gate Baseline

```text
GATE               STATUS     METRIC / SUMMARY
──────────────────────────────────────────────────────────────────────────────────────────
• pnpm typecheck   PASS       9/9 packages pass with 0 errors (Turbo uncached: 18.12s)
• pnpm lint        RECORDED   652 pre-existing problems (281 errors, 371 warnings, mostly no-explicit-any)
• pnpm build       PASS       Next.js 16.2.12 compiled 35 static & dynamic routes in 1m 4s
• Next.js Prod     READY      Server ready on port 3005 in 424ms
```

---

## 3. Production & Toolchain Environment

```text
COMPONENT                  SPECIFICATION / VERSION
──────────────────────────────────────────────────────────────────────────────────────────
• Node.js                  v22.22.3
• pnpm                     11.21.0
• Turborepo                2.10.11
• Next.js                  16.2.12 (Turbopack production build)
• React / React DOM        19.2.4
• Supabase PostgreSQL      PostgreSQL 17.6.1.155 (GA channel)
• Database Region          ap-south-1 (Mumbai, India)
• Database Compute Tier    Free Tier (Micro compute / Shared)
• Database Size            14 MB
```

---

## 4. Defined Optimization Targets

Measurable targets for subsequent optimization phases:

1. **Initial Page Load**: Target `< 1.0s` (LCP `< 2.5s` on mobile 3G/4G).
2. **Standard DB Queries**: Target `< 100ms–200ms` (p95 `< 50ms`).
3. **Database Safeguards**: Zero un-indexed foreign key lookups; zero unexplained sequential scans.
4. **List & Table Views**: Fully bounded / paginated with explicit column projection (`0` unconstrained `SELECT *`).
5. **Request Waterfalls**: `0` sequential async waterfalls for independent datasets (all parallelized via `Promise.all()`).
6. **Server Action Latency**: Target `< 300ms` mutation round-trip.
7. **Client Bundle Optimization**: Zero unnecessary heavy libraries imported on initial hydration.

---

## 5. The Golden Rule of Optimization

From this point forward:

```text
DO NOT:
Change something ──► Assume it is faster

INSTEAD:
Measure (Baseline) ──► Change ──► Measure Again ──► Compare ──► Keep ONLY if faster & safe
```

---

## 6. Baseline Documentation Index

- [`routes.md`](./routes.md) — HTTP latency, transfer sizes, redirects, and sub-resource bundle analysis.
- [`database.md`](./database.md) — Table row counts, PostgreSQL timeout configurations, and index inventory.
- [`queries.md`](./queries.md) — `pg_stat_statements` query execution times and access patterns.
- [`actions.md`](./actions.md) — Server Action inventory and mutation pipeline checkpoints.
- [`build.md`](./build.md) — Next.js 16 route tree, static/dynamic classification, and bundle distribution.

---

## 7. Phase 0 Completion Checklist

- [x] Created `performance-optimization` branch
- [x] Created clean Git checkpoint (`chore: baseline before performance optimization`)
- [x] `pnpm typecheck` recorded (9/9 packages pass cleanly)
- [x] `pnpm lint` recorded (652 pre-existing problems documented)
- [x] `pnpm build` recorded (35 routes compiled in 1m 4s)
- [x] Production server tested (`next start` on port 3005)
- [x] `/login` baseline recorded (30.9 KB HTML, 16 requests, 1.41 MB uncompressed JS)
- [x] `/signup` baseline recorded (39.7 KB HTML, 16 requests, 1.43 MB uncompressed JS)
- [x] `/machines` baseline recorded (Edge proxy redirect 4.01ms)
- [x] `/users` baseline recorded (Edge proxy redirect 3.47ms)
- [x] `/clients` baseline recorded (Edge proxy redirect 3.45ms)
- [x] `/operations?tab=logs` baseline recorded (Edge proxy redirect 3.41ms)
- [x] `/operations?tab=assignments` baseline recorded (Edge proxy redirect 4.12ms)
- [x] `/operations?tab=entry` baseline recorded (Edge proxy redirect 4.31ms)
- [x] `/operations?tab=history` baseline recorded (Edge proxy redirect 3.71ms)
- [x] Database row counts recorded (6 core public tables)
- [x] Existing indexes recorded (43 public indexes)
- [x] Query statistics recorded (`pg_stat_statements`)
- [x] Node/pnpm/Next versions recorded
- [x] Build/bundle information recorded
- [x] Server Actions inventoried
- [x] PostgreSQL timeout settings recorded (`statement_timeout=10s`, `lock_timeout=5s`, `idle=10s`)
- [x] Baseline files created (`README.md`, `routes.md`, `database.md`, `queries.md`, `actions.md`, `build.md`)
- [x] Performance targets defined
