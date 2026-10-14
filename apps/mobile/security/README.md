# Mobile Application Security Architecture — `apps/mobile`

> **EXPO SDK 57 / REACT NATIVE 0.86 MOBILE SECURITY ARCHITECTURE & BOUNDARIES**  
> *This document defines the native mobile security boundaries, hardware keystore integration, offline queue protections, deep link sanitization, and session handling for `apps/mobile`.*

---

## 1. Mobile Architecture Overview

ReachInternational Mobile is built on **Expo SDK 57 (React Native 0.86)**:
- **Routing**: Expo Router (file-based: `app/(app)` for protected, `app/(auth)` for public auth, root `_layout.tsx` with Supabase `onAuthStateChange` listener).
- **Authentication & Keystore**: Uses `@supabase/supabase-js`. Tokens are encrypted in hardware via **`expo-secure-store`** backed by Android KeyStore / iOS Keychain.
- **Server State**: Managed via TanStack Query (`@tanstack/react-query`) with 30s stale time and background refetching.
- **Offline Resilience**: Offline mutations are queued in `AsyncStorage` via `OfflineQueueManager.ts` with deterministic idempotency keys (`buildShiftLogIdempotencyKey`) and NetInfo connectivity monitoring.
- **Native Hardening**: Android backup is disabled (`allowBackup: false`), and unused permissions (camera, audio, location, external storage) are explicitly stripped in `app.json` and `app.config.js`.

---

## 2. Mobile Security Document Index

Every developer and AI agent working in `apps/mobile` must reference these scoped documents alongside the root policies:

| Document | Primary Focus | Root Baseline Reference |
|---|---|---|
| **[`SECURITY-RULES.md`](./SECURITY-RULES.md)** | Mobile-specific mandatory coding rules, Keystore bounds, offline rules | [`../../../security/SECURITY-RULES.md`](../../../security/SECURITY-RULES.md) |
| **[`ATTACK-SURFACE.md`](./ATTACK-SURFACE.md)** | Deep links, local storage, PostgREST queries, native permissions | [`../../../security/ATTACK-SURFACE.md`](../../../security/ATTACK-SURFACE.md) |
| **[`THREAT-MODEL.md`](./THREAT-MODEL.md)** | Mobile-specific STRIDE threats, device tampering, offline tampering | [`../../../security/THREAT-MODEL.md`](../../../security/THREAT-MODEL.md) |
| **[`SECURITY-CHECKLIST.md`](./SECURITY-CHECKLIST.md)** | Actionable mobile pre-implementation and EAS build checklist | [`../../../security/SECURITY-CHECKLIST.md`](../../../security/SECURITY-CHECKLIST.md) |

---

## 3. Mobile Device Trust Boundary Model

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      MOBILE DEVICE ENVIRONMENT                         │
 │                                                                        │
 │  ┌─────────────────────────────────┐  ┌─────────────────────────────┐  │
 │  │      UNTRUSTED CLIENT ZONE      │  │     LOCAL STORAGE (SANDBOX) │  │
 │  │  • UI Views & Form Inputs       │  │  • AsyncStorage             │  │
 │  │  • Deep Link Intents            │  │    (offline shift queue,    │  │
 │  │  • Network State (NetInfo)      │  │     user preferences)       │  │
 │  └────────────────┬────────────────┘  └──────────────┬──────────────┘  │
 │                   │                                  │                 │
 │                   ▼                                  │                 │
 │  ┌────────────────────────────────────────────────┐  │                 │
 │  │          HARDWARE-BACKED TRUST ZONE            │  │                 │
 │  │  • expo-secure-store (1800-char chunking)      │  │                 │
 │  │  • iOS Keychain / Android KeyStore             │  │                 │
 │  │  • Encrypted Supabase Auth & Refresh Tokens    │  │                 │
 │  └────────────────┬───────────────────────────────┘  │                 │
 └───────────────────┼──────────────────────────────────┼─────────────────┘
                     │                                  │
                     │ HTTPS / TLS 1.3                  │
                     ▼                                  ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      TRUSTED PERSISTENCE ZONE                          │
 │  • Supabase Gateway & Auth Server (JWT verification)                   │
 │  • PostgreSQL Database (Row Level Security across all tables)          │
 │  • Private Storage Bucket (user_files)                                 │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Mobile-Specific Golden Invariants

1. **Hardware Keystore Only**: Authentication and refresh tokens MUST be stored via `expo-secure-store`. Writing tokens to `AsyncStorage` in plaintext is strictly prohibited.
2. **Zero Server Secrets**: No service-role key (`SUPABASE_SECRET_KEY`), database passwords, or third-party secret tokens may exist in the mobile code or binary.
3. **Deep Link Route Sanitization**: Every deep link intent MUST pass through `sanitizeDeepLinkRoute()` in `lib/security.ts` before navigation occurs.
4. **Offline Queue Idempotency**: All offline shift logs queued via `OfflineQueueManager` MUST include a deterministic idempotency key to prevent duplicate server insertions upon reconnection.
