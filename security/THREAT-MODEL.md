# Monorepo Threat Model & STRIDE Analysis

> **AUTHORITATIVE THREAT MODEL FOR REACHINTERNATIONAL MONOREPO**  
> *This document establishes the structured threat model covering primary assets, threat actors, STRIDE threat classifications, impact ratings, mitigations, and verification procedures across Web, Mobile, and Supabase infrastructure.*

---

## 1. Assets, Threat Actors & Sensitivity

### High-Value Assets
1. **Identity & Authentication Credentials**: Supabase Auth user passwords, JWT sessions, refresh tokens.
2. **Employee Sensitive PII & KYC**: Aadhaar numbers, driving license scans, bank account numbers, IFSC codes, salary/payroll figures.
3. **Operational Fleet Telemetry**: Machine hour meter readings, breakdown complaint logs, equipment location assignments, client job sites.
4. **Client & Commercial Contracts**: Rental rates, billing records, customer directory, GSTIN numbers.
5. **System Audit Logs & Traceability**: Immutable event records in `public.audit_logs`.
6. **Infrastructure Secrets**: `SUPABASE_SECRET_KEY` (service role), SendGrid API keys, database connection strings.

### Threat Actor Profiles
- **External Attacker**: Unauthenticated remote actor attempting credential stuffing, API exploitation, brute-force login, or denial of service.
- **Rogue / Low-Privilege Insider (e.g. Operator)**: Authenticated user attempting to view other operators' salaries, tamper with HMR meter readings, falsify breakdown times, or access administrative settings.
- **Compromised Mobile Device**: Physical possessor of a rooted Android/iOS device attempting to dump tokens, inspect local files, or inject forged deep links.
- **Disgruntled Administrative User**: Staff member with `admin` or `manager` role attempting unauthorized bulk data deletion or data exfiltration.

---

## 2. Monorepo STRIDE Threat Matrix

