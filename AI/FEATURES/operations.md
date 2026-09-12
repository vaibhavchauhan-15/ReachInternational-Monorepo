# Operations & Fleet Operations Feature Documentation

## Overview
The Operations module is the central command center for fleet deployment, daily equipment running hours, multi-shift personnel rosters, and operational dispute management across Reach International's equipment fleet.

It provides complete cross-platform parity between the Next.js Web App (`apps/web/components/operations/*`, `apps/web/app/(app)/operations/page.tsx`) and the React Native Mobile App (`apps/mobile/app/(app)/operations.tsx`, `apps/mobile/components/operations/*`).

---

## 1. Top-Level Tab Views

### A. Daily Running Hours (`tab=logs`)
Comprehensive operational logs and equipment utilization view organized across three sub-tabs:
1. **Machine Sub-Tab**:
   - Machine Selector & Month Selector.
   - Machine Overview Header Card: Current Rental Status badge (`RENTED`, `AVAILABLE`, etc.), 2x3 metrics grid (Manufacturer, Model, Serial Number / Code, Total Run Hours, Breakdown Events count).
   - Running Logs Feed: Touch cards displaying log date, submission timestamp, machine model, serial number, client name, site location, shift details, start/end meter readings, total run hours, overtime hours, breakdown alert badges, and remarks.
2. **Clients Sub-Tab**:
   - Client Selector, Location / Site Selector, Machine Filter, and Month Selector.
   - Client Overview Header Card: Rented machine count, active site locations, client working hours, active working days in month, and CRM contact details.
   - Client-Filtered Running Logs Feed.
3. **Operator Sub-Tab**:
   - Operator Selector & Month Selector.
   - 4 Operator KPI Cards: Total Run Hours, Total Overtime Hours, Breakdown Events, Matching Logs count.
   - Operator-Filtered Running Logs Feed.

### B. Operator Machine Assignments (`tab=assignments`)
24/7 Multi-Shift Roster and Equipment Assignment Management:
- **Header Actions**: `+ Assign Operator` primary action button.
- **4 Assignment Fleet KPI Cards**: Total Equipment, Active Shift Operators, Full Capacity (3/3), Unassigned (0/3).
- **Status Filter Chips**: `All`, `Assigned`, `Full (3/3)`, `Unassigned`.
- **Global Actions**: Expand All Cards / Collapse All Cards toggle.
- **Equipment Roster Cards**: Machine code, model, serial, HMR meter reading, rental status, roster capacity pill (`0/3`, `1-2/3`, `3/3`), "+ Assign Operator" quick action, and expandable 3-shift cards (Shift 1 06:00-14:00, Shift 2 14:00-22:00, Shift 3 22:00-06:00) with operator contact shortcuts and unassign actions.

---

## 2. Modal Systems & Dialogs

### Assign Operator Modal (`MobileAssignmentModal.tsx`)
- Target Machine selector with live search.
- Operator selector with role validation (`operator`, `driver`, `helper`).
- Shift selector: Shift 1 (06:00 - 14:00), Shift 2 (14:00 - 22:00), Shift 3 (22:00 - 06:00), or Custom shift hours.
- Time pickers with standard/overnight shift indicators.
- Atomic conflict checking via `assign_operator_machine_atomic` RPC to prevent double-booking machines across shifts.

### Filter Selector Modal (`OperationsFilterSelectorModal.tsx`)
- Reusable bottom sheet modal for choosing Machine, Client, Site Location, Operator, and Month.
- Live search filtering, clean typography, Geist token adherence, and checkmark feedback.

### Export & Print Modal (`OperationsExportModal.tsx`)
- Professional PDF generation matching web `PrintableSupervisorLogsModal.tsx` via `expo-print` + `expo-sharing`.
- Direct AirPrint / Android Print Spooler integration via `Print.printAsync({ html })`.
- CSV Spreadsheet generation via `expo-file-system/legacy` + `expo-sharing`.
- Comprehensive metadata header: Export scope, active filters, total hours, overtime, breakdown count, and record count.

### Conflict Resolution Modal (`MobileConflictResolutionModal.tsx`)
- Resolves overlapping shift hours and overtime disputes via `resolve_hour_log_conflict_atomic` RPC.

---

