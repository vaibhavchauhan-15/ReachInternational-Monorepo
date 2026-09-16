# ReachInternational Production Validation, Error Handling & Resilience Rules

> **AUTHORITATIVE VALIDATION, ERROR HANDLING & RESILIENCE POLICY FOR AI AGENTS**  
> *This document establishes the binding validation, error handling, failure recovery, loading/empty state, transaction, optimistic update, and resilience engineering policy for all applications (`apps/web`, `apps/mobile`), shared packages (`packages/*`), data access layers (`lib/dal.ts`), server actions, database queries, and storage systems within the ReachInternational monorepo. Every AI coding agent MUST read, obey, and enforce these rules before writing or modifying any validation or error-handling code in this repository.*

---

## 1. Purpose

The purpose of ReachInternational's Validation, Error Handling & Resilience policy is to guarantee that **every application module behaves deterministically, safely, and gracefully across all execution conditions—including happy paths, validation failures, network timeouts, database errors, race conditions, and service degradations**.

Every feature implemented by an AI coding agent MUST follow the complete failure & recovery pipeline:
```text
Happy Path → Validation Failure → Auth Failure → Network Failure → API Failure → DB Failure → Timeout → Empty State → Unexpected Error → Recovery
```

---

## 2. Source of Truth

ReachInternational establishes authoritative canonical sources of truth for validation and error resilience:
1. **Shared Zod Validation Schemas**: `@reachinternational/validation` (`auth.ts`, `machine.ts`, `complaint.ts`, `fsr.ts`, `inventory.ts`, `finance.ts`, `hr.ts`).
2. **Server Data Access & Errors**: `apps/web/lib/dal.ts` (`verifySession()`, `getCurrentUser()`, `requirePermission()`).
3. **Database Constraints & Transactions**: Supabase PostgreSQL 35 migrations enforcing `NOT NULL`, `CHECK`, `FOREIGN KEY`, and `UNIQUE` constraints.
4. **UI Notification & Toast System**: `sonner` toast library (`toast.error()`, `toast.success()`).
5. **Layout Error Boundaries**: Next.js App Router error boundaries (`error.tsx`, `global-error.tsx`, `not-found.tsx`).

---

## 3. Validation Architecture

Validation is structured across five strict, non-bypassable layers:
```text
User Input → Client Validation (UX) → Server Validation (Zod) → Business Validation (DAL) → Database Constraints (PostgreSQL)
```

---

## 4. Validation Layers

1. **Client Layer**: Immediate inline form feedback using Zod schemas for instant user guidance.
2. **Server Layer**: Canonical Zod schema parsing in Server Actions (`app/actions/`) and API routes (`app/api/`).
3. **Domain Layer**: Business logic verification inside `lib/dal.ts` or domain service modules.
4. **Database Layer**: Database engine enforcement via PostgreSQL check constraints and RLS policies.

---

## 5. Input Validation Standards

1. **Untrusted Input Mandate**: Every request body, URL query parameter, form input, and uploaded file payload MUST be treated as untrusted and validated at the server boundary.
2. **Runtime Validation vs Types**: TypeScript interfaces DO NOT perform runtime validation. AI agents MUST explicitly invoke `.parse()` or `.safeParse()` on Zod schemas.

---

## 6. Form Validation Integration

1. **Shared Schemas**: Forms MUST consume canonical Zod schemas from `@reachinternational/validation`.
2. **Inline Field Errors**: Field-level validation errors MUST display directly below the corresponding input element using red text (`text-destructive text-xs`).

---

## 7. API Payload Validation

API route handlers in `apps/web/app/api/` MUST parse incoming JSON bodies before executing queries:

```ts
import { createMachineSchema } from "@reachinternational/validation";

export async function POST(req: Request) {
  const body = await req.json();
  const validation = createMachineSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      { success: false, error: "Validation Failed", details: validation.error.format() },
      { status: 400 }
    );
  }
  // Proceed with validated payload
}
```

---

## 8. Business Rule Validation

