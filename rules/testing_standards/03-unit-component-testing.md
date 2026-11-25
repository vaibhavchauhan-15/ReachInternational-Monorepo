# Unit & Component Testing Standards

> **TESTING SPECIFICATIONS FOR PURE FUNCTIONS, BUSINESS LOGIC, VALIDATORS, AND UI COMPONENTS**  
> *Unit tests verify deterministic business logic in isolation; component tests verify UI state transitions, accessibility attributes, and error feedback.*

---

## 1. Purpose

The purpose of ReachInternational's Unit & Component Testing standards is to ensure that **critical business algorithms (payroll, overtime, shift collision), permission gates, validation schemas, and UI components behave deterministically** across all input boundaries without relying on live network calls or unmocked external dependencies.

---

## 2. Applicable Applications & Packages

- `packages/permissions`: Canonical 6-role RBAC evaluation and route navigation guards
- `packages/validation`: Zod schemas for forms, equipment, operations, machines, and users
- `packages/utils`: Salary calculators, shift interval overlap math, error sanitizers, and formatters
- `packages/design-tokens`: Typography scale, color tokens, and Geist radius tests
- `apps/web/components`: Web UI primitives, data tables, modals, and forms
- `apps/mobile/components`: Mobile touch cards, bottom sheets, filter panels, and inputs

---

## 3. Testing Targets

### A. Pure Logic & Business Calculations
- **Input Boundaries**: Zero, negative numbers, maximum operational bounds, invalid dates, and boundary time intervals (e.g. shifts crossing midnight 23:00 to 07:00).
- **Payroll & Overtime Calculation**: Verification of base pay, overtime multipliers, lunch deductions, and 32-column export formatting in `@reachinternational/utils`.
- **Shift Overlap Detection**: Ensuring disjoint shifts pass while overlapping intervals on the same machine/operator are correctly flagged.
- **RBAC Matrix Evaluation**: Verifying `hasAllPermissions()`, `hasAnyPermission()`, and role-based route access across all 6 canonical roles (`super_admin`, `admin`, `manager`, `supervisor`, `hr`, `operator`).

### B. Validation Schemas (Zod)
- **Valid Payloads**: `.parse()` succeeds and strips extraneous properties.
- **Invalid Payloads**: `.safeParse()` fails with explicit field-level error issues:
  * Missing required fields (UUIDs, names, serial numbers).
  * Out-of-bounds readings (negative hour meter readings, ending reading < starting reading).
  * Invalid formats (malformed GSTIN, malformed phone numbers, un-sanitized script tags).

### C. UI Component State Verification
- **4 Essential UI States**: Every interactive component must handle:
  1. **Loading State**: Skeleton loader or spinner displayed with `aria-busy="true"`.
  2. **Empty State**: Friendly `EmptyState` component with actionable CTA when data length is 0.
  3. **Error State**: Non-blocking inline banner with retry action when an async fetch fails.
  4. **Active / Populated State**: Dense, well-aligned content respecting Geist tokens.
- **Interaction Feedback**: Hover, focus, active press states, and tactile haptic feedback.
- **Accessibility Attributes**: Verification of `aria-expanded`, `aria-selected`, `role="alert"`, and visible labels.

---

## 4. Required Testing Approach

```text
[ ARRANGE ]
  ├── Initialize deterministic test fixtures (mock data objects)
  └── Isolate from external network or environment variables

[ ACT ]
  ├── Invoke pure function or execute schema validation
  └── Trigger component prop variation or state transition

[ ASSERT ]
  ├── Verify exact expected return value or error code
  ├── Verify error messages are sanitized and user-safe
  └── Verify DOM accessibility attributes or mobile touch invariants
```

---

## 5. Recommended Tools

- **Node.js Native Test Runner**: `node --test --experimental-strip-types` (fast, zero external dependency overhead)
- **Node Assertion Library**: `node:assert/strict`
- **React Testing / Mobile Verifiers**: Node-based component invariant checkers (`run-tests.mjs`)

---

## 6. Actual Project Commands

```bash
# 1. Run RBAC and permissions unit tests
pnpm --filter @reachinternational/permissions test

# 2. Run utils, payroll, and shift overlap tests
pnpm --filter @reachinternational/utils test

# 3. Run design tokens typography unit tests
pnpm --filter @reachinternational/design-tokens test

# 4. Run mobile component and workflow unit verifications
node apps/mobile/test/test-badge-component.mjs
node apps/mobile/test/test-standardized-assignment-ui.mjs
node apps/mobile/test/test-press-feedback.mjs
node apps/mobile/test/run-tests.mjs
```

---

## 7. Success Criteria

1. **Deterministic Execution**: All tests pass consistently regardless of local time zone, execution order, or hardware environment.
2. **Comprehensive Coverage**: Normal, edge, and invalid inputs are tested for every critical calculation.
3. **Speed**: Unit test suites must execute in under 500ms total.

---

## 8. Failure Handling

- When an assertion fails: inspect whether the mathematical model or business requirement has changed.
- If a payroll formula was updated, update the unit test fixture with the authoritative customer calculation specification.
- Never weaken a boundary check (e.g., allowing negative meter readings) to make a test pass.

---

## 9. Evidence & Reporting

The test report must include:
- Total number of tests executed.
- Subtests passed vs failed.
- Execution duration in milliseconds.
