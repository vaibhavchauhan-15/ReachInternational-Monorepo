# ReachInternational Production Observability, Monitoring & Logging Rules

> **AUTHORITATIVE OBSERVABILITY, MONITORING & LOGGING POLICY FOR AI AGENTS**  
> *This document establishes the binding logging, audit tracking, metrics, health monitoring, error tracking, PII redaction, and operational observability policy for all applications (`apps/web`, `apps/mobile`), shared packages (`packages/*`), data access layers (`lib/dal.ts`), server actions, database queries, and background processes within the ReachInternational monorepo. Every AI coding agent MUST read, obey, and enforce these rules before writing or modifying any logging, telemetry, or diagnostic code in this repository.*

---

## 1. Purpose

The purpose of ReachInternational's Observability, Monitoring & Logging policy is to guarantee that **all production-critical operations—spanning user authentication, operational workflow mutations, financial approvals, inventory transactions, and system failures—are fully observable, diagnosable, and measurable without ever exposing sensitive passwords, auth tokens, or employee PII**.

Observability MUST answer nine core operational questions:
```text
What happened? → When did it happen? → Where did it happen? → Which operation failed? → Which system was involved? → Was the user affected? → What was the error? → Can we reproduce/debug it? → Is the system recovering?
```

---

## 2. Source of Truth

ReachInternational establishes authoritative canonical sources of truth for observability:
1. **Audit Security Logger**: `apps/web/lib/audit.ts` (`logAudit()`) writing structured events to PostgreSQL `public.audit_logs`.
2. **Server Data Access Diagnostics**: Data Access Layer (`apps/web/lib/dal.ts`) exposing `verifySession()`, `getCurrentUser()`, and permission checks.
3. **Database Audit Trail Schema**: Supabase PostgreSQL `audit_logs` table (`user_id`, `action`, `entity_type`, `entity_id`, `metadata`, `created_at`).
4. **Security & Privacy Rules**: `AI/RULES/SECURITY.md` and `AI/RULES/DATA-PROTECTION-PRIVACY.md`.
5. **Next.js Error Boundaries**: App Router error boundary handling in `apps/web/app/(app)/error.tsx`.

---

## 3. Existing Observability Stack

ReachInternational utilizes an integrated operational observability stack:
* **Audit Logging Engine**: Server-only audit module `apps/web/lib/audit.ts` persisting structured operational and security events to PostgreSQL `public.audit_logs`.
* **Server Diagnostics**: Native Next.js App Router server logging and console diagnostics.
* **Database Logs**: Supabase PostgreSQL query, connection, and RLS evaluation logs.
* **Seed & Database Audit Verification**: `node supabase/verify_seed.mjs` verifying table counts and database relationships.

---

## 4. Observability Architecture

Observability flows across six distinct operational layers:

```text
User Action → Browser UI → Server Action / API → Data Access Layer (dal.ts) → Supabase PostgreSQL DB → Audit Logger (lib/audit.ts)
```

---

## 5. Logging Architecture

1. **Structured Operational Events**: All elevated mutations (creating machines, resolving breakdown complaints, approving purchase orders, updating user roles) MUST trigger structured audit logging via `logAudit()`.
2. **Server-Only Execution**: Audit logging functions MUST execute strictly on the server (`import "server-only"` in `lib/audit.ts`).

---

## 6. Log Severity Levels

ReachInternational defines five explicit log severity levels:

```text
LOG LEVEL       USAGE & INTENT                                         PRODUCTION BEHAVIOR
──────────────────────────────────────────────────────────────────────────────────────────
• DEBUG         Development diagnostics & query profiling              Disabled in production
• INFO          Normal operational events (User login, PO submitted)   Logged to audit_logs
• WARN          Recoverable abnormal events (Validation fail, retry)   Logged with details
• ERROR         Operation failure (Database failure, API error)        Logged + logAudit()
• FATAL         System crash / database disconnect                     Immediate alert trigger
```

---

## 7. Structured Logging Standards

Logging MUST use structured key-value pairs rather than concatenated string blobs:
```ts
// Canonical Structured Audit Log Call
await logAudit({
  action: "APPROVE_PURCHASE_ORDER",
  entity_type: "purchase_order",
  entity_id: poId,
  metadata: { totalAmount, branchId, itemCount },
});
```

---

## 8. Event Naming Standards

Log and audit action names MUST follow uppercase `ACTION_VERB_ENTITY` conventions (e.g. `CREATE_MACHINE`, `RESOLVE_COMPLAINT`, `APPROVE_PO`, `UPDATE_USER_ROLE`). Arbitrary, inconsistent event names (e.g. `po_approved`, `didUpdateMachine`) are **STRICTLY FORBIDDEN**.

---

## 9. Request IDs

Server Actions and API route invocations SHOULD preserve request execution IDs across server processing layers to trace end-to-end request lifecycles.

---

## 10. Correlation IDs

When a multi-step operation spans background queues or third-party webhooks (e.g. QStash dispatches, SendGrid notifications), the initiating operation's `entity_id` MUST be passed as a correlation ID to trace downstream operations.

---

## 11. Distributed Tracing Boundaries