1. **Operational Invariants**: Business rules (e.g. "Cannot complete a breakdown complaint without parts verification") MUST be validated on the server.
2. **Pre-Mutation Verification**: Server Actions MUST verify business preconditions before initiating database updates.

---

## 9. Database Constraints & Integrity

Application validation MUST NOT replace database integrity rules. Tables MUST define `NOT NULL`, `CHECK`, and `FOREIGN KEY` constraints to preserve transactional consistency even if application code fails.

---

## 10. Error Architecture

ReachInternational categorizes errors into structured, predictable application types:

```text
ERROR CATEGORY        HTTP STATUS   USER-FACING EXPERIENCE             LOGGING LEVEL
──────────────────────────────────────────────────────────────────────────────────────────
• Validation Error     400 Bad Req   Inline red field notice / toast    Info / Debug
• Auth Error           401 Unauth    Redirect to /login + toast        Info
• Permission Error     403 Forbidden Access Denied toast / 403 page     Warning
• Resource Not Found   404 Not Found 404 Not Found Page / empty state   Info
• Conflict Error       409 Conflict  "Record modified by another user"  Warning
• Rate Limit           429 Too Many  "Too many requests. Please wait."   Warning
• Server / DB Error    500 Internal  Generic user toast + retry button  Error (logAudit)
```

---

## 11. Error Taxonomy Standards

Errors MUST include structured fields:
```ts
export interface AppError {
  code: string;           // E.g., "VALIDATION_FAILED", "INSUFFICIENT_PERMISSIONS"
  message: string;        // Safe user-facing message
  details?: unknown;      // Field-level error breakdown
  status: number;         // Associated HTTP status code
}
```

---

## 12. User-Facing Error Messages

1. **Safe & Actionable Messages**: User-facing error strings MUST be concise, polite, and actionable (e.g. "Unable to save purchase order. Please check the required fields.").
2. **Prohibition of Technical Leakage**: Exposing stack traces, raw SQL queries, database column names, or secret keys to end-users is **STRICTLY FORBIDDEN**.

---

## 13. Error Boundaries (`error.tsx`)

Next.js App Router error boundaries (`error.tsx`, `not-found.tsx`) MUST be placed at key route segment levels (`app/(app)/error.tsx`) to catch unexpected component errors without crashing the entire App Shell layout.

---

## 14. API Error Handling Standards

