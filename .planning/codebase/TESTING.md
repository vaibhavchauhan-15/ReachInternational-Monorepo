# Testing Patterns

**Analysis Date:** 2026-09-09

## Test Framework & Quality Gates

**Monorepo Quality Gate:**
The primary quality assurance gate across the monorepo is enforced via Turborepo and TypeScript strict compilation across all 7 workspace projects (`apps/web`, `apps/mobile`, and 5 shared packages).

**Run Commands:**
```bash
# Typecheck all monorepo packages (Strict Mode)
pnpm typecheck
# or
turbo run typecheck

# Lint all packages
pnpm lint
# or
turbo run lint

# Verify relational seed data across all 40+ database tables
pnpm verify:seed
# or
node supabase/verify_seed.mjs

# Execute complete operator matrix test suite (75 test assertions)
node supabase/tests/test_operator_complete_matrix.mjs

# Execute shift timing and lunch deduction test suite (31 assertions)
node supabase/tests/test_shift_timing_and_lunch_inclusion.mjs

# Execute shift sequencing and overlap prevention test suite
node supabase/tests/test_log_sequencing_and_overlap.mjs

# Execute breakdown submission and ticket linking test suite
node supabase/tests/test_breakdown_submission_and_linking.mjs

# Execute future shift boundary validation test suite
node supabase/tests/test_future_shift_validation.mjs
```

## Test File Organization

**Location:**
- Database integration test suites: `supabase/tests/*.mjs`.
- Seed data verification runner: `supabase/verify_seed.mjs`.
- Type assertion gates: Built into package build targets via `tsc --noEmit`.

**Directory Layout:**
```
ReachInternational-Monorepo/
├── supabase/
│   ├── tests/
│   │   ├── test_operator_complete_matrix.mjs          # End-to-end operator/supervisor assignment & permissions
│   │   ├── test_shift_timing_and_lunch_inclusion.mjs  # Shift duration, lunch deduction & overnight math
│   │   ├── test_log_sequencing_and_overlap.mjs        # Overlap prevention triggers & HMR validation
│   │   ├── test_breakdown_submission_and_linking.mjs  # Breakdown workflows & maintenance tracking
│   │   ├── test_future_shift_validation.mjs           # Future date/time rejection guards
│   │   └── test_operator_machine_assignments.mjs     # Atomic assignment RPC testing
│   └── verify_seed.mjs                                # Relational table seed verification
```

## Test Structure & Patterns

**Test Suite Organization Pattern:**
Test suites in `supabase/tests/` follow a structured, standalone assertion model with clean pass/fail telemetry:

```javascript
// Example from supabase/tests/test_shift_timing_and_lunch_inclusion.mjs
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${message}`);
  } else {
    failed++;
    console.error(`  \x1b[31m✗ FAIL:\x1b[0m ${message}`);
  }
}

async function runTestSuite() {
  console.log("\n=== Testing Shift Timing & Lunch Break Calculations ===");
  
  // 1. Normal shift calculation
  const normalHours = calculateShiftHours("08:00", "16:00", false);
  assert(normalHours === 8, "08:00 to 16:00 yields 8 normal hours");

  // 2. Overnight shift calculation
  const overnightHours = calculateShiftHours("22:00", "06:00", false);
  assert(overnightHours === 8, "22:00 to 06:00 (overnight) yields 8 hours");

  // Summary
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTestSuite().catch(err => {
  console.error(err);
  process.exit(1);
});
```

## Database Verification & Seed Testing

**Seed Verifier (`supabase/verify_seed.mjs`):**
- Connects to Supabase using `SUPABASE_SERVICE_ROLE_KEY` to audit all relational tables.
- Verifies that critical seed data exists and satisfies relational integrity:
  - Users and role allocations (`admin`, `service_manager`, `engineer`, `operator`, `client`).
  - Machines and serial number constraints.
  - Working locations and state assignments.
  - Rental contracts, clients, and hour logs.
- Fails with non-zero exit code if any required master records are missing.

## Guidelines for Adding New Tests

1. **When adding database triggers or RPC functions:**
   - Add a corresponding test file in `supabase/tests/test_<feature>.mjs`.
   - Test both boundary conditions (e.g., duplicate serial numbers, overlapping shifts, unauthorized roles) and happy paths.
2. **When modifying shared packages (`packages/*`):**
   - Run `turbo run typecheck` to verify that all consumers (`apps/web`, `apps/mobile`) maintain 0 TypeScript errors.
3. **When implementing forms and Server Actions:**
   - Validate that Zod schemas reject malformed inputs before reaching the database.
   - Verify that all mutating Server Actions invoke `logAudit()` to preserve audit trail integrity.

---

*Testing analysis: 2026-09-09*
*Update after adding new test frameworks or automated test suites*