Tracing MUST focus on high-risk boundaries (Data Access Layer queries, PostgreSQL transactions, third-party API calls). AI agents MUST NOT instrument trivial helper functions or render loops.

---

## 12. Client-Side Error Monitoring

1. **Captured Errors**: Client Component exceptions caught by React Error Boundaries (`error.tsx`) MUST display a safe user-facing alert while capturing technical error metadata for server diagnostics.
2. **No Sensitive PII in Client Logs**: Client-side error handlers MUST NOT log user passwords, credit card numbers, or auth tokens.

---

## 13. Server-Side Error Monitoring

Unexpected server exceptions in Server Actions or API routes MUST be caught, logged to server diagnostics, and recorded via `logAudit({ action: "SERVER_ERROR_CAUGHT", ... })`.

---

## 14. Database Observability

1. **Query Diagnostics**: Failed database queries MUST log error codes and query contexts without exposing raw database connection strings.
2. **Transaction Auditing**: Failed PostgreSQL transactions MUST log the rollback event and target entity ID.

---

## 15. API Route Monitoring

API endpoints in `apps/web/app/api/` MUST log HTTP status codes, execution durations, and target routes for non-200 responses.

---

## 16. Performance Observability

Slow database queries or Server Actions exceeding 1,000ms execution durations SHOULD trigger warning log entries for performance profiling.

---

## 17. Core Web Vitals Observability

Client-side Web Vitals metrics (LCP, INP, CLS) captured in production MUST be aggregated anonymously without attaching employee PII or private customer records.

---

## 18. Operational Metrics

The application tracks four key operational metric categories:
* **Request Volumes**: Total Server Action and API invocations per minute.
* **Error Rates**: Ratio of 4xx/5xx errors to total operations.
* **Mutation Latencies**: Execution time of financial approvals and stock updates.
* **Auth Failures**: Count of failed login attempts per branch.

---

## 19. Health Check Endpoints

1. **Readiness Probe**: `/api/health` returns HTTP 200 `{ status: "ok", timestamp: ... }` when the server and Supabase database connection are functional.
2. **Security Isolation**: Health check endpoints MUST NEVER expose environment variables, database passwords, or server topology.

---

## 20. External Service Observability

Integrations with third-party providers (SendGrid, Twilio, WhatsApp, QStash) MUST log dispatch outcomes:
```ts
await logAudit({
  action: "SENDGRID_EMAIL_DISPATCH",
  entity_type: "notification",
  metadata: { templateId: "po_approved_notice", success: true },
});
```

---

## 21. Background Job Observability

Scheduled background tasks (QStash queues, cron workflows) MUST log execution start, completed record counts, failed record counts, and total duration.

---

## 22. Audit Logging Infrastructure (`lib/audit.ts`)

Elevated mutations MUST invoke `logAudit()` from `apps/web/lib/audit.ts`:
```ts
export async function logAudit({ action, entity_type, entity_id, metadata, user_id }: AuditLogParams) {
  // Writes to public.audit_logs table in Supabase PostgreSQL
}
```

---

## 23. Business Event Logging

Key enterprise business events MUST produce audit log entries:
* Purchase Order creation, approval, or rejection.
* Machine creation, specification edit, or decommissioning.
* Service breakdown complaint filing, assignment, and FSR sign-off.
* Inventory stock issue, receipt, transfer, or adjustment.
* Employee role change, branch re-assignment, or salary revision.

---

## 24. Alerting Principles

1. **Actionable Alerts Only**: Alerts MUST correspond to actionable operational problems (e.g. repeated auth failures, database connection loss).
2. **Alert Noise Elimination**: Generating high-frequency alerts for minor user input validation errors is FORBIDDEN.

---

## 25. Availability Monitoring

Production deployment availability is monitored via endpoint health probes (`/api/health`) and Vercel deployment status metrics.

---

## 26. Incident Detection Protocols

Incidents are detected when:
* Error rates exceed 5% of total requests over a 5-minute window.
* Database query latency exceeds 2,000ms.
* Sustained authorization failure spikes occur across a specific branch.

---

## 27. Incident Diagnosis Workflow

```text
Alert Triggered → Inspect Request ID → Query public.audit_logs by entity_id → Identify Root Cause → Deploy Fix
```

---

## 28. Production Debugging Protocol

Production troubleshooting MUST rely on structured logs, server diagnostics, and `public.audit_logs`. Adding temporary `console.log()` statements to production code is **STRICTLY FORBIDDEN**.

---

## 29. Log Retention Governance

Audit security logs in `public.audit_logs` are retained permanently for legal and operational compliance. Transient debug logs are automatically rotated by hosting infrastructure.

---

## 30. Log Volume Control

1. **No Loop Logging**: Calling `console.log()` or `logAudit()` inside high-frequency `for` loops, render functions, or scroll event handlers is **STRICTLY FORBIDDEN**.
2. **Batch Logging**: Bulk operations MUST produce a single summary audit log entry (e.g. `BULK_UPDATE_MACHINES` with metadata `{ count: 45 }`).

---

## 31. Telemetry Sampling

High-volume telemetry events SHOULD use sampling to control storage overhead while maintaining statistical reliability.

