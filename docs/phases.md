# ReachInternational — AI Agent Execution Plan
## Web + Mobile Monorepo Migration and Development

> **Purpose:** This is an executable development plan for AI coding agents.  
> It is not merely a roadmap. Agents must follow the phases sequentially, inspect the existing code before changing it, verify every phase, and never mark a phase complete without satisfying its exit criteria.

---

# 0. Mission

Transform the existing ReachInternational Next.js enterprise application into a production-ready monorepo supporting:

1. Existing Next.js web application
2. New React Native + Expo mobile application
3. One shared Supabase PostgreSQL database
4. One shared Supabase Auth system
5. Shared TypeScript types
6. Shared Zod validation
7. Shared RBAC/permission definitions
8. Shared design tokens and brand system
9. Shared API/data contracts
10. Shared platform-independent business rules
11. Shared assets/resources where technically appropriate
12. Mobile-specific layouts and navigation
13. Offline-capable critical field workflows
14. Realtime synchronization where appropriate
15. Production Android and iOS releases

## Fundamental principle

> **One platform, one backend, one source of truth, two clients.**

Do NOT create a separate mobile backend or mobile database unless a later architectural decision explicitly requires one.

---

# 1. Existing Application Baseline

The existing ServiceCentric system is an enterprise heavy-machinery, field-service and operations platform.

Major modules include:

- Dashboard
- My Work
- Machines
- Service / Breakdown Complaints
- Digital Field Service Reports
- Operations
- Rentals
- CRM / Sales
- Finance
- HR
- Inventory
- Purchase Orders
- Delivery Challans
- Branches
- Notifications
- Audit Logs
- User Administration

Current technology includes:

- Next.js
- React
- TypeScript
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Row Level Security
- Tailwind CSS
- shadcn/ui
- Base UI
- Framer Motion
- Recharts
- Zod
- SendGrid
- Twilio
- Upstash QStash

The existing platform contains:

- 13 operational/system roles plus client access
- ORGANIZATION scope
- BRANCH scope
- ASSIGNED scope
- 38+ core database tables
- Existing Server Actions
- Existing Data Access Layer
- Existing RLS policies
- Existing notification engine
- Existing database migrations

The current implementation is the source of truth.

---

# 2. Non-Negotiable Global Rules

AI agents MUST obey these rules during every phase.

## 2.1 Never destroy working functionality

Do not rewrite working modules just because another implementation looks cleaner.

Before modifying an existing system:

- Inspect it.
- Understand dependencies.
- Identify consumers.
- Identify security implications.
- Preserve behavior unless the phase explicitly requires changing it.

## 2.2 Never create a second database

Web and mobile must use the same Supabase project/database architecture for the target environment.

Do not create:

- Mobile PostgreSQL
- Mobile SQLite as the authoritative database
- Separate user data
- Duplicate business records

SQLite/local storage is allowed ONLY as a mobile offline/cache layer.

## 2.3 Never create a second authentication system

Use the existing Supabase Auth architecture.

The same account must work across:

- Web
- Android
- iOS

## 2.4 Never expose privileged secrets to mobile

Never place these in the mobile application:

- Supabase service-role key
- SendGrid API key
- Twilio auth token
- QStash signing keys
- Database credentials
- Private server secrets

Only safe public client configuration may be included.

## 2.5 RLS is a security boundary

Client-side permission checks are NOT security.

Authorization must ultimately be enforced through:

- Supabase RLS
- Secure backend/API logic
- Server-side authorization

Never weaken RLS merely to make mobile development easier.

## 2.6 Do not duplicate RBAC

There must be one canonical role/permission definition.

Web and mobile may have different UI representations, but authorization semantics must remain identical.

## 2.7 Do not duplicate business rules

Do not implement:

```text
Web rule A
Mobile rule B
```

If a business rule is shared, move it into an appropriate shared/domain/backend layer.

## 2.8 Do not make mobile a desktop shrink

Mobile must have mobile-native UX:

- Bottom navigation
- Mobile headers
- Cards
- Bottom sheets
- Touch-friendly controls
- Step-based workflows
- Sticky actions where appropriate
- Mobile-friendly filters
- Native keyboard handling
- Safe-area support

## 2.9 Preserve visual identity

Mobile must use the same:

- Brand colors
- Semantic colors
- Typography hierarchy
- Spacing system
- Radius system
- Elevation/shadow semantics
- Icon language
- Status language
- Light/dark theme behavior

Only layout and interaction patterns should adapt to mobile.

## 2.10 Do not silently change business behavior

If implementation requires a business-rule change:

1. Stop.
2. Document the issue.
3. Explain the impact.
4. Make the minimum safe change only if the phase authorizes it.
5. Update documentation/tests.

## 2.11 Do not delete migrations

Never delete or rewrite historical production migrations casually.

If a schema change is required:

- Create a new migration.
- Keep history intact.
- Test upgrade behavior.
- Test rollback strategy where possible.

## 2.12 Do not mark a phase complete without verification

A phase is complete only when:

- Implementation is complete.
- Type checking passes.
- Relevant tests pass.
- Build passes where applicable.
- Security checks pass where applicable.
- Documentation/state is updated.
- Git diff has been reviewed.
- Exit criteria are satisfied.

