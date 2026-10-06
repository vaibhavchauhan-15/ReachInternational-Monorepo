# Current Task

## Task: Profile (/profile) Page Polish & Document Uploads Refinement (`packages/utils`, `apps/web`, `apps/mobile`)
**Status**: 🟢 IMPLEMENTATION COMPLETE / VERIFIED
**Date**: 2026-10-06
**Type**: UI/UX & Responsive Refinement / Profile Data Architecture & Document Upload Polish
**Surfaces**:
- `packages/utils/src/profile-view.ts`
- `apps/web/components/documents/DocumentUploadSection.tsx`
- `apps/mobile/app/(app)/profile.tsx`

### User Request & Feedback Addressed
1. **Remove Assigned Machinery from Profile**:
   - Removed "Assigned Machinery" from "Work & Operations" section since machinery assignments already display comprehensively on the dedicated machines page (`/machines`).
2. **Remove Date of Joining from Work & Operations**:
   - Removed redundant "Date of Joining" row from "Work & Operations" (account registration date is already displayed via "Member Since" under "Account & System").
3. **Remove Residential Address Section**:
   - Completely removed the "Residential Address" section (`addressRows` and `Residential Address` card) from `toProfileView`. Personnel only have working location / site location (which is preserved in "Work & Operations").
4. **Move Profile Status to Account & System Section**:
   - Moved "Profile Status" (`Complete (100%)` / `Incomplete`) from "Work & Operations" to the "Account & System" section where account state belongs.
5. **Document Upload Format & Metadata Polish**:
   - In `DocumentUploadSection.tsx`, removed verbose `" • Click to view"` and `"Document"` text from document metadata paragraphs. Replaced with clean format and file size (e.g. `PDF • 1.3 MB`, `JPG • 1.9 MB`).
   - Cleaned up local file selection preview metadata to display format and size concisely.
6. **Icon-Only Document Format Squircles**:
   - In `<DocumentFormatIcon>` (`DocumentUploadSection.tsx`), removed text labels (`PDF`, `IMG`, `DOC`), displaying crisp format icons (`FileText`, `ImageIcon`) inside the squircle.
   - Synchronized 100% parity to `apps/mobile/app/(app)/profile.tsx`, updating `formatBadgeSquare` to icon-only and streamlining `existingDocMeta`.

### Verification Results
- Monorepo Typecheck: **PASS** across all 7 packages (`pnpm typecheck` -> 7/7 successful, exit code 0).
- Typography Audit: **PASS** (`node scripts/check-typography.mjs` -> 0 raw typography properties, exit code 0).
- Parity Rules & Skills Test Suite: **PASS** (`node scripts/test-parity-rules-and-skills.mjs` -> 95/95 tests passed, exit code 0).
- Mobile Automated Test Suite: **PASS** (`node apps/mobile/run-tests.mjs` -> 21/21 scenarios passed, exit code 0).
- Permissions Unit Tests: **PASS** (`pnpm --filter @reachinternational/permissions test` -> 4/4 passed).
- Design Tokens Unit Tests: **PASS** (`pnpm --filter @reachinternational/design-tokens test` -> 3/3 passed).
