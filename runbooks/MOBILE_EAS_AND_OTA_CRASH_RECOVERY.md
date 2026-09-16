# Incident: Mobile EAS Build Failure & Production OTA Crash Loop

## Purpose
This runbook provides emergency mitigation, OTA update rollback, and Android 15 compatibility procedures when a deployed mobile update crashes the Expo React Native app (`apps/mobile`) on launch or when an EAS production build fails.

## Impact
- **Systems Affected**: Expo React Native mobile app (`apps/mobile`), EAS Update (`production` channel), EAS Build.
- **User Impact**: 100% of mobile field operators, mechanics, and site supervisors cannot open the mobile app or submit machinery shift logs.
- **Business Impact**: Delayed daily operations recording, delayed breakdown notifications, reliance on manual paper logs.

## Symptoms
- **Immediate Crash on Launch**: Mobile app displays splash screen and crashes immediately (white screen / crash loop).
- **OTA Update Rollback Trigger**: Workflow `.eas/workflows/publish-update.yml` published an update that introduced a runtime crash.
- **Android 15 Edge-to-Edge Window Inset Crash**: Crash logs show `IllegalStateException` or crash inside window insets when `SafeAreaProvider` is bypassed.
- **SecureStore Decryption Failure**: Crash on startup inside `apps/mobile/lib/supabase.ts` during hardware keystore token decryption.
- **Automated Test Suite Failure**:
  ```bash
  node apps/mobile/run-tests.mjs
  ```
  Fails on Test 4 (`SafeAreaProvider` or `FALLBACK_SUPABASE_URL` missing).

## Severity
**P0 / P1 (Critical if startup crash loop; High if build pipeline blocked)**

## Immediate Actions
1. **Initiate Emergency OTA Rollback (< 3 min)** `[REQUIRES HUMAN APPROVAL]`:
   - Re-publish the last known healthy update to the `production` channel:
     ```bash
     pnpm --filter @reachinternational/mobile exec eas update:list --channel production --limit 5
     pnpm --filter @reachinternational/mobile exec eas update:re-publish --channel production --group <PREVIOUS_HEALTHY_GROUP_ID>
     ```
2. **Alternative Clean Git Commit Rollback** `[REQUIRES HUMAN APPROVAL]`:
   ```bash
   git checkout <LAST_HEALTHY_COMMIT>
   pnpm --filter @reachinternational/mobile exec eas update \
     --channel production \
     --message "EMERGENCY ROLLBACK: Restoring stable bundle"
   ```
   *Clients download and apply the rolled-back bundle on next restart (`checkAutomatically: "ON_LOAD"` in `app.json`).*

## Diagnosis
1. **Execute Mobile Verification Runner** `[SAFE AUTOMATION]`:
   ```bash
   node apps/mobile/run-tests.mjs
   ```
   *Verifies `app.json`, `eas.json`, `SafeAreaProvider` presence in `_layout.tsx`, and `FALLBACK_SUPABASE_URL`.*
2. **Inspect Remote EAS Build / Update Logs** `[SAFE AUTOMATION]`:
   - Navigate to [Expo Dashboard](https://expo.dev/accounts/reachinternational/projects/reachinternational-monorepo) -> **Updates**.
   - Check error traces for null reference exceptions or broken style hooks.
3. **Execute Mobile TypeScript Check** `[SAFE AUTOMATION]`:
   ```bash
   pnpm --filter @reachinternational/mobile typecheck
   ```
   *Identifies missing prop types or strict TypeScript errors in React Native code.*

## Recovery
1. **Ensure Android 15 SafeAreaProvider Enclosure** `[SAFE AUTOMATION]`:
   Confirm `apps/mobile/app/_layout.tsx` encloses all routes:
   ```tsx
   import { SafeAreaProvider } from 'react-native-safe-area-context';
   export default function RootLayout() {
     return (
       <SafeAreaProvider>
         {/* Providers & Navigation */}
       </SafeAreaProvider>
     );
   }
   ```
2. **Ensure Fallback Supabase Client Initialization** `[SAFE AUTOMATION]`:
   Confirm `apps/mobile/lib/supabase.ts` contains `FALLBACK_SUPABASE_URL` and `FALLBACK_SUPABASE_ANON_KEY` to prevent unhandled exceptions if cloud build variables are stripped.
3. **Trigger New Production Android Binary Build (if native binary issue)** `[REQUIRES HUMAN APPROVAL]`:
   ```bash
   pnpm build:mobile
   # Runs: pnpm --filter @reachinternational/mobile exec eas build --platform android --profile production
   ```

## Validation
1. **Verify Mobile Test Runner**:
   ```bash
   node apps/mobile/run-tests.mjs
   ```
   *Must report `✅ Verification Suite Passed: All 18/18 test scenarios verified!`.*
2. **Verify Mobile Typecheck**:
   ```bash
   pnpm --filter @reachinternational/mobile typecheck
   ```
   *Must exit with code 0 (0 errors).*
3. **Live Device Smoke Test**:
   - Launch app on physical Android/iOS device.
   - Force-restart to trigger `checkAutomatically: "ON_LOAD"`.
   - Confirm app navigates to `/login` or `/operations?tab=entry` without crash.

## Rollback
- **EAS OTA Update Rollback**: Fully supported. Execute `pnpm --filter @reachinternational/mobile exec eas update:re-publish --channel production --group <PREVIOUS_HEALTHY_GROUP_ID>`.
- **Play Store Native AAB Rollback**: If a compiled binary was submitted to Google Play Store internal track via `apps/mobile/.eas/workflows/deploy-android.yml`, deactivate the faulty track release in Google Play Console and promote the previous build.

## Escalation
- If OTA rollback does not resolve the crash on native devices due to a native binary regression (e.g. incompatible native dependency upgrade), escalate to Mobile Lead to release an emergency hotfix binary through the Google Play Console internal track.

## Do Not
- **DO NOT** delete the `production` channel in EAS.
- **DO NOT** publish untested updates directly to production without testing on `preview` channel first (`eas update --channel preview`).
- **DO NOT** remove `SafeAreaProvider` from `_layout.tsx` (crashes Android 15 devices).

## Root Cause Follow-Up
- Confirm crash-free user rate returns to > 99.5% over the next 2 hours in Expo Dashboard.
- Log resolution in `public.audit_logs`:
  ```sql
  INSERT INTO public.audit_logs (action, category, severity, details, created_at)
  VALUES ('MOBILE_OTA_ROLLBACK_RESOLVED', 'mobile', 'HIGH', '{"channel": "production", "rolled_back_to": "<GROUP_ID>"}', now());
  ```
- File incident postmortem in [`performance/monitoring/incidents.md`](../performance/monitoring/incidents.md).
