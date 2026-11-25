# STRICT MONOREPO RULE: WEB & NATIVE APP PARITY — `AI/RULES/WEB-MOBILE-PARITY.md`

> **ONE MONOREPO = ONE PRODUCT = ONE SOURCE OF TRUTH = CONSISTENT WEB & NATIVE EXPERIENCE.**
>
> **ABSOLUTE RULE**: Any change that affects shared product functionality, business logic, UI/UX, user workflows, API integration, data handling, validation, permissions, or application behavior in one platform MUST be evaluated and implemented consistently in the other platform.
>
> The web and native applications must remain functionally equivalent, visually consistent, and behaviorally aligned. No AI agent is exempt from this rule.

---

## 1. CORE RULE — MANDATORY CROSS-PLATFORM CONSISTENCY

This monorepo contains two client applications:
- **Web Application** (`apps/web`)
- **Native Mobile Application** (`apps/mobile`)

**ABSOLUTE RULE: Any change that affects shared product functionality, business logic, UI/UX, user workflows, API integration, data handling, validation, permissions, or application behavior in one platform MUST be evaluated and implemented consistently in the other platform.**

The web and native applications must remain functionally equivalent, visually consistent, and behaviorally aligned.

No AI agent is exempt from this rule.

This is a mandatory project-wide engineering policy, not a suggestion.

---

## 2. BEFORE MAKING ANY CHANGES — MANDATORY CODEBASE AUDIT

Before modifying ANY code, every AI agent MUST:

1. Read and understand the relevant project structure.
2. Identify the existing implementation in the web application (`apps/web`).
3. Identify the corresponding implementation in the native application (`apps/mobile`).
4. Read the relevant frontend components, hooks, services, API integrations, backend routes, database schemas, migrations, types, validation logic, and related dependencies.
5. Examine existing application behavior and relevant logs where available.
6. Determine whether the requested change is actually necessary.
7. Check whether the requested change already exists in either application.
8. Identify potential regressions, dependencies, and side effects.

**Never modify code based on assumptions. Never implement a change before understanding the existing implementation.**

---

## 3. CROSS-PLATFORM CHANGE REQUIREMENT

Whenever a change is requested, classify its impact:

### A. UI/UX Changes
Examples:
- New screens or pages
- Buttons, forms, dialogs, modals, and dropdowns
- Tables, cards, lists, and dashboards
- Filters, search, sorting, and pagination
- Loading, empty, success, and error states
- Typography, spacing, colors, icons, and layouts
- Responsive behavior and navigation

Requirement:
Implement equivalent functionality and consistent design behavior in both web and native applications.
Use platform-appropriate components and interaction patterns while preserving the same design language and user experience.

### B. Backend / Business Logic Changes
Examples:
- API endpoints and integrations
- Authentication and authorization
- Role-based permissions
- Database schema and migrations
- CRUD operations
- Validation and business rules
- Data models and relationships
- Error handling and response structures
- Notifications and background operations

Requirement:
Ensure both applications consume and support the updated backend behavior.
If backend changes affect existing web or native workflows, update both clients accordingly.
Do not leave one platform using outdated API contracts, validation rules, or business logic.

### C. Data and State Changes
Examples:
- New fields
- Updated database relationships
- Changed status values
- Updated filters
- Modified calculations
- Pagination changes
- Local storage or caching changes

Requirement:
Ensure both platforms correctly read, write, validate, display, and synchronize the updated data.

---

## 4. NO PLATFORM SHOULD BE LEFT BEHIND

The following situations are **STRICTLY PROHIBITED**:

- Implementing a feature in web but ignoring native.
- Implementing a feature in native but ignoring web.
- Updating backend functionality without checking both clients.
- Updating a database schema without checking both clients.
- Fixing a bug in one platform while leaving the same bug in the other.
- Using different business rules for the same feature.
- Introducing inconsistent validation or permissions.
- Removing functionality from one platform without evaluating its counterpart.
- Marking a task complete when the other platform has not been checked.