---

# 3. Mandatory AI Agent Workflow

Every phase MUST follow this workflow.

```text
READ
 ↓
AUDIT
 ↓
PLAN
 ↓
IMPLEMENT
 ↓
TEST
 ↓
VERIFY
 ↓
DOCUMENT
 ↓
REVIEW DIFF
 ↓
CHECK EXIT CRITERIA
 ↓
MARK COMPLETE
 ↓
NEXT PHASE
```

## Step 1 — READ

Before changing code:

- Read `AGENTS.md` if present.
- Read this `phases.md`.
- Read relevant `AI/PROJECT_MEMORY.md`.
- Read relevant `AI/STATE.md`.
- Read relevant changelog.
- Read the current phase completely.
- Read directly related source files.

## Step 2 — AUDIT

Inspect the existing implementation.

Identify:

- Existing architecture
- Existing dependencies
- Existing imports
- Existing database access
- Existing auth flow
- Existing permissions
- Existing UI behavior
- Existing tests
- Existing environment variables

Never guess about the codebase.

## Step 3 — PLAN

Before editing:

- List files that will change.
- List files that will be created.
- List files that may be deleted.
- Identify risks.
- Identify migration requirements.
- Identify security implications.
- Identify tests required.

For complex changes, break the phase into small implementation steps.

## Step 4 — IMPLEMENT

Implement only the current phase unless a dependency is required.

Avoid unrelated refactoring.

## Step 5 — TEST

Run appropriate checks.

At minimum where applicable:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Use project-specific commands if they already exist.

## Step 6 — VERIFY

Verify behavior manually or through automated tests.

For database/security changes:

- Verify RLS.
- Verify role access.
- Verify unauthorized access fails.

For mobile:

- Verify Android.
- Verify iOS where available.
- Verify small screen.
- Verify keyboard.
- Verify offline behavior where applicable.

## Step 7 — DOCUMENT

Update:

- `AI/STATE.md`
- `AI/CHANGELOG_AI.md`
- Relevant `docs/*.md`

Record:

```text
Phase:
Status:
Date:
Files changed:
Packages changed:
Database changes:
API changes:
Security impact:
Tests:
Known issues:
Next phase:
```

## Step 8 — REVIEW DIFF

Inspect:

```bash
git status
git diff
```

Check for:

- Accidental changes
- Secrets
- Debug code
- Temporary files
- Unused dependencies
- Unrelated modifications
- Broken imports
- Generated files that should not be committed

## Step 9 — CHECK EXIT CRITERIA

Do not continue until every required criterion is satisfied.

If blocked, document the blocker instead of pretending completion.

---

# 4. Phase Completion Format

After every phase, the agent must produce internally or in the project state:

```text
PHASE: <number>
STATUS: COMPLETE | BLOCKED | PARTIAL

IMPLEMENTED:
- ...

FILES:
- ...

PACKAGES:
- ...

DATABASE:
- ...

SECURITY:
- ...

TESTS:
- ...

BUILD:
- ...

KNOWN ISSUES:
- ...

NEXT PHASE:
- ...
```

If status is `BLOCKED`, the agent MUST NOT silently continue to dependent phases.

---

# 5. Phase 0 — Repository and Production Audit

## Objective

Understand the existing application before architectural changes.

## Tasks

- [ ] Inspect repository structure.
- [ ] Read existing `AGENTS.md`.
- [ ] Read project memory/state documentation.
- [ ] Inventory package manager.
- [ ] Inventory dependencies.
- [ ] Inventory environment variables.
- [ ] Inventory Next.js routes.
- [ ] Inventory Server Actions.
- [ ] Inventory API routes.
- [ ] Inventory Supabase clients.
- [ ] Inventory DAL.
- [ ] Inventory RBAC.
- [ ] Inventory RLS.
- [ ] Inventory migrations.
- [ ] Inventory storage buckets.
- [ ] Inventory notification integrations.
- [ ] Inventory scheduled jobs.
- [ ] Inventory shared components.
- [ ] Inventory domain types.
- [ ] Inventory Zod schemas.
- [ ] Identify server-only modules.
- [ ] Identify browser-only modules.
- [ ] Identify web-only UI components.
- [ ] Identify reusable business logic.
- [ ] Identify duplicated logic.
- [ ] Establish current build baseline.
- [ ] Establish current test baseline.

## Required Deliverables

Create/update:

```text
docs/current-architecture.md
docs/current-dependencies.md
docs/current-security.md
docs/current-database.md
```

## Verification

Run the existing:

```bash
install
typecheck
lint
test
build
```

using the project's actual package-manager commands.

## Exit Criteria

- [ ] Current architecture is documented.
- [ ] Current build passes or existing failures are documented.
- [ ] No major security boundary is unknown.
- [ ] Database/RLS structure is understood.

---

# 6. Phase 1 — Monorepo Foundation

## Objective

Convert the repository into a workspace while preserving the existing web application.

## Target Structure

