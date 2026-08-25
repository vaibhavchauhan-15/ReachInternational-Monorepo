# Feature Module — Machine Inventory & Tracking

## Overview
Manages machine registry, serial numbers, client assignments, engineer assignments, operational status, installation dates, and scheduled service deadlines.

## File Map
- **Pages**: `app/(app)/machines/page.tsx`, `app/(app)/machines/[id]/page.tsx`
- **Components**: `components/machines/MachineListClient.tsx`, `components/machines/MachineModal.tsx`, `components/machines/MachineImportModal.tsx`
- **Actions**: `app/actions/machines.ts`, `app/actions/machine-import.ts`
- **Queries**: `lib/queries/machines.ts`

## Key Functions & Workflows
- `getMachines()`: Fetches paginated/filtered list of machines with client and engineer profile relations.
- `getMachineById()`: Fetches machine details by ID with technical parameters and compliance dates.
- `getMachineBreakdownHistory()`: Fetches malfunction complaints and FSR records for a machine.
- `getMachineHourMeterLogs()`: Fetches daily operator hour meter logs with start/end readings, overtime, client, and operator profile.
- `getMachinePartsUsedHistory()`: Fetches inventory spare part issue challans and item quantities issued to a machine.
- `getMachineActiveRental()`: Fetches active rental contract and client company details for machines with status `on_rent`.
- `createMachine()`: Adds new machine to registry with technical parameters, logs audit event.
- `updateMachine()`: Updates machine details, technical specs, compliance dates, or changes status (`active`, `on_rent`, `under_maintenance`, `inactive`).
- `deleteMachine()`: Soft-deletes (marks inactive) a machine record.
- `importMachinesFromExcel()`: Bulk imports machines from Excel file with validation and error reporting.
- `getSampleExcelTemplate()`: Generates sample Excel template with correct column headers.

## Form Fields & Technical Parameters (MachineModal & Machine Detail Page)
- Equipment Details & Specs: `machine_code` (auto-generated e.g. S374), `machine_name` (required), `model` (e.g. S3246EE), `serial_number` (e.g. 3605417), `category_name`, `manufacturer` (e.g. JCB), `year_of_mfg` (e.g. 2026), `hour_meter`
- Engine, Motor & Tyres: `engine_serial_no`, `engine_mot_no`, `front_tyre_size`, `back_tyre_size`, `starter_motor_teeth`, `air_filter_no`, `headgas_kit_notch`, `diesel_filter_no`
- Compliance & Certificates: `insurance_policy_no` & `insurance_expiry_date` (formatted `1st January 1970`), `third_party_certificate` & `third_party_expiry_date`, `rto_tax` & `rto_tax_expiry_date`
- Customer & Client (On Rent): `customer_name` (required), `customer_mobile` - 10 digit Indian (required), `customer_email`, `customer_address`, `city` (required), `state` (required), rental contract number, start/end dates, rental rate
- Assignment & Status: `engineer_id` (optional), `service_interval_days` (default 90), `status` (`on_rent`, `active`, `under_maintenance`, `inactive`), `notes` (optional)

## Bulk Import Feature
- Excel upload with drag-and-drop support
- Auto-generated Machine IDs (e.g. `RI-MC-0001` format via trigger/sequence if left blank)
- Supported columns: `Machine ID`, `Model`, `Manufacturer`, `Serial Number`, `Year of MFG`, `Hour Meter`, `Service Count`, `Status`, `Health Status`
- Flexible column header aliases (`Machine ID`, `Model`, `Manufacturer`, `Serial Number`, `Year of MFG`, `Hour Meter`, `Service Count`, `Status`, `Health Status`)
- Health status normalization (`active`, `under_maintenance`, `breakdown`) and status normalization (`available`, `rented`)
- Comprehensive error reporting with row numbers and failure reasons
- Sample Excel template generator (`getSampleExcelTemplate()`) matching `public.machines` database schema
- Audit logging (`machine.bulk_import`) and tag-based cache revalidation on successful import

## UI/UX & Card Grid Styling
- Quick filter status pills (`Overdue`, `Due Tomorrow`, `Due Today`) with semantic red, light blue, and yellow themes for dark and light mode contrast.
- Harmonized machine card grid view matching `/notifications` cards with top hairline sheen glow, inset details container, status border accents, and card hover lift.

## RLS Security Policies & Error Handling
- **Database Migration (`043_fix_machines_rls_policies.sql`)**: PostgreSQL RLS policies on `public.machines` updated for `INSERT`, `UPDATE`, and `DELETE` operations, authorizing `super_admin`, `admin`, `company_admin`, `branch_manager`, `service_manager`, `rental_manager`, `store_manager`, and `supervisor` roles.
- **Canonical Error Sanitization (`formatMachineDatabaseError`)**: Converts raw database error codes (`42501` RLS, `23505` unique key violation, `23503` foreign key, `23502` null constraint) into clean, polite, user-friendly notices without technical stack traces.
- **Modal Error Banners (`MachineModal.tsx`)**: Renders red error banners with AlertCircle icons and inline field validation notices.