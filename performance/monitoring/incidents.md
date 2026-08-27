# Incident Management, Rollback & Postmortem Protocol (Phase 19)

> **PURPOSE**: Standard operating procedure for production incident declaration, automated rollback triggers, and postmortem analysis.

---

## 1. Automated & Manual Rollback Triggers

Trigger immediate rollback to previous release tag if any of the following occur within 15 minutes of deployment:
1. **5xx Error Rate > 0.5%** across primary routes (`/operations`, `/machines`, `/users`).
2. **Operator Shift Submission Failure Rate > 0.1%** (`submit_operator_hour_log_atomic` RPC errors).
3. **Database Connection Pool Exhaustion** (> 85% active connections with queue buildup).
4. **Catastrophic Frontend Hydration Failure** preventing interaction on mobile devices.

### Rollback Execution Command:
```powershell
# Rollback to last known healthy production commit
git revert HEAD -m 1 --no-edit
git push origin production
```

---

## 2. Incident Postmortem Template

```markdown
# Incident Postmortem: [INCIDENT-TITLE]

## Summary
- **Incident ID**: INC-2026-XXXX
- **Severity**: P0 / P1 / P2
- **Start Time (UTC)**: YYYY-MM-DD HH:MM
- **Detection Time (UTC)**: YYYY-MM-DD HH:MM
- **Resolution Time (UTC)**: YYYY-MM-DD HH:MM
- **Total Downtime / Impact Duration**: XX minutes
- **Affected Services / Roles**: Operator submissions / Dashboard / Reports
- **Release Version**: v2026.XX.XX

## Symptoms & User Impact
- Description of what operators or managers experienced.
- Number of affected submissions or sessions.

## Root Cause Analysis
- Detailed technical explanation of what failed and why monitoring/tests did not prevent it.

## Mitigation & Immediate Fix
- Steps taken to resolve the incident (e.g. Rollback commit ABC123, scaled PgBouncer pool).

## Permanent Corrective Actions
- [ ] Action item 1 (Owner: Eng, Target Date: YYYY-MM-DD)
- [ ] Action item 2 (Owner: Ops, Target Date: YYYY-MM-DD)

## Lessons Learned & Preventative Measures
- Architectural or test harness improvements implemented to prevent recurrence.
```