```text
servicecentric/
├── apps/
│   ├── web/
│   └── mobile/
├── packages/
│   ├── types/
│   ├── validation/
│   ├── permissions/
│   ├── design-tokens/
│   ├── api-client/
│   ├── config/
│   └── utils/
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── seed/
├── docs/
├── scripts/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Tasks

- [ ] Choose pnpm workspace.
- [ ] Add Turborepo.
- [ ] Create root package.
- [ ] Create `apps/web`.
- [ ] Move existing Next.js application into `apps/web`.
- [ ] Create empty `apps/mobile`.
- [ ] Create shared package directories.
- [ ] Preserve Supabase migrations.
- [ ] Configure workspace TypeScript.
- [ ] Configure linting.
- [ ] Configure formatting.
- [ ] Configure test infrastructure.
- [ ] Configure build pipeline.
- [ ] Configure workspace scripts.
- [ ] Ensure web development server works.
- [ ] Ensure web production build works.

## Do NOT

- [ ] Do not redesign the web application.
- [ ] Do not change database schema.
- [ ] Do not rewrite authentication.
- [ ] Do not remove working routes.

## Exit Criteria

- [ ] Existing web application works.
- [ ] `apps/web` builds.
- [ ] Workspace installs cleanly.
- [ ] Shared package imports work.
- [ ] No production behavior intentionally changed.

---

# 7. Phase 2 — Shared Type System

## Objective

Create a canonical domain type system.

## Package

```text
packages/types/
```

## Domains

- [ ] User
- [ ] Role
- [ ] Permission
- [ ] Branch
- [ ] Machine
- [ ] Machine assignment
- [ ] Complaint
- [ ] Service record
- [ ] FSR
- [ ] Parts usage
- [ ] Inventory
- [ ] Stock transaction
- [ ] Purchase order
- [ ] Vendor
- [ ] Rental
- [ ] Sales
- [ ] Finance
- [ ] Employee
- [ ] Notification
- [ ] Audit log
- [ ] Common pagination/filter types
- [ ] API error types

## Tasks

- [ ] Generate/synchronize Supabase database types.
- [ ] Create domain-facing types where database types should not leak.
- [ ] Remove unnecessary duplicate interfaces.
- [ ] Export package cleanly.
- [ ] Make web consume shared types.

## Exit Criteria

- [ ] Web uses shared domain types.
- [ ] No contradictory duplicate type definitions remain in touched areas.
- [ ] Typecheck passes.

---

# 8. Phase 3 — Shared Validation

## Package

```text
packages/validation/
```

## Tasks

- [ ] Extract existing Zod schemas.
- [ ] Create shared schemas.
- [ ] Login validation.
- [ ] Machine validation.
- [ ] Complaint validation.
- [ ] FSR validation.
- [ ] Parts request validation.
- [ ] Hour meter validation.
- [ ] Inventory validation.
- [ ] Rental validation.
- [ ] Sales validation.
- [ ] Finance validation.
- [ ] HR validation.
- [ ] Common query/filter validation.
- [ ] Standardize validation errors.

## Exit Criteria

- [ ] Web consumes shared schemas.
- [ ] Validation behavior is unchanged unless explicitly required.
- [ ] Tests cover important schemas.

---

# 9. Phase 4 — Shared RBAC and Permissions

## Objective

One canonical authorization model.

## Package

```text
packages/permissions/
```

## Tasks

- [ ] Define canonical roles.
- [ ] Define canonical permissions.
- [ ] Define ORGANIZATION scope.
- [ ] Define BRANCH scope.
- [ ] Define ASSIGNED scope.
- [ ] Define role-permission mapping.
- [ ] Extract safe reusable permission helpers.
- [ ] Keep server authorization authoritative.
- [ ] Connect UI permission checks to shared definitions.
- [ ] Audit existing RLS against role expectations.
- [ ] Test every role.
- [ ] Test branch isolation.
- [ ] Test assigned isolation.
- [ ] Test organization access.

## Security Requirement

Mobile must never bypass RLS because a permission exists in the UI.

## Exit Criteria

- [ ] One permission definition exists.
- [ ] Web uses it.
- [ ] RLS still protects data.
- [ ] Authorization tests pass.

---

# 10. Phase 5 — Shared Design Tokens

## Objective

Make web and mobile use the same visual language.

## Package

```text
packages/design-tokens/
```

## Token Categories

- [ ] Brand colors
- [ ] Background colors
- [ ] Surface colors
- [ ] Text colors
- [ ] Border colors
- [ ] Success
- [ ] Warning
- [ ] Error
- [ ] Info
- [ ] Pending
- [ ] Overdue
- [ ] Typography
- [ ] Font weights
- [ ] Line heights
- [ ] Spacing
- [ ] Radius
- [ ] Elevation
- [ ] Motion
- [ ] Breakpoints/semantic screen sizes where useful

## Tasks

- [ ] Extract current brand values.
- [ ] Convert to platform-neutral tokens.
- [ ] Map tokens to web CSS variables.
- [ ] Create React Native token adapter.
- [ ] Support light theme.
- [ ] Support dark theme.
- [ ] Document tokens.

## Exit Criteria

Changing a core design token can be reflected consistently across both platforms.

---

# 11. Phase 6 — Shared UI Contract

## Objective

Define reusable visual/component semantics without forcing identical DOM/native implementation.

## Shared Semantics

- [ ] Button variants.
- [ ] Input variants.
- [ ] Typography variants.
- [ ] Status badges.
- [ ] Cards.
- [ ] Empty states.
- [ ] Loading states.
- [ ] Error states.
- [ ] Form field semantics.
- [ ] Validation messages.
- [ ] Icon semantics.

## Web-only

- [ ] HTML tables.
- [ ] Desktop sidebar.
- [ ] Command palette.
- [ ] Browser dialogs.
- [ ] Print engine.
- [ ] Hover interactions.

## Mobile-only

- [ ] Bottom navigation.
- [ ] Bottom sheets.
- [ ] Mobile header.
- [ ] Mobile cards.
- [ ] Native action sheets.
- [ ] Touch interactions.
- [ ] Safe-area layouts.

## Exit Criteria

Shared design semantics exist without coupling mobile to DOM/web-only components.

---

# 12. Phase 7 — Shared API / Data Architecture

## Objective

Make backend access usable by both clients without duplicating business logic.

## Tasks

- [ ] Audit all existing Server Actions.
- [ ] Identify pure business logic.
- [ ] Extract reusable domain logic where safe.
- [ ] Identify actions that require secure server execution.
- [ ] Create API endpoints for mobile-required server operations.
- [ ] Define request contracts.
- [ ] Define response contracts.
- [ ] Define error contracts.
- [ ] Define pagination.
- [ ] Define filters.
- [ ] Define sorting.
- [ ] Define retry behavior.
- [ ] Define authorization behavior.

## Rule

Do not expose sensitive server-side operations directly to the client merely for convenience.

## Exit Criteria

- [ ] Mobile-required operations have a secure access path.
- [ ] Business rules are not duplicated.
- [ ] API contracts are documented.

---

# 13. Phase 8 — Supabase Client and Auth Architecture

## Objective

Support web and mobile against the same Supabase backend.

## Web

Preserve the existing SSR-aware authentication model.

## Mobile

Implement:

- [ ] Supabase JS client.
- [ ] Secure session persistence.
- [ ] Secure storage.
- [ ] Token refresh.
- [ ] Logout.
- [ ] Deep links.
- [ ] Password reset.
- [ ] Session expiration handling.

## Security

- [ ] Public client key only.
- [ ] Never ship service-role key.
- [ ] Never ship server secrets.

## Exit Criteria

Same user can authenticate on web and mobile and receive the same authorization context.

---

# 14. Phase 9 — Expo Mobile Foundation

## Objective

Create the production mobile application foundation.

## Tasks

- [ ] Initialize Expo app.
- [ ] Configure TypeScript.
- [ ] Configure Expo Router.
- [ ] Configure Android package identifier.
- [ ] Configure iOS bundle identifier.
- [ ] Configure app name.
- [ ] Configure icons.
- [ ] Configure splash screen.
- [ ] Configure environment handling.
- [ ] Add Supabase.
- [ ] Add TanStack Query.
- [ ] Add secure storage.
- [ ] Add shared packages.
- [ ] Configure development build.
- [ ] Verify Android.
- [ ] Verify iOS where available.

## Exit Criteria

Clean mobile app boots successfully and can import shared packages.

---

# 15. Phase 10 — Mobile Design System

## Objective

Implement ServiceCentric's existing visual identity natively.

## Tasks

- [ ] Theme provider.
- [ ] Shared colors.
- [ ] Shared typography.
- [ ] Shared spacing.
- [ ] Shared radius.
- [ ] Shared elevation.
- [ ] Shared status colors.
- [ ] Shared button system.
- [ ] Shared input system.
- [ ] Shared cards.
- [ ] Shared badges.
- [ ] Loading skeletons.
- [ ] Empty states.
- [ ] Error states.
- [ ] Light mode.
- [ ] Dark mode.
- [ ] Safe-area support.

## Exit Criteria

Mobile looks like ServiceCentric, not like an unrelated application.

---

# 16. Phase 11 — Mobile Authentication

## Screens

- [ ] Login.
- [ ] Forgot password.
- [ ] Reset password.
- [ ] Pending account.
- [ ] Session expired.
- [ ] Logout.

## Tasks

- [ ] Supabase authentication.
- [ ] Session persistence.
- [ ] Token refresh.
- [ ] Deep-link callback.
- [ ] User profile loading.
- [ ] Role loading.
- [ ] Branch loading.
- [ ] Permission loading.

## Exit Criteria

Authentication works consistently across platforms.

---

# 17. Phase 12 — Mobile Navigation

## Recommended Primary Navigation

```text
Home
My Work
Machines
Notifications
Profile
```

## Tasks

- [ ] Implement bottom tabs.
- [ ] Implement nested stacks.
- [ ] Implement native back behavior.
- [ ] Implement deep links.
- [ ] Implement authenticated route protection.
- [ ] Implement role-aware navigation.
- [ ] Avoid desktop sidebar replication.
- [ ] Avoid excessive primary tabs.

## Exit Criteria

All mobile workflows have a predictable navigation path.

---

# 18. Phase 13 — Mobile Dashboard

## Objective

Use the same dashboard data but adapt presentation.

## Rules

Desktop:

- Tables
- Multi-column layouts
- Large charts

Mobile:

- KPI cards
- Compact summaries
- Scrollable sections
- Lists
- Priority actions
- Compact charts

## Tasks

- [ ] Role-specific dashboard.
- [ ] Loading state.
- [ ] Error state.
- [ ] Empty state.
- [ ] Pull-to-refresh.
- [ ] Cached dashboard data.
- [ ] Permission-aware cards.

## Exit Criteria

Dashboard values match web for the same user/context.

---

# 19. Phase 14 — Mobile My Work

## Objective

Make field work the central mobile experience.

## Tasks

- [ ] Assigned breakdown complaints.
- [ ] Assigned service jobs.
- [ ] Assigned machines.
- [ ] Approval tasks.
- [ ] Meter tasks.
- [ ] Priority.
- [ ] Due date.
- [ ] Status.
- [ ] Quick actions.
- [ ] Pull-to-refresh.
- [ ] Offline cache.

## Exit Criteria

Field users can manage daily assigned work without desktop access for supported workflows.

---

# 20. Phase 15 — Mobile Machines

## Tasks

- [ ] Search.
- [ ] Filter.
- [ ] Machine list.
- [ ] Machine card.
- [ ] Machine details.
- [ ] Technical details.
- [ ] Hour meter.
- [ ] Service history.
- [ ] Compliance.
- [ ] Insurance.
- [ ] Assignment.
- [ ] Customer/site.

## UX

Desktop table becomes:

```text
Search
Filter
Machine Cards
Machine Detail
```

---

# 21. Phase 16 — Mobile Breakdown Complaints

## Workflow

```text
Machine
 ↓
