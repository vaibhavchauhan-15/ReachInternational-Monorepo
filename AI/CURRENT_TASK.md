# Current Task

## Task: 196 — Native Daily Running Logs (/running-logs) Web App Parity: Segmented View Modes, Dynamic Searchable Selects, Reusable Summary & Sub-Header Cards, and Daily Shift Logs
**Status**: 🟢 COMPLETED
**Date**: 2026-10-17

**User Request**:
- Feedback on `/running-logs` page (viewport 1536×695):
  - Screenshot of web app running logs page provided.
  - "see the screenshot of the web app of runnings logs page and like same way implement the running logs page too make sure it should be consistent , reusable components ,clean and optimize apge"

**Key Deliverables**:
1. **Filter Panel with Segmented Toggle & Dynamic Dropdowns (`RunningLogFilterPanel.tsx`)**:
   - Reusable top pill switcher: `SegmentedToggle` with `Machine` | `Clients` | `Operator` view modes.
   - Clean hairline border separation with `theme.colors.hairline`.
   - Dynamic mode-tailored filter dropdowns using `SearchableSelect`:
     - *Client View*: `Select Client` (with total count badge, `CLI-xxxx` code badge, address), `Select Location` (with site counter badge, `All Sites & Locations`), `Select Machine` (with machine count badge, `All Machines`), and `Select Month`.
     - *Machine View*: `Select Machine` (`M/C-xxxx` code badge, model, S/N) and `Select Month`.
     - *Operator View*: `Select Operator` (phone subtitle) and `Select Month`.
     - *Custom Range*: Start and End `CustomDatePicker` pickers when 'custom' month is selected.
2. **SearchableSelect Single-Line Trigger & Reach Sky Blue Accents (`SearchableSelect.tsx`)**:
   - Added `inlineDescription?: boolean` prop supporting single-line `Title · Code · Description` trigger layouts matching web screenshots.
   - Replaced neutral gray code badges with vibrant Reach Sky Blue tokens (`rgba(2,132,199,0.18)` fill, `rgba(2,132,199,0.35)` border, `#0284c7` / `#38bdf8` text) in triggers, popovers, and bottom sheet dialogs.
3. **Unified Group Summary Card (`RunningLogSummaryCard.tsx`)**:
   - Reusable card rendering entity headers matching screenshot:
     - *Client Mode*: Client title + `X Machines` Reach sky blue badge + collapsible chevron.
     - *Machine Mode*: Model name + Serial Number + `RENTED` / `AVAILABLE` status badge + `History` clock button.
     - *Operator Mode*: Operator name + role badge + total running hours.
4. **Machine Sub-Header Card for Client View (`RunningLogMachineHeaderCard.tsx`)**:
   - Renders machine sub-group bar: `Model (SN: xxxx)` with inline metrics summary: `DAYS: X`, `M/C RT: X.Xh` (Reach Sky Blue), `WH: Xh`.
5. **Daily Shift Card Overhaul (`RunningLogShiftCard.tsx`)**:
   - Redesigned daily shift card matching screenshot:
     - Top row: Sky Blue calendar icon + Excel-style date `DD-Mon-YY` (e.g. `17-Oct-26`) + conflict/remark indicators + secondary machine/client title on right.
     - Middle row: `Shift: A` (highlighted sky blue) and `Operator: <Name>`.
     - Bottom row: 3 rounded stat boxes side-by-side: `M/C RT` (blue bold value), `WH` (ink bold value), `B/D` (ink bold value).
     - Expandable section: "View Remark" / "View Remarks & Stoppage" toggle with styled quote callout and stoppage duration breakdown.
6. **Operations Master Data Hook Extension (`useOperationsData.ts`)**:
   - Added `ClientSiteRecord` interface.
   - Extended `useOperationsMasterData` to query `client_sites` in parallel with machines, assignments, operators, and clients.
7. **Running Logs Page Orchestration (`running-logs.tsx`)**:
   - Rebuilt `apps/mobile/app/(app)/running-logs.tsx` to seamlessly coordinate `RunningLogFilterPanel`, `RunningLogSummaryCard`, `RunningLogMachineHeaderCard`, and `RunningLogShiftCard`.
   - Integrated mobile header with back button, screen title, interactive search bar toggle, and export / print modal menu.
   - Integrated TanStack Query hooks, pull-to-refresh (`RefreshControl`), and empty/error states.

**Verification Results**:
- `node apps/mobile/run-tests.mjs`: **PASS** (307/307 test scenarios passed, 100%).
- `node scripts/check-typography.mjs`: **PASS** (0 raw typography violations).
- `pnpm --filter @reachinternational/mobile typecheck`: **PASS** (0 TypeScript errors).