## 3. Database & DAL Dependencies
- `machines` table: `id`, `machine_code`, `model`, `serial_number`, `manufacturer`, `status`, `current_meter_reading`.
- `machine_assignments` table: `id`, `machine_id`, `operator_id`, `shift_id`, `start_time`, `end_time`, `is_active`.
- `hour_logs` table: `id`, `machine_id`, `operator_id`, `client_id`, `log_date`, `shift_id`, `start_meter`, `end_meter`, `total_hours`, `overtime_hours`, `breakdown_occurred`, `breakdown_notes`, `remarks`, `conflict_status`.
- `clients` & `client_sites` tables: CRM client details, addresses, and site names.
- RPC functions: `assign_operator_machine_atomic`, `resolve_hour_log_conflict_atomic`.

---

## 4. Client Canonical Address & Multi-Site Location Architecture
- **Canonical Address Standard**: `address = client.street + client.city + client.district + client.state + client.pincode` (comma-delimited, non-empty components only).
- **Database Schema**: `public.clients` contains a single canonical `street text NOT NULL` column (duplicate `"Street"` and separate `address` columns were dropped in Migration 065). All application layers compute the full address on the fly.
- **Multi-Site Client Resolution**:
  - When the same client company operates across different project locations, separate client rows share the same `company_name` with distinct `street`, `city`, `district`, `state`, `pincode`.
  - The Operations Hub aggregates all site addresses for that company into `clientSites` (Web) and `clientLocations` (Mobile).
  - Filtering by site uses bidirectional containment matching (`locStr.includes(targetLoc) || targetLoc.includes(locStr)`), ensuring historical log fragments and full canonical addresses both resolve correctly.

---

## 5. Operations Hub Multi-Filter Hierarchy & Dynamic Synchronization
- **Default Multi-Filter Behavior**:
  - **Client**: Defaults to the client with the most recent operational logs (e.g. JK Paper Ltd.).
  - **Location**: Defaults to `"all"` ("All Sites & Locations").
  - **Machine**: Defaults to `"all"` ("All Machines").
  - **Month**: Defaults to the current calendar month (e.g. `"09"` / September).
- **Synchronized Filter Hierarchy (`client + location + machine + month`)**:
  - Selecting any filter dynamically updates server query parameters and recalculates both the aggregate KPI metrics (Run Hours, OT, Breakdowns, Working Days) and the paginated bottom entries table/touch cards.
  - Selecting "All Months" (`month=all`) is explicitly preserved in URL and queries across all recorded time.
  - Safe alphanumeric token resolution prevents PostgREST grammar crashes when filtering addresses containing colons or punctuation (`"CPM |PO : CP Mills"`).

---

## 6. Dynamic Viewport-Aware Selectors & Unified Transitions
- **Positioning Engine (`useDynamicDropdownPosition.ts`)**:
  - Uses `useIsomorphicLayoutEffect` for pre-paint synchronous measurement on client, eliminating the (0,0) coordinate flash on first open.
  - Returns `isPositioned: boolean` guard ensuring portals do not render before valid non-zero bounding rect calculation.
  - Provides `updatePosition()` callable synchronously in click handlers before toggling open state.
  - Automatically handles viewport collisions (flipping placement between `"bottom"` and `"top"`), dynamic max-height clipping, scroll/resize tracking (`capture: true`), and click-outside dismissal.
- **Framer Motion `<AnimatePresence>` & `<motion.div>` Standard**:
  - Consistent across `MachineSelect`, `ClientSelect`, `SearchableSelect`, `UserSelect`, `CustomDatePicker`, and `DateRangePicker`.
  - Spring-like easing: `ease: [0.16, 1, 0.3, 1]` with `duration: 0.16s`, scale `0.97`, dynamic `transformOrigin` (`"bottom center"` / `"top center"`), and directional `y` offset based on placement.
  - Non-flickering exit transitions with `onExitComplete` cleanup.

---

## 7. Unified Custom Calendar Date Range Picker (`DateRangePicker.tsx`)
- **Single Component Date Range Workflow**: Replaces separate Start Date and End Date dropdowns with a single, high-density, minimal `<DateRangePicker>` component.
- **Reused Calendar Architecture**: Reuses the exact custom calendar layout, month navigation, weekday headers, and days grid from `CustomDatePicker.tsx`.
- **Outer Portal Architecture (`createPortal` Outside `<AnimatePresence>`)**:
  - Ensures clean React 19 / Framer Motion 12 lifecycle mounting in `document.body` without `PopChildMeasure` errors.
  - Standardized across `DateRangePicker`, `CustomDatePicker`, `ClientSelect`, `MachineSelect`, `SearchableSelect`, and `UserSelect`.
