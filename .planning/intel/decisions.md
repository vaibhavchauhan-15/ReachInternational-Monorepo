# Ingested Architecture & Product Decisions

**Analysis Date:** 2026-09-09

## DEC-001: Monorepo Architecture with Shared Packages
- source: `docs/phases.md`
- status: locked
- decision: Build ReachInternational as a Turborepo monorepo (`apps/web`, `apps/mobile`, and `packages/*`). Shared packages provide types, validation, permissions, design tokens, and utilities without code duplication.
- scope: monorepo structure, package management, shared dependencies

## DEC-002: Single Shared Database and Authentication
- source: `docs/phases.md`, `prd.md`
- status: locked
- decision: Maintain one single Supabase PostgreSQL database and one Supabase Auth instance for both Web and Mobile. Do NOT create a separate mobile backend.
- scope: database, authentication, backend architecture

## DEC-003: Unidirectional Layering & DAG Integrity
- source: `docs/phases.md`, `docs/current-architecture.md`
- status: locked
- decision: Enforce strict one-way dependency flow (`apps/*` → `packages/*`). Apps never import from other apps, packages never import from apps, and foundational packages never import from domain packages.
- scope: monorepo boundaries, package dependencies

## DEC-004: Server-Driven Mutations with Audit Logging
- source: `prd.md`, `docs/current-architecture.md`
- status: locked
- decision: All database mutations must execute via Server Actions with Zod input validation, session authorization, and mandatory structured audit logging (`logAudit()`) to `public.audit_logs`.
- scope: mutations, security, audit trail

## DEC-005: Automated Multi-Channel Alert Engine
- source: `prd.md`
- status: locked
- decision: Dispatch automated service reminders (due today, due tomorrow, overdue) using Upstash QStash cron, Twilio WhatsApp/SMS, and SendGrid email, architected for 50,000+ machines.
- scope: notifications, cron scheduling, Twilio, SendGrid

## DEC-006: 3-Tier Viewport Responsiveness and Web-to-Mobile Parity
- source: `docs/phases.md`
- status: locked
- decision: All features must support Desktop (dense tables), Tablet (adaptive grid), and Mobile (touch cards, bottom sheets). Any change made in Web must be mirrored in Mobile in the same task.
- scope: UI/UX, responsive design, cross-platform parity
