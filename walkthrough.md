# Aadhaar / Licence Document Upload Across Signup, Edit Profile & Onboarding — Walkthrough & Verification

## Summary of Implementation

We implemented and verified full-stack, cross-platform Aadhaar and Driving Licence document uploads across:
1. **Signup** (`/signup` on Web, `/(auth)/signup` on Mobile)
2. **Edit Profile** (`EditProfileModal` on Web and Mobile)
3. **Onboarding** (`/onboarding` on Web, `/(auth)/onboarding` on Mobile)
4. **All Application Routes Verification** across Web and Mobile

---

## 1. Web Application Changes (`apps/web`)

### Next.js Configuration (`apps/web/next.config.ts`)
- Increased `serverActions.bodySizeLimit` from `"1mb"` to `"5mb"`.
- This ensures multipart `FormData` submissions containing two 2MB document files are processed seamlessly by Server Actions without HTTP 413 "Request Entity Too Large" errors.

### Signup Flow (`apps/web/app/signup/page.tsx` & `apps/web/app/actions/auth.ts`)
- **UI (`apps/web/app/signup/page.tsx`)**:
  - Embedded dedicated Aadhaar and Driving Licence document upload cards in Section 3 ("Work Location & Identity").
  - Includes pre-flight client-side validation (`validateDocumentFile`), enforcing 2MB cap and accepted formats (`image/jpeg`, `image/png`, `application/pdf`).
  - Displays instant image previews via `URL.createObjectURL`, formatted file size indicators, and one-click remove buttons.
  - Appends `aadhaar_file` and `license_file` to `FormData` on form submission.
- **Backend Action (`apps/web/app/actions/auth.ts`)**:
  - In `signup(formData)`, extracts `aadhaar_file` and `license_file`.
  - Immediately after user creation via `supabase.auth.signUp()`, uses `adminSupabase` (service role) to upload files into the private `user_files` storage bucket under path convention:
    `documents/${userId}/aadhaar.${ext}`
    `documents/${userId}/driving_license.${ext}`
  - Upserts corresponding records into `public.user_documents` with full metadata and audit trail.

### Edit Profile Modal (`apps/web/components/profile/EditProfileModal.tsx`)
- Fetches existing uploaded user documents via `getUserDocumentsAction(user.id)`.
- Displays status cards in Section 1 ("Personal Details") showing existing uploaded documents with signed URLs.
- Provides direct upload/replace functionality with real byte-level XHR progress tracking (`uploadFileWithProgress` and `confirmDocumentUploadAction`).
- Includes document removal with confirmation dialogue.

### Onboarding Flow (`apps/web/app/onboarding/OnboardingClient.tsx` & `apps/web/app/actions/onboarding.ts`)
- In Section 4 ("Identity & Verification"), added upload cards for Aadhaar Card and Driving Licence.
- Handles file selection, validation, and attachment to `FormData`.
- Updated `completeOnboardingAction` to process files and upsert them into `public.user_documents` with storage registration.

---

## 2. Mobile Application Parity (`apps/mobile`)

### Dependencies & File Picker (`apps/mobile/package.json`)
- Installed `expo-document-picker` (~57.0.2) to support native and web document selection on iOS, Android, and Web.

### Mobile Document Manager (`apps/mobile/lib/documents.ts`)
- `pickIdentityDocument()`: Launches native document picker restricted to `['image/jpeg', 'image/png', 'application/pdf']` with 2MB pre-flight check.
- `uploadUserDocumentDirect()`: Reads file binary (via `Blob` / `FileSystem` base64), uploads to `user_files` storage bucket, and upserts into `public.user_documents`.
- `fetchUserDocuments(userId)`: Retrieves user documents with secure signed URLs.
- `deleteUserDocument()`: Removes storage object and deletes DB row.

### Reusable Mobile Component (`apps/mobile/components/documents/MobileDocumentUploadCard.tsx`)
- Styled with Vercel Geist design tokens (`#171717`, `#ffffff`, `#ebebeb`, `#0ea5e9`).
- Status badges ("Uploaded", "Selected").
- Live upload progress bar.
- Direct document viewing with system browser / viewer via `Linking.openURL(signedUrl)`.
- Accessible touch targets (minimum 44px) and replace/remove actions.

### Mobile Signup (`apps/mobile/app/(auth)/signup.tsx`)
- Integrated `MobileDocumentUploadCard` into Section 3 ("Work Location & Identity") right below Aadhaar Card and Licence number inputs.
- Automatically uploads selected documents upon user creation.

### Mobile Edit Profile (`apps/mobile/components/profile/EditProfileModal.tsx`)
- Section 1 ("Personal Details") displays existing documents with signed URLs and provides immediate in-modal upload/replace with real progress and delete options.

### Mobile Onboarding (`apps/mobile/app/(auth)/onboarding.tsx`)
- Section 4 ("Identity Verification") renders document upload cards for Aadhaar and Licence with live progress and automatic linking upon onboarding completion.

---

## 3. Route Verification & Monorepo Typecheck

### Application Routes Verified
| Route | Web Path | Mobile Path | Protected / Auth | Status |
|---|---|---|---|---|
| **Login** | `/login` | `/(auth)/login` | Auth | Working |
| **Signup** | `/signup` | `/(auth)/signup` | Auth (Aadhaar & Licence Upload) | Working |
| **Forgot Password** | `/forgot-password` | `/(auth)/forgot-password` | Auth | Working |
| **Reset Password** | `/reset-password` | N/A (Web PKCE callback) | Auth | Working |
| **Onboarding** | `/onboarding` | `/(auth)/onboarding` | Protected (Aadhaar & Licence Upload) | Working |
| **Dashboard** | `/dashboard` | `/(app)/dashboard` | Protected (6 Role Read Models) | Working |
| **Operations** | `/operations` | `/(app)/operations` | Protected (Single-Page Running Hours) | Working |
| **Machines** | `/machines` | `/(app)/machines` | Protected | Working |
| **Clients** | `/clients` | `/(app)/clients` | Protected | Working |
| **Users** | `/users` | `/(app)/users` | Protected (KYC & Documents Sheet) | Working |
| **Profile** | `/profile` | `/(app)/profile` | Protected (Edit Profile & Documents) | Working |
| **Attendance** | `/attendance` | `/(app)/attendance` | Protected | Working |
| **Payroll** | `/payroll` | `/(app)/payroll` | Protected (`/hr` redirect -> `/payroll`) | Working |
| **Settings** | `/settings` | `/(app)/settings` | Protected | Working |
| **More** | `/more` | `/(app)/more` | Protected | Working |

### Automated Tests
- **Navigation Permissions Suite**: `pnpm --filter @reachinternational/permissions test`
  - 3/3 tests passed (100% pass rate).
- **Monorepo Typecheck**: `pnpm turbo run typecheck`
  - 7 of 7 packages passed with **0 errors**:
    - `@reachinternational/web`
    - `@reachinternational/mobile`
    - `@reachinternational/permissions`
    - `@reachinternational/types`
    - `@reachinternational/utils`
    - `@reachinternational/validation`
    - `@reachinternational/design-tokens`