---

## 32. Privacy & PII Redaction Standards

All logging MUST comply with `AI/RULES/DATA-PROTECTION-PRIVACY.md`. The following fields MUST BE REDACTED or MASKED prior to logging:
* Employee Aadhaar, PAN, and Bank Account numbers (`XXXX-XXXX-1294`).
* Customer contact emails and personal phone numbers.
* Employee salary details in operational log metadata.

---

## 33. Secret & Token Redaction Mandate

The following sensitive credentials MUST NEVER appear in log files, audit metadata, or error outputs under any circumstances:
* User passwords in plaintext or hashed form.
* Supabase JWT session tokens and refresh tokens.
* Server secret keys (`SUPABASE_SERVICE_ROLE_KEY`, `SENDGRID_API_KEY`).
* OTP verification codes.

---

## 34. Authentication Event Logging

Login attempts MUST be logged safely:
* **Success**: `logAudit({ action: "USER_LOGIN_SUCCESS", user_id: user.id })`.
* **Failure**: Log failure count without exposing whether the email or password was incorrect.

---

## 35. Authorization Event Logging

Security permission denials (`requirePermission()` failure) MUST generate warning log entries:
```ts
await logAudit({
  action: "AUTHORIZATION_DENIED",
  entity_type: "machine",
  entity_id: machineId,
  metadata: { requiredPermission: PERMISSIONS.MACHINES_DELETE, userRole: user.role },
});
```

---

## 36. Observability Security Controls

1. **Restricted Audit Access**: Querying `public.audit_logs` is restricted to `super_admin` and `company_admin` roles via RLS policies.
2. **Immutable Audit Entries**: Deleting or updating historical rows in `public.audit_logs` via application API endpoints is FORBIDDEN.

---

## 37. Observability Performance Limits

Audit logging calls MUST be asynchronous and lightweight to ensure logging overhead adds < 5ms to total request latency.

---

## 38. Monitoring Dashboard UX

If internal administrative monitoring dashboards are added, they MUST observe `DESIGN.md` Vercel Geist tokens and comply with `AI/RULES/UI-UX.md` and `AI/RULES/RESPONSIVE.md`.

---

## 39. Observability Testing

1. **Audit Logger Test**: Verify `logAudit()` correctly inserts rows into `public.audit_logs`.
2. **Typecheck Audit**: `pnpm typecheck` across all 9 monorepo workspace packages.

---

## 40. Observability Regression Protection

Before modifying `apps/web/lib/audit.ts` or audit log schema definitions:
1. Audit downstream audit event calls across all 19 Server Action modules.
2. Verify zero PII or secret key leakage vectors exist.
3. Verify zero compilation errors across all workspace packages (`pnpm typecheck`).

---

## 41. Monitoring Cost Control

Avoid introducing secondary third-party analytics or logging platforms without explicit architectural justification to prevent unnecessary infrastructure expenses.

---

## 42. Forbidden Observability Anti-Patterns (NEVER INTRODUCE)

AI agents MUST NEVER introduce any of the following observability anti-patterns:
* ❌ **Logging Plaintext Passwords or Tokens**: Writing user passwords, JWTs, or secret keys to console or audit logs.
* ❌ **Production Console Debugging**: Leaving temporary `console.log()` debug calls in production builds.
* ❌ **Loop Logging**: Invoking logging functions inside high-frequency `for` loops or render cycles.
* ❌ **Raw Payload Logging**: Logging complete un-sanitized request/response bodies (`console.log(req.body)`).
* ❌ **Modifying Audit Logs**: Creating API endpoints that update or delete historical audit log rows.
* ❌ **Exposing Secrets in Health Checks**: Returning database credentials or server environment variables in `/api/health`.

---

## 43. Change Policy

Before updating logging functions or audit event definitions:
1. Verify compliance with security and privacy policies.
2. Formulate the smallest correct code change.
3. Perform post-implementation verification.

---

## 44. AI Agent Pre-Implementation Observability Checklist

Before writing code, every AI agent MUST complete this mental checklist:

* [ ] Does elevated mutation logic invoke `logAudit()` from `apps/web/lib/audit.ts`?
* [ ] Are all passwords, auth tokens, and secret keys excluded from log metadata?
* [ ] Are log action names written in uppercase `ACTION_VERB_ENTITY` format?
* [ ] Are temporary debug `console.log()` calls removed prior to completion?
* [ ] Does the mutation log asynchronous operational context without blocking user responses?

---

## 45. AI Agent Post-Implementation Observability Audit

After completing code modifications, every AI agent MUST perform the following verification protocol:

1. **Compilation Audit**: Run `pnpm typecheck` across all 9 monorepo workspace packages (0 errors).
2. **Audit Logging Audit**: Confirm elevated mutations invoke `logAudit()` with sanitized metadata.
3. **Design & Responsive Audit**: Confirm visual compliance with `DESIGN.md` across Mobile, Tablet, and Desktop.
4. **Memory Synchronization**: Update `AI/STATE.md`, `AI/CURRENT_TASK.md`, `AI/CHANGELOG_AI.md`, and `README.md`.

---
