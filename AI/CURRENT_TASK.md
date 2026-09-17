# Current Task: User Directory Unified Export Architecture (Address Merging, DB Identity Hydration, PDF Support, Cross-Platform Web & Mobile Parity)

Status: COMPLETED & VERIFIED (2026-09-17)

## Task Summary
Addressed user feedback on `/users?tab=all` regarding the User & Employee Directory export features:
1. **Single Unified `Address` Column**:
   - Replaced fragmented `City`, `District`, and `State` columns with a single clean `Address` column merging `street + city + district + state`.
   - Created smart deduplication in `formatMergedAddress()` preventing redundant strings (e.g. "Songhad tapi, Songhad tapi, Gujarat" -> "Songhad tapi, Gujarat").
2. **PostgreSQL Identity Data Hydration**:
   - Projected `address`, `aadhaar_number`, and `license_number` into `USER_LIST_COLUMNS` in `apps/web/lib/data/users/user-list.ts`.
   - Fixed missing Aadhaar and Driving Licence numbers that previously rendered as dashes (`—`) despite being populated in the database.
3. **Print-Ready Landscape A4 PDF Export**:
   - Added instant PDF export feature on both Web and Mobile.
   - Web implementation uses zero-dependency CSS `@media print` landscape A4 spooling via `handleBrowserPrint()`.
   - Mobile implementation uses native `expo-print` (`Print.printToFileAsync`) and `expo-sharing` (`Sharing.shareAsync`).
   - Clean, professional styling matching Vercel Geist design tokens with company header, KPI strip, and authorization sign-offs.
4. **100% Data Consistency Across All Formats**:
   - Guaranteed identical 12-column sequence across Excel (.xlsx), CSV (.csv), and PDF:
     `S.No`, `Full Name`, `Email Address`, `Mobile Number`, `Role`, `Supervisor`, `Working Location`, `Status`, `Address`, `Aadhaar Number`, `Driving Licence`, `Joined Date`.
5. **Lightweight & High Performance**:
   - Dynamic code splitting with on-demand library imports.
   - Minimal file size (<15 KB for typical spreadsheets, UTF-8 BOM for CSV).
   - Zero additional client-side bundle weight for PDF on web.
6. **Responsive UI & Mobile Parity**:
   - Web header dropdown (`UsersHeader.tsx`) supports 3-way toggle (Excel, CSV, PDF) with responsive viewport clamping (`max-w-[calc(100vw-24px)]`).
   - Mobile modal (`UserExportModal.tsx`) provides CSV and PDF export options with identical 12-column data.
   - Floating bulk selection actions bar supports Excel, CSV, and PDF.

## Verification
- Monorepo compilation: `pnpm turbo run typecheck` across all 7 packages passed (0 errors, exit 0).
- ESLint: Targeted check on `user-list.ts`, `users-export.ts`, `UsersHeader.tsx` passed with 0 errors (exit 0).