# Current Task

## Task: 183 — Expo Doctor Root Cause Analysis & Resolution: Disable Non-CNG Check for Bare Native Workflow & Upgrade Expo SDK 57 Patch Dependencies
**Status**: 🟢 COMPLETED
**Date**: 2026-10-16
**Scope**:
- **Diagnosis of Expo Doctor Failures**:
  1. User/EAS Build reported 2 failing checks during `expo doctor` (`npx -y expo-doctor`):
     - `✖ Check for app config fields that may not be synced in a non-CNG project`: Triggered by `AppConfigFieldsNotSyncedToNativeProjectsCheck`. The project has a committed native `android/` folder (bare workflow), but `app.json`/`app.config.js` configures native properties (`orientation`, `icon`, `scheme`, `userInterfaceStyle`, `ios`, `android`, `plugins`). Because `android/` is not in `.easignore`, EAS Build and `expo-doctor` flag that configuration properties will not sync automatically without prebuild.
     - `✖ Check that packages match versions required by installed Expo SDK`: Triggered by `InstalledDependencyVersionCheck` (`npx expo install --check`). Expo SDK 57 expected patch releases: `expo@~57.0.30`, `expo-constants@~57.0.22`, `expo-linking@~57.0.13`, and `expo-router@~57.0.28`, whereas the project had `57.0.28`, `57.0.21`, `57.0.12`, and `57.0.26`.
- **Implementation & Resolution**:
  1. **Disable Non-CNG Prebuild Check for Bare Native Project**: Configured `apps/mobile/package.json` with `"expo": { "doctor": { "appConfigFieldsNotSyncedCheck": { "enabled": false } } }`, the official Expo Doctor flag for projects managing native code directly.
  2. **Aligned Expo SDK 57 Dependencies**: Upgraded `expo` to `~57.0.30`, `expo-constants` to `~57.0.22`, `expo-linking` to `~57.0.13`, and `expo-router` to `~57.0.28`.
  3. **Patched Dependencies Synchronization**: Transitioned `pnpm-workspace.yaml` and `patches/` to target `expo-router@57.0.28` (`patches/expo-router@57.0.28.patch`) to preserve bottom tabs navigation transition stability, and updated `pnpm-lock.yaml` cleanly via `pnpm install`.
- **Verification**:
  - `npx expo-doctor --verbose` in `apps/mobile`: **PASS** (`20/20 checks passed. No issues detected!`, exit code 0).
  - `pnpm --filter @reachinternational/mobile typecheck`: **PASS** (`tsc --noEmit` -> 0 errors, exit code 0).
  - `node scripts/check-typography.mjs`: **PASS** (0 raw typography violations).
  - `node apps/mobile/run-tests.mjs`: **PASS** (187/187 test scenarios passed, 100%).
  - `pnpm --filter @reachinternational/mobile test:all`: **PASS** (all suites passed, 100%).
  - `pnpm --filter @reachinternational/permissions test`: **PASS** (5/5 tests passed, 100%).
  - `pnpm typecheck`: **PASS** (7/7 packages successful across monorepo).
