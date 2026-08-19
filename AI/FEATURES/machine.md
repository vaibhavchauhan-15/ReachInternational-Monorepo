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
- `createMachine()`: Adds new machine to registry, logs audit event.
- `updateMachine()`: Updates machine details or changes status (`operational`, `maintenance_required`, `out_of_service`).
- `deleteMachine()`: Soft-deletes (marks inactive) a machine record.
- `importMachinesFromExcel()`: Bulk imports machines from Excel file with validation and error reporting.
- `getSampleExcelTemplate()`: Generates sample Excel template with correct column headers.

## Form Fields (MachineModal)
- Equipment Details & Specs: machine_code (auto-generated e.g. S374), model (e.g. S3246EE), serial_number (e.g. 3605417), manufacturer (e.g. JCB), year_of_mfg (e.g. 2026), machine_name (required)
- Engine & Motor: engine_serial_no (e.g. Electric), engine_mot_no (e.g. Electric)
- Compliance & Certificates: insurance_policy_no & insurance_expiry_date (e.g. 1st January 1970), third_party_certificate & third_party_expiry_date (e.g. 1st January 1970), rto_tax & rto_tax_expiry_date (e.g. 1st January 1970)
- Customer: customer_name (required), customer_mobile - 10 digit Indian (required), customer_email (optional)
- Location: city (required), state (required), customer_address (optional)
- Assignment & Status: engineer_id (optional), service_interval_days (default 90), status (`on_rent`, `active`, `under_maintenance`, `inactive`), notes (optional)

## Bulk Import Feature
- Excel upload with drag-and-drop support
- Auto-generated machine codes (MCH-XXXXXX format)
- Required columns: Machine Name, Customer Name, Customer Mobile, City, State
- Optional columns: Model, Customer Email, Customer Address, Assigned Engineer, Service Interval Days, Notes
- Engineer name matching (must match existing active engineers)
- Indian mobile number validation (10 digits starting with 6-9)
- Comprehensive error reporting with row numbers
- Sample template download
- Audit logging for bulk imports
- Cache invalidation on successful import

## UI/UX & Card Grid Styling
- Quick filter status pills (`Overdue`, `Due Tomorrow`, `Due Today`) with semantic red, light blue, and yellow themes for dark and light mode contrast.
- Harmonized machine card grid view matching `/notifications` cards with top hairline sheen glow, inset details container, status border accents, and card hover lift.