API routes MUST return uniform error JSON envelopes:
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested machine record could not be found."
  }
}
```

---

## 15. Database Error Handling

Raw PostgreSQL error messages (e.g. `violates foreign key constraint "fk_machine"`) MUST be caught in `try/catch` blocks and mapped to user-friendly messages (e.g. "Cannot delete this machine because active service logs are attached.").

---

## 16. Network Failure Recovery

1. **Fetch Failures**: Network disconnects during data fetching MUST trigger a toast notification ("Network connection lost. Please check your internet connection.").
2. **Offline Prevention**: Forms MUST disable submit buttons when `navigator.onLine === false` to prevent data loss.

---

## 17. Timeout Safeguards

Async queries and external API calls MUST enforce timeouts (e.g. 10-second fetch timeouts using `AbortController`). Operations exceeding timeout limits MUST fail safely and prompt the user to retry.

---

## 18. Retry Strategy Rules

1. **Safe Retry Candidates**: Retries are permitted ONLY for idempotent read operations (`GET` requests) or transient network disconnects.
2. **Non-Idempotent Prohibitions**: Automatically retrying non-idempotent mutations (creating purchase orders, approving expenses, issuing stock) is **STRICTLY FORBIDDEN**.

---

## 19. Idempotency Standards

Elevated mutations (approving POs >₹10k, issuing inventory stock, creating customer invoices) MUST include idempotency keys (`idempotency_key` header or unique transaction ID) to prevent duplicate execution during rapid user clicks or network retries.

---

## 20. Database Transactions (`BEGIN ... COMMIT`)

Multi-step updates (e.g. issuing inventory parts for a machine repair: reducing item stock + creating inventory ledger entry + updating complaint status) MUST execute inside a single PostgreSQL transaction. If any step fails, the entire transaction MUST roll back.

---

## 21. Partial Failure Handling

When a multi-step operation partially fails (e.g. breakdown complaint resolved, but email notification failed to send):
* The core database update MUST remain committed.
* The optional notification failure MUST be caught gracefully and logged without failing the main user flow.

---

## 22. Optimistic Update Protocols

1. **UX Responsiveness**: Optimistic updates are permitted for low-risk UI toggles (e.g. bookmarking a task, toggling table column visibility).
2. **Rollback Requirement**: If the server rejects an optimistic mutation, the UI state MUST immediately roll back to the original server value and display an error toast.

---

## 23. Rollback State Management

When a form submission or table row mutation fails, local component state MUST restore original values, preventing the UI from rendering uncommitted optimistic edits.

---

## 24. Race Condition Safeguards

1. **Request Cancellation**: Rapid search or filter typing MUST cancel stale in-flight requests using `AbortController`.
2. **Debouncing**: Search inputs in `FilterToolbar` MUST enforce a 300ms debounce delay before triggering server queries.

---

## 25. Loading State Standards

1. **Visual Skeletons**: Async page loads MUST display Geist-compliant skeleton placeholders (`apps/web/components/ui/skeletons.tsx`) matching the layout of the incoming data components.
2. **No Layout Shift**: Skeleton dimensions MUST match final component heights to guarantee CLS ≤ 0.1.

---

## 26. Empty State Standards

1. **Semantic Distinction**: Empty datasets ("No records found") MUST be visually and semantically distinct from loading errors or permission denials.
2. **Actionable Skeletons**: Empty states MUST include clear illustrations, descriptive text, and a primary call-to-action button (e.g. "+ Add New Machine").

---

## 27. Error State Standards

When a query fails, component cards MUST render explicit error states featuring an error icon, error explanation, and a "Try Again" retry button.

---

## 28. Not Found Handling (`not-found.tsx`)

Requesting non-existent resources (`/machines/invalid-id`) MUST trigger Next.js `notFound()`, rendering the custom 404 page with navigation links back to `/dashboard`.

---

## 29. Offline & Degraded Service Handling

When optional background services (analytics, notification dispatches) fail, the core operational dashboard MUST continue operating seamlessly in degraded mode.

---

## 30. Real-Time Connection Failures

If Supabase Realtime subscriptions disconnect:
* The UI MUST attempt exponential backoff reconnection.
* Upon reconnection, the component MUST trigger a background refetch (`router.refresh()`) to pull missing state changes.

---

## 31. External Service Failure Resilience

External integrations (SendGrid, Twilio, WhatsApp, QStash) MUST be wrapped in isolated `try/catch` blocks so third-party downtime never crashes core application pages.

---

## 32. Forms & Mutations Double-Submission Prevention

Form submit buttons MUST display a loading spinner (`<Loader2 className="animate-spin" />`) and remain disabled (`disabled={isSubmitting}`) while mutations are in progress.

---

## 33. Bulk Operation Resilience

Bulk mutations (e.g. bulk machine status updates) MUST return detailed progress summaries (`3 of 5 updated successfully; 2 failed due to missing branch permissions`), permitting partial success without forcing a full retry.

---

## 34. Import & Export Resilience

1. **Excel/CSV Import Validation**: Uploaded spreadsheets MUST validate headers, row data types, and required fields before committing database inserts.
2. **Export Failures**: Export failures MUST prevent file downloads and notify the user via error toast.

---

## 35. Error Logging Infrastructure (`lib/audit.ts`)

Unexpected runtime errors and failed mutations MUST be logged via `logAudit()` in `apps/web/lib/audit.ts` with sanitized metadata.

---

## 36. Recovery UX Principles

Every error screen or error toast MUST provide a clear path forward:
* "Try Again" button for network or query failures.
* "Go to Dashboard" button for 404 or authorization failures.
* "Contact Administrator" button for persistent system errors.

---

## 37. Security Integration

Error messages MUST NOT bypass security boundaries. Validation and error responses MUST NEVER reveal auth tokens, database credentials, or unauthorized record data.

---

## 38. Privacy Integration

Errors and audit logs MUST adhere to `AI/RULES/DATA-PROTECTION-PRIVACY.md`, scrubbing passwords, Aadhaar/PAN PII, and financial keys before logging.

---

## 39. Performance Integration

Error handling MUST NOT create infinite retry loops, request storms, or memory leaks.

---

## 40. Accessibility Integration

1. **Screen-Reader Alerts**: Error notifications MUST use `role="alert"` and `aria-live="assertive"` so screen readers announce failures immediately.
2. **Keyboard Focus**: Modal error dialogs MUST trap focus and allow `Escape` key dismissal.

---

## 41. Responsive Design Integration

Loading skeletons, error states, and toast notifications MUST look identical and remain fully functional across Mobile (≤640px), Tablet (641px–1023px), and Desktop (≥1024px).

---

## 42. Testing & Verification

1. **Typecheck Audit**: `pnpm typecheck` across all 9 monorepo workspace packages.
2. **Validation Tests**: Unit tests in `packages/validation` verifying schema parsing on valid and invalid payloads.

---

## 43. Regression Protection Policy

Before modifying shared Zod schemas or error boundary components:
1. Audit downstream impact across all 26 domain modules.
2. Verify zero unhandled promise rejections exist.
3. Verify zero compilation errors across all workspace packages (`pnpm typecheck`).

---

## 44. Forbidden Resilience Anti-Patterns (NEVER INTRODUCE)

AI agents MUST NEVER introduce any of the following validation/error anti-patterns:
* ❌ **Silent Error Swallowing**: Empty `catch {}` blocks that swallow errors silently without logging or notifying the user.
* ❌ **Fake Success Notifications**: Displaying "Saved Successfully" toasts before the server confirms mutation success.
* ❌ **Fake Fallback Data**: Replacing failed API queries with mock data in production builds.
* ❌ **Infinite Retry Loops**: Un-bounded retries on failing non-idempotent mutations.
* ❌ **Raw Error Exposure**: Exposing raw database connection strings or SQL stack traces to end-users.
* ❌ **Confusing Empty & Error States**: Showing "No records found" when a database query actually failed due to a network error.

---

## 45. Change Policy

Before modifying any validation schema or error handling pattern:
1. Identify affected forms, API routes, and Server Actions.
2. Formulate the smallest correct code change.
3. Verify zero regressions across validation, error recovery, or visual design.

---

## 46. AI Agent Pre-Implementation Checklist

Before writing code, every AI agent MUST complete this mental checklist:

* [ ] Are form inputs validated on both client and server using canonical Zod schemas from `@reachinternational/validation`?
* [ ] Is the submit button disabled with a loading spinner during mutations to prevent double submissions?
* [ ] Are database errors caught and mapped to polite, actionable user messages?
* [ ] Are multi-step database updates wrapped in PostgreSQL transactions?
* [ ] Are loading skeletons and empty states implemented following Geist design system tokens?
* [ ] Does the error notification announce via `aria-live` for accessibility?

---

## 47. AI Agent Post-Implementation Resilience Audit

After completing code modifications, every AI agent MUST perform the following verification protocol:

1. **Compilation Audit**: Run `pnpm typecheck` across all 9 monorepo workspace packages.
2. **Resilience & Validation Audit**: Confirm error boundaries, toast alerts, and Zod schemas function as expected under failure scenarios.
3. **Design & Responsive Audit**: Confirm visual compliance with `DESIGN.md` across Mobile, Tablet, and Desktop.
4. **Memory Synchronization**: Update `AI/STATE.md`, `AI/CURRENT_TASK.md`, `AI/CHANGELOG_AI.md`, and `README.md`.

---
