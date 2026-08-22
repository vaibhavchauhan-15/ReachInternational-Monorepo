# ReachInternational Production Testing & Quality Assurance Rules

> **AUTHORITATIVE TESTING & QUALITY ASSURANCE POLICY FOR AI AGENTS**  
> *This document establishes the binding testing, verification, typechecking, quality gate, responsive UI auditing, security validation, and quality assurance policy for all applications (`apps/web`, `apps/mobile`), shared packages (`packages/*`), data access layers (`lib/dal.ts`), server actions, database queries, and storage systems within the ReachInternational monorepo. Every AI coding agent MUST read, obey, and enforce these rules before declaring any task or feature completed.*

---

## 1. Purpose

The purpose of ReachInternational's Testing & Quality Assurance policy is to guarantee that **no code is considered production-ready merely because it compiles or renders visually**. Every new page, component, module, API route, Server Action, database migration, or responsive view MUST pass a comprehensive multi-tier quality gate prior to deployment.

A feature is production-ready ONLY when it satisfies:
```text
Architecture + Functional + UI + UX + Responsive + Accessibility + Validation + Security + Auth + DB + API + Performance + Error Handling + Regression + Production Build
```

---

## 2. Source of Truth

ReachInternational establishes authoritative canonical sources of truth for quality verification:
1. **Monorepo Build & Type Verification**: Root script `pnpm typecheck` (`turbo run typecheck`) across all 9 workspace packages.
2. **Schema & Input Validation**: `@reachinternational/validation` Zod schema validation.
3. **Role & Permission Coverage**: `@reachinternational/permissions` RBAC matrix.
4. **Seed Verification Tooling**: `node supabase/verify_seed.mjs` verifying database seed data integrity.
5. **Database RLS Policies**: Supabase PostgreSQL 35 SQL migrations enforcing Row Level Security.
6. **Design Tokens & UI Standards**: `DESIGN.md` Vercel Geist System tokens and `AI/RULES/DESIGN-SYSTEM.md`.

---

## 3. Existing Testing & Verification Stack

ReachInternational utilizes an integrated verification toolchain:
* **Typecheck Verification**: TypeScript 5.0+ (`pnpm typecheck`) enforcing strict type safety across 9 workspace packages.
* **Build Verification**: Turborepo 2.10+ (`pnpm build`) verifying production bundles for `apps/web` and `apps/mobile`.
* **Seed & Database Audit**: Custom Node.js verification (`pnpm verify:seed`) checking database tables and foreign key integrity.
* **Validation & Schema Tests**: Zod schema `.parse()` / `.safeParse()` execution in shared package `@reachinternational/validation`.

---

## 4. Testing & Quality Architecture

Quality assurance is structured across five verification layers:

```text
Layer 1: Static Type & Build Audit  → pnpm typecheck & pnpm build (0 errors)
Layer 2: Runtime Schema Validation   → Zod schema validation in @reachinternational/validation
Layer 3: Security & Scope Audit      → RLS policies, verifySession(), getUserBranchIds()
Layer 4: Responsive & UI/UX Audit    → 3-tier viewport compliance (Mobile/Tablet/Desktop)
Layer 5: End-to-End Workflow Audit   → Verification of complete operational business flows
```

---

## 5. Testing Pyramid Guidance

AI agents MUST organize testing efforts according to practical risk:
```text
        E2E / Workflow Verification (Critical User Journeys)
       /                                                   \
   Integration & DAL Verification (Server Actions & APIs)
  /                                                         \
 Unit & Schema Tests (Zod Schemas & Permission Matrix)
```

---

## 6. Unit Testing Standards

1. **Pure Logic Coverage**: Unit tests MUST validate pure functions, currency/date formatters in `@reachinternational/utils`, permission evaluation in `@reachinternational/permissions`, and Zod schemas in `@reachinternational/validation`.
2. **Deterministic Inputs**: Unit tests MUST use deterministic input data and avoid reliance on live network connections.

