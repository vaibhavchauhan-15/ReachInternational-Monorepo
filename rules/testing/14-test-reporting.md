# Test Evidence, Verification & Reporting Standards

> **STANDARDIZED TEST EVIDENCE AND REPORTING SCHEMA FOR ALL AI TASKS**  
> *Every AI task completion MUST conclude with an explicit, structured Test Execution Report. Fabricating test outcomes or claiming a check passed without running it is strictly prohibited.*

---

## 1. Purpose

The purpose of ReachInternational's Test Evidence & Reporting standards is to provide **transparent, verifiable proof of testing for every software modification**. This allows developers, architects, and peer agents to instantly verify that the required quality gates were satisfied.

---

## 2. Applicable Applications & Packages

This reporting standard applies to **EVERY AI AGENT TASK** across all packages and applications in the ReachInternational monorepo.

---

## 3. Standardized Status Taxonomy

AI agents MUST use exclusively these five standardized statuses:

| Status Code | Meaning | Required Justification |
|---|---|---|
| **PASS** | The test command was executed and completed with exit code `0`. | Terminal output summary or count of passed tests. |
| **FAIL** | The test command was executed and encountered errors or assertion failures. | Error message snippet and plan for resolution. |
| **BLOCKED** | The test could not run due to missing credentials, network block, or external failure. | Detailed description of the blocking dependency. |
| **NOT RUN** | The test was intentionally not executed for this specific task. | Explicit technical rationale explaining why it was deferred. |
| **NOT APPLICABLE** | The test category is wholly irrelevant to the modified files. | Explanation of why the file changes have zero impact on this domain. |

> [!CAUTION]
> **PROHIBITION OF FABRICATED RESULTS**: Never declare a test as `PASS` unless the terminal command actually ran and exited with code `0`. Reporting an untested mobile platform (such as claiming iOS passed when only Android was run) is considered a critical engineering violation.

---

## 4. Mandatory Test Report Template

Every AI task response involving code changes MUST conclude with this standardized markdown report block:

```markdown
### Test Execution Report

#### 1. Scope & Impact
- **Files Modified**: `[list of modified files]`
- **Affected Packages**: `[apps/web, apps/mobile, packages/..., supabase]`
- **Execution Level**: `[Level 1 | Level 2 | Level 3]`

#### 2. Verification Battery Executed

| Domain | Command Executed | Status | Evidence / Summary |
|---|---|---|---|
| Static Types | `pnpm typecheck` | PASS | 0 errors across 9 workspace packages |
| Code Quality | `pnpm lint` | PASS | 0 warnings, zero console.log statements |
| Unit Tests | `pnpm --filter @reachinternational/... test` | PASS | X/X subtests passed (Y ms) |
| Mobile Verifier | `node apps/mobile/test/run-tests.mjs` | PASS | 357/357 scenarios passed |
| Typography Guard | `node scripts/check-typography.mjs` | PASS | 0 raw typography properties found |
| Touch Ergonomics | `node scripts/test-touch-haptics.mjs` | PASS | All 44px targets and haptics verified |
| Database Integrity | `node supabase/verify_seed.mjs` | PASS | Seed data verified, 0 broken FKs |
| Security & RLS | `node supabase/tests/...` | PASS | Multi-role RLS negative tests pass |
| Responsive / UX | Manual / DevTools Audit | PASS | 320px, 360px, 768px, 1440px (Zero overflow) |
| Parity Audit | `node scripts/test-parity-rules-and-skills.mjs` | PASS | Web & Mobile parity verified |

#### 3. Platform Verification Specifics
- **Web App**: `[Verified on Next.js 16.2 dev/build | Browser engine: Chromium/WebKit]`
- **Android**: `[Verified on Node test harness / Android emulator]`
- **iOS**: `[Verified on Node test harness | iOS Device: NOT RUN - No macOS device available]`

#### 4. Security & Risk Assessment
- **Environment**: Development Project (`vlmxciuogczumumrwyot`) — Production untouched.
- **Secret Scan**: Verified 0 credentials, secrets, or API keys in diff.
- **Remaining Risks**: `[None | Explicit description of deferred edge cases]`
```

---

## 5. Required Reporting Approach

1. **Capture Raw Terminal Output**: When running test commands in the shell, inspect the exit code and summary lines (e.g. `tests 15, pass 15, fail 0`).
2. **Translate to Evidence**: Copy exact quantitative metrics into the evidence column of the report.
3. **Explicitly Justify Non-Execution**: If a test category was not run (e.g. Web E2E on a mobile-only bug fix), mark it as `NOT APPLICABLE` with the specific reason.
4. **Disclose Remaining Risks**: If an edge case or environment constraint prevents full verification, transparently state the remaining risk so human reviewers can take appropriate action.

---

## 6. Success Criteria

1. The test report is present in the task completion output.
2. Every status is accurate and supported by actual command execution.
3. Zero untruthful or fabricated test claims.