| Threat ID | STRIDE Category | Threat Description & Attack Vector | Impacted Asset | Severity | Likelihood | Mitigation | Verification Procedure |
|---|---|---|---|---|---|---|---|
| **TM-01** | **Spoofing** | Forged JWT cookie or hijacked session token sent to web/mobile endpoints. | User Session / Identity | **High** | Medium | Session verification via `supabase.auth.getUser()` against auth server; HttpOnly, Secure, SameSite cookies on Web; `expo-secure-store` Keystore encryption on Mobile. | Attempt sending an expired or tampered JWT cookie to `/dashboard`; verify immediate HTTP 302/redirect to `/login`. |
| **TM-02** | **Spoofing** | Attacker injects forged `x-internal-user-*` headers to impersonate staff. | DAL Authentication Bypass | **Critical** | Low | `proxy.ts` strictly strips all incoming `x-internal-user-*` headers at the edge before re-signing valid credentials via HMAC. | Send request with `x-internal-user-id: admin-uuid`; verify downstream DAL ignores or strips the header. |
| **TM-03** | **Tampering** | Operator tampers with machine hour meter readings to artificially inflate work hours or conceal equipment damage. | Operational Fleet Logs | **High** | High | Business rule validation in Server Actions (`app/actions/machines.ts`), meter monotonic increase validation (`endMeter >= startMeter`), 24h shift limits (`runningHours <= 24`), and supervisor approval requirement. | Submit hour log with `endMeter < startMeter`; verify rejection with validation error. |
| **TM-04** | **Tampering** | Attacker modifies intercepted offline mutation payloads in mobile storage before sync. | Offline Queue | **Medium** | Low | Server-side validation of shift log parameters; deterministic idempotency keys (`buildShiftLogIdempotencyKey`); conflict resolution engine in `OfflineQueueManager.ts`. | Edit local `@reach:offline_queue_v1` in test harness; verify backend rejects invalid parameters. |
| **TM-05** | **Repudiation** | Administrator or manager deletes machine or approves payroll revision and denies performing the action. | System Audit Trail | **High** | Medium | Structured, non-blocking audit logging via `logAudit()` inserting immutable records into `public.audit_logs` using service role client. | Perform machine deletion; verify row exists in `public.audit_logs` with `user_id`, `actor_name`, `action: "machine.deleted"`, and timestamp. |
| **TM-06** | **Information Disclosure** | Low-privilege user (operator) queries `/api/documents/[id]/view` to view confidential KYC docs of other employees (BOLA/IDOR). | Employee KYC / Documents | **Critical** | Medium | `getDocumentViewUrlAction` verifies requesting user role (`isManagerOrAbove`) or checks that `document.user_id === session.userId`. RLS on `user_documents` enforces access. Short-lived (180s) signed URLs. | Request document view URL with non-owned document ID as operator; verify HTTP 403 Forbidden. |
| **TM-07** | **Information Disclosure** | Server logs or Sentry error traces output employee Aadhaar numbers, bank account numbers, or auth tokens. | Sensitive PII | **High** | Medium | Explicit column projections in DAL queries (no `SELECT *`); PII redaction rules; structured logging omitting credential fields; Sentry client sanitization. | Inspect Sentry breadcrumbs and console output during signup/login; confirm zero credentials logged. |
| **TM-08** | **Denial of Service** | Automated bot floods `/login`, `/signup`, or `/api/auth/forgot-password` with requests (LPDoS). | Auth Service Availability | **High** | High | Edge rate limiter in `proxy.ts` using `RATE_LIMIT_PROFILES.AUTH_STRICT` (5 requests / 60 seconds); returns HTTP 429 Too Many Requests. | Execute 6 rapid POST requests to `/api/auth/forgot-password`; verify 6th request receives HTTP 429 with `Retry-After`. |
| **TM-09** | **Elevation of Privilege** | User changes their role in client request payload from `operator` to `super_admin` during profile update. | RBAC / System Access | **Critical** | Low | Role assignment is strictly excluded from general profile updates (`app/actions/profile.ts`); role modifications require `super_admin` privilege and execute via dedicated `updateUserRole` action. | Attempt passing `role: "super_admin"` in operator profile update; verify field is ignored or rejected by Zod schema. |
| **TM-10** | **Elevation of Privilege** | Attacker invokes Server Action directly bypassing UI visibility checks to execute administrative actions (e.g., delete client). | Administrative Operations | **Critical** | Medium | Server Actions invoke `requireRole('admin', 'super_admin')` or `requirePermission()` before any database operation; PostgreSQL RLS policies enforce role restrictions at database level. | Invoke `deleteClient` action with operator session; verify error: "Permission denied". |
| **TM-11** | **Elevation of Privilege** | Mobile app processes malicious deep link injecting administrative paths. | Mobile Navigation Flow | **Medium** | Low | `sanitizeDeepLinkRoute()` in `apps/mobile/lib/security.ts` sanitizes incoming routes against an explicit whitelist and verifies role permissions before navigating. | Open deep link `reachinternational://settings/bulk-manage` with operator role; verify redirection to `/operations` or role home. |

---

## 3. Severity & Risk Prioritization

```text
  SEVERITY ──►  LOW              MEDIUM             HIGH             CRITICAL
LIKELIHOOD ┌──────────────────┬──────────────────┬────────────────┬─────────────────┐
  HIGH     │                  │ TM-04 (Offline)  │ TM-03 (HMR)    │ TM-06 (BOLA)    │
           │                  │                  │ TM-08 (LPDoS)  │                 │
  MEDIUM   │                  │ TM-11 (DeepLink) │ TM-01 (JWT)    │ TM-10 (Actions) │
           │                  │                  │ TM-05 (Audit)  │                 │
           │                  │                  │ TM-07 (PII)    │                 │
  LOW      │                  │                  │                │ TM-02 (Header)  │
           │                  │                  │                │ TM-09 (Role)    │
           └──────────────────┴──────────────────┴────────────────┴─────────────────┘
```

---

## 4. Remediation & Verification Standards

For any threat identified as **High** or **Critical**:
1. Mitigation MUST be enforced at both the **Server Application layer** and the **Database layer** (RLS/RPC).
2. Automated negative test cases MUST be implemented in the relevant test suite (`apps/web`, `apps/mobile`, or `supabase/tests/`).
3. Verification results MUST be reported in the implementation log.
