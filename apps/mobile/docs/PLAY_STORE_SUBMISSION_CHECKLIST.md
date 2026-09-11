# Google Play Store — End-to-End Submission & Deployment Checklist

This guide outlines every technical and operational step required to build, package, sign, test, and release the **Reach International** mobile application on the Google Play Store.

---

## Pre-Flight Configuration Summary

- **App Package Name**: `com.reachinternational.app`
- **Initial Version**: `1.0.0`
- **Android Version Code**: `1` (configured in `apps/mobile/app.json`)
- **Build Target**: Android App Bundle (`.aab`)
- **Android Target SDK**: API 34+ (satisfies Google Play requirement)
- **Framework**: React Native with Expo SDK 57

---

## Phase 1: EAS Build Setup, Cloud Credentials & Service Account Key

### 1. Install EAS CLI & Authenticate
```bash
npm install -g eas-cli
eas login
```

### 2. Configure Remote EAS Secrets
EAS builds in the cloud need access to your Supabase public environment variables. Run these commands once:
```bash
cd apps/mobile
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project.supabase.co" --type string
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key" --type string
```

### 3. Upload Google Play Service Account Key to EAS (One-Time)
To enable automated Play Store submissions and EAS Workflows without committing secret keys:
1. In the **Google Play Console**, navigate to **API access** and create/select a Google Service Account with Release Manager permissions.
2. Generate and download the JSON key.
3. In your terminal, run:
   ```bash
   eas credentials -p android
   ```
4. Select **Google Service Account Key for Play Store submissions**.
5. Upload the downloaded JSON key to the EAS secure credential vault.
6. EAS securely associates this key with project `40432ac1-55a2-4bfa-985e-a51562398743`. No secret key file resides in source control or disk.

### 4. Build Production Android App Bundle (.aab)
Execute the production build using the `production` profile in `eas.json`:
```bash
eas build --platform android --profile production
```
- During your first build, EAS will prompt:
  *`Would you like EAS to generate a new Android keystore? [Y/n]`*
  → Select **Y (Yes)**.
- EAS will securely generate and store your production keystore in the Expo cloud vault.
- Once complete, EAS will output a download link for your signed `.aab` file.

---

## Phase 2: Google Play Console Setup

