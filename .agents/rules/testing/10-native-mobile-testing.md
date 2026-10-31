# Native Mobile Application Testing Standards

> **VERIFICATION STANDARDS FOR EXPO SDK 57, REACT NATIVE, ANDROID & IOS APPS**  
> *Cross-references [`apps/mobile/AGENTS.md`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/apps/mobile/AGENTS.md) and the agent skill [`.agents/skills/native-backend-architecture/SKILL.md`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/.agents/skills/native-backend-architecture/SKILL.md). Mobile testing requires physical touch and platform-specific device validation.*

---

## 1. Purpose

The purpose of ReachInternational's Native Mobile Testing standards is to ensure the **Expo SDK 57 / React Native 0.86 application operates with rock-solid stability, zero unhandled red-screen exceptions, proper hardware keystore token encryption, and dependable offline resilience** across both Android and iOS devices.

---

## 2. Applicable Applications & Packages

- `apps/mobile`: Expo Router, React Native UI components, TanStack Query, SecureStore, and offline sync
- `packages/design-tokens`: Shared mobile typography scale and Geist color tokens

---

## 3. Native Testing Targets & Platform Invariants

### A. Hardware & Security Invariants
1. **Hardware-Backed SecureStore (`expo-secure-store`)**:
   - Authentication tokens and refresh tokens MUST be stored in hardware keystores (Android Keystore / iOS Keychain).
   - Never store raw credentials or session tokens in unencrypted AsyncStorage.
2. **Platform Verification Honesty (MANDATORY)**:
   - **Never claim an iOS test passed when only Android was tested.**
   - If a test was executed on an Android emulator or device, report `Android: PASS | iOS: NOT RUN (No macOS/iOS runner available)`.

### B. Offline Resilience & Sync Queue
1. **NetInfo Connectivity Monitoring**:
   - The app must display an ambient status banner (`OfflineBanner.tsx`) when internet connectivity is lost.
2. **Persistent Mutation Queue**:
   - Shift entries, breakdowns, and machine logs recorded while offline must be queued in encrypted AsyncStorage and automatically retried upon network restoration.
3. **Optimistic UI Updates**:
   - Immediate UI feedback must be rendered while queueing background sync.

### C. Touch Ergonomics & Motion Primitives
1. **Minimum 44px Touch Targets**:
   - All interactive touch targets (`Pressable`, buttons, filter chips, tabs) must specify `minHeight: 44` to ensure finger touch reliability.
2. **Tactile Haptic Feedback**:
   - Touch interactions must provide subtle haptic feedback via `Haptics.selectionAsync()` or `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`.
   - Haptics must be rate-limited (60ms debounce) and completely muted when disabled in user settings.

### D. Typography & Design Token Safety
1. **Zero Raw Typography Properties**:
   - Raw typography properties (`fontSize`, `fontWeight`, `fontFamily`, `lineHeight`) are strictly forbidden inside mobile `StyleSheet.create`.
   - All text must render through the canonical `<Text variant="...">` component consuming `@reachinternational/design-tokens`.
2. **Bimodal Corner Radius**:
   - `6px` for cards, dialogs, inputs, and container surfaces.
   - `64px` for pills and status badges.

### E. Keyboard & Safe Area Handling
1. **Safe Area Insets**: Screens must wrap content in `SafeAreaView` or consume `useSafeAreaInsets()` to prevent notch and home indicator clipping.
2. **Keyboard Avoiding Layout**: Forms must use `KeyboardAvoidingView` or `KeyboardAwareScrollView` so inputs remain visible above the software keyboard.

---

## 4. Required Testing Approach

```text
[ RUN MOBILE VERIFICATION SUITE ]
  ├── Run node apps/mobile/test/run-tests.mjs (Validates all 357+ component & workflow invariants)
  └── Verify 100% test pass rate

[ AUDIT TYPOGRAPHY & TOUCH TARGETS ]
  ├── node scripts/check-typography.mjs (Zero raw font properties)
  └── node scripts/test-touch-haptics.mjs (Touch targets ≥ 44px, haptics rate-limited)

[ WORKFLOW SPECIFIC TESTING ]
  ├── Test Authentication: node apps/mobile/test/test-auth-workflows.mjs
  ├── Test Shift Entry: node apps/mobile/test/test-shift-workflows.mjs
  └── Test Machines Query: node apps/mobile/test/test-machines-workflows.mjs
```

---

## 5. Recommended Tools

- **Mobile Test Suite**: Node-based component and workflow invariant runners (`run-tests.mjs`)
- **Expo Tools**: `expo start`, `expo run:android`, `expo run:ios`
- **Typography & Ergonomics Linters**: `check-typography.mjs`, `test-touch-haptics.mjs`

---

## 6. Actual Project Commands

```bash
# 1. Complete mobile test suite (357 scenarios)
node apps/mobile/test/run-tests.mjs

# 2. Verify zero raw typography properties in StyleSheet.create
node scripts/check-typography.mjs

# 3. Verify touch ergonomics and haptics
node scripts/test-touch-haptics.mjs

# 4. Run targeted workflow tests
node apps/mobile/test/test-auth-workflows.mjs
node apps/mobile/test/test-shift-workflows.mjs
node apps/mobile/test/test-machines-workflows.mjs
node apps/mobile/test/test-settings-workflows.mjs
node apps/mobile/test/test-client-details-workflows.mjs
node apps/mobile/test/test-document-viewer-workflows.mjs

# 5. Typecheck mobile application
pnpm --filter @reachinternational/mobile typecheck
```

---

## 7. Success Criteria

1. **All 357+ Tests Pass**: `run-tests.mjs` exits with code `0`.
2. **Zero Typography Violations**: `check-typography.mjs` outputs `0 raw typography properties found`.
3. **Zero Haptic Violations**: `test-touch-haptics.mjs` passes all rate-limiting and target size guards.
4. **Honest Reporting**: Platform testing status clearly separates Android from iOS results.

---

## 8. Failure Handling

- If `check-typography.mjs` fails: identify the raw `fontSize` or `fontWeight` in the reported file and replace it with `<Text variant="...">` from the design tokens.
- If a touch target is too small: add `minHeight: 44` and `minWidth: 44` to the `Pressable` style container.
- If an offline mutation test fails: ensure the operation writes to AsyncStorage before attempting the Supabase network call.

---

## 9. Evidence & Reporting

The test report must provide:
- Total mobile test scenarios passed (`X / X`).
- Platform tested (e.g. Android Emulator / Android Device / iOS Simulator).
- Typography and Touch ergonomics verification status.
