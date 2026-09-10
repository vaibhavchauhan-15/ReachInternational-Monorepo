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
