# Feature Module — Machine Fleet & Operations Tracking

## Overview
Manages machine fleet registry, serial numbers, client assignments, supervisor and operator assignments, operational health status, and hour meter running logs.

## File Map
- **Pages**: `app/(app)/machines/page.tsx`, `app/(app)/machines/[id]/page.tsx`, `app/(app)/machines/[id]/edit/page.tsx`
- **Components**: `components/machines/MachineListClient.tsx`, `components/machines/MachineModal.tsx`, `components/machines/MachineImportModal.tsx`, `components/machines/MobileMachineCard.tsx`, `components/machines/MachineRow.tsx`
- **Actions**: `app/actions/machines.ts`, `app/actions/machine-import.ts`
- **Queries**: `lib/queries/machines.ts`

## Key Functions & Workflows
- `getMachines()`: Fetches paginated/filtered list of machines with client, operator, and supervisor profile relations.
- `getMachineById()`: Fetches machine details by ID with specifications and assigned client details.
- `getMachineHourMeterLogs()`: Fetches daily operator hour meter logs with start/end readings, operating hours, overtime, client, and operator profile.
- `getMachineActiveRental()`: Fetches active rental contract and client company details for machines with status `rented`.
- `createMachine()`: Adds new machine to registry with specifications, logs audit event.
- `updateMachine()`: Updates machine details, master specs, or changes status (`available`, `rented`, `under_maintenance`, `breakdown`).
- `deleteMachine()`: Permanently deletes a machine record.
- `importMachinesFromExcel()`: Bulk imports machines from Excel file with validation and duplicate prevention.

## Form Fields & Technical Parameters (MachineModal, Machine Edit & Machine Detail Page)
- **Equipment Master Specs**: `machine_id` (auto-generated e.g. `RI-MC-0001`), `model` (required), `serial_number` (required, unique), `manufacturer` (required), `year_of_mfg` (required), `hour_meter` (HMR).
- **Assignments & Personnel (24h Multi-Shift Fleet Coverage)**:
  - `supervisor_ids UUID[]`: Array of assigned supervisors across operational shifts (with GIN index and automatic primary element sync to `current_supervisor_id`).
  - `operator_ids UUID[]`: Array of assigned operators across operational shifts (with GIN index and automatic primary element sync to `current_operator_id`).
  - `MultiUserSelect`: Searchable multi-chip selector with shift timing metadata tags (e.g. `08:00 AM - 08:00 PM`), removable chips, and clear all.
  - `client_id`: Assigned client organization (when rented).
- **Operational Status**: `health_status` (`active`, `under_maintenance`, `breakdown`), `status` (`available`, `rented`).

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