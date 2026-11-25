# Reach International Mobile — Release Notes v1.4.0

**Release Target**: Google Play Store (Production Track) & In-App Release Hub  
**Package Name**: `com.reachinternational.app`  
**Version**: `1.4.0`  
**Version Code**: `5` (Base build number, auto-incremented via EAS Cloud)  
**Runtime Version**: `1.4.0` (EAS bare workflow synchronized string literal)  
**Target SDK**: Android API 36 (Android 15 / 16 compliant)  
**Minimum SDK**: Android API 24 (Android 7.0+)  
**Architecture**: React Native 0.88.1 / Expo SDK 58 (New Architecture enabled, Hermes AOT engine, 64-bit arm64-v8a / armeabi-v7a / x86_64)

---

## 📱 1. Google Play Store Release Notes (Under 500 Characters)

### English (United States) — `en-US`
```text
What's New in v1.4.0:
• Shift Personnel Assignment: Seamless single-row shift buttons (Shift A, B, C) and silky Reanimated dropdowns.
• Machine Details: Enhanced card layouts, eliminated height collapse, and 1-tap client code copy.
• Performance & Theme: Zero-lag theme switching with precomputed palettes and optimized render allocations.
• Operations Validation: Real-time shift overlap protection and 1-tap switch to assigned shifts.
• Ergonomics: 44px+ touch targets and refined haptic feedback.
```

---

## 🔔 2. In-App Release Notes ("What's New in Reach Ops")

*Displayed automatically on first launch via the non-blocking `WhatsNewSheet` and accessible on-demand under `Settings` → `About` → `What's New` (`/settings/about/whats-new`).*

### Release Title: **What's New in Reach Ops v1.4.0**
> *Silky shift assignments, optimized machine management, precomputed high-performance themes, and refined operator workflows.*

### In-App Feature Highlights:
1. **Refined Shift Personnel Assignment** (`feature` | `icon: users`):
   - Single-row shift buttons (`Shift A`, `Shift B`, `Shift C`) with compact hours (`6AM-2PM`, `2PM-10PM`, `10PM-6AM`).
   - 60fps Reanimated dropdown collapsibles (`DropdownCollapsible`) with height, opacity, and glide interpolation.
   - Smooth 180-degree rotating chevrons and silky spring physics (`stiffness: 340, damping: 32, mass: 0.9`).
2. **Optimized Machine Details** (`improvement` | `icon: truck`):
   - Redesigned card layouts resolving flex layout height collapse and container overlap.
   - Compact light-grey client code pill badge with 1-tap clipboard copy and haptic feedback.
   - Streamlined hero card with redundant buttons migrated to the header actions menu.
3. **High-Performance Theme Engine** (`performance` | `icon: sparkles`):
   - Precomputed frozen design token palettes eliminating runtime color recomputations.
   - `useSyncExternalStore` theme store with zero-lag dark/light theme switching.
   - Cached component styling allocations across `Card`, `Button`, `Badge`, and `Text`.
4. **Operational Shift Validation** (`feature` | `icon: shield-check`):
   - Strict shift-end validation preventing premature shift submissions (`BUG-SHIFT-01`).
   - 1-tap "Switch to Assigned Shift" shortcut preventing operator unassigned shift submission errors (`BUG-SHIFT-06`).
   - Cross-machine shift overlap collision prevention and automated conflict resolution.
5. **Ergonomic Touch Targets** (`improvement` | `icon: zap`):
   - Strict 44px+ minimum touch target heights across all bottom sheet actions, filter triggers, and navigation tabs.
   - Enhanced tactile haptic feedback (`haptics.select()`, `haptics.confirm()`, `haptics.reject()`).

---

## 🛠️ 3. Detailed Technical Improvements & Architecture Hardening

