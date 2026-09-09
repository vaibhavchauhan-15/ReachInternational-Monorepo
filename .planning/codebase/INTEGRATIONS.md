# External Integrations

**Analysis Date:** 2026-09-09

## APIs & External Services

**Transactional Email:**
- **SendGrid Mail** (`@sendgrid/mail` ^8.1.6)
  - Purpose: Automated notification dispatching for service schedules, machine maintenance reminders, password resets, and user approvals.
  - Implementation: `apps/web/lib/email.ts` and `apps/web/lib/notifications/email-templates.tsx`.
  - Authentication: `SENDGRID_API_KEY` environment variable.
  - Sender Identity: Configured via `SENDGRID_FROM_EMAIL` and `SENDGRID_FROM_NAME` ("REACH INTERNATIONAL").

**SMS & WhatsApp Messaging:**
- **Twilio Communications Suite** (`twilio` ^6.0.2)
  - Purpose: Real-time SMS and WhatsApp text alerts dispatched to machine operators, service engineers, and field supervisors when machines are due for service or breakdowns are logged.
  - Implementation:
    - SMS: `apps/web/lib/notifications/sms.ts` via `twilio(accountSid, authToken).messages.create`.
    - WhatsApp: `apps/web/lib/notifications/whatsapp.ts` using pre-approved Content Templates (`TWILIO_CONTENT_SID`).
  - Authentication: `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.
  - Senders: `TWILIO_SMS_NUMBER` and `TWILIO_WHATSAPP_NUMBER`.

**Serverless Cron & Task Scheduling:**
- **Upstash QStash** (`@upstash/qstash` ^2.11.3)
  - Purpose: Distributed serverless execution of daily maintenance reminder checks and hour log rollup crons.
  - Implementation: `apps/web/app/api/cron/send-reminders/route.ts`.
  - Authentication: Verified using `QStash` receiver cryptographic signature (`QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`) or bearer `CRON_SECRET`.

**Rate Limiting & Anti-Abuse:**
- **Upstash Redis REST** (`@upstash/redis` REST interface)
  - Purpose: IP-based and token-based rate limiting on sensitive API routes and authentication mutations.
  - Implementation: `apps/web/lib/security/rate-limiter.ts`.
  - Authentication: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

## Data Storage

**Relational Database:**
- **PostgreSQL 15+ hosted on Supabase**
  - Purpose: Core operational data store for users, machines, hour logs, service records, rental agreements, working locations, and audit trails.
  - Client SDKs:
    - Web SSR / Server Actions: `@supabase/ssr` with cookie management (`apps/web/lib/supabase/server.ts`).
    - Web Admin: `@supabase/supabase-js` Service Role client (`apps/web/lib/supabase/admin.ts`).
    - Mobile App: `@supabase/supabase-js` client with native async storage adapter (`apps/mobile/lib/supabase.ts`).
  - Migrations: 58 SQL migrations in `supabase/migrations/` managed declaratively with transactional DDL, strict RLS, composite B-tree/GIN indexes, and security-definer RPCs.

**Object & File Storage:**
- **Supabase Storage Buckets**
  - Purpose: Document, machine photo, and KYC attachment storage.
  - Buckets:
    - `documents`: Machine operational manuals, service contracts, and inspection checklists.
    - `kyc-docs`: Operator driving licenses and Aadhaar identity cards (secured with restricted RLS read policies).
    - `machine-images`: Equipment telemetry photos, machine profile images, and breakdown visual evidence.

**Caching & Query Performance:**
- **Next.js App Router Data Cache**
  - Implementation: `apps/web/lib/cache.ts` using `unstable_cache` with tagged cache revalidation (`revalidateTag`).
  - Tiers: `CLASS_A_SYSTEM` (60s), `CLASS_B_CATALOG` (300s), `CLASS_C_OPERATIONAL` (60s).
  - Cache Tags: `TAGS.users`, `TAGS.machines`, `TAGS.operators`, `TAGS.notifications`, `TAGS.clients`, `TAGS.audit`.

## Authentication & Identity

**Authentication Engine:**
- **Supabase Auth (GoTrue)**
  - Implementation: PKCE Flow with HTTP-only, secure, same-site cookies (`apps/web/lib/supabase/server.ts`, `apps/web/proxy.ts`).
  - Mobile Auth: Secure persistent session token storage using `expo-secure-store` (`apps/mobile/lib/supabase.ts`).
  - Auth Routes: `apps/web/app/login/`, `apps/web/app/signup/`, `apps/web/app/forgot-password/`, `apps/web/app/reset-password/`, and Server Actions in `apps/web/app/actions/auth.ts`.
  - Lifecycle Triggers: `public.handle_new_user()` PostgreSQL trigger syncing `auth.users` to `public.users` with metadata persistence (`supervisor_ids`, `working_location_id`).

**Role-Based Access Control (RBAC):**
- Domain package: `@reachinternational/permissions` (`packages/permissions/src/roles.ts`, `packages/permissions/src/guards.ts`).
- Standardized Roles: `super_admin`, `admin`, `manager`, `service_manager`, `supervisor`, `engineer`, `service_engineer`, `mechanic`, `operator`, `client`, `store_manager`, `hr_manager`.
- Supervised Roles: `operator`, `mechanic`, `service_engineer`, `engineer` dynamically mapped to assigned supervisors.

## Monitoring & Observability

**Audit Trail & System Telemetry:**
- **Centralized Audit Logging System**
  - Implementation: `apps/web/lib/audit.ts` (`logAudit()`), `apps/web/lib/queries/audit-logs.ts`, and table `public.audit_logs`.
  - Event Taxonomy: Machines, Operator & Supervisor Assignments, Machine Rentals, Employees, Authentication, and Operations.
  - Security Safeguards: Automated redaction of sensitive credentials, passwords, and administrative emails before persistence.
  - Visual Diffs: Before vs After JSON state tracking exposed via `/audit/[id]` drawer.

**Health Monitoring:**
- **Health Check Route**: `apps/web/app/api/health/route.ts`
  - Returns HTTP 200 with database connectivity status, memory footprint, uptime, and deployment version tag (`NEXT_PUBLIC_APP_VERSION`).

## CI/CD & Deployment

**Continuous Quality Verification:**
- Monorepo task pipeline running `turbo run typecheck`, `turbo run lint`, and `turbo run build`.
- Database integrity checks: `node supabase/verify_seed.mjs` validating all relational seed records.
- Integration test suite: `node supabase/tests/test_operator_complete_matrix.mjs` verifying assignment lifecycles, shift overlaps, and permissions.

---

*Integration analysis: 2026-09-09*
*Update after major integration or external API changes*