Complaint
 ↓
Hour Meter
 ↓
Location
 ↓
Priority
 ↓
Parts
 ↓
Photos
 ↓
Submit
```

## Tasks

- [ ] Create complaint.
- [ ] View complaint.
- [ ] Update status.
- [ ] Assignment.
- [ ] Notes.
- [ ] Location.
- [ ] Photos.
- [ ] Offline draft.
- [ ] Offline queue.
- [ ] Sync.

## Exit Criteria

Complaint created from mobile appears correctly on web.

---

# 22. Phase 17 — Mobile FSR

## Workflow

```text
Machine
 ↓
Inspection
 ↓
Checklist
 ↓
Work Completed
 ↓
Work Pending
 ↓
Parts
 ↓
Photos
 ↓
Signature
 ↓
Submit
 ↓
Review
```

## Tasks

- [ ] Component checklist.
- [ ] Mark all passed.
- [ ] Work completed.
- [ ] Work pending.
- [ ] Replacement parts.
- [ ] Quantity.
- [ ] Replacement date.
- [ ] Photos.
- [ ] Customer signature.
- [ ] Draft saving.
- [ ] Offline draft.
- [ ] Sync.
- [ ] Submit.
- [ ] Manager review state.
- [ ] Revision flow.
- [ ] PDF generation through approved backend/web mechanism.

## Exit Criteria

Mobile FSR is functionally consistent with the existing web FSR.

---

# 23. Phase 18 — Mobile Operations

## Tasks

- [ ] Daily hour meter.
- [ ] Start/end readings.
- [ ] Fuel.
- [ ] Shift.
- [ ] Condition checks.
- [ ] Operator assignment.
- [ ] Loading.
- [ ] Unloading.
- [ ] Site movement.
- [ ] Relocation.

## Exit Criteria

Operators and supervisors can perform approved operational workflows from mobile.

---

# 24. Phase 19 — Mobile Inventory

## Tasks

- [ ] Product search.
- [ ] Stock availability.
- [ ] Part request.
- [ ] Request status.
- [ ] Issued parts.
- [ ] Stock movement visibility.
- [ ] PO status where permitted.
- [ ] Challan visibility.
- [ ] Barcode/QR capability if required.

## Security

Inventory mutation authority remains backend/RLS controlled.

---

# 25. Phase 20 — Mobile Rentals

## Tasks

- [ ] Customer lookup.
- [ ] Machine availability/status.
- [ ] Agreement details.
- [ ] Dispatch.
- [ ] Delivery challan.
- [ ] Return inspection.
- [ ] Meter.
- [ ] Fuel.
- [ ] Damage photos.
- [ ] Damage report.

---

# 26. Phase 21 — Mobile CRM and Sales

## Tasks

- [ ] Leads.
- [ ] Customers.
- [ ] Interactions.
- [ ] Opportunities.
- [ ] Quotations.
- [ ] Sales orders.
- [ ] Machine reservations.
- [ ] Delivery coordination.

Use cards and mobile forms instead of desktop tables.

---

# 27. Phase 22 — Mobile Finance

## Tasks

- [ ] KPI summary.
- [ ] Invoices.
- [ ] Payments.
- [ ] Receivables.
- [ ] Payables.
- [ ] Expenses.
- [ ] Approval tasks.
- [ ] 3-way matching status.

Complex accounting workflows may remain desktop-first when mobile adds little value, but visibility must respect the same permissions.

---

# 28. Phase 23 — Mobile HR

## Tasks

- [ ] Employee directory.
- [ ] Employee details.
- [ ] Onboarding status.
- [ ] Documents.
- [ ] Account requests.
- [ ] Other approved HR workflows.

Sensitive salary/employee data must be protected by the same authorization rules.

---

# 29. Phase 24 — Push Notifications

## Tasks

- [ ] Expo push token registration.
- [ ] Store device tokens securely.
- [ ] Support multiple devices.
- [ ] Handle token rotation.
- [ ] Remove token on logout where appropriate.
- [ ] Deep-link notification taps.
- [ ] Mark notifications read.
- [ ] Notification history.
- [ ] Notification preferences.

## Example

```text
New breakdown assigned
Toyota 8FG
Delhi Site