- **Dynamic Viewport Collision & Explicit Style Resets**:
  - Uses explicit `top: position.top !== undefined ? `${position.top}px` : "auto"` and `bottom: position.bottom !== undefined ? `${position.bottom}px` : "auto"`.
  - Prevents Framer Motion from retaining stale coordinates that previously collapsed popovers to 0px height when flipping between top and bottom on short screens (e.g. 1536×695).
  - Streamlined height (~280px) ensures full calendar visibility without internal scrolling or cutoff.
  - Elevated z-index to `99999` guarantees popover is never blocked by cards, modals, or tables.
- **Clean, Minimal Popover Layout (No Clutter / No Presets / No Header Banner)**:
  - Removed preset quick range pills (`Today`, `Yesterday`, etc.) and status bar (`01-08-2026 → 12-09-2026 43 Days`) inside the popover to deliver an ultra-clean, appealing UI.
  - Popover opens directly with the Month Switcher navigation (`< Month Year >`), allowing users to browse and select any month's start and end dates directly on the calendar grid.
- **Interactive Range Selection**:
  - First click sets `tempStartDate`, clears `tempEndDate`, and highlights the start day.
  - Mouse hover creates a live provisional range ribbon between start date and hovered day.
  - Second click on or after start date completes the range, sets `tempEndDate`, and fires `onChange({ startDate, endDate })`.
  - Re-anchoring support: Clicking an earlier date re-anchors the start date cleanly.
  - Same-day range: Clicking the start date twice creates a single-day range (`startDate === endDate`).
- **Connected Ribbon Highlighting**: Start cell (`rounded-l-xl`), End cell (`rounded-r-xl`), and in-range cells (`rounded-none bg-sky-500/15`) with weekend edge rounding.
- **Trigger Button**: Displays `01-09-2026 to 12-09-2026` with `12 Days` pill badge, calendar icon, clear button (`AnimatedX`), and animated chevron.
- **Clean Action Footer**: Compact `Clear`, `Cancel`, and `Apply Range` buttons adhering to Vercel Geist tokens.

---

## 10. Centralized PDF Generation & Export Architecture

### Centralized Service Structure (`apps/web/lib/pdf/` & `apps/web/components/pdf/`)
- **Configuration & Filenames (`apps/web/lib/pdf/pdf-config.ts`)**:
  - Pinned page dimensions (A4 portrait: 210mm × 297mm, margins: 5mm top/bottom, 8mm left/right).
  - Standardized branding tokens: `REACH INTERNATIONAL`, `/pdf-logo.png`, `PDF_PAGE`, `MONTH_NAMES`.
  - Filename builders: `buildExportFileName`, `buildMachineExportFileName`, `buildMachinesExportFileName`.
  - Date/time slugs: `formatExportDateTimeSlug` (display and slug format).
- **Centralized Print Styles (`apps/web/lib/pdf/pdf-print-styles.ts`)**:
  - `getPrintStylesheet(documentId, previewId, options)`: Single generator for `@page`, `@media print`, `page-break-inside: avoid`, and high-density centered table styling.
- **Shared Utilities (`apps/web/lib/pdf/pdf-utils.ts`)**:
  - `isUuid()`: Identifies raw UUIDs to prevent displaying them.
  - `resolveCleanClientName()`: Cascade resolution for client company name falling back to "Client Representative".
  - `resolvePeriodLabel()`: Month or custom date range label formatter.
  - `formatCompactTiming()`: Range formatter with zero spaces.
  - `computeDurationHours()`: Standardized duration calculator.
  - `handleBrowserPrint()`: Browser print handler with temporary document title swap for clean saved filename.
- **Reusable Print Components (`apps/web/components/pdf/`)**:
  - `<PDFReportHeader>`: Reusable header with logo, title, single-line/multiline subtitle, and metadata strip.
  - `<PDFKPIStrip>`: Reusable 4-column KPI metric summary.
  - `<PDFSignatureBlock>`: Standardized 3-column verification block (Prepared By, Client Details & Sign-off, Verified & Approved By).
  - `<PDFTableWrapper>`: Print-optimized table wrapper with screen scroll support.
- **Mobile PDF Templates (`apps/mobile/lib/pdf-html-templates.ts`)**:
  - `buildPdfHtmlStyles`, `buildPdfHtmlHeader`, `buildPdfHtmlKpiStrip`, `buildPdfHtmlSignatureBlock`, `buildPdfHtmlWrapper` used by `OperationsExportModal.tsx` and `MachineExportModal.tsx` for `expo-print`.






