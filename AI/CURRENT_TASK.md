# Current Task: Page Feedback /users?tab=all&page=1 — Full Mobile Responsiveness Pass, ≥44px Touch Targets & RPC Optimization
Status: COMPLETE (2026-09-09)

Problem & Root Cause (User Feedback at 1366×599, mobile optimization requested):
1. **Sub-44px Touch Targets Everywhere (violates GLOBAL-RESPONSIVE-DESIGN.md §5)**:
   - Search input `py-2` (~34px), FilterToolbar Filter/Reset buttons `py-2` (~34px), `CustomFilterSelector` triggers `h-9` (36px) with option rows `min-h-[36px]`, Pagination buttons `h-7` (28px), Export trigger `h-9` (36px), bulk-bar action buttons `h-8` (32px), pending-approval/profile-request batch buttons `h-8` and not full-width on mobile.
   - Search input `text-xs` (<16px) triggers iOS Safari focus auto-zoom.
2. **Horizontal Overflow at 320px**:
   - Floating bulk actions bar `w-[92%] min-w-[320px]` — at 320px viewport 92% = 294px but min-width forced 320px → overflow/clipped buttons.
3. **Wasted RPC Round-Trips**:
   - `getSupervisorsAction()` + `getWorkingLocationsAction()` fired on mount for ALL users, including read-only supervisors (readOnly=true) who can never use supervisor/working-location selectors — 2 wasted server-action calls per page load (painful on mobile networks).

Completed Changes:
1. **users-client.tsx**: `CustomFilterSelector` trigger `h-11 sm:h-9` + option rows `min-h-[44px] sm:min-h-[36px]`; Export trigger `h-11 sm:h-9`; bulk-bar `min-w-0 sm:min-w-[320px]` + `bottom-4 sm:bottom-6` + buttons `h-9 sm:h-8`; pending approvals header batch actions full-width on mobile (`w-full sm:w-auto`, `flex-1 sm:flex-initial`, `h-9 sm:h-8`); supervisor/working-location hydration gated behind `!readOnly` with `[readOnly]` dep.
2. **FilterToolbar.tsx**: search input `h-11 sm:h-9` + `text-[16px] sm:text-xs`; Filter toggle & Reset buttons `h-11 sm:h-9`.
3. **Table.tsx (Pagination)**: First/Prev/Next/Last `h-11 sm:h-8`; per-page select `h-9 sm:h-7`. Shared primitive — additive mobile-only sizing, desktop identical, audited downstream across all modules.
4. **ProfileChangeRequestsSection.tsx**: header batch buttons `h-9 sm:h-8` + full-width mobile container; per-request Approve/Reject `h-9 sm:h-8`.

Mobile Parity Note:
- No `apps/mobile` change required: the native users screen is already touch-native (touch cards, bottom-sheet detail, 300ms debounced search with skeletons) and does NOT perform a separate supervisor/working-location fetch (hydrates from the user list) — zero web-mobile drift.

Verification:
- `pnpm --filter @reachinternational/web exec tsc -p tsconfig.json --noEmit` — 0 errors.
- Mobile typecheck with stack workaround (`node --stack-size=8000 <pnpm-store>/typescript/bin/tsc -p apps/mobile/tsconfig.json --noEmit`) — 0 errors.

Next Steps:
- Visually verify at 320px / 375px / 768px / 1366px: search bar, filter dropdowns, pagination, bulk selection bar, pending approvals & profile request batch buttons.