Tap → Breakdown details
```

---

# 30. Phase 25 — Media and Storage

## Objective

Standardize images/documents.

## Tasks

- [ ] Audit existing storage buckets.
- [ ] Define storage policies.
- [ ] Machine photos.
- [ ] FSR photos.
- [ ] Employee documents.
- [ ] Customer documents.
- [ ] Delivery documents.
- [ ] Image compression.
- [ ] Upload progress.
- [ ] Retry.
- [ ] Secure URLs.
- [ ] MIME validation.
- [ ] Size validation.

## Security

Sensitive files must not be publicly accessible without authorization.

---

# 31. Phase 26 — Offline-First Critical Workflows

## Priority

- [ ] My Work.
- [ ] Machine details.
- [ ] Breakdown creation.
- [ ] FSR draft.
- [ ] Hour meter.
- [ ] Parts request.
- [ ] Photos.

## Architecture

```text
UI
 ↓
Local Database
 ↓
Sync Queue
 ↓
Network
 ↓
Secure API/Supabase
 ↓
PostgreSQL
```

## Requirements

- [ ] Local persistence.
- [ ] Mutation IDs.
- [ ] Retry.
- [ ] Duplicate prevention.
- [ ] Conflict strategy.
- [ ] Sync status.
- [ ] Failed-sync state.
- [ ] Manual retry.
- [ ] Recovery after app restart.

## Exit Criteria

Critical supported field workflows survive temporary network loss.

---

# 32. Phase 27 — Realtime Synchronization

## Tasks

- [ ] Identify tables requiring realtime.
- [ ] Subscribe only where justified.
- [ ] Handle reconnect.
- [ ] Invalidate TanStack Query cache.
- [ ] Avoid duplicate events.
- [ ] Test concurrent changes.
- [ ] Test web-to-mobile update.
- [ ] Test mobile-to-web update.

## Exit Criteria

Required cross-platform updates appear without manual refresh where realtime is intended.

---

# 33. Phase 28 — Performance

## Web

- [ ] Server Components where appropriate.
- [ ] Dynamic imports.
- [ ] Image optimization.
- [ ] Query optimization.
- [ ] RLS performance.
- [ ] Index verification.
- [ ] Client bundle reduction.
- [ ] Large-list virtualization.
- [ ] Chart optimization.

## Mobile

- [ ] Efficient lists.
- [ ] Image caching.
- [ ] Image compression.
- [ ] Avoid unnecessary renders.
- [ ] Memoization where useful.
- [ ] Lazy loading.
- [ ] Bundle optimization.
- [ ] Low-end Android testing.
- [ ] Reduce expensive animations.

## Database

- [ ] Slow query analysis.
- [ ] Index analysis.
- [ ] N+1 query detection.
- [ ] Dashboard RPC optimization.
- [ ] RLS query analysis.

---

# 34. Phase 29 — Accessibility and Device UX

## Tasks

- [ ] Touch-friendly targets.
- [ ] Screen-reader labels.
- [ ] Accessible contrast.
- [ ] Keyboard-safe forms.
- [ ] Focus handling.
- [ ] Validation announcements.
- [ ] Loading announcements.
- [ ] Reduced-motion handling where appropriate.
- [ ] Safe-area handling.
- [ ] Small-screen testing.
- [ ] Large text testing where practical.
- [ ] Android back button behavior.

---

# 35. Phase 30 — Security Audit

## Mandatory Checks

- [ ] No service-role key in mobile.
- [ ] No server secrets in mobile.
- [ ] RLS verified.
- [ ] Auth verified.
- [ ] API authorization verified.
- [ ] Storage policies verified.
- [ ] Deep-link handling verified.
- [ ] Role escalation tested.
- [ ] Branch isolation tested.
- [ ] Assigned isolation tested.
- [ ] Organization access tested.
- [ ] HR sensitive data tested.
- [ ] Finance sensitive data tested.
- [ ] Audit logs verified.
- [ ] File uploads validated.
- [ ] Rate limiting considered.

## Attack Assumption

Assume the mobile client is fully inspectable and modifiable by an attacker.

The mobile UI is never trusted.

---

# 36. Phase 31 — Automated Testing

## Unit

- [ ] Types/transformations where needed.
- [ ] Validation.
- [ ] Permissions.
- [ ] Business rules.
- [ ] Utility functions.

## Integration

- [ ] Auth.
- [ ] RLS.
- [ ] APIs.
- [ ] Supabase queries.
- [ ] Storage.
- [ ] Realtime.

## Web E2E

Test critical workflows.

## Mobile E2E

At minimum:

- [ ] Login.
- [ ] My Work.
- [ ] Machine.
- [ ] Complaint.
- [ ] FSR.
- [ ] Hour meter.
- [ ] Parts request.
- [ ] Notification.
- [ ] Offline sync.

## Role Matrix

Test all applicable roles against protected workflows.

---

# 37. Phase 32 — Environments

## Required Environments

```text
development
staging
production
```

## Tasks

- [ ] Separate Supabase environments where appropriate.
- [ ] Environment-specific public keys.
- [ ] Environment-specific URLs.
- [ ] Secure secret management.
- [ ] Startup environment validation.
- [ ] Production protection.
- [ ] Document environment ownership.

---

# 38. Phase 33 — CI/CD

## Pull Request

Run:

```text
Install
 ↓
