# Native Mobile Documentation — `apps/mobile/docs/`

This directory houses documentation, release notes, Play Store submission materials, and UI audits for the ReachInternational Native Mobile Application (Expo SDK 58 / React Native).

## Directory Structure

```text
apps/mobile/docs/
├── README.md                              ← YOU ARE HERE (Mobile documentation index)
│
├── release-notes/                         ← Version Release Notes & Changelogs
│   ├── RELEASE_NOTES_v1.3.0.md            ← v1.3.0: Unified approvals & offline sync
│   ├── RELEASE_NOTES_v1.4.0.md            ← v1.4.0: Date-aware shifts & push notifications
│   └── RELEASE_NOTES_v1.5.0.md            ← v1.5.0: Native machines RBAC & operations parity
│
├── store/                                 ← App Store & Google Play Store Submission
│   ├── PLAY_STORE_SUBMISSION_CHECKLIST.md ← Step-by-step console setup, track management & AAB upload
│   ├── PLAY_STORE_DATA_SAFETY.md          ← Mandatory Google Play Data Safety form responses
│   └── PLAY_STORE_CONTENT_RATING.md       ← IARC questionnaire responses & ESRB rating
│
└── audits/                                ← Mobile UI & Asset Audits
    └── icon-audit.md                      ← Vector icon set, Lucide mapping & typography compliance
```

## Native Architecture Highlights

1. **Expo Router**: Native file-based navigation in `apps/mobile/app/` with root `_layout.tsx`, `(app)/` authenticated routes, and `(auth)/` authentication screens.
2. **Server State & Caching**: TanStack Query (`@tanstack/react-query`) with persistent AsyncStorage cache persister (`@tanstack/query-async-storage-persister`).
3. **Hardware-Backed Keystore**: Authentication tokens and session secrets stored strictly in iOS Keychain and Android Keystore via `expo-secure-store`.
4. **Offline Resilience**: Idempotent offline queue manager (`lib/offline/`) with NetInfo connectivity detection and ambient status banner (`OfflineBanner.tsx`).
5. **Touch Ergonomics & Parity**:
   - Minimum 44px touch targets across all buttons and inputs.
   - Vercel Geist design tokens (`packages/design-tokens`) with Reach Sky Blue `#0284c7` / `#0ea5e9`.
   - Native bottom sheets (`BottomSheetModal`) and horizontal scrollable filter strips.
   - Zero raw typography in `StyleSheet.create` — strictly use `<Text variant="...">`.
