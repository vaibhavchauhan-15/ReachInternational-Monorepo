# Feature Module — Machine Fleet & Operations Tracking

## Overview
Manages machine fleet registry, serial numbers, client assignments, supervisor and operator assignments, operational health status, and hour meter running logs.

## File Map
- **Web Pages**: `app/(app)/machines/page.tsx`, `app/(app)/machines/[id]/page.tsx`, `app/(app)/machines/[id]/edit/page.tsx`, `app/(app)/operations/audit-logs/page.tsx`
- **Web Components**: `components/machines/MachineListClient.tsx`, `components/machines/MachineModal.tsx`, `components/machines/MachineImportModal.tsx`, `components/machines/MobileMachineCard.tsx`, `components/machines/MachineRow.tsx`, `components/operations/AssignmentAuditLogsClient.tsx`
- **Mobile Screen**: `apps/mobile/app/(app)/machines.tsx` (Supports Fleet Directory list with 4 KPI cards, filters, and detail view switcher)
- **Mobile Components (`apps/mobile/components/machines/*`)**:
  - `MobileMachineCard.tsx`: Touch card with status accent borders, copy ID, specs well, personnel, and action buttons
  - `MachineDetailView.tsx`: Full specifications view with `< Back to Machines`, scissor-lift hero card, segmented tabs, CRM client card, and running logs tab
  - `MachineDetailModal.tsx`: Full-screen modal presentation of `MachineDetailView`
  - `MachineModal.tsx`: Add / Edit modal matching Screenshot 1 with Section 0 specs, Section 1 personnel & meter, Section 2 status
  - `MultiUserSelectModal.tsx`: Multi-user picker sheet for shift supervisors and operators
  - `ClientSelectModal.tsx`: Searchable CRM client selector sheet
  - `DeleteMachineDialog.tsx`: Destructive confirmation dialog with machine code & model
  - `MachineImportModal.tsx`: Bulk Excel import instructions and schema sheet
  - `CustomFilterSelectorModal.tsx`: Reusable picker modal for Rental, Health, Supervisor, and Sort
- **Actions**: `app/actions/machines.ts`, `app/actions/machine-import.ts`, `app/actions/assignments.ts`
- **Queries**: `lib/queries/machines.ts`, `lib/queries/operators.ts`, `lib/queries/assignments.ts`

## Key Functions & Workflows
- `getMachines()`: Fetches paginated/filtered list of machines with client, operator, and supervisor profile relations.
- `getMachineById()`: Fetches machine details by ID with specifications and assigned client details.
- `getOperationsHubData()`: High-performance, tab-aware operations hub data loader with resilient multi-tier hour logs querying (`fetchHourLogsResiliently`) and in-memory relation enrichment.
- `getAssignmentAuditLogs()`: Resilient assignment audit history query with pure scalar projections, in-memory hydration for machines/clients/staff, structured error formatting, and automatic derivation from machine state.
- `getMachineHourMeterLogs()`: Fetches daily operator hour meter logs with start/end readings, operating hours, overtime, client, and operator profile.
- `getMachineActiveRental()`: Fetches active rental contract and client company details for machines with status `rented`.
- `createMachine()`: Adds new machine to registry with specifications, logs audit event.
- `updateMachine()`: Updates machine details, master specs, or changes status (health: `active`, `spare`, `under_maintenance`, `breakdown`; rental: `available`, `rented`).
- `deleteMachine()`: Permanently deletes a machine record.
- `importMachinesFromExcel()`: Bulk imports machines from Excel file with validation and duplicate prevention.
- `createAssignmentAction()`: Assigns operator to machine on a recurring daily shift window (`shift_start_time`, `shift_end_time`) with atomic max 3 capacity and GiST circular exclusion overlap enforcement.
- `endAssignmentAction()`: Ends an active assignment with audit tracking and syncs `machines.operator_ids`.
- `resolveHourLogConflictAction()`: Resolves a soft-flagged overtime assignment conflict (`acknowledge` or `adjust`).
- `submitOperatorHourLogAction()` / `submit_operator_hour_log_atomic` (Migration 052): Atomic, audited operational hour logging with meter regression check, caller identity verification (`auth.uid() = p_operator_id`), client-machine deployment validation, machine status guards (rejecting `maintenance` and `decommissioned`), future shift end guards, and breakdown bounds checking (`breakdown_hours <= shift_duration`). Fully synchronized across Web and React Native mobile app.