Typecheck
 ↓
Lint
 ↓
Unit Tests
 ↓
Web Build
 ↓
Mobile Typecheck
 ↓
Relevant Integration Tests
```

## Web Production

```text
Git
 ↓
CI
 ↓
Vercel
```

## Mobile Production

```text
Git
 ↓
CI
 ↓
EAS Build
 ↓
Internal Testing
 ↓
Store Release
```

## Exit Criteria

A broken PR cannot silently become a production release.

---

# 39. Phase 34 — Android Release

## Tasks

- [ ] Package identifier.
- [ ] App icon.
- [ ] Splash.
- [ ] Signing.
- [ ] EAS configuration.
- [ ] Production build.
- [ ] Internal testing.
- [ ] Closed testing.
- [ ] Production rollout.
- [ ] Versioning.
- [ ] Crash monitoring.

---

# 40. Phase 35 — iOS Release

## Tasks

- [ ] Bundle identifier.
- [ ] Apple Developer setup.
- [ ] Signing.
- [ ] Provisioning.
- [ ] App icon.
- [ ] Splash.
- [ ] EAS configuration.
- [ ] TestFlight.
- [ ] Production release.
- [ ] Versioning.
- [ ] Crash monitoring.

---

# 41. Phase 36 — Observability

## Web

Monitor:

- [ ] Errors.
- [ ] API latency.
- [ ] Database latency.
- [ ] RLS performance.
- [ ] User sessions.
- [ ] Server failures.

## Mobile

Monitor:

- [ ] Crash rate.
- [ ] Startup time.
- [ ] Screen performance.
- [ ] Network errors.
- [ ] Sync failures.
- [ ] Push failures.
- [ ] API errors.

## Backend

Monitor:

- [ ] Database errors.
- [ ] Slow queries.
- [ ] Auth failures.
- [ ] Storage failures.
- [ ] Notification failures.
- [ ] Scheduled job failures.

---

# 42. Phase 37 — Documentation

Create/update:

```text
docs/
├── architecture.md
├── monorepo.md
├── web.md
├── mobile.md
├── packages.md
├── api.md
├── authentication.md
├── rbac.md
├── database.md
├── realtime.md
├── offline-sync.md
├── design-system.md
├── deployment.md
├── testing.md
├── security.md
└── troubleshooting.md
```

Documentation must describe actual implementation, not planned implementation.

---

# 43. Phase 38 — Cross-Platform Consistency Audit

## Branding

- [ ] Same logo.
- [ ] Same brand colors.
- [ ] Same semantic colors.
- [ ] Same typography hierarchy.
- [ ] Same icon language.
- [ ] Same light/dark behavior.

## Data

- [ ] Same machines.
- [ ] Same complaints.
- [ ] Same FSRs.
- [ ] Same inventory.
- [ ] Same users.
- [ ] Same notifications.

## Permissions

- [ ] Same roles.
- [ ] Same permissions.
- [ ] Same organization scope.
- [ ] Same branch scope.
- [ ] Same assigned scope.

## Synchronization

- [ ] Mobile-created data appears on web.
- [ ] Web-created data appears on mobile.
- [ ] Status updates synchronize.
- [ ] Notifications synchronize.
- [ ] Offline mutations synchronize.

## UX

- [ ] Mobile is not a desktop copy.
- [ ] Mobile follows the same visual identity.
- [ ] Mobile controls are touch-friendly.
- [ ] Navigation is predictable.

---

# 44. Phase 39 — Production Readiness Gate

Do not release until all required checks pass.

## Architecture

- [ ] Monorepo stable.
- [ ] Web stable.
- [ ] Mobile stable.
- [ ] Shared packages stable.
- [ ] One database.
- [ ] One authentication system.
- [ ] Shared RBAC.
- [ ] Shared validation.
- [ ] Shared design tokens.

## Security

- [ ] RLS audited.
- [ ] Secrets audited.
- [ ] API authorization audited.
- [ ] Storage policies audited.
- [ ] Role escalation tested.

## Reliability

- [ ] Backups verified.
- [ ] Migration process verified.
- [ ] Offline sync verified.
- [ ] Realtime verified.
- [ ] Crash recovery verified.

## Device Testing

- [ ] Android.
- [ ] iOS.
- [ ] Low-end Android.
- [ ] Slow network.
- [ ] No network.
- [ ] App restart during sync.
- [ ] Background/foreground transition.

## Operations

- [ ] CI/CD working.
- [ ] Monitoring working.
- [ ] Crash reporting working.
- [ ] Release process documented.
- [ ] Rollback strategy documented.

---

# 45. Final Architecture Acceptance Test

The following scenarios MUST work before the project is considered complete.

## Scenario A — Web → Mobile

```text
Admin creates/updates machine on web
 ↓