### 1. Create Application in Play Console
1. Navigate to [Google Play Console](https://play.google.com/console).
2. Click **Create app**.
3. Fill in basic details:
   - **App name**: `Reach International`
   - **Default language**: `English (United States) - en-US`
   - **App or game**: `App`
   - **Free or paid**: `Free`
4. Accept Developer Program Policies and US export laws → Click **Create app**.

### 2. Complete "Set up your app" (App Content Tasks)
Before you can publish releases, you must complete the mandatory checklist tasks in the console:

- **Privacy Policy**:
  - Paste: `https://www.reachinternational.co.in/privacy`
- **App Access**:
  - Select *“All or some functionality in my app is restricted”*.
  - Add test credentials for Google Play review team:
    - Username: `demo.operator@reachinternational.co.in` (or your review account)
    - Password: `[DemoPassword]`
    - Notes: *"Enterprise fleet management demo operator account. Access to active shift logging and machinery directory."*
- **Ads**:
  - Select *“No, my app does not contain ads”*.
- **Content Rating**:
  - Follow the exact answers in [PLAY_STORE_CONTENT_RATING.md](./PLAY_STORE_CONTENT_RATING.md).
- **Target Audience and Content**:
  - Select **18 and older**.
  - Appeal to children: Select **No**.
- **News Apps**:
  - Select **No**.
- **COVID-19 Contact Tracing & Status**:
  - Select *“My app is not a publicly available COVID-19 contact tracing or status app”*.
- **Data Safety**:
  - Follow the exact field-by-field answers in [PLAY_STORE_DATA_SAFETY.md](./PLAY_STORE_DATA_SAFETY.md).
  - Paste Account Deletion URL: `https://www.reachinternational.co.in/account-deletion`.
- **Government Apps**:
  - Select **No**.
- **Financial Features**:
  - Select *“My app doesn't provide any financial features”*.

---

## Phase 3: Store Listing Setup

Navigate to **Grow → Store presence → Main store listing**:

1. **Listing Details** (from [listing-details.json](../store-assets/listing-details.json)):
   - **App name**: `Reach International`
   - **Short description**: `Industrial machine fleet tracking, HMR logging, shifts & maintenance operations.` (80 chars)
   - **Full description**: Copy from [listing-details.json](../store-assets/listing-details.json).

2. **Graphics & Assets**:
   - **App icon**: Upload [app-icon-512x512.png](../store-assets/app-icon-512x512.png) (512×512 px).
   - **Feature graphic**: Upload [feature-graphic-1024x500.png](../store-assets/feature-graphic-1024x500.png) (1024×500 px).
   - **Phone screenshots**: Upload at least 2 (recommended 5) screenshots following [SCREENSHOTS_SPEC.md](../store-assets/SCREENSHOTS_SPEC.md).

3. **Store Settings**:
   - Category: **Business**
   - Contact email: `info@reachinternational.co.in`
   - Website: `https://www.reachinternational.co.in`

---

## Phase 4: Release Management, Testing & EAS Workflows

### 1. Automated Pipeline: EAS Workflow (`deploy-android.yml`)
Once the GitHub repository is connected to EAS (**Expo Project Dashboard → GitHub → Connect**):
- Any push to `main` modifying `apps/mobile/**`, `packages/**`, or `pnpm-lock.yaml` automatically triggers:
  1. `quality_gate`: Runs `pnpm typecheck` across workspace packages.
  2. `build_android`: Builds signed production `.aab`.
  3. `submit_android`: Automatically submits the `.aab` to Google Play's **Internal testing** track.

### 2. Manual On-Demand Submission
You can also trigger builds or submit an existing build directly:
```bash
# Build and immediately submit to internal track
eas build --platform android --profile production --auto-submit

# Or submit an existing build ID
eas submit -p android --id <BUILD_ID> --profile production
```

### 3. Internal Testing Track (Immediate)
1. Go to **Release → Testing → Internal testing**.
2. Releases submitted via EAS appear automatically.
3. Verify release notes and tester access.

### 4. Closed Testing Track (Mandatory for Personal Accounts)
*Note: If your Google Play account was created after Nov 2023 as a Personal Developer account, Google mandates 20 testers opted in for at least 14 days before production approval. Organization/Enterprise accounts do not require this.*
1. Go to **Release → Testing → Closed testing**.
2. Promote internal build to closed testing, invite 20 testers, and maintain for 14 continuous days.

### 5. Production Track Promotion (`production-play`)
When internal or closed testing is complete, promote to Google Play Production:
```bash
eas submit -p android --profile production-play
```
Alternatively, in Google Play Console: navigate to **Release → Production → Create release** and select the approved build bundle.

---

## Phase 5: Over-the-Air (OTA) Updates & Routing Rules

With `expo-updates` configured with `"runtimeVersion": { "policy": "appVersion" }`, you can deliver immediate bug fixes, UI enhancements, and operational logic updates without resubmitting to Google Play.

### 1. Deterministic Routing Rules
- **Binary Releases (Phase B — `deploy-android.yml`)**:
  - Native dependency changes (e.g. adding native modules)
  - Native Android permissions or manifest changes (`app.json`)
  - App Version bumps (`1.0.0` → `1.1.0`)
  - Triggered via `release/*` branches, commit message tag `[build]`, or manual dispatch.
- **OTA Updates (Phase C — `publish-update.yml`)**:
  - React Native JS/TS logic, styling, UI components, bug fixes
  - Triggered on `main` via `publish-update.yml` or CLI:
    ```bash
    eas update --channel production --message "Fix shift conflict calculation"
    ```

### 2. Version Governance
- **`versionCode` Ownership**: `autoIncrement: true` and `appVersionSource: remote` in `eas.json` mean EAS automatically increments and owns `versionCode` in the cloud. Do not manually manipulate `versionCode` in `app.json`.
- **`runtimeVersion` Alignment**: Set to `{"policy": "appVersion"}`. EAS Update guarantees that OTA updates only land on installed binaries with matching `appVersion` (`1.0.0`), preventing binary incompatibility crashes.

