# ReachInternational

## What This Is

ReachInternational is an enterprise-grade heavy machinery service tracking, equipment rental, and field operations platform. Built as a Turborepo monorepo, it powers an authenticated Next.js 16.2 web application for managers and clients, alongside an Expo 54 / React Native cross-platform mobile application for field engineers, mechanics, and machine operators, all backed by a single Supabase PostgreSQL database and Supabase Auth.

## Core Value

Zero missed machine maintenance due dates and 100% field operational accountability across web and mobile platforms with real-time audit logging.

## Business Context

- **Customer**: Industrial machinery fleet owners, Service Managers, Field Service Engineers, and Heavy Equipment Operators.
- **Revenue model**: Internal enterprise operations, equipment rental agreements, and scheduled preventive maintenance service contracts.
- **Success metric**: 0 missed maintenance reminder alerts, sub-second query latency via server-side pagination, and 100% test matrix passing.

## Requirements

### Validated

- [x] Turborepo monorepo architecture with strict DAG layering (`apps/web`, `apps/mobile`, and 5 shared packages).
- [x] PostgreSQL database baseline with 58 migrations, comprehensive RLS, composite B-tree & GIN indexes, and security-definer RPCs.
- [x] Multi-channel automated notifications (SendGrid email, Twilio WhatsApp & SMS) scheduled via Upstash QStash.
- [x] Machine master data management with serial number uniqueness and HMR telemetry.
- [x] Field operations shift meter logs, breakdown tracking, and overnight shift duration derivation.
- [x] Canonical `<Pagination />` integration across all tables and tabs exceeding 20 rows.
- [x] Tamper-proof append-only audit trail recording Before vs After state diffs in `public.audit_logs`.

### Active

- [ ] Complete cross-platform Web-to-Mobile feature parity across all remaining secondary workflows.
- [ ] Offline-first sync capabilities for field technicians operating in zero-connectivity environments.
- [ ] Realtime telemetry websockets for live breakdown escalation.

### Out of Scope

- **Multi-Tenant SaaS Partitioning**: System is strictly an internal enterprise application for ReachInternational. Multi-company tenant isolation is explicitly excluded.
- **Public Payment Gateway Checkout**: Client billing and receivables are managed via enterprise invoices and PO 3-way matching; direct consumer credit card gateways are excluded.
- **Separate Mobile Database**: Direct architecture constraint — Web and Mobile must share the single Supabase PostgreSQL backend.

## Context

The enterprise previously managed 500+ machinery units using disparate Excel spreadsheets, resulting in missed service due dates and manual dispatch overhead. The modern platform centralizes fleet records, automates morning WhatsApp alerts, and provides field operators with mobile shift hour logging.

## Constraints

- **Architecture**: Turborepo monorepo with unidirectional DAG (`apps/*` → `packages/*`). Packages never import from apps.
- **Database**: Single Supabase PostgreSQL 15+ instance with Row Level Security enforced on 100% of tables.
- **Security**: Strict isolation of `SUPABASE_SERVICE_ROLE_KEY` to server-side actions; zero client exposure.
- **Performance**: Zero `SELECT *` in production; server-side range pagination on high-volume routes; parallel relational hydration via `Promise.all()`.
- **UI/UX**: Strict adherence to Vercel Geist design tokens (`#171717`, `#fafafa`, `#ffffff`, `#ebebeb`, `#0070f3`) and 3-tier viewport responsiveness.
- **Cross-Platform Sync**: Mandatory Web-to-Mobile change synchronization in the same task.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| DEC-001: Turborepo Monorepo | Enables code sharing (`@reachinternational/*`) between Next.js web and Expo mobile apps | ✓ Good |
| DEC-002: Single Shared Database | Eliminates backend divergence and sync overhead between web and mobile | ✓ Good |
| DEC-003: Server Actions & DAL | Enforces server-side validation, authorization, and audit logging for all mutations | ✓ Good |
| DEC-004: Multi-Channel Alert Engine | QStash + Twilio (WhatsApp/SMS) + SendGrid ensures alerts reach field engineers reliably | ✓ Good |
| DEC-005: Canonical Pagination | Guarantees consistent UX and low memory consumption across all 39 web routes | ✓ Good |
| DEC-006: Centralized Audit Trail | Provides tamper-proof regulatory and operational traceability with visual Before/After diffs | ✓ Good |

---
*Last updated: 2026-09-09 after /gsd-ingest-docs*