---

## 7. Component Testing Standards

1. **Behavior over Styling**: Test component behavior (props, state changes, user interactions, validation feedback) rather than raw CSS string values.
2. **Accessibility Attributes**: Component tests MUST verify proper ARIA attributes (`aria-expanded`, `aria-selected`, `role="alert"`).

---

## 8. Page & Layout Testing Standards

Important domain pages (`/dashboard`, `/tasks`, `/machines`, `/service`, `/finance`) MUST be verified for:
* Correct layout structure matching 5-zone vertical composition.
* Loading state skeletons while fetching async server data.
* Actionable empty states when queries return 0 records.
* Proper error boundary fallback rendering on unexpected server errors.

---

## 9. API Endpoint Testing Standards

API endpoints in `apps/web/app/api/` MUST be tested against five standard scenarios:
```text
• Scenario 1: Valid Request         → HTTP 200 OK + Expected DTO Payload
• Scenario 2: Invalid Payload       → HTTP 400 Bad Request + Zod Error Details
• Scenario 3: Unauthenticated       → HTTP 401 Unauthorized
• Scenario 4: Unauthorized Role     → HTTP 403 Forbidden
• Scenario 5: Missing Resource      → HTTP 404 Not Found
```

---

## 10. Server Action Testing Standards

Server Actions in `apps/web/app/actions/` MUST be verified independently of the UI:
1. Verify `verifySession()` blocks unauthenticated execution.
2. Verify `requirePermission()` blocks unauthorized user roles.
3. Verify Zod schemas reject invalid input objects.
4. Verify `logAudit()` records audit events in `public.audit_logs`.

---

## 11. Database Query & Mutation Testing

1. **Transactional Integrity**: Multi-table updates MUST be tested inside PostgreSQL transactions (`BEGIN...COMMIT`).
2. **Constraint Enforcement**: Verify database check constraints reject invalid ranges (e.g. negative hour meter readings).

---

## 12. Row Level Security (RLS) Verification

1. **Non-Bypassable Database Boundaries**: Database access MUST be tested with authentic user contexts (`auth.uid()`).
2. **Tenant & Branch Isolation**: Verify users from Organization A or Branch B CANNOT query or mutate records belonging to Organization B or Branch A.

---

## 13. Authentication Flow Testing

Verify all authentication state transitions:
* Login submission with valid vs invalid credentials.
* Session cookie setting with `HttpOnly`, `Secure`, and `SameSite=Lax` flags.
* Logout execution destroying session cookies and clearing server caches.
* Session expiry triggering clean redirects to `/login`.

---

## 14. Authorization & RBAC Testing

Test permissions across the 13 enterprise roles:
* `super_admin` & `company_admin`: Organization-wide CRUD authority.
* `branch_manager`: Branch-scoped approval authority.
* `service_engineer` & `mechanic`: Assigned breakdown complaint & FSR submit authority.
* `operator` & `client`: Daily meter log & owned fleet view authority.

---

## 15. Form & Input Validation Testing

Forms MUST be tested against:
* Required field validation notices.
* Incorrect data types (e.g. text in numeric phone inputs).
* Out-of-bound values (e.g. rental discount > 15%).
* Double-submission prevention (submit button disabled during active request).

---

## 16. Validation Schema Testing

Validate Zod schemas in `@reachinternational/validation`:
* Ensure valid objects parse cleanly without throwing.
* Ensure invalid objects yield descriptive, field-specific error messages.

---

## 17. Error Handling & Recovery Testing

1. **Network Disconnects**: Test application behavior during network dropouts to verify error toasts appear.
2. **500 Server Errors**: Test API 500 responses to ensure user-facing error notices display without exposing raw SQL stack traces.

---

## 18. Loading & Empty State Testing

