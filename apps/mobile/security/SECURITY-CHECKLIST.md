# Mobile Security Checklist & Verification Gate — `apps/mobile`

> **ACTIONABLE SECURITY COMPLIANCE GATE FOR EXPO REACT NATIVE DEVELOPMENT**  
> *Every item in this checklist must be satisfied before merging mobile pull requests or submitting EAS builds.*

---

## 1. Authentication & Hardware Keystore (`apps/mobile`)

- [ ] **MOB-CHK-01: Hardware-Backed Keystore Storage**
  - *Check*: All authentication tokens are stored via `mobileSecureStorage` (`expo-secure-store`) with KeyStore chunking.
  - *Evidence*: `AsyncStorage.getItem` or `setItem` is NOT used for session or refresh tokens.
- [ ] **MOB-CHK-02: Zero Server Secrets in Bundle**
  - *Check*: No `SUPABASE_SECRET_KEY`, database credentials, or third-party private API keys exist in `apps/mobile/.env` or source files.
  - *Evidence*: `verifyClientSecurityEnvironment()` returns `{ secure: true, errors: [] }`.
- [ ] **MOB-CHK-03: Safe Session Termination**
  - *Check*: Invoking logout removes Keystore entries and triggers `supabase.auth.signOut()`.
  - *Evidence*: Local auth state listener redirects to `(auth)/login` upon session destruction.

---

## 2. Navigation & Deep Link Security

- [ ] **MOB-CHK-04: Deep Link Route Whitelist Sanitization**
  - *Check*: Incoming deep links (`reachinternational://...`) pass through `sanitizeDeepLinkRoute()` in `apps/mobile/lib/security.ts`.
  - *Evidence*: Route handler references sanitization helper before navigation dispatch.
- [ ] **MOB-CHK-05: Protected Route Auth Guard**
  - *Check*: Root `_layout.tsx` checks auth state on navigation; unauthenticated users cannot navigate to `(app)/*`.
  - *Evidence*: Session listener in root layout redirects to `(auth)/login`.

---

## 3. Local Storage & Offline Resilience

- [ ] **MOB-CHK-06: Deterministic Offline Idempotency Keys**
  - *Check*: Queued offline actions derive unique idempotency keys using `buildShiftLogIdempotencyKey()`.
  - *Evidence*: Payload includes deterministic idempotency key before queue insertion.
- [ ] **MOB-CHK-07: Offline Queue Capacity Bound**
  - *Check*: Offline queue enforces `MAX_QUEUE_CAPACITY = 50` to prevent storage DoS.
  - *Evidence*: Verification in `OfflineQueueManager.ts`.
- [ ] **MOB-CHK-08: No Plaintext PII in Unencrypted Cache**
  - *Check*: Highly sensitive employee PII (Aadhaar numbers, bank accounts) is not written to `AsyncStorage`.
  - *Evidence*: Cache inspection of `@react-native-async-storage/async-storage`.

---

## 4. Native Permissions & Android Hardening

- [ ] **MOB-CHK-09: Android Backup Disabled**
  - *Check*: `android.allowBackup: false` is set in `app.json`.
  - *Evidence*: Line inspection of `apps/mobile/app.json`.
- [ ] **MOB-CHK-10: Strict Permissions Stripping**
  - *Check*: Unneeded permissions (camera, location, audio, external storage) are declared in `blockedPermissions` and stripped via config plugin.
  - *Evidence*: Config plugin verification in `app.config.js`.

---

## 5. Verification & Testing

- [ ] **MOB-CHK-11: Mobile TypeScript Compilation Clean**
  - *Check*: `pnpm --filter @reachinternational/mobile typecheck` exits with code 0.
  - *Evidence*: CLI output showing 0 type errors.
- [ ] **MOB-CHK-12: Mobile Verification Test Suite**
  - *Check*: `node apps/mobile/run-tests.mjs` executes and passes all test scenarios.
  - *Evidence*: Test runner output showing 100% passed.
- [ ] **MOB-CHK-13: Touch & Typography Compliance**
  - *Check*: `node scripts/check-typography.mjs` and `node scripts/test-touch-haptics.mjs` report 0 violations.
  - *Evidence*: Typography and touch target verification passing.