### A. Machinery Detail & Shift Assignment Architecture
- **Canonical Modal Consolidation**: Replaced legacy `AssignOperatorToMachineModal` in `MachineDetailView.tsx` with canonical `MobileAssignPersonnelModal.tsx` bound to `initialMachineId={machine.id}`.
- **Anti-Collapse Panel Sizing**: Resolved Yoga layout engine auto-height collapse bug in bottom sheets by setting explicit `height: '88%', maxHeight: '92%'` in `panelStyle` and adding a `minHeight: 220` anti-collapse safety guard in `Sheet.tsx`.
- **Spring Entrance & Eased Exit Physics**: Tuned entrance curve to `stiffness: 340, damping: 32, mass: 0.9` and exit to cubic-bezier timing `duration: 220, Easing.bezier(0.3, 0, 0.8, 0.15)`, synchronized with Scrim backdrop fade (260ms in / 220ms out).
- **Single-Row Shift Cards**: Prevented shift card wrapping on compact mobile displays (≤427px) using `flex: 1` and `minWidth: 0` constraints.

### B. High-Performance Mobile Theme Engine
- **Frozen Theme Palettes**: Replaced object generation on every render with precomputed, frozen palette dictionaries in `@reachinternational/design-tokens` and `ThemeProvider.tsx`.
- **Store-Based Theme Subscription**: Wired navigation theming through `useSyncExternalStore`, eliminating unnecessary React re-renders during app resume and navigation state changes.
- **Cached Style Maps**: Implemented static style resolution for core design primitives (`Card`, `Button`, `Badge`, `Text`) with zero garbage collection spikes.

### C. Shift & Hour Meter Validation Parity
- **Cross-Layer Parity**: Unified `CreateHourLogSchema` across Web and Native with shared Zod refinement bounds for shift code, operator ID, and client ID (`packages/validation/src/hourMeter.ts`).
- **Postgres Exclusion Safety**: Aligned mobile mutation workflows with PostgreSQL exclusion constraint `osr_machine_shift_no_overlap` (`23P01`).
- **Runtime Warning Suppression**: Safely suppressed harmless React Native notices for deprecated `ImageBackground` and `VirtualizedList` unmounts.

### D. Security & Permissions
- **Hardware Keystore Authentication**: Auth tokens and refresh credentials stored exclusively in hardware keystores via `expo-secure-store` (Android Keystore / iOS Keychain).
- **Zero Exposed Secrets**: Verified client bundles expose only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **Minimal Android Permissions**: Blocked legacy permissions (`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `ACCESS_WIFI_STATE`, `USE_FINGERPRINT`, `USE_BIOMETRIC`) via manifest merger rules.

---

## 🧪 4. Verification & Readiness Gates

| Verification Gate | Command | Status | Result |
| :--- | :--- | :---: | :--- |
| **Expo Doctor** | `npx expo-doctor` | 🟢 PASS | 19 / 19 checks passed (0 issues detected) |
| **TypeScript Strict Mode** | `tsc --noEmit` | 🟢 PASS | 0 type errors across all packages |
| **Mobile Test Suite** | `node apps/mobile/test/index.mjs` | 🟢 PASS | 36 / 36 test suites passed (100%) |
| **What's New System** | `node test-whats-new-system.mjs` | 🟢 PASS | 57 / 57 assertions verified |
| **Machine Workflows** | `node test-machines-workflows.mjs` | 🟢 PASS | 100% verified |
| **Shift Assignment Modals** | `node test-assign-operator-modal.mjs` | 🟢 PASS | 100% verified |
| **Filter & Layout Engine** | `node test-search-filter-layout.mjs` | 🟢 PASS | 30 / 30 verified |
| **Typography Compliance** | Design Token Lint | 🟢 PASS | 0 raw typography property violations |
| **EAS Build Configuration** | `eas.json` Validation | 🟢 PASS | `production` profile configured for `app-bundle` (AAB) with `autoIncrement: true` |

---

## 🚀 5. Deployment Instructions (Google Play Console)

### Step 1: Trigger Cloud AAB Build via EAS
```bash
cd apps/mobile
eas build --platform android --profile production
```

### Step 2: Submit to Google Play Track
Once the build completes on EAS:
```bash
eas submit --platform android --profile production
```
*(Or use `--profile production-play` to deploy directly to the Production track after internal review).*

### Step 3: Google Play Console Release Notes
Copy the exact text from **Section 1** above into the **Release notes** input for language `en-US`.