Database
 ↓
Mobile opens machine
 ↓
Updated machine is visible
```

## Scenario B — Mobile → Web

```text
Engineer creates breakdown on mobile
 ↓
Database
 ↓
Web Service module
 ↓
Complaint visible
```

## Scenario C — Authentication

```text
User logs into web
User logs into mobile
 ↓
Same Supabase identity
 ↓
Same role
 ↓
Same branch
 ↓
Same permission scope
```

## Scenario D — Security

```text
Engineer requests another branch's restricted data
 ↓
RLS
 ↓
Access denied
```

## Scenario E — Offline

```text
Engineer loses network
 ↓
Creates FSR
 ↓
Local save
 ↓
Network returns
 ↓
Sync
 ↓
Database
 ↓
Web sees FSR
```

## Scenario F — Realtime

```text
Web changes complaint status
 ↓
Database
 ↓
Realtime
 ↓
Mobile updates
```

## Scenario G — Design

```text
Web
    Same brand
    Same colors
    Same typography
    Same semantic states

Mobile
    Same brand
    Same colors
    Same typography
    Same semantic states
    Different responsive/native layout
```

---

# 46. Recommended Feature Priority

Do not implement every enterprise module on mobile simultaneously.

## Mobile Priority 1 — Field Operations

1. Authentication
2. Dashboard
3. My Work
4. Machines
5. Breakdown Complaints
6. FSR
7. Hour Meter
8. Parts Requests
9. Photos
10. Notifications

## Mobile Priority 2 — Operations

11. Site movements
12. Operator workflows
13. Inventory
14. Rental operations

## Mobile Priority 3 — Business

15. CRM
16. Sales
17. Finance
18. HR

Desktop remains the preferred interface for highly complex administrative workflows when mobile adds little operational value.

---

# 47. AI Agent Decision Rules

When uncertain, follow these rules.

## If code already exists

Inspect and reuse it.

## If business logic exists

Do not duplicate it.

## If a type exists

Reuse or move it to shared types.

## If validation exists

Reuse or move it to shared validation.

## If permission logic exists

Centralize it rather than creating a second implementation.

## If UI exists only for desktop

Create a mobile equivalent using the same design tokens and semantic component behavior.

## If a database change seems necessary

First verify whether the existing schema already supports the requirement.

If a change is truly necessary:

- Create a new migration.
- Update types.
- Update RLS.
- Update tests.
- Update documentation.

## If security is unclear

Stop and investigate before implementing.

## If a phase is blocked

Mark it BLOCKED and document why.

Do not silently skip it.

---

# 48. Agent Stop Conditions

An AI agent MUST stop and request/record clarification when:

- A business rule is ambiguous.
- A destructive database migration is required.
- Existing production behavior conflicts with the requested architecture.
- A security boundary must be weakened.
- A secret would need to be exposed to mobile.
- Two conflicting sources of truth are discovered.
- A required external credential is unavailable.
- A phase cannot satisfy its exit criteria.
- Continuing would risk production data.

The agent may continue only when the issue is resolved or an explicit safe decision is documented.

---

# 49. Final Definition of Done

The project is complete only when:

```text
MONOREPO
    ✓

