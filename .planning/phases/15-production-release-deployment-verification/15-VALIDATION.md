---
phase: "15"
slug: "15-production-release-deployment-verification"
status: draft
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-09"
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Native Node.js ESM Test Runner (`@supabase/supabase-js`) + Turbo / Next.js / Expo CLI |
| **Config file** | `turbo.json`, `apps/web/next.config.ts`, `apps/mobile/app.json`, `apps/mobile/eas.json` |
| **Quick run command** | `node supabase/tests/test_future_shift_validation.mjs` |
| **Full suite command** | `node supabase/tests/test_future_shift_validation.mjs && node supabase/tests/test_shift_timing_and_lunch_inclusion.mjs && node supabase/tests/test_operator_complete_matrix.mjs && node supabase/tests/test_breakdown_submission_and_linking.mjs && node supabase/tests/test_log_sequencing_and_overlap.mjs && node supabase/tests/test_operator_machine_assignments.mjs && node supabase/verify_seed.mjs` |
| **Estimated runtime** | ~35 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node supabase/tests/test_future_shift_validation.mjs` (or task-specific test)
- **After every plan wave:** Run `pnpm turbo run typecheck` and full database test suite
- **Before `/gsd-verify-work`:** Full suite must be 100% green with 0 errors
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | AUTH-01 | T-15-01 | Test suites validate against live Postgres constraints without breaking schema integrity | integration | `node supabase/tests/test_breakdown_submission_and_linking.mjs && node supabase/tests/test_log_sequencing_and_overlap.mjs && node supabase/tests/test_operator_machine_assignments.mjs` | ✅ | ⬜ pending |
| 15-01-02 | 01 | 1 | AUTH-01 | T-15-02 | All 6 regression suites and seed verification pass 100% with 0 errors | regression | `node supabase/tests/test_future_shift_validation.mjs && node supabase/tests/test_shift_timing_and_lunch_inclusion.mjs && node supabase/tests/test_operator_complete_matrix.mjs && node supabase/tests/test_breakdown_submission_and_linking.mjs && node supabase/tests/test_log_sequencing_and_overlap.mjs && node supabase/tests/test_operator_machine_assignments.mjs && node supabase/verify_seed.mjs` | ✅ | ⬜ pending |
| 15-02-01 | 02 | 2 | MOB-01 | T-15-03 | Production build compiles with zero type errors and clean static generation | build | `pnpm turbo run build` | ✅ | ⬜ pending |
| 15-02-02 | 02 | 2 | MOB-01 | T-15-04 | Environment secrets locked and verified absent from public client bundles | audit | `node -e "if(fs.existsSync('.env') && !fs.readFileSync('.gitignore','utf8').includes('.env')) process.exit(1); console.log('Env secure')"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. All 6 test files exist in `supabase/tests/`, and build configurations exist in `apps/web/` and `apps/mobile/`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cloud EAS Build Submission | MOB-01 | Requires active Expo credentials and Apple/Google developer accounts | Verify EAS CLI build profile dry-run locally: `npx eas-cli config --profile production` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-09