1. **Loading Skeletons**: Verify loading skeletons (`skeletons.tsx`) maintain fixed container dimensions (CLS ≤ 0.1).
2. **Empty States**: Verify 0-row results trigger actionable empty states with CTA buttons rather than blank screens or error banners.

---

## 19. Race Condition & Debounce Testing

Test rapid input typing in search inputs (`FilterToolbar`) to verify that obsolete in-flight queries are cancelled via `AbortController` and 300ms debounce delays are respected.

---

## 20. Optimistic Update & Rollback Testing

1. **Success Flow**: Verify UI updates immediately for low-risk actions.
2. **Failure Rollback**: Verify UI immediately reverts to original server values if the server rejects the optimistic mutation.

---

## 21. CRUD Workflow Testing

Module CRUD operations MUST be tested end-to-end:
```text
Create Record → Query Record in List → Update Record Fields → Soft Delete / Archive Record
```

---

## 22. Business Workflow Transition Testing

Verify state machine transitions across core business workflows:
* **Breakdown Complaint**: `Reported` → `Assigned` → `In Repair` → `Resolved & Approved`.
* **Purchase Order**: `Draft` → `Submitted` → `Approved` → `Fulfilled`.

---

## 23. Bulk Operation Testing

Test bulk action toolbar actions (e.g. bulk machine status updates):
* Verify progress indicators reflect batch processing.
* Verify partial success reporting (`3 of 5 updated; 2 failed due to permissions`).

---

## 24. Import & Export Testing

1. **Excel/CSV Imports**: Test spreadsheet uploads with missing headers or invalid data rows to verify validation rejection.
2. **CSV/PDF Exports**: Verify generated export files scrub secret keys and enforce user branch scoping.

---

## 25. Search, Filter & Sort Testing

1. **Search Precision**: Verify search toolbar filters records matching machine codes, serial numbers, or customer names.
2. **Multi-Filter Combination**: Verify combined filters (e.g. `Branch: DEL-HQ` + `Status: Active`) return precise intersections.

---

## 26. Pagination Testing

Test paginated tables (`EnterpriseTable.tsx`):
* Page slice navigation (`Page 1`, `Page 2`, `Next`, `Previous`).
* Page size toggling (`25`, `50`, `100` rows per page).
* Verification that pagination maintains branch scoping across all page slices.

---

## 27. 3-Tier Responsive Layout Testing

Every UI component and page MUST be tested across three explicit viewport ranges:

```text
VIEWPORT RANGE    LAYOUT ADAPTATION PROTOCOL                    VERIFICATION REQUIREMENT
──────────────────────────────────────────────────────────────────────────────────────────
• Mobile (≤640px)  Single-column stack, card reflow (block sm:hidden) Min 44px touch targets
• Tablet (641-1023px) 2-column grid, adaptive modals, scrollable strips  Collapsible sidebar
• Desktop (≥1024px) High-density tables (hidden sm:block), multi-col toolbars Full desktop shell
```

---

## 28. Cross-Browser Compatibility Standards

Test web applications (`apps/web`) on modern evergreen rendering engines:
* Chromium (Google Chrome, Microsoft Edge)
* Gecko (Mozilla Firefox)
* WebKit (Apple Safari)

---

## 29. Accessibility (a11y) Testing Standards

1. **Keyboard Navigation**: Verify all interactive elements (buttons, inputs, select menus, modals) are fully reachable using `Tab` and executable using `Enter` / `Space`.
2. **Screen-Reader Announcements**: Verify error toasts and dynamic loading states use `role="alert"` and `aria-live="assertive"`.

---

## 30. Visual Regression Prevention

Verify visual alignment against `DESIGN.md`:
* Background Canvas: `#fafafa` (Dark: `#09090b`).
* Elevated Cards: `#ffffff` (Dark: `#18181b`).
* Border Hairlines: 1px `#ebebeb` (Dark: `#27272a`).
* Primary Ink: `#171717` (Dark: `#f4f4f5`).