If a change is relevant to both platforms, both must be updated within the same task whenever technically feasible.

---

## 5. EXCEPTIONS — ONLY WHEN JUSTIFIED

Not every implementation must use identical code.

Platform-specific implementations are allowed when technically necessary.

Examples:
- Web-specific browser APIs.
- Native device permissions.
- Camera, GPS, Bluetooth, and biometric integrations.
- Platform-specific navigation (e.g. Next.js App Router vs Expo Router file stacks).
- Responsive web layouts versus mobile layouts (e.g. Desktop 1024px+ tables vs Mobile ≤640px touch cards).

However:

**Platform-specific implementation does NOT justify platform-specific business behavior.**

The underlying functionality, business rules, permissions, validation, data integrity, and expected outcomes must remain consistent.

If a feature genuinely applies to only one platform:
1. Explain why the other platform does not require it.
2. Document the reason.
3. Do not introduce unnecessary changes to the other platform.

Never silently skip cross-platform implementation.

---

## 6. IMPLEMENTATION WORKFLOW — STRICT ORDER

Every AI agent MUST follow this workflow:

```text
STEP 1: UNDERSTAND   → Read relevant codebase, architecture, components, backend, & existing implementation.
                             ↓
STEP 2: AUDIT        → Inspect BOTH web and native implementations.
                             ↓
STEP 3: EVALUATE     → Determine whether change is necessary, already implemented, or requires modification.
                             ↓
STEP 4: IMPACT       → Identify affected platforms, APIs, database models, shared packages, & workflows.
                             ↓
STEP 5: PLAN         → Prepare a cross-platform implementation plan before editing.
                             ↓
STEP 6: IMPLEMENT    → Implement required changes in all affected layers and platforms.
                             ↓
STEP 7: VERIFY       → Check both applications for correctness, parity, business logic, APIs, & regressions.
                             ↓
STEP 8: REPORT       → Provide a clear summary of what changed in web, native, backend, and database.
```

- **STEP 1 — UNDERSTAND**: Read the relevant codebase, architecture, components, backend, and existing implementation.
- **STEP 2 — AUDIT**: Inspect both web and native implementations.
- **STEP 3 — EVALUATE**: Determine whether the requested change is necessary, already implemented, or requires modification.
- **STEP 4 — IMPACT ANALYSIS**: Identify all affected platforms, APIs, database models, shared packages, and dependent workflows.
- **STEP 5 — PLAN**: Prepare a cross-platform implementation plan before editing.
- **STEP 6 — IMPLEMENT**: Implement the required changes in all affected layers and platforms.
- **STEP 7 — VERIFY**: Check both applications for:
  - Functional correctness.
  - UI/UX consistency.
  - Business logic consistency.
  - API compatibility.
  - Validation consistency.
  - Permission consistency.
  - Data integrity.
  - Error and loading states.
  - Regression issues.
- **STEP 8 — REPORT**: Provide a clear summary of what changed in web, native, backend, and database.

---

## 7. SHARED CODE AND ARCHITECTURE

Before creating duplicate implementations, inspect whether reusable logic already exists.

Prefer shared packages for:
- TypeScript types and interfaces (`@reachinternational/types`)
- API contracts & permissions (`@reachinternational/permissions`)
- Validation schemas (`@reachinternational/validation`)
- Constants and enums
- Business rules & utilities (`@reachinternational/utils`)
- Shared design tokens (`@reachinternational/design-tokens`)
- Shared configuration

Keep platform-specific rendering and interactions in their respective applications.
Do not introduce unnecessary abstractions or refactor unrelated code.
Always reuse existing project components, conventions, utilities, and architecture wherever possible.

---

## 8. TESTING REQUIREMENTS

Before declaring a task complete:

