# Reach International Mobile — Release Notes v1.5.0

**Release Target**: Google Play Store (Production Track & Internal Testing) & In-App Release Hub  
**Package Name**: `com.reachinternational.app`  
**Version**: `1.5.0`  
**Version Code**: `6` (Managed via EAS Remote Cloud `autoIncrement: true` / `appVersionSource: remote`)  
**Runtime Version**: `1.5.0` (EAS bare workflow synchronized string literal)  
**Target SDK**: Android API 36 (Android 15 / 16 compliant)  
**Minimum SDK**: Android API 24 (Android 7.0+)  
**Architecture**: React Native 0.88.1 / Expo SDK 58.0.22 (New Architecture enabled, Hermes AOT engine, 64-bit arm64-v8a / armeabi-v7a / x86_64)

---

## 📱 1. Google Play Store Release Notes (Under 500 Characters)

### English (United States) — `en-US`
```text
What's New in v1.5.0:
• Universal Approvals: Dedicated approvals queue & bottom sheet review for registrations, profile edits, and documents.
• Push Notifications: Instant shift reminder alerts, 4 Android notification channels, and quiet-hours preference sync.
• 7-Day Shift Window: Retrospective shift entry (IST) with automated carry-forward and conflict guards.
• Dashboard Ergonomics: Enhanced machine KPI cards, static button view switchers, and silky 60fps haptic feedback.
```
*(Exact character count: 489 / 500 max allowed by Google Play Console).*

---

## 🔔 2. In-App Release Notes ("What's New in Reach Ops")

*Displayed automatically on first launch via the non-blocking `WhatsNewSheet` and accessible on-demand under `Settings` → `About` → `What's New` (`/settings/about/whats-new`).*

### Release Title: **What's New in Reach Ops v1.5.0**
> *Universal approvals queue, push notifications & shift alerts, 7-day retrospective shift logging, and refined dashboard ergonomics.*

### In-App Feature Highlights:
1. **Universal Multi-Flow Approvals** (`feature` | `icon: shield-check`):
   - Dedicated Approvals Queue (`/approvals`) with role-based access for Admins, HR, Managers, and Supervisors.
   - 60fps Reanimated bottom sheet review drawer (`ApprovalReviewSheet`) for 1-tap review, approval, or rejection.
   - Dual-control governance for sensitive changes with immutable PostgreSQL audit trail (`approval_events`).
   - Supports 5 canonical workflow types: `registration`, `profile_change`, `document_verify`, `account_deletion`, and `shift_conflict`.
2. **Push Notifications & Shift Alerts** (`feature` | `icon: zap`):
   - Dual-delivery push notification pipeline powered by Expo SDK 58 and Expo Push Service.
   - 4 custom Android notification channels: Operations & Shifts, System & Security, Equipment Alerts, and Approvals & Workflow.
   - Automated 4-tier shift reminder ladder (+15m, +90m, 09:00 IST morning digest, 18:00 critical lock warning).
   - User notification preferences with quiet-hours deferral (IST) and non-critical alert capping.
3. **7-Day Retrospective Shift Window** (`feature` | `icon: calendar`):
   - Retrospective shift submission and verification for the last 7 calendar days (`[today_IST - 6, today_IST]`).
   - Effective-dated assignments (`valid_from`, `valid_to`) with automatic carry-forward without daily reassignment rows.
   - Database-level shift overlap exclusion via PostgreSQL `btree_gist` constraint.
   - Offline-resilient shift logging with automatic sync and conflict resolution upon reconnect.
4. **Ergonomic KPI Cards & View Switcher** (`improvement` | `icon: gauge`):
   - Resolved Yoga flexbox height collapse and vertical card stretching across mobile FlatList and ScrollView headers.
   - Enriched `MachineKPIStrip` with semantic icons (`Wrench`, `CheckCircle2`, `Building2`, `AlertTriangle`) matching web 100%.
   - Replaced segmented toggle switches on Running Logs with responsive static button groups (`Clients`, `Machine`, `Operator`).
