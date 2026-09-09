---
phase: "14"
slug: "mobile-offline-sync-network-resilience"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-09"
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript Compiler (`tsc --noEmit`) & Node.js test runner |
| **Config file** | `apps/mobile/tsconfig.json` |
| **Quick run command** | `pnpm --filter @reachinternational/mobile typecheck` |
| **Full suite command** | `pnpm typecheck` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @reachinternational/mobile typecheck`
- **After every plan wave:** Run `pnpm typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | MOB-03 | T-14-01 | Encapsulate queue serialization without exposing tokens | unit | `pnpm --filter @reachinternational/mobile typecheck` | ✅ | ⬜ pending |
| 14-01-02 | 01 | 1 | MOB-03 | T-14-02 | Verify NetInfo internet reachability listener & subscriptions | unit | `pnpm --filter @reachinternational/mobile typecheck` | ✅ | ⬜ pending |
| 14-01-03 | 01 | 1 | MOB-03 | T-14-03 | UUID idempotency key verification and exponential backoff | unit | `pnpm --filter @reachinternational/mobile typecheck` | ✅ | ⬜ pending |
| 14-02-01 | 02 | 2 | MOB-03 | T-14-04 | Ambient offline banner and header sync CTA rendering | integration | `pnpm --filter @reachinternational/mobile typecheck` | ✅ | ⬜ pending |
| 14-02-02 | 02 | 2 | MOB-03 | T-14-05 | Optimistic machine log status badge pills (amber/blue/green/red) | integration | `pnpm --filter @reachinternational/mobile typecheck` | ✅ | ⬜ pending |
| 14-02-03 | 02 | 2 | MOB-03 | T-14-06 | Non-destructive conflict resolution bottom sheet for shift overlaps | integration | `pnpm --filter @reachinternational/mobile typecheck` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Airplane mode toggle & offline log submission | MOB-03 | Requires physical device or simulator cellular radio cutoff | 1. Enable Airplane mode in Expo client or emulator.<br>2. Submit a shift log via `MeterLogModal`.<br>3. Verify amber "Pending Sync" badge appears immediately.<br>4. Disable Airplane mode.<br>5. Verify automatic sync to Supabase and badge turns green. |
| Shift collision resolution sheet | MOB-03 | Requires active database constraint collision trigger | 1. Log an offline shift that conflicts with existing server shift time window.<br>2. Trigger sync.<br>3. Verify conflict bottom sheet opens displaying server conflicting window.<br>4. Edit time and resubmit successfully. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