- Run relevant web application checks (`pnpm --filter web typecheck`, build, Playwright/Node test scripts).
- Run relevant native application checks (`pnpm --filter mobile typecheck`, `node apps/mobile/test/run-tests.mjs`).
- Run backend tests where applicable (Supabase integration scripts, RLS checks).
- Run type checking and linting where configured (`pnpm typecheck`).
- Verify API compatibility across both applications.
- Verify database migrations and data compatibility where applicable.
- Test the affected workflows on both platforms.
- Check that existing unrelated functionality has not regressed.

If a test cannot be executed, explicitly disclose it. Never claim an unexecuted test passed.

---

## 9. COMPLETION GATE — NON-NEGOTIABLE

A cross-platform task MUST NOT be marked COMPLETE until:

- [ ] Existing codebase was audited.
- [ ] Necessity of the requested change was evaluated.
- [ ] Web implementation was inspected and updated if necessary.
- [ ] Native implementation was inspected and updated if necessary.
- [ ] Backend and database impacts were addressed.
- [ ] Both platforms follow the same business rules.
- [ ] Both platforms support the updated API contracts.
- [ ] Relevant checks and tests were performed.
- [ ] Platform-specific exceptions were justified and documented.

If only one platform was modified, the agent MUST explicitly state:
1. Which platform was modified.
2. Why the other platform did not require modification.
3. What evidence supports that decision.

Do not claim cross-platform completion without verifying both applications.

---

## 10. FINAL DIRECTIVE TO ALL AI AGENTS

These rules apply to every AI agent, every developer workflow, every feature, every bug fix, every refactor, and every future modification in this monorepo.

Before changing anything, understand the existing implementation.
Before implementing anything, inspect both platforms.
Before completing anything, verify cross-platform consistency.

**ONE MONOREPO = ONE PRODUCT = ONE SOURCE OF TRUTH = CONSISTENT WEB & NATIVE EXPERIENCE.**

Treat cross-platform parity as a mandatory engineering requirement, not optional follow-up work.

If the requested implementation conflicts with these rules, stop and explain the conflict before proceeding.

---

## 11. TECHNICAL PARITY SPECIFICATIONS — THE 8 DIMENSIONS

Every screen, component, and user workflow must achieve 100% parity across all 8 dimensions:

| Dimension | Standard | Enforcement Rule |
| :--- | :--- | :--- |
| **1. UI/UX** | Identical visual components and interaction affordances | Same buttons, cards, badges, modal dialogs, segmented toggles, empty states, and status pills. |
| **2. Behavior** | Identical states and lifecycle flows | Same loading skeletons, empty states, error handling, form validations, toast notifications, and confirmation dialogs. |
| **3. Responsiveness** | 3-tier viewport protocol | Mobile (≤640px touch cards), Tablet (641–1023px 2-col grids), Desktop (≥1024px high-density tables). |
| **4. Design** | Vercel Geist design system | 1px hairline borders (`#ebebeb`), whisper shadows, bimodal radius (6px app / 64px tab / 100px pill). |
| **5. Layout** | Identical information hierarchy | Same visual grouping, card metadata order, header controls, and primary action placement. |
| **6. Color** | Identical color tokens | Primary `#0284c7` / `#0ea5e9`, Link `#0070f3` / `#3b82f6`, Success `#10b981`, Warning `#f5a623`, Error `#ee0000`, Info `#3b82f6`, Pending `#f59e0b`, Overdue `#e11d48`. |
| **7. Theme** | Identical Light & Dark modes | Light: `#fafafa` canvas / `#ffffff` cards / `#171717` ink. Dark: `#0a0a0a` canvas / `#171717` cards / `#fafafa` ink. |
| **8. Typography** | Geist Sans & Geist Mono | Exact matching font scale, line heights, and negative letter tracking (-2.4px display). |

---

## 12. 100% COLOR & THEME PARITY INVARIANTS

Web and Native Mobile must use the **exact same color tokens** across both Light and Dark themes:

### 12.1 Foundation Colors
- **Ink Tone (Headings & Primary Text)**:
  - Light: `#171717` (`var(--color-ink)`, `theme.colors.ink`)
  - Dark: `#fafafa` (`var(--color-ink)`, `theme.colors.ink`)