---

## 31. Theme Verification (Bimodal Light & Dark Modes)

Test both Light and Dark themes to verify:
* Zero hardcoded hex colors (e.g. `bg-white`, `text-black`).
* Proper usage of CSS variables (`bg-background`, `text-foreground`, `border-border`).
* Legible text contrast ratios across all viewports.

---

## 32. Performance & Core Web Vitals Audit

Verify Core Web Vitals thresholds:
* **LCP (Largest Contentful Paint)**: ≤ 2.5 seconds.
* **INP (Interaction to Next Paint)**: ≤ 200 milliseconds.
* **CLS (Cumulative Layout Shift)**: ≤ 0.1.

---

## 33. Security Testing Standards

1. **Untrusted Client Model**: Verify server routes reject unauthorized access even if client-side UI controls are hidden.
2. **Secret Leakage Audit**: Verify zero server secrets (`SUPABASE_SERVICE_ROLE_KEY`) are exposed in client bundles.

---

## 34. Data Privacy Testing Standards

1. **PII Masking Audit**: Verify Aadhaar, PAN, and Bank Account numbers are masked (`XXXX-XXXX-1294`).
2. **Private File Audit**: Verify confidential documents require time-limited signed URLs (`createSignedUrl`).

---

## 35. Build, Type & Lint Testing Standards

Before declaring any feature completed, AI agents MUST execute:
```bash
pnpm typecheck
```
**Mandatory Requirement**: `Tasks: 9 successful, 9 total` (0 compilation errors).

---

## 36. Dependency Impact Audit

When workspace packages (`packages/*`) are updated:
* Audit downstream imports across `apps/web` and `apps/mobile`.
* Verify zero breaking API signature changes are introduced.

---

## 37. Database Migration Verification

Test new SQL migrations (`supabase/migrations/`):
* Run seed verification script (`pnpm verify:seed`).
* Verify schema changes preserve existing Row Level Security policies.

---

## 38. Deterministic Test Data & Fixtures

Tests MUST use synthetic, deterministic test data fixtures. Embedding real customer phone numbers, personal emails, or production credentials in test files is **STRICTLY FORBIDDEN**.

---

## 39. Mocking Strategy

Mock third-party external services (SendGrid, Twilio, WhatsApp, QStash) during automated testing. Internal database queries and RLS policies MUST be tested against real local Supabase instances.

---

## 40. End-to-End (E2E) Workflow Verification

Verify critical enterprise journeys:
1. Engineer logs breakdown complaint → Service Manager assigns engineer → Engineer completes FSR → Manager approves.
2. Store Manager creates Purchase Order → Finance Manager approves PO → Store Manager receives inventory.

---

## 41. Test Determinism & Flakiness Prevention

1. **No Arbitrary Sleeps**: Using `sleep(5000)` in test scripts is FORBIDDEN. Use explicit element waits or network assertions.
2. **Isolated Test Execution**: Tests MUST clean up temporary test records to prevent test pollution.

---

## 42. Test Coverage Priorities

Prioritize test coverage for high-risk modules:
* Security & Auth (`lib/dal.ts`, `@reachinternational/permissions`)
* Financial Ledgers & PO Approvals (`apps/web/app/actions/finance.ts`)
* Inventory Stock Mutations (`apps/web/app/actions/inventory.ts`)
* Zod Input Validation (`packages/validation`)

---

## 43. Continuous Integration (CI) Verification

Code committed to the repository MUST pass all CI build pipeline checks without bypassing lint rules, disabling typecheck, or suppressing errors.

---

## 44. Production Build Validation

Before marking a phase complete, verify that production bundles build cleanly:
```bash
pnpm build
```

---

## 45. Regression Protection Protocol

AI agents MUST run `pnpm typecheck` after any code modification to guarantee zero regressions across the monorepo.

---

## 46. Change-Risk Testing Matrix

