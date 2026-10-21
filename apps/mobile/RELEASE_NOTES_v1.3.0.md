# Reach International Mobile — Release Notes v1.3.0

**Release Target**: Google Play Store (Production Track)  
**Package Name**: `com.reachinternational.app`  
**Version**: `1.3.0`  
**Version Code**: Dynamic (managed via EAS Cloud `autoIncrement: true`, base: `4`)  
**Target SDK**: Android API 36 (Android 15 / 16 compliant)  
**Minimum SDK**: Android API 24 (Android 7.0+)  
**Architecture**: React Native 0.86.3 / Expo SDK 57 (New Architecture enabled, Hermes engine, 64-bit arm64-v8a / armeabi-v7a / x86_64)

---

## 🚀 Key Highlights & New Capabilities

### 1. In-App Native PDF & Document Viewer
- **Native Android PDFium & Apple PDFKit Engine**: Built native viewer using `@kishannareshpal/expo-pdf` with continuous vertical multipage scrolling (`horizontal={false}`, `pagingEnabled={false}`), fit-to-width auto scaling (`fitMode="width"`), and double-tap zoom.
- **Eradication of External Google Drive Chrome**: Replaced third-party Google Drive web redirect (`docs.google.com/gview`) with 100% in-app rendering, zero external redirects, and high-DPI canvas sharpness on web export via Mozilla PDF.js.
- **Shared High-Performance Document Cache**: Implemented `ensureLocalDocumentFile` caching service that checks memory and disk cache, validates file size integrity, and deduplicates concurrent download promises. Document viewer, in-app download, and OS share sheet all reuse the same local cached file without redundant network roundtrips.
- **Ergonomic Toolbar**: Seamless header rotate action for both images and multipage PDFs, full-screen canvas height down to safe-area insets, and minimum 48px touch targets.

### 2. User Profile & Identity Documents (/profile)
- **Document Management**: Full support for uploading, replacing, viewing, and deleting identity credentials (Aadhaar, Driving Licence, Bank Documents).
- **Self-Healing Storage Resolution**: Dynamic extension matching (`png`, `jpg`, `jpeg`, `pdf`, `webp`) to gracefully handle legacy or missing storage references.
- **Optimistic UI Updates**: Immediate client-side removal and dropzone slot reset upon deletion confirmation, backed by secure Supabase RLS policies.
- **Functional Copy Actions**: Instant one-tap copy icons across Employee ID, contact numbers, email, bank details, and identity numbers with tactile haptic confirmation and toast notifications.
- **100% Solid Opacity Surfaces**: Replaced legacy translucent wash backgrounds with solid high-contrast chips and badges compliant with WCAG AAA readability.

### 3. Authentication & Security Hardening
- **Dark Mode Autofill Polish**: Eradicated browser/device user-agent white flash on autofilled inputs in dark mode with authoritative `-webkit-box-shadow: 0 0 0px 1000px #141414 inset` overrides.
- **Concise & Informative Validation**: Streamlined error strings across all login and signup fields to fit narrow mobile viewports (≤427px) cleanly without text clipping.
- **Interactive Password Guidance**: Added real-time password strength meter (Weak/Fair/Good/Strong) with requirement pattern chips and live matching indicator under confirm password.
- **Authoritative Password Reset**: Integrated administrative password reset RPC with bcrypt hashing, strict RBAC guards, and immutable audit trail logging.
- **Keystore-Backed Auth Storage**: Authentication tokens stored exclusively in hardware keystores (`expo-secure-store`) with zero plaintext AsyncStorage fallback.

### 4. Visual Excellence & Geist Design System Parity
- **Theme-Aware Skeleton Loaders**: Overhauled core skeleton loading primitive to synchronize with `useTheme()` (`#262626` hairline fill in dark mode vs `#ebebeb` in light mode), eliminating blinding white placeholders on dark surfaces.
- **Aligned Layout Skeletons**: Page-by-page structural skeleton matching for Machines, Attendance, Users, Clients, Payroll, and modal dialogs.
- **Zero Raw Typography Violations**: Enforced `<Text variant="...">` design system tokens across all mobile screens.

### 5. Fleet Operations & Directory Ergonomics
- **Whole-Card Tap Ergonomics**: Entire user touch cards now respond to tap interactions with dedicated action pill buttons ("More", "Assign Machine", "Supervisor") isolated with event propagation guards.
- **Direct WhatsApp Communication**: Quick-launch WhatsApp chat button with formatted phone link.
- **Mobile-Optimized Segmented Navigation**: Shortened tab titles and horizontal scrolling tabs fitting 427px phone viewports with lazy data loading and explicit column projections (zero `SELECT *`).

### 6. Android 15+ Native Platform Compliance
- **Edge-to-Edge Display**: Enabled transparent system bars with `android:windowLayoutInDisplayCutoutMode="always"` and zero contrast enforcement for edge-to-edge layouts.
- **Large Screen & Foldable Ready**: Added `resizeableActivity="true"` and dynamic multi-window support for tablets and foldables.
- **Strict Permission Minimization**: Explicitly stripped legacy permissions (`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `ACCESS_WIFI_STATE`, `USE_FINGERPRINT`, `USE_BIOMETRIC`) via manifest merger rules.
- **DEX Optimization & Obfuscation**: Enabled R8 minification, resource shrinking, and fullMode optimization with comprehensive ProGuard rules.

---

## 🧪 Verification & Quality Gates

| Verification Check | Status | Result |
| :--- | :---: | :--- |
| **Expo Doctor (`npx expo-doctor`)** | 🟢 PASS | 20/20 checks passed, 0 issues detected |
| **TypeScript Typecheck (`tsc --noEmit`)** | 🟢 PASS | 0 type errors across monorepo |
| **Monorepo Test Suite (`run-tests.mjs`)** | 🟢 PASS | 357/357 test scenarios passed (100%) |
| **Document Viewer Workflows** | 🟢 PASS | 41/41 assertions verified |
| **Typography Compliance (`check-typography.mjs`)** | 🟢 PASS | 0 raw typography property violations |
| **EAS Authentication (`eas whoami`)** | 🟢 PASS | Authenticated (`vaibhavchauhan_15`) |
| **Production Keystore & Credentials** | 🟢 PASS | Managed remotely in EAS Cloud |