- **Canvas (Page Background)**:
  - Light: `#fafafa` (`var(--color-canvas)`, `theme.colors.canvas`)
  - Dark: `#0a0a0a` (`var(--color-canvas)`, `theme.colors.canvas`)
- **Canvas Elevated (Cards, Modals, Inputs)**:
  - Light: `#ffffff` (`var(--color-canvas-elevated)`, `theme.colors.canvasElevated`)
  - Dark: `#171717` (`var(--color-canvas-elevated)`, `theme.colors.canvasElevated`)
- **Hairline Border (1px crisp structural border)**:
  - Light: `#ebebeb` (`var(--color-hairline)`, `theme.colors.hairline`)
  - Dark: `#262626` (`var(--color-hairline)`, `theme.colors.hairline`)
- **Hairline Soft (Subtle panels, alternating rows)**:
  - Light: `#f2f2f2` (`var(--color-hairline-soft)`, `theme.colors.hairlineSoft`)
  - Dark: `#1a1a1a` (`var(--color-hairline-soft)`, `theme.colors.hairlineSoft`)

### 12.2 Semantic Operational Status Colors
- **Success / Operational**: `#10b981` (soft `#ecfdf5`, deep `#059669`) / Dark `#34d399` (soft `#064e3b`).
- **Warning / Caution**: `#f5a623` (soft `#ffefcf`, deep `#ab570a`) / Dark `#fbbf24` (soft `#78350f`).
- **Error / Breakdown**: `#ee0000` (soft `#fef2f2`, deep `#c50000`) / Dark `#f87171` (soft `#450a0a`).
- **Info**: `#3b82f6` (soft `#eff6ff`, deep `#2563eb`) / Dark `#60a5fa` (soft `#1e3a8a`).
- **Pending**: `#f59e0b` (soft `#fffbeb`, deep `#d97706`) / Dark `#fbbf24` (soft `#78350f`).
- **Overdue**: `#e11d48` (soft `#fff1f2`, deep `#be123c`) / Dark `#fb7185` (soft `#4c0519`).

---

## 13. NATIVE & WEB ARCHITECTURE SPECIALIZATION

While visual design and behavior are 100% identical, backend data access and runtime architecture leverage platform-native strengths:

### 13.1 Native Mobile Platform (`apps/mobile`)
- **Data Layer**: **TanStack Query (`@tanstack/react-query`)** for server state with 30s default stale time, reactive cache invalidation, and pull-to-refresh (`RefreshControl`).
- **Hardware-Backed Auth**: **`expo-secure-store`** backed by Android KeyStore and iOS Keychain. Raw tokens are never stored in unencrypted AsyncStorage.
- **Offline Resilience**: Offline mutations save into persistent local queue in `AsyncStorage` with `@react-native-community/netinfo` connectivity monitoring and ambient status banner (`OfflineBanner.tsx`).
- **Ergonomics**: Minimum 44px touch targets (`minHeight: 44`), bottom sheets instead of desktop popovers, scrollable horizontal filter strips, and tactile haptic feedback (`Haptics.selectionAsync()`).
- **Type Safety**: Strictly use `<Text variant="...">` with zero raw typography properties in `StyleSheet.create`.

### 13.2 Web Platform (`apps/web`)
- **React Server Components (RSC)**: Fetch data server-side by default, eliminating client waterfalls. Leaf-node `'use client'` components only.
- **Data Access Layer (DAL)**: All reads go through `lib/dal.ts` and `lib/queries/*` using per-request Supabase SSR clients. No `SELECT *`.
- **Server Actions (`app/actions/*`)**: All mutations go through Server Actions with canonical Zod validation, role authorization, audit logging, and tag cache revalidation (`revalidateTag`).
- **SSR Auth**: Supabase Auth managed securely via HTTP-only cookies (`@supabase/ssr`).