5. **Android 15+ & Hardware Security** (`improvement` | `icon: lock`):
   - Full edge-to-edge transparent system bars and cutout support (`windowLayoutInDisplayCutoutMode="always"`).
   - Authentication credentials and refresh tokens stored exclusively in hardware keystores (`expo-secure-store`).
   - Blocked legacy unneeded permissions (`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `ACCESS_WIFI_STATE`, `USE_FINGERPRINT`, `USE_BIOMETRIC`).
   - R8/ProGuard minification, resource shrinking, and fullMode DEX optimization.

---

## 🛠️ 3. Detailed Technical Improvements & Architecture Hardening

### A. Universal Multi-Flow Approval Engine (`apps/mobile/app/(app)/approvals.tsx`)
- **Unified Master Ledger**: Built on `public.approval_requests` with single-transaction PostgreSQL `SECURITY DEFINER` RPCs (`approval_submit`, `approval_decide`, `approval_cancel`).
- **Concurrency & Idempotency**: Strict optimistic concurrency control verifying `p_expected_version` under `FOR UPDATE` row locks; partial unique index `approval_idem` preventing duplicate submissions.
- **Mobile Ergonomic Review Sheet**: Native bottom sheet review drawer featuring split diff comparisons for profile edits, document preview integration, and rejection remark inputs with minimum 44px touch targets.

### B. Push Notifications & Delivery Pipeline (`apps/mobile/lib/notifications/*`)
- **Android Notification Channels**: Configured high-importance sound/vibration channels with dedicated status icons:
  - `reach_ops_shifts`: Operations & Shifts (High priority, custom badge)
  - `reach_ops_security`: Security & System Alerts (Max priority, persistent)
  - `reach_ops_machinery`: Fleet & Equipment Maintenance (High priority)
  - `reach_ops_approvals`: Workflow Approvals (Default priority)
- **Safe Expo Go Guard**: Automatically detects Expo Go environments on Android to suppress FCM push warnings and prevent native `setNotificationChannelAsync` crashes while preserving local alerts.
- **Hardware Device Registration**: Device push tokens are registered via `register_push_device` RPC with automatic reassignment upon device sharing and deactivation on logout.

### C. Date-Independent Operator Shift Architecture (`apps/mobile/components/operations/*`)
- **Dynamic Derivation**: Shift statuses derived in real-time via `get_shift_tasks()` over the 7-day retrospective window in `Asia/Kolkata` time zone.
- **Historical Immutability**: Closing or updating an assignment closes the range (`valid_to = yesterday`) and creates a new range (`valid_from = today`), keeping past logs tamper-proof.
- **Offline Mutation Queue**: Offline entries persist with `idempotency_key` and resolve assignments dynamically upon background synchronization.

### D. UI/UX Layout & Performance Optimization
- **Yoga Flexbox Scoping**: Scoped `height: '100%'` strictly to Web viewports via `Platform.select({ web: { height: '100%' }, default: {} })`, eliminating the Yoga flexbox bug where mobile KPI cards stretched 740px down the viewport.
- **Running Logs Static Buttons**: Upgraded view switcher to solid Reach Sky Blue (`#0284c7`) active buttons and hairline elevated outline buttons, eliminating touch ambiguity on narrow devices.
- **Design Token Invariants**: 100% compliant with Vercel Geist design tokens, 0 raw typography properties, and 44px minimum touch targets.

---

## 🧪 4. Verification & Quality Gates Summary

| Verification Gate | Command | Status | Result |
| :--- | :--- | :---: | :--- |
| **Expo Doctor** | `npx expo-doctor` | 🟢 PASS | 19 / 19 checks passed (0 issues detected) |
| **TypeScript Strict Mode** | `pnpm --filter mobile typecheck` | 🟢 PASS | 0 type errors across all files |
| **Mobile Automated Test Runner** | `node apps/mobile/test/index.mjs` | 🟢 PASS | 43 / 43 test suites passed (100%) |
| **Mobile Core Verification** | `node apps/mobile/test/run-tests.mjs` | 🟢 PASS | 357 / 357 assertions verified |
| **Touch Ergonomics & Soft Haptics** | `node scripts/test-touch-haptics.mjs` | 🟢 PASS | Rate-limiting (60ms), dedupe (120ms), and 44px targets verified |
| **Typography Compliance** | `node scripts/check-typography.mjs` | 🟢 PASS | 0 raw typography property violations found |
| **Parity Rules & Skills Suite** | `node scripts/test-parity-rules-and-skills.mjs` | 🟢 PASS | 95 / 95 assertions verified (100% Web/Mobile parity) |
| **Monorepo Comprehensive Battery** | `node scripts/run-all-tests.mjs` | 🟢 PASS | 25 / 25 suites passed cleanly |
| **EAS Build Configuration** | `eas.json` Validation | 🟢 PASS | Profiles configured: `production` (AAB for Play Store), `production-apk` (Direct APK), `preview` (Internal APK) |

---

## 🚀 5. Production Build & Deployment Instructions

### Option A: Build Production App Bundle (AAB) for Google Play Store
Google Play Store requires an **Android App Bundle (.aab)** for publication:
```bash
# Using root monorepo script
pnpm build:mobile

# Or from apps/mobile directory
cd apps/mobile
eas build --platform android --profile production
```

### Option B: Build Production APK (.apk) for Direct Install / Sideloading
To generate a standalone installable production APK with production Supabase endpoints:
```bash
# Using root monorepo script
pnpm build:mobile:apk

# Or from apps/mobile directory
cd apps/mobile
eas build --platform android --profile production-apk
```

### Option C: Submit directly to Google Play Store Track
Once the production AAB build completes on EAS:
```bash
cd apps/mobile

# Submit to Internal Testing track (Default)
eas submit --platform android --profile production

# Submit directly to Production track
eas submit --platform android --profile production-play
```

### Option D: Google Play Console Release Notes Copy-Paste
When creating a release in **Google Play Console** (under *Production* or *Internal testing* → *Releases* → *Release notes*), copy the exact text from **Section 1** (`en-US`) above into the release notes field.
