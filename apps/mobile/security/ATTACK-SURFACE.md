# Mobile Application Attack Surface Analysis — `apps/mobile`

> **NATIVE MOBILE ENTRY POINTS, TRUST BOUNDARIES, AND RISK MATRIX**  
> *This document details all native attack vectors, hardware keystore boundaries, deep-link intents, local storage risks, and permission models in `apps/mobile`.*

---

## 1. Native Mobile Entry Point Catalog

### A. Deep Links & Universal Links
- **Identifiers**: Scheme `reachinternational://`, Universal/App Links `https://reachinternational.co.in` and `https://www.reachinternational.co.in`.
- **Trust Boundary**: External OS / Browser / Third-Party App → Expo Router.
- **Risks**:
  - Arbitrary route injection attacks (e.g. navigating unauthorized users to administrative screens).
  - Phishing or parameter tampering.
- **Existing Controls**:
  - `sanitizeDeepLinkRoute()` in `apps/mobile/lib/security.ts` tests incoming routes against an explicit whitelist of allowed paths.
  - Role-based fallback redirection: if an operator opens an administrative deep link, the router redirects them to their role home (`/operations`).
- **Status**: `Verified`.

---

### B. Local Session & Credential Storage
- **Mechanism**: `mobileSecureStorage` in `apps/mobile/lib/supabase.ts`.
- **Trust Boundary**: Native Application Sandbox → Device Keystore.
- **Risks**:
  - Memory dumps or local file inspection on rooted/jailbroken devices.
  - KeyStore size limitations causing silent write failures.
- **Existing Controls**:
  - `expo-secure-store` backed by Android KeyStore (AES-256-GCM) and iOS Keychain.
  - 1800-character payload chunking (`SECURE_CHUNK_SIZE`) safely partitions large JWT payloads across multiple Keystore keys.
  - Zero plaintext fallback to `AsyncStorage`.
  - Automatic cleanup of legacy `@secure_fallback_*` keys.
- **Status**: `Verified`.

---

### C. Offline Mutation Queue (`OfflineQueueManager.ts`)
- **Mechanism**: `@reach:offline_queue_v1` in `AsyncStorage`.
- **Trust Boundary**: Native Application Runtime → Persistent Local Storage.
- **Risks**:
  - Tampering with queued offline shift hours on rooted Android devices.
  - Duplicate submissions upon intermittent network reconnects.
  - Storage exhaustion DoS via unlimited offline queue insertions.
- **Existing Controls**:
  - `MAX_QUEUE_CAPACITY = 50` caps maximum queue depth.
  - Deterministic idempotency key derivation (`buildShiftLogIdempotencyKey`) ensures exactly-once persistence in Supabase.
  - Exponential backoff retry delays (2s, 5s, 10s).
- **Status**: `Partially Verified` (Queued JSON is unencrypted in `AsyncStorage`; tamper protection relies on backend validation).

---

### D. Direct PostgREST Network Requests
- **Protocol**: HTTPS / TLS 1.3 to Supabase API Gateway.
- **Trust Boundary**: Untrusted Mobile Client → Supabase PostgREST Gateway.
- **Risks**:
  - BOLA / IDOR attacks via manipulated entity IDs in query parameters.
  - Unauthorized column updates.
- **Existing Controls**:
  - All network requests carry the user's hardware-stored JWT.
  - Supabase PostgreSQL evaluates Row Level Security (RLS) on every table query.
  - No service-role key or admin credentials exist in the mobile bundle (`verifyClientSecurityEnvironment`).
- **Status**: `Verified`.

---

### E. Native Device Permissions & Manifest
- **Platform**: Android (`AndroidManifest.xml`) & iOS.
- **Trust Boundary**: Operating System → Native App Runtime.
- **Risks**:
  - Overprivileged application requesting unnecessary hardware access.
  - ADB backup extraction of application data.
- **Existing Controls**:
  - `allowBackup: false` in `app.json` blocks ADB backup of sandbox data.
  - `blockedPermissions` in `app.json` and `withAndroidLargeScreenAndPermissions` plugin in `app.config.js` explicitly strip camera, audio, location, and external storage permissions from the merged Android manifest.
- **Status**: `Verified`.

---

### F. Document & File Handling (`expo-document-picker`)
- **Mechanism**: Document picker invoked for KYC and profile document uploads.
- **Trust Boundary**: Device Storage → App Sandbox → Supabase Storage.
- **Risks**:
  - Upload of oversized files causing memory exhaustion.
  - Upload of malicious binaries disguised as identity documents.
- **Existing Controls**:
  - File size check enforces 2MB maximum limit.
  - MIME type check enforces allowed document types (`image/jpeg`, `image/png`, `application/pdf`).
  - Files are uploaded to private bucket `user_files` with user-scoped storage path.
- **Status**: `Verified`.
