# Mobile Application Mandatory Security Rules — `apps/mobile`

> **SCOPED SECURITY RULES FOR EXPO REACT NATIVE DEVELOPMENT**  
> *These rules extend the monorepo baseline in [`../../../security/SECURITY-RULES.md`](../../../security/SECURITY-RULES.md). All rules in the root policy apply to `apps/mobile`. When rules overlap, the STRICTER rule wins.*

---

## 1. Primary Architecture Invariants

1. **Hardware-Backed Keystore Only**:
   All user session tokens and refresh tokens MUST be stored exclusively via `mobileSecureStorage` (`expo-secure-store`) backed by Android KeyStore / iOS Keychain. Persisting tokens in `AsyncStorage` is strictly prohibited.
2. **Zero Server Secrets in Mobile Bundle**:
   The mobile codebase, configuration, `.env`, and EAS build artifacts must NEVER contain server secrets (`SUPABASE_SECRET_KEY`, `SENDGRID_API_KEY`, database connection strings). Any detected leak will fail runtime initialization via `verifyClientSecurityEnvironment()`.
3. **Deep Link Route Whitelist Sanitization**:
   All incoming deep links and universal links (`reachinternational://...`) MUST pass through `sanitizeDeepLinkRoute()` in `apps/mobile/lib/security.ts` before triggering router navigation.
4. **Offline Queue Idempotency**:
   All mutations queued into `AsyncStorage` via `OfflineQueueManager.ts` MUST include a deterministic idempotency key (`buildShiftLogIdempotencyKey`) and client UUID to guarantee exactly-once persistence.

---

## 2. Server State & PostgREST Access Rules

1. **Authenticated PostgREST Access**:
   All queries to Supabase must flow through the authenticated Supabase client carrying the user's JWT. Direct bypassing of PostgREST is forbidden.
2. **TanStack Query Caching Bounds**:
   Server queries managed by TanStack Query (`@tanstack/react-query`) must maintain explicit cache times (30s stale time default) and safe error handling using canonical `<ErrorState>` components.
3. **Zero Error Masking**:
   Mobile query hooks must throw or surface actual error states rather than returning fake mock data or empty lists when network/database failures occur.

---

## 3. Native Permissions & Sandbox Hardening

1. **Android Backup Disabled**:
   `android.allowBackup: false` must remain configured in `apps/mobile/app.json`.
2. **Permission Stripping**:
   Unneeded native device permissions (camera, microphone, coarse/fine location, external storage) must be blocked in `app.json` and stripped from the merged Android manifest via the `withAndroidLargeScreenAndPermissions` plugin.
3. **File Size Bounds**:
   Document uploads initiated via `expo-document-picker` must be validated against the 2MB size limit before uploading to Supabase storage.
