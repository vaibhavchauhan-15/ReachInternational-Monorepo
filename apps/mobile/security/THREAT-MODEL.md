# Mobile Application Threat Model & STRIDE Analysis — `apps/mobile`

> **THREAT MODELING FOR EXPO REACT NATIVE & MOBILE INFRASTRUCTURE**  
> *This document details mobile-specific threat vectors, STRIDE classifications, risk severities, mitigations, and verification procedures for `apps/mobile`.*

---

## 1. Mobile Threat Matrix (STRIDE)

| Threat ID | STRIDE Category | Threat Description & Attack Vector | Impacted Asset | Severity | Likelihood | Mitigation | Verification Procedure |
|---|---|---|---|---|---|---|---|
| **MOB-TM-01**| **Spoofing** | Attacker extracts session token from mobile device and replays it from an unauthorized client. | User Identity & Session | **High** | Medium | Authentication tokens stored exclusively in `expo-secure-store` backed by Android KeyStore / iOS Keychain; zero plaintext `AsyncStorage` fallback; token revocation via `supabase.auth.signOut()`. | Inspect device storage on Android emulator; verify `AsyncStorage` contains no auth tokens. |
| **MOB-TM-02**| **Tampering** | Operator edits offline shift log payload directly inside `AsyncStorage` on a rooted phone to alter meter readings. | Operational Machine Logs | **Medium** | Low | Server-side validation of shift log parameters; monotonically increasing meter verification (`endMeter >= startMeter`); supervisor approval requirement before payroll calculation. | Mutate queued payload in test harness; verify backend rejects invalid meter sequence upon sync. |
| **MOB-TM-03**| **Tampering** | Malicious app fires arbitrary intent with manipulated parameters to `reachinternational://` scheme. | Mobile Navigation Flow | **Medium** | Low | Deep links sanitized via `sanitizeDeepLinkRoute()` in `apps/mobile/lib/security.ts`; target routes validated against an explicit whitelist and user role home. | Fire adb intent `am start -W -a android.intent.action.VIEW -d "reachinternational://unauthorized/route"`; verify redirection to safe role home. |
| **MOB-TM-04**| **Repudiation** | Operator submits an incorrect shift log and claims the mobile app submitted wrong numbers automatically. | Fleet Shift Logs | **Medium** | Medium | Offline queue captures exact client timestamp (`created_at`), deterministic idempotency key (`buildShiftLogIdempotencyKey`), and client UUID; server records submission metadata. | Inspect shift log record in database; verify presence of client idempotency key and operator timestamp. |
| **MOB-TM-05**| **Information Disclosure** | Sensitive server secrets leaked into mobile APK binary during EAS build. | Infrastructure Secrets | **Critical** | Low | `verifyClientSecurityEnvironment()` scans `process.env` at initialization and crashes if server secrets exist; only `EXPO_PUBLIC_*` variables allowed in mobile runtime. | Run mobile test suite (`node apps/mobile/run-tests.mjs`); confirm security environment check passes. |
| **MOB-TM-06**| **Information Disclosure** | ADB backup extracts sensitive cached data from an unlocked device. | Local Cached Records | **High** | Medium | `android.allowBackup: false` enforced in `apps/mobile/app.json`; blocks `adb backup` extraction of app sandbox. | Attempt running `adb backup com.reachinternational.app`; verify backup operation is rejected by the OS. |
| **MOB-TM-07**| **Denial of Service** | Malicious script or corrupted loop fills mobile offline queue with thousands of shift log records. | Mobile Storage & Network | **Medium** | Low | `MAX_QUEUE_CAPACITY = 50` enforced in `OfflineQueueManager.ts`; subsequent queue requests rejected when queue depth hits limit. | Enqueue 51 items into offline queue; verify 51st item is rejected with capacity error. |
| **MOB-TM-08**| **Elevation of Privilege** | Attacker tampers with local role state in React Native memory to access supervisor or admin tabs. | Mobile UI Scope | **High** | Low | Mobile UI gating is purely cosmetic; all data-fetching queries execute through Supabase PostgREST with user's JWT; PostgreSQL RLS policies block unauthorized rows. | Modify local role variable in memory; verify database queries still return 0 unauthorized rows. |

---

## 2. Mobile Attack Surface Mitigations Summary

- **Token Protection**: Enforced via hardware-backed KeyStore/Keychain with payload chunking.
- **Deep Link Security**: Enforced via route sanitization whitelist.
- **Offline Integrity**: Enforced via deterministic idempotency keys and backend meter constraints.
- **Permission Hardening**: Enforced via manifest permission stripping and backup prevention.
- **Secret Protection**: Enforced via automated runtime environment verification.