## Form Fields & Technical Parameters (MachineModal, Machine Edit & Machine Detail Page)
- **Equipment Master Specs**: `machine_id` (auto-generated e.g. `RI-MC-0001`), `model` (required), `serial_number` (required, unique), `manufacturer` (required), `year_of_mfg` (required), `hour_meter` (HMR).
- **Assignments & Personnel (24h Multi-Shift Fleet Coverage)**:
  - `public.operator_machine_assignments`: Authoritative multi-operator assignment roster with daily recurring shift windows (`shift_start_time`, `shift_end_time`, `crosses_midnight`, `is_active`, `assigned_by`, `assigned_at`, `ended_at`, `ended_by`, `end_reason`). Enforces max 3 active operators per machine via advisory transaction locks (`enforce_max_operators_per_machine`).
  - `public.operator_shift_ranges`: Normalized 0–1440 circular minute line mapping unrolled across midnight with PostgreSQL GiST exclusion constraint (`EXCLUDE USING GIST (operator_id WITH =, minute_range WITH &&) WHERE (is_active)`) preventing double-booked operators across overlapping shifts.
  - `supervisor_ids UUID[]`: Array of assigned supervisors across operational shifts (with GIN index and automatic primary element sync to `current_supervisor_id`).
  - `operator_ids UUID[]`: Mirrored array of active assigned operators trigger-synced from `operator_machine_assignments` for backward compatibility.
  - `MultiUserSelect`: Searchable multi-chip selector with shift timing metadata tags (e.g. `08:00 AM - 08:00 PM`), removable chips, and clear all.
  - `client_id`: Assigned client organization (when rented).
- **Overtime Conflict Soft-Flagging & Resolution Queue**:
  - `machine_hour_logs` tracks `conflict_flag`, `conflict_reason`, `conflict_status` ('pending' | 'acknowledged' | 'adjusted'), `conflict_resolved_by`, `conflict_resolved_at`, and `conflict_resolution_notes`.
  - Non-blocking submission: When an operator logs overtime extending into another machine's shift window, the log is accepted and soft-flagged for supervisor review without halting operations.
- **Operational Status**: `health_status` (`active`, `spare`, `under_maintenance`, `breakdown`), `status` (`available`, `rented`).

## Machine Detail View (`/machines/[id]`)
- **2-Tab Streamlined Architecture**:
  1. **Basic Info & Client**: Displays core master parameters (ID, Model, Serial Number, YUM, Manufacturer, HMR, Rental Status, Health Status), dedicated **"Assigned Shift Personnel (24h Fleet Coverage)"** section detailing all assigned supervisors and operators with shift times and communication shortcuts, and Assigned Client Details with 1-click Contact/Directions Actions (Call, WhatsApp, Google Maps Location, Copy Site Address).
  2. **Hours Meter Logs**: Complete daily shift logbook entries with log date, client company, operator, start/end meter readings, total running hours, and remarks.

## Serial Number Duplicate Prevention & Validation
- **Database Unique Constraint**: Case-insensitive, trimmed unique index `idx_machines_serial_number_unique_ci` on `public.machines (lower(trim(serial_number)))`.
- **Zod Schema Validation**: `CreateMachineSchema` and `UpdateMachineSchema` in `@reachinternational/validation` require trimmed, non-empty `serial_number`.
- **Real-Time Frontend Validation**: `MachineModal.tsx` and `machine-edit-client.tsx` validate `serial_number` on blur using `checkMachineSerialNumberAvailable`, displaying instant inline feedback before form submission.
- **Server Action Pre-Validation**: `createMachine()` and `updateMachine()` query existing records case-insensitively and block duplicates with human-readable error messages identifying the existing machine ID.
- **Excel Bulk Import Duplicate Detection**: `importMachinesFromExcel()` performs dual-stage duplicate validation: (1) intra-file duplicate detection across rows in the spreadsheet, and (2) database pre-fetched serial number checks.