WEB
    ✓

MOBILE
    ✓

SHARED TYPES
    ✓

SHARED VALIDATION
    ✓

SHARED RBAC
    ✓

SHARED DESIGN TOKENS
    ✓

SHARED API CONTRACTS
    ✓

SUPABASE DATABASE
    ✓

SUPABASE AUTH
    ✓

RLS
    ✓

STORAGE
    ✓

REALTIME
    ✓

OFFLINE SYNC
    ✓

PUSH NOTIFICATIONS
    ✓

TESTING
    ✓

SECURITY
    ✓

CI/CD
    ✓

ANDROID
    ✓

IOS
    ✓

OBSERVABILITY
    ✓

DOCUMENTATION
    ✓

CROSS-PLATFORM AUDIT
    ✓
```

The final architecture must satisfy:

> **Same backend + same data + same authentication + same security + same permissions + same validation + same design language + platform-specific UX.**

---

# 50. Final Agent Instruction

When an AI coding agent is asked to continue this project:

1. Read this file first.
2. Determine the current phase from `AI/STATE.md`.
3. Do not assume previous phases are complete.
4. Verify the previous phase's exit criteria.
5. Inspect the current codebase.
6. Implement only the next incomplete phase.
7. Run all relevant checks.
8. Review the resulting diff.
9. Update project state and changelog.
10. Mark the phase complete only after all exit criteria pass.
11. Proceed to the next phase only when the current phase is stable.
12. Never trade security, data integrity, or existing production behavior for speed.

**The agent must optimize for correctness, maintainability, security, backward compatibility, and incremental delivery — not for the shortest implementation.**
