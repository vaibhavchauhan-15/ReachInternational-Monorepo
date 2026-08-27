# ReachInternational Performance Baseline — Phase 0

> **Checkpoint Branch**: `performance-optimization`  
> **Commit Checkpoint**: `chore: baseline before performance optimization`  
> **Recorded Date**: 2026-08-27  
> **Monorepo Structure**: Turborepo + pnpm monorepo (`apps/web`, `apps/mobile`, `packages/*`, Supabase PostgreSQL)

---

## 1. Executive Summary

This directory captures the empirical performance baseline of ReachInternational prior to any code, query, caching, or bundling optimizations. Every measurement recorded here serves as the ground truth before applying optimization phases (Phase 1 through Phase 10).

---

## 2. Environment Specifications

| Parameter | Baseline Value |
|---|---|
| **Node.js Version** | `v22.22.3` |
| **pnpm Version** | `11.21.0` |
| **Next.js Version** | `16.2.12` (Turbopack) |
| **React Version** | `19.2.4` (React Server Components + React 19 Client) |
| **Supabase Project Ref** | `dhbbgfzbyatzvqafnsqp` (ServiceCentric) |
| **Supabase Region** | `ap-south-1` (Asia Pacific - Mumbai) |
| **Database Engine** | PostgreSQL 17.6 (`17.6.1.155`) |
| **Total Database Size** | `14 MB` |

---

## 3. Monorepo Quality Gate Baseline

```text
============================================================
MONOREPO QUALITY GATE RECORDING (PRE-OPTIMIZATION)
============================================================
• TYPECHECK: PASS (9/9 workspace packages passing cleanly with 0 TypeScript errors)
• LINT:      FAIL (652 problems: 281 errors, 371 warnings — legacy @typescript-eslint/no-explicit-any in apps/web)
• BUILD:     PASS (All 9 packages compiled, 35 Next.js static & dynamic routes generated in 2m 6s)
============================================================
```

---

## 4. Optimization Targets (Step 0.15)

| Area | Measurable Performance Target |
|---|---|
| **Initial Page Load (LCP)** | `< 1.0 second` (Good Core Web Vital threshold: ≤ 2.5s) |
| **Standard Database Queries** | `< 100–200 ms` (p95 execution time) |
| **Large Fleet & Report Queries** | Bounded & paginated, zero unindexed sequential scans |
| **Table List Pages** | Cursor/range bounded pagination (`limit` + `offset`/keyset) |
| **N+1 Queries** | `0` (Zero duplicate sequential queries in loops) |
| **Wildcard Projections** | `0` `SELECT *` in DAL & Server Actions (explicit column selection) |
| **Unnecessary Asset Requests** | `0` redundant chunk imports or render-blocking scripts |
| **Heavy Client Bundles** | `< 150 KB` gzipped per route, heavy components dynamically imported (`next/dynamic`) |
| **Mutation Latency** | `< 300 ms` end-to-end Server Action execution |

---

## 5. The Golden Rule (Step 0.16)

```text
DO NOT:
  Change code / index / config
  → Assume it is faster

MANDATORY DISCIPLINE:
  1. Measure Baseline
  2. Implement Atomic Change
  3. Measure Again Under Identical Conditions
  4. Compare Numbers (TTFB, LCP, DB Exec Time, Bundle Size)
  5. KEEP only if empirical improvement is demonstrated; otherwise REVERT
```

---

## 6. Baseline Documentation Index

- [`routes.md`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/performance/baseline/routes.md): Browser & HTTP network metrics across all 9 core routes.
- [`database.md`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/performance/baseline/database.md): Live database row counts, complete index catalog, and timeout configurations.
- [`queries.md`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/performance/baseline/queries.md): PostgreSQL `pg_stat_statements` execution statistics and slow query baseline.
- [`actions.md`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/performance/baseline/actions.md): Complete Server Actions catalog and execution pipeline mapping.
- [`build.md`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/performance/baseline/build.md): Next.js Turbopack build metrics, route types, and bundle output.

---

## 7. Phase 0 Completion Verification Checklist

- [x] Created `performance-optimization` branch
- [x] Created clean Git checkpoint (`080b9ca`)
- [x] `pnpm typecheck` recorded (`PASS` — 9/9 packages)
- [x] `pnpm lint` recorded (`FAIL` — 652 legacy ESLint issues recorded separately)
- [x] `pnpm build` recorded (`PASS` — 35 routes generated in 2m 6s)
- [x] Production server started and tested (`http://localhost:3000`)
- [x] `/login` baseline recorded (34 reqs, 408.6 KB, 424ms)
- [x] `/signup` baseline recorded (28 reqs, 11.9 KB, 984ms)
- [x] `/machines` baseline recorded (307 Redirect to `/login` in 90.6ms unauth)
- [x] `/users` baseline recorded (307 Redirect to `/login` in 47.4ms unauth)
- [x] `/clients` baseline recorded (307 Redirect to `/login` in 43.4ms unauth)
- [x] `/operations?tab=logs` baseline recorded (307 Redirect in 42.6ms unauth)
- [x] `/operations?tab=assignments` baseline recorded (307 Redirect in 40.9ms unauth)
- [x] `/operations?tab=entry` baseline recorded (307 Redirect in 32.4ms unauth)
- [x] `/operations?tab=history` baseline recorded (307 Redirect in 55.6ms unauth)
- [x] Database row counts recorded (`users`: 27, `machines`: 1, `machine_hour_logs`: 25, `clients`: 1, `idempotency_keys`: 2, `audit_logs`: 0)
- [x] Existing indexes recorded (34 active indexes in `public` schema)
- [x] Query statistics recorded (`pg_stat_statements` profile captured)
- [x] Node (`22.22.3`), pnpm (`11.21.0`), Next.js (`16.2.12`), React (`19.2.4`) recorded
- [x] Build and bundle information recorded
- [x] Server Actions inventoried across monorepo
- [x] PostgreSQL timeout settings recorded (`statement_timeout=10s`, `lock_timeout=5s`, `idle_in_transaction_session_timeout=10s`)
- [x] Baseline files created in `performance/baseline/`
- [x] Performance targets defined