```text
CHANGE RISK LEVEL   REQUIRED VERIFICATION PROTOCOL
──────────────────────────────────────────────────────────────────────────────────────────
• Low Risk          pnpm typecheck + visual UI check (Mobile/Desktop)
• Medium Risk       pnpm typecheck + Zod schema validation + component test
• High Risk (Auth/DB) pnpm typecheck + pnpm build + RLS security audit + full workflow test
```

---

## 47. Test Failure Triage Protocol

When a test or compilation check fails:
1. Identify whether the root cause is a product bug, schema mismatch, or broken test assertion.
2. Fix the underlying application code or update the test assertion to reflect authoritative domain requirements.
3. NEVER delete failing tests or suppress type errors (`any`, `@ts-ignore`) to pass quality gates.

---

## 48. Flaky Test Elimination Policy

Flaky tests MUST be debugged and fixed at the source. Automatically retrying failing tests indefinitely without root-cause resolution is FORBIDDEN.

---

## 49. Mandatory Quality Gate

A task is NOT COMPLETE until all steps of the Quality Gate pass:
```text
1. Typecheck Audit     → pnpm typecheck (0 errors across 9 packages)
2. Build Audit         → pnpm build (Clean bundle build)
3. Security Audit      → RLS policies and verifySession() active
4. Design System Audit → Geist tokens and colors matched
5. Responsive Audit    → 3-tier viewport compliance (Mobile/Tablet/Desktop)
6. Accessibility Audit → ARIA tags and keyboard navigation verified
7. Memory Sync Audit   → AI/STATE.md, CURRENT_TASK.md, CHANGELOG_AI.md, README.md updated
```

---

## 50. Forbidden Testing & QA Anti-Patterns (NEVER INTRODUCE)

AI agents MUST NEVER introduce any of the following testing anti-patterns:
* ❌ **Suppressing Type Errors**: Using `any` or `@ts-ignore` to bypass `pnpm typecheck`.
* ❌ **Deleting Failing Tests**: Removing failing tests to force a green build status.
* ❌ **Fake Assertions**: Writing tests with `expect(true).toBe(true)` that test nothing.
* ❌ **Production Secrets in Tests**: Hardcoding real API keys or production database credentials in test files.
* ❌ **Single-Viewport Testing**: Testing UI solely on desktop screens while breaking mobile touch card reflow.
* ❌ **Ignoring Console Errors**: Declaring UI work complete with unresolved critical JavaScript errors.

---

## 51. Change Policy

Before executing any codebase modification:
1. Assess change risk level using the Change-Risk Matrix.
2. Formulate the smallest correct code change.
3. Execute post-implementation Quality Gate verification.

---

## 52. AI Agent Pre-Implementation Testing Checklist

Before writing code, every AI agent MUST complete this mental checklist:

* [ ] Have I identified the risk level of the requested change?
* [ ] Will my changes affect shared packages (`@reachinternational/*`)?
* [ ] Have I planned how to verify authentication, authorization, and RLS boundaries?
* [ ] Have I verified responsive layout requirements across Mobile, Tablet, and Desktop?

---

## 53. AI Agent Post-Implementation QA Audit

After completing code modifications, every AI agent MUST perform the following mandatory QA verification protocol:

1. **Monorepo Compilation Audit**: Run `pnpm typecheck` and verify `Tasks: 9 successful, 9 total` (0 errors).
2. **Production Build Audit**: Verify clean build execution if build scripts are affected (`pnpm build`).
3. **Responsive & Design Audit**: Confirm compliance with `DESIGN.md` across Mobile, Tablet, and Desktop.
4. **Security & Privacy Audit**: Confirm RLS policies, `verifySession()`, and log scrubbing remain 100% active.
5. **Memory Synchronization**: Update `AI/STATE.md`, `AI/CURRENT_TASK.md`, `AI/CHANGELOG_AI.md`, and `README.md`.

---
